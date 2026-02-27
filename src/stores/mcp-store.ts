/**
 * MCP Tools Store
 * Manages MCP tool listing and execution.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';
import type { McpTool } from '@/types/mcp';

interface McpState {
  tools: McpTool[];
  selectedTool: McpTool | null;
  loading: boolean;
  calling: boolean;
  lastResult: { output: string; isError: boolean } | null;
  error: string | null;
}

interface McpActions {
  fetchTools: () => Promise<void>;
  selectTool: (tool: McpTool | null) => void;
  callTool: (name: string, args: Record<string, unknown>) => Promise<void>;
  clearResult: () => void;
}

export const useMcpStore = create<McpState & McpActions>()((set) => ({
  tools: [],
  selectedTool: null,
  loading: false,
  calling: false,
  lastResult: null,
  error: null,

  fetchTools: async () => {
    set({ loading: true, error: null });
    try {
      const tools = await invoke<McpTool[]>('mcp_list_tools');
      set({ tools, loading: false });
    } catch (err) {
      console.warn('Failed to fetch MCP tools:', err);
      set({ loading: false, error: String(err) });
    }
  },

  selectTool: (tool) => {
    set({ selectedTool: tool, lastResult: null });
  },

  callTool: async (name, args) => {
    set({ calling: true, lastResult: null, error: null });
    try {
      const result = await invoke<{ output: string }>('mcp_call_tool', {
        name,
        arguments: args,
      });
      set({ calling: false, lastResult: { output: result.output, isError: false } });
    } catch (err) {
      set({
        calling: false,
        lastResult: { output: String(err), isError: true },
      });
    }
  },

  clearResult: () => {
    set({ lastResult: null });
  },
}));
