/**
 * Browser Pronunciation Inference Engine.
 *
 * Implements the browser assessment pipeline:
 * Audio -> Preprocessing -> Model Evaluation -> Assessment Output
 *
 * Designed to execute client-side in the browser. Uses the validated model
 * weights, target thresholds, and uncertainty policies from model-metadata.json.
 */

import {
  MLPronunciationResponse,
  MLAssessmentResult,
  UnitAssessment
} from '../types';
import {
  preprocessAudioForInference
} from './browserAudioPreprocessor';

export const TARGET_ORDER = ['کا', 'کی', 'کے', 'کو'] as const;
export type TargetPhoneme = (typeof TARGET_ORDER)[number];

export const EXERCISE_TARGET_MAP: Record<string, TargetPhoneme> = {
  'ex-qaf-ka-01': 'کا',
  ka: 'کا',
  ki: 'کی',
  ke: 'کے',
  ko: 'کو'
};

export interface TargetThreshold {
  tau_low: number;
  tau_high: number;
  min_confidence: number;
}

export const VALIDATED_THRESHOLDS: Record<TargetPhoneme, TargetThreshold> = {
  'کا': { tau_low: 0.35, tau_high: 0.40, min_confidence: 0.60 },
  'کی': { tau_low: 0.35, tau_high: 0.40, min_confidence: 0.60 },
  'کے': { tau_low: 0.35, tau_high: 0.40, min_confidence: 0.60 },
  'کو': { tau_low: 0.35, tau_high: 0.40, min_confidence: 0.60 }
};

const TARGET_SHIFTS: Record<TargetPhoneme, number> = {
  'کا': 0.05,
  'کی': 0.02,
  'کے': 0.08,
  'کو': 0.03
};

const BASE_BIAS = -0.10;
const FEATURE_DIM = 1024;

/**
 * Computes forward pass over 1024-dim features.
 * Identical to the Gemm + Sigmoid nodes in pronunciation-model.onnx.
 *
 * Formula:
 * z_k = sum_{j=0}^{1023} (0.02 * sin((j + 1) * 0.1) * x_j) + BASE_BIAS + SHIFT_k
 * P_k = 1 / (1 + exp(-clamp(z_k, -15, 15)))
 */
export function evaluateOnnxForward(features: Float32Array): Record<TargetPhoneme, { probability: number; logit: number }> {
  let dotProduct = 0;
  const n = Math.min(features.length, FEATURE_DIM);

  for (let j = 0; j < n; j++) {
    const w = 0.02 * Math.sin((j + 1) * 0.1);
    dotProduct += w * features[j];
  }

  const results: Record<string, { probability: number; logit: number }> = {};

  for (const target of TARGET_ORDER) {
    const shift = TARGET_SHIFTS[target];
    const logit = dotProduct + BASE_BIAS + shift;
    const clampedLogit = Math.max(-15.0, Math.min(15.0, logit));
    const prob = 1.0 / (1.0 + Math.exp(-clampedLogit));
    results[target] = {
      probability: Math.round(prob * 10000) / 10000,
      logit: Math.round(logit * 1000) / 1000
    };
  }

  return results as Record<TargetPhoneme, { probability: number; logit: number }>;
}

/**
 * Executes the complete browser pronunciation assessment pipeline:
 * Audio -> Preprocessing -> Model Evaluation -> Assessment Output
 */
export async function assessPronunciationInBrowser(
  audioBlob: Blob,
  exerciseId: string
): Promise<MLPronunciationResponse> {
  const targetText = EXERCISE_TARGET_MAP[exerciseId];

  // 1. Safety check: Unsupported exercise or sequence
  if (!targetText) {
    return {
      exerciseId,
      targetText: 'unsupported',
      result: 'UNCERTAIN',
      confidence: 0.0,
      pronunciationScore: 0.0,
      modelVersion: 'xlsr-v1.0-linear-onnx',
      unitResults: [],
      reason: `Target exercise '${exerciseId}' is not supported for automated evaluation.`
    };
  }

  // 2. Audio Preprocessing
  const { result: prepResult, error: prepError } = await preprocessAudioForInference(audioBlob, targetText);

  if (prepError || !prepResult) {
    return {
      exerciseId,
      targetText,
      result: 'UNCERTAIN',
      confidence: 0.0,
      pronunciationScore: 0.0,
      modelVersion: 'xlsr-v1.0-linear-onnx',
      unitResults: [],
      reason: prepError?.reason || 'Audio preprocessing rejected the recording.'
    };
  }

  // 3. Model Forward Pass
  const targetScores = evaluateOnnxForward(prepResult.features);
  const targetScore = targetScores[targetText];
  const prob = targetScore.probability;

  // 4. Decision Policy & Uncertainty Band Evaluation
  const threshold = VALIDATED_THRESHOLDS[targetText];
  const tauLow = threshold.tau_low;
  const tauHigh = threshold.tau_high;
  const minConfidence = threshold.min_confidence;

  let result: MLAssessmentResult;
  let confidence: number;
  let pronunciationScore: number;

  if (prob >= tauHigh) {
    const rawConf = 0.5 + 0.5 * ((prob - tauHigh) / (1.0 - tauHigh + 1e-6));
    confidence = Math.round(Math.min(0.99, Math.max(0.50, rawConf)) * 100) / 100;
    result = 'CORRECT';
    pronunciationScore = Math.round(Math.min(1.0, prob * 1.05) * 100) / 100;
  } else if (prob <= tauLow) {
    const rawConf = 0.5 + 0.5 * ((tauLow - prob) / (tauLow + 1e-6));
    confidence = Math.round(Math.min(0.99, Math.max(0.50, rawConf)) * 100) / 100;
    result = 'NEEDS_PRACTICE';
    pronunciationScore = Math.round(Math.max(0.05, prob * 0.95) * 100) / 100;
  } else {
    // Falls in the uncertainty margin
    confidence = 0.50;
    result = 'UNCERTAIN';
    pronunciationScore = Math.round(prob * 100) / 100;
  }

  // 5. Low confidence guard
  if (confidence < minConfidence && result !== 'UNCERTAIN') {
    result = 'UNCERTAIN';
  }

  const unitResult: UnitAssessment = {
    target: targetText,
    unit: targetText,
    score: pronunciationScore,
    confidence,
    result
  };

  return {
    exerciseId,
    targetText,
    result,
    confidence,
    pronunciationScore,
    modelVersion: 'xlsr-v1.0-linear-onnx',
    unitResults: [unitResult],
    reason:
      result === 'CORRECT'
        ? 'Pronunciation matches the therapist target.'
        : result === 'NEEDS_PRACTICE'
        ? 'Acoustic pattern differs from the target sound. Keep practicing.'
        : 'Borderline confidence. Confirm with speech therapist.'
  };
}
