/**
 * Cron Page
 * Manages scheduled tasks (cron jobs) for automated message delivery.
 * Provides task overview stats, a card list for existing jobs,
 * and an AlertDialog-based form for creating new tasks.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCronStore } from '@/stores/cron-store';
import { useChannelsStore } from '@/stores/channels-store';
import type { CronJob, CronJobCreateInput, CronSchedule } from '@/types/cron';
import {
  Clock,
  Plus,
  RefreshCw,
  Loader2,
  Play,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Pause,
  Calendar,
  Radio,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Schedule presets
// ---------------------------------------------------------------------------

const SCHEDULE_PRESETS = [
  { labelKey: 'presets.everyMinute', cron: '* * * * *' },
  { labelKey: 'presets.every5Min', cron: '*/5 * * * *' },
  { labelKey: 'presets.every15Min', cron: '*/15 * * * *' },
  { labelKey: 'presets.everyHour', cron: '0 * * * *' },
  { labelKey: 'presets.daily9am', cron: '0 9 * * *' },
  { labelKey: 'presets.daily6pm', cron: '0 18 * * *' },
  { labelKey: 'presets.weeklyMon', cron: '0 9 * * 1' },
  { labelKey: 'presets.monthly1st', cron: '0 9 1 * *' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatScheduleDisplay(schedule: string | CronSchedule): string {
  if (typeof schedule === 'string') return schedule;
  switch (schedule.kind) {
    case 'cron':
      return schedule.expr;
    case 'every':
      return `every ${schedule.everyMs / 1000}s`;
    case 'at':
      return schedule.at;
    default:
      return String(schedule);
  }
}

function getStatusBadge(job: CronJob): {
  variant: 'success' | 'secondary' | 'destructive' | 'warning';
  label: string;
  icon: React.ReactNode;
} {
  if (!job.enabled) {
    return {
      variant: 'secondary',
      label: 'paused',
      icon: <Pause className="h-3.5 w-3.5" />,
    };
  }
  if (job.lastRun && !job.lastRun.success) {
    return {
      variant: 'destructive',
      label: 'failed',
      icon: <XCircle className="h-3.5 w-3.5" />,
    };
  }
  return {
    variant: 'success',
    label: 'active',
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  };
}

// ---------------------------------------------------------------------------
// CronJobCard (internal component)
// ---------------------------------------------------------------------------

interface CronJobCardProps {
  job: CronJob;
  onToggle: (id: string, enabled: boolean) => void;
  onRun: (id: string) => void;
  onDelete: (id: string) => void;
  toggling: boolean;
  running: boolean;
  deleting: boolean;
}

function CronJobCard({
  job,
  onToggle,
  onRun,
  onDelete,
  toggling,
  running,
  deleting,
}: CronJobCardProps) {
  const { t } = useTranslation('cron');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusBadge = getStatusBadge(job);

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* Header row: name + status */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{job.name}</p>
              <p className="text-xs text-muted-foreground font-mono">
                {formatScheduleDisplay(job.schedule)}
              </p>
            </div>
          </div>
          <Badge variant={statusBadge.variant} className="flex items-center gap-1 shrink-0">
            {statusBadge.icon}
            {t(`card.status.${statusBadge.label}`, statusBadge.label)}
          </Badge>
        </div>

        {/* Target channel */}
        <p className="text-xs text-muted-foreground truncate">
          <Radio className="inline h-3 w-3 mr-1" />
          {job.target.channelName}
        </p>

        {/* Message preview */}
        <p className="text-xs text-muted-foreground line-clamp-2">{job.message}</p>

        {/* Last run / Next run */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          {job.lastRun && (
            <span className="flex items-center gap-1">
              {job.lastRun.success ? (
                <CheckCircle2 className="h-3 w-3 text-green-500" />
              ) : (
                <XCircle className="h-3 w-3 text-destructive" />
              )}
              {t('card.last', 'Last')}: {job.lastRun.time}
            </span>
          )}
          {job.nextRun && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {t('card.next', 'Next')}: {job.nextRun}
            </span>
          )}
        </div>

        {/* Last run error */}
        {job.lastRun?.error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {job.lastRun.error}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
            {/* Toggle enabled */}
            <Switch
              checked={job.enabled}
              onCheckedChange={(checked) => onToggle(job.id, checked)}
              disabled={toggling}
            />
          </div>
          <div className="flex items-center gap-1">
            {/* Run now */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              disabled={running || !job.enabled}
              onClick={() => onRun(job.id)}
            >
              {running ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <Play className="mr-1 h-3 w-3" />
              )}
              {t('card.runNow', 'Run Now')}
            </Button>

            {/* Delete */}
            {confirmDelete ? (
              <div className="flex items-center gap-1">
                <Button
                  variant="destructive"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={deleting}
                  onClick={() => {
                    onDelete(job.id);
                    setConfirmDelete(false);
                  }}
                >
                  {deleting ? (
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="mr-1 h-3 w-3" />
                  )}
                  {t('card.deleteConfirm', 'Confirm')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setConfirmDelete(false)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="mr-1 h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// CreateTaskDialog (internal component)
// ---------------------------------------------------------------------------

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: CronJobCreateInput) => Promise<void>;
}

function CreateTaskDialog({ open, onOpenChange, onSave }: CreateTaskDialogProps) {
  const { t } = useTranslation('cron');
  const { channels } = useChannelsStore();

  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [schedule, setSchedule] = useState('');
  const [useCustomCron, setUseCustomCron] = useState(false);
  const [selectedChannelId, setSelectedChannelId] = useState('');
  const [enableImmediately, setEnableImmediately] = useState(true);
  const [saving, setSaving] = useState(false);

  const resetState = useCallback(() => {
    setName('');
    setMessage('');
    setSchedule('');
    setUseCustomCron(false);
    setSelectedChannelId('');
    setEnableImmediately(true);
    setSaving(false);
  }, []);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const selectedChannel = useMemo(
    () => channels.find((c) => c.id === selectedChannelId),
    [channels, selectedChannelId],
  );

  const canSave = useMemo(
    () =>
      name.trim().length > 0 &&
      message.trim().length > 0 &&
      schedule.trim().length > 0 &&
      selectedChannel != null,
    [name, message, schedule, selectedChannel],
  );

  const handleSave = async () => {
    if (!canSave || !selectedChannel) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        message: message.trim(),
        schedule: schedule.trim(),
        target: {
          channelType: selectedChannel.type,
          channelId: selectedChannel.id,
          channelName: selectedChannel.name,
        },
        enabled: enableImmediately,
      });
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create cron job:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t('dialog.createTitle', 'Create Scheduled Task')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t('dialog.description', 'Configure a task to run on a schedule.')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          {/* Task name */}
          <div className="space-y-1.5">
            <Label>{t('dialog.taskName', 'Task Name')}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dialog.taskNamePlaceholder', 'e.g. Daily Report')}
            />
          </div>

          {/* Message / Prompt */}
          <div className="space-y-1.5">
            <Label>{t('dialog.message', 'Message / Prompt')}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t('dialog.messagePlaceholder', 'Enter the message or prompt to send...')}
              rows={3}
            />
          </div>

          {/* Schedule */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t('dialog.schedule', 'Schedule')}</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs px-2"
                onClick={() => {
                  setUseCustomCron(!useCustomCron);
                  if (!useCustomCron) {
                    // Switching to custom, keep current value
                  } else {
                    // Switching to presets, clear the schedule
                    setSchedule('');
                  }
                }}
              >
                {useCustomCron
                  ? t('dialog.usePresets', 'Use Presets')
                  : t('dialog.useCustomCron', 'Use Custom Cron')}
              </Button>
            </div>

            {useCustomCron ? (
              <Input
                value={schedule}
                onChange={(e) => setSchedule(e.target.value)}
                placeholder={t('dialog.cronPlaceholder', '*/5 * * * *')}
                className="font-mono"
              />
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <button
                    key={preset.cron}
                    type="button"
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                      schedule === preset.cron
                        ? 'border-primary bg-primary/5 text-primary'
                        : ''
                    }`}
                    onClick={() => setSchedule(preset.cron)}
                  >
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <div>
                      <p className="font-medium">{t(preset.labelKey, preset.labelKey)}</p>
                      <p className="text-muted-foreground font-mono text-[10px]">{preset.cron}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Target channel */}
          <div className="space-y-1.5">
            <Label>{t('dialog.targetChannel', 'Target Channel')}</Label>
            {channels.length > 0 ? (
              <Select value={selectedChannelId} onValueChange={setSelectedChannelId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={t('dialog.targetChannel', 'Select a channel')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {channels.map((ch) => (
                    <SelectItem key={ch.id} value={ch.id}>
                      {ch.name} ({ch.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t('dialog.noChannels', 'No channels configured. Add a channel first.')}
              </p>
            )}
          </div>

          {/* Enable immediately */}
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div className="space-y-0.5">
              <Label className="text-sm">
                {t('dialog.enableImmediately', 'Enable Immediately')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t(
                  'dialog.enableImmediatelyDesc',
                  'Start running this task as soon as it is created.',
                )}
              </p>
            </div>
            <Switch checked={enableImmediately} onCheckedChange={setEnableImmediately} />
          </div>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {t('dialog.cancel', 'Cancel')}
          </AlertDialogCancel>
          <Button disabled={!canSave || saving} onClick={handleSave}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('dialog.saveChanges', 'Create Task')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function CronPage() {
  const { t } = useTranslation('cron');

  const {
    jobs,
    loading,
    error,
    fetchJobs,
    createJob,
    deleteJob,
    toggleJob,
    runJob,
    initStatusListener,
  } = useCronStore();

  const { fetchChannels } = useChannelsStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch jobs and channels on mount, set up status listener
  useEffect(() => {
    fetchJobs();
    fetchChannels();
    const unlisten = initStatusListener();
    return () => {
      unlisten();
    };
  }, [fetchJobs, fetchChannels, initStatusListener]);

  // -- Stats --
  const totalCount = jobs.length;
  const activeCount = jobs.filter((j) => j.enabled && (j.lastRun?.success !== false)).length;
  const pausedCount = jobs.filter((j) => !j.enabled).length;
  const failedCount = jobs.filter((j) => j.enabled && j.lastRun?.success === false).length;

  const stats = [
    {
      icon: Calendar,
      label: t('stats.total', 'Total Tasks'),
      value: totalCount,
      color: 'text-blue-500',
    },
    {
      icon: CheckCircle2,
      label: t('stats.active', 'Active'),
      value: activeCount,
      color: 'text-green-500',
    },
    {
      icon: Pause,
      label: t('stats.paused', 'Paused'),
      value: pausedCount,
      color: 'text-yellow-500',
    },
    {
      icon: XCircle,
      label: t('stats.failed', 'Failed'),
      value: failedCount,
      color: 'text-red-500',
    },
  ];

  // -- Handlers --
  const handleCreateTask = async (input: CronJobCreateInput) => {
    await createJob(input);
  };

  const handleToggle = async (id: string, enabled: boolean) => {
    setTogglingId(id);
    try {
      await toggleJob(id, enabled);
    } catch (err) {
      console.error('Failed to toggle cron job:', err);
    } finally {
      setTogglingId(null);
    }
  };

  const handleRun = async (id: string) => {
    setRunningId(id);
    try {
      await runJob(id);
    } catch (err) {
      console.error('Failed to run cron job:', err);
    } finally {
      setRunningId(null);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteJob(id);
    } catch (err) {
      console.error('Failed to delete cron job:', err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('title', 'Scheduled Tasks')}</h2>
            <p className="text-muted-foreground">
              {t('subtitle', 'Manage automated messages and scheduled jobs')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchJobs()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('refresh', 'Refresh')}
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('newTask', 'New Task')}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`h-8 w-8 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}
                  >
                    <stat.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold">{stat.value}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
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

        {/* Task list */}
        {jobs.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((job) => (
              <CronJobCard
                key={job.id}
                job={job}
                onToggle={handleToggle}
                onRun={handleRun}
                onDelete={handleDelete}
                toggling={togglingId === job.id}
                running={runningId === job.id}
                deleting={deletingId === job.id}
              />
            ))}
          </div>
        ) : (
          !loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Clock className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {t('empty.title', 'No scheduled tasks')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(
                      'empty.description',
                      'Create a task to automate messages on a schedule.',
                    )}
                  </p>
                </div>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('empty.create', 'Create Task')}
                </Button>
              </CardContent>
            </Card>
          )
        )}

        {/* Loading state */}
        {loading && jobs.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleCreateTask}
      />
    </div>
  );
}
