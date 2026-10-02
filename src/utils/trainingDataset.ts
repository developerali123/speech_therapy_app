import {
  TrainingExample,
  Recording,
  Exercise,
  TrainingExclusionReason,
  AudioQualityInfo,
  DatasetStatistics,
  TrainingTargetStats,
  TrainingDatasetFilters,
  MLLabelledDatasetExport,
  MLLabelledDatasetExportItem
} from '../types';
import { blobToBase64 } from './audio';

/**
 * Validates eligibility for ML training according to strict clinical rules:
 * - Only therapist-confirmed results ('CORRECT' or 'INCORRECT')
 * - Never automatic application results
 * - Excludes UNCERTAIN evaluations
 * - Excludes corrupted, empty, or sub-threshold audio
 * - Respects therapist exclusions
 */
export function isEligibleForTraining(
  recording: Partial<Recording>,
  minDuration = 0.2
): { eligible: boolean; reason?: string } {
  if (!recording.therapistResult) {
    return { eligible: false, reason: 'Pending clinical evaluation by therapist' };
  }

  if (recording.therapistResult === 'UNCERTAIN') {
    return { eligible: false, reason: 'Evaluation marked UNCERTAIN by clinician' };
  }

  if (recording.therapistResult !== 'CORRECT' && recording.therapistResult !== 'INCORRECT') {
    return { eligible: false, reason: 'Invalid or missing therapist clinical verdict' };
  }

  if (recording.excludedFromTraining) {
    return {
      eligible: false,
      reason: `Manually excluded: ${recording.trainingExclusionReason || 'other'}`
    };
  }

  if (typeof recording.duration === 'number' && recording.duration < minDuration) {
    return {
      eligible: false,
      reason: `Duration (${recording.duration.toFixed(2)}s) below required minimum (${minDuration}s)`
    };
  }

  if (recording.blob && recording.blob.size === 0) {
    return { eligible: false, reason: 'Audio payload is empty or corrupted' };
  }

  return { eligible: true };
}

/**
 * Inspects audio blob properties for quality assurance metadata.
 */
export async function inspectAudioQuality(
  blob: Blob,
  duration: number,
  mimeType: string
): Promise<AudioQualityInfo> {
  const result: AudioQualityInfo = {
    duration,
    mimeType,
    decodingStatus: 'VALID'
  };

  if (!blob || blob.size === 0) {
    result.decodingStatus = 'CORRUPTED';
    return result;
  }

  // If in browser environment supporting AudioContext, decode header
  const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (typeof AudioCtx === 'function') {
    try {
      const ctx = new AudioCtx();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      result.sampleRate = audioBuffer.sampleRate;
      result.channelCount = audioBuffer.numberOfChannels;

      // Calculate approximate silence percentage from channel 0
      const channelData = audioBuffer.getChannelData(0);
      let silentSamples = 0;
      const SILENCE_THRESHOLD = 0.015;
      for (let i = 0; i < channelData.length; i++) {
        if (Math.abs(channelData[i]) < SILENCE_THRESHOLD) {
          silentSamples++;
        }
      }
      result.silencePercentage = channelData.length > 0
        ? Math.round((silentSamples / channelData.length) * 100)
        : 0;

      await ctx.close();
      result.decodingStatus = 'VALID';
    } catch {
      // If decoding fails in browser
      result.decodingStatus = 'CORRUPTED';
    }
  }

  return result;
}

/**
 * Calculates dataset statistics grouped by target sound and sequence.
 */
