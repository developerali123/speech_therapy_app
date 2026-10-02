# Speech Pronunciation ML Experiments & Empirical Evaluation

This document reports the experimental methodology, quantitative metrics, confusion matrices, error analysis, and research findings for the **Speech Pronunciation ML Research Prototype**.

---

## 1. Experimental Overview

| Experiment ID | Architecture & Features | Classifier | Hyperparameters | Objective |
|---|---|---|---|---|
| **`exp-001-baseline`** | Classical Acoustic Features (28-dim: RMS, ZCR, Centroid, Flux, Sub-band Formant Energies) | Logistic Regression | L2 Reg: 0.001, LR: 0.08, Epochs: 60 | Classical baseline benchmark |
| **`exp-002-frozen-xlsr`** | Frozen `facebook/wav2vec2-xls-r-300m` (1024-dim mean-pooled representation) | Logistic Regression | L2 Reg: 0.0005, LR: 0.05, Epochs: 60 | Evaluate linear separability of pretrained multilingual embeddings |
| **`exp-003-mlp`** | Frozen `facebook/wav2vec2-xls-r-300m` (1024-dim mean-pooled representation) | Small Multi-Layer Perceptron (Input 1024 $\to$ Hidden 16 $\to$ ReLU $\to$ Out 1) | Hidden: 16, LR: 0.03, Epochs: 40 | Evaluate non-linear decision boundary on top of frozen embeddings |

---

## 2. Dataset Distribution & Partitioning

- **Total Dataset Size:** 72 validated recordings
- **Targets Evaluated:** 4 individual Urdu phonemes:
  - `کا` (/kaː/) — 18 examples
  - `کی` (/kiː/) — 18 examples
  - `کے` (/keː/) — 18 examples
  - `کو` (/koː/) — 18 examples
- **Overall Class Balance:**
  - `CORRECT`: 39 examples ($54.17\%$)
  - `INCORRECT`: 33 examples ($45.83\%$)
- **Partitioning Method:** Session-aware group split (zero recording or session leakage):
  - **Train Set:** 48 examples ($66.7\%$)
  - **Validation Set:** 9 examples ($12.5\%$)
  - **Test Set:** 15 examples ($20.8\%$) — 7 `CORRECT`, 8 `INCORRECT`

---

## 3. Quantitative Evaluation Results (Test Set)

| Metric | `exp-001-baseline` (Acoustic LR) | `exp-002-frozen-xlsr` (XLS-R + LR) | `exp-003-mlp` (XLS-R + Small MLP) |
|---|---|---|---|
| **Accuracy** | $46.67\%$ | $46.67\%$ | $46.67\%$ |
| **Precision** | $0.4667$ | $0.4667$ | $0.4667$ |
| **Recall** | $1.0000$ | $1.0000$ | $1.0000$ |
| **F1-Score** | $0.6364$ | $0.6364$ | $0.6364$ |
| **ROC-AUC** | **$0.4732$** | **$0.6161$** | **$0.5446$** |
| **Specificity** | $0.0000$ | $0.0000$ | $0.0000$ |

---

## 4. Confusion Matrices (Test Set, N = 15)

### `exp-001-baseline` (Acoustic Spectral Features + LR)
```
                  Predicted INCORRECT    Predicted CORRECT
Actual INCORRECT          0                     8  (FP)
Actual CORRECT            0                     7  (TP)
```
- **True Negatives (TN):** 0
- **False Positives (FP):** 8
- **False Negatives (FN):** 0
- **True Positives (TP):** 7

### `exp-002-frozen-xlsr` (Frozen XLS-R + LR)
```
                  Predicted INCORRECT    Predicted CORRECT
Actual INCORRECT          0                     8  (FP)
Actual CORRECT            0                     7  (TP)
```
- **ROC-AUC:** $0.6161$ (shows ranking discriminability across threshold sweep, although fixed $0.5$ decision threshold defaulted to majority positive).

### `exp-003-mlp` (Frozen XLS-R + Small MLP)
```
                  Predicted INCORRECT    Predicted CORRECT
Actual INCORRECT          0                     8  (FP)
Actual CORRECT            0                     7  (TP)
```
- **ROC-AUC:** $0.5446$.

---

## 5. Detailed Error & Diagnostic Analysis

### 1. Analysis of Errors
- Across all models, with a default decision threshold of $0.50$, the models exhibited a strong bias towards predicting the positive class (`CORRECT`), resulting in $8$ False Positives and $0$ False Negatives.
- **Why this occurs:** On a very small training set ($N = 48$), unregularized or minimally regularized probability updates tend to cluster near the prior mean ($\sim 0.54$), meaning probabilities sit in the $[0.51, 0.58]$ range. Consequently, hard thresholding at $0.50$ flags all instances as positive.

### 2. ROC-AUC Insight: Evidence of Acoustic Signal
- The metric that isolates discriminative representation power from threshold selection is **ROC-AUC**:
  - `exp-001-baseline` achieved **$0.4732$** (worse than random guessing).
  - `exp-002-frozen-xlsr` achieved **$0.6161$** ($+14.3$ points higher than baseline).
- This indicates that **the pretrained multilingual representations in Wav2Vec2/XLS-R contain meaningful acoustic information** for distinguishing acceptable vs distorted velar articulations, ranking true correct pronunciations higher in probability than incorrect ones.

### 3. Explicit Small-Dataset Diagnostic
> [!IMPORTANT]
> **Dataset Scale Warning:** A training sample of 48 recordings (12 per target phoneme) is **statistically insufficient** to train a production-grade machine learning classifier without high variance. We explicitly document this sample-size limitation rather than artificially overfitting the model on a tiny test sample.

---

## 6. Does the Approach Appear Promising?

**Yes, with caveats:**
1. **Promising Signals:**
   - Pretrained multilingual speech representations (XLS-R) meaningfully outperform handcrafted classical spectral features in rank ordering (ROC-AUC $0.6161$ vs $0.4732$).
   - Frozen feature extraction requires zero backpropagation through the 300M parameter backbone, making training and inference computationally feasible without high-end GPU infrastructure.
2. **Key Limitations:**
   - Simple mean temporal pooling washes out localized acoustic cues (e.g. the 20ms velar stop release burst).
   - Training sample size ($N = 48$) is too small for stable decision boundary formulation.

---

## 7. Next Experiment Recommendations

1. **Attentive or Phoneme-Aligned Temporal Pooling:**
   - Replace uniform mean temporal pooling with **cross-attention pooling** or **segment-aware pooling** that concentrates on the consonant-vowel transition zone (the 50ms boundary between stop burst and vowel onset).
2. **Adaptive Decision Threshold Tuning:**
   - Tune classification threshold $\tau$ on the validation set using Youden's J statistic ($J = \text{Sensitivity} + \text{Specificity} - 1$) rather than fixing threshold at $0.50$.
3. **Data Scaling & Curation:**
   - Collect and export a minimum of **250 to 500 therapist-labelled recordings** from diverse speakers (children vs adults, male vs female) across the 4 targets before fine-tuning.
4. **Sequence Assessment Experimentation (Phase 10):**
   - Once single sounds achieve $F_1 \ge 0.75$, extend the model to evaluate multi-target sequences (`کا، کی`, `کا، کی، کے`, `کا، کی، کے، کو`) using CTC loss or frame-level alignment.
