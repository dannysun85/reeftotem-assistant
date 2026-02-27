/**
 * WorkflowPage - Main workflow management page
 * Shows workflow list or canvas editor based on state
 */
import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Upload, LayoutGrid, History, Search } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { WorkflowCard } from './WorkflowCard';
import { WorkflowEditor } from './WorkflowEditor';
import { WorkflowCanvas } from './WorkflowCanvas';
import { RunDialog } from './RunDialog';
import { RunHistoryDialog } from './RunHistoryDialog';
import { TemplateGallery } from './TemplateGallery';
import type { WorkflowNode, WorkflowEdge, WorkflowConfig, WorkflowTemplate } from '@/types/workflow';

type EditorMode = 'list' | 'canvas';

export default function WorkflowPage() {
  const { t } = useTranslation('workflows');
  const {
    workflows,
    currentWorkflowId,
    fetchWorkflows,
    createWorkflow,
    updateWorkflow,
    deleteWorkflow,
    setCurrentWorkflow,
    duplicateWorkflow,
    exportWorkflow,
    importWorkflow,
    createFromTemplate,
    fetchRuns,
  } = useWorkflowStore();

  const [editorMode, setEditorMode] = useState<EditorMode>('list');
  const [search, setSearch] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState<WorkflowConfig | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [runWorkflow, setRunWorkflow] = useState<WorkflowConfig | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const currentWorkflow = workflows.find((w) => w.id === currentWorkflowId);

  const filtered = workflows.filter((w) =>
    !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.description.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (data: { name: string; description: string; icon: string }) => {
    const wf = await createWorkflow(data);
    setCurrentWorkflow(wf.id);
    setEditorMode('canvas');
  };

  const handleEdit = (wf: WorkflowConfig) => {
    setEditingWorkflow(wf);
  };

  const handleEditSubmit = async (data: { name: string; description: string; icon: string }) => {
    if (!editingWorkflow) return;
    await updateWorkflow(editingWorkflow.id, data);
    setEditingWorkflow(null);
  };

  const handleCardClick = (wf: WorkflowConfig) => {
    setCurrentWorkflow(wf.id);
    fetchRuns(wf.id);
    setEditorMode('canvas');
  };

  const handleCanvasSave = useCallback(async (nodes: WorkflowNode[], edges: WorkflowEdge[]) => {
    if (!currentWorkflowId) return;
    await updateWorkflow(currentWorkflowId, { nodes, edges });
  }, [currentWorkflowId, updateWorkflow]);

  const handleBack = useCallback(() => {
    setEditorMode('list');
    setCurrentWorkflow(null);
  }, [setCurrentWorkflow]);

  const handleExport = (id: string) => {
    const wf = exportWorkflow(id);
    if (!wf) return;
    const blob = new Blob([JSON.stringify(wf, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${wf.name}.json`;
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
      const text = await file.text();
      try {
        const config = JSON.parse(text);
        await importWorkflow(config);
      } catch {
        console.error('Invalid workflow JSON');
      }
    };
    input.click();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    await deleteWorkflow(deleteId);
    setDeleteId(null);
  };

  const handleUseTemplate = async (template: WorkflowTemplate) => {
    const wf = await createFromTemplate(template);
    setCurrentWorkflow(wf.id);
    setEditorMode('canvas');
  };

  // --- Canvas mode ---
  if (editorMode === 'canvas' && currentWorkflow) {
    return (
      <div className="h-full">
        <WorkflowCanvas
          workflow={currentWorkflow}
          onSave={handleCanvasSave}
          onBack={handleBack}
          onRun={() => setRunWorkflow(currentWorkflow)}
        />
        {runWorkflow && (
          <RunDialog
            open={!!runWorkflow}
            onOpenChange={(open) => !open && setRunWorkflow(null)}
            workflow={runWorkflow}
          />
        )}
      </div>
    );
  }

  // --- List mode ---
  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-xl font-bold">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4 mr-1" />{t('import')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowTemplates(true)}>
            <LayoutGrid className="h-4 w-4 mr-1" />{t('templates.title')}
          </Button>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-1" />{t('create')}
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="px-6 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8 h-9"
            placeholder={t('search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-semibold mb-1">{t('empty')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('emptyHint')}</p>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-1" />{t('create')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((wf) => (
              <WorkflowCard
                key={wf.id}
                workflow={wf}
                onClick={() => handleCardClick(wf)}
                onEdit={() => handleEdit(wf)}
                onDuplicate={() => duplicateWorkflow(wf.id)}
                onExport={() => handleExport(wf.id)}
                onDelete={() => setDeleteId(wf.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Dialogs */}
      <WorkflowEditor
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreate}
        title={t('create')}
      />

      {editingWorkflow && (
        <WorkflowEditor
          open={!!editingWorkflow}
          onOpenChange={(open) => !open && setEditingWorkflow(null)}
          initial={{ name: editingWorkflow.name, description: editingWorkflow.description, icon: editingWorkflow.icon }}
          onSubmit={handleEditSubmit}
          title={t('edit')}
        />
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('validation.disconnected', '此操作不可撤销，工作流及其所有运行记录将被永久删除。')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t('delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TemplateGallery
        open={showTemplates}
        onOpenChange={setShowTemplates}
        onSelect={handleUseTemplate}
      />

      {showHistory && currentWorkflowId && (
        <RunHistoryDialog
          open={showHistory}
          onOpenChange={setShowHistory}
          workflowId={currentWorkflowId}
        />
      )}
    </div>
  );
}
