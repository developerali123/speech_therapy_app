"""
Experiment tracking and persistence engine.
Saves model configurations, hyperparameters, dataset versions, train/val/test counts,
evaluation metrics, confusion matrices, and research observations.
"""

import os
import json
from datetime import datetime, timezone
from typing import Dict, Any, Optional

class ExperimentTracker:
    """
    Tracks and records ML experiments in structured subdirectories under experiments/.
    """

    def __init__(self, base_experiments_dir: str):
        self.base_dir = base_experiments_dir
        os.makedirs(self.base_dir, exist_ok=True)

    def init_experiment(self, exp_id: str) -> str:
        """Creates directory for the experiment."""
        exp_dir = os.path.join(self.base_dir, exp_id)
        os.makedirs(exp_dir, exist_ok=True)
        return exp_dir

    def log_experiment(
        self,
        exp_id: str,
        model_name: str,
        classifier_type: str,
        hyperparameters: Dict[str, Any],
        dataset_info: Dict[str, Any],
        split_counts: Dict[str, int],
        test_metrics: Dict[str, Any],
        val_metrics: Optional[Dict[str, Any]] = None,
        notes: str = ""
    ) -> str:
        """
        Saves all experiment artifacts into the experiment directory.
        """
        exp_dir = self.init_experiment(exp_id)
        timestamp = datetime.now(timezone.utc).isoformat()

        record = {
            'experiment_id': exp_id,
            'timestamp': timestamp,
            'model_architecture': {
                'feature_extractor': model_name,
                'classifier': classifier_type,
                'pooling': 'mean_temporal_pooling'
            },
            'hyperparameters': hyperparameters,
            'dataset': {
                'version': dataset_info.get('version', 1),
                'total_examples': dataset_info.get('total_examples', 0),
                'targets': dataset_info.get('unique_targets', []),
                'class_distribution': dataset_info.get('class_distribution', {}),
                'train_count': split_counts.get('train', 0),
                'val_count': split_counts.get('val', 0),
                'test_count': split_counts.get('test', 0)
            },
            'validation_metrics': val_metrics,
            'test_metrics': test_metrics,
            'notes': notes
        }

        # 1. Save full JSON record
        with open(os.path.join(exp_dir, 'experiment_record.json'), 'w', encoding='utf-8') as f:
            json.dump(record, f, indent=2, ensure_ascii=False)

        # 2. Save individual metric and confusion matrix files
        with open(os.path.join(exp_dir, 'metrics.json'), 'w', encoding='utf-8') as f:
            json.dump(test_metrics, f, indent=2)

        with open(os.path.join(exp_dir, 'confusion_matrix.json'), 'w', encoding='utf-8') as f:
            json.dump(test_metrics.get('confusion_matrix', {}), f, indent=2)

        # 3. Save Markdown summary report
        cm = test_metrics.get('confusion_matrix', {})
        summary_md = f"""# Experiment Report: {exp_id}

**Date:** {timestamp}  
**Feature Extractor:** {model_name}  
**Classifier:** {classifier_type}  
**Dataset Version:** {dataset_info.get('version', 1)}  

---

## 1. Dataset Partitioning
- **Train Examples:** {split_counts.get('train', 0)}
- **Validation Examples:** {split_counts.get('val', 0)}
- **Test Examples:** {split_counts.get('test', 0)}
- **Total:** {dataset_info.get('total_examples', 0)}
- **Class Balance (Test):** {test_metrics.get('class_balance', {})}

---

## 2. Test Evaluation Metrics
- **Accuracy:** {test_metrics.get('accuracy', 0.0) * 100:.2f}%
- **Precision:** {test_metrics.get('precision', 0.0):.4f}
- **Recall:** {test_metrics.get('recall', 0.0):.4f}
- **F1-Score:** {test_metrics.get('f1_score', 0.0):.4f}
- **ROC-AUC:** {test_metrics.get('roc_auc', 0.0):.4f}
- **Specificity:** {test_metrics.get('specificity', 0.0):.4f}

---

## 3. Confusion Matrix
| Ground Truth \\ Prediction | INCORRECT (Pred 0) | CORRECT (Pred 1) |
|---|---|---|
| **INCORRECT (Actual 0)** | TN: {cm.get('tn', 0)} | FP: {cm.get('fp', 0)} |
| **CORRECT (Actual 1)** | FN: {cm.get('fn', 0)} | TP: {cm.get('tp', 0)} |

---

## 4. Error Analysis
- **Total Test Errors:** {test_metrics.get('error_analysis', {}).get('total_errors', 0)}
- **False Positives:** {test_metrics.get('error_analysis', {}).get('false_positive_count', 0)} (Therapist said Incorrect, model predicted Correct)
- **False Negatives:** {test_metrics.get('error_analysis', {}).get('false_negative_count', 0)} (Therapist said Correct, model predicted Incorrect)
- **Borderline Uncertain Cases:** {test_metrics.get('error_analysis', {}).get('borderline_uncertain_count', 0)}

---

## 5. Notes & Observations
{notes}
"""
        with open(os.path.join(exp_dir, 'report.md'), 'w', encoding='utf-8') as f:
            f.write(summary_md)

        return exp_dir
