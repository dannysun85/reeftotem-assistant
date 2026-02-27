/**
 * Spotlight Store
 * Manages the spotlight quick-launcher state.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';

interface SpotlightState {
  query: string;
  response: string | null;
  thinking: boolean;
  error: string | null;
  clipboardType: 'text' | 'url' | 'code' | 'image' | null;
  clipboardPreview: string | null;
}

interface SpotlightActions {
  setQuery: (q: string) => void;
  submit: (query: string) => Promise<void>;
  clearResponse: () => void;
  detectClipboard: () => Promise<void>;
  hide: () => Promise<void>;
}

export const useSpotlightStore = create<SpotlightState & SpotlightActions>()((set) => ({
  query: '',
  response: null,
  thinking: false,
  error: null,
  clipboardType: null,
  clipboardPreview: null,

  setQuery: (q) => set({ query: q }),

  submit: async (query) => {
    set({ thinking: true, error: null, response: null });
    try {
      // Use local AI chat for quick spotlight queries
      const { useProvidersStore } = await import('@/stores/providers-store');
      const { defaultProviderId, providers } = useProvidersStore.getState();
      const providerId = defaultProviderId || providers[0]?.id;
      if (!providerId) {
        set({ error: 'No provider configured', thinking: false });
        return;
      }
      // For spotlight, we use non-streaming AI call via the session mechanism
      const sessionKey = `spotlight-${Date.now()}`;
      await invoke('ai_chat_send', {
        request: {
          sessionKey,
          providerId,
          messages: [{ role: 'user', content: query }],
          systemPrompt: 'You are a helpful assistant. Be concise.',
          maxTokens: 500,
        },
      });
      // The response will come via events - for spotlight, we set a temporary listener
      const { listen } = await import('@tauri-apps/api/event');
      const unlisten = await listen<{ sessionKey: string; fullText: string }>('ai_chat_final', (event) => {
        if (event.payload.sessionKey === sessionKey) {
          set({ response: event.payload.fullText, thinking: false });
          unlisten();
        }
      });
      // Also listen for errors
      const unlistenErr = await listen<{ sessionKey: string; error: string }>('ai_chat_error', (event) => {
        if (event.payload.sessionKey === sessionKey) {
          set({ error: event.payload.error, thinking: false });
          unlistenErr();
          unlisten();
        }
      });
    } catch (err) {
      console.error('Spotlight submit failed:', err);
      set({ error: String(err), thinking: false });
    }
  },

  clearResponse: () => set({ response: null, error: null }),

  detectClipboard: async () => {
    try {
      const info = await invoke<{ type: string; preview: string }>('spotlight_detect_clipboard');
      set({
        clipboardType: info.type as SpotlightState['clipboardType'],
        clipboardPreview: info.preview,
      });
    } catch {
      set({ clipboardType: null, clipboardPreview: null });
    }
  },

  hide: async () => {
    try {
      await invoke('spotlight_hide');
    } catch (err) {
      console.error('Failed to hide spotlight:', err);
    }
    set({ query: '', response: null, error: null });
  },
}));
