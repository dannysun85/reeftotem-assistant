/**
 * A2A (Agent-to-Agent) Store
 * Manages delegation listing, creation, and cancellation.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';
import type { Delegation } from '@/types/a2a';

interface A2AState {
  delegations: Delegation[];
  loading: boolean;
  creating: boolean;
  error: string | null;
}

interface A2AActions {
  fetchDelegations: () => Promise<void>;
  createDelegation: (
    fromAgentId: string,
    toAgentId: string,
    task: string,
    context?: string,
  ) => Promise<void>;
  cancelDelegation: (id: string) => Promise<void>;
}

export const useA2AStore = create<A2AState & A2AActions>()((set, get) => ({
  delegations: [],
  loading: false,
  creating: false,
  error: null,

  fetchDelegations: async () => {
    set({ loading: true, error: null });
    try {
      const delegations = await invoke<Delegation[]>('a2a_list');
      set({ delegations, loading: false });
    } catch (err) {
      console.warn('Failed to fetch delegations:', err);
      set({ loading: false, error: String(err) });
    }
  },

  createDelegation: async (fromAgentId, toAgentId, task, context) => {
    set({ creating: true, error: null });
    try {
      await invoke('a2a_delegate', {
        fromAgentId,
        toAgentId,
        task,
        context: context || null,
      });
      set({ creating: false });
      await get().fetchDelegations();
    } catch (err) {
      console.error('Failed to create delegation:', err);
      set({ creating: false, error: String(err) });
      throw err;
    }
  },

  cancelDelegation: async (id) => {
    try {
      await invoke('a2a_cancel', { id });
      await get().fetchDelegations();
    } catch (err) {
      console.error('Failed to cancel delegation:', err);
      set({ error: String(err) });
      throw err;
    }
  },
}));
