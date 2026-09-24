import {
  PronunciationResult,
  AudioFeatures,
  CalibrationSettings
} from '../types';
import {
  getCalibrationExamples,
  getCalibrationSettings,
  seedInitialCalibration
} from '../storage/calibrationRepository';

/**
 * Safely extracts an ArrayBuffer from any Blob, Response, Buffer, or IndexedDB clone.
 */
export async function getArrayBufferFromBlob(blob: unknown): Promise<ArrayBuffer | null> {
  if (!blob) return null;
  if (blob instanceof ArrayBuffer) return blob;
  if (ArrayBuffer.isView(blob)) {
    const u8 = new Uint8Array(blob.buffer, blob.byteOffset, blob.byteLength);
    const ab = new ArrayBuffer(u8.byteLength);
    new Uint8Array(ab).set(u8);
    return ab;
  }
  const b = blob as { arrayBuffer?: () => Promise<ArrayBuffer> };
  if (typeof b.arrayBuffer === 'function') {
    try {
      return await b.arrayBuffer();
    } catch {
      // continue
    }
  }
  if (typeof Response !== 'undefined') {
    try {
      const resp = new Response(blob as BodyInit);
      return await resp.arrayBuffer();
    } catch {
      // continue
    }
  }
  if (typeof FileReader !== 'undefined' && blob instanceof Blob) {
    try {
      return await new Promise<ArrayBuffer | null>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(blob);
      });
    } catch {
      // continue
    }
  }
  return null;
}

/**
 * Extract audio features from an audio Blob using the Web Audio API or PCM fallback.
 */
export async function extractAudioFeatures(blob: Blob): Promise<AudioFeatures | null> {
  const arrayBuffer = await getArrayBufferFromBlob(blob);
  if (!arrayBuffer || arrayBuffer.byteLength === 0) {
    return null;
  }

  let channelData: Float32Array | null = null;
  let sampleRate = 16000;

  // 1. Try decoding with browser AudioContext
  if (typeof window !== 'undefined' && (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)) {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtxClass();
      const decoded = await ctx.decodeAudioData(arrayBuffer.slice(0));
      channelData = decoded.getChannelData(0);
      sampleRate = decoded.sampleRate;
      await ctx.close().catch(() => {});
    } catch {
      // AudioContext decoding might fail on unsupported formats or test mocks; fallback to direct parser
      channelData = null;
    }
  }

  // 2. Fallback: Parse 16-bit WAV PCM directly if channelData is not available
  if (!channelData) {
    channelData = parseWavOrRawPcm(arrayBuffer);
    if (!channelData) {
      // Synthetic fallback from byte energy if decoding cannot parse
      channelData = approximatePcmFromBytes(new Uint8Array(arrayBuffer));
    }
  }

  if (!channelData || channelData.length === 0) {
    return null;
  }

  return computeFeaturesFromSamples(channelData, sampleRate);
}

/**
 * Computes acoustic features from raw audio samples (normalized, volume-independent).
 */
