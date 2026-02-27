/**
 * Providers Store
 * Manages AI provider configurations, API keys, and default provider.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';
import type { ProviderConfig, ProviderWithKeyInfo } from '@/lib/providers';

interface ProvidersState {
  providers: ProviderWithKeyInfo[];
  defaultProviderId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface ProvidersActions {
  fetchProviders: () => Promise<void>;
  saveProvider: (provider: ProviderConfig) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  setDefaultProvider: (id: string) => Promise<void>;
  fetchDefaultProvider: () => Promise<void>;
  saveApiKey: (providerId: string, apiKey: string) => Promise<void>;
  getApiKey: (providerId: string) => Promise<string | null>;
  deleteApiKey: (providerId: string) => Promise<void>;
  validateApiKey: (providerId: string, apiKey: string) => Promise<boolean>;
  getModels: (providerId: string) => Promise<string[]>;
}

export const useProvidersStore = create<ProvidersState & ProvidersActions>()((set, get) => ({
  providers: [],
  defaultProviderId: null,
  isLoading: false,
  error: null,

  fetchProviders: async () => {
    set({ isLoading: true, error: null });
    try {
      const providers = await invoke<ProviderWithKeyInfo[]>('get_providers');
      set({ providers, isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch providers:', err);
      set({ isLoading: false, error: String(err) });
    }
  },

  fetchDefaultProvider: async () => {
    try {
      const id = await invoke<string | null>('get_default_provider');
      set({ defaultProviderId: id });
    } catch (err) {
      console.warn('Failed to fetch default provider:', err);
    }
  },

  saveProvider: async (provider) => {
    try {
      await invoke('save_provider', { provider });
      await get().fetchProviders();
    } catch (err) {
      console.error('Failed to save provider:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  deleteProvider: async (id) => {
    try {
      await invoke('delete_provider', { id });
      await invoke('delete_api_key', { providerId: id });
      if (get().defaultProviderId === id) {
        set({ defaultProviderId: null });
      }
      await get().fetchProviders();
    } catch (err) {
      console.error('Failed to delete provider:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  setDefaultProvider: async (id) => {
    try {
      await invoke('set_default_provider', { id });
      set({ defaultProviderId: id });
    } catch (err) {
      console.error('Failed to set default provider:', err);
      throw err;
    }
  },

  saveApiKey: async (providerId, apiKey) => {
    try {
      await invoke('save_api_key', { providerId, apiKey });
      await get().fetchProviders();
    } catch (err) {
      console.error('Failed to save API key:', err);
      throw err;
    }
  },

  getApiKey: async (providerId) => {
    try {
      return await invoke<string | null>('get_api_key', { providerId });
    } catch (err) {
      console.error('Failed to get API key:', err);
      return null;
    }
  },

  deleteApiKey: async (providerId) => {
    try {
      await invoke('delete_api_key', { providerId });
      await get().fetchProviders();
    } catch (err) {
      console.error('Failed to delete API key:', err);
      throw err;
    }
  },

  validateApiKey: async (providerId, apiKey) => {
    try {
      return await invoke<boolean>('provider_validate_key', { providerId, apiKey });
    } catch (err) {
      console.error('Failed to validate API key:', err);
      return false;
    }
  },

  getModels: async (providerId) => {
    try {
      return await invoke<string[]>('ai_get_models', { providerId });
    } catch (err) {
      console.error('Failed to get models:', err);
      return [];
    }
  },
}));
