/**
 * Channels Store
 * Manages messaging channels (Telegram, Discord, WhatsApp, etc.)
 * Handles CRUD operations, credential validation, and real-time status updates.
 */

import { create } from 'zustand';
import { invoke, on } from '@/lib/bridge';
import type { Channel, ChannelType } from '@/types/channel';

interface ChannelStatusEvent {
  channelId: string;
  status: Channel['status'];
  error?: string;
}

interface ChannelsState {
  channels: Channel[];
  loading: boolean;
  error: string | null;
}

interface ChannelsActions {
  fetchChannels: () => Promise<void>;
  addChannel: (type: ChannelType, name: string, config: Record<string, string>) => Promise<Channel>;
  removeChannel: (id: string) => Promise<void>;
  updateChannel: (id: string, updates: Partial<Channel>) => Promise<void>;
  validateCredentials: (type: ChannelType, config: Record<string, string>) => Promise<boolean>;
  initStatusListener: () => () => void;
}

// 模块级变量：防止重复注册监听器
let _unlisten: (() => void) | null = null;

export const useChannelsStore = create<ChannelsState & ChannelsActions>()((set, get) => ({
  channels: [],
  loading: false,
  error: null,

  fetchChannels: async () => {
    set({ loading: true, error: null });
    try {
      const channels = await invoke<Channel[]>('channel_list');
      set({ channels, loading: false });
    } catch (err) {
      console.warn('Failed to fetch channels:', err);
      set({ loading: false, error: String(err) });
    }
  },

  addChannel: async (type, name, config) => {
    try {
      const channel = await invoke<Channel>('channel_add', {
        channelType: type,
        name,
        config,
      });
      await get().fetchChannels();
      return channel;
    } catch (err) {
      console.error('Failed to add channel:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  removeChannel: async (id) => {
    try {
      await invoke('channel_remove', { id });
      await get().fetchChannels();
    } catch (err) {
      console.error('Failed to remove channel:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  updateChannel: async (id, updates) => {
    try {
      await invoke('channel_update', { id, updates });
      await get().fetchChannels();
    } catch (err) {
      console.error('Failed to update channel:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  validateCredentials: async (type, config) => {
    try {
      const valid = await invoke<boolean>('channel_validate_credentials', {
        channelType: type,
        config,
      });
      return valid;
    } catch (err) {
      console.error('Failed to validate credentials:', err);
      return false;
    }
  },

  initStatusListener: () => {
    // 清理上一个监听器，防止累积
    if (_unlisten) {
      _unlisten();
      _unlisten = null;
    }

    const unlisten = on('channel_status_changed', (data: unknown) => {
      const event = data as ChannelStatusEvent;
      // Update channel status locally for immediate UI feedback
      set((state) => ({
        channels: state.channels.map((ch) => {
          if (ch.id === event.channelId) {
            return {
              ...ch,
              status: event.status,
              error: event.error,
            };
          }
          return ch;
        }),
      }));

      // Refetch on terminal states to get accurate server data
      if (event.status === 'connected' || event.status === 'error') {
        get().fetchChannels();
      }
    });

    _unlisten = unlisten;
    return unlisten;
  },
}));
