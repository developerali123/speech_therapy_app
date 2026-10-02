# Dataset Specification & Ground Truth Policy

This document defines the data architecture, clinical ground truth policies, validation standards, and partitioning methodology for the **Speech Pronunciation ML Research Prototype**.

---

## 1. Ground Truth Policy

### Strict Clinical Assessment Rule
1. **Therapist Authority:** Only recordings confirmed by a licensed speech therapist (`CORRECT` or `INCORRECT`) serve as training labels.
2. **Automatic Application Disqualification:** Automated algorithmic results produced by client-side pitch or spectral detectors **MUST NEVER** be treated as training ground truth. Doing so would train the ML model on its own automated heuristic errors (model collapse).
3. **Exclusion of Uncertain Cases:** Recordings marked `UNCERTAIN` by a therapist are excluded from training by default to maintain label purity.
4. **Manual Therapist Exclusions:** Recordings flagged for environmental defects are excluded with the logged clinical reason:
   - `background noise`
   - `cough`
   - `interruption`
   - `microphone problem`
   - `wrong exercise`
   - `accidental recording`
   - `poor audio`
   - `other`

---

## 2. Target Phonemes & Phonetic Objectives

The dataset models Urdu speech therapy targets focusing on velar stop consonant articulation (/k/) paired with distinct vowels:

| Target Text | Urdu Transcription | Target Phonemes | IPA Representation | Articulatory Features |
|---|---|---|---|---|
| **کا** | Ka | /k/ + /aː/ | [kaː] | Voiceless velar stop + Open back unrounded vowel |
| **کی** | Ki | /k/ + /iː/ | [kiː] | Voiceless velar stop + Close front unrounded vowel |
| **کے** | Ke | /k/ + /eː/ | [keː] | Voiceless velar stop + Close-mid front unrounded vowel |
| **کو** | Ko | /k/ + /oː/ | [koː] | Voiceless velar stop + Close-mid back rounded vowel |

### Planned Sequence Targets (Future Phases)
- **کا، کی** (`ka-ki`): Two-phoneme ordered sequence
- **کا، کی، کے** (`ka-ki-ke`): Three-phoneme ordered sequence
- **کا، کی، کے، کو** (`ka-ki-ke-ko`): Four-phoneme complete vowel progression

---

## 3. Metadata Schema

Each training record conforms to the following schema:

```json
{
  "recording_id": "rec_001",
  "exercise_id": "ka",
  "target_text": "کا",
  "target_units": ["کا"],
  "therapist_label": "CORRECT",
  "audio_path": "audio/rec_001.wav",
  "duration": 0.85,
  "speaker_id": "child_01",
  "session_id": "sess_2026_10_01_a",
  "created_at": "2026-10-01T10:00:00Z",
  "therapist_remarks": "Clean velar release without dental substitution",
  "audio_quality": {
    "sample_rate": 16000,
    "channel_count": 1,
    "format": "float32_pcm_16k_mono",
    "peak_amplitude": 0.95,
    "rms": 0.124,
    "silence_percentage": 14.5
  }
}
```

---

## 4. Audio Quality & Validation Rules

Before ingestion into the feature extraction pipeline:
1. **Minimum Duration:** Audio must be $\ge 0.20$ seconds. Shorter recordings are rejected.
2. **Maximum Duration:** Audio must be $\le 15.0$ seconds.
3. **Decoding Validation:** Audio must be valid PCM (RIFF/WAVE header verified). Compressed containers (WebM, Ogg, MP3) must be decoded before ingestion; attempting to read compressed audio as raw PCM raises an explicit `AudioValidationError`.
4. **Resampling:** All audio is converted to **16,000 Hz** mono floating point in $[-1.0, 1.0]$.
5. **Amplitude Normalization:** Peak amplitude is scaled to $0.95$ to eliminate recording volume disparity between microphones.
6. **Silence / Noise Floor Check:** Files with $> 96\%$ silence and near-zero energy are rejected.

---

## 5. Partitioning & Leakage Prevention

To ensure valid scientific evaluation:
- **Group Key:** Data is grouped by `session_id`. When available, `speaker_id` takes precedence.
- **Atomic Allocation:** An entire practice session (e.g. 5 repeated attempts of "کا") is assigned to **exactly one partition**:
  - **Train:** $70\%$
  - **Validation:** $15\%$
  - **Test:** $15\%$
- **Verification:** An automated validator (`DataSplitter.verify_no_leakage`) asserts that the intersection of recordings and sessions between train, validation, and test is empty.

---

## 6. Privacy & Data Governance

- **Zero Remote Upload:** Audio recordings are stored locally on device in IndexedDB and exported solely when the user explicitly requests an export.
- **De-identification:** Speaker identifiers are pseudonymous tokens (e.g. `spk_01`, `child_04`) with no personally identifiable information (PII).
