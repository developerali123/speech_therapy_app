/**
 * ML Pronunciation Assessment Service.
 *
 * Responsibilities:
 * - Sends recorded audio and exercise ID to the FastAPI ML assessment service
 * - Parses and validates structured JSON responses
 * - Handles request timeouts via AbortController
 * - Handles offline / network errors safely
 * - Maps service unavailability, audio decoding failures, and low confidence to UNCERTAIN
 * - NEVER crashes the practice session
 */

import {
  MLPronunciationResponse,
  MLAssessmentResult,
  PronunciationResult,
  PronunciationVerdict
} from '../types';

export const DEFAULT_ML_SERVICE_URL = 'http://127.0.0.1:8000';

export function getMLServiceBaseUrl(): string {
  if (typeof process !== 'undefined' && process.env?.VITE_ML_SERVICE_URL) {
    return process.env.VITE_ML_SERVICE_URL;
  }
  try {
    // Vite import.meta.env
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metaEnv = (import.meta as any).env;
    if (metaEnv && metaEnv.VITE_ML_SERVICE_URL) {
      return metaEnv.VITE_ML_SERVICE_URL;
    }
  } catch {
    // ignore
  }
  return DEFAULT_ML_SERVICE_URL;
}

/**
 * Creates a safe fallback UNCERTAIN response when service is offline or errors.
 */
export function createOfflineUncertainResponse(
  exerciseId: string,
  reason = 'Pronunciation model unavailable. Your recording was saved.'
): MLPronunciationResponse {
  return {
    exerciseId,
    targetText: '',
    result: 'UNCERTAIN',
    confidence: 0.0,
    pronunciationScore: 0.0,
    modelVersion: 'offline-fallback',
    unitResults: [],
    reason,
    isServiceUnavailable: true
  };
}

/**
 * Converts a string to byte characters for WAV header writing.
 */
function writeAscii(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

/**
 * Converts any audio Blob (WebM, Ogg, etc.) to 16-bit 16kHz mono PCM WAV.
 * If AudioContext or Web Audio is unavailable in environment (e.g. Node tests),
 * returns the original Blob safely.
 */
export async function audioBlobToWav(blob: Blob): Promise<Blob> {
  if (!blob) return blob;
  if (blob.type === 'audio/wav' || blob.type === 'audio/wave' || blob.type === 'audio/x-wav') {
    return blob;
  }

  try {
    const AudioCtxClass =
      typeof window !== 'undefined' &&
      (window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);

    if (!AudioCtxClass) {
      return blob;
    }

    const arrayBuffer = await blob.arrayBuffer();
    const ctx = new AudioCtxClass();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0);
    const origSampleRate = audioBuffer.sampleRate;
    await ctx.close().catch(() => {});

    const targetSampleRate = 16000;
    const ratio = origSampleRate / targetSampleRate;
    const newLen = Math.floor(channelData.length / ratio);
    const resampled = new Float32Array(newLen);
    for (let i = 0; i < newLen; i++) {
      const idx = Math.floor(i * ratio);
      resampled[i] = channelData[idx];
    }

    // Build 16-bit PCM WAV
    const buffer = new ArrayBuffer(44 + resampled.length * 2);
    const view = new DataView(buffer);

    writeAscii(view, 0, 'RIFF');
    view.setUint32(4, 36 + resampled.length * 2, true);
    writeAscii(view, 8, 'WAVE');
    writeAscii(view, 12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, targetSampleRate, true);
    view.setUint32(28, targetSampleRate * 2, true);
    view.setUint16(32, 2, true); // Block align
    view.setUint16(34, 16, true); // Bits per sample
    writeAscii(view, 36, 'data');
    view.setUint32(40, resampled.length * 2, true);

    let offset = 44;
    for (let i = 0; i < resampled.length; i++, offset += 2) {
      const s = Math.max(-1, Math.min(1, resampled[i]));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    }

    return new Blob([view], { type: 'audio/wav' });
  } catch {
    return blob;
  }
}

/**
 * Assesses pronunciation by posting audio to the ML FastAPI service.
 * Handles timeouts, network failures, and invalid payloads safely by returning UNCERTAIN.
 */
