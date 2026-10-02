import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  assessPronunciationViaML,
  mapMLToPronunciationResult,
  createOfflineUncertainResponse
} from '../src/services/pronunciationAssessmentService';
import {
  createRecording,
  getRecording,
  updateRecording,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import { Recording, UnitAssessment } from '../src/types';

describe('ML Pronunciation Assessment & Integration (Phase 10)', () => {
  beforeEach(async () => {
    await deleteAllRecordings();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('1. Successful ML Response', () => {
    it('sends audio and correctly parses a high-confidence CORRECT response', async () => {
      const mockSuccessData = {
        exerciseId: 'ex-qaf-ka-01',
        targetText: 'کا',
        result: 'CORRECT',
        confidence: 0.91,
        pronunciationScore: 0.87,
        modelVersion: 'xlsr-v1.0-linear',
        unitResults: [
          {
            unit: 'کا',
            score: 0.87,
            result: 'CORRECT'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSuccessData
      });

      const audioBlob = new Blob(['mock-audio-bytes'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01');

      expect(res.exerciseId).toBe('ex-qaf-ka-01');
      expect(res.targetText).toBe('کا');
      expect(res.result).toBe('CORRECT');
      expect(res.confidence).toBe(0.91);
      expect(res.pronunciationScore).toBe(0.87);
      expect(res.modelVersion).toBe('xlsr-v1.0-linear');
      expect(res.unitResults).toHaveLength(1);
      expect(res.isServiceUnavailable).toBe(false);

      const mapped = mapMLToPronunciationResult(res);
      expect(mapped.result).toBe('CORRECT');
      expect(mapped.similarity).toBe(0.91);
      expect(mapped.assessmentMethod).toBe('ML');
    });

    it('correctly handles NEEDS_PRACTICE result from ML service', async () => {
      const mockNeedsPractice = {
        exerciseId: 'ki',
        targetText: 'کی',
        result: 'NEEDS_PRACTICE',
        confidence: 0.85,
        pronunciationScore: 0.32,
        modelVersion: 'xlsr-v1.0-linear',
        unitResults: [
          {
            unit: 'کی',
            score: 0.32,
            result: 'NEEDS_PRACTICE'
          }
        ]
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockNeedsPractice
      });

      const audioBlob = new Blob(['mock-audio-bytes'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ki');

      expect(res.result).toBe('NEEDS_PRACTICE');
      expect(res.confidence).toBe(0.85);

      const mapped = mapMLToPronunciationResult(res);
      expect(mapped.result).toBe('NEEDS_PRACTICE');
      expect(mapped.assessmentMethod).toBe('ML');
    });
  });

  describe('2. Request Timeout Handling', () => {
    it('aborts on timeout and safely returns UNCERTAIN without crashing', async () => {
      global.fetch = vi.fn().mockImplementation((_url, options) => {
        return new Promise((_, reject) => {
          if (options?.signal) {
            options.signal.addEventListener('abort', () => {
              const abortErr = new Error('The operation was aborted');
              abortErr.name = 'AbortError';
              reject(abortErr);
            });
          }
        });
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01', {
        timeoutMs: 50 // Short timeout for unit test
      });

      expect(res.result).toBe('UNCERTAIN');
      expect(res.isServiceUnavailable).toBe(true);
      expect(res.reason).toBe('Pronunciation model unavailable. Your recording was saved.');
    });
  });

  describe('3. Service Unavailable & Network Failure', () => {
    it('returns UNCERTAIN when connection is refused / network offline', async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.confidence).toBe(0.0);
      expect(res.isServiceUnavailable).toBe(true);
      expect(res.reason).toBe('Pronunciation model unavailable. Your recording was saved.');
    });

    it('returns UNCERTAIN when server responds with HTTP 503', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable'
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.isServiceUnavailable).toBe(true);
      expect(res.reason).toBe('Pronunciation model unavailable. Your recording was saved.');
    });
  });

  describe('4. Invalid Response Handling', () => {
    it('returns UNCERTAIN when service returns malformed or non-JSON response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => null // Non-object payload
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.reason).toContain('Invalid response format');
    });

    it('sanitizes unknown result strings to UNCERTAIN', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          exerciseId: 'ex-qaf-ka-01',
          targetText: 'کا',
          result: 'SOME_UNKNOWN_PREDICTION',
          confidence: 0.8
        })
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01');

      expect(res.result).toBe('UNCERTAIN');
    });
  });

  describe('5. Low Confidence Evaluation', () => {
    it('returns UNCERTAIN when model signals borderline prediction', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          exerciseId: 'ex-qaf-ka-01',
          targetText: 'کا',
          result: 'UNCERTAIN',
          confidence: 0.50,
          pronunciationScore: 0.38,
          modelVersion: 'xlsr-v1.0-linear',
          unitResults: []
        })
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'ex-qaf-ka-01');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.confidence).toBe(0.50);

      const mapped = mapMLToPronunciationResult(res);
      expect(mapped.result).toBe('UNCERTAIN');
    });
  });

  describe('6. Unsupported Exercise Safety', () => {
    it('returns UNCERTAIN when an unsupported exercise ID is passed', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          exerciseId: 'unsupported-999',
          targetText: 'unsupported',
          result: 'UNCERTAIN',
          confidence: 0.0,
          pronunciationScore: 0.0,
          modelVersion: 'xlsr-v1.0-linear',
          unitResults: [],
          reason: "Target exercise 'unsupported-999' is not yet supported for automated ML evaluation."
        })
      });

      const audioBlob = new Blob(['mock-audio'], { type: 'audio/wav' });
      const res = await assessPronunciationViaML(audioBlob, 'unsupported-999');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.reason).toContain('not yet supported');
    });
  });

  describe('7. Persistence of ML Assessment Fields in IndexedDB', () => {
    it('persists assessmentMethod, modelVersion, pronunciationScore, confidence, and unitResults', async () => {
      const unitResult: UnitAssessment = {
        unit: 'کا',
        score: 0.88,
        result: 'CORRECT'
      };

      const testRecording: Recording = {
        id: 'rec-ml-test-001',
        sessionId: 'session-ml-001',
        exerciseId: 'ex-qaf-ka-01',
        blob: new Blob(['audio-data'], { type: 'audio/wav' }),
        duration: 0.82,
        mimeType: 'audio/wav',
        createdAt: new Date().toISOString(),
        attemptNumber: 1,
        autoResult: 'CORRECT',
        similarity: 0.91,
        analysisReason: 'Pronunciation matches the therapist target.',
        // Phase 10 ML fields
        assessmentMethod: 'ML',
        modelVersion: 'xlsr-v1.0-linear',
        pronunciationScore: 0.88,
        confidence: 0.91,
        unitResults: [unitResult]
      };

      await createRecording(testRecording);

      const fetched = await getRecording('rec-ml-test-001');
      expect(fetched).toBeDefined();
      expect(fetched?.assessmentMethod).toBe('ML');
      expect(fetched?.modelVersion).toBe('xlsr-v1.0-linear');
      expect(fetched?.pronunciationScore).toBe(0.88);
      expect(fetched?.confidence).toBe(0.91);
      expect(fetched?.unitResults).toHaveLength(1);
      expect(fetched?.unitResults?.[0].unit).toBe('کا');
      expect(fetched?.unitResults?.[0].score).toBe(0.88);
      expect(fetched?.autoResult).toBe('CORRECT');
    });
  });

  describe('8. Independence of Therapist Review', () => {
    it('does not overwrite therapistResult when ML result is recorded', async () => {
      const initialRecording: Recording = {
        id: 'rec-independence-001',
        sessionId: 'session-indep-001',
        exerciseId: 'ex-qaf-ka-01',
        blob: new Blob(['audio-data'], { type: 'audio/wav' }),
        duration: 0.95,
        mimeType: 'audio/wav',
        createdAt: new Date().toISOString(),
        attemptNumber: 1,
        autoResult: 'CORRECT',
        assessmentMethod: 'ML',
        confidence: 0.93,
        pronunciationScore: 0.89
      };

      await createRecording(initialRecording);

      // Verify initially no therapist result exists
      let stored = await getRecording('rec-independence-001');
      expect(stored?.therapistResult).toBeUndefined();
      expect(stored?.autoResult).toBe('CORRECT');

      // Now a therapist manually reviews the attempt as INCORRECT
      const reviewedRecording: Recording = {
        ...stored!,
        therapistResult: 'INCORRECT',
        therapistRemarks: 'Phoneme substitution detected on velar onset.',
        therapistReviewedAt: new Date().toISOString()
      };

      await updateRecording(reviewedRecording);

      // Verify independence: autoResult is still CORRECT (ML output), therapistResult is INCORRECT
      const reFetched = await getRecording('rec-independence-001');
      expect(reFetched?.autoResult).toBe('CORRECT');
      expect(reFetched?.therapistResult).toBe('INCORRECT');
      expect(reFetched?.therapistRemarks).toBe('Phoneme substitution detected on velar onset.');
      expect(reFetched?.assessmentMethod).toBe('ML');
    });
  });
});
