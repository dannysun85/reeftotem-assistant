/**
 * Knowledge Editor Dialog
 * Create/edit knowledge base with form.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useKnowledgeStore, type EmbeddingOption } from '@/stores/knowledge-store';
import { invoke } from '@/lib/bridge';
import { Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'create' | 'edit';
  kbId?: string;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

export default function KnowledgeEditor({ open, onOpenChange, mode, kbId, onSave }: Props) {
  const { t } = useTranslation('knowledge');
  const { knowledgeBases, embeddingOptions } = useKnowledgeStore();

  const existingKB = kbId ? knowledgeBases.find((k) => k.id === kbId) : undefined;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [embeddingModel, setEmbeddingModel] = useState('');
  const [chunkSize, setChunkSize] = useState(512);
  const [chunkOverlap, setChunkOverlap] = useState(50);
  const [detectingDim, setDetectingDim] = useState(false);
  const [dimension, setDimension] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && existingKB) {
        setName(existingKB.name);
        setDescription(existingKB.description);
        setEmbeddingModel(existingKB.embeddingModel);
        setChunkSize(existingKB.chunkSize);
        setChunkOverlap(existingKB.chunkOverlap);
        setDimension(existingKB.embeddingDimension);
      } else {
        setName('');
        setDescription('');
        setEmbeddingModel(embeddingOptions.length > 0 ? embeddingOptions[0].value : '');
        setChunkSize(512);
        setChunkOverlap(50);
        setDimension(null);
      }
    }
  }, [open, mode, existingKB]);

  const handleDetectDimension = async () => {
    if (!embeddingModel) return;
    setDetectingDim(true);
    try {
      const dim = await invoke<number>('knowledge_detect_dimension', { embeddingModel });
      setDimension(dim);
    } catch (err) {
      console.error('Detect dimension failed:', err);
    }
    setDetectingDim(false);
  };

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
        chunkSize,
        chunkOverlap,
      };

      if (mode === 'create') {
        data.embeddingModel = embeddingModel;
        if (dimension) {
          data.embeddingDimension = dimension;
        } else {
          // Use default from selected option
          const opt = embeddingOptions.find((o) => o.value === embeddingModel);
          data.embeddingDimension = opt?.dimension ?? 1536;
        }
      }

      await onSave(data);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? t('editor.createTitle') : t('editor.editTitle')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Name */}
          <div className="space-y-2">
            <Label>{t('editor.name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('editor.namePlaceholder')}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>{t('editor.description')}</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('editor.descriptionPlaceholder')}
            />
          </div>

          {/* Embedding Model (create only) */}
          {mode === 'create' && (
            <div className="space-y-2">
              <Label>{t('editor.embeddingModel')}</Label>
              <p className="text-xs text-muted-foreground">{t('editor.embeddingModelDesc')}</p>
              <Select value={embeddingModel} onValueChange={setEmbeddingModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  {embeddingOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value} disabled={!opt.available}>
                      {opt.label} ({opt.dimension}d)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {embeddingModel && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDetectDimension}
                    disabled={detectingDim}
                  >
                    {detectingDim && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                    {detectingDim ? t('editor.detectingDimension') : 'Detect Dimension'}
                  </Button>
                  {dimension && (
                    <span className="text-sm text-muted-foreground">
                      {dimension}d
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Chunk Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('editor.chunkSize')}</Label>
              <p className="text-xs text-muted-foreground">{t('editor.chunkSizeDesc')}</p>
              <Input
                type="number"
                value={chunkSize}
                onChange={(e) => setChunkSize(parseInt(e.target.value) || 512)}
                min={100}
                max={4000}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('editor.chunkOverlap')}</Label>
              <p className="text-xs text-muted-foreground">{t('editor.chunkOverlapDesc')}</p>
              <Input
                type="number"
                value={chunkOverlap}
                onChange={(e) => setChunkOverlap(parseInt(e.target.value) || 50)}
                min={0}
                max={500}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === 'create' ? 'Create' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
