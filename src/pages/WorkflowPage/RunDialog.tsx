/**
 * RunDialog - Execute workflow with input and step progress
 */
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Play, Square, Loader2 } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import type { WorkflowConfig } from '@/types/workflow';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workflow: WorkflowConfig;
}

const statusColors: Record<string, string> = {
  pending: 'bg-gray-500',
  running: 'bg-yellow-500',
  completed: 'bg-green-500',
  failed: 'bg-red-500',
  cancelled: 'bg-gray-400',
};

export function RunDialog({ open, onOpenChange, workflow }: Props) {
  const { t } = useTranslation('workflows');
  const [input, setInput] = useState('');
  const { runWorkflow, cancelRun, activeRun, running, initRunListener } = useWorkflowStore();

  useEffect(() => {
    if (!open) return;
    const unlisten = initRunListener();
    return unlisten;
  }, [open, initRunListener]);

  const handleRun = async () => {
    try {
      await runWorkflow(workflow.id, input || undefined);
    } catch {
      // Error handled in store
    }
  };

  const handleCancel = () => {
    if (activeRun) {
      cancelRun(activeRun.id);
    }
  };

  const isRunning = running && activeRun?.status === 'running';
  const isDone = activeRun && ['completed', 'failed', 'cancelled'].includes(activeRun.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('execution.runWorkflow')}</DialogTitle>
        </DialogHeader>

        {/* Input */}
        {!activeRun && (
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('execution.inputPrompt')}</label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('execution.inputPlaceholder')}
              autoFocus
            />
          </div>
        )}

        {/* Step progress */}
        {activeRun && activeRun.steps.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{t('execution.stepProgress')}</div>
            <div className="space-y-1.5">
              {activeRun.steps.map((step) => {
                const node = workflow.nodes.find((n) => n.id === step.nodeId);
                return (
                  <div key={step.nodeId} className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
                    <div className={`h-2 w-2 rounded-full ${statusColors[step.status] || 'bg-gray-400'}`} />
                    <span className="text-sm flex-1">{node?.data.label || step.nodeId}</span>
                    <Badge variant="outline" className="text-xs">
                      {t(`execution.${step.status}`, step.status)}
                    </Badge>
                    {step.status === 'running' && <Loader2 className="h-3 w-3 animate-spin" />}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Running indicator */}
        {isRunning && !activeRun?.steps.length && (
          <div className="flex items-center gap-2 py-4 justify-center">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">{t('execution.running')}</span>
          </div>
        )}

        {/* Final output */}
        {isDone && activeRun?.finalOutput && (
          <div className="space-y-2">
            <div className="text-sm font-medium">{t('execution.finalOutput')}</div>
            <div className="rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {activeRun.finalOutput}
            </div>
          </div>
        )}

        {/* Error */}
        {activeRun?.error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {activeRun.error}
          </div>
        )}

        <DialogFooter>
          {!activeRun && (
            <Button onClick={handleRun}>
              <Play className="h-4 w-4 mr-1" />
              {t('execution.run')}
            </Button>
          )}
          {isRunning && (
            <Button variant="destructive" onClick={handleCancel}>
              <Square className="h-4 w-4 mr-1" />
              {t('execution.stop')}
            </Button>
          )}
          {isDone && (
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              OK
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
