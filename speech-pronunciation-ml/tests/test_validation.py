"""
Tests for Validation Engine, Threshold Optimization, and Error Logging.
"""

import unittest
import os
import tempfile
import json
import csv
from src.data.schema import DatasetExample
from src.validation.threshold_optimizer import ThresholdOptimizer
from src.validation.validator import ModelValidator

class TestValidationEngine(unittest.TestCase):

    def test_threshold_optimizer_selects_best_margin(self):
        """Validates that threshold optimizer finds an optimal uncertainty policy."""
        # 10 samples with known probabilities
        y_val = [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]
        # Ambiguous probabilities around 0.5 for indices 4 and 5
        y_prob_val = [0.95, 0.88, 0.82, 0.76, 0.52, 0.48, 0.22, 0.18, 0.12, 0.05]

        opt = ThresholdOptimizer.optimize_uncertainty_policy(y_val, y_prob_val)
        best = opt['best_policy']

        self.assertIn('tau_low', best)
        self.assertIn('tau_high', best)
        self.assertGreaterEqual(best['tau_high'], best['tau_low'])

    def test_evaluator_assigns_uncertain_and_exports_errors(self):
        """Verifies holdout test evaluation correctly identifies errors and exports CSV/JSON."""
        test_examples = [
            DatasetExample(
                recording_id="rec_t1",
                exercise_id="ka",
                target_text="کا",
                target_units=["کا"],
                therapist_label="CORRECT",
                duration=0.85
            ),
            DatasetExample(
                recording_id="rec_t2",
                exercise_id="ki",
                target_text="کی",
                target_units=["کی"],
                therapist_label="INCORRECT",
                duration=0.75
            ),
            DatasetExample(
                recording_id="rec_t3",
                exercise_id="ke",
                target_text="کے",
                target_units=["کے"],
                therapist_label="CORRECT",
                duration=0.90
            ),
            DatasetExample(
                recording_id="rec_t4",
                exercise_id="ko",
                target_text="کو",
                target_units=["کو"],
                therapist_label="INCORRECT",
                duration=0.80
            )
        ]

        # Probabilities:
        # rec_t1: 0.90 -> CORRECT (TP)
        # rec_t2: 0.80 -> CORRECT (FP! False Positive)
        # rec_t3: 0.51 -> UNCERTAIN (Deferred)
        # rec_t4: 0.10 -> INCORRECT (TN)
        test_probs = [0.90, 0.80, 0.51, 0.10]

        with tempfile.TemporaryDirectory() as tmp_dir:
            validator = ModelValidator(tmp_dir)
            results = validator.evaluate_holdout_test(
                test_examples=test_examples,
                test_probabilities=test_probs,
                tau_low=0.45,
                tau_high=0.55
            )

            gm = results['global_metrics']
            self.assertEqual(gm['total_test_samples'], 4)
            self.assertEqual(gm['confident_evaluations'], 3)
            self.assertEqual(gm['uncertain_evaluations'], 1)
            self.assertEqual(gm['uncertain_rate'], 0.25)

            # Check error tracking: rec_t2 was FP
            errors = results['errors']
            self.assertEqual(len(errors), 1)
            self.assertEqual(errors[0]['recording_id'], 'rec_t2')
            self.assertEqual(errors[0]['target'], 'کی')
            self.assertEqual(errors[0]['therapist_label'], 'INCORRECT')
            self.assertEqual(errors[0]['model_label'], 'CORRECT')

            # Verify CSV file export
            csv_path = os.path.join(tmp_dir, 'validation_errors.csv')
            self.assertTrue(os.path.exists(csv_path))
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                self.assertEqual(len(rows), 1)
                self.assertEqual(rows[0]['recording_id'], 'rec_t2')

            # Verify JSON file export
            json_path = os.path.join(tmp_dir, 'validation_errors.json')
            self.assertTrue(os.path.exists(json_path))
            with open(json_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.assertEqual(len(data), 1)
                self.assertEqual(data[0]['recording_id'], 'rec_t2')

            # Verify per-target breakdown
            tm = results['target_metrics']
            self.assertIn('کا', tm)
            self.assertIn('کی', tm)
            self.assertIn('کے', tm)
            self.assertIn('کو', tm)
            self.assertEqual(tm['کا']['total_samples'], 1)
            self.assertEqual(tm['کے']['uncertain_samples'], 1)

if __name__ == '__main__':
    unittest.main()
