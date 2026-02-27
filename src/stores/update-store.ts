/**
 * Update Store
 * Manages application auto-update state.
 */

import { create } from 'zustand';
import { invoke, on } from '@/lib/bridge';

interface UpdateInfo {
  version: string;
  date: string;
  body: string;
}

interface UpdateState {
  available: boolean;
  checking: boolean;
  downloading: boolean;
  progress: number;
  updateInfo: UpdateInfo | null;
  error: string | null;
  lastChecked: string | null;
}

interface UpdateActions {
  checkForUpdate: () => Promise<void>;
  downloadAndInstall: () => Promise<void>;
  dismissUpdate: () => void;
  initListener: () => () => void;
}

let _unlisten: (() => void) | null = null;

export const useUpdateStore = create<UpdateState & UpdateActions>()((set, get) => ({
  available: false,
  checking: false,
  downloading: false,
  progress: 0,
  updateInfo: null,
  error: null,
  lastChecked: null,

  checkForUpdate: async () => {
    set({ checking: true, error: null });
    try {
      const info = await invoke<UpdateInfo | null>('check_for_update');
      set({
        checking: false,
        available: info != null,
        updateInfo: info,
        lastChecked: new Date().toISOString(),
      });
    } catch (err) {
      set({ checking: false, error: String(err) });
    }
  },

  downloadAndInstall: async () => {
    set({ downloading: true, progress: 0, error: null });
    try {
      await invoke('download_and_install_update');
      // App will restart after install — this may not be reached
      set({ downloading: false, progress: 100 });
    } catch (err) {
      set({ downloading: false, error: String(err) });
    }
  },

  dismissUpdate: () => {
    set({ available: false, updateInfo: null });
  },

  initListener: () => {
    if (_unlisten) return _unlisten;

    const cleanup = on('update_download_progress', (data) => {
      const payload = data as { progress: number };
      set({ progress: payload.progress });
    });

    _unlisten = () => {
      cleanup();
      _unlisten = null;
    };

    return _unlisten;
  },
}));
