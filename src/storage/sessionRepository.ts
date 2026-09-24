import { PracticeSession } from '../types';
import { getStore, STORES } from './indexedDb';

export async function createSession(session: PracticeSession): Promise<void> {
  const { store } = await getStore(STORES.SESSIONS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.add(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function getSession(id: string): Promise<PracticeSession | undefined> {
  const { store } = await getStore(STORES.SESSIONS, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result as PracticeSession | undefined);
    request.onerror = () => reject(request.error);
  });
}

export async function getAllSessions(): Promise<PracticeSession[]> {
  const { store } = await getStore(STORES.SESSIONS, 'readonly');
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const list = (request.result as PracticeSession[]) || [];
      // Sort newest first by startedAt
      list.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      resolve(list);
    };
    request.onerror = () => reject(request.error);
  });
}

export async function updateSession(session: PracticeSession): Promise<void> {
  const { store } = await getStore(STORES.SESSIONS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(session);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteSession(id: string): Promise<void> {
  const { store } = await getStore(STORES.SESSIONS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

export async function deleteAllSessions(): Promise<void> {
  const { store } = await getStore(STORES.SESSIONS, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}
