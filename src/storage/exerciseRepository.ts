import { Exercise } from '../types';
import { getStore, STORES } from './indexedDb';
import { INITIAL_EXERCISES } from '../data/initialExercises';

export async function getExercises(): Promise<Exercise[]> {
  const { store } = await getStore(STORES.EXERCISES, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result as Exercise[]);
    request.onerror = () => reject(request.error);
  });
}

export async function getExerciseById(id: string): Promise<Exercise | undefined> {
  const { store } = await getStore(STORES.EXERCISES, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Exercise | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  const { store } = await getStore(STORES.EXERCISES, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(exercise);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function seedExercises(): Promise<void> {
  const existing = await getExercises();
  if (existing.length === 0) {
    for (const ex of INITIAL_EXERCISES) {
      await saveExercise(ex);
    }
  }
}
