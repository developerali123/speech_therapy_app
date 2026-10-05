import { describe, it, expect, beforeEach } from 'vitest';
import {
  calculateModelAgreementMetrics,
  getComparisonDetail,
  getAvailableModelVersions,
  normalizeTargetText,
  DEFAULT_MODEL_VERSION
} from '../src/utils/modelAgreement';
import {
  addRecordingToTrainingDataset,
  excludeRecordingFromTrainingDataset,
  getTrainingExampleByRecordingId,
  deleteAllTrainingExamples
} from '../src/storage/trainingDatasetRepository';
import {
  createRecording,
  getRecording,
  updateRecording,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import { Recording, Exercise } from '../src/types';

describe('Therapist Feedback Loop & Model Agreement Architecture', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    await deleteAllTrainingExamples();
  });

  const mockBlob = new Blob(['mock audio'], { type: 'audio/wav' });
  const now = new Date().toISOString();

  /* ======================================================================
   * 1. ML VS THERAPIST AGREEMENT & DISAGREEMENT
   * ====================================================================== */
  describe('1. ML vs Therapist Comparison Details', () => {
    it('reports agreement when both ML and Therapist evaluate CORRECT', () => {
      const rec: Recording = {
        id: 'rec-agree-1',
        sessionId: 'sess-1',
        exerciseId: 'ka',
        blob: mockBlob,
        duration: 1.0,
        mimeType: 'audio/wav',
        createdAt: now,
        autoResult: 'CORRECT',
        confidence: 0.89,
        therapistResult: 'CORRECT',
        modelVersion: DEFAULT_MODEL_VERSION
      };

      const comp = getComparisonDetail(rec);
      expect(comp.expected).toBe('کا');
      expect(comp.mlResult).toBe('CORRECT');
      expect(comp.mlConfidence).toBe(0.89);
      expect(comp.therapistResult).toBe('CORRECT');
      expect(comp.isAgreement).toBe(true);
      expect(comp.differenceText).toBe('ML agreed with therapist.');
      expect(comp.isFalsePositive).toBe(false);
      expect(comp.isFalseNegative).toBe(false);
    });

    it('reports agreement when both ML and Therapist evaluate INCORRECT (True Negative)', () => {
      const rec: Recording = {
        id: 'rec-agree-2',
        sessionId: 'sess-1',
        exerciseId: 'ki',
        blob: mockBlob,
        duration: 1.1,
        mimeType: 'audio/wav',
        createdAt: now,
        autoResult: 'NEEDS_PRACTICE',
        confidence: 0.75,
        therapistResult: 'INCORRECT',
        modelVersion: DEFAULT_MODEL_VERSION
      };

      const comp = getComparisonDetail(rec);
      expect(comp.isAgreement).toBe(true);
      expect(comp.differenceText).toBe('ML agreed with therapist.');
      expect(comp.isFalsePositive).toBe(false);
      expect(comp.isFalseNegative).toBe(false);
    });

    it('reports disagreement on False Positive (ML says CORRECT, Therapist says INCORRECT)', () => {
      const rec: Recording = {
        id: 'rec-fp-1',
        sessionId: 'sess-1',
        exerciseId: 'ke',
        blob: mockBlob,
        duration: 1.2,
        mimeType: 'audio/wav',
        createdAt: now,
        autoResult: 'CORRECT',
        confidence: 0.87,
        therapistResult: 'INCORRECT',
        modelVersion: DEFAULT_MODEL_VERSION
      };

      const comp = getComparisonDetail(rec);
      expect(comp.isAgreement).toBe(false);
      expect(comp.differenceText).toBe('ML disagreed with therapist.');
      expect(comp.isFalsePositive).toBe(true);
      expect(comp.isFalseNegative).toBe(false);
    });

    it('reports disagreement on False Negative (ML says NEEDS_PRACTICE, Therapist says CORRECT)', () => {
      const rec: Recording = {
        id: 'rec-fn-1',
        sessionId: 'sess-1',
        exerciseId: 'ko',
        blob: mockBlob,
        duration: 0.9,
        mimeType: 'audio/wav',
        createdAt: now,
        autoResult: 'NEEDS_PRACTICE',
        confidence: 0.82,
        therapistResult: 'CORRECT',
        modelVersion: DEFAULT_MODEL_VERSION
      };

      const comp = getComparisonDetail(rec);
      expect(comp.isAgreement).toBe(false);
      expect(comp.differenceText).toBe('ML disagreed with therapist.');
      expect(comp.isFalsePositive).toBe(false);
      expect(comp.isFalseNegative).toBe(true);
    });
  });

  /* ======================================================================
   * 2. AGREEMENT METRICS CALCULATION
   * ====================================================================== */
  describe('2. Agreement Metrics Aggregation', () => {
    it('calculates agreement count, disagreement count, false positives, and false negatives', () => {
      const recordings: Recording[] = [
        // 1. Both Correct (TP)
        {
          id: 'r1',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        // 2. Both Correct (TP)
        {
          id: 'r2',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        // 3. Both Incorrect (TN)
        {
          id: 'r3',
          sessionId: 's1',
          exerciseId: 'ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'INCORRECT',
          therapistResult: 'INCORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        // 4. False Positive (ML=CORRECT, Therapist=INCORRECT)
        {
          id: 'r4',
          sessionId: 's1',
          exerciseId: 'ke',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'INCORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        // 5. False Negative (ML=NEEDS_PRACTICE, Therapist=CORRECT)
        {
          id: 'r5',
          sessionId: 's1',
          exerciseId: 'ko',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'NEEDS_PRACTICE',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        // 6. Unreviewed take (should be excluded from metrics)
        {
          id: 'r6',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
          // therapistResult is undefined
        }
      ];

      const metrics = calculateModelAgreementMetrics(recordings, 'all');

      expect(metrics.totalReviewed).toBe(5);
      expect(metrics.agreementCount).toBe(3); // 2 TP + 1 TN
      expect(metrics.disagreementCount).toBe(2); // 1 FP + 1 FN
      expect(metrics.agreementRate).toBe(60); // 3 / 5 = 60%
      expect(metrics.mlCorrectTherapistCorrect).toBe(2);
      expect(metrics.mlIncorrectTherapistIncorrect).toBe(1);
      expect(metrics.mlFalsePositives).toBe(1);
      expect(metrics.mlFalseNegatives).toBe(1);
    });

    it('handles uncertain evaluations cleanly without division by zero', () => {
      const recordings: Recording[] = [
        {
          id: 'u1',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'UNCERTAIN',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        {
          id: 'u2',
          sessionId: 's1',
          exerciseId: 'ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'UNCERTAIN',
          modelVersion: DEFAULT_MODEL_VERSION
        }
      ];

      const metrics = calculateModelAgreementMetrics(recordings, 'all');
      expect(metrics.totalReviewed).toBe(2);
      expect(metrics.uncertainCount).toBe(2);
      expect(metrics.uncertainRate).toBe(100);
      expect(metrics.agreementCount).toBe(0);

      // Empty dataset check
      const emptyMetrics = calculateModelAgreementMetrics([], 'all');
      expect(emptyMetrics.totalReviewed).toBe(0);
      expect(emptyMetrics.agreementRate).toBe(0);
      expect(emptyMetrics.uncertainRate).toBe(0);
    });
  });

  /* ======================================================================
   * 3. MODEL VERSIONING & ISOLATION
   * ====================================================================== */
  describe('3. Model Versioning', () => {
    it('extracts unique model versions from recorded assessments', () => {
      const recordings: Recording[] = [
        {
          id: 'r1',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          modelVersion: 'xlsr-v1.0-linear-onnx'
        },
        {
          id: 'r2',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          modelVersion: 'xlsr-v2.0-quantized-onnx'
        }
      ];

      const versions = getAvailableModelVersions(recordings);
      expect(versions).toContain('xlsr-v1.0-linear-onnx');
      expect(versions).toContain('xlsr-v2.0-quantized-onnx');
    });

    it('prevents mixing results between different model versions', () => {
      const recordings: Recording[] = [
        // Model v1: 2 reviewed (both agree)
        {
          id: 'v1-1',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: 'xlsr-v1.0-linear-onnx'
        },
        {
          id: 'v1-2',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: 'xlsr-v1.0-linear-onnx'
        },
        // Model v2: 1 reviewed (disagrees)
        {
          id: 'v2-1',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'INCORRECT',
          modelVersion: 'xlsr-v2.0-experimental'
        }
      ];

      // Evaluating Model v1 only
      const v1Metrics = calculateModelAgreementMetrics(recordings, 'xlsr-v1.0-linear-onnx');
      expect(v1Metrics.totalReviewed).toBe(2);
      expect(v1Metrics.agreementCount).toBe(2);
      expect(v1Metrics.agreementRate).toBe(100);
      expect(v1Metrics.disagreementCount).toBe(0);

      // Evaluating Model v2 only
      const v2Metrics = calculateModelAgreementMetrics(recordings, 'xlsr-v2.0-experimental');
      expect(v2Metrics.totalReviewed).toBe(1);
      expect(v2Metrics.agreementCount).toBe(0);
      expect(v2Metrics.agreementRate).toBe(0);
      expect(v2Metrics.disagreementCount).toBe(1);
      expect(v2Metrics.mlFalsePositives).toBe(1);
    });
  });

  /* ======================================================================
   * 4. TRAINING DATASET INCLUSION, EXCLUSION & REASON
   * ====================================================================== */
  describe('4. Training Dataset Candidates & Exclusion Reasons', () => {
    it('adds therapist-reviewed recording to training dataset candidates without automatically retraining', async () => {
      const recording: Recording = {
        id: 'rec-candidate-1',
        sessionId: 'sess-1',
        exerciseId: 'ka',
        blob: mockBlob,
        duration: 1.2,
        mimeType: 'audio/wav',
        createdAt: now,
        autoResult: 'CORRECT',
        therapistResult: 'CORRECT',
        therapistRemarks: 'Ground truth confirmed pronunciation',
        therapistReviewedAt: now,
        modelVersion: DEFAULT_MODEL_VERSION
      };

      await createRecording(recording);

      // User/therapist clicks [Add to Training Dataset]
      const trainingExample = await addRecordingToTrainingDataset(recording);

      expect(trainingExample).toBeDefined();
      expect(trainingExample.includedInTraining).toBe(true);
      expect(trainingExample.excludedReason).toBeUndefined();
      expect(trainingExample.therapistLabel).toBe('CORRECT');

      // Verify persistence in IndexedDB
      const persistedExample = await getTrainingExampleByRecordingId('rec-candidate-1');
      expect(persistedExample?.includedInTraining).toBe(true);
      expect(persistedExample?.therapistLabel).toBe('CORRECT');

      const persistedRec = await getRecording('rec-candidate-1');
      expect(persistedRec?.excludedFromTraining).toBe(false);
    });

    it('allows excluding a recording with an explicit exclusion reason', async () => {
      const recording: Recording = {
        id: 'rec-exclude-1',
        sessionId: 'sess-1',
        exerciseId: 'ki',
        blob: mockBlob,
        duration: 1.5,
        mimeType: 'audio/wav',
        createdAt: now,
        therapistResult: 'CORRECT',
        modelVersion: DEFAULT_MODEL_VERSION
      };

      await createRecording(recording);

      // Exclude due to background noise
      const excludedExample = await excludeRecordingFromTrainingDataset(
        recording,
        'background noise'
      );

      expect(excludedExample.includedInTraining).toBe(false);
      expect(excludedExample.excludedReason).toBe('background noise');

      const persistedRec = await getRecording('rec-exclude-1');
      expect(persistedRec?.excludedFromTraining).toBe(true);
      expect(persistedRec?.trainingExclusionReason).toBe('background noise');
    });
  });

  /* ======================================================================
   * 5. PER-TARGET METRICS (کا, کی, کے, کو)
   * ====================================================================== */
  describe('5. Per-Target Metrics Breakdown', () => {
    it('accurately computes concordance metrics independently for each target sound', () => {
      const recordings: Recording[] = [
        // Target: کا (3 reviewed: 3 agree -> 100%)
        {
          id: 'ka-1',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        {
          id: 'ka-2',
          sessionId: 's1',
          exerciseId: 'ka',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        {
          id: 'ka-3',
          sessionId: 's1',
          exerciseId: 'ex-qaf-ka-01',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'INCORRECT',
          therapistResult: 'INCORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },

        // Target: کی (2 reviewed: 1 agree, 1 False Positive -> 50%)
        {
          id: 'ki-1',
          sessionId: 's1',
          exerciseId: 'ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },
        {
          id: 'ki-2',
          sessionId: 's1',
          exerciseId: 'ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'INCORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },

        // Target: کے (1 reviewed: 1 False Negative -> 0%)
        {
          id: 'ke-1',
          sessionId: 's1',
          exerciseId: 'ke',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'NEEDS_PRACTICE',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        },

        // Target: کو (1 reviewed: 1 agree -> 100%)
        {
          id: 'ko-1',
          sessionId: 's1',
          exerciseId: 'ko',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          modelVersion: DEFAULT_MODEL_VERSION
        }
      ];

      const metrics = calculateModelAgreementMetrics(recordings, 'all');

      const kaStats = metrics.byTarget['کا'];
      const kiStats = metrics.byTarget['کی'];
      const keStats = metrics.byTarget['کے'];
      const koStats = metrics.byTarget['کو'];

      // کا: 3 reviewed, 3 agreed -> 100%
      expect(kaStats.totalReviewed).toBe(3);
      expect(kaStats.agreementCount).toBe(3);
      expect(kaStats.agreementRate).toBe(100);
      expect(kaStats.disagreementCount).toBe(0);

      // کی: 2 reviewed, 1 agreed, 1 FP -> 50%
      expect(kiStats.totalReviewed).toBe(2);
      expect(kiStats.agreementCount).toBe(1);
      expect(kiStats.agreementRate).toBe(50);
      expect(kiStats.disagreementCount).toBe(1);
      expect(kiStats.mlFalsePositives).toBe(1);

      // کے: 1 reviewed, 0 agreed, 1 FN -> 0%
      expect(keStats.totalReviewed).toBe(1);
      expect(keStats.agreementCount).toBe(0);
      expect(keStats.agreementRate).toBe(0);
      expect(keStats.disagreementCount).toBe(1);
      expect(keStats.mlFalseNegatives).toBe(1);

      // کو: 1 reviewed, 1 agreed -> 100%
      expect(koStats.totalReviewed).toBe(1);
      expect(koStats.agreementCount).toBe(1);
      expect(koStats.agreementRate).toBe(100);
    });
  });

  /* ======================================================================
   * 6. GROUND TRUTH INVIOLABILITY RULE
   * ====================================================================== */
  describe('6. Ground Truth Inviolability', () => {
    it('never allows ML prediction to overwrite or substitute for a therapist label', async () => {
      const recording: Recording = {
        id: 'rec-inviolable-1',
        sessionId: 'sess-1',
        exerciseId: 'ka',
        blob: mockBlob,
        duration: 1.0,
        mimeType: 'audio/wav',
        createdAt: now,
        autoResult: 'CORRECT', // ML prediction
        confidence: 0.95,
        therapistResult: 'INCORRECT', // Therapist clinical ground truth
        therapistRemarks: 'Improper closure at soft palate'
      };

      await createRecording(recording);
      const fetched = await getRecording('rec-inviolable-1');

      // The therapist's evaluation remains ground truth
      expect(fetched?.therapistResult).toBe('INCORRECT');
      expect(fetched?.autoResult).toBe('CORRECT');

      // Syncing to training dataset uses therapistLabel as ground truth, NOT autoResult
      const trainingEx = await addRecordingToTrainingDataset(recording);
      expect(trainingEx.therapistLabel).toBe('INCORRECT');
      expect(trainingEx.therapistLabel).not.toBe(recording.autoResult);
    });
  });
});
