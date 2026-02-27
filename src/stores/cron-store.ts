/**
 * Cron Store
 * Manages scheduled tasks (cron jobs).
 */

import { create } from 'zustand';
import { invoke, on } from '@/lib/bridge';
import type { CronJob, CronJobCreateInput } from '@/types/cron';

interface CronStatusEvent {
  jobId: string;
  enabled: boolean;
  lastRun?: { time: string; success: boolean; error?: string };
}

interface CronState {
  jobs: CronJob[];
  loading: boolean;
  error: string | null;
}

interface CronActions {
  fetchJobs: () => Promise<void>;
  createJob: (input: CronJobCreateInput) => Promise<CronJob>;
  deleteJob: (id: string) => Promise<void>;
  toggleJob: (id: string, enabled: boolean) => Promise<void>;
  runJob: (id: string) => Promise<void>;
  initStatusListener: () => () => void;
}

let _unlisten: (() => void) | null = null;

export const useCronStore = create<CronState & CronActions>()((set, get) => ({
  jobs: [],
  loading: false,
  error: null,

  fetchJobs: async () => {
    set({ loading: true, error: null });
    try {
      const jobs = await invoke<CronJob[]>('cron_list');
      set({ jobs, loading: false });
    } catch (err) {
      console.warn('Failed to fetch cron jobs:', err);
      set({ loading: false, error: String(err) });
    }
  },

  createJob: async (input) => {
    try {
      const job = await invoke<CronJob>('cron_add', { input });
      await get().fetchJobs();
      return job;
    } catch (err) {
      console.error('Failed to create cron job:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  deleteJob: async (id) => {
    try {
      await invoke('cron_remove', { id });
      await get().fetchJobs();
    } catch (err) {
      console.error('Failed to delete cron job:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  toggleJob: async (id, enabled) => {
    try {
      await invoke('cron_toggle', { id, enabled });
      set((state) => ({
        jobs: state.jobs.map((j) =>
          j.id === id ? { ...j, enabled } : j,
        ),
      }));
    } catch (err) {
      console.error('Failed to toggle cron job:', err);
      set({ error: String(err) });
      await get().fetchJobs();
    }
  },

  runJob: async (id) => {
    try {
      await invoke('cron_run', { id });
    } catch (err) {
      console.error('Failed to run cron job:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  initStatusListener: () => {
    if (_unlisten) {
      _unlisten();
      _unlisten = null;
    }

    const unlisten = on('cron_status_changed', (data: unknown) => {
      const event = data as CronStatusEvent;
      set((state) => ({
        jobs: state.jobs.map((j) => {
          if (j.id === event.jobId) {
            return {
              ...j,
              enabled: event.enabled,
              lastRun: event.lastRun
                ? { time: event.lastRun.time, success: event.lastRun.success, error: event.lastRun.error }
                : j.lastRun,
            };
          }
          return j;
        }),
      }));

      // Refetch on completion for accurate nextRun
      if (event.lastRun) {
        get().fetchJobs();
      }
    });

    _unlisten = unlisten;
    return unlisten;
  },
}));
