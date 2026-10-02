# Speech Pronunciation ML Research Prototype

An experimental machine learning research project evaluating pretrained multilingual speech representations for pronunciation assessment in speech therapy practice.

> **CRITICAL CLINICAL & SCIENTIFIC DISCLAIMER**  
> - **No Claim of Clinical Accuracy:** This research prototype does **NOT** provide medical or clinical diagnostic accuracy.  
> - **No Articulatory Tracking:** This model does **NOT** detect tongue placement, contact points, or velopharyngeal mechanics. It only evaluates acoustic wave patterns and statistical correlations against therapist-labelled audio examples.  
> - **Non-Replacement of Clinician:** A speech-language pathologist remains the sole diagnostic and clinical authority.

---

## 1. Project Goal

Given:
1. Standardized Audio Recording (16 kHz, mono, floating-point PCM)
2. Target Phoneme (Expected Sound: `کا`, `کی`, `کے`, `کو`, and future sequences `کا، کی`, `کا، کی، کے`, `کا، کی، کے، کو`)

Predict:
- **Pronunciation Quality:** Binary classification (`CORRECT` vs `INCORRECT`)
- **Therapist-Style Label:** Ground truth adherence
- **Confidence Score:** Posterior probability $P(\text{CORRECT} \mid \text{audio}, \text{target}) \in [0.0, 1.0]$

This task is fundamentally **different from speech-to-text (ASR)**. Standard ASR models are trained to be invariant to pronunciation variations and acoustic disfluencies. This pronunciation assessment model evaluates **articulation quality** against clinical judgments.

---

## 2. Model Architecture & Strategy

Rather than training a 300M parameter model end-to-end on a small speech therapy dataset, this project investigates a **frozen feature extraction paradigm**:

```
Raw Audio (Mono, 16 kHz Float PCM)
   │
   ▼
Pretrained Multilingual Speech Encoder (`facebook/wav2vec2-xls-r-300m`)
   │  [Frozen weights — No gradient updates to backbone]
   ▼
Temporal Frame Representations ($H \in \mathbb{R}^{T \times 1024}$)
   │
   ▼
Temporal Mean Pooling ($e = \frac{1}{T} \sum_{t=1}^T h_t \in \mathbb{R}^{1024}$)
   │
   ▼
Lightweight Classification Head
   ├── Experiment 1: Classical Acoustic Baseline + Logistic Regression
   ├── Experiment 2: Frozen XLS-R 1024-dim Embeddings + Logistic Regression / Linear
   └── Experiment 3: Frozen XLS-R 1024-dim Embeddings + Small MLP (Hidden 16, ReLU)
   │
   ▼
Prediction: CORRECT / INCORRECT with Calibrated Probability
```

---

## 3. Audio Standardization Pipeline

Every recording undergoes strict validation before feature extraction:
- **Container Format:** Standard PCM WAV (rejection of compressed WebM/MP3 containers without proper decoding).
- **Channels:** Single-channel mono (stereo channels downmixed via $0.5 \times (L + R)$).
- **Sampling Rate:** Standardized to **16,000 Hz** via linear resampler.
- **Data Type:** 32-bit floating point PCM normalized to $[-1.0, 1.0]$.
- **Amplitude Normalization:** Peak normalized to $0.95$, preventing clipping and volume bias.
- **Integrity Validation:** Rejection of empty, sub-minimum ($< 0.20$s), or pure background noise files.

---

## 4. Leakage Prevention: Session-Aware Partitioning

Speech practice apps record repeated attempts of the same target within a single therapy session. Randomly splitting attempts into train and test leads to **catastrophic data leakage**, where near-identical audio from the same child/session appears in both sets.

This project implements **Session-Aware Splitting**:
- Grouping is performed by `session_id` (or `speaker_id`).
- All attempts from a session are assigned atomically to either **Train (70%)**, **Validation (15%)**, or **Test (15%)**.
- Data leakage verification checks ensure $0\%$ overlap between partitions.

---

## 5. Directory Structure

```
speech-pronunciation-ml/
├── README.md                      # Architecture overview and clinical disclaimer
├── DATASET.md                     # Ground truth schema, validation, and curation rules
├── EXPERIMENTS.md                 # Empirical results, metrics, and error analysis
├── requirements.txt               # Dependencies
├── src/
│   ├── audio/
│   │   ├── validator.py           # Header validation and corruption detection
│   │   └── normalizer.py          # Mono downmix, 16kHz resample, amplitude normalizer
│   ├── data/
│   │   ├── schema.py              # Data classes and clinical ground truth rules
│   │   ├── dataset_loader.py      # React export JSON & CSV ingestion
│   │   ├── splitter.py            # Session-aware train/val/test splitting
│   │   └── synthetic_generator.py # Formant-based benchmark acoustic generator
│   ├── features/
│   │   ├── xlsr_extractor.py      # Frozen XLS-R 300M mean-pooled extractor (1024-dim)
│   │   └── acoustic_baseline.py   # 28-dim spectral centroid, flux, and formant baseline
│   ├── models/
│   │   ├── classifiers.py         # Logistic Regression, Linear, SVM, Small MLP
│   │   └── evaluator.py           # Precision, Recall, F1, ROC-AUC, Confusion Matrix
│   └── experiments/
│       ├── tracker.py             # Experiment JSON & Markdown logger
│       └── run_experiment.py      # Suite runner CLI
├── experiments/                   # Experiment artifacts
│   ├── exp-001-baseline/
│   ├── exp-002-frozen-xlsr/
│   └── exp-003-mlp/
└── tests/
    ├── test_audio_normalizer.py   # Audio normalization unit tests
    ├── test_dataset_loader.py     # Ground truth validation unit tests
    ├── test_splitter.py           # Leakage prevention unit tests
    └── test_models.py             # Classifiers & metrics unit tests
```

---

## 6. How to Run

### Run Unit Tests
```bash
python -m unittest discover -s tests -p "test_*.py"
```

### Run Benchmark Experiment Suite
```bash
# Uses generated benchmark dataset across کا, کی, کے, کو
python src/experiments/run_experiment.py

# Or run with an exported dataset from the React Speech Practice Assistant
python src/experiments/run_experiment.py --data path/to/speech-practice-ml-dataset.json
```
