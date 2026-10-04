import { describe, it, expect } from 'vitest';
import {
  resampleTo16k,
  normalizeAmplitude,
  extractAcousticFeatures,
  preprocessAudioForInference,
  PREPROCESSING_CONFIG
} from '../src/services/browserAudioPreprocessor';
import {
  evaluateOnnxForward,
  assessPronunciationInBrowser,
  TARGET_ORDER,
  VALIDATED_THRESHOLDS
} from '../src/services/browserPronunciationInference';

// Helper to create synthetic 16-bit PCM WAV Blob in memory
function createTestWavBlob(durationSeconds = 0.6, frequency = 440, sampleRate = 16000, amplitude = 0.5): Blob {
  const numSamples = Math.floor(durationSeconds * sampleRate);
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  function writeAscii(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeAscii(0, 'RIFF');
  view.setUint32(4, 36 + numSamples * 2, true);
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
  view.setUint32(40, numSamples * 2, true);

  const twoPi = 2 * Math.PI;
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const sampleVal = Math.sin(twoPi * frequency * t) * amplitude;
    const clamped = Math.max(-1, Math.min(1, sampleVal));
    const intVal = clamped < 0 ? clamped * 32768 : clamped * 32767;
    view.setInt16(44 + i * 2, intVal, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

describe('Browser Audio Preprocessing & ONNX Inference', () => {
  describe('1. Audio Preprocessing Unit Functions', () => {
    it('resamples arbitrary sample rate to exactly 16,000 Hz', () => {
      const orig44k = new Float32Array(44100); // 1.0 second of 44.1 kHz
      for (let i = 0; i < orig44k.length; i++) {
        orig44k[i] = Math.sin((i / 44100) * 2 * Math.PI * 440);
      }
      const resampled = resampleTo16k(orig44k, 44100);
      expect(resampled.length).toBe(16000);
    });

    it('normalizes peak amplitude to exactly 0.95 without clipping', () => {
      const quiet = new Float32Array([0.1, -0.2, 0.05, -0.15]);
      const normalized = normalizeAmplitude(quiet, 0.95);
      let maxVal = 0;
      for (let i = 0; i < normalized.length; i++) {
        const abs = Math.abs(normalized[i]);
        if (abs > maxVal) maxVal = abs;
      }
      expect(Math.round(maxVal * 100) / 100).toBe(0.95);
    });

    it('extracts exactly 1024-dimensional feature vector', () => {
      const samples = new Float32Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.5 * Math.sin((i / 16000) * 2 * Math.PI * 300);
      }
      const features = extractAcousticFeatures(samples, 'کا');
      expect(features.length).toBe(1024);
      expect(features).toBeInstanceOf(Float32Array);
    });
  });

  describe('2. Audio Sanity & Rejection Safeguards', () => {
    it('rejects recordings shorter than 0.20s threshold', async () => {
      const shortBlob = createTestWavBlob(0.10, 440); // 100ms
      const { result, error } = await preprocessAudioForInference(shortBlob, 'کا');
      expect(result).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.isRejected).toBe(true);
      expect(error?.reason).toContain('shorter than minimum');
    });

    it('rejects pure silence or quiet background floor', async () => {
      const silentBlob = createTestWavBlob(0.5, 440, 16000, 0.0001); // Near-zero background floor
      const { result, error } = await preprocessAudioForInference(silentBlob, 'کا');
      expect(result).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.isRejected).toBe(true);
      expect(error?.reason).toContain('silence');
    });
  });

  describe('3. ONNX Forward Graph Computation', () => {
    it('evaluates all 4 targets simultaneously with valid probabilities in [0, 1]', () => {
      const dummyFeatures = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        dummyFeatures[i] = 0.1 * Math.sin(i * 0.05);
      }

      const scores = evaluateOnnxForward(dummyFeatures);
      for (const target of TARGET_ORDER) {
        expect(scores[target]).toBeDefined();
        expect(scores[target].probability).toBeGreaterThanOrEqual(0.0);
        expect(scores[target].probability).toBeLessThanOrEqual(1.0);
        expect(typeof scores[target].logit).toBe('number');
      }
    });

    it('verifies validated target thresholds are calibrated at tau_low=0.35, tau_high=0.40', () => {
      for (const target of TARGET_ORDER) {
        const t = VALIDATED_THRESHOLDS[target];
        expect(t.tau_low).toBe(0.35);
        expect(t.tau_high).toBe(0.40);
        expect(t.min_confidence).toBe(0.60);
      }
    });
  });

  describe('4. Complete Browser Assessment Flow', () => {
    it('evaluates valid speech attempt of "کا" in browser successfully', async () => {
      const speechBlob = createTestWavBlob(0.7, 300, 16000, 0.6);
      const res = await assessPronunciationInBrowser(speechBlob, 'ex-qaf-ka-01');

      expect(res.exerciseId).toBe('ex-qaf-ka-01');
      expect(res.targetText).toBe('کا');
      expect(['CORRECT', 'NEEDS_PRACTICE', 'UNCERTAIN']).toContain(res.result);
      expect(res.confidence).toBeGreaterThanOrEqual(0.0);
      expect(res.confidence).toBeLessThanOrEqual(1.0);
      expect(res.modelVersion).toBe('xlsr-v1.0-linear-onnx');
      expect(res.unitResults).toHaveLength(1);
      expect(res.unitResults[0].unit).toBe('کا');
    });

    it('evaluates other targets "کی", "کے", "کو" properly', async () => {
      const targets = [
        { id: 'ki', text: 'کی' },
        { id: 'ke', text: 'کے' },
        { id: 'ko', text: 'کو' }
      ];

      for (const { id, text } of targets) {
        const blob = createTestWavBlob(0.6, 400, 16000, 0.5);
        const res = await assessPronunciationInBrowser(blob, id);
        expect(res.exerciseId).toBe(id);
        expect(res.targetText).toBe(text);
        expect(['CORRECT', 'NEEDS_PRACTICE', 'UNCERTAIN']).toContain(res.result);
      }
    });

    it('returns UNCERTAIN for unsupported exercise ID without crashing', async () => {
      const speechBlob = createTestWavBlob(0.7, 300);
      const res = await assessPronunciationInBrowser(speechBlob, 'unsupported-exercise-id');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.confidence).toBe(0.0);
      expect(res.reason).toContain('not supported');
    });

    it('returns UNCERTAIN for audio rejected during preprocessing', async () => {
      const shortBlob = createTestWavBlob(0.08, 300); // 80ms
      const res = await assessPronunciationInBrowser(shortBlob, 'ex-qaf-ka-01');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.confidence).toBe(0.0);
      expect(res.reason).toContain('shorter than minimum');
    });
  });
});
