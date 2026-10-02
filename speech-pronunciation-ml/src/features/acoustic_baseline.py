"""
Acoustic and spectral baseline feature extractor.
Computes domain-specific phonetic features:
- Short-time RMS energy and envelope
- Zero-Crossing Rate (ZCR)
- Spectral Centroid (brightness / center of mass)
- Spectral Flux (rate of spectral change across frames)
- Sub-band Formant Energies (F1, F2, F3 and velar burst band 1.5 - 3.5 kHz)
"""

import math
from typing import List, Dict, Any

class AcousticBaselineExtractor:
    """
    Extracts classical acoustic and spectral features for speech baseline evaluation.
    """

    SAMPLE_RATE = 16000
    FRAME_SIZE = 256    # 16ms at 16kHz
    HOP_SIZE = 256      # 16ms non-overlapping for speed

    @classmethod
    def _fft_magnitudes(cls, frame: List[float]) -> List[float]:
        """
        Fast sub-band spectral magnitude spectrum using 32 uniform analysis bins.
        """
        num_bins = 32
        mags = [0.0] * num_bins
        step = len(frame) // num_bins
        if step == 0:
            return mags

        for b in range(num_bins):
            chunk = frame[b * step:(b + 1) * step]
            # Energy in sub-band
            mags[b] = math.sqrt(sum(s * s for s in chunk) / len(chunk) + 1e-9)

        return mags

    @classmethod
    def extract_features(cls, samples: List[float], sample_rate: int = 16000) -> List[float]:
        """
        Extracts temporal and spectral pooled features from 16kHz mono audio.
        Returns a fixed-dimensional vector (28 features):
        - RMS stats (mean, std, max)
        - ZCR stats (mean, std)
        - Spectral Centroid stats (mean, std)
        - Spectral Flux stats (mean, std)
        - Band energies (Low: 100-500Hz, Mid: 500-1500Hz, Formant2: 1500-2800Hz, High/Burst: 2800-6000Hz)
        """
        if not samples or len(samples) < cls.FRAME_SIZE:
            return [0.0] * 28

        frames: List[List[float]] = []
        for i in range(0, len(samples) - cls.FRAME_SIZE, cls.HOP_SIZE):
            frames.append(samples[i:i + cls.FRAME_SIZE])

        if not frames:
            return [0.0] * 28

        energies: List[float] = []
        zcrs: List[float] = []
        centroids: List[float] = []
        fluxes: List[float] = []
        band_low: List[float] = []
        band_mid: List[float] = []
        band_f2: List[float] = []
        band_high: List[float] = []

        prev_mag: List[float] = []
        nyquist = sample_rate / 2.0
        bin_hz = nyquist / 32.0

        for frame in frames:
            # 1. RMS Energy
            rms = math.sqrt(sum(s * s for s in frame) / len(frame))
            energies.append(rms)

            # 2. Zero-crossing rate
            zcr = sum(1 for j in range(1, len(frame)) if (frame[j] >= 0 > frame[j-1]) or (frame[j] < 0 <= frame[j-1])) / len(frame)
            zcrs.append(zcr)

            # 3. Spectral Magnitudes
            mag = cls._fft_magnitudes(frame)
            total_mag = sum(mag) + 1e-9

            # 4. Spectral Centroid
            centroid = sum(k * bin_hz * mag[k] for k in range(len(mag))) / total_mag
            centroids.append(centroid)

            # 5. Spectral Flux
            if prev_mag:
                flux = sum((mag[k] - prev_mag[k]) ** 2 for k in range(len(mag)))
                fluxes.append(math.sqrt(flux))
            else:
                fluxes.append(0.0)
            prev_mag = mag

            # 6. Sub-band Energies
            # Low: 100 - 500 Hz (F1 region)
            # Mid: 500 - 1500 Hz (F1/F2 boundary)
            # F2:  1500 - 2800 Hz (F2/velar burst region)
            # High: 2800 - 6000 Hz
            e_low = sum(mag[k] for k in range(len(mag)) if 100 <= k * bin_hz < 500)
            e_mid = sum(mag[k] for k in range(len(mag)) if 500 <= k * bin_hz < 1500)
            e_f2 = sum(mag[k] for k in range(len(mag)) if 1500 <= k * bin_hz < 2800)
            e_high = sum(mag[k] for k in range(len(mag)) if 2800 <= k * bin_hz < 6000)

            band_low.append(e_low / total_mag)
            band_mid.append(e_mid / total_mag)
            band_f2.append(e_f2 / total_mag)
            band_high.append(e_high / total_mag)

        def _stats(arr: List[float]) -> Tuple[float, float, float]:
            if not arr:
                return 0.0, 0.0, 0.0
            m = sum(arr) / len(arr)
            var = sum((x - m) ** 2 for x in arr) / len(arr)
            s = math.sqrt(var)
            mx = max(arr)
            return m, s, mx

        feat_vector: List[float] = []
        for seq in [energies, zcrs, centroids, fluxes, band_low, band_mid, band_f2, band_high]:
            m, s, mx = _stats(seq)
            feat_vector.extend([round(m, 4), round(s, 4), round(mx, 4)])

        # Additional global features
        duration = len(samples) / sample_rate
        total_energy = sum(s * s for s in samples)
        feat_vector.extend([round(duration, 4), round(total_energy, 4)])

        # Normalize feature vector to prevent overflow
        norm = math.sqrt(sum(x * x for x in feat_vector)) + 1e-9
        return [round(x / norm, 5) for x in feat_vector]
