"""
Data schema and typing definitions for speech pronunciation dataset.
Enforces clinical ground truth integrity: only therapist-confirmed labels are valid.
"""

from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any

VALID_THERAPIST_LABELS = {'CORRECT', 'INCORRECT'}
DISQUALIFIED_LABELS = {'UNCERTAIN', 'PENDING', 'UNREVIEWED', None}

SUPPORTED_SINGLE_TARGETS = ['کا', 'کی', 'کے', 'کو']
SUPPORTED_SEQUENCE_TARGETS = ['کا، کی', 'کا، کی، کے', 'کا، کی، کے، کو']
ALL_SUPPORTED_TARGETS = SUPPORTED_SINGLE_TARGETS + SUPPORTED_SEQUENCE_TARGETS

@dataclass
class DatasetExample:
    """
    Standardized dataset example representing a therapist-evaluated recording.
    """
    recording_id: str
    exercise_id: str
    target_text: str
    target_units: List[str]
    therapist_label: str  # Must be 'CORRECT' or 'INCORRECT'
    audio_path: Optional[str] = None
    duration: float = 0.0
    speaker_id: Optional[str] = None
    session_id: Optional[str] = None
    created_at: Optional[str] = None
    therapist_remarks: Optional[str] = None
    audio_samples: Optional[List[float]] = field(default=None, repr=False)
    sample_rate: int = 16000

    def is_eligible(self) -> bool:
        """
        Validates clinical ground truth eligibility:
        Only therapist-confirmed 'CORRECT' or 'INCORRECT' are eligible for training.
        """
        if self.therapist_label not in VALID_THERAPIST_LABELS:
            return False
        if not self.target_text or not self.target_units:
            return False
        if self.duration < 0.20:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Converts to dictionary omitting large raw sample arrays for metadata export."""
        d = asdict(self)
        d.pop('audio_samples', None)
        return d
