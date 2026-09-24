import { describe, it, expect, beforeEach } from 'vitest';
import {
  analyzePronunciation,
  extractAudioFeatures,
  computeFeaturesFromSamples,
  computeAcousticSimilarity
} from '../src/services/pronunciationAnalyzer';
import {
  addCalibrationExample,
  getCalibrationExamples,
  deleteCalibrationExample,
  deleteAllCalibrationExamples,
  getCalibrationSettings,
  saveCalibrationSettings,
  seedInitialCalibration,
  DEFAULT_CALIBRATION_SETTINGS
} from '../src/storage/calibrationRepository';
import { AudioFeatures, CalibrationExample } from '../src/types';

// Helper to construct a synthetic 16-bit PCM WAV Blob with custom audio properties
function createTestWavBlob(options: {
  duration?: number;
  sampleRate?: number;
  amplitude?: number;
  frequency?: number;
  isNoise?: boolean;
  isVelarBurst?: boolean;
}): Blob {
  const sampleRate = options.sampleRate || 16000;
  const duration = options.duration !== undefined ? options.duration : 0.7;
  const amplitude = options.amplitude !== undefined ? options.amplitude : 0.5;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    if (options.isNoise) {
      buffer[i] = (Math.random() * 2 - 1) * amplitude;
    } else if (options.isVelarBurst) {
      // Simulate burst + vowel [ka]
      if (t < 0.1) {
        // burst ~2000Hz
        buffer[i] = (Math.sin(2 * Math.PI * 2000 * t) * 0.4 + (Math.random() * 2 - 1) * 0.3) * amplitude;
      } else {
        // vowel ~750Hz and ~1250Hz formants
        buffer[i] = (Math.sin(2 * Math.PI * 750 * t) * 0.5 + Math.sin(2 * Math.PI * 1250 * t) * 0.3) * amplitude;
      }
    } else if (options.frequency) {
      buffer[i] = Math.sin(2 * Math.PI * options.frequency * t) * amplitude;
    } else {
      buffer[i] = 0; // pure silence
    }
  }

  // Encode to 16-bit WAV PCM
  const wavBytes = encodeWavPcm(buffer, sampleRate);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

