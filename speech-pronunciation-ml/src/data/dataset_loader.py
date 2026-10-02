"""
Dataset loader and ingestion engine.
Loads therapist-labelled recordings from JSON exports, CSV manifests, or audio directories.
Enforces ground truth integrity: rejects automatic results and uncertain evaluations.
"""

import os
import json
import csv
import base64
from typing import List, Dict, Tuple, Any, Optional
from .schema import DatasetExample, VALID_THERAPIST_LABELS
from ..audio.normalizer import AudioNormalizer
from ..audio.validator import AudioValidationError

class DatasetLoader:
    """
    Loads and validates therapist-labelled speech datasets.
    """

    @classmethod
    def load_from_export_json(cls, json_path: str, extract_audio_dir: Optional[str] = None) -> Tuple[List[DatasetExample], List[Dict[str, Any]]]:
        """
        Loads dataset directly from the React Speech Practice Assistant Phase 9 export.
        Optionally extracts base64 audio into WAV files.
        """
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        examples: List[DatasetExample] = []
        rejected: List[Dict[str, Any]] = []

        items = data.get('examples', [])
        for item in items:
            rec_id = item.get('recordingId') or item.get('id', 'unknown')
            target_text = item.get('targetText', '')
            target_units = item.get('targetUnits', [target_text] if target_text else [])
            therapist_label = item.get('therapistLabel')
            duration = float(item.get('duration', 0.0))

            # Ground truth validation: ONLY therapist-confirmed labels
            if therapist_label not in VALID_THERAPIST_LABELS:
                rejected.append({
                    'recording_id': rec_id,
                    'reason': f"Disqualified label: '{therapist_label}'. Only confirmed CORRECT/INCORRECT accepted."
                })
                continue

            if item.get('includedInTraining') is False:
                rejected.append({
                    'recording_id': rec_id,
                    'reason': f"Manually excluded from training. Reason: {item.get('excludedReason', 'unspecified')}"
                })
                continue

            if duration < 0.20:
                rejected.append({
                    'recording_id': rec_id,
                    'reason': f"Duration ({duration:.2f}s) is below required minimum 0.20s."
                })
                continue

            # Process audio if base64 provided
            audio_samples = None
            audio_path = item.get('audioPath')
            base64_audio = item.get('audioBase64')

            if base64_audio:
                try:
                    raw_audio_bytes = base64.b64decode(base64_audio)
                    std_audio = AudioNormalizer.standardize_audio(raw_audio_bytes)
                    audio_samples = std_audio['samples']
                    duration = std_audio['duration']

                    if extract_audio_dir:
                        os.makedirs(extract_audio_dir, exist_ok=True)
                        save_path = os.path.join(extract_audio_dir, f"{rec_id}.wav")
                        AudioNormalizer.save_wav(save_path, audio_samples)
                        audio_path = save_path
                except AudioValidationError as e:
                    rejected.append({
                        'recording_id': rec_id,
                        'reason': f"Audio standardization failed: {str(e)}"
                    })
                    continue
                except Exception as e:
                    rejected.append({
                        'recording_id': rec_id,
                        'reason': f"Base64 decoding failed: {str(e)}"
                    })
                    continue
            elif audio_path and os.path.exists(audio_path):
                try:
                    std_audio = AudioNormalizer.standardize_audio(audio_path)
                    audio_samples = std_audio['samples']
                    duration = std_audio['duration']
                except AudioValidationError as e:
                    rejected.append({
                        'recording_id': rec_id,
                        'reason': f"WAV file validation failed: {str(e)}"
                    })
                    continue

            example = DatasetExample(
                recording_id=rec_id,
                exercise_id=item.get('exerciseId', 'unknown'),
                target_text=target_text,
                target_units=target_units,
                therapist_label=therapist_label,
                audio_path=audio_path,
                duration=duration,
                speaker_id=item.get('speakerId'),
                session_id=item.get('sessionId'),
                created_at=item.get('createdAt'),
                therapist_remarks=item.get('therapistRemarks'),
                audio_samples=audio_samples
            )
            examples.append(example)

        return examples, rejected

    @classmethod
    def load_from_manifest_csv(cls, csv_path: str, audio_base_dir: str = "") -> Tuple[List[DatasetExample], List[Dict[str, Any]]]:
        """
        Loads dataset from a CSV manifest containing metadata and audio file paths.
        """
        examples: List[DatasetExample] = []
        rejected: List[Dict[str, Any]] = []

        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                rec_id = row.get('recording_id', '')
                therapist_label = row.get('therapist_label', '').strip().upper()
                target_text = row.get('target_text', '').strip()
                target_units_str = row.get('target_units', '')
                target_units = [u.strip() for u in target_units_str.split(',') if u.strip()] or [target_text]

                if therapist_label not in VALID_THERAPIST_LABELS:
                    rejected.append({
                        'recording_id': rec_id,
                        'reason': f"Non-ground-truth label: '{therapist_label}'"
                    })
                    continue

                audio_rel = row.get('audio_path', f"{rec_id}.wav")
                full_audio_path = os.path.join(audio_base_dir, audio_rel) if audio_base_dir else audio_rel

                if not os.path.exists(full_audio_path):
                    rejected.append({
                        'recording_id': rec_id,
                        'reason': f"Audio file not found: {full_audio_path}"
                    })
                    continue

                try:
                    std_audio = AudioNormalizer.standardize_audio(full_audio_path)
                except AudioValidationError as e:
                    rejected.append({
                        'recording_id': rec_id,
                        'reason': f"Audio validation failed: {str(e)}"
                    })
                    continue

                ex = DatasetExample(
                    recording_id=rec_id,
                    exercise_id=row.get('exercise_id', 'ka'),
                    target_text=target_text,
                    target_units=target_units,
                    therapist_label=therapist_label,
                    audio_path=full_audio_path,
                    duration=std_audio['duration'],
                    speaker_id=row.get('speaker_id'),
                    session_id=row.get('session_id'),
                    created_at=row.get('created_at'),
                    therapist_remarks=row.get('therapist_remarks'),
                    audio_samples=std_audio['samples']
                )
                examples.append(ex)

        return examples, rejected

    @classmethod
    def get_summary_statistics(cls, examples: List[DatasetExample]) -> Dict[str, Any]:
        """Calculates comprehensive dataset statistics and class distributions."""
        total = len(examples)
        class_dist = {'CORRECT': 0, 'INCORRECT': 0}
        target_dist: Dict[str, Dict[str, int]] = {}

        for ex in examples:
            lbl = ex.therapist_label
            class_dist[lbl] = class_dist.get(lbl, 0) + 1

            tgt = ex.target_text
            if tgt not in target_dist:
                target_dist[tgt] = {'CORRECT': 0, 'INCORRECT': 0, 'total': 0}
            target_dist[tgt][lbl] = target_dist[tgt].get(lbl, 0) + 1
            target_dist[tgt]['total'] += 1

        correct_count = class_dist.get('CORRECT', 0)
        imbalance_ratio = (correct_count / total * 100.0) if total > 0 else 0.0

        return {
            'total_examples': total,
            'class_distribution': class_dist,
            'correct_percentage': round(imbalance_ratio, 2),
            'target_distribution': target_dist,
            'unique_targets': list(target_dist.keys())
        }