export function calculateDatasetStatistics(
  examples: TrainingExample[],
  exercises: Exercise[] = []
): DatasetStatistics {
  const defaultTargets: Array<{
    key: string;
    text: string;
    name: string;
    difficulty: 'single' | 'sequence';
    units: string[];
  }> = [
    { key: 'ka', text: 'کا', name: 'Ka Practice', difficulty: 'single', units: ['کا'] },
    { key: 'ki', text: 'کی', name: 'Ki Practice', difficulty: 'single', units: ['کی'] },
    { key: 'ke', text: 'کے', name: 'Ke Practice', difficulty: 'single', units: ['کے'] },
    { key: 'ko', text: 'کو', name: 'Ko Practice', difficulty: 'single', units: ['کو'] },
    { key: 'ka-ki', text: 'کا، کی', name: 'Ka + Ki', difficulty: 'sequence', units: ['کا', 'کی'] },
    { key: 'ka-ki-ke', text: 'کا، کی، کے', name: 'Ka + Ki + Ke', difficulty: 'sequence', units: ['کا', 'کی', 'کے'] },
    { key: 'ka-ki-ke-ko', text: 'کا، کی، کے، کو', name: 'Ka + Ki + Ke + Ko', difficulty: 'sequence', units: ['کا', 'کی', 'کے', 'کو'] }
  ];

  // Merge with custom exercises if any
  for (const ex of exercises) {
    if (!defaultTargets.some((t) => t.key === ex.id || t.text === ex.targetText)) {
      defaultTargets.push({
        key: ex.id,
        text: ex.targetText,
        name: ex.name,
        difficulty: ex.difficulty || (ex.targetUnits?.length > 1 ? 'sequence' : 'single'),
        units: ex.targetUnits || [ex.targetText]
      });
    }
  }

  const targetStatsMap = new Map<string, TrainingTargetStats>();
  for (const t of defaultTargets) {
    targetStatsMap.set(t.key, {
      targetKey: t.key,
      targetText: t.text,
      name: t.name,
      difficulty: t.difficulty,
      targetUnits: t.units,
      totalExamples: 0,
      correctCount: 0,
      incorrectCount: 0,
      uncertainCount: 0,
      unreviewedCount: 0,
      includedCount: 0,
      excludedCount: 0
    });
  }

  const exclusionBreakdown: Record<TrainingExclusionReason, number> = {
    'background noise': 0,
    'cough': 0,
    'interruption': 0,
    'microphone problem': 0,
    'wrong exercise': 0,
    'accidental recording': 0,
    'poor audio': 0,
    'other': 0
  };

  let totalRecordings = examples.length;
  let totalTherapistReviewed = 0;
  let totalEligible = 0;
  let totalExcluded = 0;
  let totalUncertain = 0;
  let totalUnreviewed = 0;

  for (const ex of examples) {
    // Find matching target stat
    let matchedKey: string | undefined;
    for (const [key, t] of targetStatsMap.entries()) {
      if (
        ex.exerciseId === key ||
        ex.targetText === t.targetText ||
        (ex.exerciseId === 'ex-qaf-ka-01' && key === 'ka')
      ) {
        matchedKey = key;
        break;
      }
    }

    if (!matchedKey) {
      matchedKey = ex.exerciseId || ex.targetText;
      targetStatsMap.set(matchedKey, {
        targetKey: matchedKey,
        targetText: ex.targetText,
        name: ex.targetText,
        difficulty: ex.targetUnits && ex.targetUnits.length > 1 ? 'sequence' : 'single',
        targetUnits: ex.targetUnits || [ex.targetText],
        totalExamples: 0,
        correctCount: 0,
        incorrectCount: 0,
        uncertainCount: 0,
        unreviewedCount: 0,
        includedCount: 0,
        excludedCount: 0
      });
    }

    const stat = targetStatsMap.get(matchedKey)!;
    stat.totalExamples++;

    if (ex.therapistReviewedAt || ex.therapistLabel) {
      if (ex.therapistLabel === 'CORRECT') {
        stat.correctCount++;
        totalTherapistReviewed++;
      } else if (ex.therapistLabel === 'INCORRECT') {
        stat.incorrectCount++;
        totalTherapistReviewed++;
      } else if (ex.therapistLabel === 'UNCERTAIN') {
        stat.uncertainCount++;
        totalTherapistReviewed++;
        totalUncertain++;
      } else {
        stat.unreviewedCount++;
        totalUnreviewed++;
      }
    } else {
      stat.unreviewedCount++;
      totalUnreviewed++;
    }

    if (ex.includedInTraining) {
      stat.includedCount++;
      totalEligible++;
    } else {
      stat.excludedCount++;
      totalExcluded++;
    }

    if (ex.excludedReason && exclusionBreakdown[ex.excludedReason] !== undefined) {
      exclusionBreakdown[ex.excludedReason]++;
    }
  }

  const allTargets = Array.from(targetStatsMap.values());
  const individualTargets = allTargets.filter((t) => t.difficulty === 'single');
  const sequenceTargets = allTargets.filter((t) => t.difficulty === 'sequence');

  return {
    totalRecordings,
    totalTherapistReviewed,
    totalEligible,
    totalExcluded,
    totalUncertain,
    totalUnreviewed,
    individualTargets,
    sequenceTargets,
    allTargets,
    exclusionBreakdown
  };
}

/**
 * Filter training examples by target, unit, status, and dates.
 */
