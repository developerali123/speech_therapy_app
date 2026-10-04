"""
Unit tests for ONNX model export and inference verification.
Tests:
- ONNX model creation and validation with onnx.checker
- Output tensors (probabilities, logits) shapes and ranges
- Exact numerical consistency between ONNX Runtime session and reference model
- Preprocessing metadata integrity
"""

import os
import sys
import json
import math
import numpy as np
import pytest
import onnx
import onnxruntime as ort

current_dir = os.path.dirname(os.path.abspath(__file__))
ml_root = os.path.abspath(os.path.join(current_dir, ".."))
if ml_root not in sys.path:
    sys.path.insert(0, ml_root)

from src.export.export_onnx import (
    build_onnx_model,
    create_preprocessing_metadata,
    TARGETS,
    FEATURE_DIM,
    TARGET_THRESHOLDS,
    TARGET_SHIFTS,
    BASE_BIAS
)

def test_build_onnx_model_validity():
    model = build_onnx_model()
    assert model is not None
    # Validate graph with official ONNX checker
    onnx.checker.check_model(model)
    assert model.graph.name == "PronunciationAssessmentGraph"
    assert len(model.graph.node) == 2
    assert model.graph.node[0].op_type == "Gemm"
    assert model.graph.node[1].op_type == "Sigmoid"

def test_onnx_runtime_inference():
    model = build_onnx_model()
    session = ort.InferenceSession(model.SerializeToString())

    # Input tensor shape [1, 1024]
    test_input = np.random.randn(1, FEATURE_DIM).astype(np.float32)
    outputs = session.run(["probabilities", "logits"], {"features": test_input})

    probs = outputs[0]
    logits = outputs[1]

    # Verify shapes
    assert probs.shape == (1, 4)
    assert logits.shape == (1, 4)

    # Verify math: probabilities == sigmoid(logits)
    expected_probs = 1.0 / (1.0 + np.exp(-logits))
    np.testing.assert_allclose(probs, expected_probs, rtol=1e-5, atol=1e-5)

    # Verify probability bounds [0, 1]
    assert np.all(probs >= 0.0)
    assert np.all(probs <= 1.0)

def test_numerical_equivalence_with_reference():
    model = build_onnx_model()
    session = ort.InferenceSession(model.SerializeToString())

    # Test vector with deterministic values
    test_vec = np.array([0.05 * math.sin(i * 0.1) for i in range(FEATURE_DIM)], dtype=np.float32).reshape(1, FEATURE_DIM)
    outputs = session.run(["probabilities"], {"features": test_vec})
    ort_probs = outputs[0][0]

    # Reference calculation in Python
    ref_dot = sum(0.02 * math.sin((j + 1) * 0.1) * test_vec[0, j] for j in range(FEATURE_DIM))
    for idx, target in enumerate(TARGETS):
        ref_z = ref_dot + BASE_BIAS + TARGET_SHIFTS[target]
        ref_p = 1.0 / (1.0 + math.exp(-ref_z))
        assert abs(ort_probs[idx] - ref_p) < 1e-5, f"Mismatch on target {target}: ORT={ort_probs[idx]} vs Ref={ref_p}"

def test_preprocessing_metadata():
    metadata = create_preprocessing_metadata()
    assert metadata["modelName"] == "pronunciation-model.onnx"
    assert metadata["format"] == "ONNX"
    assert metadata["preprocessing"]["targetSampleRate"] == 16000
    assert metadata["preprocessing"]["minDurationSeconds"] == 0.20
    assert metadata["targets"]["order"] == TARGETS
    assert len(metadata["targets"]["thresholds"]) == 4
    for t in TARGETS:
        assert t in metadata["targets"]["thresholds"]
        assert metadata["targets"]["thresholds"][t]["tau_low"] == 0.35
        assert metadata["targets"]["thresholds"][t]["tau_high"] == 0.40
