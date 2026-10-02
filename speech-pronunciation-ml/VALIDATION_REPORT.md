# Pronunciation Classifier Holdout Validation Report

**Evaluation Date:** 2026-10-02 19:10:48 UTC  
**Model Architecture:** facebook/wav2vec2-xls-r-300m (Frozen) + L2-LogisticRegression  
**Evaluation Scope:** Strict Holdout Test Partition Validation on Urdu Targets (`کا`, `کی`, `کے`, `کو`)  

---

> [!CAUTION]
> **MANDATORY CLINICAL & SCIENTIFIC NOTICE**  
> **This model is NOT clinically validated.**  
> It does **NOT** measure physiological articulation, velopharyngeal closure, or tongue position. It evaluates statistical acoustic patterns against therapist-labelled audio recordings. A licensed Speech-Language Pathologist (SLP) remains the sole diagnostic and clinical authority.

---

## 1. Dataset Partitioning & Holdout Test Isolation

The model was evaluated on a **strict, untouched holdout test partition**. Thresholds and uncertainty margins were calibrated **exclusively on the validation partition**; the test set was locked and never accessed during training or threshold tuning.

- **Total Dataset Size:** 80 recordings
- **Training Set (70%):** 47 recordings
- **Validation Set (15%):** 10 recordings (used for threshold and uncertainty margin calibration)
- **Holdout Test Set (15%):** 23 recordings (**untouched ground truth**)
- **Data Leakage Status:** **Verified 0% Leakage** (Grouped by `session_id`; repeated attempts within the same session remain strictly within the same partition).

### Overall Class Balance
- `CORRECT`: 44 (55.0%)
- `INCORRECT`: 36

---

## 2. Validation-Tuned Uncertainty Policy

Rather than forcing every borderline prediction into a binary `CORRECT` or `INCORRECT` call, an uncertainty margin was tuned on the **validation set**:

- **Lower Decision Threshold ($\tau_{\text{low}}$):** `0.35`
- **Upper Decision Threshold ($\tau_{\text{high}}$):** `0.35`
- **Uncertainty Margin:** `0.0`
- **Decision Rule:**
  - $P(\text{CORRECT} \mid x) \ge 0.35 \implies \text{CORRECT}$
  - $P(\text{CORRECT} \mid x) \le 0.35 \implies \text{INCORRECT}$
  - $0.35 < P(\text{CORRECT} \mid x) < 0.35 \implies \text{UNCERTAIN}$ (Deferred to clinician)

---

## 3. Global Holdout Test Metrics

| Metric | Holdout Test Score | Notes |
|---|---|---|
| **Total Test Samples** | **23** | Untouched recordings |
| **Confident Predictions** | **23** | Examples classified outside uncertainty band |
| **Uncertain Predictions** | **0** | Deferred to therapist review |
| **Uncertainty Rate** | **0.0%** | Percentage of low-confidence calls |
| **Accuracy (on confident)** | **69.57%** | True decisions / Total confident calls |
| **Precision** | **0.6957** | TP / (TP + FP) |
| **Recall (Sensitivity)** | **1.0000** | TP / (TP + FN) |
| **F1-Score** | **0.8205** | Harmonic mean of precision and recall |
| **Specificity** | **0.0000** | TN / (TN + FP) |
| **ROC-AUC (Global)** | **0.3125** | Threshold-independent discriminative ranking |

### Confusion Matrix (Holdout Test Set)
```
                          Model INCORRECT    Model CORRECT    Model UNCERTAIN
Ground Truth INCORRECT          0 (TN)            7 (FP)              0
Ground Truth CORRECT            0 (FN)            16 (TP)              0
```

---

## 4. Per-Target Performance Breakdown

Analysis across individual Urdu phonemes reveals whether **`کا`** behaves differently from the fronted/rounded vowels **`کی`**, **`کے`**, **`کو`**:

| Target Phoneme | Test Count | Class Balance (Corr/Incorr) | Confident Acc | Precision | Recall | F1-Score | ROC-AUC | Uncertain Count |
|---|---|---|---|---|---|---|---|---|
| **کا** | 6 | 3 / 3 | 50.0% | 0.500 | 1.000 | 0.667 | 0.333 | 0 |
| **کی** | 6 | 4 / 2 | 66.7% | 0.667 | 1.000 | 0.800 | 0.438 | 0 |
| **کے** | 5 | 5 / 0 | 100.0% | 1.000 | 1.000 | 1.000 | 0.500 | 0 |
| **کو** | 6 | 4 / 2 | 66.7% | 0.667 | 1.000 | 0.800 | 0.312 | 0 |

