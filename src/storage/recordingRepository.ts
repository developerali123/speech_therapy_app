import { Recording } from '../types';
import { getStore, STORES } from './indexedDb';

export async function createRecording(recording: Recording): Promise<void> {
  const { store } = await getStore(STORES.RECORDINGS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.add(recording);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getRecording(id: string): Promise<Recording | undefined> {
  const { store } = await getStore(STORES.RECORDINGS, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as Recording | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllRecordings(): Promise<Recording[]> {
  const { store } = await getStore(STORES.RECORDINGS, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result as Recording[]) || [];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordingsBySession(sessionId: string): Promise<Recording[]> {
  const { store } = await getStore(STORES.RECORDINGS, 'readonly');
  return new Promise((resolve, reject) => {
    const index = store.index('sessionId');
    const request = index.getAll(sessionId);
    request.onsuccess = () => {
      const list = (request.result as Recording[]) || [];
      // Sort in ascending order of creation / attempt number
      list.sort((a, b) => {
        if (a.attemptNumber && b.attemptNumber) {
          return a.attemptNumber - b.attemptNumber;
        }
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function getRecordingsByExercise(exerciseId: string): Promise<Recording[]> {
  const { store } = await getStore(STORES.RECORDINGS, 'readonly');
  return new Promise((resolve, reject) => {
    const index = store.index('exerciseId');
    const request = index.getAll(exerciseId);
    request.onsuccess = () => {
      const list = (request.result as Recording[]) || [];
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateRecording(recording: Recording): Promise<void> {
  const { store } = await getStore(STORES.RECORDINGS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(recording);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteRecording(id: string): Promise<void> {
  const { store } = await getStore(STORES.RECORDINGS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAllRecordings(): Promise<void> {
  const { store } = await getStore(STORES.RECORDINGS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
