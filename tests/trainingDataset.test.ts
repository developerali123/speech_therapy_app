import { describe, it, expect, beforeEach } from 'vitest';
import {
  TrainingExample,
  Recording,
  Exercise,
  TrainingExclusionReason,
  DatasetStatistics
} from '../src/types';
import {
  saveTrainingExample,
  getTrainingExample,
  getTrainingExampleByRecordingId,
  getAllTrainingExamples,
  deleteAllTrainingExamples,
  syncRecordingToTrainingExample,
  syncAllTrainingExamples
} from '../src/storage/trainingDatasetRepository';
import {
  createRecording,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import {
  isEligibleForTraining,
  calculateDatasetStatistics,
  filterTrainingExamples,
  generateMLDatasetExport
} from '../src/utils/trainingDataset';

describe('Phase 9: Training Dataset & ML Preparation', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllTrainingExamples();
  });

  describe('1. Dataset Concept & Creating Training Examples', () => {
    it('creates and persists a TrainingExample in IndexedDB', async () => {
      const example: TrainingExample = {
        id: 'te-rec-001',
        recordingId: 'rec-001',
        exerciseId: 'ka',
        targetUnits: ['کا'],
        targetText: 'کا',
        therapistLabel: 'CORRECT',
        therapistRemarks: 'Clean pronunciation of /k/ with back tongue contact',
        createdAt: '2026-10-01T10:00:00.000Z',
        therapistReviewedAt: '2026-10-01T10:05:00.000Z',
        datasetVersion: 1,
        includedInTraining: true,
        audioQuality: {
          duration: 1.25,
          mimeType: 'audio/webm',
          sampleRate: 48000,
          channelCount: 1,
          silencePercentage: 10,
          decodingStatus: 'VALID'
        }
      };

      await saveTrainingExample(example);

      const retrieved = await getTrainingExample('te-rec-001');
      expect(retrieved).toBeDefined();
      expect(retrieved?.recordingId).toBe('rec-001');
      expect(retrieved?.exerciseId).toBe('ka');
      expect(retrieved?.targetUnits).toEqual(['کا']);
      expect(retrieved?.targetText).toBe('کا');
      expect(retrieved?.therapistLabel).toBe('CORRECT');
      expect(retrieved?.therapistRemarks).toContain('Clean pronunciation');
      expect(retrieved?.includedInTraining).toBe(true);
      expect(retrieved?.audioQuality?.duration).toBe(1.25);
    });

    it('indexes training examples by recordingId', async () => {
      const example: TrainingExample = {
        id: 'te-rec-002',
        recordingId: 'rec-lookup-xyz',
        exerciseId: 'ki',
        targetUnits: ['کی'],
        targetText: 'کی',
        therapistLabel: 'INCORRECT',
        createdAt: new Date().toISOString(),
        datasetVersion: 1,
        includedInTraining: true
      };

      await saveTrainingExample(example);

      const byRec = await getTrainingExampleByRecordingId('rec-lookup-xyz');
      expect(byRec).toBeDefined();
      expect(byRec?.id).toBe('te-rec-002');
      expect(byRec?.exerciseId).toBe('ki');
    });

    it('synchronizes a recording into a TrainingExample', async () => {
      const recording: Recording = {
        id: 'rec-sync-01',
        sessionId: 'sess-01',
        exerciseId: 'ko',
        blob: new Blob(['fake audio content'], { type: 'audio/webm' }),
        duration: 0.8,
        createdAt: '2026-10-01T11:00:00.000Z',
        mimeType: 'audio/webm',
        result: { isCorrect: true, confidence: 0.95 }, // Automated application result
        therapistResult: 'CORRECT', // Therapist clinical label
        therapistRemarks: 'Excellent vowel rounding for کو',
        therapistReviewedAt: '2026-10-01T11:10:00.000Z'
      };

      const exercise: Exercise = {
        id: 'ko',
        name: 'Ko Practice',
        targetText: 'کو',
        targetUnits: ['کو'],
        difficulty: 'single',
        isActive: true,
        createdAt: '2026-10-01T00:00:00.000Z'
      };

      const example = await syncRecordingToTrainingExample(recording, exercise);

      expect(example.recordingId).toBe('rec-sync-01');
      expect(example.targetText).toBe('کو');
      expect(example.targetUnits).toEqual(['کو']);
      expect(example.therapistLabel).toBe('CORRECT');
      expect(example.includedInTraining).toBe(true);
      expect(example.excludedReason).toBeUndefined();
    });
  });

  describe('2. Therapist Label Changes & Strict Clinical Rules', () => {
    it('DOES NOT automatically treat algorithmic application results as training labels', async () => {
      const recordingWithAutoOnly: Recording = {
        id: 'rec-auto-only',
        sessionId: 'sess-01',
        exerciseId: 'ka',
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        duration: 1.0,
        createdAt: new Date().toISOString(),
        mimeType: 'audio/webm',
        // Algorithm says correct, but no therapist review
        result: { isCorrect: true, confidence: 0.99 }
      };

      const example = await syncRecordingToTrainingExample(recordingWithAutoOnly);

      // Must NOT be included in training without therapist clinical confirmation!
      expect(example.includedInTraining).toBe(false);
      expect(example.therapistReviewedAt).toBeUndefined();
    });

    it('includes example when therapist confirms CORRECT or INCORRECT', async () => {
      const recCorrect: Recording = {
        id: 'rec-corr',
        sessionId: 'sess-01',
        exerciseId: 'ka',
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        duration: 1.0,
        createdAt: new Date().toISOString(),
        mimeType: 'audio/webm',
        therapistResult: 'CORRECT',
        therapistReviewedAt: new Date().toISOString()
      };
      const ex1 = await syncRecordingToTrainingExample(recCorrect);
      expect(ex1.includedInTraining).toBe(true);

      const recIncorrect: Recording = {
        id: 'rec-incorr',
        sessionId: 'sess-01',
        exerciseId: 'ka',
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        duration: 1.0,
        createdAt: new Date().toISOString(),
        mimeType: 'audio/webm',
        therapistResult: 'INCORRECT',
        therapistReviewedAt: new Date().toISOString()
      };
      const ex2 = await syncRecordingToTrainingExample(recIncorrect);
      expect(ex2.includedInTraining).toBe(true);
    });

    it('excludes UNCERTAIN therapist reviews from training eligibility', async () => {
      const recUncertain: Recording = {
        id: 'rec-unc',
        sessionId: 'sess-01',
        exerciseId: 'ke',
        blob: new Blob(['audio'], { type: 'audio/webm' }),
        duration: 0.9,
        createdAt: new Date().toISOString(),
        mimeType: 'audio/webm',
        therapistResult: 'UNCERTAIN',
        therapistReviewedAt: new Date().toISOString()
      };

      const ex = await syncRecordingToTrainingExample(recUncertain);
      expect(ex.includedInTraining).toBe(false);
    });
  });

  describe('3. Eligibility Rules (isEligibleForTraining)', () => {
    it('validates only therapist-confirmed recordings with valid audio', () => {
      // Eligible CORRECT
      expect(isEligibleForTraining({
        therapistResult: 'CORRECT',
        duration: 1.0,
        blob: new Blob(['audio'])
      }).eligible).toBe(true);

      // Eligible INCORRECT
      expect(isEligibleForTraining({
        therapistResult: 'INCORRECT',
        duration: 0.8,
        blob: new Blob(['audio'])
      }).eligible).toBe(true);

      // Ineligible: No therapist review
      const pending = isEligibleForTraining({
        duration: 1.0,
        blob: new Blob(['audio'])
      });
      expect(pending.eligible).toBe(false);
      expect(pending.reason).toContain('Pending clinical evaluation');

      // Ineligible: UNCERTAIN verdict
      const uncertain = isEligibleForTraining({
        therapistResult: 'UNCERTAIN',
        duration: 1.0,
        blob: new Blob(['audio'])
      });
      expect(uncertain.eligible).toBe(false);
      expect(uncertain.reason).toContain('UNCERTAIN');

      // Ineligible: Audio shorter than 0.2s minimum
      const tooShort = isEligibleForTraining({
        therapistResult: 'CORRECT',
        duration: 0.1,
        blob: new Blob(['a'])
      });
      expect(tooShort.eligible).toBe(false);
      expect(tooShort.reason).toContain('below required minimum');

      // Ineligible: Empty blob
      const emptyBlob = isEligibleForTraining({
        therapistResult: 'CORRECT',
        duration: 1.0,
        blob: new Blob([])
      });
      expect(emptyBlob.eligible).toBe(false);
      expect(emptyBlob.reason).toContain('empty or corrupted');
    });
  });

  describe('4. Exclude from Training & Reasons', () => {
    const reasons: TrainingExclusionReason[] = [
      'background noise',
      'cough',
      'interruption',
      'microphone problem',
      'wrong exercise',
      'accidental recording',
      'poor audio',
      'other'
    ];

    it.each(reasons)('supports exclusion reason: %s', async (reason) => {
      const recording: Recording = {
        id: `rec-excl-${reason.replace(/\s+/g, '-')}`,
        sessionId: 'sess-01',
        exerciseId: 'ki',
        blob: new Blob(['audio']),
        duration: 1.0,
        createdAt: new Date().toISOString(),
        mimeType: 'audio/webm',
        therapistResult: 'CORRECT',
        excludedFromTraining: true,
        trainingExclusionReason: reason
      };

      const example = await syncRecordingToTrainingExample(recording);
      expect(example.includedInTraining).toBe(false);
      expect(example.excludedReason).toBe(reason);

      const eligibility = isEligibleForTraining(recording);
      expect(eligibility.eligible).toBe(false);
      expect(eligibility.reason).toContain(reason);
    });
  });

  describe('5. Dataset Statistics & Exercise Grouping', () => {
    it('calculates comprehensive statistics for single sounds and sequences', () => {
      const mockExamples: TrainingExample[] = [
        // 2 for کا: 1 Correct, 1 Incorrect
        {
          id: 'te-1',
          recordingId: 'r1',
          exerciseId: 'ka',
          targetUnits: ['کا'],
          targetText: 'کا',
          therapistLabel: 'CORRECT',
          createdAt: '2026-10-01T10:00:00Z',
          datasetVersion: 1,
          includedInTraining: true
        },
        {
          id: 'te-2',
          recordingId: 'r2',
          exerciseId: 'ka',
          targetUnits: ['کا'],
          targetText: 'کا',
          therapistLabel: 'INCORRECT',
          createdAt: '2026-10-01T10:01:00Z',
          datasetVersion: 1,
          includedInTraining: true
        },
        // 2 for کی: 1 Correct, 1 Uncertain
        {
          id: 'te-3',
          recordingId: 'r3',
          exerciseId: 'ki',
          targetUnits: ['کی'],
          targetText: 'کی',
          therapistLabel: 'CORRECT',
          createdAt: '2026-10-01T10:02:00Z',
          datasetVersion: 1,
          includedInTraining: true
        },
        {
          id: 'te-4',
          recordingId: 'r4',
          exerciseId: 'ki',
          targetUnits: ['کی'],
          targetText: 'کی',
          therapistLabel: 'UNCERTAIN',
          createdAt: '2026-10-01T10:03:00Z',
          datasetVersion: 1,
          includedInTraining: false,
          excludedReason: 'other'
        },
        // 1 for کے: 1 Unreviewed
        {
          id: 'te-5',
          recordingId: 'r5',
          exerciseId: 'ke',
          targetUnits: ['کے'],
          targetText: 'کے',
          therapistLabel: 'UNCERTAIN',
          createdAt: '2026-10-01T10:04:00Z',
          datasetVersion: 1,
          includedInTraining: false
        },
        // 1 for کو: 1 Correct but excluded due to cough
        {
          id: 'te-6',
          recordingId: 'r6',
          exerciseId: 'ko',
          targetUnits: ['کو'],
          targetText: 'کو',
          therapistLabel: 'CORRECT',
          createdAt: '2026-10-01T10:05:00Z',
          datasetVersion: 1,
          includedInTraining: false,
          excludedReason: 'cough'
        },
        // 1 for sequence کا، کی: 1 Correct
        {
          id: 'te-7',
          recordingId: 'r7',
          exerciseId: 'ka-ki',
          targetUnits: ['کا', 'کی'],
          targetText: 'کا، کی',
          therapistLabel: 'CORRECT',
          createdAt: '2026-10-01T10:06:00Z',
          datasetVersion: 1,
          includedInTraining: true
        }
      ];

      const stats: DatasetStatistics = calculateDatasetStatistics(mockExamples);

      expect(stats.totalRecordings).toBe(7);
      expect(stats.totalEligible).toBe(4); // te-1, te-2, te-3, te-7
      expect(stats.totalExcluded).toBe(3); // te-4, te-5, te-6
      expect(stats.exclusionBreakdown['cough']).toBe(1);

      // Verify "کا"
      const kaStat = stats.individualTargets.find((t) => t.targetText === 'کا');
      expect(kaStat).toBeDefined();
      expect(kaStat?.correctCount).toBe(1);
      expect(kaStat?.incorrectCount).toBe(1);
      expect(kaStat?.uncertainCount).toBe(0);
      expect(kaStat?.includedCount).toBe(2);

      // Verify "کی"
      const kiStat = stats.individualTargets.find((t) => t.targetText === 'کی');
      expect(kiStat?.correctCount).toBe(1);
      expect(kiStat?.uncertainCount).toBe(1);
      expect(kiStat?.includedCount).toBe(1);

      // Verify Sequence "کا، کی"
      const seqStat = stats.sequenceTargets.find((t) => t.targetText === 'کا، کی');
      expect(seqStat).toBeDefined();
      expect(seqStat?.correctCount).toBe(1);
      expect(seqStat?.includedCount).toBe(1);
    });
  });

  describe('6. Dataset Filtering', () => {
    const sampleExamples: TrainingExample[] = [
      {
        id: 'ex-1',
        recordingId: 'r1',
        exerciseId: 'ka',
        targetUnits: ['کا'],
        targetText: 'کا',
        therapistLabel: 'CORRECT',
        therapistRemarks: 'Good velar stop',
        createdAt: '2026-10-01T08:00:00Z',
        datasetVersion: 1,
        includedInTraining: true
      },
      {
        id: 'ex-2',
        recordingId: 'r2',
        exerciseId: 'ki',
        targetUnits: ['کی'],
        targetText: 'کی',
        therapistLabel: 'INCORRECT',
        therapistRemarks: 'Vowel formant distorted',
        createdAt: '2026-10-02T12:00:00Z',
        datasetVersion: 1,
        includedInTraining: true
      },
      {
        id: 'ex-3',
        recordingId: 'r3',
        exerciseId: 'ka-ki',
        targetUnits: ['کا', 'کی'],
        targetText: 'کا، کی',
        therapistLabel: 'UNCERTAIN',
        createdAt: '2026-10-03T15:00:00Z',
        datasetVersion: 1,
        includedInTraining: false,
        excludedReason: 'background noise'
      }
    ];

    it('filters by exercise ID', () => {
      const filtered = filterTrainingExamples(sampleExamples, { exerciseId: 'ka' });
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('ex-1');
    });

    it('filters by target unit', () => {
      // Both ex-2 ('کی') and ex-3 ('کا', 'کی') contain 'کی'
      const filtered = filterTrainingExamples(sampleExamples, { targetUnit: 'کی' });
      expect(filtered.length).toBe(2);
    });

    it('filters by therapist result', () => {
      const correctOnly = filterTrainingExamples(sampleExamples, { therapistResult: 'CORRECT' });
      expect(correctOnly.length).toBe(1);
      expect(correctOnly[0].id).toBe('ex-1');

      const incorrectOnly = filterTrainingExamples(sampleExamples, { therapistResult: 'INCORRECT' });
      expect(incorrectOnly.length).toBe(1);
      expect(incorrectOnly[0].id).toBe('ex-2');
    });

    it('filters by training inclusion status', () => {
      const included = filterTrainingExamples(sampleExamples, { trainingStatus: 'included' });
      expect(included.length).toBe(2);

      const excluded = filterTrainingExamples(sampleExamples, { trainingStatus: 'excluded' });
      expect(excluded.length).toBe(1);
      expect(excluded[0].id).toBe('ex-3');
    });

    it('filters by date range', () => {
      const oct2Only = filterTrainingExamples(sampleExamples, {
        startDate: '2026-10-02',
        endDate: '2026-10-02'
      });
      expect(oct2Only.length).toBe(1);
      expect(oct2Only[0].id).toBe('ex-2');
    });

    it('searches by query text in remarks and targets', () => {
      const searchRemarks = filterTrainingExamples(sampleExamples, { searchQuery: 'velar' });
      expect(searchRemarks.length).toBe(1);
      expect(searchRemarks[0].id).toBe('ex-1');
    });
  });

  describe('7. ML Dataset Export Format', () => {
    it('generates structured ML export with metadata and notes', async () => {
      const example: TrainingExample = {
        id: 'te-exp-1',
        recordingId: 'rec-exp-1',
        exerciseId: 'ka',
        targetUnits: ['کا'],
        targetText: 'کا',
        therapistLabel: 'CORRECT',
        therapistRemarks: 'Verified clinical label',
        createdAt: '2026-10-01T12:00:00Z',
        therapistReviewedAt: '2026-10-01T12:05:00Z',
        datasetVersion: 1,
        includedInTraining: true,
        audioQuality: {
          duration: 1.1,
          mimeType: 'audio/webm',
          sampleRate: 48000,
          channelCount: 1,
          decodingStatus: 'VALID'
        }
      };

      const recording: Recording = {
        id: 'rec-exp-1',
        sessionId: 'sess-1',
        exerciseId: 'ka',
        blob: new Blob(['audio data'], { type: 'audio/webm' }),
        duration: 1.1,
        createdAt: '2026-10-01T12:00:00Z',
        mimeType: 'audio/webm'
      };

      const exportData = await generateMLDatasetExport([example], [recording]);

      expect(exportData.format).toBe('speech-practice-ml-dataset');
      expect(exportData.version).toBe(1);
      expect(exportData.totalExamples).toBe(1);
      expect(exportData.totalIncludedForTraining).toBe(1);
      expect(exportData.targets).toContain('کا');
      expect(exportData.metadata.noteOnAudioPackaging).toBeDefined();

      const item = exportData.examples[0];
      expect(item.id).toBe('te-exp-1');
      expect(item.recordingId).toBe('rec-exp-1');
      expect(item.exerciseId).toBe('ka');
      expect(item.targetText).toBe('کا');
      expect(item.targetUnits).toEqual(['کا']);
      expect(item.therapistLabel).toBe('CORRECT');
      expect(item.duration).toBe(1.1);
      expect(item.mimeType).toBe('audio/webm');
      expect(item.includedInTraining).toBe(true);
    });
  });
});
