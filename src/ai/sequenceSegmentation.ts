/**
 * Audio Sequence Segmentation & Alignment Engine (Phase 15).
 *
 * Responsibilities:
 * - Determines approximate unit boundaries using speech representation features.
 * - Accommodates variable unit durations (no equal-length chunking).
 * - Monotonic dynamic programming alignment between expected targets and observed speech units.
 * - Handles sequences of arbitrary length:
 *   - 2-unit sequences: ["کا", "کی"]
 *   - 3-unit sequences: ["کا", "کی", "کے"]
 *   - 4-unit sequences: ["کا", "کی", "کے", "کو"]
 *   - Arbitrary future sequences.
 * - Handles variable duration, missing units, extra units, and uncertain units.
 * - Evaluates per-unit assessments and overall sequence assessments according to clinical policy.
 */

import { UnitAssessment } from '../types';
import * as ort from 'onnxruntime-web';
import {
  extractAcousticFeatures,
  resampleTo16k,
  normalizeAmplitude,
  PREPROCESSING_CONFIG
} from './audioPreprocessor';
import {
  computeMathematicalForward,
  TARGET_PHONEMES,
  TargetPhoneme,
  THRESHOLD_POLICIES
} from './pronunciationInference';

export interface SpeechSegment {
  index: number;
  startIndex: number;
  endIndex: number;
  startTime: number; // in seconds
  endTime: number;   // in seconds
  duration: number;  // in seconds
  energy: number;    // peak RMS energy
  samples: Float32Array;
}

export interface SequenceAssessmentResult {
  overallResult: 'CORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN';
  overallConfidence: number;
  overallScore: number;
  goodCount: number;
  totalCount: number;
  unitResults: UnitAssessment[];
  segments: SpeechSegment[];
  reason: string;
}

/**
 * Segments continuous audio into distinct speech units based on short-time energy
 * and inter-syllable closure dips / spectral onsets.
 *
 * Does NOT divide the recording into equal-duration chunks.
 */
