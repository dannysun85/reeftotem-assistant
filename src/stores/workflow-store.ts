/**
 * Workflow Store
 * Manages workflows, runs, execution, and progress events.
 */

import { create } from 'zustand';
import { invoke, on } from '@/lib/bridge';
import type {
  WorkflowConfig,
  WorkflowRun,
  WorkflowTemplate,
} from '@/types/workflow';

interface StepProgressEvent {
  runId: string;
  nodeId: string;
  status: string;
  output?: string;
  error?: string;
}

interface WorkflowState {
  workflows: WorkflowConfig[];
  currentWorkflowId: string | null;
  runs: WorkflowRun[];
  activeRun: WorkflowRun | null;
  loading: boolean;
  error: string | null;
  running: boolean;
}

interface WorkflowActions {
  fetchWorkflows: () => Promise<void>;
  createWorkflow: (config: Record<string, unknown>) => Promise<WorkflowConfig>;
  updateWorkflow: (id: string, config: Record<string, unknown>) => Promise<WorkflowConfig>;
  deleteWorkflow: (id: string) => Promise<void>;
  setCurrentWorkflow: (id: string | null) => void;
  runWorkflow: (id: string, input?: string) => Promise<string>;
  cancelRun: (runId: string) => Promise<void>;
  fetchRuns: (workflowId?: string) => Promise<void>;
  deleteRun: (runId: string) => Promise<void>;
  clearRuns: (workflowId: string) => Promise<void>;
  createFromTemplate: (template: WorkflowTemplate) => Promise<WorkflowConfig>;
  duplicateWorkflow: (id: string) => Promise<WorkflowConfig>;
  exportWorkflow: (id: string) => WorkflowConfig | null;
  importWorkflow: (config: Record<string, unknown>) => Promise<WorkflowConfig>;
  initRunListener: () => () => void;
}

// 模块级变量：防止重复注册监听器
let _runListenerUnlisten: (() => void) | null = null;

