"""
Tests for Dataset Ingestion and Ground Truth Validation.
"""

import unittest
import json
import tempfile
import os
from src.data.dataset_loader import DatasetLoader
from src.data.schema import DatasetExample

class TestDatasetLoader(unittest.TestCase):

    def test_rejects_non_therapist_and_uncertain_labels(self):
        """Only therapist confirmed CORRECT or INCORRECT are eligible."""
        sample_export = {
            "format": "speech-practice-ml-dataset",
            "version": 1,
            "examples": [
                {
                    "recordingId": "rec_001",
                    "targetText": "کا",
                    "therapistLabel": "CORRECT",
                    "duration": 0.85,
                    "includedInTraining": True
                },
                {
                    "recordingId": "rec_002",
                    "targetText": "کی",
                    "therapistLabel": "UNCERTAIN",  # Disqualified
                    "duration": 0.85,
                    "includedInTraining": False
                },
                {
                    "recordingId": "rec_003",
                    "targetText": "کے",
                    "therapistLabel": None,  # Automatic only / unreviewed
                    "duration": 0.90,
                    "includedInTraining": False
                },
                {
                    "recordingId": "rec_004",
                    "targetText": "کو",
                    "therapistLabel": "CORRECT",
                    "duration": 0.10,  # Below duration minimum
                    "includedInTraining": True
                }
            ]
        }

        with tempfile.NamedTemporaryFile('w', delete=False, suffix='.json', encoding='utf-8') as f:
            json.dump(sample_export, f)
            temp_path = f.name

        try:
            examples, rejected = DatasetLoader.load_from_export_json(temp_path)
            self.assertEqual(len(examples), 1)
            self.assertEqual(examples[0].recording_id, "rec_001")
            self.assertEqual(len(rejected), 3)
        finally:
            if os.path.exists(temp_path):
                os.remove(temp_path)

if __name__ == '__main__':
    unittest.main()