export function segmentSpeechAudio(
  samples: Float32Array,
  sampleRate = 16000,
  expectedUnitCount = 1
): SpeechSegment[] {
  if (samples.length === 0) {
    return [];
  }

  const frameLength = 400; // 25ms at 16kHz
  const frameHop = 160;    // 10ms at 16kHz
  const numFrames = Math.max(1, Math.floor((samples.length - frameLength) / frameHop) + 1);

  // 1. Compute frame-level RMS energy contour
  const energies = new Float32Array(numFrames);
  let maxEnergy = 0;

  for (let f = 0; f < numFrames; f++) {
    const startSample = f * frameHop;
    let sumSq = 0;
    for (let i = 0; i < frameLength; i++) {
      const val = samples[startSample + i];
      sumSq += val * val;
    }
    const rms = Math.sqrt(sumSq / frameLength);
    energies[f] = rms;
    if (rms > maxEnergy) maxEnergy = rms;
  }

  // 2. Smooth energy contour (5-frame window) to eliminate jitter while preserving syllable peaks
  const smoothed = new Float32Array(numFrames);
  for (let f = 0; f < numFrames; f++) {
    let sum = 0;
    let count = 0;
    for (let w = -2; w <= 2; w++) {
      const idx = f + w;
      if (idx >= 0 && idx < numFrames) {
        sum += energies[idx];
        count++;
      }
    }
    smoothed[f] = sum / count;
  }

  // 3. Adaptive energy threshold for speech activity detection
  const speechThreshold = Math.max(0.015, maxEnergy * 0.15);

  // 4. Find voiced regions (energy > threshold)
  interface RawRegion {
    startFrame: number;
    endFrame: number;
    peakEnergy: number;
    peakFrame: number;
  }

  const regions: RawRegion[] = [];
  let inSpeech = false;
  let regionStart = 0;
  let currentPeak = 0;
  let currentPeakFrame = 0;

  for (let f = 0; f < numFrames; f++) {
    const isAbove = smoothed[f] >= speechThreshold;
    if (isAbove && !inSpeech) {
      inSpeech = true;
      regionStart = f;
      currentPeak = smoothed[f];
      currentPeakFrame = f;
    } else if (isAbove && inSpeech) {
      if (smoothed[f] > currentPeak) {
        currentPeak = smoothed[f];
        currentPeakFrame = f;
      }
    } else if (!isAbove && inSpeech) {
      // Minimum region length: 8 frames = 80ms
      if (f - regionStart >= 8) {
        regions.push({
          startFrame: regionStart,
          endFrame: f,
          peakEnergy: currentPeak,
          peakFrame: currentPeakFrame
        });
      }
      inSpeech = false;
    }
  }

  if (inSpeech && numFrames - regionStart >= 8) {
    regions.push({
      startFrame: regionStart,
      endFrame: numFrames,
      peakEnergy: currentPeak,
      peakFrame: currentPeakFrame
    });
  }

  // 5. If audio is single continuous block but expectedUnitCount > 1,
  // detect internal syllable dips (inter-syllable closures)
  const candidateBoundaries: { startFrame: number; endFrame: number; peak: number }[] = [];

  for (const reg of regions) {
    const regDurationFrames = reg.endFrame - reg.startFrame;
    const estUnitsInRegion = Math.max(
      1,
      Math.min(
        Math.round(regDurationFrames / 28), // ~280ms average syllable duration
        expectedUnitCount
      )
    );

    if (estUnitsInRegion > 1 && regDurationFrames >= 35) {
      // Find prominent local minima (valleys) inside the region
      const valleys: number[] = [];
      const minDistance = 15; // At least 150ms between peaks/valleys

      for (let f = reg.startFrame + minDistance; f < reg.endFrame - minDistance; f++) {
        if (
          smoothed[f] < smoothed[f - 1] &&
          smoothed[f] < smoothed[f + 1] &&
          smoothed[f] < reg.peakEnergy * 0.65
        ) {
          if (valleys.length === 0 || f - valleys[valleys.length - 1] >= minDistance) {
            valleys.push(f);
          }
        }
      }

      if (valleys.length > 0) {
        let prevStart = reg.startFrame;
        for (const valley of valleys) {
          candidateBoundaries.push({
            startFrame: prevStart,
            endFrame: valley,
            peak: reg.peakEnergy
          });
          prevStart = valley;
        }
        candidateBoundaries.push({
          startFrame: prevStart,
          endFrame: reg.endFrame,
          peak: reg.peakEnergy
        });
        continue;
      }
    }

    candidateBoundaries.push({
      startFrame: reg.startFrame,
      endFrame: reg.endFrame,
      peak: reg.peakEnergy
    });
  }

  // Fallback: If no distinct regions found (e.g. quiet or uniform signal), wrap entire valid length
  if (candidateBoundaries.length === 0) {
    const totalDurationSec = samples.length / sampleRate;
    return [
      {
        index: 0,
        startIndex: 0,
        endIndex: samples.length,
        startTime: 0,
        endTime: Math.round(totalDurationSec * 100) / 100,
        duration: Math.round(totalDurationSec * 100) / 100,
        energy: maxEnergy,
        samples
      }
    ];
  }

  // 6. Convert frame boundaries to exact SpeechSegment slices
  const segments: SpeechSegment[] = [];

  candidateBoundaries.forEach((b, idx) => {
    // Add small 20ms boundary margin for stop closure and vowel release
    const padSamples = Math.floor(0.02 * sampleRate);
    const startSample = Math.max(0, b.startFrame * frameHop - padSamples);
    const endSample = Math.min(samples.length, b.endFrame * frameHop + frameLength + padSamples);
    const segSamples = samples.slice(startSample, endSample);
    const duration = (endSample - startSample) / sampleRate;

    // Discard tiny blips (< 70ms)
    if (duration >= 0.07) {
      segments.push({
        index: idx,
        startIndex: startSample,
        endIndex: endSample,
        startTime: Math.round((startSample / sampleRate) * 100) / 100,
        endTime: Math.round((endSample / sampleRate) * 100) / 100,
        duration: Math.round(duration * 100) / 100,
        energy: Math.round(b.peak * 1000) / 1000,
        samples: segSamples
      });
    }
  });

  return segments;
}

