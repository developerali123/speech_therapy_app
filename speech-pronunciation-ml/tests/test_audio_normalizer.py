"""
Tests for Audio Validation, Rejection, and Normalization.
"""

import unittest
import struct
from src.audio.validator import AudioValidator, AudioValidationError
from src.audio.normalizer import AudioNormalizer

class TestAudioNormalizer(unittest.TestCase):

    def _create_synthetic_wav_bytes(self, duration=0.5, sr=16000, channels=1, bits=16, freq=440.0):
        import math
        total_samples = int(duration * sr)
        audio_data = bytearray()
        for i in range(total_samples):
            val = int(math.sin(2.0 * math.pi * freq * (i / sr)) * 16000.0)
            if channels == 1:
                audio_data.extend(struct.pack('<h', val))
            else:
                audio_data.extend(struct.pack('<hh', val, val))

        header = bytearray(b'RIFF')
        header.extend(struct.pack('<I', 36 + len(audio_data)))
        header.extend(b'WAVEfmt ')
        header.extend(struct.pack('<I', 16))
        header.extend(struct.pack('<H', 1))  # PCM
        header.extend(struct.pack('<H', channels))
        header.extend(struct.pack('<I', sr))
        header.extend(struct.pack('<I', sr * channels * (bits // 8)))
        header.extend(struct.pack('<H', channels * (bits // 8)))
        header.extend(struct.pack('<H', bits))
        header.extend(b'data')
        header.extend(struct.pack('<I', len(audio_data)))
        header.extend(audio_data)
        return bytes(header)

    def test_rejects_compressed_audio_without_pcm_decoder(self):
        """Must reject WebM/Ogg/MP3 header without silently treating as PCM."""
        webm_header = b'\x1aE\xdf\xa3\x9f\x42\x86\x81\x01\x42\xf7\x81\x01' + b'\x00' * 50
        with self.assertRaises(AudioValidationError) as ctx:
            AudioValidator.validate_wav_header(webm_header)
        self.assertIn("Compressed container format", str(ctx.exception))

    def test_rejects_sub_minimum_duration(self):
        """Must reject audio shorter than 0.20s threshold."""
        short_wav = self._create_synthetic_wav_bytes(duration=0.10)
        with self.assertRaises(AudioValidationError) as ctx:
            AudioNormalizer.standardize_audio(short_wav)
        self.assertIn("shorter than required minimum", str(ctx.exception))

    def test_standardizes_valid_audio_to_16k_mono_float(self):
        """Valid stereo 44.1kHz audio is downmixed to mono and resampled to 16kHz float PCM."""
        stereo_44k = self._create_synthetic_wav_bytes(duration=0.5, sr=44100, channels=2, freq=500.0)
        std = AudioNormalizer.standardize_audio(stereo_44k)

        self.assertEqual(std['sample_rate'], 16000)
        self.assertEqual(std['channels'], 1)
        self.assertAlmostEqual(std['duration'], 0.5, delta=0.05)
        self.assertLessEqual(std['peak'], 0.96)
        self.assertGreater(std['rms'], 0.05)

if __name__ == '__main__':
    unittest.main()
