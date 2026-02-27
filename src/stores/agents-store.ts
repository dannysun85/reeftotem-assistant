/**
 * Agents Store
 * Manages AI agent configurations.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';
import { emit } from '@tauri-apps/api/event';
import type { AgentConfig } from '@/types/agent';

interface AgentsState {
  agents: AgentConfig[];
  activeAgentId: string | null;
  isLoading: boolean;
  error: string | null;
}

interface AgentsActions {
  fetchAgents: () => Promise<void>;
  createAgent: (agent: AgentConfig) => Promise<void>;
  updateAgent: (agent: AgentConfig) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  setActiveAgent: (id: string) => Promise<void>;
  fetchActiveAgentId: () => Promise<void>;
  getActiveAgent: () => AgentConfig | undefined;
  cloneAgent: (id: string) => Promise<void>;
  exportAgent: (id: string) => AgentConfig | undefined;
  importAgent: (agent: AgentConfig) => Promise<void>;
}

export const useAgentsStore = create<AgentsState & AgentsActions>()((set, get) => ({
  agents: [],
  activeAgentId: null,
  isLoading: false,
  error: null,

  fetchAgents: async () => {
    set({ isLoading: true, error: null });
    try {
      const agents = await invoke<AgentConfig[]>('get_agents');
      set({ agents, isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch agents:', err);
      set({ isLoading: false, error: String(err) });
    }
  },

  fetchActiveAgentId: async () => {
    try {
      const id = await invoke<string | null>('get_active_agent_id');
      set({ activeAgentId: id });
    } catch (err) {
      console.warn('Failed to fetch active agent id:', err);
    }
  },

  createAgent: async (agent) => {
    try {
      await invoke('save_agent', { agent });
      await get().fetchAgents();
    } catch (err) {
      console.error('Failed to create agent:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  updateAgent: async (agent) => {
    try {
      await invoke('save_agent', { agent });
      await get().fetchAgents();
    } catch (err) {
      console.error('Failed to update agent:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  deleteAgent: async (id) => {
    try {
      await invoke('delete_agent', { id });
      if (get().activeAgentId === id) {
        set({ activeAgentId: null });
      }
      await get().fetchAgents();
    } catch (err) {
      console.error('Failed to delete agent:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  setActiveAgent: async (id) => {
    try {
      await invoke('set_active_agent', { id });
      set({ activeAgentId: id });

      // Live2D 模型自动切换：按 agent 名匹配已知模型
      const agent = get().agents.find((a) => a.id === id);
      if (agent) {
        // 使用 agent 名作为 persona，Live2D 窗口会监听此事件并切换模型
        try {
          await emit('switch_persona', { persona: agent.name });
          localStorage.setItem('currentPersona', agent.name);
        } catch {
          // 静默失败 — Live2D 窗口可能未启动
        }
      }
    } catch (err) {
      console.error('Failed to set active agent:', err);
      throw err;
    }
  },

  getActiveAgent: () => {
    const { agents, activeAgentId } = get();
    if (activeAgentId) {
      const agent = agents.find((a) => a.id === activeAgentId);
      if (agent) return agent;
    }
    // Fallback: isDefault → first
    const defaultAgent = agents.find((a) => a.isDefault);
    if (defaultAgent) return defaultAgent;
    return agents[0];
  },

  cloneAgent: async (id) => {
    const original = get().agents.find((a) => a.id === id);
    if (!original) return;
    const cloned: AgentConfig = {
      ...original,
      id: crypto.randomUUID(),
      name: `${original.name} (Copy)`,
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await get().createAgent(cloned);
  },

  exportAgent: (id) => {
    return get().agents.find((a) => a.id === id);
  },

  importAgent: async (agent) => {
    const imported: AgentConfig = {
      ...agent,
      id: crypto.randomUUID(),
      isDefault: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await get().createAgent(imported);
  },
}));
