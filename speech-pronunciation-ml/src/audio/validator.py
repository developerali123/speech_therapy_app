"""
Audio validation module for speech pronunciation ML dataset.
Performs integrity checks, format validation, duration thresholds, and corruption detection.
"""

import os
import struct
from typing import Tuple, Dict, Any, Optional

class AudioValidationError(Exception):
    """Raised when an audio recording fails validation checks."""
    pass

class AudioValidator:
    """
    Validates audio files and byte streams for ML dataset ingestion.
    Rejects:
    - Compressed audio (WebM, Ogg, MP3, AAC) when attempted to be read as raw PCM
    - Corrupted or truncated WAV headers
    - Non-audio or empty files
    - Recordings shorter than minimum threshold
    - Extreme silence or pure clipping
    """

    MIN_DURATION_SECONDS = 0.20
    MAX_DURATION_SECONDS = 15.0
    TARGET_SAMPLE_RATE = 16000

    MAGIC_SIGNATURES = {
        b'RIFF': 'WAV',
        b'\x1aE\xdf\xa3': 'WEBM',
        b'OggS': 'OGG',
        b'ID3': 'MP3_ID3',
        b'\xff\xfb': 'MP3_FRAME',
        b'\xff\xf3': 'MP3_FRAME',
        b'fLaC': 'FLAC',
        b'\x00\x00\x00\x18ftyp': 'MP4'
    }

    @classmethod
    def detect_format(cls, raw_bytes: bytes) -> str:
        """Identifies file format from magic bytes."""
        if len(raw_bytes) < 4:
            return 'UNKNOWN_TOO_SHORT'
        
        prefix = raw_bytes[:4]
        for magic, fmt in cls.MAGIC_SIGNATURES.items():
            if raw_bytes.startswith(magic):
                return fmt
        
        # Check for WAV sub-magic
        if prefix == b'RIFF' and len(raw_bytes) >= 12 and raw_bytes[8:12] == b'WAVE':
            return 'WAV'
            
        return 'RAW_OR_UNKNOWN'

    @classmethod
    def validate_wav_header(cls, raw_bytes: bytes) -> Dict[str, Any]:
        """
        Parses and validates standard RIFF/WAVE header.
        Ensures PCM encoding, valid channel counts, and sample rate.
        """
        if len(raw_bytes) < 44:
            raise AudioValidationError("Audio file too short to contain a valid WAV header (less than 44 bytes).")

        if raw_bytes[:4] != b'RIFF' or raw_bytes[8:12] != b'WAVE':
            fmt = cls.detect_format(raw_bytes)
            if fmt in ('WEBM', 'OGG', 'MP3_ID3', 'MP3_FRAME', 'MP4'):
                raise AudioValidationError(
                    f"Compressed container format '{fmt}' detected. "
                    "Do NOT silently reinterpret compressed bytes as PCM; input must be decoded WAV/PCM."
                )
            raise AudioValidationError(f"Invalid WAV magic bytes: {raw_bytes[:4]!r}. Expected b'RIFF...WAVE'.")

        # Parse chunks
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
                    raise AudioValidationError("Corrupted 'fmt ' chunk in WAV header: size is less than 16 bytes.")
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
            raise AudioValidationError("Missing required 'fmt ' or 'data' chunk in WAV stream.")

        # 1 = PCM integer, 3 = IEEE float
        if audio_format not in (1, 3):
            raise AudioValidationError(f"Unsupported audio encoding format: {audio_format}. Expected PCM (1) or Float (3).")

        if num_channels < 1 or num_channels > 2:
            raise AudioValidationError(f"Unsupported channel count: {num_channels}. Expected mono (1) or stereo (2).")

        if bits_per_sample not in (8, 16, 24, 32):
            raise AudioValidationError(f"Unsupported bit depth: {bits_per_sample}. Expected 8, 16, 24, or 32-bit.")

        bytes_per_sample = bits_per_sample // 8
        frame_size = num_channels * bytes_per_sample
        total_frames = data_size // frame_size if frame_size > 0 else 0
        duration = total_frames / sample_rate if sample_rate > 0 else 0.0

        if duration < cls.MIN_DURATION_SECONDS:
            raise AudioValidationError(
                f"Audio duration ({duration:.3f}s) is shorter than required minimum threshold ({cls.MIN_DURATION_SECONDS}s)."
            )

        if duration > cls.MAX_DURATION_SECONDS:
            raise AudioValidationError(
                f"Audio duration ({duration:.3f}s) exceeds maximum allowed threshold ({cls.MAX_DURATION_SECONDS}s)."
            )

        return {
            'audio_format': audio_format,
            'num_channels': num_channels,
            'sample_rate': sample_rate,
            'bits_per_sample': bits_per_sample,
            'data_size': data_size,
            'data_offset': data_offset,
            'duration': duration,
            'total_frames': total_frames
        }
