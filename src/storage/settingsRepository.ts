import { AppSettings } from '../types';
import { getStore, STORES } from './indexedDb';

const SETTINGS_KEY = 'app-user-settings';

const DEFAULT_SETTINGS: AppSettings = {
  dailyGoal: 10,
  userName: ''
};

export async function getSettings(): Promise<AppSettings> {
  try {
    const { store } = await getStore(STORES.SETTINGS, 'readonly');
    return new Promise((resolve) => {
      const request = store.get(SETTINGS_KEY);
      request.onsuccess = () => {
        if (request.result) {
          resolve({ ...DEFAULT_SETTINGS, ...request.result });
        } else {
          // Check localStorage as fallback if any
          const local = localStorage.getItem(SETTINGS_KEY);
          if (local) {
            try {
              resolve({ ...DEFAULT_SETTINGS, ...JSON.parse(local) });
              return;
            } catch {
              // fallback
            }
          }
          resolve(DEFAULT_SETTINGS);
        }
      };
      request.onerror = () => {
        resolve(DEFAULT_SETTINGS);
      };
    });
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  // Save to IndexedDB
  const { store } = await getStore(STORES.SETTINGS, 'readwrite');
  await new Promise<void>((resolve, reject) => {
    const request = store.put({ ...settings, id: SETTINGS_KEY });
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });

  // Also mirror to localStorage for lightweight instant access
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}