export function computeFeaturesFromSamples(samples: Float32Array, sampleRate = 16000): AudioFeatures {
  const totalLength = samples.length;
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms frame
  const hopSize = Math.floor(sampleRate * 0.010);   // 10ms hop
  const numFrames = Math.max(1, Math.floor((totalLength - frameSize) / hopSize));

  let totalRms = 0;
  let peakRms = 0;
  const frameEnergies = new Float32Array(numFrames);
  const frameZcr = new Float32Array(numFrames);

  // Compute frame-level energy & zero-crossing rate
  for (let i = 0; i < numFrames; i++) {
    const start = i * hopSize;
    let sumSq = 0;
    let zc = 0;

    for (let j = 0; j < frameSize; j++) {
      const sample = samples[start + j] || 0;
      sumSq += sample * sample;
      if (j > 0) {
        const prev = samples[start + j - 1] || 0;
        if ((sample >= 0 && prev < 0) || (sample < 0 && prev >= 0)) {
          zc++;
        }
      }
    }

    const rms = Math.sqrt(sumSq / frameSize);
    frameEnergies[i] = rms;
    frameZcr[i] = zc / frameSize;
    totalRms += rms;
    if (rms > peakRms) peakRms = rms;
  }

  const averageRms = totalRms / numFrames;

  // Active speech detection (dynamic noise threshold)
  const speechThreshold = Math.max(0.010, peakRms * 0.20);
  let speechStartFrame = -1;
  let speechEndFrame = -1;
  let speechFrameCount = 0;

  for (let i = 0; i < numFrames; i++) {
    if (frameEnergies[i] >= speechThreshold) {
      if (speechStartFrame === -1) speechStartFrame = i;
      speechEndFrame = i;
      speechFrameCount++;
    }
  }

  const speechDuration = speechStartFrame !== -1
    ? ((speechEndFrame - speechStartFrame + 1) * hopSize) / sampleRate
    : (speechFrameCount * hopSize) / sampleRate;

  // Average zero-crossing rate over active speech
  let zcrSum = 0;
  const zcrCount = speechStartFrame !== -1 ? (speechEndFrame - speechStartFrame + 1) : numFrames;
  const startIdx = speechStartFrame !== -1 ? speechStartFrame : 0;
  const endIdx = speechStartFrame !== -1 ? speechEndFrame : numFrames - 1;

  for (let i = startIdx; i <= endIdx; i++) {
    zcrSum += frameZcr[i] || 0;
  }
  const meanZcr = zcrCount > 0 ? zcrSum / zcrCount : 0;

  // Frequency-domain spectral analysis across speech segment
  const spectralCentroids: number[] = [];
  const bandEnergiesTotal: [number, number, number, number] = [0, 0, 0, 0];
  let rolloffSum = 0;

  const fftSize = 512;
  const step = Math.max(1, Math.floor(zcrCount / 10)); // Sample 10 frames across speech

  for (let i = startIdx; i <= endIdx; i += step) {
    const frameStart = i * hopSize;
    const frame = new Float32Array(fftSize);

    // Apply Hann window and copy samples
    for (let j = 0; j < Math.min(frameSize, fftSize); j++) {
      const idx = frameStart + j;
      const s = idx < samples.length ? samples[idx] : 0;
      const window = 0.5 * (1 - Math.cos((2 * Math.PI * j) / frameSize));
      frame[j] = s * window;
    }

    const spectrum = computeMagnitudeSpectrum(frame);
    const numBins = spectrum.length;
    const nyquist = sampleRate / 2;
    const binWidth = nyquist / numBins;

    let numWeighted = 0;
    let denom = 0;
    let totalFrameEnergy = 0;

    for (let k = 0; k < numBins; k++) {
      const freq = k * binWidth;
      const mag = spectrum[k];
      numWeighted += freq * mag;
      denom += mag;
      totalFrameEnergy += mag;

      // Classify into 4 key acoustic bands
      if (freq >= 100 && freq < 600) bandEnergiesTotal[0] += mag;
      else if (freq >= 600 && freq < 1800) bandEnergiesTotal[1] += mag;
      else if (freq >= 1800 && freq < 3500) bandEnergiesTotal[2] += mag;
      else if (freq >= 3500 && freq < 8000) bandEnergiesTotal[3] += mag;
    }

    if (denom > 1e-6) {
      spectralCentroids.push(numWeighted / denom);
    }

    // 85% spectral rolloff
    let cumEnergy = 0;
    let rolloffFreq = nyquist * 0.85;
    const targetEnergy = totalFrameEnergy * 0.85;
    for (let k = 0; k < numBins; k++) {
      cumEnergy += spectrum[k];
      if (cumEnergy >= targetEnergy) {
        rolloffFreq = k * binWidth;
        break;
      }
    }
    rolloffSum += rolloffFreq;
  }

  const meanCentroid = spectralCentroids.length > 0
    ? spectralCentroids.reduce((a, b) => a + b, 0) / spectralCentroids.length
    : 1500;

  const meanRolloff = spectralCentroids.length > 0
    ? rolloffSum / spectralCentroids.length
    : 3000;

  // Normalize band energies so volume/gain does not affect similarity
  const bandSum = bandEnergiesTotal[0] + bandEnergiesTotal[1] + bandEnergiesTotal[2] + bandEnergiesTotal[3];
  const normalizedBands: [number, number, number, number] = bandSum > 1e-6
    ? [
        bandEnergiesTotal[0] / bandSum,
        bandEnergiesTotal[1] / bandSum,
        bandEnergiesTotal[2] / bandSum,
        bandEnergiesTotal[3] / bandSum
      ]
    : [0.25, 0.25, 0.25, 0.25];

  // Transient burst ratio: ratio of first 20% frames to total energy
  const burstFrames = Math.max(1, Math.floor(zcrCount * 0.25));
  let burstEnergy = 0;
  for (let i = startIdx; i < Math.min(endIdx, startIdx + burstFrames); i++) {
    burstEnergy += frameEnergies[i] || 0;
  }
  const transientRatio = (averageRms * zcrCount) > 1e-6
    ? Math.min(1.0, burstEnergy / (averageRms * zcrCount))
    : 0.2;

  return {
    speechDuration,
    rmsEnergy: averageRms,
    zeroCrossingRate: meanZcr,
    spectralCentroid: meanCentroid,
    spectralRolloff: meanRolloff,
    bandEnergies: normalizedBands,
    transientRatio
  };
}

