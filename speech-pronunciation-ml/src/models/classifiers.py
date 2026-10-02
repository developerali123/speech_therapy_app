"""
Pronunciation Classifier Suite.
Implements classifiers on top of frozen speech representations:
1. Logistic Regression (Probabilistic linear baseline)
2. Linear Classifier (Perceptron / Linear decision boundary)
3. Support Vector Machine (SVM with RBF / Linear kernel)
4. Small MLP (Multi-Layer Perceptron: input -> hidden [64] -> ReLU -> output [1])
"""

import math
import random
from typing import List, Tuple, Dict, Any, Optional

class BasePronunciationClassifier:
    """Base interface for pronunciation quality classifiers."""
    def fit(self, X: List[List[float]], y: List[int]) -> None:
        raise NotImplementedError

    def predict_proba(self, X: List[List[float]]) -> List[float]:
        raise NotImplementedError

    def predict(self, X: List[List[float]], threshold: float = 0.5) -> List[int]:
        probs = self.predict_proba(X)
        return [1 if p >= threshold else 0 for p in probs]

class LogisticRegressionClassifier(BasePronunciationClassifier):
    """
    Logistic Regression classifier with L2 regularization and gradient descent.
    Outputs calibrated posterior probability P(CORRECT | audio, target).
    """

    def __init__(self, learning_rate: float = 0.05, l2_reg: float = 0.001, epochs: int = 60):
        self.lr = learning_rate
        self.l2_reg = l2_reg
        self.epochs = epochs
        self.weights: List[float] = []
        self.bias: float = 0.0

    def fit(self, X: List[List[float]], y: List[int]) -> None:
        if not X or not y:
            return

        dim = len(X[0])
        n_samples = len(X)
        
        # Xavier-style weight initialization
        limit = math.sqrt(2.0 / dim)
        self.weights = [random.uniform(-limit, limit) * 0.1 for _ in range(dim)]
        self.bias = 0.0

        for epoch in range(self.epochs):
            dw = [0.0] * dim
            db = 0.0

            for i in range(n_samples):
                # z = w^T x + b
                z = sum(w * x for w, x in zip(self.weights, X[i])) + self.bias
                z_clamped = max(-20.0, min(20.0, z))
                prob = 1.0 / (1.0 + math.exp(-z_clamped))

                error = prob - y[i]

                for j in range(dim):
                    dw[j] += error * X[i][j]
                db += error

            # Apply gradient descent update with L2 regularization
            for j in range(dim):
                self.weights[j] -= self.lr * (dw[j] / n_samples + self.l2_reg * self.weights[j])
            self.bias -= self.lr * (db / n_samples)

    def predict_proba(self, X: List[List[float]]) -> List[float]:
        if not self.weights:
            return [0.5] * len(X)

        probs: List[float] = []
        for x in X:
            z = sum(w * val for w, val in zip(self.weights, x)) + self.bias
            z_clamped = max(-20.0, min(20.0, z))
            p = 1.0 / (1.0 + math.exp(-z_clamped))
            probs.append(round(p, 5))
        return probs

class LinearClassifier(BasePronunciationClassifier):
    """
    Linear classifier trained via perceptron / margin update.
    """

    def __init__(self, learning_rate: float = 0.01, epochs: int = 100):
        self.lr = learning_rate
        self.epochs = epochs
        self.weights: List[float] = []
        self.bias: float = 0.0

    def fit(self, X: List[List[float]], y: List[int]) -> None:
        if not X or not y:
            return
        dim = len(X[0])
        self.weights = [0.0] * dim
        self.bias = 0.0

        # Convert 0/1 to -1/+1
        targets = [1 if label == 1 else -1 for label in y]

        for _ in range(self.epochs):
            for i in range(len(X)):
                score = sum(w * x for w, x in zip(self.weights, X[i])) + self.bias
                if targets[i] * score <= 0:
                    # Misclassified
                    for j in range(dim):
                        self.weights[j] += self.lr * targets[i] * X[i][j]
                    self.bias += self.lr * targets[i]

    def predict_proba(self, X: List[List[float]]) -> List[float]:
        probs = []
        for x in X:
            score = sum(w * val for w, val in zip(self.weights, x)) + self.bias
            # Sigmoid projection for confidence
            p = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, score))))
            probs.append(round(p, 5))
        return probs

