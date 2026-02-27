/**
 * Skills Store
 * Manages installed skills and marketplace browsing.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';
import type { Skill, MarketplaceSkill } from '@/types/skill';

interface SkillsState {
  skills: Skill[];
  marketplaceResults: MarketplaceSkill[];
  loading: boolean;
  searching: boolean;
  error: string | null;
}

interface SkillsActions {
  fetchSkills: () => Promise<void>;
  toggleSkill: (id: string, enabled: boolean) => Promise<void>;
  updateSkillConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  searchMarketplace: (query: string) => Promise<void>;
  installSkill: (slug: string) => Promise<void>;
  uninstallSkill: (id: string) => Promise<void>;
}

export const useSkillsStore = create<SkillsState & SkillsActions>()((set, get) => ({
  skills: [],
  marketplaceResults: [],
  loading: false,
  searching: false,
  error: null,

  fetchSkills: async () => {
    set({ loading: true, error: null });
    try {
      const skills = await invoke<Skill[]>('skill_list');
      set({ skills, loading: false });
    } catch (err) {
      console.warn('Failed to fetch skills:', err);
      set({ loading: false, error: String(err) });
    }
  },

  toggleSkill: async (id, enabled) => {
    try {
      await invoke('skill_toggle', { id, enabled });
      // Optimistic update
      set((state) => ({
        skills: state.skills.map((s) =>
          s.id === id ? { ...s, enabled } : s,
        ),
      }));
    } catch (err) {
      console.error('Failed to toggle skill:', err);
      set({ error: String(err) });
      // Revert on error
      await get().fetchSkills();
    }
  },

  updateSkillConfig: async (id, config) => {
    try {
      await invoke('skill_update_config', { id, config });
      set((state) => ({
        skills: state.skills.map((s) =>
          s.id === id ? { ...s, config } : s,
        ),
      }));
    } catch (err) {
      console.error('Failed to update skill config:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  searchMarketplace: async (query) => {
    set({ searching: true, error: null });
    try {
      // Allow empty query — backend returns all skills when query is empty
      const results = await invoke<MarketplaceSkill[]>('skill_search_marketplace', { query: query ?? '' });
      set({ marketplaceResults: results, searching: false });
    } catch (err) {
      console.warn('Marketplace search failed:', err);
      set({ marketplaceResults: [], searching: false, error: String(err) });
    }
  },

  installSkill: async (slug) => {
    try {
      await invoke('skill_install', { slug });
      await get().fetchSkills();
    } catch (err) {
      console.error('Failed to install skill:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  uninstallSkill: async (id) => {
    try {
      await invoke('skill_uninstall', { id });
      await get().fetchSkills();
    } catch (err) {
      console.error('Failed to uninstall skill:', err);
      set({ error: String(err) });
      throw err;
    }
  },
}));
