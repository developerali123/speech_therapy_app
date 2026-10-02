import { Exercise } from '../types';

/**
 * Factory helper to construct speech practice exercises with arbitrary target units and sequences.
 */
export function createSpeechExercise(params: {
  id: string;
  name: string;
  targetUnits: string[];
  targetText?: string;
  description?: string;
  difficulty?: 'single' | 'sequence';
  repetitions?: number;
  isActive?: boolean;
  phonemeTarget?: string;
  tips?: string[];
}): Exercise {
  const difficulty = params.difficulty || (params.targetUnits.length > 1 ? 'sequence' : 'single');
  const targetText = params.targetText || params.targetUnits.join('، ');
  return {
    id: params.id,
    name: params.name,
    targetText,
    targetUnits: params.targetUnits,
    difficulty,
    repetitions: params.repetitions ?? 1,
    description:
      params.description ||
      `Practice ${difficulty === 'sequence' ? 'sequence' : 'sound'} ${targetText} according to instructions.`,
    isActive: params.isActive ?? true,
    createdAt: new Date().toISOString(),
    phonemeTarget: params.phonemeTarget,
    tips: params.tips
  };
}

export const INITIAL_EXERCISES: Exercise[] = [
  // Canonical legacy exercise preserved for full backward compatibility
  {
    id: 'ex-qaf-ka-01',
    name: 'Qaf — Ka Practice',
    targetText: 'کا',
    targetUnits: ['کا'],
    difficulty: 'single',
    repetitions: 1,
    description: 'Practice this target according to the instructions provided by your speech therapist.',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    phonemeTarget: 'k / q',
    tips: [
      'Position your tongue body gently towards the soft palate.',
      'Take a comfortable breath before vocalizing.',
      'Listen to your recorded attempt to self-monitor clarity.'
    ]
  },

  // 1. Individual Target: Ka
  {
    id: 'ka',
    name: 'Ka Practice',
    targetText: 'کا',
    targetUnits: ['کا'],
    difficulty: 'single',
    repetitions: 1,
    description: 'Practice the single target sound Ka (کا).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    phonemeTarget: 'k / a',
    tips: [
      'Position your tongue body gently towards the soft palate.',
      'Take a comfortable breath before vocalizing.',
      'Listen to your recorded attempt to self-monitor clarity.'
    ]
  },

  // 2. Individual Target: Ki
  {
    id: 'ki',
    name: 'Ki Practice',
    targetText: 'کی',
    targetUnits: ['کی'],
    difficulty: 'single',
    repetitions: 1,
    description: 'Practice the single target sound Ki (کی).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    phonemeTarget: 'k / i',
    tips: [
      'Position your tongue high and forward for the vowel.',
      'Produce a clean, crisp velar consonant release.',
      'Keep your vocal tone clear and steady.'
    ]
  },

  // 3. Individual Target: Ke
  {
    id: 'ke',
    name: 'Ke Practice',
    targetText: 'کے',
    targetUnits: ['کے'],
    difficulty: 'single',
    repetitions: 1,
    description: 'Practice the single target sound Ke (کے).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    phonemeTarget: 'k / e',
    tips: [
      'Keep your jaw comfortably relaxed in mid position.',
      'Focus on the transition from consonant to vowel.',
      'Maintain steady airflow.'
    ]
  },

  // 4. Individual Target: Ko
  {
    id: 'ko',
    name: 'Ko Practice',
    targetText: 'کو',
    targetUnits: ['کو'],
    difficulty: 'single',
    repetitions: 1,
    description: 'Practice the single target sound Ko (کو).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    phonemeTarget: 'k / o',
    tips: [
      'Round your lips gently for the back vowel.',
      'Ensure clear velar contact at the start of the syllable.',
      'Avoid tensing your neck muscles.'
    ]
  },

  // 5. Sequence: Ka + Ki
  {
    id: 'ka-ki',
    name: 'Ka + Ki',
    targetText: 'کا، کی',
    targetUnits: ['کا', 'کی'],
    difficulty: 'sequence',
    repetitions: 1,
    description: 'Practice the sequence Ka (کا) followed by Ki (کی).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    tips: [
      'Articulate each syllable distinctly in sequence.',
      'Maintain an even rhythm between sounds.',
      'Perform the full sequence for each attempt.'
    ]
  },

  // 6. Sequence: Ka + Ki + Ke
  {
    id: 'ka-ki-ke',
    name: 'Ka + Ki + Ke',
    targetText: 'کا، کی، کے',
    targetUnits: ['کا', 'کی', 'کے'],
    difficulty: 'sequence',
    repetitions: 1,
    description: 'Practice the sequence Ka (کا) → Ki (کی) → Ke (کے).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    tips: [
      'Flow smoothly from one syllable to the next.',
      'Pay attention to tongue height adjustments across vowels.',
      'Complete the entire 3-unit sequence per repetition.'
    ]
  },

  // 7. Sequence: Ka + Ki + Ke + Ko
  {
    id: 'ka-ki-ke-ko',
    name: 'Ka + Ki + Ke + Ko',
    targetText: 'کا، کی، کے، کو',
    targetUnits: ['کا', 'کی', 'کے', 'کو'],
    difficulty: 'sequence',
    repetitions: 1,
    description: 'Practice the sequence Ka (کا) → Ki (کی) → Ke (کے) → Ko (کو).',
    isActive: true,
    createdAt: '2026-09-01T00:00:00.000Z',
    tips: [
      'Maintain deliberate articulation across all four vowels.',
      'Keep pacing steady and controlled.',
      'A full repetition includes all four target units.'
    ]
  }
];
