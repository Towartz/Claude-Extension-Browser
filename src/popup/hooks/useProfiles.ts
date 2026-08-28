import { useCallback, useEffect, useState } from 'react';
import { Profile } from '../../types';
import { decryptProfiles, encryptProfiles, exportProfiles, isEncryptedPayload } from '../../utils';
import { sendBackgroundMessage } from './useMessenger';

export type BusyState = 'idle' | 'saving' | 'switching' | 'deleting' | 'renaming' | 'exporting' | 'importing' | 'clearing';

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

export function useProfiles() {
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activeProfileId, setActiveProfileId] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyState, setBusyState] = useState<BusyState>('idle');

  const fetchProfiles = useCallback(async () => {
    const data = await sendBackgroundMessage<{ profiles: Record<string, Profile>; activeProfileId?: string }>({
      type: 'GET_PROFILES'
    });
    setProfiles(data.profiles);
    setActiveProfileId(data.activeProfileId);
  }, []);

  useEffect(() => {
    fetchProfiles()
      .catch((err) => {
        setError(getErrorMessage(err, 'Failed to load profiles'));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchProfiles]);

  useEffect(() => {
    if (error === null) return;
    const timer = window.setTimeout(() => {
      setError(null);
    }, 4000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [error]);

  const save = useCallback(
    async (name: string, colorIndex: number) => {
      setBusyState('saving');
      setError(null);
      try {
        const saved = await sendBackgroundMessage<Profile>({
          type: 'SAVE_PROFILE',
          name,
          colorIndex
        });
        setProfiles((prev) => ({ ...prev, [saved.id]: saved }));
        setActiveProfileId(saved.id);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to save profile'));
        throw err;
      } finally {
        setBusyState('idle');
      }
    },
    []
  );

  const switchProfile = useCallback(
    async (id: string) => {
      setBusyState('switching');
      setError(null);
      try {
        await sendBackgroundMessage({
          type: 'SWITCH_PROFILE',
          id
        });
        setActiveProfileId(id);
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to switch profile'));
        setBusyState('idle');
        throw err;
      }
    },
    []
  );

  const deleteProfile = useCallback(
    async (id: string) => {
      setBusyState('deleting');
      setError(null);
      try {
        await sendBackgroundMessage({
          type: 'DELETE_PROFILE',
          id
        });
        setProfiles((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        setActiveProfileId((curr) => (curr === id ? undefined : curr));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to delete profile'));
        throw err;
      } finally {
        setBusyState('idle');
      }
    },
    []
  );

  const rename = useCallback(
    async (id: string, name: string) => {
      setBusyState('renaming');
      setError(null);
      try {
        const updated = await sendBackgroundMessage<Profile>({
          type: 'RENAME_PROFILE',
          id,
          name
        });
        setProfiles((prev) => ({ ...prev, [id]: updated }));
      } catch (err) {
        setError(getErrorMessage(err, 'Failed to rename profile'));
        throw err;
      } finally {
        setBusyState('idle');
      }
    },
    []
  );

  const exportEncryptedProfiles = useCallback(async (): Promise<boolean> => {
    setBusyState('exporting');
    setError(null);
    try {
      const passphrase = window.prompt(
        'Create a passphrase for this encrypted profiles backup. You will need it to import the file.'
      );
      if (passphrase === null) return false;
      if (passphrase.length < 8) {
        throw new Error('Use at least 8 characters for the backup passphrase.');
      }

      const plainExport = exportProfiles(profiles);
      const encryptedExport = await encryptProfiles(plainExport, passphrase);

      const blob = new Blob([`${JSON.stringify(encryptedExport, null, 2)}\n`], {
        type: 'application/json'
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `claude-account-switcher-profiles-encrypted-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to export profiles'));
      throw err;
    } finally {
      setBusyState('idle');
    }
  }, [profiles]);

  const importProfilesFile = useCallback(async (file: File): Promise<boolean> => {
    setBusyState('importing');
    setError(null);
    try {
      const text = await file.text();
      let parsed = JSON.parse(text);

      if (isEncryptedPayload(parsed)) {
        const passphrase = window.prompt('Enter the passphrase for this encrypted profiles backup.');
        if (passphrase === null) return false;
        parsed = await decryptProfiles(parsed, passphrase);
      }

      const res = await sendBackgroundMessage<{ profiles: Record<string, Profile>; imported: number }>({
        type: 'IMPORT_PROFILES',
        payload: parsed
      });

      setProfiles(res.profiles);
      return true;
    } catch (err) {
      setError(getErrorMessage(err, err instanceof SyntaxError ? 'Choose a valid profiles JSON file.' : 'Failed to import profiles'));
      throw err;
    } finally {
      setBusyState('idle');
    }
  }, []);

  const clearCookies = useCallback(async () => {
    setBusyState('clearing');
    setError(null);
    try {
      await sendBackgroundMessage({ type: 'CLEAR_COOKIES' });
      setActiveProfileId(undefined);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to clear cookies'));
      throw err;
    } finally {
      setBusyState('idle');
    }
  }, []);

  return {
    profiles,
    activeProfileId,
    loading,
    error,
    busyState,
    save,
    switchProfile,
    deleteProfile,
    rename,
    exportProfiles: exportEncryptedProfiles,
    importProfiles: importProfilesFile,
    clearCookies,
    clearError: () => setError(null)
  };
}