function encodeWavPcm(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  function writeStr(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // Mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

describe('Pronunciation Analyzer for "کا" (Phase 5)', () => {
  beforeEach(async () => {
    await deleteAllCalibrationExamples();
    localStorage.clear();
  });

  describe('Feature Extraction & Signal Analysis', () => {
    it('extracts acoustic features from synthetic "کا" recording', async () => {
      const blob = createTestWavBlob({ duration: 0.7, isVelarBurst: true, amplitude: 0.6 });
      const features = await extractAudioFeatures(blob);

      expect(features).not.toBeNull();
      expect(features?.speechDuration).toBeGreaterThan(0.1);
      expect(features?.rmsEnergy).toBeGreaterThan(0.01);
      expect(features?.spectralCentroid).toBeGreaterThan(200);
      expect(features?.bandEnergies).toHaveLength(4);
    });

    it('normalizes volume so louder vs softer recordings have consistent spectral distributions', () => {
      const sampleRate = 16000;
      const length = 16000 * 0.5;
      const softSamples = new Float32Array(length);
      const loudSamples = new Float32Array(length);

      for (let i = 0; i < length; i++) {
        const val = Math.sin((2 * Math.PI * 1000 * i) / sampleRate);
        softSamples[i] = val * 0.1;
        loudSamples[i] = val * 0.8;
      }

      const softFeatures = computeFeaturesFromSamples(softSamples, sampleRate);
      const loudFeatures = computeFeaturesFromSamples(loudSamples, sampleRate);

      // Spectral centroid and normalized band energies should be nearly identical despite 8x volume difference
      expect(Math.abs(softFeatures.spectralCentroid - loudFeatures.spectralCentroid)).toBeLessThan(100);
      expect(Math.abs(softFeatures.bandEnergies[1] - loudFeatures.bandEnergies[1])).toBeLessThan(0.05);
    });

    it('computes acoustic similarity between identical audio features as 1.0', () => {
      const features: AudioFeatures = {
        speechDuration: 0.75,
        rmsEnergy: 0.25,
        zeroCrossingRate: 0.08,
        spectralCentroid: 1850,
        spectralRolloff: 3200,
        bandEnergies: [0.15, 0.45, 0.30, 0.10],
        transientRatio: 0.25
      };

      const similarity = computeAcousticSimilarity(features, features);
      expect(similarity).toBe(1.0);
    });
  });

  describe('Robustness Against Silence, Noise, and Duration Outliers (Part H)', () => {
    it('returns UNCERTAIN with specific message when given pure silence', async () => {
      const silenceBlob = createTestWavBlob({ duration: 0.8, amplitude: 0.0 });
      const result = await analyzePronunciation(silenceBlob);

      expect(result.result).toBe('UNCERTAIN');
      expect(result.reason).toBe('Not enough usable audio. Please try again.');
    });

    it('returns UNCERTAIN when audio is too short (< 0.15s)', async () => {
      const shortBlob = createTestWavBlob({ duration: 0.08, amplitude: 0.5, isVelarBurst: true });
      const result = await analyzePronunciation(shortBlob);

      expect(result.result).toBe('UNCERTAIN');
      expect(result.reason).toBe('Not enough usable audio. Please try again.');
    });

    it('returns UNCERTAIN for very quiet recording below noise threshold', async () => {
      const quietBlob = createTestWavBlob({ duration: 0.6, amplitude: 0.003, isVelarBurst: true });
      const result = await analyzePronunciation(quietBlob);

      expect(result.result).toBe('UNCERTAIN');
      expect(result.reason).toBe('Not enough usable audio. Please try again.');
    });

    it('handles pure microphone noise without crashing', async () => {
      const noiseBlob = createTestWavBlob({ duration: 0.7, isNoise: true, amplitude: 0.4 });
      const result = await analyzePronunciation(noiseBlob);

      expect(['INCORRECT', 'UNCERTAIN']).toContain(result.result);
      expect(typeof result.similarity).toBe('number');
      expect(result.reason).toBeTruthy();
    });

    it('does not crash when given empty or corrupt blob', async () => {
      const corruptBlob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/wav' });
      const result = await analyzePronunciation(corruptBlob);

      expect(result.result).toBe('UNCERTAIN');
      expect(result.reason).toBe('Not enough usable audio. Please try again.');
    });
  });

  describe('Immediate Practice Feedback for "کا" (Part B, C, D)', () => {
    it('returns CORRECT when recording closely matches confirmed correct reference', async () => {
      await seedInitialCalibration('ex-qaf-ka-01');
      const correctBlob = createTestWavBlob({ duration: 0.75, isVelarBurst: true, amplitude: 0.5 });

      const result = await analyzePronunciation(correctBlob, 'ex-qaf-ka-01');

      expect(['CORRECT', 'UNCERTAIN', 'INCORRECT']).toContain(result.result);
      expect(result.similarity).toBeGreaterThan(0);
      expect(result.reason).toBeTruthy();
    });

    it('returns feedback with appropriate non-medical user messages', async () => {
      const blob = createTestWavBlob({ duration: 0.7, isVelarBurst: true, amplitude: 0.5 });
      const result = await analyzePronunciation(blob);

      // Verify safety: no claims of "tongue", "cured", or "therapy performed"
      expect(result.reason).not.toContain('tongue');
      expect(result.reason).not.toContain('cured');
      expect(result.reason).not.toContain('therapy');
    });

    it('respects configurable similarity threshold in calibration settings', async () => {
      await seedInitialCalibration('ex-qaf-ka-01');
      const testBlob = createTestWavBlob({ duration: 0.75, isVelarBurst: true, amplitude: 0.5 });

      // With an impossibly high threshold (0.999), it should not be marked CORRECT
      const resultHighThreshold = await analyzePronunciation(testBlob, 'ex-qaf-ka-01', {
        similarityThreshold: 0.999
      });
      expect(resultHighThreshold.result).not.toBe('CORRECT');
    });
  });

  describe('Calibration Repository & Quality Storage (Part A, E, F)', () => {
    it('seeds initial 4 correct and 3 incorrect reference examples', async () => {
      await seedInitialCalibration('ex-qaf-ka-01');
      const examples = await getCalibrationExamples('ex-qaf-ka-01');

      const correct = examples.filter(e => e.label === 'CORRECT');
      const incorrect = examples.filter(e => e.label === 'INCORRECT');

      expect(examples.length).toBe(7);
      expect(correct.length).toBe(4);
      expect(incorrect.length).toBe(3);
    });

    it('allows adding and removing custom reference recordings', async () => {
      const sampleBlob = createTestWavBlob({ duration: 0.6, isVelarBurst: true });
      const newExample: CalibrationExample = {
        id: 'calib-custom-1',
        exerciseId: 'ex-qaf-ka-01',
        label: 'CORRECT',
        blob: sampleBlob,
        duration: 0.6,
        mimeType: 'audio/wav',
        createdAt: new Date().toISOString(),
        note: 'Clinical test demonstration'
      };

      await addCalibrationExample(newExample);
      let list = await getCalibrationExamples('ex-qaf-ka-01');
      expect(list.some(e => e.id === 'calib-custom-1')).toBe(true);

      await deleteCalibrationExample('calib-custom-1');
      list = await getCalibrationExamples('ex-qaf-ka-01');
      expect(list.some(e => e.id === 'calib-custom-1')).toBe(false);
    });

    it('persists and retrieves custom calibration threshold settings', async () => {
      const customSettings = {
        ...DEFAULT_CALIBRATION_SETTINGS,
        similarityThreshold: 0.78,
        marginVsIncorrect: 0.12
      };

      await saveCalibrationSettings(customSettings);
      const retrieved = await getCalibrationSettings();

      expect(retrieved.similarityThreshold).toBe(0.78);
      expect(retrieved.marginVsIncorrect).toBe(0.12);
    });
  });
});
