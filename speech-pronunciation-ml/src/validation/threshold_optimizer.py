"""
Threshold and Uncertainty Policy Optimizer.
Calibrates decision boundaries and uncertainty zones EXCLUSIVELY on validation data.
Guarantees the holdout test set remains completely untouched during threshold tuning.
"""

from typing import List, Dict, Tuple, Any, Optional

class ThresholdOptimizer:
    """
    Finds optimal decision thresholds and uncertainty margins using validation data.
    """

    @classmethod
    def evaluate_threshold_grid(
        cls,
        y_val: List[int],
        y_prob_val: List[float],
        candidates: Optional[List[float]] = None
    ) -> List[Dict[str, Any]]:
        """
        Sweeps single decision thresholds on validation data.
        """
        if candidates is None:
            candidates = [0.35, 0.40, 0.45, 0.48, 0.50, 0.52, 0.55, 0.60, 0.65]

        results = []
        n = len(y_val)
        if n == 0:
            return results

        for tau in candidates:
            preds = [1 if p >= tau else 0 for p in y_prob_val]
            tp = sum(1 for yt, yp in zip(y_val, preds) if yt == 1 and yp == 1)
            tn = sum(1 for yt, yp in zip(y_val, preds) if yt == 0 and yp == 0)
            fp = sum(1 for yt, yp in zip(y_val, preds) if yt == 0 and yp == 1)
            fn = sum(1 for yt, yp in zip(y_val, preds) if yt == 1 and yp == 0)

            acc = (tp + tn) / n
            prec = tp / (tp + fp) if (tp + fp) > 0 else 0.0
            rec = tp / (tp + fn) if (tp + fn) > 0 else 0.0
            f1 = (2 * prec * rec) / (prec + rec) if (prec + rec) > 0 else 0.0
            spec = tn / (tn + fp) if (tn + fp) > 0 else 0.0

            results.append({
                'threshold': tau,
                'accuracy': round(acc, 4),
                'precision': round(prec, 4),
                'recall': round(rec, 4),
                'f1_score': round(f1, 4),
                'specificity': round(spec, 4),
                'confusion_matrix': {'tp': tp, 'tn': tn, 'fp': fp, 'fn': fn}
            })

        return results

    @classmethod
    def optimize_uncertainty_policy(
        cls,
        y_val: List[int],
        y_prob_val: List[float],
        grid_pairs: Optional[List[Tuple[float, float]]] = None
    ) -> Dict[str, Any]:
        """
        Evaluates dual-threshold uncertainty policies on validation data:
        - If P >= tau_high: predict CORRECT (1)
        - If P <= tau_low: predict INCORRECT (0)
        - If tau_low < P < tau_high: predict UNCERTAIN (-1)

        Evaluates tradeoff between coverage rate, uncertain rate, and F1 on confident subset.
        """
        if grid_pairs is None:
            # 1. Find optimal baseline threshold on validation data
            single_grid = cls.evaluate_threshold_grid(y_val, y_prob_val)
            best_single = max(single_grid, key=lambda x: (x['f1_score'], x['accuracy'])) if single_grid else {'threshold': 0.5}
            tau_star = best_single.get('threshold', 0.5)

            # 2. Sweep uncertainty margins around tau_star
            margins = [0.0, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12]
            grid_pairs = []
            for m in margins:
                t_low = max(0.05, round(tau_star - m, 3))
                t_high = min(0.95, round(tau_star + m, 3))
                if (t_low, t_high) not in grid_pairs:
                    grid_pairs.append((t_low, t_high))

        evaluations = []
        n = len(y_val)
        if n == 0:
            return {'best_policy': (0.5, 0.5), 'evaluations': []}

        best_policy = grid_pairs[0]
        best_score = -1.0

        for tau_low, tau_high in grid_pairs:
            tp = 0
            tn = 0
            fp = 0
            fn = 0
            uncertain_count = 0

            for yt, prob in zip(y_val, y_prob_val):
                if prob >= tau_high:
                    pred = 1
                elif prob <= tau_low:
                    pred = 0
                else:
                    pred = -1  # UNCERTAIN
                    uncertain_count += 1
                    continue

                if yt == 1 and pred == 1:
                    tp += 1
                elif yt == 0 and pred == 0:
                    tn += 1
                elif yt == 0 and pred == 1:
                    fp += 1
                elif yt == 1 and pred == 0:
                    fn += 1

            classified_count = n - uncertain_count
            coverage_rate = classified_count / n
            uncertain_rate = uncertain_count / n

            if classified_count > 0:
                acc_confident = (tp + tn) / classified_count
                prec_confident = tp / (tp + fp) if (tp + fp) > 0 else 0.0
                rec_confident = tp / (tp + fn) if (tp + fn) > 0 else 0.0
                f1_confident = (2 * prec_confident * rec_confident) / (prec_confident + rec_confident) if (prec_confident + rec_confident) > 0 else 0.0
            spec_confident = tn / (tn + fp) if (tn + fp) > 0 else 0.0
            balanced_acc = (rec_confident + spec_confident) / 2.0 if (classified_count > 0) else 0.0

            # Utility score balances accuracy/F1 improvement against excessive deferral
            policy_score = (f1_confident * 0.6 + balanced_acc * 0.4) * (coverage_rate ** 0.25)

            eval_entry = {
                'tau_low': tau_low,
                'tau_high': tau_high,
                'margin': round(tau_high - tau_low, 3),
                'coverage_rate': round(coverage_rate, 4),
                'uncertain_rate': round(uncertain_rate, 4),
                'uncertain_count': uncertain_count,
                'accuracy_on_confident': round(acc_confident, 4),
                'precision_on_confident': round(prec_confident, 4),
                'recall_on_confident': round(rec_confident, 4),
                'f1_on_confident': round(f1_confident, 4),
                'specificity_on_confident': round(spec_confident, 4),
                'balanced_acc': round(balanced_acc, 4),
                'policy_score': round(policy_score, 4),
                'confusion_matrix': {'tp': tp, 'tn': tn, 'fp': fp, 'fn': fn}
            }
            evaluations.append(eval_entry)

            if policy_score > best_score:
                best_score = policy_score
                best_policy = (tau_low, tau_high)

        return {
            'best_policy': {
                'tau_low': best_policy[0],
                'tau_high': best_policy[1],
                'margin': round(best_policy[1] - best_policy[0], 3),
                'best_score': round(best_score, 4)
            },
            'all_evaluated_policies': evaluations
        }

    @classmethod
    def evaluate_target_disparities(
        cls,
        y_val: List[int],
        y_prob_val: List[float],
        target_texts_val: List[str]
    ) -> Dict[str, Any]:
        """
        Analyzes validation performance per target to determine whether
        specific targets (e.g. کا) require distinct thresholds from other phonemes.
        """
        targets = set(target_texts_val)
        breakdown = {}

        for tgt in sorted(targets):
            indices = [i for i, t in enumerate(target_texts_val) if t == tgt]
            if not indices:
                continue

            sub_y = [y_val[i] for i in indices]
            sub_probs = [y_prob_val[i] for i in indices]

            # Best single threshold on target subset
            target_grid = cls.evaluate_threshold_grid(sub_y, sub_probs)
            best_t = max(target_grid, key=lambda x: x['f1_score']) if target_grid else {}

            avg_prob = sum(sub_probs) / len(sub_probs)
            breakdown[tgt] = {
                'sample_count': len(sub_y),
                'correct_ratio': round(sum(sub_y) / len(sub_y), 4),
                'mean_predicted_prob': round(avg_prob, 4),
                'best_single_threshold': best_t.get('threshold', 0.5),
                'best_f1_score': best_t.get('f1_score', 0.0)
            }

        return breakdown
