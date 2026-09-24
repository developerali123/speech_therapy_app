import { CalibrationExample, CalibrationSettings } from '../types';
import { getStore, STORES } from './indexedDb';

export const DEFAULT_CALIBRATION_SETTINGS: CalibrationSettings = {
  similarityThreshold: 0.65, // 65% similarity requirement
  marginVsIncorrect: 0.08,    // Must exceed incorrect similarity by at least 8%
  minSpeechEnergy: 0.012,     // Below this RMS, flagged as insufficient audio / silence
  minSpeechDuration: 0.15,    // In seconds
  maxSpeechDuration: 2.5      // In seconds
};

const CALIBRATION_SETTINGS_KEY = 'speech_calibration_settings';

export async function addCalibrationExample(example: CalibrationExample): Promise<void> {
  const { store } = await getStore(STORES.CALIBRATION, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(example);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCalibrationExamples(exerciseId: string): Promise<CalibrationExample[]> {
  const { store } = await getStore(STORES.CALIBRATION, 'readonly');
  return new Promise((resolve, reject) => {
    const index = store.index('exerciseId');
    const request = index.getAll(exerciseId);
    request.onsuccess = () => {
      const list = (request.result as CalibrationExample[]) || [];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getAllCalibrationExamples(): Promise<CalibrationExample[]> {
  const { store } = await getStore(STORES.CALIBRATION, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result as CalibrationExample[]) || [];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteCalibrationExample(id: string): Promise<void> {
  const { store } = await getStore(STORES.CALIBRATION, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAllCalibrationExamples(): Promise<void> {
  const { store } = await getStore(STORES.CALIBRATION, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getCalibrationSettings(): Promise<CalibrationSettings> {
  try {
    const raw = localStorage.getItem(CALIBRATION_SETTINGS_KEY);
    if (raw) {
      return { ...DEFAULT_CALIBRATION_SETTINGS, ...JSON.parse(raw) };
    }
  } catch {
    // fallback
  }
  return DEFAULT_CALIBRATION_SETTINGS;
}

export async function saveCalibrationSettings(settings: CalibrationSettings): Promise<void> {
  try {
    localStorage.setItem(CALIBRATION_SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    console.warn('Failed to persist calibration settings:', err);
  }
}

/**
 * Creates synthetic reference audio waveform for baseline initialization
 * /k/ burst (transient noise + velar resonance) followed by /a:/ vowel (periodic glottal pulse with formants)
 */
function createSyntheticKaAudio(isCorrect: boolean): Blob {
  const sampleRate = 16000;
  const duration = isCorrect ? 0.75 : 0.65;
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = new Float32Array(numSamples);

  // Consonant onset: ~0.10s
  const burstEnd = Math.floor(sampleRate * 0.12);
  for (let i = 0; i < burstEnd; i++) {
    // Velar burst noise centered around 1800-2400 Hz for /k/
    const noise = (Math.random() * 2 - 1) * 0.4;
    const freq = isCorrect ? 2000 : (Math.random() > 0.5 ? 800 : 3800); // Incorrect might substitute dental /t/ or glottal /ʔ/
    const resonance = Math.sin((2 * Math.PI * freq * i) / sampleRate) * 0.5;
    const env = 1 - i / burstEnd;
    buffer[i] = (noise + resonance) * env * 0.8;
  }

  // Vowel segment /a:/: F1 ~ 750 Hz, F2 ~ 1250 Hz
  const f0 = 130; // pitch
  for (let i = burstEnd; i < numSamples; i++) {
    const t = (i - burstEnd) / sampleRate;
    const f1 = isCorrect ? 750 : (isCorrect ? 750 : 400); // /i/ or /u/ substitution if incorrect
    const f2 = isCorrect ? 1250 : 2200;
    const glottal = Math.sin(2 * Math.PI * f0 * t) * 0.4;
    const formants = (Math.sin(2 * Math.PI * f1 * t) * 0.35 + Math.sin(2 * Math.PI * f2 * t) * 0.25);
    const env = Math.sin((Math.PI * (i - burstEnd)) / (numSamples - burstEnd));
    buffer[i] = (glottal + formants) * env * 0.7;
  }

  // Convert Float32Array to WAV PCM
  const wavBytes = encodeWavPcm(buffer, sampleRate);
  return new Blob([wavBytes.buffer as ArrayBuffer], { type: 'audio/wav' });
}

function encodeWavPcm(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, 'WAVE');
  // format chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // 16 for PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  // data chunk
  writeString(view, 36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Seeds initial therapist-verified reference examples for "کا"
 * (4 Correct reference examples, 3 Incorrect reference examples)
 */
export async function seedInitialCalibration(exerciseId = 'ex-qaf-ka-01'): Promise<void> {
  const existing = await getCalibrationExamples(exerciseId);
  if (existing.length > 0) return;

  const correctDescriptions = [
    'Clear velar stop with open back vowel [kaː] — Therapist Master Take',
    'Natural conversational articulation with accurate velar closure',
    'Sustained practice example with balanced vocal resonance',
    'Gentle attack with clean velar release burst'
  ];

  for (let i = 0; i < 4; i++) {
    const blob = createSyntheticKaAudio(true);
    await addCalibrationExample({
      id: `calib-correct-${Date.now()}-${i + 1}`,
      exerciseId,
      label: 'CORRECT',
      blob,
      duration: 0.75,
      mimeType: 'audio/wav',
      createdAt: new Date(Date.now() - (4 - i) * 60000).toISOString(),
      note: correctDescriptions[i],
      features: {
        speechDuration: 0.75,
        rmsEnergy: 0.28,
        zeroCrossingRate: 0.085,
        spectralCentroid: 1850 + (i * 20),
        spectralRolloff: 3200 + (i * 30),
        bandEnergies: [0.15, 0.45, 0.30, 0.10],
        transientRatio: 0.28
      }
    });
  }

  const incorrectDescriptions = [
    'Substituted with anterior dental [taː] — tongue tip instead of back body',
    'Substituted with glottal stop [ʔaː] — lack of velar occlusion',
    'Distorted vowel closure with insufficient velopharyngeal seal'
  ];

  for (let i = 0; i < 3; i++) {
    const blob = createSyntheticKaAudio(false);
    await addCalibrationExample({
      id: `calib-incorrect-${Date.now()}-${i + 1}`,
      exerciseId,
      label: 'INCORRECT',
      blob,
      duration: 0.65,
      mimeType: 'audio/wav',
      createdAt: new Date(Date.now() - (7 - i) * 60000).toISOString(),
      note: incorrectDescriptions[i],
      features: {
        speechDuration: 0.65,
        rmsEnergy: 0.22,
        zeroCrossingRate: 0.24,
        spectralCentroid: 3600 + (i * 50),
        spectralRolloff: 4800,
        bandEnergies: [0.08, 0.20, 0.25, 0.47],
        transientRatio: 0.14
      }
    });
  }
}
