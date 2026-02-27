/**
 * useOpenClawStatus — read-only hook for OpenClaw engine status.
 * Listens to `openclaw_status` Tauri events and provides current state.
 * Used by Settings developer panel and internal components.
 */

import { useState, useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@/lib/bridge';

export interface OpenClawStatus {
  state: 'running' | 'stopped' | 'starting' | 'error';
  port: number;
  pid: number | null;
  error: string | null;
}

const DEFAULT_STATUS: OpenClawStatus = {
  state: 'stopped',
  port: 18789,
  pid: null,
  error: null,
};

export function useOpenClawStatus() {
  const [status, setStatus] = useState<OpenClawStatus>(DEFAULT_STATUS);

  useEffect(() => {
    // Fetch initial status
    invoke<OpenClawStatus>('get_openclaw_status')
      .then(setStatus)
      .catch(() => {});

    // Listen for status changes
    const unlisten = listen<OpenClawStatus>('openclaw_status', (event) => {
      setStatus(event.payload);
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  return status;
}
