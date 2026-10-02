"""
Tests for Classifiers and Model Evaluator.
"""

import unittest
from src.models.classifiers import (
    LogisticRegressionClassifier,
    LinearClassifier,
    SmallMLPClassifier
)
from src.models.evaluator import ModelEvaluator

class TestModelsAndEvaluator(unittest.TestCase):

    def setUp(self):
        # Linearly separable 2D benchmark
        # Class 1: high values, Class 0: low values
        self.X_train = [
            [0.8, 0.9], [0.85, 0.95], [0.75, 0.85], [0.9, 0.8],
            [0.1, 0.2], [0.15, 0.05], [0.2, 0.15], [0.05, 0.25]
        ]
        self.y_train = [1, 1, 1, 1, 0, 0, 0, 0]

        self.X_test = [
            [0.82, 0.88], [0.78, 0.92],
            [0.12, 0.18], [0.18, 0.08]
        ]
        self.y_test = [1, 1, 0, 0]

    def test_logistic_regression(self):
        clf = LogisticRegressionClassifier(learning_rate=0.2, epochs=200)
        clf.fit(self.X_train, self.y_train)
        preds = clf.predict(self.X_test)
        self.assertEqual(preds, self.y_test)

    def test_small_mlp(self):
        mlp = SmallMLPClassifier(hidden_dim=8, lr=0.1, epochs=200)
        mlp.fit(self.X_train, self.y_train)
        preds = mlp.predict(self.X_test)
        self.assertEqual(preds, self.y_test)

    def test_evaluator_metrics(self):
        y_true = [1, 1, 0, 0]
        y_prob = [0.9, 0.85, 0.15, 0.1]
        metrics = ModelEvaluator.compute_metrics(y_true, y_prob)

        self.assertEqual(metrics['accuracy'], 1.0)
        self.assertEqual(metrics['precision'], 1.0)
        self.assertEqual(metrics['recall'], 1.0)
        self.assertEqual(metrics['f1_score'], 1.0)
        self.assertEqual(metrics['confusion_matrix']['tp'], 2)
        self.assertEqual(metrics['confusion_matrix']['tn'], 2)
        self.assertEqual(metrics['confusion_matrix']['fp'], 0)
        self.assertEqual(metrics['confusion_matrix']['fn'], 0)

if __name__ == '__main__':
    unittest.main()
