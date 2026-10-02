# Experiment Report: exp-002-frozen-xlsr

**Date:** 2026-10-02T18:58:34.041240Z  
**Feature Extractor:** facebook/wav2vec2-xls-r-300m (Frozen + Mean Temporal Pooling)  
**Classifier:** LogisticRegression  
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
- **ROC-AUC:** 0.6161
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
Pretrained multilingual speech representation (XLS-R 300M) frozen feature extractor with mean temporal pooling into a 1024-dimensional embedding and linear probabilistic classifier.
