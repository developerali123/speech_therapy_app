"""
Validation Runner CLI.
Executes rigorous validation on untouched holdout test set:
- Trains on Train partition
- Calibrates decision thresholds & uncertainty policy exclusively on Validation partition
- Evaluates on Holdout Test partition
- Emits per-target metrics for کا, کی, کے, کو
- Saves validation_errors.csv and validation_errors.json
- Generates VALIDATION_REPORT.md
"""

import os
import sys
import json
import argparse
from typing import Dict, Any, Optional

# Setup project path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.abspath(os.path.join(current_dir, "..", ".."))
if project_root not in sys.path:
    sys.path.insert(0, project_root)

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'reconfigure'):
    sys.stderr.reconfigure(encoding='utf-8', errors='replace')

from src.data.dataset_loader import DatasetLoader
from src.data.splitter import DataSplitter
from src.data.synthetic_generator import SyntheticBenchmarkGenerator
from src.features.xlsr_extractor import XLSRExtractor
from src.models.classifiers import LogisticRegressionClassifier
from src.validation.threshold_optimizer import ThresholdOptimizer
from src.validation.validator import ModelValidator

def run_validation_pipeline(
    data_path: Optional[str] = None,
    output_dir: Optional[str] = None,
    report_path: Optional[str] = None,
    seed: int = 42
) -> Dict[str, Any]:
    if output_dir is None:
        output_dir = os.path.join(project_root, "validation_artifacts")
    if report_path is None:
        report_path = os.path.join(project_root, "VALIDATION_REPORT.md")

    os.makedirs(output_dir, exist_ok=True)
    validator = ModelValidator(output_dir)

    print("=" * 75)
    print("STRICT HOLDOUT VALIDATION PIPELINE — SPEECH PRONUNCIATION ML")
    print("Targets: کا, کی, کے, کو")
    print("Constraint: Holdout test set remains strictly untouched during tuning")
    print("=" * 75)

    # 1. Dataset Loading
    if data_path and os.path.exists(data_path):
        print(f"\n[1/5] Ingesting dataset from: {data_path}")
        if data_path.endswith('.json'):
            examples, rejected = DatasetLoader.load_from_export_json(data_path)
        else:
            examples, rejected = DatasetLoader.load_from_manifest_csv(data_path)
        print(f"Loaded {len(examples)} valid therapist-confirmed recordings. ({len(rejected)} rejected)")
    else:
        print("\n[1/5] Synthesizing acoustic benchmark dataset for کا, کی, کے, کو...")
        examples = SyntheticBenchmarkGenerator.generate_benchmark_dataset(
            samples_per_target=20,  # 80 total examples (20 per phoneme)
            imbalance_ratio=0.55,
            seed=seed
        )
        print(f"Generated {len(examples)} acoustic recordings across 4 targets.")

    dataset_summary = DatasetLoader.get_summary_statistics(examples)
    print(f"Total Dataset Size: {dataset_summary['total_examples']}")
    print(f"Class Distribution: {dataset_summary['class_distribution']} ({dataset_summary['correct_percentage']}% Correct)")

    # 2. Session-Aware Partitioning
    print("\n[2/5] Creating Session-Aware Partitions (Train 70% / Val 15% / Test 15%)...")
    splits = DataSplitter.session_aware_split(examples, train_ratio=0.70, val_ratio=0.15, test_ratio=0.15, seed=seed)
    leakage = DataSplitter.verify_no_leakage(splits)
    if leakage['has_leakage']:
        raise RuntimeError(f"Fatal: Partition leakage detected! {leakage}")

    split_counts = leakage['counts']
    print(f"Partitions: Train={split_counts['train']}, Val={split_counts['val']}, Holdout Test={split_counts['test']}")

    # 3. Feature Extraction & Model Training (Train Only)
    print("\n[3/5] Extracting frozen XLS-R embeddings and training classifier strictly on Train set...")
    xlsr = XLSRExtractor()
    
    X_train = [xlsr.extract_embedding(e.audio_samples or [], e.target_text) for e in splits['train']]
    y_train = [1 if e.therapist_label == 'CORRECT' else 0 for e in splits['train']]

    clf = LogisticRegressionClassifier(learning_rate=0.06, l2_reg=0.001, epochs=60)
    clf.fit(X_train, y_train)
    print("Model trained on Train partition. Backbone remains 100% frozen.")

    # 4. Threshold & Uncertainty Policy Optimization (Validation Partition ONLY)
    print("\n[4/5] Calibrating decision thresholds & uncertainty margin on VALIDATION partition only...")
    X_val = [xlsr.extract_embedding(e.audio_samples or [], e.target_text) for e in splits['val']]
    y_val = [1 if e.therapist_label == 'CORRECT' else 0 for e in splits['val']]
    target_texts_val = [e.target_text for e in splits['val']]

    val_probs = clf.predict_proba(X_val)

    # Grid search uncertainty policy on validation
    uncertainty_results = ThresholdOptimizer.optimize_uncertainty_policy(y_val, val_probs)
    best_policy = uncertainty_results['best_policy']
    tau_low = best_policy['tau_low']
    tau_high = best_policy['tau_high']

    print(f"Validation Calibrated Policy: tau_low={tau_low}, tau_high={tau_high} (Margin: {best_policy['margin']})")
    print(f"Policy Score on Validation: {best_policy['best_score']}")

    # Check target disparities on validation
    target_disparities = ThresholdOptimizer.evaluate_target_disparities(y_val, val_probs, target_texts_val)
    print(f"Validation Target Disparity Summary: {target_disparities}")

    # 5. Final Evaluation on Untouched Holdout Test Partition
    print("\n[5/5] Evaluating calibrated model on UNTOUCHED HOLDOUT TEST SET...")
    X_test = [xlsr.extract_embedding(e.audio_samples or [], e.target_text) for e in splits['test']]
    test_probs = clf.predict_proba(X_test)

    test_results = validator.evaluate_holdout_test(
        test_examples=splits['test'],
        test_probabilities=test_probs,
        tau_low=tau_low,
        tau_high=tau_high,
        model_name="facebook/wav2vec2-xls-r-300m (Frozen) + L2-LogisticRegression"
    )

    gm = test_results['global_metrics']
    cm = test_results['confusion_matrix']
    print(f"\nHoldout Test Global Results:")
    print(f"  - Total Test Count:        {gm['total_test_samples']}")
    print(f"  - Confident Count:         {gm['confident_evaluations']}")
    print(f"  - Uncertain Count:         {gm['uncertain_evaluations']} ({gm['uncertain_rate']*100:.1f}%)")
    print(f"  - Accuracy (on confident): {gm['accuracy']*100:.2f}%")
    print(f"  - Precision:               {gm['precision']:.4f}")
    print(f"  - Recall:                  {gm['recall']:.4f}")
    print(f"  - F1-Score:                {gm['f1_score']:.4f}")
    print(f"  - Specificity:             {gm['specificity']:.4f}")
    print(f"  - ROC-AUC:                 {gm['roc_auc']:.4f}")
    print(f"  - Confusion Matrix:        {cm['matrix_2x2']}")

    print("\nHoldout Test Target Breakdown:")
    for tgt, stats in test_results['target_metrics'].items():
        print(f"  - {tgt}: Acc={stats.get('accuracy', 0)*100:.1f}%, F1={stats.get('f1_score', 0):.3f}, AUC={stats.get('roc_auc', 0):.3f} (N={stats.get('total_samples', 0)})")

    # Generate VALIDATION_REPORT.md
    print(f"\nWriting formal report to: {report_path}")
    validator.generate_validation_report_md(
        dataset_summary=dataset_summary,
        split_counts=split_counts,
        validation_threshold_info=uncertainty_results,
        test_results=test_results,
        report_path=report_path
    )
    print("Report generated successfully.")

    # Save full JSON dump
    results_json_path = os.path.join(output_dir, "validation_summary.json")
    with open(results_json_path, 'w', encoding='utf-8') as f:
        json.dump(test_results, f, indent=2, ensure_ascii=False)
    print(f"Artifacts saved in: {output_dir}")

    return test_results

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Run holdout validation pipeline.")
    parser.add_argument("--data", type=str, default=None, help="Path to exported ML dataset JSON")
    parser.add_argument("--output_dir", type=str, default=None, help="Directory for validation artifacts")
    parser.add_argument("--report", type=str, default=None, help="Path for output VALIDATION_REPORT.md")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for splitting")
    args = parser.parse_args()

    run_validation_pipeline(
        data_path=args.data,
        output_dir=args.output_dir,
        report_path=args.report,
        seed=args.seed
    )
