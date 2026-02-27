/**
 * Knowledge Page
 * Knowledge base list and detail view.
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
import { useKnowledgeStore } from '@/stores/knowledge-store';
import KnowledgeCard from './KnowledgeCard';
import KnowledgeDetail from './KnowledgeDetail';
import KnowledgeEditor from './KnowledgeEditor';
import { toast } from 'sonner';
import { Plus, Search, BookOpen, Loader2 } from 'lucide-react';

export default function KnowledgePage() {
  const { t } = useTranslation('knowledge');
  const {
    knowledgeBases,
    currentKBId,
    loading,
    fetchKnowledgeBases,
    createKnowledgeBase,
    updateKnowledgeBase,
    deleteKnowledgeBase,
    setCurrentKB,
    fetchEmbeddingOptions,
  } = useKnowledgeStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [editorState, setEditorState] = useState<{
    open: boolean;
    mode: 'create' | 'edit';
    kbId?: string;
  }>({ open: false, mode: 'create' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    fetchKnowledgeBases();
    fetchEmbeddingOptions();
  }, []);

  const filteredKBs = knowledgeBases.filter(
    (kb) =>
      kb.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      kb.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCreate = () => {
    setEditorState({ open: true, mode: 'create' });
  };

  const handleEdit = (id: string) => {
    setEditorState({ open: true, mode: 'edit', kbId: id });
  };

  const handleSave = async (data: Record<string, unknown>) => {
    try {
      if (editorState.mode === 'create') {
        await createKnowledgeBase(data);
        toast.success(t('editor.createTitle'));
      } else if (editorState.kbId) {
        await updateKnowledgeBase(editorState.kbId, data);
        toast.success(t('editor.editTitle'));
      }
      setEditorState({ open: false, mode: 'create' });
    } catch {
      toast.error('Operation failed');
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await deleteKnowledgeBase(deleteConfirm.id);
      toast.success('Deleted');
    } catch {
      toast.error('Delete failed');
    }
    setDeleteConfirm(null);
  };

  // Detail view
  if (currentKBId) {
    const kb = knowledgeBases.find((k) => k.id === currentKBId);
    if (kb) {
      return (
        <KnowledgeDetail
          kb={kb}
          onBack={() => setCurrentKB(null)}
          onEdit={() => handleEdit(kb.id)}
        />
      );
    }
  }

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('title')}</h2>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            {t('createKB')}
          </Button>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-10"
          />
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : knowledgeBases.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium">{t('empty.title')}</p>
            <p className="text-muted-foreground text-center max-w-md">{t('empty.description')}</p>
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              {t('empty.cta')}
            </Button>
          </div>
        ) : filteredKBs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-2">
            <p className="text-muted-foreground">No results match your search</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredKBs.map((kb) => (
              <KnowledgeCard
                key={kb.id}
                kb={kb}
                onClick={() => setCurrentKB(kb.id)}
                onEdit={() => handleEdit(kb.id)}
                onDelete={() => setDeleteConfirm({ id: kb.id, name: kb.name })}
              />
            ))}
          </div>
        )}

        {/* Editor Dialog */}
        <KnowledgeEditor
          open={editorState.open}
          onOpenChange={(open) => setEditorState((s) => ({ ...s, open }))}
          mode={editorState.mode}
          kbId={editorState.kbId}
          onSave={handleSave}
        />

        {/* Delete Confirmation */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('deleteConfirm.title')}</DialogTitle>
              <DialogDescription>
                {t('deleteConfirm.message', { name: deleteConfirm?.name })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
