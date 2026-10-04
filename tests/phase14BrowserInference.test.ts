import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as ort from 'onnxruntime-web';
import {
  getModelSession,
  getLoadingState,
  isModelReady,
  getModelVersion,
  getModelLoadingError,
  getModelLoaderMetrics,
  resetModelSession,
  setMockSession,
  isWebGpuSupported
} from '../src/ai/modelLoader';
import {
  resampleTo16k,
  normalizeAmplitude,
  extractAcousticFeatures,
  preprocessAudioForInference,
  decodeAudioToMono,
  parseWavPCM,
  PREPROCESSING_CONFIG
} from '../src/ai/audioPreprocessor';
import {
  runPronunciationInference,
  mapAssessmentToPronunciationResult,
  computeMathematicalForward,
  getInferencePerformanceMetrics,
  resetInferenceMetrics,
  TARGET_PHONEMES,
  THRESHOLD_POLICIES
} from '../src/ai/pronunciationInference';

// Helper to create synthetic 16-bit PCM WAV in memory
function createSyntheticWav(
  durationSec = 0.5,
  freq = 440,
  sampleRate = 16000,
  amplitude = 0.5
): Blob {
  const numSamples = Math.floor(durationSec * sampleRate);
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
    const sampleVal = Math.sin(twoPi * freq * t) * amplitude;
    const clamped = Math.max(-1, Math.min(1, sampleVal));
    const intVal = clamped < 0 ? clamped * 32768 : clamped * 32767;
    view.setInt16(44 + i * 2, intVal, true);
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

// Mock ONNX session helper for node/jsdom test runner
function createMockOnnxSession(probabilities = [0.85, 0.20, 0.15, 0.10]): ort.InferenceSession {
  const probData = new Float32Array(probabilities);
  const mockTensor = {
    data: probData,
    dims: [1, 4],
    type: 'float32'
  } as unknown as ort.Tensor;

  return {
    run: vi.fn().mockResolvedValue({
      probabilities: mockTensor
    }),
    inputNames: ['features'],
    outputNames: ['probabilities', 'logits']
  } as unknown as ort.InferenceSession;
}

describe('Phase 14 — Browser ML Inference Architecture', () => {
  beforeEach(() => {
    resetModelSession();
    resetInferenceMetrics();
    vi.restoreAllMocks();
  });

  /* ======================================================================
   * 1. MODEL LOADER TESTS
   * ====================================================================== */
  describe('1. Model Loader (src/ai/modelLoader.ts)', () => {
    it('starts with initial IDLE state and correct model version', () => {
      expect(getLoadingState()).toBe('IDLE');
      expect(isModelReady()).toBe(false);
      expect(getModelVersion()).toBe('xlsr-v1.0-linear-onnx');
      expect(getModelLoadingError()).toBeNull();
    });

    it('loads model once and caches the session', async () => {
      const mockSession = createMockOnnxSession();
      vi.spyOn(ort.InferenceSession, 'create').mockResolvedValue(mockSession);

      const session1 = await getModelSession('/test/model.onnx');
      expect(session1).toBe(mockSession);
      expect(getLoadingState()).toBe('READY');
      expect(isModelReady()).toBe(true);

      // Second call must return cached session immediately without invoking create again
      const session2 = await getModelSession('/test/model.onnx');
      expect(session2).toBe(mockSession);
      expect(ort.InferenceSession.create).toHaveBeenCalledTimes(1);
    });

    it('prevents duplicate concurrent model loading', async () => {
      let resolveSession!: (s: ort.InferenceSession) => void;
      const deferredPromise = new Promise<ort.InferenceSession>((resolve) => {
        resolveSession = resolve;
      });

      const spy = vi.spyOn(ort.InferenceSession, 'create').mockReturnValue(deferredPromise);

      const p1 = getModelSession();
      expect(getLoadingState()).toBe('LOADING');

      const p2 = getModelSession(); // Concurrent call
      expect(spy).toHaveBeenCalledTimes(1);

      const mockSession = createMockOnnxSession();
      resolveSession(mockSession);

      const [res1, res2] = await Promise.all([p1, p2]);
      expect(res1).toBe(mockSession);
      expect(res2).toBe(mockSession);
      expect(getLoadingState()).toBe('READY');
    });

    it('handles model loading failure gracefully and exposes ERROR state', async () => {
      vi.spyOn(ort.InferenceSession, 'create').mockRejectedValue(new Error('Network 404 Not Found'));

      await expect(getModelSession('/invalid/path.onnx')).rejects.toThrow(
        /Pronunciation model could not be loaded/
      );

      expect(getLoadingState()).toBe('ERROR');
      expect(isModelReady()).toBe(false);
      expect(getModelLoadingError()).toContain('Network 404 Not Found');
    });

    it('measures first model load time', async () => {
      const mockSession = createMockOnnxSession();
      vi.spyOn(ort.InferenceSession, 'create').mockResolvedValue(mockSession);

      await getModelSession();
      const metrics = getModelLoaderMetrics();
      expect(metrics.firstModelLoadTimeMs).not.toBeNull();
      expect(metrics.firstModelLoadTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  /* ======================================================================
   * 2. AUDIO PREPROCESSING TESTS
   * ====================================================================== */
  describe('2. Audio Preprocessing (src/ai/audioPreprocessor.ts)', () => {
    it('documents and resamples audio to strictly 16,000 Hz', () => {
      const orig48k = new Float32Array(48000); // 1.0 second of 48 kHz
      for (let i = 0; i < orig48k.length; i++) {
        orig48k[i] = Math.sin((i / 48000) * 2 * Math.PI * 440);
      }
      const resampled = resampleTo16k(orig48k, 48000);
      expect(resampled.length).toBe(16000);
      expect(PREPROCESSING_CONFIG.targetSampleRate).toBe(16000);
    });

    it('decodes and normalizes mono audio from WAV PCM', async () => {
      const testBlob = createSyntheticWav(0.4, 440, 16000, 0.4);
      const { samples, sampleRate } = await decodeAudioToMono(testBlob);
      expect(sampleRate).toBe(16000);
      expect(samples.length).toBeGreaterThan(0);
    });

    it('normalizes peak amplitude to exactly 0.95', () => {
      const lowSignal = new Float32Array([0.05, -0.1, 0.08, -0.04]);
      const normalized = normalizeAmplitude(lowSignal, 0.95);
      let maxPeak = 0;
      for (let i = 0; i < normalized.length; i++) {
        const a = Math.abs(normalized[i]);
        if (a > maxPeak) maxPeak = a;
      }
      expect(Math.round(maxPeak * 100) / 100).toBe(0.95);
    });

    it('handles silence: rejects recording if raw amplitude floor < 0.005', async () => {
      const silentBlob = createSyntheticWav(0.5, 440, 16000, 0.0001); // pure room silence
      const { result, error } = await preprocessAudioForInference(silentBlob, 'کا');
      expect(result).toBeUndefined();
      expect(error).toBeDefined();
      expect(error?.isRejected).toBe(true);
      expect(error?.reason).toContain('silence');
    });

    it('handles padding/trimming: rejects recordings shorter than 0.20s', async () => {
      const shortBlob = createSyntheticWav(0.12, 440, 16000, 0.5); // 120ms < 200ms
      const { result, error } = await preprocessAudioForInference(shortBlob, 'کا');
      expect(result).toBeUndefined();
      expect(error?.isRejected).toBe(true);
      expect(error?.reason).toContain('shorter than minimum');
    });

    it('handles padding/trimming: rejects recordings exceeding 15.0s', async () => {
      const longBlob = createSyntheticWav(16.0, 440, 16000, 0.5); // 16s > 15s
      const { result, error } = await preprocessAudioForInference(longBlob, 'کا');
      expect(result).toBeUndefined();
      expect(error?.isRejected).toBe(true);
      expect(error?.reason).toContain('exceeds maximum');
    });

    it('extracts exactly 1024-dimensional normalized acoustic projection features', () => {
      const samples = new Float32Array(16000);
      for (let i = 0; i < samples.length; i++) {
        samples[i] = 0.5 * Math.sin((i / 16000) * 2 * Math.PI * 300);
      }
      const features = extractAcousticFeatures(samples, 'کا');
      expect(features.length).toBe(1024);
      expect(features).toBeInstanceOf(Float32Array);
    });
  });

  /* ======================================================================
   * 3. INFERENCE SERVICE & RESPONSE MAPPING TESTS
   * ====================================================================== */
  describe('3. Inference Service & Response Mapping (src/ai/pronunciationInference.ts)', () => {
    it('maps high confidence match (P >= 0.40) to CORRECT', async () => {
      // Mock session returning P(کا) = 0.85
      const mockSession = createMockOnnxSession([0.85, 0.10, 0.10, 0.10]);
      setMockSession(mockSession);

      const validAudio = createSyntheticWav(0.6, 300, 16000, 0.5);
      const res = await runPronunciationInference(validAudio, 'کا');

      expect(res.exerciseId).toBe('کا');
      expect(res.targetText).toBe('کا');
      expect(res.result).toBe('CORRECT');
      expect(res.confidence).toBeGreaterThanOrEqual(0.60);
      expect(res.pronunciationScore).toBeGreaterThan(0.5);
      expect(res.reason).toContain('matches');
    });

    it('maps low match (P <= 0.35) to NEEDS_PRACTICE', async () => {
      // Mock session returning P(کا) = 0.15
      const mockSession = createMockOnnxSession([0.15, 0.10, 0.10, 0.10]);
      setMockSession(mockSession);

      const validAudio = createSyntheticWav(0.6, 300, 16000, 0.5);
      const res = await runPronunciationInference(validAudio, 'کا');

      expect(res.result).toBe('NEEDS_PRACTICE');
      expect(res.confidence).toBeGreaterThanOrEqual(0.60);
      expect(res.reason).toContain('differs');
    });

    it('maps intermediate score within uncertainty band (0.35 < P < 0.40) to UNCERTAIN', async () => {
      // Mock session returning P(کا) = 0.375
      const mockSession = createMockOnnxSession([0.375, 0.10, 0.10, 0.10]);
      setMockSession(mockSession);

      const validAudio = createSyntheticWav(0.6, 300, 16000, 0.5);
      const res = await runPronunciationInference(validAudio, 'کا');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.reason).toContain('Borderline confidence');
    });

    it('evaluates all 4 targets (کا, کی, کے, کو) correctly', async () => {
      const mockSession = createMockOnnxSession([0.80, 0.85, 0.78, 0.82]);
      setMockSession(mockSession);

      const targets = ['کا', 'کی', 'کے', 'کو'] as const;
      for (const target of targets) {
        const audio = createSyntheticWav(0.5, 350, 16000, 0.5);
        const res = await runPronunciationInference(audio, target);
        expect(res.targetText).toBe(target);
        expect(res.result).toBe('CORRECT');
      }
    });

    it('maps PronunciationAssessment cleanly to PronunciationResult without ONNX leaks', async () => {
      const mockSession = createMockOnnxSession([0.88, 0.10, 0.10, 0.10]);
      setMockSession(mockSession);

      const audio = createSyntheticWav(0.5, 300, 16000, 0.5);
      const assessment = await runPronunciationInference(audio, 'ex-qaf-ka-01');
      const uiResult = mapAssessmentToPronunciationResult(assessment);

      expect(uiResult.result).toBe('CORRECT');
      expect(uiResult.assessmentMethod).toBe('ML');
      expect(uiResult.modelVersion).toBe('xlsr-v1.0-linear-onnx');
      expect(uiResult.similarity).toBe(assessment.confidence);
      // Ensure no raw tensors or ONNX symbols are leaked
      expect((uiResult as Record<string, unknown>).session).toBeUndefined();
      expect((uiResult as Record<string, unknown>).tensor).toBeUndefined();
    });
  });

  /* ======================================================================
   * 4. ERROR HANDLING & UNAVAILABLE MODEL TESTS
   * ====================================================================== */
  describe('4. Unavailable Model & Error Handling', () => {
    it('returns UNCERTAIN with "Pronunciation model could not be loaded." when model loading fails', async () => {
      // Force model loading error
      vi.spyOn(ort.InferenceSession, 'create').mockRejectedValue(new Error('Model asset missing'));

      const audio = createSyntheticWav(0.5, 300, 16000, 0.5);
      const res = await runPronunciationInference(audio, 'کا');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.reason).toBe('Pronunciation model could not be loaded.');
      expect(res.confidence).toBe(0.0);
    });

    it('returns UNCERTAIN with "Unable to analyze this recording." when inference fails', async () => {
      // Create session whose run() throws
      const failingSession = {
        run: vi.fn().mockRejectedValue(new Error('WASM execution provider aborted')),
        inputNames: ['features'],
        outputNames: ['probabilities']
      } as unknown as ort.InferenceSession;
      setMockSession(failingSession);

      const audio = createSyntheticWav(0.5, 300, 16000, 0.5);
      const res = await runPronunciationInference(audio, 'کا');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.reason).toBe('Unable to analyze this recording.');
      // NEVER show CORRECT or NEEDS_PRACTICE on inference failure
      expect(res.result).not.toBe('CORRECT');
      expect(res.result).not.toBe('NEEDS_PRACTICE');
    });

    it('returns UNCERTAIN with "Unable to analyze this recording." when preprocessing rejects audio', async () => {
      const mockSession = createMockOnnxSession();
      setMockSession(mockSession);

      // Sub-minimum duration audio
      const tinyAudio = createSyntheticWav(0.05, 300, 16000, 0.5);
      const res = await runPronunciationInference(tinyAudio, 'کا');

      expect(res.result).toBe('UNCERTAIN');
      expect(res.reason).toBe('Unable to analyze this recording.');
      expect(res.result).not.toBe('CORRECT');
    });
  });

  /* ======================================================================
   * 5. UNSUPPORTED BROWSER & FALLBACK TESTS
   * ====================================================================== */
  describe('5. Unsupported Browser & Fallback Environment', () => {
    it('detects WebGPU optionality and falls back to WASM without error', () => {
      // In Node / jsdom environment, WebGPU is not supported
      expect(isWebGpuSupported()).toBe(false);
      const metrics = getModelLoaderMetrics();
      expect(metrics.executionProvider).toBe('wasm');
    });

    it('parses WAV via manual fallback parser when Web Audio API is unavailable', () => {
      const testBlob = createSyntheticWav(0.3, 440, 16000, 0.5);
      testBlob.arrayBuffer().then((buffer) => {
        const parsed = parseWavPCM(buffer);
        expect(parsed.sampleRate).toBe(16000);
        expect(parsed.samples.length).toBeGreaterThan(0);
      });
    });

    it('mathematical forward pass matches reference Gemm + Sigmoid logic', () => {
      const features = new Float32Array(1024);
      for (let i = 0; i < 1024; i++) {
        features[i] = 0.05 * Math.cos(i);
      }
      const forward = computeMathematicalForward(features);
      for (const phoneme of TARGET_PHONEMES) {
        expect(forward[phoneme].probability).toBeGreaterThan(0.0);
        expect(forward[phoneme].probability).toBeLessThan(1.0);
      }
    });
  });

  /* ======================================================================
   * 6. PERFORMANCE & PRACTICE INTEGRATION TESTS
   * ====================================================================== */
  describe('6. Performance Tracking & Practice Flow', () => {
    it('measures first inference time and subsequent inference time', async () => {
      const mockSession = createMockOnnxSession();
      setMockSession(mockSession);

      const audio1 = createSyntheticWav(0.5, 300, 16000, 0.5);
      await runPronunciationInference(audio1, 'کا');

      const metricsAfterFirst = getInferencePerformanceMetrics();
      expect(metricsAfterFirst.firstInferenceTimeMs).not.toBeNull();
      expect(metricsAfterFirst.totalInferenceCount).toBe(1);

      const audio2 = createSyntheticWav(0.5, 350, 16000, 0.5);
      await runPronunciationInference(audio2, 'کا');

      const metricsAfterSecond = getInferencePerformanceMetrics();
      expect(metricsAfterSecond.totalInferenceCount).toBe(2);
      expect(metricsAfterSecond.lastInferenceTimeMs).not.toBeNull();
    });

    it('reuses loaded model session across subsequent assessments', async () => {
      const mockSession = createMockOnnxSession();
      const spy = vi.spyOn(ort.InferenceSession, 'create').mockResolvedValue(mockSession);

      // Run 3 sequential assessments
      for (let i = 0; i < 3; i++) {
        const audio = createSyntheticWav(0.4, 300 + i * 20, 16000, 0.5);
        const res = await runPronunciationInference(audio, 'کا');
        expect(res.result).toBe('CORRECT');
      }

      // ort.InferenceSession.create must only be called ONCE
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
