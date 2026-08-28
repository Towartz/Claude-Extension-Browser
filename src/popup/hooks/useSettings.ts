import { useCallback, useEffect, useState } from 'react';
import { Settings } from '../../types';
import { sendBackgroundMessage } from './useMessenger';

const DEFAULT_SETTINGS: Settings = {
  showProgressBar: true,
  notificationsEnabled: false,
  theme: 'auto'
};

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    sendBackgroundMessage<Settings>({ type: 'GET_SETTINGS' })
      .then((data) => {
        setSettings({ ...DEFAULT_SETTINGS, ...data });
      })
      .catch(() => {});
  }, []);

  const updateSettings = useCallback(async (partial: Partial<Settings>) => {
    try {
      const updated = await sendBackgroundMessage<Settings>({
        type: 'SET_SETTINGS',
        settings: partial
      });
      setSettings({ ...DEFAULT_SETTINGS, ...updated });
    } catch {}
  }, []);

  return { settings, updateSettings };
}
