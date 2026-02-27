/**
 * Agents Page
 * Manage AI agents with CRUD, templates, import/export.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAgentsStore } from '@/stores/agents-store';
import { useProvidersStore } from '@/stores/providers-store';
import AgentCard from './AgentCard';
import AgentEditor from './AgentEditor';
import AgentTemplateSelector from './AgentTemplateSelector';
import type { AgentConfig } from '@/types/agent';
import { toast } from 'sonner';
import { Plus, Upload, Search, Bot, Loader2 } from 'lucide-react';

export default function AgentsPage() {
  const { t } = useTranslation('agents');
  const {
    agents,
    activeAgentId,
    isLoading,
    fetchAgents,
    fetchActiveAgentId,
    createAgent,
    updateAgent,
    deleteAgent,
    setActiveAgent,
    cloneAgent,
    exportAgent,
    importAgent,
  } = useAgentsStore();
  const { fetchProviders } = useProvidersStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateFlow, setShowCreateFlow] = useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    initial?: Partial<AgentConfig>;
  }>({ open: false, mode: 'create' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchAgents();
    fetchActiveAgentId();
    fetchProviders();
  }, []);

  const filteredAgents = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setShowTemplateSelector(true);
  };

  const handleSelectTemplate = (template: Omit<AgentConfig, 'id' | 'createdAt' | 'updatedAt'>) => {
    setShowTemplateSelector(false);
    setEditorState({
      open: true,
      mode: 'create',
      initial: template,
    });
  };

  const handleEdit = (agent: AgentConfig) => {
    setEditorState({
      open: true,
      mode: 'edit',
      initial: agent,
    });
  };

  const handleSaveAgent = async (agent: AgentConfig) => {
    try {
      if (editorState.mode === 'create') {
        await createAgent(agent);
        toast.success(t('toast.created', 'Agent created'));
      } else {
        await updateAgent(agent);
        toast.success(t('toast.updated', 'Agent updated'));
      }
    } catch {
      toast.error(t('toast.failed', 'Operation failed'));
      throw new Error('Save failed');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAgent(id);
      toast.success(t('toast.deleted', 'Agent deleted'));
    } catch {
      toast.error(t('toast.failedDelete', 'Failed to delete'));
    }
    setDeleteConfirm(null);
  };

  const handleClone = async (id: string) => {
    try {
      await cloneAgent(id);
      toast.success(t('toast.cloned', 'Agent cloned'));
    } catch {
      toast.error(t('toast.failed', 'Clone failed'));
    }
  };

  const handleExport = (id: string) => {
    const agent = exportAgent(id);
    if (!agent) return;
    const blob = new Blob([JSON.stringify(agent, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const agent = JSON.parse(text) as AgentConfig;
        await importAgent(agent);
        toast.success(t('toast.imported', 'Agent imported'));
      } catch {
        toast.error(t('toast.failedImport', 'Import failed'));
      }
    };
    input.click();
  };

  const handleSetDefault = async (agent: AgentConfig) => {
    try {
      await updateAgent({ ...agent, isDefault: true, updatedAt: new Date().toISOString() });
      // Unset other defaults
      for (const a of agents) {
        if (a.id !== agent.id && a.isDefault) {
          await updateAgent({ ...a, isDefault: false, updatedAt: new Date().toISOString() });
        }
      }
      toast.success(t('toast.defaultSet', 'Default agent set'));
    } catch {
      toast.error(t('toast.failed', 'Failed'));
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('title', 'Agents')}</h2>
            <p className="text-muted-foreground">{t('description', 'Manage your AI agents')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={handleImport}>
              <Upload className="h-4 w-4 mr-2" />
              {t('import', 'Import')}
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('create', 'Create')}
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('search', 'Search agents...')}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground">{t('empty', 'No agents yet')}</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('createFirst', 'Create your first agent')}
            </Button>
          </div>
        ) : filteredAgents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <p className="text-muted-foreground">{t('noResults', 'No agents match your search')}</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                isActive={agent.id === activeAgentId}
                onSelect={() => setActiveAgent(agent.id)}
                onEdit={() => handleEdit(agent)}
                onClone={() => handleClone(agent.id)}
                onExport={() => handleExport(agent.id)}
                onSetDefault={() => handleSetDefault(agent)}
                onDelete={() => setDeleteConfirm(agent.id)}
              />
            ))}
          </div>
        )}

        {/* Template Selector Dialog */}
        <Dialog open={showTemplateSelector} onOpenChange={setShowTemplateSelector}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t('templates.title', 'Choose a Template')}</DialogTitle>
              <DialogDescription>
                {t('templates.description', 'Start from a template or create a blank agent')}
              </DialogDescription>
            </DialogHeader>
            <AgentTemplateSelector onSelect={handleSelectTemplate} />
          </DialogContent>
        </Dialog>

        {/* Agent Editor */}
        <AgentEditor
          open={editorState.open}
          onOpenChange={(open) => setEditorState((s) => ({ ...s, open }))}
          mode={editorState.mode}
          initial={editorState.initial}
          onSave={handleSaveAgent}
        />

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('delete.title', 'Delete Agent')}</DialogTitle>
              <DialogDescription>
                {t('delete.description', 'This action cannot be undone.')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                {t('delete.cancel', 'Cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              >
                {t('delete.confirm', 'Delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
