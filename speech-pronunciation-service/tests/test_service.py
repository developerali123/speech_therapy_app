"""
Unit and integration tests for Speech Pronunciation FastAPI service.
Tests:
- Successful ML response
- Service health
- Audio decoding failure -> UNCERTAIN
- Too short audio -> UNCERTAIN
- Unsupported exercise -> UNCERTAIN
- Low confidence policy -> UNCERTAIN
- Model unavailable -> UNCERTAIN
"""

import io
import math
import struct
import wave
import os
import sys
import pytest
from fastapi.testclient import TestClient

current_dir = os.path.dirname(os.path.abspath(__file__))
svc_root = os.path.abspath(os.path.join(current_dir, ".."))
if svc_root not in sys.path:
    sys.path.insert(0, svc_root)

from src.app import app, model_instance

client = TestClient(app)

def create_synthetic_wav(duration: float = 0.8, sample_rate: int = 16000, freq: float = 440.0) -> bytes:
    """Creates an in-memory 16-bit mono PCM WAV byte stream."""
    num_samples = int(duration * sample_rate)
    samples = []
    for i in range(num_samples):
        val = 0.5 * math.sin(2.0 * math.pi * freq * (i / sample_rate))
        int_val = int(val * 32767.0)
        samples.append(int_val)

    packed = struct.pack(f"<{len(samples)}h", *samples)
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(packed)
    return buf.getvalue()

def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "speech-pronunciation-service"
    assert data["model_available"] is True

def test_successful_ml_assessment_ka():
    wav_bytes = create_synthetic_wav(duration=0.8, freq=300.0)
    response = client.post(
        "/assess-pronunciation",
        data={"exerciseId": "ex-qaf-ka-01"},
        files={"audio": ("test.wav", io.BytesIO(wav_bytes), "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["exerciseId"] == "ex-qaf-ka-01"
    assert data["targetText"] == "کا"
    assert data["result"] in ("CORRECT", "NEEDS_PRACTICE", "UNCERTAIN")
    assert 0.0 <= data["confidence"] <= 1.0
    assert 0.0 <= data["pronunciationScore"] <= 1.0
    assert data["modelVersion"] == "xlsr-v1.0-linear"
    assert len(data["unitResults"]) == 1
    assert data["unitResults"][0]["unit"] == "کا"

def test_successful_ml_assessment_other_targets():
    targets = [("ki", "کی"), ("ke", "کے"), ("ko", "کو")]
    for ex_id, expected_text in targets:
        wav_bytes = create_synthetic_wav(duration=0.6, freq=400.0)
        response = client.post(
            "/assess-pronunciation",
            data={"exerciseId": ex_id},
            files={"audio": ("test.wav", io.BytesIO(wav_bytes), "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["exerciseId"] == ex_id
        assert data["targetText"] == expected_text
        assert data["result"] in ("CORRECT", "NEEDS_PRACTICE", "UNCERTAIN")

def test_invalid_audio_bytes_returns_uncertain():
    corrupted_bytes = b"This is not a valid RIFF WAVE audio stream!"
    response = client.post(
        "/assess-pronunciation",
        data={"exerciseId": "ex-qaf-ka-01"},
        files={"audio": ("corrupted.wav", io.BytesIO(corrupted_bytes), "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "UNCERTAIN"
    assert data["confidence"] == 0.0
    assert "rejected" in data["reason"].lower() or "decoding" in data["reason"].lower()

def test_audio_too_short_returns_uncertain():
    # 0.05 seconds is below 0.20s minimum
    short_wav = create_synthetic_wav(duration=0.05)
    response = client.post(
        "/assess-pronunciation",
        data={"exerciseId": "ex-qaf-ka-01"},
        files={"audio": ("short.wav", io.BytesIO(short_wav), "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "UNCERTAIN"

def test_unsupported_exercise_returns_uncertain():
    wav_bytes = create_synthetic_wav(duration=0.7)
    response = client.post(
        "/assess-pronunciation",
        data={"exerciseId": "unsupported-exercise-xyz"},
        files={"audio": ("test.wav", io.BytesIO(wav_bytes), "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "UNCERTAIN"
    assert data["targetText"] == "unsupported"
    assert "not yet supported" in data["reason"].lower()

def test_sequence_exercise_returns_uncertain():
    # Multi-unit sequences are deferred until single units reach target reliability
    wav_bytes = create_synthetic_wav(duration=1.2)
    response = client.post(
        "/assess-pronunciation",
        data={"exerciseId": "ka-ki"},
        files={"audio": ("sequence.wav", io.BytesIO(wav_bytes), "audio/wav")}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["result"] == "UNCERTAIN"

def test_model_unavailable_safety_behavior(monkeypatch):
    original_state = model_instance.is_available
    try:
        model_instance.is_available = False
        wav_bytes = create_synthetic_wav(duration=0.8)
        response = client.post(
            "/assess-pronunciation",
            data={"exerciseId": "ex-qaf-ka-01"},
            files={"audio": ("test.wav", io.BytesIO(wav_bytes), "audio/wav")}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["result"] == "UNCERTAIN"
        assert data["confidence"] == 0.0
        assert "unavailable" in data["reason"].lower()
    finally:
        model_instance.is_available = original_state

def test_low_confidence_boundary_returns_uncertain():
    # Force evaluation in the uncertainty band
    samples = [0.1 * math.sin(i) for i in range(16000)]
    assessment = model_instance.evaluate(samples, "ex-qaf-ka-01", force_low_confidence=True)
    assert assessment["result"] == "UNCERTAIN"