/**
 * Monotonic Dynamic Programming Alignment between expected targets and observed speech segments.
 *
 * Given:
 * - Expected: T1 → T2 → ... → TM
 * - Observed: S1 → S2 → ... → SN
 *
 * Solves:
 * - Variable durations (each segment preserves actual start/end time)
 * - Missing units (N < M, user omitted a target)
 * - Extra units (N > M, user hesitated or uttered extra sounds)
 * - Phoneme scoring & confidence mapping
 */
/**
 * Evaluates overall sequence result based on per-unit assessments.
 *
 * Rules:
 * - If any unit clearly fails (NEEDS_PRACTICE) -> NEEDS_PRACTICE
 * - Else if any unit is UNCERTAIN -> UNCERTAIN
 * - Else (all units CORRECT) -> CORRECT
 * - Never marks sequence CORRECT if a unit fails.
 */
export function calculateOverallSequenceResult(
  unitResults: UnitAssessment[]
): 'CORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN' {
  if (unitResults.length === 0) return 'UNCERTAIN';
  const hasFailed = unitResults.some((u) => u.result === 'NEEDS_PRACTICE');
  const hasUncertain = unitResults.some((u) => u.result === 'UNCERTAIN');
  if (hasFailed) return 'NEEDS_PRACTICE';
  if (hasUncertain) return 'UNCERTAIN';
  return 'CORRECT';
}

/**
 * Performs monotonic dynamic programming alignment between expected target sequence
 * and observed acoustic speech segments.
 *
 * Features:
 * - Dynamic programming log-likelihood alignment.
 * - Handles arbitrary target length M (2, 3, 4, ...).
 * - Handles missing units (N < M -> marks omitted units as NEEDS_PRACTICE).
 * - Handles extra units / hesitations (N > M -> skips noise/hesitations).
 * - Phoneme scoring & confidence mapping.
 */
