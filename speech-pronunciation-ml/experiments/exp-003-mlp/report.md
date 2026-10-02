# Experiment Report: exp-003-mlp

**Date:** 2026-10-02T18:58:42.463632Z  
**Feature Extractor:** facebook/wav2vec2-xls-r-300m (Frozen + Mean Temporal Pooling)  
**Classifier:** SmallMLP (1024 -> 64 -> 1, ReLU)  
**Dataset Version:** 1  

---

## 1. Dataset Partitioning
- **Train Examples:** 48
- **Validation Examples:** 9
- **Test Examples:** 15
- **Total:** 72
- **Class Balance (Test):** {'positive_count_correct': 7, 'negative_count_incorrect': 8, 'positive_ratio': 0.4667}

---

## 2. Test Evaluation Metrics
- **Accuracy:** 46.67%
- **Precision:** 0.4667
- **Recall:** 1.0000
- **F1-Score:** 0.6364
- **ROC-AUC:** 0.5446
- **Specificity:** 0.0000

---

## 3. Confusion Matrix
| Ground Truth \ Prediction | INCORRECT (Pred 0) | CORRECT (Pred 1) |
|---|---|---|
| **INCORRECT (Actual 0)** | TN: 0 | FP: 8 |
| **CORRECT (Actual 1)** | FN: 0 | TP: 7 |

---

## 4. Error Analysis
- **Total Test Errors:** 8
- **False Positives:** 8 (Therapist said Incorrect, model predicted Correct)
- **False Negatives:** 0 (Therapist said Correct, model predicted Incorrect)
- **Borderline Uncertain Cases:** 15

---

## 5. Notes & Observations
Non-linear decision boundary via small MLP (hidden layer 64 with ReLU) on top of frozen 1024-dimensional XLS-R representations.
