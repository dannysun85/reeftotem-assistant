/**
 * Settings Store
 * Manages theme, language, sidebar state, and app preferences.
 * Persisted to localStorage via zustand/persist.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import i18n from '@/i18n';

export type ThemeMode = 'light' | 'dark' | 'system';
export type VoiceProvider = 'tencent' | 'dashscope';

interface SettingsState {
  theme: ThemeMode;
  language: string;
  sidebarCollapsed: boolean;
  devModeUnlocked: boolean;
  setupComplete: boolean;
  autoTtsEnabled: boolean;
  voiceProvider: VoiceProvider;
  voiceId: string;
  voiceSpeed: number;
  voiceVolume: number;
}

interface SettingsActions {
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: string) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setDevModeUnlocked: (unlocked: boolean) => void;
  setSetupComplete: (complete: boolean) => void;
  setAutoTtsEnabled: (enabled: boolean) => void;
  setVoiceProvider: (provider: VoiceProvider) => void;
  setVoiceId: (id: string) => void;
  setVoiceSpeed: (speed: number) => void;
  setVoiceVolume: (volume: number) => void;
}

function applyTheme(theme: ThemeMode) {
  const root = document.documentElement;
  if (theme === 'system') {
    const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    root.classList.toggle('dark', systemDark);
  } else {
    root.classList.toggle('dark', theme === 'dark');
  }
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      theme: 'system',
      language: 'zh',
      sidebarCollapsed: false,
      devModeUnlocked: false,
      setupComplete: false,
      autoTtsEnabled: true,
      voiceProvider: 'tencent',
      voiceId: '1001',
      voiceSpeed: 0,
      voiceVolume: 5,

      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },

      setLanguage: (language) => {
        i18n.changeLanguage(language);
        set({ language });
      },

      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      setDevModeUnlocked: (unlocked) => set({ devModeUnlocked: unlocked }),

      setSetupComplete: (complete) => set({ setupComplete: complete }),

      setAutoTtsEnabled: (enabled) => set({ autoTtsEnabled: enabled }),

      setVoiceProvider: (provider) => set({ voiceProvider: provider }),
      setVoiceId: (id) => set({ voiceId: id }),
      setVoiceSpeed: (speed) => set({ voiceSpeed: speed }),
      setVoiceVolume: (volume) => set({ voiceVolume: volume }),
    }),
    {
      name: 'reeftotem-settings',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyTheme(state.theme);
          i18n.changeLanguage(state.language);
        }
      },
    }
  )
);
