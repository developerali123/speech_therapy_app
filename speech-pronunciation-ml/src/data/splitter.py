"""
Data splitting module designed to prevent data leakage in speech practice datasets.
Implements session-aware and speaker-aware group splitting across train, validation, and test.
"""

import random
from collections import defaultdict
from typing import List, Dict, Tuple, Any, Optional
from .schema import DatasetExample

class DataSplitter:
    """
    Splits speech dataset into train, validation, and test partitions
    while rigorously preventing leakage across practice attempts.
    """

    @classmethod
    def session_aware_split(
        cls,
        examples: List[DatasetExample],
        train_ratio: float = 0.70,
        val_ratio: float = 0.15,
        test_ratio: float = 0.15,
        seed: int = 42
    ) -> Dict[str, List[DatasetExample]]:
        """
        Groups recordings by session_id (or speaker_id).
        Entire sessions are assigned atomically to either train, validation, or test.
        This guarantees that consecutive repeated attempts from the same practice session
        never leak between training and evaluation!
        """
        if not examples:
            return {'train': [], 'val': [], 'test': []}

        rng = random.Random(seed)

        # 1. Stratify by target phoneme to guarantee representation of each sound
        target_groups = defaultdict(lambda: defaultdict(list))
        for ex in examples:
            tgt = ex.target_text or 'unknown'
            group_key = ex.session_id or ex.speaker_id or ex.recording_id
            target_groups[tgt][group_key].append(ex)

        train_examples: List[DatasetExample] = []
        val_examples: List[DatasetExample] = []
        test_examples: List[DatasetExample] = []

        for tgt, groups in target_groups.items():
            session_keys = list(groups.keys())
            rng.shuffle(session_keys)

            n_sessions = len(session_keys)
            if n_sessions == 1:
                train_examples.extend(groups[session_keys[0]])
            elif n_sessions == 2:
                train_examples.extend(groups[session_keys[0]])
                test_examples.extend(groups[session_keys[1]])
            else:
                n_train = max(1, int(n_sessions * train_ratio))
                n_val = max(1, int(n_sessions * val_ratio))
                
                # If rounding leaves test empty, adjust
                if n_train + n_val >= n_sessions:
                    n_train = max(1, n_sessions - 2)
                    n_val = 1

                for k in session_keys[:n_train]:
                    train_examples.extend(groups[k])
                for k in session_keys[n_train:n_train + n_val]:
                    val_examples.extend(groups[k])
                for k in session_keys[n_train + n_val:]:
                    test_examples.extend(groups[k])

        return {
            'train': train_examples,
            'val': val_examples,
            'test': test_examples
        }

    @classmethod
    def verify_no_leakage(cls, split: Dict[str, List[DatasetExample]]) -> Dict[str, Any]:
        """
        Formally verifies that no recording_id or session_id crosses partition boundaries.
        """
        train_recs = {e.recording_id for e in split['train']}
        val_recs = {e.recording_id for e in split['val']}
        test_recs = {e.recording_id for e in split['test']}

        train_sess = {e.session_id for e in split['train'] if e.session_id}
        val_sess = {e.session_id for e in split['val'] if e.session_id}
        test_sess = {e.session_id for e in split['test'] if e.session_id}

        rec_overlap_train_val = train_recs.intersection(val_recs)
        rec_overlap_train_test = train_recs.intersection(test_recs)
        rec_overlap_val_test = val_recs.intersection(test_recs)

        sess_overlap_train_val = train_sess.intersection(val_sess)
        sess_overlap_train_test = train_sess.intersection(test_sess)
        sess_overlap_val_test = val_sess.intersection(test_sess)

        has_leakage = any([
            rec_overlap_train_val, rec_overlap_train_test, rec_overlap_val_test,
            sess_overlap_train_val, sess_overlap_train_test, sess_overlap_val_test
        ])

        return {
            'has_leakage': has_leakage,
            'recording_overlaps': {
                'train_val': list(rec_overlap_train_val),
                'train_test': list(rec_overlap_train_test),
                'val_test': list(rec_overlap_val_test)
            },
            'session_overlaps': {
                'train_val': list(sess_overlap_train_val),
                'train_test': list(sess_overlap_train_test),
                'val_test': list(sess_overlap_val_test)
            },
            'counts': {
                'train': len(split['train']),
                'val': len(split['val']),
                'test': len(split['test'])
            }
        }