export async function alignSequenceAndAssess(
  segments: SpeechSegment[],
  expectedTargets: string[],
  session?: ort.InferenceSession | null
): Promise<SequenceAssessmentResult> {
  const M = expectedTargets.length;
  const N = segments.length;

  if (M === 0) {
    return {
      overallResult: 'UNCERTAIN',
      overallConfidence: 0.0,
      overallScore: 0.0,
      goodCount: 0,
      totalCount: 0,
      unitResults: [],
      segments: [],
      reason: 'No target units specified.'
    };
  }

  // 1. Precompute segment scores for all target phonemes
  interface SegmentScores {
    targetProbs: Record<string, number>;
    detectedPhoneme: string;
    features: Float32Array;
  }

  const segmentEvaluations: SegmentScores[] = [];

  for (let sIdx = 0; sIdx < segments.length; sIdx++) {
    const seg = segments[sIdx];
    const normSamples = normalizeAmplitude(
      resampleTo16k(seg.samples, PREPROCESSING_CONFIG.targetSampleRate)
    );
    const features = extractAcousticFeatures(normSamples);

    const targetProbs: Record<string, number> = {};
    let detected = 'کا';

    // Try ONNX session if provided
    if (session) {
      try {
        const tensor = new ort.Tensor('float32', features, [1, PREPROCESSING_CONFIG.featureDim]);
        const feeds: Record<string, ort.Tensor> = {};
        const inputName =
          session.inputNames && session.inputNames.length > 0 ? session.inputNames[0] : 'features';
        feeds[inputName] = tensor;

        const outputs = await session.run(feeds);
        const probTensor = outputs['probabilities'] || (session.outputNames && outputs[session.outputNames[0]]);

        if (probTensor && probTensor.data) {
          const rawProbs = probTensor.data as Float32Array;
          let bestProb = -1;
          for (let pIdx = 0; pIdx < TARGET_PHONEMES.length; pIdx++) {
            const p = TARGET_PHONEMES[pIdx];
            const prob = rawProbs[pIdx] !== undefined ? rawProbs[pIdx] : 0.05;
            targetProbs[p] = prob;
            if (prob > bestProb) {
              bestProb = prob;
              detected = p;
            }
          }
        }
      } catch {
        // Fallback to mathematical forward if session fails
      }
    }

    // Fallback to mathematical forward model if session wasn't used or yielded empty probs
    if (Object.keys(targetProbs).length === 0) {
      const forward = computeMathematicalForward(features);
      let bestProb = -1;
      for (const p of TARGET_PHONEMES) {
        const prob = forward[p]?.probability ?? 0.0;
        targetProbs[p] = prob;
        if (prob > bestProb) {
          bestProb = prob;
          detected = p;
        }
      }
    }

    segmentEvaluations.push({
      targetProbs,
      detectedPhoneme: detected,
      features
    });
  }

  // 2. Monotonic Dynamic Programming Alignment Matrix
  // dp[m][n] = best log-likelihood score matching first m targets with first n segments
  const dp: number[][] = Array.from({ length: M + 1 }, () =>
    new Array(N + 1).fill(-Infinity)
  );

  type ChoiceType = 'NONE' | 'MATCH' | 'SKIP_SEG' | 'SKIP_TARGET';
  const choice: ChoiceType[][] = Array.from({ length: M + 1 }, () =>
    new Array(N + 1).fill('NONE')
  );

  dp[0][0] = 0;

  for (let m = 0; m <= M; m++) {
    for (let n = 0; n <= N; n++) {
      if (dp[m][n] === -Infinity) continue;

      // Option A: Skip segment n as extra / hesitation / noise (when n < N)
      if (n < N) {
        const skipSegScore = dp[m][n] - 0.2; // minimal penalty for skipping noise
        if (skipSegScore > dp[m][n + 1]) {
          dp[m][n + 1] = skipSegScore;
          choice[m][n + 1] = 'SKIP_SEG';
        }
      }

      // Option B: Skip target m as missing / omitted (when m < M)
      if (m < M) {
        const skipTargetScore = dp[m][n] - 6.0; // heavy penalty for missing a required target
        if (skipTargetScore > dp[m + 1][n]) {
          dp[m + 1][n] = skipTargetScore;
          choice[m + 1][n] = 'SKIP_TARGET';
        }
      }

      // Option C: Match target m with segment n (when m < M and n < N)
      if (m < M && n < N) {
        const target = expectedTargets[m];
        const matchProb = segmentEvaluations[n].targetProbs[target] ?? 0.01;
        const matchScore = dp[m][n] + Math.log(matchProb + 1e-4);

        if (matchScore > dp[m + 1][n + 1]) {
          dp[m + 1][n + 1] = matchScore;
          choice[m + 1][n + 1] = 'MATCH';
        }
      }
    }
  }

  // 3. Backtrack alignment path from (M, N)
  const targetToSegmentMap: (number | null)[] = new Array(M).fill(null);
  let curM = M;
  let curN = N;

  while (curM > 0 || curN > 0) {
    const c = choice[curM][curN];
    if (c === 'MATCH') {
      targetToSegmentMap[curM - 1] = curN - 1;
      curM--;
      curN--;
    } else if (c === 'SKIP_TARGET') {
      targetToSegmentMap[curM - 1] = null; // target was omitted
      curM--;
    } else if (c === 'SKIP_SEG') {
      curN--; // segment was extra/noise
    } else {
      // Boundary fallback
      if (curM > 0 && curN > 0) {
        targetToSegmentMap[curM - 1] = curN - 1;
        curM--;
        curN--;
      } else if (curM > 0) {
        targetToSegmentMap[curM - 1] = null;
        curM--;
      } else {
        curN--;
      }
    }
  }

  // 4. Build Per-Unit Assessments
  const unitResults: UnitAssessment[] = [];

  for (let m = 0; m < M; m++) {
    const target = expectedTargets[m];
    const segIdx = targetToSegmentMap[m];
    const policy = THRESHOLD_POLICIES[target as TargetPhoneme] || {
      tau_low: 0.35,
      tau_high: 0.40,
      min_confidence: 0.60
    };

    if (segIdx !== null && segIdx !== undefined && segIdx >= 0 && segIdx < N) {
      const seg = segments[segIdx];
      const evalData = segmentEvaluations[segIdx];
      const prob = evalData.targetProbs[target] ?? 0.0;

      let result: 'CORRECT' | 'NEEDS_PRACTICE' | 'UNCERTAIN';
      let confidence: number;
      let score: number;

      if (prob >= policy.tau_high) {
        const rawConf = 0.5 + 0.5 * ((prob - policy.tau_high) / (1.0 - policy.tau_high + 1e-6));
        confidence = Math.round(Math.min(0.99, Math.max(0.50, rawConf)) * 100) / 100;
        result = confidence >= policy.min_confidence ? 'CORRECT' : 'UNCERTAIN';
        score = Math.round(Math.min(1.0, prob * 1.05) * 100) / 100;
      } else if (prob <= policy.tau_low) {
        const rawConf = 0.5 + 0.5 * ((policy.tau_low - prob) / (policy.tau_low + 1e-6));
        confidence = Math.round(Math.min(0.99, Math.max(0.50, rawConf)) * 100) / 100;
        result = 'NEEDS_PRACTICE';
        score = Math.round(Math.max(0.05, prob * 0.95) * 100) / 100;
      } else {
        confidence = 0.50;
        result = 'UNCERTAIN';
        score = Math.round(prob * 100) / 100;
      }

      unitResults.push({
        target,
        unit: target,
        detected: evalData.detectedPhoneme,
        score,
        confidence,
        result,
        startTime: seg.startTime,
        endTime: seg.endTime
      });
    } else {
      // Missing unit: User omitted or missed this target in sequence
      unitResults.push({
        target,
        unit: target,
        detected: undefined,
        score: 0.0,
        confidence: 0.0,
        result: 'NEEDS_PRACTICE',
        startTime: undefined,
        endTime: undefined
      });
    }
  }

  // 5. Compute Overall Result using clinical policy
  const overallResult = calculateOverallSequenceResult(unitResults);

  const goodCount = unitResults.filter((u) => u.result === 'CORRECT').length;
  const totalCount = M;

  // Average confidence and score across units
  const totalConf = unitResults.reduce((sum, u) => sum + u.confidence, 0);
  const totalScr = unitResults.reduce((sum, u) => sum + u.score, 0);
  const overallConfidence = Math.round((totalConf / M) * 100) / 100;
  const overallScore = Math.round((totalScr / M) * 100) / 100;

  const failedUnits = unitResults
    .filter((u) => u.result === 'NEEDS_PRACTICE')
    .map((u) => `"${u.target}"`);

  let reason = '';
  if (overallResult === 'CORRECT') {
    reason = `All ${totalCount} sequence units pronounced correctly in order.`;
  } else if (overallResult === 'NEEDS_PRACTICE') {
    reason = `${goodCount} / ${totalCount} good. Practice ${failedUnits.join(', ')} again.`;
  } else {
    reason = `${goodCount} / ${totalCount} good. Borderline confidence on sequence units.`;
  }

  return {
    overallResult,
    overallConfidence,
    overallScore,
    goodCount,
    totalCount,
    unitResults,
    segments,
    reason
  };
}
