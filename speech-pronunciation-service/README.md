# Speech Pronunciation ML Assessment Service

A dedicated Python FastAPI microservice that evaluates pronunciation of speech therapy target sounds against therapist reference patterns.

## Supported Single Targets
- **`کا`** (`ex-qaf-ka-01`, `ka`)
- **`کی`** (`ki`)
- **`کے`** (`ke`)
- **`کو`** (`ko`)

> [!NOTE]
> Ordered sequences (`کا، کی`, `کا، کی، کے`, `کا، کی، کے، کو`) are deliberately deferred until single-unit classifiers reach sufficient clinical reliability. Unsupported exercises safely return `UNCERTAIN`.

---

## Safety Policy & Fail-Safe Architecture
The service strictly abides by safety requirements:
1. **Never fabricate a pronunciation result.**
2. If:
   - The ML model is unavailable
   - Audio decoding fails (corrupted headers, invalid duration, etc.)
   - The exercise / phoneme target is unsupported
   - Posterior confidence is too low (inside the uncertainty margin)
   - An internal error occurs
   
   The service returns **`UNCERTAIN`** with detailed reasons.
3. **No Clinical Claims:** This service does not measure physiological articulation, velopharyngeal closure, or tongue position. A licensed Speech-Language Pathologist (SLP) remains the sole clinical authority.

---

## API Specification

### `GET /health`
Returns service status and model availability.

### `POST /assess-pronunciation`
Evaluates an uploaded speech audio attempt.

- **Content-Type:** `multipart/form-data`
- **Parameters:**
  - `audio`: Audio file (16-bit PCM WAV preferred, min duration 0.20s)
  - `exerciseId`: String identifier of the practice exercise

#### Example Response
```json
{
  "exerciseId": "ex-qaf-ka-01",
  "targetText": "کا",
  "result": "CORRECT",
  "confidence": 0.91,
  "pronunciationScore": 0.87,
  "modelVersion": "xlsr-v1.0-linear",
  "unitResults": [
    {
      "unit": "کا",
      "score": 0.87,
      "result": "CORRECT"
    }
  ]
}
```

Possible values for `result`:
- `CORRECT`
- `NEEDS_PRACTICE`
- `UNCERTAIN`

---

## Running the Service Locally

```bash
cd speech-pronunciation-service
pip install -r requirements.txt
uvicorn src.app:app --host 127.0.0.1 --port 8000 --reload
```

## Running Tests
```bash
cd speech-pronunciation-service
python -m pytest tests/ -v
```
