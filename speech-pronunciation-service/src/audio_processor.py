"""
Audio processing module for speech pronunciation service.
Validates, standardizes, and normalizes audio for the ML model.
"""

import math
import struct
from typing import List, Tuple, Dict, Any, Optional

class AudioProcessingError(Exception):
    """Raised when audio decoding, validation, or processing fails."""
    pass

class AudioProcessor:
    """
    Decodes and normalizes audio input to:
    - 16,000 Hz sample rate
    - Single channel (mono)
    - Normalized float32 samples [-1.0, 1.0]
    """

    TARGET_SAMPLE_RATE = 16000
    MIN_DURATION_SECONDS = 0.20
    MAX_DURATION_SECONDS = 15.0
    TARGET_PEAK = 0.95

    @classmethod
    def parse_wav(cls, raw_bytes: bytes) -> Tuple[List[float], int]:
        """
        Parses standard RIFF/WAVE header and decodes samples.
        """
        if len(raw_bytes) < 44:
            raise AudioProcessingError("Audio data too short for a valid WAV header (< 44 bytes).")

        if raw_bytes[:4] != b'RIFF' or raw_bytes[8:12] != b'WAVE':
            raise AudioProcessingError("Invalid audio format: Not a RIFF/WAVE header.")

        offset = 12
        fmt_chunk_found = False
        data_chunk_found = False
        audio_format = 1
        num_channels = 1
        sample_rate = 16000
        bits_per_sample = 16
        data_size = 0
        data_offset = 0

        while offset + 8 <= len(raw_bytes):
            chunk_id = raw_bytes[offset:offset+4]
            chunk_size = struct.unpack('<I', raw_bytes[offset+4:offset+8])[0]
            offset += 8

            if chunk_id == b'fmt ':
                fmt_chunk_found = True
                if chunk_size < 16:
                    raise AudioProcessingError("Corrupted 'fmt ' chunk in WAV header.")
                audio_format = struct.unpack('<H', raw_bytes[offset:offset+2])[0]
                num_channels = struct.unpack('<H', raw_bytes[offset+2:offset+4])[0]
                sample_rate = struct.unpack('<I', raw_bytes[offset+4:offset+8])[0]
                bits_per_sample = struct.unpack('<H', raw_bytes[offset+14:offset+16])[0]
            elif chunk_id == b'data':
                data_chunk_found = True
                data_size = chunk_size
                data_offset = offset
                break

            offset += chunk_size

        if not fmt_chunk_found or not data_chunk_found:
            raise AudioProcessingError("Missing required 'fmt ' or 'data' chunk in WAV stream.")

        if audio_format not in (1, 3):
            raise AudioProcessingError(f"Unsupported audio encoding: format {audio_format}. Expected PCM or Float.")

        if num_channels < 1 or num_channels > 2:
            raise AudioProcessingError(f"Unsupported channel count: {num_channels}. Expected mono or stereo.")

        if bits_per_sample not in (8, 16, 24, 32):
            raise AudioProcessingError(f"Unsupported bit depth: {bits_per_sample}-bit.")

        raw_data = raw_bytes[data_offset:data_offset + data_size]
        bytes_per_sample = bits_per_sample // 8
        bytes_per_frame = num_channels * bytes_per_sample
        total_frames = len(raw_data) // bytes_per_frame

        if total_frames == 0:
            raise AudioProcessingError("WAV data chunk contains no audio frames.")

        duration = total_frames / sample_rate
        if duration < cls.MIN_DURATION_SECONDS:
            raise AudioProcessingError(f"Audio duration ({duration:.2f}s) is shorter than minimum {cls.MIN_DURATION_SECONDS}s.")
        if duration > cls.MAX_DURATION_SECONDS:
            raise AudioProcessingError(f"Audio duration ({duration:.2f}s) exceeds maximum {cls.MAX_DURATION_SECONDS}s.")

        samples: List[float] = []

        if audio_format == 1:  # Integer PCM
            if bits_per_sample == 16:
                fmt = f"<{total_frames * num_channels}h"
                raw_ints = struct.unpack(fmt, raw_data[:total_frames * bytes_per_frame])
                scale = 32768.0
                if num_channels == 1:
                    samples = [v / scale for v in raw_ints]
                else:
                    samples = [0.5 * (raw_ints[i] + raw_ints[i+1]) / scale for i in range(0, len(raw_ints), 2)]
            elif bits_per_sample == 8:
                if num_channels == 1:
                    samples = [(b - 128) / 128.0 for b in raw_data[:total_frames]]
                else:
                    samples = [0.5 * ((raw_data[i] - 128) + (raw_data[i+1] - 128)) / 128.0 for i in range(0, total_frames * 2, 2)]
            elif bits_per_sample == 32:
                fmt = f"<{total_frames * num_channels}i"
                raw_ints = struct.unpack(fmt, raw_data[:total_frames * bytes_per_frame])
                scale = 2147483648.0
                if num_channels == 1:
                    samples = [v / scale for v in raw_ints]
                else:
                    samples = [0.5 * (raw_ints[i] + raw_ints[i+1]) / scale for i in range(0, len(raw_ints), 2)]
        elif audio_format == 3:  # Float PCM
            fmt = f"<{total_frames * num_channels}f"
            raw_floats = struct.unpack(fmt, raw_data[:total_frames * bytes_per_frame])
            if num_channels == 1:
                samples = list(raw_floats)
            else:
                samples = [0.5 * (raw_floats[i] + raw_floats[i+1]) for i in range(0, len(raw_floats), 2)]

        return samples, sample_rate

    @classmethod
    def resample(cls, samples: List[float], orig_sr: int, target_sr: int = 16000) -> List[float]:
        """Linear interpolation resampling to target sample rate."""
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
    def normalize_peak(cls, samples: List[float], peak_target: float = 0.95) -> List[float]:
        """Peak amplitude normalization."""
        if not samples:
            return []
        max_val = max(abs(s) for s in samples)
        if max_val < 1e-6:
            return samples
        gain = min(peak_target / max_val, 20.0)
        return [max(-1.0, min(1.0, s * gain)) for s in samples]

    @classmethod
    def process(cls, raw_bytes: bytes) -> Dict[str, Any]:
        """Full validation and normalization pipeline."""
        samples, sr = cls.parse_wav(raw_bytes)
        resampled = cls.resample(samples, sr, cls.TARGET_SAMPLE_RATE)
        normalized = cls.normalize_peak(resampled, cls.TARGET_PEAK)
        duration = len(normalized) / cls.TARGET_SAMPLE_RATE
        return {
            "samples": normalized,
            "sample_rate": cls.TARGET_SAMPLE_RATE,
            "duration": round(duration, 3)
        }
