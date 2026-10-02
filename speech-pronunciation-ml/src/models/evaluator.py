"""
Comprehensive Model Evaluation and Error Analysis Module.
Calculates:
- Accuracy, Precision, Recall, F1-Score
- Confusion Matrix (TN, FP, FN, TP)
- ROC-AUC
- Class balance metrics
- Error and uncertainty analysis across confidence thresholds
"""

import math
from typing import List, Dict, Any, Tuple, Optional

class ModelEvaluator:
    """
    Evaluates pronunciation classifier predictions against therapist ground truth labels.
    """

    @classmethod
    def compute_metrics(
        cls,
        y_true: List[int],
        y_prob: List[float],
        threshold: float = 0.5,
        target_texts: Optional[List[str]] = None
    ) -> Dict[str, Any]:
        """
        Computes all standard binary classification metrics,
        confusion matrix, ROC-AUC, and error breakdown.
        """
        if not y_true or not y_prob or len(y_true) != len(y_prob):
            return {
                'accuracy': 0.0,
                'precision': 0.0,
                'recall': 0.0,
                'f1': 0.0,
                'roc_auc': 0.5,
                'total_samples': 0
            }

        y_pred = [1 if p >= threshold else 0 for p in y_prob]
        n = len(y_true)

        tp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 1)
        tn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 0)
        fp = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 0 and yp == 1)
        fn = sum(1 for yt, yp in zip(y_true, y_pred) if yt == 1 and yp == 0)

        # Standard Metrics
        accuracy = (tp + tn) / n if n > 0 else 0.0
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0.0
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0.0
        f1 = (2 * precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0

        # Specificity
        specificity = tn / (tn + fp) if (tn + fp) > 0 else 0.0

        # ROC-AUC calculation (trapezoidal integration over sorted threshold sweep)
        roc_auc = cls._calculate_roc_auc(y_true, y_prob)

        # Class Balance
        total_pos = sum(y_true)
        total_neg = n - total_pos
        class_balance = {
            'positive_count_correct': total_pos,
            'negative_count_incorrect': total_neg,
            'positive_ratio': round(total_pos / n, 4) if n > 0 else 0.0
        }

        # Error & Uncertainty Analysis
        false_positives: List[Dict[str, Any]] = []
        false_negatives: List[Dict[str, Any]] = []
        uncertain_count = 0

        for idx, (yt, yp, prob) in enumerate(zip(y_true, y_pred, y_prob)):
            target = target_texts[idx] if target_texts and idx < len(target_texts) else 'unknown'
            
            # Borderline confidence between 0.40 and 0.60
            if 0.40 <= prob <= 0.60:
                uncertain_count += 1

            if yt == 0 and yp == 1:
                false_positives.append({
                    'index': idx,
                    'target': target,
                    'predicted_prob': prob,
                    'type': 'False Positive (Predicted Correct, Therapist marked Incorrect)'
                })
            elif yt == 1 and yp == 0:
                false_negatives.append({
                    'index': idx,
                    'target': target,
                    'predicted_prob': prob,
                    'type': 'False Negative (Predicted Incorrect, Therapist marked Correct)'
                })

        # Target-specific breakdown
        target_breakdown = {}
        if target_texts:
            t_counts = {}
            t_correct = {}
            for t, yt, yp in zip(target_texts, y_true, y_pred):
                t_counts[t] = t_counts.get(t, 0) + 1
                if yt == yp:
                    t_correct[t] = t_correct.get(t, 0) + 1
            for t, total in t_counts.items():
                acc = t_correct.get(t, 0) / total if total > 0 else 0.0
                target_breakdown[t] = {
                    'total': total,
                    'correct': t_correct.get(t, 0),
                    'accuracy': round(acc, 4)
                }

        return {
            'total_samples': n,
            'accuracy': round(accuracy, 4),
            'precision': round(precision, 4),
            'recall': round(recall, 4),
            'f1_score': round(f1, 4),
            'specificity': round(specificity, 4),
            'roc_auc': round(roc_auc, 4),
            'class_balance': class_balance,
            'confusion_matrix': {
                'tp': tp,
                'tn': tn,
                'fp': fp,
                'fn': fn,
                'matrix_2x2': [
                    [tn, fp],
                    [fn, tp]
                ],
                'labels': ['INCORRECT', 'CORRECT']
            },
            'error_analysis': {
                'total_errors': fp + fn,
                'error_rate': round((fp + fn) / n, 4) if n > 0 else 0.0,
                'false_positive_count': fp,
                'false_negative_count': fn,
                'borderline_uncertain_count': uncertain_count,
                'false_positives': false_positives,
                'false_negatives': false_negatives
            },
            'target_breakdown': target_breakdown
        }

    @classmethod
    def _calculate_roc_auc(cls, y_true: List[int], y_prob: List[float]) -> float:
        """Calculates area under ROC curve via trapezoidal rule."""
        pos_count = sum(y_true)
        neg_count = len(y_true) - pos_count

        if pos_count == 0 or neg_count == 0:
            return 0.5

        # Pair and sort descending by predicted probability
        paired = sorted(zip(y_prob, y_true), key=lambda x: x[0], reverse=True)

        tp = 0
        fp = 0
        prev_tp = 0
        prev_fp = 0
        auc = 0.0

        for prob, label in paired:
            if label == 1:
                tp += 1
            else:
                fp += 1
                # Add area of trapezoid
                auc += (tp + prev_tp) / 2.0 * (fp - prev_fp)
                prev_tp = tp
                prev_fp = fp

        return auc / (pos_count * neg_count)
