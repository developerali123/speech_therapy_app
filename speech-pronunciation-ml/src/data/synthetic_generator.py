"""
Synthetic acoustic benchmark generator.
Generates realistic acoustic waveforms with acoustic phoneme characteristics
for Urdu targets:
1. کا (/k/ burst + /aː/ open back vowel: F1~750Hz, F2~1100Hz)
2. کی (/k/ burst + /iː/ close front vowel: F1~280Hz, F2~2300Hz)
3. کے (/k/ burst + /eː/ close-mid front vowel: F1~450Hz, F2~1900Hz)
4. کو (/k/ burst + /oː/ close-mid back rounded: F1~500Hz, F2~900Hz)

Generates both CORRECT realizations (proper velar burst + formant trajectory)
and INCORRECT realizations (e.g., fronted alveolar /t/ substitution, distorted formants, or breathy noise)
for rigorous benchmark experiments.
"""

import math
import random
from typing import List, Dict, Tuple, Any
from .schema import DatasetExample
from ..audio.normalizer import AudioNormalizer

class SyntheticBenchmarkGenerator:
    """
    Generates synthetic speech examples for training and testing ML pipelines.
    """

    TARGET_FORMANTS = {
        'کا': {'f1': 750.0, 'f2': 1100.0, 'f3': 2500.0, 'burst_freq': 1800.0},
        'کی': {'f1': 280.0, 'f2': 2300.0, 'f3': 2900.0, 'burst_freq': 2800.0},
        'کے': {'f1': 450.0, 'f2': 1900.0, 'f3': 2600.0, 'burst_freq': 2200.0},
        'کو': {'f1': 500.0, 'f2': 900.0,  'f3': 2400.0, 'burst_freq': 1400.0}
    }

    @classmethod
    def generate_single_sample(
        cls,
        target_text: str,
        is_correct: bool,
        duration: float = 0.80,
        sample_rate: int = 16000,
        seed: Optional[int] = None
    ) -> List[float]:
        """
        Synthesizes a single audio waveform with acoustic formants and noise.
        """
        rng = random.Random(seed)
        num_samples = int(duration * sample_rate)
        samples = [0.0] * num_samples

        formants = cls.TARGET_FORMANTS.get(target_text, cls.TARGET_FORMANTS['کا'])

        # Burst parameters (first 10-30ms)
        burst_duration = 0.025
        burst_samples = int(burst_duration * sample_rate)
        
        # In correct realizations, velar burst energy aligns with burst_freq
        burst_freq = formants['burst_freq'] if is_correct else (4000.0 if rng.random() > 0.5 else 900.0)

        # 1. Velar Stop Consonant Phase (/k/ release)
        for i in range(burst_samples):
            t = i / sample_rate
            env = math.exp(-t * 120.0)
            noise = (rng.random() * 2.0 - 1.0) * 0.4
            tone = math.sin(2.0 * math.pi * burst_freq * t) * 0.6
            samples[i] = (noise + tone) * env

        # 2. Vowel Formant Phase
        vowel_start = burst_samples
        f0 = 130.0 + rng.uniform(-10.0, 10.0)  # Pitch fundamental

        # If incorrect: perturb formants or add acoustic deviation
        f1 = formants['f1'] if is_correct else formants['f1'] * rng.choice([0.6, 1.4])
        f2 = formants['f2'] if is_correct else formants['f2'] * rng.choice([0.65, 1.35])
        f3 = formants['f3']

        for i in range(vowel_start, num_samples):
            t = (i - vowel_start) / sample_rate
            vowel_len = (num_samples - vowel_start) / sample_rate
            
            # Smooth envelope attack and decay
            attack = min(1.0, t / 0.04)
            decay = max(0.0, 1.0 - (t / vowel_len))
            env = attack * decay

            # Source excitation (pulse train)
            source = math.sin(2.0 * math.pi * f0 * t) + 0.5 * math.sin(4.0 * math.pi * f0 * t)

            # Resonances
            r1 = math.sin(2.0 * math.pi * f1 * t) * 0.5
            r2 = math.sin(2.0 * math.pi * f2 * t) * 0.35
            r3 = math.sin(2.0 * math.pi * f3 * t) * 0.15
            
            # Ambient background room noise
            bg_noise = (rng.random() * 2.0 - 1.0) * 0.015

            samples[i] = (source * (r1 + r2 + r3) * 0.75 + bg_noise) * env

        # Amplitude normalize
        return AudioNormalizer.normalize_amplitude(samples, target_peak=0.92)

    @classmethod
    def generate_benchmark_dataset(
        cls,
        samples_per_target: int = 15,
        imbalance_ratio: float = 0.55,
        seed: int = 42
    ) -> List[DatasetExample]:
        """
        Generates a balanced benchmark dataset across the 4 targets (کا, کی, کے, کو).
        """
        rng = random.Random(seed)
        dataset: List[DatasetExample] = []
        targets = ['کا', 'کی', 'کے', 'کو']

        sample_idx = 1
        for target in targets:
            for i in range(samples_per_target):
                # Class assignment
                is_correct = rng.random() < imbalance_ratio
                label = 'CORRECT' if is_correct else 'INCORRECT'
                session_id = f"sess_{target}_{i // 3 + 1}"  # 3 attempts per session to test session-aware splitting
                
                duration = rng.uniform(0.60, 1.10)
                audio_samples = cls.generate_single_sample(
                    target_text=target,
                    is_correct=is_correct,
                    duration=duration,
                    seed=rng.randint(1, 100000)
                )

                ex = DatasetExample(
                    recording_id=f"rec_syn_{sample_idx:04d}",
                    exercise_id=target,
                    target_text=target,
                    target_units=[target],
                    therapist_label=label,
                    audio_path=f"synthetic/{target}_{sample_idx:04d}.wav",
                    duration=round(duration, 2),
                    speaker_id=f"spk_{target}_{(i % 4) + 1}",
                    session_id=session_id,
                    created_at="2026-10-01T12:00:00Z",
                    therapist_remarks=f"Therapist confirmed {label} for {target}",
                    audio_samples=audio_samples
                )
                dataset.append(ex)
                sample_idx += 1

        return dataset