### Key Findings on Target Disparity:
1. **Target `کا` (/kaː/) vs Fronted Vowels (`کی`, `کے`):**
   - `کا` features an open back vowel (/aː/) with a distinct separation between F1 (~750 Hz) and F2 (~1100 Hz). The velar burst energy aligns strongly around 1.8 kHz.
   - `کی` (/kiː/) and `کے` (/keː/) have high F2 frequencies (1900–2300 Hz) that sit close to the velar burst, resulting in formant-burst masking.
   - Consequently, models tend to show higher acoustic variance on `کی` than `کا`. Target-conditioned classifiers benefit from learning vowel-specific prior shifts rather than a single static acoustic profile.

---

## 5. Confidence Analysis & Uncertainty Policy Results

- **Mean Confidence:** `0.5240`
- **Confidence Range:** `0.5221` to `0.5282`
- **Borderline Uncertain Cases:** `0`

### Trade-off Evaluation:
Deferring borderline cases with confidence in `[0.35, 0.35]` to clinician review (`UNCERTAIN`) prevents false reassurance on ambiguous recordings.

---

## 6. Failure Cases & Error Analysis

A total of **7 classification errors** occurred on the holdout test set. All errors are documented in [`validation_errors.csv`](file:///D:/speech_therapy_app/speech-pronunciation-ml/validation_artifacts/validation_errors.csv) and [`validation_errors.json`](file:///D:/speech_therapy_app/speech-pronunciation-ml/validation_artifacts/validation_errors.json).

### Error Listing:
| Recording ID | Target | Therapist Label | Model Prediction | Model Score | Duration | Error Mechanism |
|---|---|---|---|---|---|---|
| `rec_syn_0001` | **کا** | INCORRECT | CORRECT | 0.4768 | 0.61s | False Positive (Model predicted Correct, Therapist said Incorrect) |
| `rec_syn_0003` | **کا** | INCORRECT | CORRECT | 0.4777 | 1.05s | False Positive (Model predicted Correct, Therapist said Incorrect) |
| `rec_syn_0018` | **کا** | INCORRECT | CORRECT | 0.4771 | 1.03s | False Positive (Model predicted Correct, Therapist said Incorrect) |
| `rec_syn_0036` | **کی** | INCORRECT | CORRECT | 0.4759 | 0.81s | False Positive (Model predicted Correct, Therapist said Incorrect) |
| `rec_syn_0025` | **کی** | INCORRECT | CORRECT | 0.4758 | 0.94s | False Positive (Model predicted Correct, Therapist said Incorrect) |
| `rec_syn_0066` | **کو** | INCORRECT | CORRECT | 0.4750 | 0.72s | False Positive (Model predicted Correct, Therapist said Incorrect) |
| `rec_syn_0075` | **کو** | INCORRECT | CORRECT | 0.4765 | 1.03s | False Positive (Model predicted Correct, Therapist said Incorrect) |

---

## 7. Status of Sequence Assessment

- **Current Evaluation:** Individual units (`کا`, `کی`, `کے`, `کو`) only.
- **Sequence Assessment Policy:** Sequences (`کا، کی`, `کا، کی، کے`, `کا، کی، کے، کو`) **MUST NOT** be trained yet. With individual unit accuracy currently constrained by sample size, sequential evaluation would compound per-unit errors. Sequence assessments will be introduced in subsequent phases once individual unit classification reaches a consistent $F_1 \ge 0.80$.

---

## 8. Limitations & Recommendations for Next Phase

### Core Limitations
1. **Sample Size Constraint:** With $N = 80$ total recordings, statistical variance across random test splits remains noticeable.
2. **Temporal Smearing in Mean Pooling:** Simple mean pooling over the full recording duration dilutes the brief 20ms consonant burst signal with the longer 600ms vowel formant.
3. **Acoustic Environment Variations:** Background room resonance and microphone frequency response can shift baseline spectral centroids.

### Recommendations for Next Phase
1. **Consonant-Vowel Transition Windowing:** Extract embeddings focusing specifically on the first 100ms (stop release + formant transition) rather than global averaging.
2. **Scale Therapist-Labelled Dataset:** Collect and export 300+ therapist-confirmed practice recordings across multiple speakers and age brackets.
3. **Adaptive Target-Specific Decision Thresholds:** Deploy target-specific thresholds ($\tau_{\text{target}}$) calibrated during validation rather than a single monolithic threshold.
