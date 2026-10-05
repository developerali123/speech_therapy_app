/**
 * Model Agreement and Therapist Feedback Loop Utilities
 *
 * Responsibilities:
 * - Compares ML predictions against ground-truth therapist evaluations.
 * - Computes concordance, disagreement, false positives, false negatives, and uncertain rates.
 * - Tracks metrics per target phoneme ('کا', 'کی', 'کے', 'کو').
 * - Preserves model version segregation to prevent mixing results from different models.
 * - Enforces that therapist confirmed assessments are ALWAYS ground truth.
 */

import { Recording, Exercise, ModelAgreementMetrics, TargetAgreementMetrics, MlVsTherapistComparison } from '../types';

export const STANDARD_TARGETS = ['کا', 'کی', 'کے', 'کو'] as const;
export const DEFAULT_MODEL_VERSION = 'xlsr-v1.0-linear-onnx';

/**
 * Normalizes an exercise ID or target text to its primary Urdu unit.
 */
export function normalizeTargetText(targetOrExerciseId?: string): string {
  if (!targetOrExerciseId) return 'کا';
  const clean = targetOrExerciseId.trim();
  if (clean === 'ex-qaf-ka-01' || clean === 'ka' || clean.includes('کا')) return 'کا';
  if (clean === 'ki' || clean.includes('کی')) return 'کی';
  if (clean === 'ke' || clean.includes('کے')) return 'کے';
  if (clean === 'ko' || clean.includes('کو')) return 'کو';
  return clean;
}

/**
 * Resolves the display target string for a recording.
 */
export function resolveRecordingTarget(recording: Recording, exercise?: Exercise): string {
  if (exercise?.targetText) return exercise.targetText;
  if (recording.unitResults && recording.unitResults.length > 0) {
    return recording.unitResults.map((u) => u.target || u.unit).join('، ');
  }
  return normalizeTargetText(recording.exerciseId);
}

/**
 * Extracts all unique model versions present across recordings.
 */
export function getAvailableModelVersions(recordings: Recording[]): string[] {
  const versions = new Set<string>();
  for (const r of recordings) {
    if (r.modelVersion) {
      versions.add(r.modelVersion);
    }
  }
  if (versions.size === 0) {
    versions.add(DEFAULT_MODEL_VERSION);
  }
  return Array.from(versions).sort();
}

/**
 * Compares ML prediction vs Therapist ground truth for a single recording.
 *
 * Guarantees:
 * - Explicitly reports difference text: "ML agreed with therapist." vs "ML disagreed with therapist."
 * - Flags false positives (ML says CORRECT, Therapist says INCORRECT)
 * - Flags false negatives (ML says INCORRECT/NEEDS_PRACTICE, Therapist says CORRECT)
 * - Identifies uncertain outcomes.
 */
export function getComparisonDetail(
  recording: Recording,
  exercise?: Exercise
): MlVsTherapistComparison {
  const expected = resolveRecordingTarget(recording, exercise);
  const mlResult = recording.autoResult || 'UNCERTAIN';
  const mlConfidence = typeof recording.confidence === 'number'
    ? recording.confidence
    : typeof recording.similarity === 'number'
    ? recording.similarity
    : null;
  const therapistResult = recording.therapistResult || 'UNCERTAIN';
  const modelVersion = recording.modelVersion || DEFAULT_MODEL_VERSION;

  const isMlCorrect = mlResult === 'CORRECT';
  const isMlIncorrect = mlResult === 'INCORRECT' || mlResult === 'NEEDS_PRACTICE';
  const isMlUncertain = mlResult === 'UNCERTAIN';

  const isTherapistCorrect = therapistResult === 'CORRECT';
  const isTherapistIncorrect = therapistResult === 'INCORRECT';
  const isTherapistUncertain = therapistResult === 'UNCERTAIN';

  const isFalsePositive = isMlCorrect && isTherapistIncorrect;
  const isFalseNegative = isMlIncorrect && isTherapistCorrect;
  const isUncertain = isMlUncertain || isTherapistUncertain;

  let isAgreement = false;
  let differenceText = 'ML disagreed with therapist.';

  if (isMlCorrect && isTherapistCorrect) {
    isAgreement = true;
    differenceText = 'ML agreed with therapist.';
  } else if (isMlIncorrect && isTherapistIncorrect) {
    isAgreement = true;
    differenceText = 'ML agreed with therapist.';
  } else if (isMlUncertain && isTherapistUncertain) {
    isAgreement = true;
    differenceText = 'ML agreed with therapist (Both uncertain).';
  } else {
    isAgreement = false;
    differenceText = 'ML disagreed with therapist.';
  }

  return {
    expected,
    mlResult,
    mlConfidence,
    therapistResult,
    isAgreement,
    differenceText,
    isFalsePositive,
    isFalseNegative,
    isUncertain,
    modelVersion
  };
}

/**
 * Calculates overall and per-target agreement metrics for therapist-reviewed recordings.
 *
 * Rules:
 * - Only therapist-reviewed recordings count towards agreement metrics.
 * - Can be filtered by modelVersion to prevent conflating results across model versions.
 * - These are local validation metrics, not generalized clinical claims.
 */
