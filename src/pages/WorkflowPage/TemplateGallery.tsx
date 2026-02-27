/**
 * TemplateGallery - Choose a template to create workflow
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { workflowTemplates } from '@/data/workflow-templates';
import type { WorkflowTemplate } from '@/types/workflow';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: WorkflowTemplate) => void;
}

const CATEGORIES = ['all', 'productivity', 'content', 'code', 'research', 'automation'] as const;

export function TemplateGallery({ open, onOpenChange, onSelect }: Props) {
  const { t } = useTranslation('workflows');
  const [category, setCategory] = useState<string>('all');

  const filtered = category === 'all'
    ? workflowTemplates
    : workflowTemplates.filter((tpl) => tpl.category === category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('templates.title')}</DialogTitle>
        </DialogHeader>

        {/* Category tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={category === cat ? 'default' : 'outline'}
              size="sm"
              className="text-xs"
              onClick={() => setCategory(cat)}
            >
              {t(`templates.categories.${cat}`)}
            </Button>
          ))}
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {filtered.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border bg-card p-3 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-2 mb-2">
                <span className="text-xl">{tpl.icon}</span>
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm">{tpl.name}</h4>
                  <p className="text-xs text-muted-foreground line-clamp-2">{tpl.description}</p>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2">
                <Badge variant="outline" className="text-[10px]">{tpl.nodes.length} nodes</Badge>
                <Button
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onSelect(tpl);
                    onOpenChange(false);
                  }}
                >
                  {t('templates.useTemplate')}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
