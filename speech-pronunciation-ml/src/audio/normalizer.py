"""
Audio normalization and standardization module.
Standardizes speech recordings to:
- Mono
- 16 kHz
- Floating-point PCM in range [-1.0, 1.0]
- Consistent amplitude normalization
"""

import math
import struct
import wave
from typing import List, Tuple, Dict, Any, Optional
from .validator import AudioValidator, AudioValidationError

class AudioNormalizer:
    """
    Normalizes audio streams to standardized ML input format:
    16,000 Hz, 1 channel (mono), float32 PCM [-1.0, 1.0], normalized amplitude.
    """

    TARGET_SAMPLE_RATE = 16000
    TARGET_PEAK = 0.95

    @classmethod
    def read_wav(cls, file_path_or_bytes: Any) -> Tuple[List[float], int]:
        """
        Reads a WAV file path or raw bytes, validates integrity,
        and decodes samples to floating-point values in [-1.0, 1.0].
        """
        if isinstance(file_path_or_bytes, str):
            with open(file_path_or_bytes, 'rb') as f:
                raw_bytes = f.read()
        elif isinstance(file_path_or_bytes, bytes):
            raw_bytes = file_path_or_bytes
        else:
            raise AudioValidationError(f"Invalid input type: {type(file_path_or_bytes)}")

        info = AudioValidator.validate_wav_header(raw_bytes)
        
        num_channels = info['num_channels']
        sample_rate = info['sample_rate']
        bits_per_sample = info['bits_per_sample']
        audio_format = info['audio_format']
        data_offset = info['data_offset']
        data_size = info['data_size']

        raw_data = raw_bytes[data_offset:data_offset + data_size]
        bytes_per_sample = bits_per_sample // 8
        bytes_per_frame = num_channels * bytes_per_sample
        total_frames = len(raw_data) // bytes_per_frame

        samples: List[float] = []

        if audio_format == 1:  # Integer PCM
            if bits_per_sample == 16:
                fmt = f"<{total_frames * num_channels}h"
                raw_ints = struct.unpack(fmt, raw_data[:total_frames * bytes_per_frame])
                scale = 32768.0
                if num_channels == 1:
                    samples = [val / scale for val in raw_ints]
                else:
                    # Downmix stereo to mono
                    samples = [0.5 * (raw_ints[i] + raw_ints[i+1]) / scale for i in range(0, len(raw_ints), 2)]
            elif bits_per_sample == 8:
                # 8-bit unsigned PCM [0, 255], center at 128
                if num_channels == 1:
                    samples = [(b - 128) / 128.0 for b in raw_data[:total_frames]]
                else:
                    samples = [0.5 * ((raw_data[i] - 128) + (raw_data[i+1] - 128)) / 128.0 for i in range(0, total_frames * 2, 2)]
            elif bits_per_sample == 24:
                # 24-bit PCM
                scale = 8388608.0
                for i in range(0, total_frames * bytes_per_frame, bytes_per_frame):
                    channels = []
                    for ch in range(num_channels):
                        idx = i + ch * 3
                        val = int.from_bytes(raw_data[idx:idx+3], byteorder='little', signed=True)
                        channels.append(val / scale)
                    samples.append(sum(channels) / len(channels))
            elif bits_per_sample == 32:
                fmt = f"<{total_frames * num_channels}i"
                raw_ints = struct.unpack(fmt, raw_data[:total_frames * bytes_per_frame])
                scale = 2147483648.0
                if num_channels == 1:
                    samples = [val / scale for val in raw_ints]
                else:
                    samples = [0.5 * (raw_ints[i] + raw_ints[i+1]) / scale for i in range(0, len(raw_ints), 2)]
        elif audio_format == 3:  # IEEE Float
            fmt = f"<{total_frames * num_channels}f"
            raw_floats = struct.unpack(fmt, raw_data[:total_frames * bytes_per_frame])
            if num_channels == 1:
                samples = list(raw_floats)
            else:
                samples = [0.5 * (raw_floats[i] + raw_floats[i+1]) for i in range(0, len(raw_floats), 2)]

        return samples, sample_rate

    @classmethod
    def resample_linear(cls, samples: List[float], orig_sr: int, target_sr: int = 16000) -> List[float]:
        """
        High-fidelity linear interpolation resampler.
        Converts any sample rate to target 16 kHz.
        """
        if orig_sr == target_sr:
            return samples

        if not samples:
            return []

        ratio = float(orig_sr) / float(target_sr)
        new_len = int(len(samples) / ratio)
        resampled = [0.0] * new_len

        for i in range(new_len):
            src_idx = i * ratio
            idx0 = int(src_idx)
            idx1 = min(idx0 + 1, len(samples) - 1)
            frac = src_idx - idx0
            resampled[i] = (1.0 - frac) * samples[idx0] + frac * samples[idx1]

        return resampled

    @classmethod
    def normalize_amplitude(cls, samples: List[float], target_peak: float = 0.95) -> List[float]:
        """
        Applies consistent peak amplitude normalization.
        Scales audio so max absolute value equals target_peak (0.95), preventing clipping.
        """
        if not samples:
            return []

        max_amp = max(abs(s) for s in samples)
        if max_amp <= 1e-6:
            # Silent recording
            return samples

        gain = target_peak / max_amp
        # Clamp to avoid extreme amplification of pure noise (max gain 20x)
        gain = min(gain, 20.0)

        normalized = [max(-1.0, min(1.0, s * gain)) for s in samples]
        return normalized

    @classmethod
    def standardize_audio(cls, file_path_or_bytes: Any) -> Dict[str, Any]:
        """
        Standardizes input recording completely:
        1. Validates header and data
        2. Decodes to floating-point mono
        3. Resamples to 16,000 Hz
        4. Normalizes amplitude to target peak
        5. Computes QA metrics (RMS, duration, clipping, silence %)
        """
        raw_samples, orig_sr = cls.read_wav(file_path_or_bytes)
        mono_16k = cls.resample_linear(raw_samples, orig_sr, cls.TARGET_SAMPLE_RATE)
        normalized = cls.normalize_amplitude(mono_16k, cls.TARGET_PEAK)

        # Audio Quality Metrics
        duration = len(normalized) / cls.TARGET_SAMPLE_RATE
        if duration < AudioValidator.MIN_DURATION_SECONDS:
            raise AudioValidationError(
                f"Resampled duration ({duration:.3f}s) is below minimum required {AudioValidator.MIN_DURATION_SECONDS}s."
            )

        peak = max(abs(s) for s in normalized) if normalized else 0.0
        rms = math.sqrt(sum(s * s for s in normalized) / len(normalized)) if normalized else 0.0

        # Silence threshold at -36 dBFS (~0.015)
        silence_threshold = 0.015
        silent_count = sum(1 for s in normalized if abs(s) < silence_threshold)
        silence_ratio = silent_count / len(normalized) if normalized else 0.0

        if silence_ratio > 0.96 and peak < 0.05:
            raise AudioValidationError("Audio rejected: Recording consists entirely of silence or near-zero background floor.")

        return {
            'samples': normalized,
            'sample_rate': cls.TARGET_SAMPLE_RATE,
            'duration': duration,
            'num_samples': len(normalized),
            'peak': peak,
            'rms': rms,
            'silence_ratio': silence_ratio,
            'channels': 1,
            'format': 'float32_pcm_16k_mono'
        }

    @classmethod
    def save_wav(cls, output_path: str, samples: List[float], sample_rate: int = 16000) -> None:
        """Saves normalized float samples as standard 16-bit PCM WAV."""
        raw_ints = [max(-32767, min(32767, int(s * 32767.0))) for s in samples]
        packed = struct.pack(f"<{len(raw_ints)}h", *raw_ints)

        with wave.open(output_path, 'wb') as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(sample_rate)
            wf.writeframes(packed)
