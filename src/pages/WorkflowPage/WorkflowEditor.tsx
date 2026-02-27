/**
 * WorkflowEditor - Dialog for creating/editing workflow name & description
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: { name: string; description: string; icon: string };
  onSubmit: (data: { name: string; description: string; icon: string }) => void;
  title: string;
}

const ICONS = ['⚡', '🔄', '🤖', '📝', '🔍', '📧', '📋', '🌐', '🔬', '✍️'];

export function WorkflowEditor({ open, onOpenChange, initial, onSubmit, title }: Props) {
  const { t } = useTranslation('workflows');
  const [name, setName] = useState(initial?.name || '');
  const [description, setDescription] = useState(initial?.description || '');
  const [icon, setIcon] = useState(initial?.icon || '⚡');

  const handleSubmit = () => {
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), description: description.trim(), icon });
    setName('');
    setDescription('');
    setIcon('⚡');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>{t('icon')}</Label>
            <div className="flex gap-1.5 flex-wrap">
              {ICONS.map((ic) => (
                <button
                  key={ic}
                  className={`text-xl p-1.5 rounded hover:bg-muted ${icon === ic ? 'bg-muted ring-2 ring-primary' : ''}`}
                  onClick={() => setIcon(ic)}
                  type="button"
                >
                  {ic}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>{t('name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('namePlaceholder')}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label>{t('descriptionLabel')}</Label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('descriptionPlaceholder')}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim()}>
            OK
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
