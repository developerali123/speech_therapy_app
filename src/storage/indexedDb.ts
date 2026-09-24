const DB_NAME = 'speech-practice-assistant';
const DB_VERSION = 2;

export const STORES = {
  EXERCISES: 'exercises',
  SESSIONS: 'sessions',
  RECORDINGS: 'recordings',
  SETTINGS: 'settings',
  CALIBRATION: 'calibration'
} as const;

let dbPromise: Promise<IDBDatabase> | null = null;

export function openAppDatabase(): Promise<IDBDatabase> {
  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is not supported in this browser.'));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Exercises Store
      if (!db.objectStoreNames.contains(STORES.EXERCISES)) {
        db.createObjectStore(STORES.EXERCISES, { keyPath: 'id' });
      }

      // Sessions Store
      if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
        const sessionStore = db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('exerciseId', 'exerciseId', { unique: false });
        sessionStore.createIndex('startedAt', 'startedAt', { unique: false });
      }

      // Recordings Store
      if (!db.objectStoreNames.contains(STORES.RECORDINGS)) {
        const recordingStore = db.createObjectStore(STORES.RECORDINGS, { keyPath: 'id' });
        recordingStore.createIndex('sessionId', 'sessionId', { unique: false });
        recordingStore.createIndex('exerciseId', 'exerciseId', { unique: false });
        recordingStore.createIndex('createdAt', 'createdAt', { unique: false });
      }

      // Settings Store
      if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
        db.createObjectStore(STORES.SETTINGS, { keyPath: 'id' });
      }

      // Calibration Reference Examples Store
      if (!db.objectStoreNames.contains(STORES.CALIBRATION)) {
        const calStore = db.createObjectStore(STORES.CALIBRATION, { keyPath: 'id' });
        calStore.createIndex('exerciseId', 'exerciseId', { unique: false });
        calStore.createIndex('label', 'label', { unique: false });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error || new Error('Failed to open database'));
    };

    request.onblocked = () => {
      console.warn('Database open blocked. Please close other open tabs of this app.');
    };
  });

  return dbPromise;
}

export async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<{ store: IDBObjectStore; transaction: IDBTransaction }> {
  const db = await openAppDatabase();
  const transaction = db.transaction(storeName, mode);
  const store = transaction.objectStore(storeName);
  return { store, transaction };
}

export function closeDatabase(): void {
  if (dbPromise) {
    dbPromise.then(db => db.close()).catch(() => {});
    dbPromise = null;
  }
}

export async function deleteEntireDatabase(): Promise<void> {
  closeDatabase();
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      console.warn('Database delete blocked');
      resolve();
    };
  });
}
