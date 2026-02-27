/**
 * Knowledge Detail
 * Shows documents, upload area, and search for a single KB.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useKnowledgeStore } from '@/stores/knowledge-store';
import DocumentUpload from './DocumentUpload';
import KnowledgeSearch from './KnowledgeSearch';
import type { KnowledgeBase, KnowledgeDocument } from '@/types/knowledge';
import { toast } from 'sonner';
import { ArrowLeft, Pencil, RefreshCw, Trash2, FileText } from 'lucide-react';

interface Props {
  kb: KnowledgeBase;
  onBack: () => void;
  onEdit: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  ready: 'bg-green-500',
  processing: 'bg-yellow-500',
  pending: 'bg-gray-400',
  error: 'bg-red-500',
};

export default function KnowledgeDetail({ kb, onBack, onEdit }: Props) {
  const { t } = useTranslation('knowledge');
  const {
    documents,
    fetchDocuments,
    removeDocument,
    reprocessDocument,
    initProgressListener,
  } = useKnowledgeStore();

  const [deleteConfirm, setDeleteConfirm] = useState<KnowledgeDocument | null>(null);

  useEffect(() => {
    fetchDocuments(kb.id);
    const unlisten = initProgressListener();
    return unlisten;
  }, [kb.id]);

  const handleRemove = async () => {
    if (!deleteConfirm) return;
    try {
      await removeDocument(deleteConfirm.id);
      toast.success('Document removed');
    } catch {
      toast.error('Failed to remove document');
    }
    setDeleteConfirm(null);
  };

  const handleReprocess = async (docId: string) => {
    try {
      await reprocessDocument(docId);
      toast.success('Reprocessing started');
    } catch {
      toast.error('Failed to reprocess');
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">{kb.name}</h2>
            {kb.description && (
              <p className="text-muted-foreground">{kb.description}</p>
            )}
          </div>
          <Button variant="outline" onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>

        {/* Upload area */}
        <DocumentUpload kbId={kb.id} />

        {/* Documents table */}
        <div>
          <h3 className="text-lg font-semibold mb-3">{t('detail.documents')}</h3>
          {documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 border rounded-lg bg-muted/30">
              <FileText className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">{t('detail.noDocuments')}</p>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium">{t('detail.fileName')}</th>
                    <th className="text-left p-3 font-medium">{t('detail.fileType')}</th>
                    <th className="text-left p-3 font-medium">{t('detail.status')}</th>
                    <th className="text-left p-3 font-medium">{t('detail.chunks')}</th>
                    <th className="text-right p-3 font-medium">{t('detail.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => (
                    <tr key={doc.id} className="border-t hover:bg-muted/30">
                      <td className="p-3">
                        <span className="truncate block max-w-xs">{doc.fileName}</span>
                      </td>
                      <td className="p-3">
                        <Badge variant="outline">{doc.fileType}</Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full ${STATUS_COLORS[doc.status] || 'bg-gray-400'}`} />
                          <span className="capitalize">{doc.status}</span>
                          {doc.error && (
                            <span className="text-red-500 text-xs truncate max-w-32" title={doc.error}>
                              {doc.error}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3">{doc.chunkCount}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleReprocess(doc.id)}
                            disabled={doc.status === 'processing'}
                          >
                            <RefreshCw className="h-3 w-3 mr-1" />
                            {t('detail.reprocess')}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setDeleteConfirm(doc)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            {t('detail.remove')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Search */}
        <KnowledgeSearch kbId={kb.id} />

        {/* Delete document confirm */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('detail.remove')}</DialogTitle>
              <DialogDescription>
                {t('detail.removeConfirm', { name: deleteConfirm?.fileName })}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleRemove}>Delete</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