export function calculateModelAgreementMetrics(
  recordings: Recording[],
  modelVersionFilter?: string,
  exercises: Exercise[] = []
): ModelAgreementMetrics {
  const availableModelVersions = getAvailableModelVersions(recordings);

  // 1. Filter to only recordings that have a therapist review
  let reviewed = recordings.filter((r) => !!r.therapistResult);

  // 2. Filter by modelVersion if specified and not 'all'
  if (modelVersionFilter && modelVersionFilter !== 'all') {
    reviewed = reviewed.filter(
      (r) => (r.modelVersion || DEFAULT_MODEL_VERSION) === modelVersionFilter
    );
  }

  const exerciseMap = new Map<string, Exercise>();
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex);
  }

  let totalReviewed = reviewed.length;
  let agreementCount = 0;
  let mlCorrectTherapistCorrect = 0;
  let mlIncorrectTherapistIncorrect = 0;
  let mlFalsePositives = 0;
  let mlFalseNegatives = 0;
  let uncertainCount = 0;

  // Initialize per-target metrics map
  const targetMap: Record<string, TargetAgreementMetrics> = {};
  for (const t of STANDARD_TARGETS) {
    targetMap[t] = {
      target: t,
      totalReviewed: 0,
      agreementCount: 0,
      disagreementCount: 0,
      agreementRate: 0,
      mlCorrectTherapistCorrect: 0,
      mlIncorrectTherapistIncorrect: 0,
      mlFalsePositives: 0,
      mlFalseNegatives: 0,
      uncertainCount: 0,
      uncertainRate: 0
    };
  }

  for (const r of reviewed) {
    const ex = exerciseMap.get(r.exerciseId);
    const comp = getComparisonDetail(r, ex);

    // Track overall metrics
    if (comp.isAgreement) {
      agreementCount++;
      if (comp.mlResult === 'CORRECT' && comp.therapistResult === 'CORRECT') {
        mlCorrectTherapistCorrect++;
      } else if (
        (comp.mlResult === 'INCORRECT' || comp.mlResult === 'NEEDS_PRACTICE') &&
        comp.therapistResult === 'INCORRECT'
      ) {
        mlIncorrectTherapistIncorrect++;
      }
    }

    if (comp.isFalsePositive) {
      mlFalsePositives++;
    }
    if (comp.isFalseNegative) {
      mlFalseNegatives++;
    }
    if (comp.isUncertain) {
      uncertainCount++;
    }

    // Track per-target metrics
    const targetKey = normalizeTargetText(r.exerciseId || ex?.targetText || comp.expected);
    if (!targetMap[targetKey]) {
      targetMap[targetKey] = {
        target: targetKey,
        totalReviewed: 0,
        agreementCount: 0,
        disagreementCount: 0,
        agreementRate: 0,
        mlCorrectTherapistCorrect: 0,
        mlIncorrectTherapistIncorrect: 0,
        mlFalsePositives: 0,
        mlFalseNegatives: 0,
        uncertainCount: 0,
        uncertainRate: 0
      };
    }

    const tStat = targetMap[targetKey];
    tStat.totalReviewed++;

    if (comp.isAgreement) {
      tStat.agreementCount++;
      if (comp.mlResult === 'CORRECT' && comp.therapistResult === 'CORRECT') {
        tStat.mlCorrectTherapistCorrect++;
      } else if (
        (comp.mlResult === 'INCORRECT' || comp.mlResult === 'NEEDS_PRACTICE') &&
        comp.therapistResult === 'INCORRECT'
      ) {
        tStat.mlIncorrectTherapistIncorrect++;
      }
    }

    if (comp.isFalsePositive) {
      tStat.mlFalsePositives++;
    }
    if (comp.isFalseNegative) {
      tStat.mlFalseNegatives++;
    }
    if (comp.isUncertain) {
      tStat.uncertainCount++;
    }
  }

  // Calculate rates for per-target metrics
  for (const tKey of Object.keys(targetMap)) {
    const tStat = targetMap[tKey];
    tStat.disagreementCount = tStat.totalReviewed - tStat.agreementCount;
    tStat.agreementRate =
      tStat.totalReviewed > 0
        ? Math.round((tStat.agreementCount / tStat.totalReviewed) * 100)
        : 0;
    tStat.uncertainRate =
      tStat.totalReviewed > 0
        ? Math.round((tStat.uncertainCount / tStat.totalReviewed) * 100)
        : 0;
  }

  const disagreementCount = totalReviewed - agreementCount;
  const agreementRate =
    totalReviewed > 0 ? Math.round((agreementCount / totalReviewed) * 100) : 0;
  const uncertainRate =
    totalReviewed > 0 ? Math.round((uncertainCount / totalReviewed) * 100) : 0;

  return {
    totalReviewed,
    agreementCount,
    disagreementCount,
    agreementRate,
    mlCorrectTherapistCorrect,
    mlIncorrectTherapistIncorrect,
    mlFalsePositives,
    mlFalseNegatives,
    uncertainCount,
    uncertainRate,
    modelVersion: modelVersionFilter && modelVersionFilter !== 'all' ? modelVersionFilter : undefined,
    availableModelVersions,
    byTarget: targetMap
  };
}