export function filterTrainingExamples(
  examples: TrainingExample[],
  filters: TrainingDatasetFilters
): TrainingExample[] {
  return examples.filter((item) => {
    // 1. Exercise filter
    if (filters.exerciseId && filters.exerciseId !== 'all') {
      const match =
        item.exerciseId === filters.exerciseId ||
        (filters.exerciseId === 'ka' && item.exerciseId === 'ex-qaf-ka-01') ||
        (filters.exerciseId === 'ex-qaf-ka-01' && item.exerciseId === 'ka');
      if (!match) return false;
    }

    // 2. Target unit filter
    if (filters.targetUnit && filters.targetUnit !== 'all') {
      if (!item.targetUnits.includes(filters.targetUnit)) return false;
    }

    // 3. Therapist result filter
    if (filters.therapistResult && filters.therapistResult !== 'all') {
      if (item.therapistLabel !== filters.therapistResult) return false;
    }

    // 4. Review status filter
    if (filters.reviewStatus && filters.reviewStatus !== 'all') {
      const hasReview = item.therapistLabel === 'CORRECT' || item.therapistLabel === 'INCORRECT' || item.therapistLabel === 'UNCERTAIN';
      if (filters.reviewStatus === 'reviewed' && !hasReview) return false;
      if (filters.reviewStatus === 'unreviewed' && hasReview) return false;
    }

    // 5. Training inclusion status
    if (filters.trainingStatus && filters.trainingStatus !== 'all') {
      if (filters.trainingStatus === 'included' && !item.includedInTraining) return false;
      if (filters.trainingStatus === 'excluded' && item.includedInTraining) return false;
    }

    // 6. Date range
    if (filters.startDate) {
      if (new Date(item.createdAt).getTime() < new Date(filters.startDate).getTime()) {
        return false;
      }
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      if (new Date(item.createdAt).getTime() > end.getTime()) {
        return false;
      }
    }

    // 7. Search query
    if (filters.searchQuery && filters.searchQuery.trim()) {
      const q = filters.searchQuery.toLowerCase().trim();
      const matchesText = item.targetText.toLowerCase().includes(q);
      const matchesRemarks = item.therapistRemarks?.toLowerCase().includes(q) || false;
      const matchesUnits = item.targetUnits.some((u) => u.toLowerCase().includes(q));
      if (!matchesText && !matchesRemarks && !matchesUnits) return false;
    }

    return true;
  });
}

/**
 * Builds structured ML dataset export.
 */
export async function generateMLDatasetExport(
  examples: TrainingExample[],
  recordings: Recording[],
  options: { includeAudioBase64?: boolean } = {}
): Promise<MLLabelledDatasetExport> {
  const recordingMap = new Map<string, Recording>();
  for (const r of recordings) {
    recordingMap.set(r.id, r);
  }

  const exportExamples: MLLabelledDatasetExportItem[] = [];
  const uniqueTargets = new Set<string>();

  for (const ex of examples) {
    uniqueTargets.add(ex.targetText);
    const rec = recordingMap.get(ex.recordingId);

    let audioBase64: string | undefined = undefined;
    if (options.includeAudioBase64 && rec && rec.blob) {
      try {
        audioBase64 = await blobToBase64(rec.blob);
      } catch {
        audioBase64 = undefined;
      }
    }

    exportExamples.push({
      id: ex.id,
      recordingId: ex.recordingId,
      exerciseId: ex.exerciseId,
      targetText: ex.targetText,
      targetUnits: ex.targetUnits,
      therapistLabel: ex.therapistLabel,
      therapistRemarks: ex.therapistRemarks,
      createdAt: ex.createdAt,
      therapistReviewedAt: ex.therapistReviewedAt,
      duration: ex.audioQuality?.duration ?? rec?.duration ?? 0,
      mimeType: ex.audioQuality?.mimeType ?? rec?.mimeType ?? 'audio/webm',
      includedInTraining: ex.includedInTraining,
      excludedReason: ex.excludedReason,
      audioQuality: ex.audioQuality,
      audioBase64
    });
  }

  const includedCount = exportExamples.filter((e) => e.includedInTraining).length;

  return {
    format: 'speech-practice-ml-dataset',
    version: 1,
    exportedAt: new Date().toISOString(),
    datasetName: 'Therapist-Labelled Speech Practice Dataset',
    totalExamples: exportExamples.length,
    totalIncludedForTraining: includedCount,
    targets: Array.from(uniqueTargets),
    metadata: {
      description:
        'Clinically validated speech practice audio recordings curated for training acoustic phoneme classifiers for Urdu speech therapy.',
      labelSchema: ['CORRECT', 'INCORRECT'],
      noteOnAudioPackaging:
        'Audio files are referenced by recordingId. When packaging for training pipelines (e.g. PyTorch/TensorFlow), extract audio files to audio/<recordingId>.wav or use embedded audioBase64 entries.',
      minDurationConfigured: 0.2
    },
    examples: exportExamples
  };
}

/**
 * Initiates download of the ML dataset export JSON file.
 */
export function downloadMLDatasetExport(dataset: MLLabelledDatasetExport): void {
  const jsonStr = JSON.stringify(dataset, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `speech-practice-ml-dataset-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
