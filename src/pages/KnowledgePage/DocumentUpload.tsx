/**
 * Document Upload
 * File picker and URL add buttons for adding documents.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open } from '@tauri-apps/plugin-dialog';
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
import { toast } from 'sonner';
import { Upload, Globe, Loader2 } from 'lucide-react';

interface Props {
  kbId: string;
}

export default function DocumentUpload({ kbId }: Props) {
  const { t } = useTranslation('knowledge');
  const { addDocument, addUrl } = useKnowledgeStore();

  const [urlDialogOpen, setUrlDialogOpen] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [uploading, setUploading] = useState(false);

  const handleAddFile = async () => {
    try {
      const selected = await open({
        multiple: true,
        filters: [
          { name: 'Documents', extensions: ['pdf', 'docx', 'txt', 'md', 'csv'] },
        ],
      });

      if (!selected) return;

      const files = Array.isArray(selected) ? selected : [selected];
      setUploading(true);

      for (const filePath of files) {
        const path = String(filePath);
        const name = path.split('/').pop() || path.split('\\').pop() || 'unknown';
        const ext = name.split('.').pop()?.toLowerCase() || 'txt';

        try {
          await addDocument(kbId, path, name, ext, 0);
          toast.success(`Added: ${name}`);
        } catch (err) {
          toast.error(`Failed to add ${name}: ${err}`);
        }
      }
    } catch (err) {
      console.error('File picker error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!urlInput.trim()) return;
    setUploading(true);
    try {
      await addUrl(kbId, urlInput.trim());
      toast.success('URL added');
      setUrlInput('');
      setUrlDialogOpen(false);
    } catch (err) {
      toast.error(`Failed to add URL: ${err}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleAddFile} disabled={uploading}>
        {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
        {t('detail.addDocuments')}
      </Button>
      <Button variant="outline" onClick={() => setUrlDialogOpen(true)}>
        <Globe className="h-4 w-4 mr-2" />
        {t('detail.addUrl')}
      </Button>

      {/* URL Dialog */}
      <Dialog open={urlDialogOpen} onOpenChange={setUrlDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('detail.urlDialogTitle')}</DialogTitle>
            <DialogDescription>{t('detail.urlDialogDesc')}</DialogDescription>
          </DialogHeader>
          <Input
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={t('detail.urlPlaceholder')}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddUrl(); }}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setUrlDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddUrl} disabled={!urlInput.trim() || uploading}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
