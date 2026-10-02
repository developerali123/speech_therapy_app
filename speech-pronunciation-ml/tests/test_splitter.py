"""
Tests for Session-Aware Splitting and Leakage Prevention.
"""

import unittest
from src.data.schema import DatasetExample
from src.data.splitter import DataSplitter

class TestDataSplitter(unittest.TestCase):

    def test_session_aware_split_prevents_leakage(self):
        """Recordings from the same session must stay within the same partition."""
        examples = []
        for sess_num in range(1, 11):
            sess_id = f"session_{sess_num}"
            for attempt in range(1, 4):  # 3 attempts per session
                examples.append(DatasetExample(
                    recording_id=f"rec_{sess_num}_{attempt}",
                    exercise_id="ka",
                    target_text="کا",
                    target_units=["کا"],
                    therapist_label="CORRECT" if attempt % 2 == 0 else "INCORRECT",
                    duration=0.8,
                    session_id=sess_id
                ))

        self.assertEqual(len(examples), 30)

        splits = DataSplitter.session_aware_split(examples, train_ratio=0.7, val_ratio=0.15, test_ratio=0.15, seed=42)
        leakage = DataSplitter.verify_no_leakage(splits)

        self.assertFalse(leakage['has_leakage'])
        self.assertGreater(len(splits['train']), 0)
        self.assertGreater(len(splits['val']), 0)
        self.assertGreater(len(splits['test']), 0)

        # Cross check session memberships
        train_sessions = {e.session_id for e in splits['train']}
        val_sessions = {e.session_id for e in splits['val']}
        test_sessions = {e.session_id for e in splits['test']}

        self.assertEqual(len(train_sessions.intersection(val_sessions)), 0)
        self.assertEqual(len(train_sessions.intersection(test_sessions)), 0)
        self.assertEqual(len(val_sessions.intersection(test_sessions)), 0)

if __name__ == '__main__':
    unittest.main()
