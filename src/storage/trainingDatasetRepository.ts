import { TrainingExample, Recording, Exercise, TrainingExclusionReason } from '../types';
import { getStore, STORES } from './indexedDb';

export async function saveTrainingExample(example: TrainingExample): Promise<void> {
  const { store } = await getStore(STORES.TRAINING_EXAMPLES, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(example);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getTrainingExample(id: string): Promise<TrainingExample | undefined> {
  const { store } = await getStore(STORES.TRAINING_EXAMPLES, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as TrainingExample | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getTrainingExampleByRecordingId(recordingId: string): Promise<TrainingExample | undefined> {
  const { store } = await getStore(STORES.TRAINING_EXAMPLES, 'readonly');
  return new Promise((resolve, reject) => {
    const index = store.index('recordingId');
    const request = index.get(recordingId);
    request.onsuccess = () => resolve(request.result as TrainingExample | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllTrainingExamples(): Promise<TrainingExample[]> {
  const { store } = await getStore(STORES.TRAINING_EXAMPLES, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result as TrainingExample[]) || [];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function deleteTrainingExample(id: string): Promise<void> {
  const { store } = await getStore(STORES.TRAINING_EXAMPLES, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAllTrainingExamples(): Promise<void> {
  const { store } = await getStore(STORES.TRAINING_EXAMPLES, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Creates or updates training example from a recording, preserving any manual exclusion reasons.
 */
export async function syncRecordingToTrainingExample(
  recording: Recording,
  exercise?: Exercise
): Promise<TrainingExample> {
  const existing = await getTrainingExampleByRecordingId(recording.id);

  const targetUnits = exercise?.targetUnits && exercise.targetUnits.length > 0
    ? exercise.targetUnits
    : (exercise?.targetText ? [exercise.targetText] : ['کا']);
  const targetText = exercise?.targetText || targetUnits.join('، ');

  const hasReview = !!recording.therapistResult;
  const isUncertain = recording.therapistResult === 'UNCERTAIN';
  const isTooShort = (recording.duration || 0) < 0.2;
  const isManuallyExcluded = !!recording.excludedFromTraining || (existing?.includedInTraining === false && !existing?.includedInTraining);

  // Exclusion determination
  let includedInTraining = false;
  let excludedReason: TrainingExclusionReason | undefined = undefined;

  if (isManuallyExcluded) {
    includedInTraining = false;
    excludedReason = recording.trainingExclusionReason || existing?.excludedReason || 'other';
  } else if (!hasReview) {
    includedInTraining = false;
    excludedReason = undefined; // Not excluded for defect, simply pending clinical review
  } else if (isUncertain) {
    includedInTraining = false;
    excludedReason = 'other'; // Uncertain labels not included in training
  } else if (isTooShort) {
    includedInTraining = false;
    excludedReason = 'poor audio';
  } else if (recording.therapistResult === 'CORRECT' || recording.therapistResult === 'INCORRECT') {
    includedInTraining = true;
    excludedReason = undefined;
  }

  const example: TrainingExample = {
    id: existing?.id || `te-${recording.id}`,
    recordingId: recording.id,
    exerciseId: recording.exerciseId || exercise?.id || 'ka',
    targetUnits,
    targetText,
    therapistLabel: recording.therapistResult || 'UNCERTAIN',
    therapistRemarks: recording.therapistRemarks,
    createdAt: recording.createdAt,
    therapistReviewedAt: recording.therapistReviewedAt,
    datasetVersion: existing?.datasetVersion || 1,
    includedInTraining,
    excludedReason,
    audioQuality: recording.audioQuality || {
      duration: recording.duration || 0,
      mimeType: recording.mimeType || 'audio/webm',
      decodingStatus: 'VALID'
    }
  };

  await saveTrainingExample(example);
  return example;
}

/**
 * Synchronizes all recordings and exercises into training examples.
 */
export async function syncAllTrainingExamples(
  recordings: Recording[],
  exercises: Exercise[]
): Promise<TrainingExample[]> {
  const exerciseMap = new Map<string, Exercise>();
  for (const ex of exercises) {
    exerciseMap.set(ex.id, ex);
  }

  const results: TrainingExample[] = [];
  for (const rec of recordings) {
    const ex = exerciseMap.get(rec.exerciseId);
    const example = await syncRecordingToTrainingExample(rec, ex);
    results.push(example);
  }

  return results;
}