class SVMClassifier(BasePronunciationClassifier):
    """
    Support Vector Machine baseline with RBF / Linear kernel.
    """

    def __init__(self, kernel: str = 'linear', C: float = 1.0, gamma: float = 0.01):
        self.kernel = kernel
        self.C = C
        self.gamma = gamma
        self.support_vectors: List[List[float]] = []
        self.alphas: List[float] = []
        self.bias: float = 0.0

    def _kernel_fn(self, x1: List[float], x2: List[float]) -> float:
        if self.kernel == 'linear':
            return sum(a * b for a, b in zip(x1, x2))
        else:  # RBF
            dist_sq = sum((a - b) ** 2 for a, b in zip(x1, x2))
            return math.exp(-self.gamma * dist_sq)

    def fit(self, X: List[List[float]], y: List[int]) -> None:
        if not X or not y:
            return
        n_samples = len(X)
        targets = [1.0 if label == 1 else -1.0 for label in y]
        self.support_vectors = [list(x) for x in X]

        # Simplified dual coordinate optimization for SVM
        self.alphas = [0.0] * n_samples
        learning_rate = 0.01

        for _ in range(120):
            for i in range(n_samples):
                score = sum(self.alphas[j] * targets[j] * self._kernel_fn(self.support_vectors[j], X[i])
                            for j in range(n_samples)) + self.bias
                if targets[i] * score < 1.0:
                    self.alphas[i] = min(self.C, self.alphas[i] + learning_rate)
                    self.bias += learning_rate * targets[i]

    def predict_proba(self, X: List[List[float]]) -> List[float]:
        probs = []
        for x in X:
            score = sum(self.alphas[j] * (1.0 if j % 2 == 0 else -1.0) * self._kernel_fn(self.support_vectors[j], x)
                        for j in range(len(self.support_vectors))) + self.bias
            p = 1.0 / (1.0 + math.exp(-max(-15.0, min(15.0, score))))
            probs.append(round(p, 5))
        return probs

class SmallMLPClassifier(BasePronunciationClassifier):
    """
    Small Multi-Layer Perceptron (MLP).
    Architecture:
    Input (D) -> Dense (hidden_dim=64) -> ReLU -> Dense (1) -> Sigmoid -> P(CORRECT)
    """

    def __init__(self, hidden_dim: int = 16, lr: float = 0.03, epochs: int = 40):
        self.hidden_dim = hidden_dim
        self.lr = lr
        self.epochs = epochs

        self.W1: List[List[float]] = []  # (input_dim, hidden_dim)
        self.b1: List[float] = []        # (hidden_dim,)
        self.W2: List[float] = []        # (hidden_dim,)
        self.b2: float = 0.0

    def fit(self, X: List[List[float]], y: List[int]) -> None:
        if not X or not y:
            return
        dim = len(X[0])
        n_samples = len(X)

        # He initialization for ReLU
        scale1 = math.sqrt(2.0 / dim)
        self.W1 = [[random.gauss(0, scale1) * 0.1 for _ in range(self.hidden_dim)] for _ in range(dim)]
        self.b1 = [0.0] * self.hidden_dim

        scale2 = math.sqrt(2.0 / self.hidden_dim)
        self.W2 = [random.gauss(0, scale2) * 0.1 for _ in range(self.hidden_dim)]
        self.b2 = 0.0

        for epoch in range(self.epochs):
            for i in range(n_samples):
                x = X[i]
                target = y[i]

                # 1. Forward Pass
                # Hidden pre-activation
                h_pre = [sum(x[j] * self.W1[j][k] for j in range(dim)) + self.b1[k] for k in range(self.hidden_dim)]
                # ReLU
                h_act = [max(0.0, val) for val in h_pre]

                # Output pre-activation
                z = sum(h_act[k] * self.W2[k] for k in range(self.hidden_dim)) + self.b2
                z_clamped = max(-20.0, min(20.0, z))
                prob = 1.0 / (1.0 + math.exp(-z_clamped))

                # 2. Backward Pass
                d_out = prob - target

                # Gradient w.r.t W2, b2
                for k in range(self.hidden_dim):
                    self.W2[k] -= self.lr * d_out * h_act[k]
                self.b2 -= self.lr * d_out

                # Gradient w.r.t W1, b1
                for k in range(self.hidden_dim):
                    if h_pre[k] > 0:  # ReLU derivative
                        d_h = d_out * self.W2[k]
                        for j in range(dim):
                            self.W1[j][k] -= self.lr * d_h * x[j]
                        self.b1[k] -= self.lr * d_h

    def predict_proba(self, X: List[List[float]]) -> List[float]:
        if not self.W1:
            return [0.5] * len(X)
        probs = []
        dim = len(self.W1)

        for x in X:
            h_pre = [sum(x[j] * self.W1[j][k] for j in range(dim)) + self.b1[k] for k in range(self.hidden_dim)]
            h_act = [max(0.0, val) for val in h_pre]
            z = sum(h_act[k] * self.W2[k] for k in range(self.hidden_dim)) + self.b2
            z_clamped = max(-20.0, min(20.0, z))
            p = 1.0 / (1.0 + math.exp(-z_clamped))
            probs.append(round(p, 5))

        return probs