/**
 * Normalized acoustic similarity score between two feature vectors [0.0, 1.0].
 * Normalizes all dimensions and uses weighted similarity.
 */
export function computeAcousticSimilarity(a: AudioFeatures, b: AudioFeatures): number {
  // 1. Duration similarity (ideal speech duration for "کا" is ~0.4s to 1.1s)
  const durationDiff = Math.abs(a.speechDuration - b.speechDuration);
  const durationSim = Math.max(0, 1 - durationDiff / 0.8);

  // 2. Zero-crossing rate similarity (transient / burst indicator)
  const zcrDiff = Math.abs(a.zeroCrossingRate - b.zeroCrossingRate);
  const zcrSim = Math.max(0, 1 - zcrDiff / 0.35);

  // 3. Spectral Centroid similarity (velar pinch ~2000Hz vs vowel ~1000Hz)
  const centroidDiff = Math.abs(a.spectralCentroid - b.spectralCentroid);
  const centroidSim = Math.max(0, 1 - centroidDiff / 1500);

  // 4. Band energy distribution similarity (Cosine similarity between normalized 4-band vectors)
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < 4; i++) {
    dot += a.bandEnergies[i] * b.bandEnergies[i];
    normA += a.bandEnergies[i] * a.bandEnergies[i];
    normB += b.bandEnergies[i] * b.bandEnergies[i];
  }
  const bandSim = (normA > 0 && normB > 0)
    ? Math.max(0, Math.min(1, dot / (Math.sqrt(normA) * Math.sqrt(normB))))
    : 0.5;

  // 5. Transient burst similarity
  const transientDiff = Math.abs(a.transientRatio - b.transientRatio);
  const transientSim = Math.max(0, 1 - transientDiff / 0.5);

  // Weighted composition: Spectral bands (40%), Centroid (25%), ZCR (15%), Duration (10%), Transient (10%)
  const compositeSimilarity =
    bandSim * 0.40 +
    centroidSim * 0.25 +
    zcrSim * 0.15 +
    durationSim * 0.10 +
    transientSim * 0.10;

  return Math.max(0.0, Math.min(1.0, Number(compositeSimilarity.toFixed(4))));
}

/**
 * Analyzes pronunciation of "کا" against therapist-confirmed calibration examples.
 */