export const useWorkflowStore = create<WorkflowState & WorkflowActions>()((set, get) => ({
  workflows: [],
  currentWorkflowId: null,
  runs: [],
  activeRun: null,
  loading: false,
  error: null,
  running: false,

  fetchWorkflows: async () => {
    set({ loading: true, error: null });
    try {
      const wfs = await invoke<WorkflowConfig[]>('workflow_list');
      set({ workflows: wfs, loading: false });
    } catch (err) {
      console.warn('Failed to fetch workflows:', err);
      set({ loading: false, error: String(err) });
    }
  },

  createWorkflow: async (config) => {
    try {
      const wf = await invoke<WorkflowConfig>('workflow_create', { config });
      await get().fetchWorkflows();
      return wf;
    } catch (err) {
      console.error('Failed to create workflow:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  updateWorkflow: async (id, config) => {
    try {
      const wf = await invoke<WorkflowConfig>('workflow_update', { id, config });
      await get().fetchWorkflows();
      return wf;
    } catch (err) {
      console.error('Failed to update workflow:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  deleteWorkflow: async (id) => {
    try {
      await invoke('workflow_delete', { id });
      if (get().currentWorkflowId === id) {
        set({ currentWorkflowId: null, runs: [] });
      }
      await get().fetchWorkflows();
    } catch (err) {
      console.error('Failed to delete workflow:', err);
      set({ error: String(err) });
      throw err;
    }
  },

  setCurrentWorkflow: (id) => {
    set({ currentWorkflowId: id, runs: [], activeRun: null });
    if (id) {
      get().fetchRuns(id);
    }
  },

  runWorkflow: async (id, input) => {
    try {
      set({ running: true });
      const runId = await invoke<string>('workflow_run', { workflowId: id, input: input || null });
      // Create skeleton activeRun
      set({
        activeRun: {
          id: runId,
          workflowId: id,
          status: 'running',
          triggerType: 'manual',
          triggerInput: input,
          startedAt: Date.now(),
          steps: [],
        },
      });
      return runId;
    } catch (err) {
      console.error('Failed to run workflow:', err);
      set({ running: false, error: String(err) });
      throw err;
    }
  },

  cancelRun: async (runId) => {
    try {
      await invoke('workflow_cancel', { runId });
    } catch (err) {
      console.error('Failed to cancel run:', err);
    }
  },

  fetchRuns: async (workflowId) => {
    const wfId = workflowId || get().currentWorkflowId;
    if (!wfId) return;
    try {
      const runs = await invoke<WorkflowRun[]>('workflow_list_runs', { workflowId: wfId, limit: 50 });
      set({ runs });
    } catch (err) {
      console.warn('Failed to fetch runs:', err);
    }
  },

  deleteRun: async (runId) => {
    try {
      await invoke('workflow_delete_run', { id: runId });
      await get().fetchRuns();
    } catch (err) {
      console.error('Failed to delete run:', err);
    }
  },

  clearRuns: async (workflowId) => {
    try {
      await invoke('workflow_clear_runs', { workflowId });
      set({ runs: [] });
    } catch (err) {
      console.error('Failed to clear runs:', err);
    }
  },

  createFromTemplate: async (template) => {
    const config = {
      name: template.name,
      description: template.description,
      icon: template.icon,
      nodes: template.nodes,
      edges: template.edges,
      triggers: template.triggers,
    };
    return get().createWorkflow(config);
  },

  duplicateWorkflow: async (id) => {
    const wf = get().workflows.find((w) => w.id === id);
    if (!wf) throw new Error('Workflow not found');
    const config = {
      name: `${wf.name} (副本)`,
      description: wf.description,
      icon: wf.icon,
      nodes: wf.nodes,
      edges: wf.edges,
      triggers: wf.triggers,
    };
    return get().createWorkflow(config);
  },

  exportWorkflow: (id) => {
    return get().workflows.find((w) => w.id === id) || null;
  },

  importWorkflow: async (config) => {
    return get().createWorkflow(config);
  },

  initRunListener: () => {
    // 清理上一个监听器，防止累积
    if (_runListenerUnlisten) {
      _runListenerUnlisten();
      _runListenerUnlisten = null;
    }

    const unlisten = on('workflow_stepProgress', (data: unknown) => {
      const event = data as StepProgressEvent;
      const { activeRun } = get();
      if (!activeRun || activeRun.id !== event.runId) return;

      set((state) => {
        if (!state.activeRun) return state;
        const existingIdx = state.activeRun.steps.findIndex((s) => s.nodeId === event.nodeId);
        const stepUpdate = {
          nodeId: event.nodeId,
          status: event.status as 'pending' | 'running' | 'completed' | 'failed' | 'cancelled',
          input: '',
          output: event.output || '',
          startedAt: Date.now(),
          completedAt: event.status === 'completed' || event.status === 'failed' ? Date.now() : undefined,
          error: event.error,
        };

        const newSteps = [...state.activeRun.steps];
        if (existingIdx >= 0) {
          newSteps[existingIdx] = { ...newSteps[existingIdx], ...stepUpdate };
        } else {
          newSteps.push(stepUpdate);
        }

        const isFinal = event.status === 'completed' || event.status === 'failed';
        return {
          activeRun: { ...state.activeRun, steps: newSteps },
          ...(isFinal ? {} : {}),
        };
      });

      // When a node completes or fails, check if we should refetch
      if (event.status === 'completed' || event.status === 'failed') {
        // Refetch the run from DB to get final state
        const { activeRun: ar } = get();
        if (ar) {
          invoke<WorkflowRun>('workflow_get_run', { id: ar.id }).then((run) => {
            if (run.status !== 'running') {
              set({ activeRun: run, running: false });
              get().fetchRuns();
            }
          }).catch(() => {});
        }
      }
    });

    _runListenerUnlisten = unlisten;
    return unlisten;
  },
}));
