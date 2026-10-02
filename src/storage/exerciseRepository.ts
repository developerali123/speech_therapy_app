import { Exercise } from '../types';
import { getStore, STORES } from './indexedDb';
import { INITIAL_EXERCISES } from '../data/initialExercises';

/**
 * Normalizes an exercise object ensuring targetUnits, difficulty, and repetitions
 * are present even when loaded from legacy storage.
 */
export function normalizeExercise(ex: Exercise): Exercise {
  const targetUnits = ex.targetUnits && ex.targetUnits.length > 0
    ? ex.targetUnits
    : (ex.targetText ? [ex.targetText] : ['کا']);

  const difficulty = ex.difficulty || (targetUnits.length > 1 ? 'sequence' : 'single');
  const repetitions = ex.repetitions ?? 1;

  return {
    ...ex,
    targetUnits,
    difficulty,
    repetitions
  };
}

export async function getExercises(): Promise<Exercise[]> {
  const { store } = await getStore(STORES.EXERCISES, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result as Exercise[]) || [];
      resolve(list.map(normalizeExercise));
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getExerciseById(id: string): Promise<Exercise | undefined> {
  const { store } = await getStore(STORES.EXERCISES, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const result = request.result as Exercise | undefined;
      if (result) {
        resolve(normalizeExercise(result));
      } else {
        // Alias fallback for backward compatibility
        if (id === 'ex-qaf-ka-01') {
          const fallbackReq = store.get('ka');
          fallbackReq.onsuccess = () => {
            const fallbackRes = fallbackReq.result as Exercise | undefined;
            resolve(fallbackRes ? normalizeExercise(fallbackRes) : undefined);
          };
          fallbackReq.onerror = () => reject(fallbackReq.error);
        } else if (id === 'ka') {
          const fallbackReq = store.get('ex-qaf-ka-01');
          fallbackReq.onsuccess = () => {
            const fallbackRes = fallbackReq.result as Exercise | undefined;
            resolve(fallbackRes ? normalizeExercise(fallbackRes) : undefined);
          };
          fallbackReq.onerror = () => reject(fallbackReq.error);
        } else {
          resolve(undefined);
        }
      }
    };
    request.onerror = () => reject(request.error);
  });
}

export async function saveExercise(exercise: Exercise): Promise<void> {
  const normalized = normalizeExercise(exercise);
  const { store } = await getStore(STORES.EXERCISES, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(normalized);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function seedExercises(): Promise<void> {
  const existing = await getExercises();
  const existingMap = new Map(existing.map((e) => [e.id, e]));

  for (const seedEx of INITIAL_EXERCISES) {
    if (!existingMap.has(seedEx.id)) {
      await saveExercise(seedEx);
    } else {
      // Migrate legacy records lacking targetUnits or difficulty
      const current = existingMap.get(seedEx.id)!;
      if (!current.targetUnits || current.targetUnits.length === 0 || !current.difficulty) {
        await saveExercise({
          ...current,
          targetUnits: current.targetUnits && current.targetUnits.length > 0 ? current.targetUnits : seedEx.targetUnits,
          difficulty: current.difficulty || seedEx.difficulty,
          repetitions: current.repetitions ?? seedEx.repetitions ?? 1
        });
      }
    }
  }
}
