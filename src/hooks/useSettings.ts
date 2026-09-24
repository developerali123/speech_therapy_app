import { useState, useEffect, useCallback } from 'react';
import { AppSettings } from '../types';
import { getSettings, saveSettings } from '../storage/settingsRepository';

export function useSettings() {
  const [settings, setSettingsState] = useState<AppSettings>({
    dailyGoal: 10,
    userName: ''
  });
  const [loading, setLoading] = useState<boolean>(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getSettings();
      setSettingsState(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const updateSettings = useCallback(async (newSettings: Partial<AppSettings>) => {
    const merged = { ...settings, ...newSettings };
    await saveSettings(merged);
    setSettingsState(merged);
  }, [settings]);

  return {
    settings,
    loading,
    updateSettings,
    refreshSettings: load
  };
}