export async function analyzePronunciation(
  audioBlob: Blob,
  exerciseId = 'ex-qaf-ka-01',
  customSettings?: Partial<CalibrationSettings>
): Promise<PronunciationResult> {
  const storedSettings = await getCalibrationSettings();
  const settings: CalibrationSettings = { ...storedSettings, ...customSettings };

  // 1. Extract acoustic features from candidate recording
  const candidateFeatures = await extractAudioFeatures(audioBlob);

  if (!candidateFeatures) {
    return {
      result: 'UNCERTAIN',
      similarity: 0,
      reason: 'Not enough usable audio. Please try again.'
    };
  }

  // 2. Check for usable speech energy and minimum duration
  if (
    candidateFeatures.rmsEnergy < settings.minSpeechEnergy ||
    candidateFeatures.speechDuration < settings.minSpeechDuration
  ) {
    return {
      result: 'UNCERTAIN',
      similarity: 0.05,
      reason: 'Not enough usable audio. Please try again.',
      details: {
        correctSimilarity: 0,
        incorrectSimilarity: 0,
        speechDuration: candidateFeatures.speechDuration,
        speechEnergy: candidateFeatures.rmsEnergy,
        zeroCrossingRate: candidateFeatures.zeroCrossingRate,
        spectralCentroid: candidateFeatures.spectralCentroid
      }
    };
  }

  // 3. Load therapist-confirmed reference examples
  await seedInitialCalibration(exerciseId);
  const referenceExamples = await getCalibrationExamples(exerciseId);

  const correctExamples = referenceExamples.filter(e => e.label === 'CORRECT');
  const incorrectExamples = referenceExamples.filter(e => e.label === 'INCORRECT');

  // Compute similarity against all CORRECT references
  let maxCorrectSim = 0;
  let correctSum = 0;

  for (const ref of correctExamples) {
    let refFeatures = ref.features;
    if (!refFeatures && ref.blob) {
      try {
        refFeatures = (await extractAudioFeatures(ref.blob)) || undefined;
      } catch {
        refFeatures = undefined;
      }
    }
    if (refFeatures) {
      const sim = computeAcousticSimilarity(candidateFeatures, refFeatures);
      if (sim > maxCorrectSim) maxCorrectSim = sim;
      correctSum += sim;
    }
  }

  // Compute similarity against all INCORRECT references
  let maxIncorrectSim = 0;
  let incorrectSum = 0;

  for (const ref of incorrectExamples) {
    let refFeatures = ref.features;
    if (!refFeatures && ref.blob) {
      try {
        refFeatures = (await extractAudioFeatures(ref.blob)) || undefined;
      } catch {
        refFeatures = undefined;
      }
    }
    if (refFeatures) {
      const sim = computeAcousticSimilarity(candidateFeatures, refFeatures);
      if (sim > maxIncorrectSim) maxIncorrectSim = sim;
      incorrectSum += sim;
    }
  }

  // Weighted score favoring peak match with consistency bonus
  const avgCorrect = correctExamples.length > 0 ? correctSum / correctExamples.length : maxCorrectSim;
  const avgIncorrect = incorrectExamples.length > 0 ? incorrectSum / incorrectExamples.length : maxIncorrectSim;

  const scoreCorrect = maxCorrectSim * 0.7 + avgCorrect * 0.3;
  const scoreIncorrect = maxIncorrectSim * 0.7 + avgIncorrect * 0.3;

  const primarySimilarity = Number(scoreCorrect.toFixed(3));

  // 4. Decision Logic using Configurable Thresholds
  const { similarityThreshold, marginVsIncorrect } = settings;

  // High similarity to therapist-confirmed correct examples
  if (scoreCorrect >= similarityThreshold && scoreCorrect >= (scoreIncorrect + marginVsIncorrect)) {
    return {
      result: 'CORRECT',
      similarity: primarySimilarity,
      reason: 'Your recording is similar to your confirmed practice examples.',
      details: {
        correctSimilarity: primarySimilarity,
        incorrectSimilarity: Number(scoreIncorrect.toFixed(3)),
        speechDuration: candidateFeatures.speechDuration,
        speechEnergy: candidateFeatures.rmsEnergy,
        zeroCrossingRate: candidateFeatures.zeroCrossingRate,
        spectralCentroid: candidateFeatures.spectralCentroid
      }
    };
  }

  // High similarity to therapist-confirmed incorrect examples
  if (scoreIncorrect >= similarityThreshold || scoreIncorrect > (scoreCorrect + marginVsIncorrect)) {
    return {
      result: 'INCORRECT',
      similarity: primarySimilarity,
      reason: "Try again according to your speech therapist's instructions.",
      details: {
        correctSimilarity: primarySimilarity,
        incorrectSimilarity: Number(scoreIncorrect.toFixed(3)),
        speechDuration: candidateFeatures.speechDuration,
        speechEnergy: candidateFeatures.rmsEnergy,
        zeroCrossingRate: candidateFeatures.zeroCrossingRate,
        spectralCentroid: candidateFeatures.spectralCentroid
      }
    };
  }

  // Insufficient confidence / Ambiguous separation
  return {
    result: 'UNCERTAIN',
    similarity: primarySimilarity,
    reason: 'Uncertain — please repeat or ask your speech therapist to review.',
    details: {
      correctSimilarity: primarySimilarity,
      incorrectSimilarity: Number(scoreIncorrect.toFixed(3)),
      speechDuration: candidateFeatures.speechDuration,
      speechEnergy: candidateFeatures.rmsEnergy,
      zeroCrossingRate: candidateFeatures.zeroCrossingRate,
      spectralCentroid: candidateFeatures.spectralCentroid
    }
  };
}

