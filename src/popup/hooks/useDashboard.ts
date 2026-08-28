import { useCallback, useEffect, useState } from 'react';
import { UsageDashboard } from '../../types';
import { formatDashboard } from '../../utils';
import { sendBackgroundMessage } from './useMessenger';

function getDefaultDashboard(): UsageDashboard {
  return formatDashboard({ session: { pct: 0, resetAt: null } });
}

export function useDashboard() {
  const [dashboard, setDashboard] = useState<UsageDashboard>(getDefaultDashboard);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (force = false) => {
    if (force) {
      setLoading(true);
    }
    try {
      setError(null);
      const msgType = force ? 'REFRESH_USAGE' : 'GET_USAGE_DASHBOARD';
      const data = await sendBackgroundMessage<UsageDashboard>({ type: msgType });
      if (data?.session) {
        setDashboard(data);
      }
    } catch (err) {
      if (force) {
        setError(err instanceof Error ? err.message : 'Failed to refresh Claude usage.');
      }
    } finally {
      if (force) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Initial mount: load local cached dashboard (zero network requests)
    refresh(false);
  }, [refresh]);

  return { dashboard, loading, error, refresh };
}