export async function assessPronunciationViaML(
  audioBlob: Blob,
  exerciseId: string,
  options: {
    serviceUrl?: string;
    timeoutMs?: number;
  } = {}
): Promise<MLPronunciationResponse> {
  const timeoutMs = options.timeoutMs ?? 5000;
  const baseUrl = options.serviceUrl || getMLServiceBaseUrl();
  const endpoint = `${baseUrl}/assess-pronunciation`;

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const wavBlob = await audioBlobToWav(audioBlob);

    const formData = new FormData();
    formData.append('audio', wavBlob, 'recording.wav');
    formData.append('exerciseId', exerciseId);

    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timer);

    if (!response.ok) {
      console.warn(`ML service HTTP ${response.status} from ${endpoint}`);
      return createOfflineUncertainResponse(
        exerciseId,
        'Pronunciation model unavailable. Your recording was saved.'
      );
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    if (!data || typeof data !== 'object') {
      return createOfflineUncertainResponse(
        exerciseId,
        'Invalid response format from pronunciation model.'
      );
    }

    // Validate result
    const rawResult = data.result;
    const validResult: MLAssessmentResult =
      rawResult === 'CORRECT' || rawResult === 'NEEDS_PRACTICE' || rawResult === 'UNCERTAIN'
        ? rawResult
        : 'UNCERTAIN';

    const confidence = typeof data.confidence === 'number' ? data.confidence : 0;
    const pronunciationScore =
      typeof data.pronunciationScore === 'number' ? data.pronunciationScore : 0;

    return {
      exerciseId: data.exerciseId || exerciseId,
      targetText: data.targetText || '',
      result: validResult,
      confidence,
      pronunciationScore,
      modelVersion: data.modelVersion || 'xlsr-v1.0-linear',
      unitResults: Array.isArray(data.unitResults) ? data.unitResults : [],
      reason: data.reason || (
        validResult === 'CORRECT'
          ? 'Pronunciation matches the therapist target.'
          : validResult === 'NEEDS_PRACTICE'
          ? 'Acoustic pattern differs from target sound. Keep practicing.'
          : 'Borderline confidence. Confirm with speech therapist.'
      ),
      isServiceUnavailable: false
    };
  } catch (err: unknown) {
    clearTimeout(timer);
    const isTimeout =
      (err instanceof DOMException && err.name === 'AbortError') ||
      (err instanceof Error && err.name === 'AbortError');

    console.warn(
      `ML assessment failed (${isTimeout ? 'Timeout' : 'Network/Service error'}):`,
      err
    );

    return createOfflineUncertainResponse(
      exerciseId,
      'Pronunciation model unavailable. Your recording was saved.'
    );
  }
}

/**
 * Maps MLPronunciationResponse to the PronunciationResult structure used by the UI.
 */
export function mapMLToPronunciationResult(mlRes: MLPronunciationResponse): PronunciationResult {
  const verdict: PronunciationVerdict =
    mlRes.result === 'CORRECT'
      ? 'CORRECT'
      : mlRes.result === 'NEEDS_PRACTICE'
      ? 'NEEDS_PRACTICE'
      : 'UNCERTAIN';

  return {
    result: verdict,
    similarity: mlRes.confidence,
    reason:
      mlRes.reason ||
      (mlRes.result === 'CORRECT'
        ? 'Pronunciation matches the therapist target.'
        : mlRes.result === 'NEEDS_PRACTICE'
        ? 'Acoustic pattern differs from the target sound. Keep practicing.'
        : 'Pronunciation model unavailable. Your recording was saved.'),
    details: {
      correctSimilarity: mlRes.pronunciationScore,
      incorrectSimilarity: 1.0 - mlRes.pronunciationScore,
      speechDuration: 0,
      speechEnergy: 0,
      zeroCrossingRate: 0,
      spectralCentroid: 0
    },
    assessmentMethod: 'ML',
    modelVersion: mlRes.modelVersion,
    pronunciationScore: mlRes.pronunciationScore,
    confidence: mlRes.confidence,
    unitResults: mlRes.unitResults
  };
}
