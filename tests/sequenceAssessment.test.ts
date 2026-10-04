import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ort from 'onnxruntime-web';
import {
  segmentSpeechAudio,
  alignSequenceAndAssess,
  calculateOverallSequenceResult,
  AudioSegment
} from '../src/ai/sequenceSegmentation';
import {
  runPronunciationInference,
  SEQUENCE_EXERCISE_MAP,
  resetInferenceMetrics
} from '../src/ai/pronunciationInference';
import { resetModelSession, setMockSession } from '../src/ai/modelLoader';
import {
  createRecording,
  getRecording,
  updateRecording,
  deleteAllRecordings
} from '../src/storage/recordingRepository';
import {
  calculatePerUnitStatistics,
  calculateSequenceProgressStats
} from '../src/utils/statistics';
import { Recording, Exercise, UnitAssessment } from '../src/types';

// Helper to create synthetic WAV in memory with silence gaps and bursts
function createSyntheticSequenceWav(
  durationsMs: number[],
  silenceGapMs = 150,
  freq = 440,
  sampleRate = 16000
): Blob {
  const totalDurationMs =
    durationsMs.reduce((acc, d) => acc + d, 0) + (durationsMs.length + 1) * silenceGapMs;
  const totalSamples = Math.floor((totalDurationMs / 1000) * sampleRate);
  const buffer = new ArrayBuffer(44 + totalSamples * 2);
  const view = new DataView(buffer);

  function writeAscii(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + totalSamples * 2, true);
  writeAscii(8, 'WAVE');
  writeAscii(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(36, 'data');
  view.setUint32(40, totalSamples * 2, true);

  let currentSample = Math.floor((silenceGapMs / 1000) * sampleRate);
  for (let s = 0; s < durationsMs.length; s++) {
    const burstLen = Math.floor((durationsMs[s] / 1000) * sampleRate);
    for (let i = 0; i < burstLen; i++) {
      const t = i / sampleRate;
      // Synthesize tone burst with envelope
      const env = Math.sin((Math.PI * i) / burstLen);
      const val = Math.sin(2 * Math.PI * freq * t) * 0.7 * env;
      const intVal = val < 0 ? val * 32768 : val * 32767;
      view.setInt16(44 + (currentSample + i) * 2, intVal, true);
    }
    currentSample += burstLen + Math.floor((silenceGapMs / 1000) * sampleRate);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// Mock ONNX session helper for returning target probabilities
function createMockSequenceSession(
  segmentProbabilities: number[][] = [
    [0.9, 0.1, 0.05, 0.05],
    [0.1, 0.88, 0.05, 0.05],
    [0.05, 0.1, 0.85, 0.05],
    [0.05, 0.05, 0.1, 0.87]
  ]
): ort.InferenceSession {
  let callCount = 0;
  return {
    run: vi.fn().mockImplementation(async () => {
      const probs = segmentProbabilities[callCount % segmentProbabilities.length];
      callCount++;
      return {
        probabilities: {
          data: new Float32Array(probs),
          dims: [1, probs.length],
          type: 'float32'
        } as unknown as ort.Tensor
      };
    }),
    inputNames: ['features'],
    outputNames: ['probabilities', 'logits']
  } as unknown as ort.InferenceSession;
}

describe('Sequence Pronunciation Assessment Architecture', () => {
  beforeEach(async () => {
    resetModelSession();
    resetInferenceMetrics();
    await deleteAllRecordings();
    vi.restoreAllMocks();
  });

  /* ======================================================================
   * 1. AUDIO SEGMENTATION & VARIABLE DURATION TESTS
   * ====================================================================== */
  describe('1. Audio Segmentation & Variable Duration', () => {
    it('segments audio into variable-duration units based on acoustic energy rather than equal chunking', () => {
      const sampleRate = 16000;
      // 3 units of variable durations: 350ms, 600ms, 250ms with 150ms pauses
      const burst1 = Math.floor(0.35 * sampleRate);
      const gap = Math.floor(0.15 * sampleRate);
      const burst2 = Math.floor(0.6 * sampleRate);
      const burst3 = Math.floor(0.25 * sampleRate);

      const totalSamples = gap + burst1 + gap + burst2 + gap + burst3 + gap;
      const audio = new Float32Array(totalSamples);

      let offset = gap;
      // Burst 1 (350ms)
      for (let i = 0; i < burst1; i++) {
        audio[offset + i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.6;
      }
      offset += burst1 + gap;

      // Burst 2 (600ms)
      for (let i = 0; i < burst2; i++) {
        audio[offset + i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.6;
      }
      offset += burst2 + gap;

      // Burst 3 (250ms)
      for (let i = 0; i < burst3; i++) {
        audio[offset + i] = Math.sin((2 * Math.PI * 440 * i) / sampleRate) * 0.6;
      }

      const segments = segmentSpeechAudio(audio, sampleRate, 3);
      expect(segments.length).toBe(3);

      // Verify that durations are not equal chunks (equal chunking would be totalDuration / 3)
      const d1 = segments[0].duration;
      const d2 = segments[1].duration;
      const d3 = segments[2].duration;

      expect(d1).toBeGreaterThan(0.25);
      expect(d1).toBeLessThan(0.50);
      expect(d2).toBeGreaterThan(0.5); // Second burst is significantly longer (600ms)
      expect(d3).toBeLessThan(0.40); // Third burst is shorter (250ms)
      expect(d2).toBeGreaterThan(d1);
      expect(d1).toBeGreaterThan(d3);
      expect(d2).toBeGreaterThan(d3);
    });
  });

  /* ======================================================================
   * 2. SEQUENCE INFERENCE (2-UNIT, 3-UNIT, 4-UNIT)
   * ====================================================================== */
  describe('2. Multi-Unit Sequences (2, 3, 4 units)', () => {
    it('assesses 2-unit sequence (کا، کی)', async () => {
      const mockSession = createMockSequenceSession([
        [0.92, 0.08, 0.05, 0.05], // کا
        [0.08, 0.89, 0.05, 0.05]  // کی
      ]);
      setMockSession(mockSession);

      const wav = createSyntheticSequenceWav([300, 320]);
      const result = await runPronunciationInference({
        audioBlob: wav,
        exercise: {
          id: 'ka-ki',
          targetText: 'کا، کی',
          targetUnits: ['کا', 'کی']
        }
      });

      expect(result.result).toBe('CORRECT');
      expect(result.unitResults).toBeDefined();
      expect(result.unitResults!.length).toBe(2);
      expect(result.unitResults![0].target).toBe('کا');
      expect(result.unitResults![0].result).toBe('CORRECT');
      expect(result.unitResults![1].target).toBe('کی');
      expect(result.unitResults![1].result).toBe('CORRECT');
    });

    it('assesses 3-unit sequence (کا، کی، کے)', async () => {
      const mockSession = createMockSequenceSession([
        [0.91, 0.05, 0.05, 0.05], // کا
        [0.06, 0.88, 0.05, 0.05], // کی
        [0.05, 0.05, 0.86, 0.05]  // کے
      ]);
      setMockSession(mockSession);

      const wav = createSyntheticSequenceWav([300, 320, 280]);
      const result = await runPronunciationInference({
        audioBlob: wav,
        exercise: {
          id: 'ka-ki-ke',
          targetText: 'کا، کی، کے',
          targetUnits: ['کا', 'کی', 'کے']
        }
      });

      expect(result.result).toBe('CORRECT');
      expect(result.unitResults!.length).toBe(3);
      expect(result.unitResults!.map((u) => u.target)).toEqual(['کا', 'کی', 'کے']);
      expect(result.unitResults!.every((u) => u.result === 'CORRECT')).toBe(true);
    });

    it('assesses 4-unit sequence (کا، کی، کے، کو) with partial failure', async () => {
      // Third unit (کے) fails: low target probability (0.20)
      const mockSession = createMockSequenceSession([
        [0.92, 0.05, 0.05, 0.05], // کا (Correct)
        [0.05, 0.89, 0.05, 0.05], // کی (Correct)
        [0.05, 0.65, 0.20, 0.05], // کے (Failed - pronounced like کی)
        [0.05, 0.05, 0.05, 0.90]  // کو (Correct)
      ]);
      setMockSession(mockSession);

      const wav = createSyntheticSequenceWav([300, 320, 280, 310]);
      const result = await runPronunciationInference({
        audioBlob: wav,
        exercise: {
          id: 'ka-ki-ke-ko',
          targetText: 'کا، کی، کے، کو',
          targetUnits: ['کا', 'کی', 'کے', 'کو']
        }
      });

      expect(result.result).toBe('NEEDS_PRACTICE');
      expect(result.unitResults!.length).toBe(4);
      expect(result.unitResults![0].result).toBe('CORRECT');
      expect(result.unitResults![1].result).toBe('CORRECT');
      expect(result.unitResults![2].result).toBe('NEEDS_PRACTICE');
      expect(result.unitResults![3].result).toBe('CORRECT');
    });
  });

  /* ======================================================================
   * 3. MISSING UNIT, EXTRA UNIT & UNCERTAINTY HANDLING
   * ====================================================================== */
  describe('3. Dynamic Alignment Edge Cases', () => {
    it('handles missing unit (N < M) by marking omitted targets as NEEDS_PRACTICE', async () => {
      const mockSession = createMockSequenceSession([
        [0.90, 0.05, 0.05, 0.05], // کا
        [0.05, 0.88, 0.05, 0.05]  // کی
        // کے, کو omitted by user
      ]);
      setMockSession(mockSession);

      // Only 2 acoustic bursts recorded when 4 expected
      const wav = createSyntheticSequenceWav([350, 350]);
      const result = await runPronunciationInference({
        audioBlob: wav,
        exercise: {
          id: 'ka-ki-ke-ko',
          targetText: 'کا، کی، کے، کو',
          targetUnits: ['کا', 'کی', 'کے', 'کو']
        }
      });

      expect(result.result).toBe('NEEDS_PRACTICE');
      expect(result.unitResults!.length).toBe(4);
      expect(result.unitResults![0].result).toBe('CORRECT');
      expect(result.unitResults![1].result).toBe('CORRECT');
      expect(result.unitResults![2].result).toBe('NEEDS_PRACTICE');
      expect(result.unitResults![2].score).toBe(0);
      expect(result.unitResults![3].result).toBe('NEEDS_PRACTICE');
      expect(result.unitResults![3].score).toBe(0);
    });

    it('handles extra unit (N > M) with monotonic alignment to best matching segments', async () => {
      // 5 bursts recorded for 3 expected targets (e.g. hesitation/cough before speaking)
      const mockSession = createMockSequenceSession([
        [0.2, 0.2, 0.2, 0.2],     // Noise burst
        [0.92, 0.05, 0.05, 0.05], // کا
        [0.05, 0.88, 0.05, 0.05], // کی
        [0.1, 0.1, 0.1, 0.1],     // Hesitation
        [0.05, 0.05, 0.85, 0.05]  // کے
      ]);
      setMockSession(mockSession);

      const wav = createSyntheticSequenceWav([200, 300, 300, 200, 300]);
      const result = await runPronunciationInference({
        audioBlob: wav,
        exercise: {
          id: 'ka-ki-ke',
          targetText: 'کا، کی، کے',
          targetUnits: ['کا', 'کی', 'کے']
        }
      });

      expect(result.unitResults!.length).toBe(3);
      expect(result.unitResults![0].target).toBe('کا');
      expect(result.unitResults![0].result).toBe('CORRECT');
      expect(result.unitResults![1].target).toBe('کی');
      expect(result.unitResults![1].result).toBe('CORRECT');
      expect(result.unitResults![2].target).toBe('کے');
      expect(result.unitResults![2].result).toBe('CORRECT');
      expect(result.result).toBe('CORRECT');
    });

    it('flags unit as UNCERTAIN when target score is in ambiguity margin', async () => {
      // Second unit is borderline (0.37 target probability)
      const mockSession = createMockSequenceSession([
        [0.91, 0.05, 0.05, 0.05], // کا (Correct)
        [0.05, 0.37, 0.10, 0.05]  // کی (Uncertain: score 0.37 between tau_low 0.35 and tau_high 0.40)
      ]);
      setMockSession(mockSession);

      const wav = createSyntheticSequenceWav([300, 300]);
      const result = await runPronunciationInference({
        audioBlob: wav,
        exercise: {
          id: 'ka-ki',
          targetText: 'کا، کی',
          targetUnits: ['کا', 'کی']
        }
      });

      expect(result.unitResults![1].result).toBe('UNCERTAIN');
      expect(result.result).toBe('UNCERTAIN');
    });
  });

  /* ======================================================================
   * 4. OVERALL RESULT CALCULATION LOGIC
   * ====================================================================== */
  describe('4. Overall Result Calculation', () => {
    it('returns CORRECT only when all units are CORRECT', () => {
      const units: UnitAssessment[] = [
        { target: 'کا', score: 0.9, confidence: 0.9, result: 'CORRECT' },
        { target: 'کی', score: 0.85, confidence: 0.85, result: 'CORRECT' },
        { target: 'کے', score: 0.88, confidence: 0.88, result: 'CORRECT' },
        { target: 'کو', score: 0.92, confidence: 0.92, result: 'CORRECT' }
      ];
      expect(calculateOverallSequenceResult(units)).toBe('CORRECT');
    });

    it('returns NEEDS_PRACTICE if any unit clearly fails, even if others are CORRECT', () => {
      const units: UnitAssessment[] = [
        { target: 'کا', score: 0.9, confidence: 0.9, result: 'CORRECT' },
        { target: 'کی', score: 0.85, confidence: 0.85, result: 'CORRECT' },
        { target: 'کے', score: 0.2, confidence: 0.8, result: 'NEEDS_PRACTICE' },
        { target: 'کو', score: 0.92, confidence: 0.92, result: 'CORRECT' }
      ];
      expect(calculateOverallSequenceResult(units)).toBe('NEEDS_PRACTICE');
    });

    it('returns UNCERTAIN if all units pass or are uncertain, but none clearly fail', () => {
      const units: UnitAssessment[] = [
        { target: 'کا', score: 0.9, confidence: 0.9, result: 'CORRECT' },
        { target: 'کی', score: 0.38, confidence: 0.65, result: 'UNCERTAIN' },
        { target: 'کے', score: 0.88, confidence: 0.88, result: 'CORRECT' },
        { target: 'کو', score: 0.92, confidence: 0.92, result: 'CORRECT' }
      ];
      expect(calculateOverallSequenceResult(units)).toBe('UNCERTAIN');
    });

    it('prioritizes NEEDS_PRACTICE over UNCERTAIN if both exist', () => {
      const units: UnitAssessment[] = [
        { target: 'کا', score: 0.9, confidence: 0.9, result: 'CORRECT' },
        { target: 'کی', score: 0.38, confidence: 0.65, result: 'UNCERTAIN' },
        { target: 'کے', score: 0.15, confidence: 0.85, result: 'NEEDS_PRACTICE' },
        { target: 'کو', score: 0.92, confidence: 0.92, result: 'CORRECT' }
      ];
      expect(calculateOverallSequenceResult(units)).toBe('NEEDS_PRACTICE');
    });
  });

  /* ======================================================================
   * 5. PERSISTENCE & THERAPIST REVIEW
   * ====================================================================== */
  describe('5. Persistence and Therapist Review', () => {
    it('persists sequence recording with unit timing and model version', async () => {
      const unitResults: UnitAssessment[] = [
        { target: 'کا', score: 0.92, confidence: 0.92, result: 'CORRECT', startTime: 0.1, endTime: 0.4 },
        { target: 'کی', score: 0.88, confidence: 0.88, result: 'CORRECT', startTime: 0.55, endTime: 0.85 }
      ];

      const recording: Recording = {
        id: 'rec-seq-001',
        sessionId: 'sess-001',
        exerciseId: 'ka-ki',
        blob: new Blob([''], { type: 'audio/wav' }),
        duration: 1.2,
        mimeType: 'audio/wav',
        createdAt: new Date().toISOString(),
        autoResult: 'CORRECT',
        overallConfidence: 0.9,
        unitResults,
        modelVersion: 'xlsr-v1.0-linear-onnx'
      };

      await createRecording(recording);
      const fetched = await getRecording('rec-seq-001');

      expect(fetched).toBeDefined();
      expect(fetched?.autoResult).toBe('CORRECT');
      expect(fetched?.unitResults?.length).toBe(2);
      expect(fetched?.unitResults?.[0].startTime).toBe(0.1);
      expect(fetched?.unitResults?.[0].endTime).toBe(0.4);
      expect(fetched?.modelVersion).toBe('xlsr-v1.0-linear-onnx');
    });

    it('allows therapist overall and per-unit reviews without overwriting model labels', async () => {
      const unitResults: UnitAssessment[] = [
        { target: 'کا', score: 0.92, confidence: 0.92, result: 'CORRECT' },
        { target: 'کی', score: 0.88, confidence: 0.88, result: 'CORRECT' },
        { target: 'کے', score: 0.22, confidence: 0.80, result: 'NEEDS_PRACTICE' },
        { target: 'کو', score: 0.85, confidence: 0.85, result: 'CORRECT' }
      ];

      const recording: Recording = {
        id: 'rec-seq-002',
        sessionId: 'sess-001',
        exerciseId: 'ka-ki-ke-ko',
        blob: new Blob([''], { type: 'audio/wav' }),
        duration: 2.0,
        mimeType: 'audio/wav',
        createdAt: new Date().toISOString(),
        autoResult: 'NEEDS_PRACTICE',
        unitResults,
        modelVersion: 'xlsr-v1.0-linear-onnx'
      };

      await createRecording(recording);

      // Therapist reviews overall and per-unit
      const reviewed: Recording = {
        ...recording,
        therapistResult: 'INCORRECT',
        therapistNote: 'کے needs further practice',
        therapistUnitReviews: {
          'کا': 'CORRECT',
          'کی': 'CORRECT',
          'کے': 'INCORRECT',
          'کو': 'CORRECT'
        },
        therapistReviewedAt: new Date().toISOString()
      };

      await updateRecording(reviewed);
      const afterReview = await getRecording('rec-seq-002');

      // Check therapist fields
      expect(afterReview?.therapistResult).toBe('INCORRECT');
      expect(afterReview?.therapistNote).toBe('کے needs further practice');
      expect(afterReview?.therapistUnitReviews?.['کے']).toBe('INCORRECT');
      expect(afterReview?.therapistUnitReviews?.['کا']).toBe('CORRECT');

      // Crucial: Model labels MUST NOT be overwritten
      expect(afterReview?.autoResult).toBe('NEEDS_PRACTICE');
      expect(afterReview?.unitResults?.[2].result).toBe('NEEDS_PRACTICE');
    });
  });

  /* ======================================================================
   * 6. PROGRESS AGGREGATION
   * ====================================================================== */
  describe('6. Progress Aggregation for Sequences and Per-Unit Statistics', () => {
    it('aggregates per-unit therapist confirmation without combining unrelated exercises', () => {
      const mockBlob = new Blob([''], { type: 'audio/wav' });
      const now = new Date().toISOString();

      const recordings: Recording[] = [
        // Sequence attempt 1 (Ka, Ki, Ke, Ko)
        {
          id: 'r1',
          sessionId: 's1',
          exerciseId: 'ka-ki-ke-ko',
          blob: mockBlob,
          duration: 2.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'NEEDS_PRACTICE',
          therapistResult: 'INCORRECT',
          unitResults: [
            { target: 'کا', score: 0.9, confidence: 0.9, result: 'CORRECT' },
            { target: 'کی', score: 0.85, confidence: 0.85, result: 'CORRECT' },
            { target: 'کے', score: 0.2, confidence: 0.8, result: 'NEEDS_PRACTICE' },
            { target: 'کو', score: 0.9, confidence: 0.9, result: 'CORRECT' }
          ],
          therapistUnitReviews: {
            'کا': 'CORRECT',
            'کی': 'CORRECT',
            'کے': 'INCORRECT',
            'کو': 'CORRECT'
          }
        },
        // Sequence attempt 2 (Ka, Ki)
        {
          id: 'r2',
          sessionId: 's1',
          exerciseId: 'ka-ki',
          blob: mockBlob,
          duration: 1.2,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT',
          unitResults: [
            { target: 'کا', score: 0.95, confidence: 0.95, result: 'CORRECT' },
            { target: 'کی', score: 0.91, confidence: 0.91, result: 'CORRECT' }
          ],
          therapistUnitReviews: {
            'کا': 'CORRECT',
            'کی': 'CORRECT'
          }
        }
      ];

      const perUnitStats = calculatePerUnitStatistics(recordings, ['کا', 'کی', 'کے', 'کو']);

      const kaStat = perUnitStats.find((s) => s.unit === 'کا');
      const kiStat = perUnitStats.find((s) => s.unit === 'کی');
      const keStat = perUnitStats.find((s) => s.unit === 'کے');
      const koStat = perUnitStats.find((s) => s.unit === 'کو');

      // کا was reviewed twice, both CORRECT -> 100%
      expect(kaStat?.therapistReviewed).toBe(2);
      expect(kaStat?.therapistRate).toBe(100);

      // کی was reviewed twice, both CORRECT -> 100%
      expect(kiStat?.therapistReviewed).toBe(2);
      expect(kiStat?.therapistRate).toBe(100);

      // کے was reviewed once, INCORRECT -> 0%
      expect(keStat?.therapistReviewed).toBe(1);
      expect(keStat?.therapistRate).toBe(0);

      // کو was reviewed once, CORRECT -> 100%
      expect(koStat?.therapistReviewed).toBe(1);
      expect(koStat?.therapistRate).toBe(100);
    });

    it('calculates separate sequence progress rates without combining unrelated sequences', () => {
      const mockBlob = new Blob([''], { type: 'audio/wav' });
      const now = new Date().toISOString();

      const recordings: Recording[] = [
        // 4 attempts for ka-ki (3 correct, 1 incorrect) -> 75%
        {
          id: 'seq-1',
          sessionId: 's1',
          exerciseId: 'ka-ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT'
        },
        {
          id: 'seq-2',
          sessionId: 's1',
          exerciseId: 'ka-ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT'
        },
        {
          id: 'seq-3',
          sessionId: 's1',
          exerciseId: 'ka-ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT'
        },
        {
          id: 'seq-4',
          sessionId: 's1',
          exerciseId: 'ka-ki',
          blob: mockBlob,
          duration: 1.0,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'NEEDS_PRACTICE',
          therapistResult: 'INCORRECT'
        },
        // 3 attempts for ka-ki-ke (2 correct, 1 incorrect)
        {
          id: 'seq-5',
          sessionId: 's1',
          exerciseId: 'ka-ki-ke',
          blob: mockBlob,
          duration: 1.5,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT'
        },
        {
          id: 'seq-6',
          sessionId: 's1',
          exerciseId: 'ka-ki-ke',
          blob: mockBlob,
          duration: 1.5,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'CORRECT',
          therapistResult: 'CORRECT'
        },
        {
          id: 'seq-7',
          sessionId: 's1',
          exerciseId: 'ka-ki-ke',
          blob: mockBlob,
          duration: 1.5,
          mimeType: 'audio/wav',
          createdAt: now,
          autoResult: 'NEEDS_PRACTICE',
          therapistResult: 'INCORRECT'
        }
      ];

      const sequenceStats = calculateSequenceProgressStats(recordings);

      const kaKi = sequenceStats.find((s) => s.exerciseId === 'ka-ki');
      const kaKiKe = sequenceStats.find((s) => s.exerciseId === 'ka-ki-ke');

      expect(kaKi).toBeDefined();
      expect(kaKi?.totalAttempts).toBe(4);
      expect(kaKi?.therapistRate).toBe(75); // 3 / 4 = 75%
      expect(kaKi?.audioRate).toBe(75);

      expect(kaKiKe).toBeDefined();
      expect(kaKiKe?.totalAttempts).toBe(3);
      expect(kaKiKe?.therapistRate).toBe(67); // 2 / 3 = 67%
      expect(kaKiKe?.audioRate).toBe(67);
    });
  });
});
