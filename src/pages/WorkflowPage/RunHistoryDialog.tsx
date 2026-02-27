/**
 * RunHistoryDialog - View past workflow runs
 */
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Trash2 } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { WorkflowRun } from '@/types/workflow';
import { useState } from 'react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflowId: string;
}

const statusVariant: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  completed: 'default',
  running: 'secondary',
  failed: 'destructive',
  cancelled: 'outline',
  pending: 'outline',
};

function formatDuration(start: number, end?: number) {
  const ms = (end || Date.now()) - start;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleString();
}

export function RunHistoryDialog({ open, onOpenChange, workflowId }: Props) {
  const { t } = useTranslation('workflows');
  const { runs, deleteRun, clearRuns } = useWorkflowStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{t('history.title')}</DialogTitle>
            {runs.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => { if (confirm(t('history.confirmClear'))) clearRuns(workflowId); }}
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" />
                {t('history.clearAll')}
              </Button>
            )}
          </div>
        </DialogHeader>

        {runs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            {t('history.empty')}
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((run) => (
              <RunItem
                key={run.id}
                run={run}
                expanded={expandedId === run.id}
                onToggle={() => setExpandedId(expandedId === run.id ? null : run.id)}
                onDelete={() => deleteRun(run.id)}
                t={t}
              />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RunItem({
  run,
  expanded,
  onToggle,
  onDelete,
  t,
}: {
  run: WorkflowRun;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
  t: ReturnType<typeof import('react-i18next').useTranslation>['t'];
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted/50" onClick={onToggle}>
        <Badge variant={statusVariant[run.status] || 'outline'} className="text-xs">
          {t(`execution.${run.status}`, run.status)}
        </Badge>
        <span className="text-xs text-muted-foreground flex-1">
          {formatTime(run.startedAt)}
        </span>
        <span className="text-xs text-muted-foreground">
          {formatDuration(run.startedAt, run.completedAt || undefined)}
        </span>
        <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 className="h-3 w-3 text-destructive" />
        </Button>
      </div>
      {expanded && (
        <div className="border-t px-3 py-2 space-y-1.5">
          {run.steps.map((step) => (
            <div key={step.nodeId} className="flex items-center gap-2 text-xs">
              <Badge variant="outline" className="text-[10px]">{step.status}</Badge>
              <span>{step.nodeId}</span>
              {step.error && <span className="text-destructive truncate">{step.error}</span>}
            </div>
          ))}
          {run.finalOutput && (
            <div className="text-xs bg-muted/30 rounded p-2 mt-2 whitespace-pre-wrap max-h-[120px] overflow-y-auto">
              {run.finalOutput}
            </div>
          )}
          {run.error && (
            <div className="text-xs text-destructive mt-1">{run.error}</div>
          )}
        </div>
      )}
    </div>
  );
}
