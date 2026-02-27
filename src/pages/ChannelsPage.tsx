/**
 * Channels Page
 * Manages messaging channel integrations (WhatsApp, Telegram, Discord, etc.).
 * Provides channel overview stats, a card grid for existing channels,
 * and an AlertDialog-based wizard for adding new channels.
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useChannelsStore } from '@/stores/channels-store';
import {
  CHANNEL_META,
  CHANNEL_ICONS,
  CHANNEL_NAMES,
  type ChannelType,
  type Channel,
  type ChannelConfigField,
} from '@/types/channel';
import {
  Radio,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ExternalLink,
  AlertTriangle,
  Signal,
  SignalZero,
  ShieldCheck,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

type StatusVariant = 'default' | 'success' | 'destructive' | 'warning' | 'secondary';

function statusBadgeVariant(status: Channel['status']): StatusVariant {
  switch (status) {
    case 'connected':
      return 'success';
    case 'disconnected':
      return 'secondary';
    case 'connecting':
      return 'warning';
    case 'error':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function statusIcon(status: Channel['status']) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 className="h-3.5 w-3.5" />;
    case 'disconnected':
      return <XCircle className="h-3.5 w-3.5" />;
    case 'connecting':
      return <Loader2 className="h-3.5 w-3.5 animate-spin" />;
    case 'error':
      return <AlertTriangle className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Add Channel Dialog (internal component)
// ---------------------------------------------------------------------------

interface AddChannelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (type: ChannelType, name: string, config: Record<string, string>) => Promise<void>;
}

function AddChannelDialog({ open, onOpenChange, onSave }: AddChannelDialogProps) {
  const { t } = useTranslation('channels');

  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [selectedType, setSelectedType] = useState<ChannelType | null>(null);
  const [channelName, setChannelName] = useState('');
  const [configValues, setConfigValues] = useState<Record<string, string>>({});
  const [validating, setValidating] = useState(false);
  const [validated, setValidated] = useState(false);
  const [saving, setSaving] = useState(false);

  const allTypes = useMemo(() => Object.keys(CHANNEL_META) as ChannelType[], []);

  const meta = selectedType ? CHANNEL_META[selectedType] : null;

  const resetState = useCallback(() => {
    setStep('select');
    setSelectedType(null);
    setChannelName('');
    setConfigValues({});
    setValidating(false);
    setValidated(false);
    setSaving(false);
  }, []);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      resetState();
    }
  }, [open, resetState]);

  const handleSelectPlatform = (type: ChannelType) => {
    setSelectedType(type);
    setChannelName(CHANNEL_NAMES[type]);
    setConfigValues({});
    setValidated(false);
    setStep('configure');
  };

  const handleConfigChange = (key: string, value: string) => {
    setConfigValues((prev) => ({ ...prev, [key]: value }));
    setValidated(false);
  };

  const { validateCredentials } = useChannelsStore();

  const handleValidate = async () => {
    if (!selectedType) return;
    setValidating(true);
    try {
      const valid = await validateCredentials(selectedType, configValues);
      setValidated(valid);
    } catch {
      setValidated(false);
    } finally {
      setValidating(false);
    }
  };

  const handleSave = async () => {
    if (!selectedType) return;
    setSaving(true);
    try {
      await onSave(selectedType, channelName, configValues);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to save channel:', err);
    } finally {
      setSaving(false);
    }
  };

  const requiredFieldsFilled = useMemo(() => {
    if (!meta) return false;
    return meta.configFields
      .filter((f) => f.required)
      .every((f) => (configValues[f.key] ?? '').trim().length > 0);
  }, [meta, configValues]);

  // -- Render: Platform selection grid --
  const renderPlatformGrid = () => (
    <div className="grid grid-cols-3 gap-3">
      {allTypes.map((type) => {
        const m = CHANNEL_META[type];
        return (
          <button
            key={type}
            type="button"
            className="flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => handleSelectPlatform(type)}
          >
            <span className="text-2xl">{CHANNEL_ICONS[type]}</span>
            <span className="text-xs font-medium leading-tight">{CHANNEL_NAMES[type]}</span>
            {m.isPlugin && (
              <Badge variant="outline" className="text-[10px] px-1 py-0">
                {t('plugin', 'Plugin')}
              </Badge>
            )}
          </button>
        );
      })}
    </div>
  );

  // -- Render: Config form --
  const renderConfigForm = () => {
    if (!meta) return null;

    return (
      <div className="space-y-4">
        {/* Back to platform select */}
        <Button variant="ghost" size="sm" onClick={() => setStep('select')}>
          {t('dialog.backToPlatforms', 'Back')}
        </Button>

        {/* Platform badge */}
        <div className="flex items-center gap-2">
          <span className="text-2xl">{meta.icon}</span>
          <div>
            <p className="font-medium">{meta.name}</p>
            <p className="text-xs text-muted-foreground">{t(meta.description, meta.description)}</p>
          </div>
        </div>

        {/* Channel display name */}
        <div className="space-y-1.5">
          <Label>{t('dialog.channelName', 'Channel Name')}</Label>
          <Input
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            placeholder={t('dialog.channelNamePlaceholder', 'My channel')}
          />
        </div>

        {/* Dynamic config fields */}
        {meta.configFields.map((field: ChannelConfigField) => (
          <div key={field.key} className="space-y-1.5">
            <Label>
              {t(field.label, field.label)}
              {field.required && <span className="text-destructive ml-0.5">*</span>}
            </Label>
            {field.type === 'select' && field.options ? (
              <Select
                value={configValues[field.key] ?? ''}
                onValueChange={(v) => handleConfigChange(field.key, v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={field.placeholder ? t(field.placeholder, field.placeholder) : ''} />
                </SelectTrigger>
                <SelectContent>
                  {field.options.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Input
                type={field.type === 'password' ? 'password' : 'text'}
                value={configValues[field.key] ?? ''}
                onChange={(e) => handleConfigChange(field.key, e.target.value)}
                placeholder={field.placeholder ? t(field.placeholder, field.placeholder) : ''}
              />
            )}
            {field.description && (
              <p className="text-xs text-muted-foreground">{t(field.description, field.description)}</p>
            )}
            {field.envVar && (
              <p className="text-xs text-muted-foreground/60">
                {t('dialog.envVar', 'Env var')}: <code className="font-mono">{field.envVar}</code>
              </p>
            )}
          </div>
        ))}

        {/* Setup instructions */}
        {meta.instructions.length > 0 && (
          <div className="rounded-md bg-muted p-3 space-y-1">
            <p className="text-xs font-medium mb-1">{t('dialog.setupInstructions', 'Setup Instructions')}</p>
            <ol className="list-decimal list-inside text-xs text-muted-foreground space-y-0.5">
              {meta.instructions.map((inst, i) => (
                <li key={i}>{t(inst, inst)}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Docs link */}
        {meta.docsUrl && (
          <Button
            variant="link"
            size="sm"
            className="p-0 h-auto"
            onClick={() => {
              // docsUrl values are i18n keys; the actual URL would be resolved.
              // For now we just log it.
              window.open(t(meta.docsUrl, meta.docsUrl), '_blank');
            }}
          >
            <ExternalLink className="mr-1 h-3 w-3" />
            {t('dialog.viewDocs', 'View Documentation')}
          </Button>
        )}
      </div>
    );
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <AlertDialogHeader>
          <AlertDialogTitle>
            {step === 'select'
              ? t('dialog.title', 'Add Channel')
              : t('dialog.configureTitle', 'Configure Channel')}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {step === 'select'
              ? t('dialog.description', 'Choose a messaging platform to connect.')
              : t('dialog.configureDescription', 'Fill in the required credentials to connect.')}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {step === 'select' ? renderPlatformGrid() : renderConfigForm()}

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => onOpenChange(false)}>
            {t('dialog.cancel', 'Cancel')}
          </AlertDialogCancel>

          {step === 'configure' && (
            <>
              {/* Validate button */}
              <Button
                variant="outline"
                disabled={!requiredFieldsFilled || validating}
                onClick={handleValidate}
              >
                {validating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : validated ? (
                  <CheckCircle2 className="mr-2 h-4 w-4 text-green-500" />
                ) : (
                  <ShieldCheck className="mr-2 h-4 w-4" />
                )}
                {validated
                  ? t('dialog.validated', 'Validated')
                  : t('dialog.validate', 'Validate')}
              </Button>

              {/* Save button */}
              <Button
                disabled={!requiredFieldsFilled || saving || !channelName.trim()}
                onClick={handleSave}
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('dialog.save', 'Save')}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ---------------------------------------------------------------------------
// Channel Card (internal component)
// ---------------------------------------------------------------------------

interface ChannelCardProps {
  channel: Channel;
  onRemove: (id: string) => void;
  removing: boolean;
}

function ChannelCard({ channel, onRemove, removing }: ChannelCardProps) {
  const { t } = useTranslation('channels');

  return (
    <Card className="group relative transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* Header row: icon + name */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{CHANNEL_ICONS[channel.type]}</span>
            <div>
              <p className="font-medium text-sm leading-tight">{channel.name}</p>
              <p className="text-xs text-muted-foreground">{CHANNEL_NAMES[channel.type]}</p>
            </div>
          </div>
          <Badge variant={statusBadgeVariant(channel.status)} className="flex items-center gap-1">
            {statusIcon(channel.status)}
            {t(`status.${channel.status}`, channel.status)}
          </Badge>
        </div>

        {/* Account / metadata */}
        {channel.accountId && (
          <p className="text-xs text-muted-foreground truncate">
            {t('card.account', 'Account')}: {channel.accountId}
          </p>
        )}

        {/* Error message */}
        {channel.error && (
          <p className="text-xs text-destructive flex items-center gap-1">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            {channel.error}
          </p>
        )}

        {/* Last activity */}
        {channel.lastActivity && (
          <p className="text-xs text-muted-foreground">
            {t('card.lastActivity', 'Last activity')}: {channel.lastActivity}
          </p>
        )}

        {/* Remove button */}
        <div className="flex justify-end pt-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
            disabled={removing}
            onClick={() => onRemove(channel.id)}
          >
            {removing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Trash2 className="mr-1 h-3 w-3" />
            )}
            {t('card.remove', 'Remove')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function ChannelsPage() {
  const { t } = useTranslation('channels');

  const {
    channels,
    loading,
    error,
    fetchChannels,
    addChannel,
    removeChannel,
  } = useChannelsStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
  }, [fetchChannels]);

  // -- Stats --
  const totalCount = channels.length;
  const connectedCount = channels.filter((c) => c.status === 'connected').length;
  const disconnectedCount = channels.filter(
    (c) => c.status === 'disconnected' || c.status === 'error',
  ).length;

  const stats = [
    {
      icon: Radio,
      label: t('stats.total', 'Total Channels'),
      value: totalCount,
      color: 'text-blue-500',
    },
    {
      icon: Signal,
      label: t('stats.connected', 'Connected'),
      value: connectedCount,
      color: 'text-green-500',
    },
    {
      icon: SignalZero,
      label: t('stats.disconnected', 'Disconnected'),
      value: disconnectedCount,
      color: 'text-red-500',
    },
  ];

  // -- Handlers --
  const handleAddChannel = async (
    type: ChannelType,
    name: string,
    config: Record<string, string>,
  ) => {
    await addChannel(type, name, config);
  };

  const handleRemoveChannel = async (id: string) => {
    setRemovingId(id);
    try {
      await removeChannel(id);
    } catch (err) {
      console.error('Failed to remove channel:', err);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('title', 'Channels')}</h2>
            <p className="text-muted-foreground">
              {t('description', 'Manage your messaging channel integrations')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchChannels()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('refresh', 'Refresh')}
            </Button>
            <Button size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('addChannel', 'Add Channel')}
            </Button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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

        {/* Channel grid */}
        {channels.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => (
              <ChannelCard
                key={channel.id}
                channel={channel}
                onRemove={handleRemoveChannel}
                removing={removingId === channel.id}
              />
            ))}
          </div>
        ) : (
          !loading && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
                <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                  <Radio className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">
                    {t('empty.title', 'No channels configured')}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t('empty.description', 'Add a channel to start receiving messages.')}
                  </p>
                </div>
                <Button size="sm" onClick={() => setDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  {t('addChannel', 'Add Channel')}
                </Button>
              </CardContent>
            </Card>
          )
        )}

        {/* Loading state */}
        {loading && channels.length === 0 && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Add Channel Dialog */}
      <AddChannelDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSave={handleAddChannel}
      />
    </div>
  );
}
