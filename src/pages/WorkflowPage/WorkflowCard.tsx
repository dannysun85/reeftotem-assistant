/**
 * WorkflowCard - Grid card for workflow list
 */
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Copy, Download, Trash2, Settings2 } from 'lucide-react';
import type { WorkflowConfig } from '@/types/workflow';

interface Props {
  workflow: WorkflowConfig;
  onClick: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onExport: () => void;
  onDelete: () => void;
}

export function WorkflowCard({ workflow, onClick, onEdit, onDuplicate, onExport, onDelete }: Props) {
  const { t } = useTranslation('workflows');

  return (
    <div
      className="rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{workflow.icon}</span>
          <div>
            <h3 className="font-semibold text-sm">{workflow.name}</h3>
            <p className="text-xs text-muted-foreground line-clamp-1">{workflow.description || '-'}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onClick={onEdit}>
              <Settings2 className="mr-2 h-4 w-4" />{t('properties', '属性')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDuplicate}>
              <Copy className="mr-2 h-4 w-4" />{t('duplicate')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              <Download className="mr-2 h-4 w-4" />{t('export')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive" onClick={onDelete}>
              <Trash2 className="mr-2 h-4 w-4" />{t('delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="flex items-center gap-2 mt-3">
        <Badge variant="secondary" className="text-xs">
          {workflow.nodes.length} nodes
        </Badge>
        {workflow.triggers.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {workflow.triggers.length} triggers
          </Badge>
        )}
        <Badge variant={workflow.enabled ? 'default' : 'secondary'} className="text-xs ml-auto">
          {workflow.enabled ? t('enabled') : t('disabled')}
        </Badge>
      </div>
    </div>
  );
}