/**
 * Simple Discrete Fast Fourier Transform for magnitude spectrum computation
 */
function computeMagnitudeSpectrum(frame: Float32Array): Float32Array {
  const n = frame.length;
  const halfN = Math.floor(n / 2);
  const mags = new Float32Array(halfN);

  for (let k = 0; k < halfN; k++) {
    let real = 0;
    let imag = 0;
    const omega = (2 * Math.PI * k) / n;

    for (let t = 0; t < n; t++) {
      const angle = omega * t;
      real += frame[t] * Math.cos(angle);
      imag -= frame[t] * Math.sin(angle);
    }

    mags[k] = Math.sqrt(real * real + imag * imag);
  }

  return mags;
}

/**
 * Direct parser for 16-bit PCM WAV buffers
 */
function parseWavOrRawPcm(buffer: ArrayBuffer): Float32Array | null {
  try {
    if (buffer.byteLength < 44) return null;
    const view = new DataView(buffer);

    // Verify RIFF / WAVE headers
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

    if (riff === 'RIFF' && wave === 'WAVE') {
      const bitsPerSample = view.getUint16(34, true);
      const dataOffset = 44;
      const numSamples = Math.floor((buffer.byteLength - dataOffset) / (bitsPerSample / 8));
      const floatSamples = new Float32Array(numSamples);

      if (bitsPerSample === 16) {
        for (let i = 0; i < numSamples; i++) {
          const int16 = view.getInt16(dataOffset + i * 2, true);
          floatSamples[i] = int16 / (int16 < 0 ? 32768 : 32767);
        }
        return floatSamples;
      }
    }
  } catch {
    // fallback
  }
  return null;
}

/**
 * Approximate PCM sample array from raw byte stream for offline/test environments
 */
function approximatePcmFromBytes(bytes: Uint8Array): Float32Array {
  const len = Math.max(128, Math.floor(bytes.length / 2));
  const samples = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    const byte = bytes[i * 2] || 0;
    // Normalized [-1, 1]
    samples[i] = (byte - 128) / 128;
  }
  return samples;
}
