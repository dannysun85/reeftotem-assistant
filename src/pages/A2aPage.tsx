/**
 * A2A (Agent-to-Agent) Delegation Page
 * Displays delegation list with stats and allows creating/cancelling delegations.
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useA2AStore } from '@/stores/a2a-store';
import { useAgentsStore } from '@/stores/agents-store';
import type { Delegation } from '@/types/a2a';
import {
  ArrowLeftRight,
  RefreshCw,
  Loader2,
  Plus,
  AlertTriangle,
  X,
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG = {
  pending: {
    variant: 'secondary' as const,
    icon: Clock,
  },
  completed: {
    variant: 'default' as const,
    icon: CheckCircle2,
  },
  failed: {
    variant: 'destructive' as const,
    icon: XCircle,
  },
};

// ---------------------------------------------------------------------------
// DelegationCard
// ---------------------------------------------------------------------------

interface DelegationCardProps {
  delegation: Delegation;
  agentNameMap: Map<string, string>;
  onCancel: (id: string) => void;
  cancelling: boolean;
}

function DelegationCard({
  delegation,
  agentNameMap,
  onCancel,
  cancelling,
}: DelegationCardProps) {
  const { t } = useTranslation('a2a');
  const config = STATUS_CONFIG[delegation.status] ?? STATUS_CONFIG.pending;
  const StatusIcon = config.icon;

  const fromName = agentNameMap.get(delegation.fromAgentId) ?? delegation.fromAgentId;
  const toName = agentNameMap.get(delegation.toAgentId) ?? delegation.toAgentId;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* Agent flow */}
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate max-w-[120px]">{fromName}</span>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="font-medium truncate max-w-[120px]">{toName}</span>
          <Badge variant={config.variant} className="text-[10px] ml-auto shrink-0">
            <StatusIcon className="h-3 w-3 mr-1" />
            {t(`status.${delegation.status}`)}
          </Badge>
        </div>

        {/* Task */}
        <p className="text-xs text-muted-foreground line-clamp-2">{delegation.task}</p>

        {/* Output (if completed/failed) */}
        {delegation.output && (
          <div className="rounded-md bg-muted p-2 text-xs font-mono line-clamp-3">
            {delegation.output}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between">
          {delegation.createdAt && (
            <span className="text-[11px] text-muted-foreground">
              {new Date(delegation.createdAt).toLocaleString()}
            </span>
          )}
          {delegation.status === 'pending' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              disabled={cancelling}
              onClick={() => onCancel(delegation.id)}
            >
              {cancelling ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <X className="mr-1 h-3 w-3" />
              )}
              {t('card.cancel')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// NewDelegationDialog
// ---------------------------------------------------------------------------

interface NewDelegationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function NewDelegationDialog({ open, onOpenChange }: NewDelegationDialogProps) {
  const { t } = useTranslation('a2a');
  const { createDelegation, creating } = useA2AStore();
  const { agents, fetchAgents } = useAgentsStore();

  const [fromAgentId, setFromAgentId] = useState('');
  const [toAgentId, setToAgentId] = useState('');
  const [task, setTask] = useState('');
  const [context, setContext] = useState('');

  useEffect(() => {
    if (open && agents.length === 0) {
      fetchAgents();
    }
  }, [open, agents.length, fetchAgents]);

  const handleCreate = async () => {
    if (!fromAgentId || !toAgentId || !task.trim()) return;
    try {
      await createDelegation(fromAgentId, toAgentId, task.trim(), context.trim() || undefined);
      onOpenChange(false);
      setFromAgentId('');
      setToAgentId('');
      setTask('');
      setContext('');
    } catch {
      // Error handled in store
    }
  };

  const canCreate = fromAgentId && toAgentId && task.trim() && !creating;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            {t('dialog.title')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* From Agent */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('dialog.fromAgent')}</Label>
            <Select value={fromAgentId} onValueChange={setFromAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={t('dialog.selectAgent')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* To Agent */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('dialog.toAgent')}</Label>
            <Select value={toAgentId} onValueChange={setToAgentId}>
              <SelectTrigger>
                <SelectValue placeholder={t('dialog.selectAgent')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Task */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('dialog.task')}</Label>
            <Textarea
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder={t('dialog.taskPlaceholder')}
              rows={3}
            />
          </div>

          {/* Context */}
          <div className="space-y-1.5">
            <Label className="text-xs">{t('dialog.context')}</Label>
            <Textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder={t('dialog.contextPlaceholder')}
              rows={2}
            />
          </div>

          {/* Create button */}
          <Button className="w-full" disabled={!canCreate} onClick={handleCreate}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('dialog.creating')}
              </>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                {t('dialog.create')}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// A2aPage
// ---------------------------------------------------------------------------

export default function A2aPage() {
  const { t } = useTranslation('a2a');
  const { delegations, loading, error, fetchDelegations, cancelDelegation } =
    useA2AStore();
  const { agents, fetchAgents } = useAgentsStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  useEffect(() => {
    fetchDelegations();
    fetchAgents();
  }, [fetchDelegations, fetchAgents]);

  // Build agent name map
  const agentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of agents) {
      map.set(a.id, a.name);
    }
    return map;
  }, [agents]);

  // Stats
  const stats = useMemo(() => {
    const total = delegations.length;
    const pending = delegations.filter((d) => d.status === 'pending').length;
    const completed = delegations.filter((d) => d.status === 'completed').length;
    const failed = delegations.filter((d) => d.status === 'failed').length;
    return { total, pending, completed, failed };
  }, [delegations]);

  const handleCancel = useCallback(
    async (id: string) => {
      setCancellingId(id);
      try {
        await cancelDelegation(id);
      } catch {
        // Error handled in store
      } finally {
        setCancellingId(null);
      }
    },
    [cancelDelegation],
  );

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('title')}</h2>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchDelegations()}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('refresh')}
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newDelegation')}
            </Button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {(
            [
              { key: 'total', value: stats.total, color: 'text-foreground' },
              { key: 'pending', value: stats.pending, color: 'text-amber-600' },
              { key: 'completed', value: stats.completed, color: 'text-green-600' },
              { key: 'failed', value: stats.failed, color: 'text-destructive' },
            ] as const
          ).map((s) => (
            <Card key={s.key}>
              <CardContent className="p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-muted-foreground">{t(`stats.${s.key}`)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Delegation list */}
        {loading && delegations.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : delegations.length > 0 ? (
          <div className="space-y-3">
            {delegations.map((d) => (
              <DelegationCard
                key={d.id}
                delegation={d}
                agentNameMap={agentNameMap}
                onCancel={handleCancel}
                cancelling={cancellingId === d.id}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <ArrowLeftRight className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{t('noDelegations')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('noDelegationsDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* New Delegation Dialog */}
      <NewDelegationDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
