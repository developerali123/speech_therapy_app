"""
FastAPI application for speech pronunciation assessment service.
Exposes POST /assess-pronunciation for React application integration.
"""

from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import logging

from .audio_processor import AudioProcessor, AudioProcessingError
from .model import PronunciationModel

logger = logging.getLogger("speech_pronunciation_service")
logging.basicConfig(level=logging.INFO)

app = FastAPI(
    title="Speech Pronunciation ML Service",
    description="Automated pronunciation quality assessment for Urdu speech therapy practice",
    version="1.0.0"
)

# Enable CORS for local React development and preview servers
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model instance
model_instance = PronunciationModel(is_available=True)

class UnitResultItem(BaseModel):
    unit: str
    score: float
    result: str

class PronunciationResponse(BaseModel):
    exerciseId: str
    targetText: str
    result: str
    confidence: float
    pronunciationScore: float
    modelVersion: str
    unitResults: List[UnitResultItem]
    reason: Optional[str] = None

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "speech-pronunciation-service",
        "version": "1.0.0",
        "model_available": model_instance.is_available
    }

@app.post("/assess-pronunciation", response_model=PronunciationResponse)
async def assess_pronunciation(
    audio: UploadFile = File(...),
    exerciseId: str = Form(...)
):
    """
    Evaluates pronunciation of a speech audio recording against therapist target.
    
    Safety Rules:
    If audio decoding fails, target unsupported, model unavailable,
    or service error occurs, strictly returns 'UNCERTAIN'.
    Never fabricates a pronunciation verdict.
    """
    target_text = model_instance.get_target_for_exercise(exerciseId) or ""

    # 1. Read uploaded audio payload
    try:
        raw_bytes = await audio.read()
    except Exception as e:
        logger.error(f"Failed to read uploaded audio bytes: {e}")
        return PronunciationResponse(
            exerciseId=exerciseId,
            targetText=target_text,
            result="UNCERTAIN",
            confidence=0.0,
            pronunciationScore=0.0,
            modelVersion=model_instance.MODEL_VERSION,
            unitResults=[],
            reason="Failed to read audio data."
        )

    # 2. Audio decoding and standardization
    try:
        processed = AudioProcessor.process(raw_bytes)
        samples = processed["samples"]
    except AudioProcessingError as ape:
        logger.warning(f"Audio processing rejected: {ape}")
        return PronunciationResponse(
            exerciseId=exerciseId,
            targetText=target_text,
            result="UNCERTAIN",
            confidence=0.0,
            pronunciationScore=0.0,
            modelVersion=model_instance.MODEL_VERSION,
            unitResults=[],
            reason=f"Audio decoding rejected: {str(ape)}"
        )
    except Exception as e:
        logger.error(f"Unexpected audio decoding error: {e}")
        return PronunciationResponse(
            exerciseId=exerciseId,
            targetText=target_text,
            result="UNCERTAIN",
            confidence=0.0,
            pronunciationScore=0.0,
            modelVersion=model_instance.MODEL_VERSION,
            unitResults=[],
            reason="Unexpected audio decoding failure."
        )

    # 3. Model evaluation
    try:
        assessment = model_instance.evaluate(samples, exerciseId)
        return PronunciationResponse(**assessment)
    except Exception as e:
        logger.error(f"Model evaluation error: {e}")
        return PronunciationResponse(
            exerciseId=exerciseId,
            targetText=target_text,
            result="UNCERTAIN",
            confidence=0.0,
            pronunciationScore=0.0,
            modelVersion=model_instance.MODEL_VERSION,
            unitResults=[],
            reason="Internal assessment evaluation error."
        )
