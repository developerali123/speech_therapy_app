import { Exercise } from '../types';

export const INITIAL_EXERCISES: Exercise[] = [
  {
    id: 'ex-qaf-ka-01',
    name: 'Qaf — Ka Practice',
    targetText: 'کا',
    description: 'Practice this target according to the instructions provided by your speech therapist.',
    isActive: true,
    createdAt: new Date().toISOString(),
    phonemeTarget: 'k / q',
    tips: [
      'Position your tongue body gently towards the soft palate.',
      'Take a comfortable breath before vocalizing.',
      'Listen to your recorded attempt to self-monitor clarity.'
    ]
  }
];
