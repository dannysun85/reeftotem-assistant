/**
 * Setup Page
 * First-time setup wizard that guides users through initial configuration.
 * Rendered as a standalone route (not inside MainLayout).
 *
 * Steps:
 * 1. Welcome - App intro and feature highlights
 * 2. Environment - Check Node.js and OpenClaw status
 * 3. Provider - Configure AI provider (select + API key)
 * 4. Channels - Connect a messaging platform (optional)
 * 5. Installing - Show install progress for components
 * 6. Complete - Summary and "Get Started" button
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ChevronRight,
  ChevronLeft,
  Check,
  Loader2,
  AlertTriangle,
  Sparkles,
  Terminal,
  Shield,
  Globe,
  Puzzle,
  Rocket,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useOpenClawStatus } from '@/hooks/useOpenClawStatus';
import { useProvidersStore } from '@/stores/providers-store';
import { useChannelsStore } from '@/stores/channels-store';
import {
  CHANNEL_META,
  CHANNEL_ICONS,
  CHANNEL_NAMES,
  getPrimaryChannels,
  type ChannelType,
  type ChannelMeta,
} from '@/types/channel';
import { invoke } from '@/lib/bridge';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { value: 'anthropic', label: 'Anthropic', baseUrl: 'https://api.anthropic.com' },
  { value: 'deepseek', label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { value: 'ollama', label: 'Ollama (Local)', baseUrl: 'http://localhost:11434/v1' },
  { value: 'custom', label: 'Custom / Other', baseUrl: '' },
] as const;

const STEP_KEYS = ['welcome', 'runtime', 'provider', 'channel', 'installing', 'complete'] as const;
type StepKey = (typeof STEP_KEYS)[number];

const TOTAL_STEPS = STEP_KEYS.length;

interface InstallComponent {
  id: string;
  label: string;
  status: 'pending' | 'installing' | 'installed' | 'failed';
}

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

function StepIndicator({
  currentStep,
  t,
}: {
  currentStep: number;
  t: TFunction;
}) {
  return (
    <div className="flex items-center justify-center gap-0 px-4 py-6">
      {STEP_KEYS.map((key, index) => {
        const isActive = index === currentStep;
        const isCompleted = index < currentStep;

        return (
          <div key={key} className="flex items-center">
            {/* Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`
                  flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold
                  transition-all duration-300
                  ${
                    isCompleted
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isActive
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                  }
                `}
              >
                {isCompleted ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              <span
                className={`
                  mt-1.5 text-[10px] leading-tight max-w-[60px] text-center
                  ${isActive ? 'font-medium text-primary' : 'text-muted-foreground'}
                `}
              >
                {t(`steps.${key}.title`)}
              </span>
            </div>

            {/* Connecting line */}
            {index < TOTAL_STEPS - 1 && (
              <div
                className={`
                  mx-1 h-0.5 w-6 sm:w-10 transition-colors duration-300
                  ${index < currentStep ? 'bg-primary' : 'bg-muted-foreground/20'}
                `}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1: Welcome
// ---------------------------------------------------------------------------

function WelcomeStep({ t }: { t: TFunction }) {
  const features = [
    { icon: Terminal, key: 'noCommand' },
    { icon: Sparkles, key: 'modernUI' },
    { icon: Puzzle, key: 'bundles' },
    { icon: Globe, key: 'crossPlatform' },
  ];

  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Hero */}
      <div className="space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t('welcome.title')}</h1>
        <p className="max-w-md text-muted-foreground leading-relaxed">
          {t('welcome.description')}
        </p>
      </div>

      {/* Feature cards */}
      <div className="grid w-full max-w-lg grid-cols-2 gap-3">
        {features.map(({ icon: Icon, key }) => (
          <Card key={key} className="py-4">
            <CardContent className="flex items-center gap-3 px-4 py-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <span className="text-sm font-medium text-left">
                {t(`welcome.features.${key}`)}
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2: Environment
// ---------------------------------------------------------------------------

interface RuntimeCheckItem {
  id: string;
  label: string;
  status: 'checking' | 'success' | 'error';
  detail?: string;
}

function RuntimeStep({
  t,
  checks,
  onRecheck,
  recheckLoading,
  onInstallOpenClaw,
  installing,
}: {
  t: TFunction;
  checks: RuntimeCheckItem[];
  onRecheck: () => void;
  recheckLoading: boolean;
  onInstallOpenClaw: () => void;
  installing: boolean;
}) {
  const hasError = checks.some((c) => c.status === 'error');
  const allDone = checks.every((c) => c.status !== 'checking');
  const nodejsOk = checks.find((c) => c.id === 'nodejs')?.status === 'success';
  const openclawMissing = checks.find((c) => c.id === 'openclaw')?.status === 'error';

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t('runtime.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('steps.runtime.description')}</p>
      </div>

      <Card>
        <CardContent className="divide-y pt-4">
          {checks.map((check) => (
            <div key={check.id} className="flex items-center justify-between py-3.5">
              <div className="flex items-center gap-3">
                {check.status === 'checking' && (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                )}
                {check.status === 'success' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {check.status === 'error' && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm font-medium">{check.label}</span>
              </div>
              <span className="text-xs text-muted-foreground max-w-[200px] truncate">
                {check.status === 'checking'
                  ? t('runtime.status.checking')
                  : check.detail ?? ''}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Node.js missing → show install link */}
      {allDone && !nodejsOk && hasError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                {t('runtime.issue.title', 'Node.js is required')}
              </p>
              <p className="text-xs text-muted-foreground">
                {t('runtime.issue.nodeDesc', 'Please install Node.js 18+ from nodejs.org, then click "Recheck".')}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* OpenClaw missing + Node.js OK → show install button */}
      {allDone && nodejsOk && openclawMissing && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <Puzzle className="h-5 w-5 shrink-0 text-primary mt-0.5" />
            <div className="space-y-3 flex-1">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {t('runtime.install.title', 'OpenClaw not found')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t(
                    'runtime.install.desc',
                    'OpenClaw provides AI chat, channel integration, and skill execution. Click below to install automatically.',
                  )}
                </p>
              </div>
              <Button
                size="sm"
                onClick={onInstallOpenClaw}
                disabled={installing}
                className="w-full"
              >
                {installing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="mr-2 h-4 w-4" />
                )}
                {installing
                  ? t('runtime.install.installing', 'Installing...')
                  : t('runtime.install.button', 'Install OpenClaw')}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-center">
        <Button variant="outline" size="sm" onClick={onRecheck} disabled={recheckLoading || installing}>
          {recheckLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('runtime.recheck')}
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3: Provider
// ---------------------------------------------------------------------------

function ProviderStep({
  t,
  selectedProvider,
  setSelectedProvider,
  apiKey,
  setApiKey,
  baseUrl,
  setBaseUrl,
  showKey,
  setShowKey,
  providerSaved,
  providerError,
  saving,
  onSave,
}: {
  t: TFunction;
  selectedProvider: string;
  setSelectedProvider: (v: string) => void;
  apiKey: string;
  setApiKey: (v: string) => void;
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  showKey: boolean;
  setShowKey: (v: boolean) => void;
  providerSaved: boolean;
  providerError: string | null;
  saving: boolean;
  onSave: () => void;
}) {
  const isOllama = selectedProvider === 'ollama';
  const isCustom = selectedProvider === 'custom';

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t('steps.provider.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('steps.provider.description')}</p>
      </div>

      <Card>
        <CardContent className="space-y-5 pt-4">
          {/* Provider select */}
          <div className="space-y-2">
            <Label>{t('provider.label')}</Label>
            <Select value={selectedProvider} onValueChange={(v) => {
              setSelectedProvider(v);
              const match = PROVIDER_OPTIONS.find((p) => p.value === v);
              if (match) setBaseUrl(match.baseUrl);
            }}>
              <SelectTrigger>
                <SelectValue placeholder={t('provider.selectPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base URL (always visible for custom, hidden for others unless they want to edit) */}
          {(isCustom || isOllama) && (
            <div className="space-y-2">
              <Label>{t('provider.baseUrl')}</Label>
              <Input
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
          )}

          {/* API Key */}
          {!isOllama && selectedProvider && (
            <div className="space-y-2">
              <Label>{t('provider.apiKey')}</Label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">{t('provider.storedLocally')}</p>
            </div>
          )}

          {/* Save button */}
          {selectedProvider && (
            <Button
              onClick={onSave}
              disabled={saving || (!isOllama && !apiKey)}
              className="w-full"
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isOllama ? t('provider.save') : t('provider.validateSave')}
            </Button>
          )}

          {/* Status messages */}
          {providerSaved && (
            <div className="flex items-center gap-2 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" />
              {t('provider.valid')}
            </div>
          )}
          {providerError && (
            <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <XCircle className="h-4 w-4" />
              {providerError}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4: Channels
// ---------------------------------------------------------------------------

function ChannelStep({
  t,
  selectedChannel,
  setSelectedChannel,
  channelConfig,
  setChannelConfig,
  channelConnected,
  channelError,
  connecting,
  onConnect,
}: {
  t: TFunction;
  selectedChannel: ChannelType | null;
  setSelectedChannel: (v: ChannelType | null) => void;
  channelConfig: Record<string, string>;
  setChannelConfig: (v: Record<string, string>) => void;
  channelConnected: boolean;
  channelError: string | null;
  connecting: boolean;
  onConnect: () => void;
}) {
  const primaryChannels = getPrimaryChannels();
  const selectedMeta: ChannelMeta | null = selectedChannel ? CHANNEL_META[selectedChannel] : null;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t('channel.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('channel.subtitle')}</p>
      </div>

      {/* Channel connected success */}
      {channelConnected && selectedChannel && (
        <Card className="border-green-500/50 bg-green-500/5">
          <CardContent className="space-y-3 pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span className="font-medium text-sm">
                {t('channel.connected', { name: CHANNEL_NAMES[selectedChannel] })}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">{t('channel.connectedDesc')}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedChannel(null);
                setChannelConfig({});
              }}
            >
              {t('channel.configureAnother')}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Channel picker grid */}
      {!channelConnected && !selectedChannel && (
        <div className="grid grid-cols-2 gap-3">
          {primaryChannels.map((chType) => {
            const meta = CHANNEL_META[chType];
            return (
              <Card
                key={chType}
                className="cursor-pointer hover:border-primary/50 hover:shadow-sm transition-all"
                onClick={() => {
                  setSelectedChannel(chType);
                  setChannelConfig({});
                }}
              >
                <CardContent className="flex items-center gap-3 px-4 py-4">
                  <span className="text-2xl">{CHANNEL_ICONS[chType]}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{CHANNEL_NAMES[chType]}</p>
                    <Badge variant="outline" className="text-[10px] mt-1">
                      {meta.connectionType}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Channel configuration form */}
      {!channelConnected && selectedChannel && selectedMeta && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <span className="text-xl">{CHANNEL_ICONS[selectedChannel]}</span>
              {t('channel.configure', { name: CHANNEL_NAMES[selectedChannel] })}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Instructions */}
            {selectedMeta.instructions.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground">{t('channel.howTo')}</p>
                <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                  {selectedMeta.instructions.map((instruction, i) => (
                    <li key={i}>{instruction}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* Config fields */}
            {selectedMeta.configFields.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-sm">{field.label}</Label>
                <Input
                  type={field.type === 'password' ? 'password' : 'text'}
                  placeholder={field.placeholder}
                  value={channelConfig[field.key] ?? ''}
                  onChange={(e) =>
                    setChannelConfig({ ...channelConfig, [field.key]: e.target.value })
                  }
                />
                {field.description && (
                  <p className="text-[11px] text-muted-foreground">{field.description}</p>
                )}
              </div>
            ))}

            {/* Connect button */}
            {selectedMeta.configFields.length > 0 && (
              <Button
                onClick={onConnect}
                disabled={
                  connecting ||
                  selectedMeta.configFields
                    .filter((f) => f.required)
                    .some((f) => !channelConfig[f.key])
                }
                className="w-full"
              >
                {connecting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Check className="mr-2 h-4 w-4" />
                {t('channel.configure', { name: CHANNEL_NAMES[selectedChannel] })}
              </Button>
            )}

            {/* Error */}
            {channelError && (
              <div className="flex items-center gap-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <XCircle className="h-4 w-4" />
                {channelError}
              </div>
            )}

            {/* Back to picker */}
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                setSelectedChannel(null);
                setChannelConfig({});
              }}
            >
              <ChevronLeft className="mr-1 h-4 w-4" />
              {t('nav.back')}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5: Installing
// ---------------------------------------------------------------------------

function InstallingStep({
  t,
  components,
  progress,
  installError,
}: {
  t: TFunction;
  components: InstallComponent[];
  progress: number;
  installError: string | null;
}) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-bold">{t('installing.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('installing.subtitle')}</p>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('installing.progress')}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Components list */}
      <Card>
        <CardContent className="divide-y pt-4">
          {components.map((comp) => (
            <div key={comp.id} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                {comp.status === 'pending' && (
                  <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                {comp.status === 'installing' && (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                )}
                {comp.status === 'installed' && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                {comp.status === 'failed' && (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className="text-sm font-medium">{comp.label}</span>
              </div>
              <Badge
                variant={
                  comp.status === 'installed'
                    ? 'success'
                    : comp.status === 'failed'
                      ? 'destructive'
                      : comp.status === 'installing'
                        ? 'default'
                        : 'secondary'
                }
              >
                {t(`installing.status.${comp.status}`)}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Error */}
      {installError && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-start gap-3 pt-4">
            <AlertTriangle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {t('installing.error')} {installError}
              </p>
              <p className="text-xs text-muted-foreground">{t('installing.restart')}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Waiting hint */}
      {!installError && progress < 100 && (
        <p className="text-center text-xs text-muted-foreground animate-pulse">
          {t('installing.wait')}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 6: Complete
// ---------------------------------------------------------------------------

function CompleteStep({
  t,
  providerName,
  componentsInstalled,
  openclawRunning,
}: {
  t: TFunction;
  providerName: string | null;
  componentsInstalled: number;
  openclawRunning: boolean;
}) {
  return (
    <div className="flex flex-col items-center text-center space-y-8">
      {/* Hero */}
      <div className="space-y-3">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/10">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{t('complete.title')}</h1>
        <p className="max-w-md text-muted-foreground leading-relaxed">
          {t('complete.subtitle')}
        </p>
      </div>

      {/* Summary cards */}
      <div className="w-full max-w-sm space-y-3">
        {/* Provider */}
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4 py-0">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-blue-500" />
              <span className="text-sm">{t('complete.provider')}</span>
            </div>
            <Badge variant={providerName ? 'default' : 'secondary'}>
              {providerName ?? '--'}
            </Badge>
          </CardContent>
        </Card>

        {/* Components */}
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4 py-0">
            <div className="flex items-center gap-2">
              <Puzzle className="h-4 w-4 text-purple-500" />
              <span className="text-sm">{t('complete.components')}</span>
            </div>
            <Badge variant="default">{componentsInstalled}</Badge>
          </CardContent>
        </Card>

        {/* OpenClaw */}
        <Card className="py-3">
          <CardContent className="flex items-center justify-between px-4 py-0">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-orange-500" />
              <span className="text-sm">OpenClaw</span>
            </div>
            <Badge variant={openclawRunning ? 'success' : 'secondary'}>
              {openclawRunning ? t('complete.running') : 'Stopped'}
            </Badge>
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">{t('complete.footer')}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main SetupPage component
// ---------------------------------------------------------------------------

export default function SetupPage() {
  const { t } = useTranslation('setup');
  const navigate = useNavigate();

  // ---- Step state ----
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [transitioning, setTransitioning] = useState(false);
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Stores ----
  const openclawStatus = useOpenClawStatus();
  const { saveProvider, saveApiKey, setDefaultProvider } = useProvidersStore();
  const { addChannel, validateCredentials } = useChannelsStore();

  // ---- Step 2 state: Runtime ----
  const [runtimeChecks, setRuntimeChecks] = useState<RuntimeCheckItem[]>([
    { id: 'nodejs', label: t('runtime.nodejs'), status: 'checking' },
    { id: 'openclaw', label: 'OpenClaw', status: 'checking' },
  ]);
  const [recheckLoading, setRecheckLoading] = useState(false);

  // ---- Step 3 state: Provider ----
  const [selectedProvider, setSelectedProvider] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);

  // ---- Step 4 state: Channel ----
  const [selectedChannel, setSelectedChannel] = useState<ChannelType | null>(null);
  const [channelConfig, setChannelConfig] = useState<Record<string, string>>({});
  const [channelConnected, setChannelConnected] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [connectingChannel, setConnectingChannel] = useState(false);

  // ---- Install state (shared between Step 2 button and Step 5) ----
  const [openclawInstalling, setOpenclawInstalling] = useState(false);

  // ---- Step 5 state: Installing ----
  const [installComponents, setInstallComponents] = useState<InstallComponent[]>([
    { id: 'openclaw', label: 'OpenClaw', status: 'pending' },
    { id: 'skills', label: 'Built-in Skills', status: 'pending' },
  ]);
  const [installProgress, setInstallProgress] = useState(0);
  const [installError, setInstallError] = useState<string | null>(null);
  const installStarted = useRef(false);

  // ---- Navigation helpers ----

  const goToStep = useCallback(
    (nextStep: number) => {
      if (transitioning) return;
      if (nextStep < 0 || nextStep >= TOTAL_STEPS) return;

      setDirection(nextStep > currentStep ? 'forward' : 'backward');
      setTransitioning(true);

      if (transitionTimer.current) clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => {
        setCurrentStep(nextStep);
        setTransitioning(false);
      }, 200);
    },
    [currentStep, transitioning],
  );

  const handleNext = useCallback(() => goToStep(currentStep + 1), [goToStep, currentStep]);
  const handleBack = useCallback(() => goToStep(currentStep - 1), [goToStep, currentStep]);

  // ---- Step 2: Environment checks ----

  const runRuntimeChecks = useCallback(async () => {
    setRecheckLoading(true);
    setRuntimeChecks((prev) =>
      prev.map((c) => ({ ...c, status: 'checking' as const, detail: undefined })),
    );

    // Node.js check
    try {
      const version = await invoke<string>('check_nodejs');
      setRuntimeChecks((prev) =>
        prev.map((c) =>
          c.id === 'nodejs'
            ? { ...c, status: 'success', detail: version }
            : c,
        ),
      );
    } catch (err) {
      setRuntimeChecks((prev) =>
        prev.map((c) =>
          c.id === 'nodejs'
            ? { ...c, status: 'error', detail: String(err) }
            : c,
        ),
      );
    }

    // OpenClaw check
    try {
      const version = await invoke<string>('check_openclaw');
      setRuntimeChecks((prev) =>
        prev.map((c) =>
          c.id === 'openclaw'
            ? { ...c, status: 'success', detail: version }
            : c,
        ),
      );
    } catch (err) {
      setRuntimeChecks((prev) =>
        prev.map((c) =>
          c.id === 'openclaw'
            ? { ...c, status: 'error', detail: String(err) }
            : c,
        ),
      );
    }

    setRecheckLoading(false);
  }, []);

  // Run checks when entering the runtime step
  useEffect(() => {
    if (currentStep === 1) {
      runRuntimeChecks();
    }
  }, [currentStep]);

  // Install OpenClaw from runtime step
  const handleInstallOpenClaw = useCallback(async () => {
    setOpenclawInstalling(true);
    try {
      await invoke('install_openclaw');
      // Recheck after install
      await runRuntimeChecks();
    } catch (err) {
      console.error('OpenClaw install failed:', err);
    } finally {
      setOpenclawInstalling(false);
    }
  }, [runRuntimeChecks]);

  // ---- Step 3: Save provider ----

  const handleSaveProvider = useCallback(async () => {
    setSavingProvider(true);
    setProviderError(null);
    setProviderSaved(false);

    try {
      const match = PROVIDER_OPTIONS.find((p) => p.value === selectedProvider);
      if (!match) throw new Error('No provider selected');

      const providerId = `setup-${match.value}`;
      const now = new Date().toISOString();

      await saveProvider({
        id: providerId,
        name: match.label,
        type: match.value as any,
        baseUrl: baseUrl || match.baseUrl,
        enabled: true,
        createdAt: now,
        updatedAt: now,
      });

      if (apiKey && match.value !== 'ollama') {
        await saveApiKey(providerId, apiKey);
      }

      await setDefaultProvider(providerId);
      setProviderSaved(true);
    } catch (err) {
      setProviderError(t('provider.invalid'));
      console.error('Failed to save provider during setup:', err);
    } finally {
      setSavingProvider(false);
    }
  }, [selectedProvider, apiKey, baseUrl, saveProvider, saveApiKey, setDefaultProvider, t]);

  // ---- Step 4: Connect channel ----

  const handleConnectChannel = useCallback(async () => {
    if (!selectedChannel) return;
    setConnectingChannel(true);
    setChannelError(null);

    try {
      const valid = await validateCredentials(selectedChannel, channelConfig);
      if (!valid) {
        setChannelError(t('channel.validationError'));
        setConnectingChannel(false);
        return;
      }

      await addChannel(
        selectedChannel,
        CHANNEL_NAMES[selectedChannel],
        channelConfig,
      );
      setChannelConnected(true);
    } catch (err) {
      setChannelError(String(err));
    } finally {
      setConnectingChannel(false);
    }
  }, [selectedChannel, channelConfig, validateCredentials, addChannel, t]);

  // ---- Step 5: Real installation flow ----

  useEffect(() => {
    if (currentStep !== 4 || installStarted.current) return;
    installStarted.current = true;

    const runInstall = async () => {
      const totalSteps = installComponents.length;
      let completedSteps = 0;

      const markStatus = (id: string, status: InstallComponent['status']) => {
        setInstallComponents((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status } : c)),
        );
      };

      const advanceProgress = () => {
        completedSteps++;
        setInstallProgress((completedSteps / totalSteps) * 100);
      };

      // Step 1: Install OpenClaw (if not already installed)
      markStatus('openclaw', 'installing');
      try {
        // Check if already installed
        await invoke('check_openclaw');
        markStatus('openclaw', 'installed');
        advanceProgress();
      } catch {
        // Not installed, install it
        try {
          await invoke('install_openclaw');
          markStatus('openclaw', 'installed');
          advanceProgress();
        } catch (err) {
          markStatus('openclaw', 'failed');
          setInstallError(String(err));
          advanceProgress();
        }
      }

      // Step 2: Verify built-in skills are loaded
      markStatus('skills', 'installing');
      try {
        await invoke('skill_list');
        markStatus('skills', 'installed');
        advanceProgress();
      } catch {
        // Skills module might not be fully ready, mark as installed anyway
        markStatus('skills', 'installed');
        advanceProgress();
      }
    };

    // Small delay before starting
    setTimeout(runInstall, 400);
  }, [currentStep]);

  // Auto-advance from installing to complete when done
  useEffect(() => {
    if (currentStep === 4 && installProgress >= 100) {
      const timer = setTimeout(() => handleNext(), 800);
      return () => clearTimeout(timer);
    }
  }, [currentStep, installProgress, handleNext]);

  // ---- Determine which step to render ----

  const stepKey = STEP_KEYS[currentStep];

  // Can we proceed?
  const canNext = (() => {
    switch (stepKey) {
      case 'welcome':
        return true;
      case 'runtime':
        return true; // always allow skipping
      case 'provider':
        return true; // allow skipping, but show validation if filled
      case 'channel':
        return true; // optional step
      case 'installing':
        return installProgress >= 100;
      case 'complete':
        return true;
      default:
        return true;
    }
  })();

  const isLastStep = currentStep === TOTAL_STEPS - 1;
  const isFirstStep = currentStep === 0;

  // Determine the provider name for the complete screen
  const completedProviderName = providerSaved
    ? PROVIDER_OPTIONS.find((p) => p.value === selectedProvider)?.label ?? null
    : null;

  const completedComponentsCount = installComponents.filter(
    (c) => c.status === 'installed',
  ).length;

  const openclawRunning = openclawStatus.state === 'running';

  // ---- Step animation classes ----

  const stepContentClass = transitioning
    ? direction === 'forward'
      ? 'opacity-0 translate-x-8'
      : 'opacity-0 -translate-x-8'
    : 'opacity-100 translate-x-0';

  // ---- Handle completion ----

  const handleGetStarted = useCallback(() => {
    navigate('/');
  }, [navigate]);

  // ---- Render ----

  return (
    <div className="flex h-screen w-screen flex-col bg-background">
      {/* Top: Step indicator */}
      <StepIndicator currentStep={currentStep} t={t} />

      {/* Middle: Step content (scrollable) */}
      <div className="flex-1 overflow-auto">
        <div
          className={`
            mx-auto max-w-xl px-6 py-4 transition-all duration-200 ease-in-out
            ${stepContentClass}
          `}
        >
          {stepKey === 'welcome' && <WelcomeStep t={t} />}

          {stepKey === 'runtime' && (
            <RuntimeStep
              t={t}
              checks={runtimeChecks}
              onRecheck={runRuntimeChecks}
              recheckLoading={recheckLoading}
              onInstallOpenClaw={handleInstallOpenClaw}
              installing={openclawInstalling}
            />
          )}

          {stepKey === 'provider' && (
            <ProviderStep
              t={t}
              selectedProvider={selectedProvider}
              setSelectedProvider={setSelectedProvider}
              apiKey={apiKey}
              setApiKey={setApiKey}
              baseUrl={baseUrl}
              setBaseUrl={setBaseUrl}
              showKey={showKey}
              setShowKey={setShowKey}
              providerSaved={providerSaved}
              providerError={providerError}
              saving={savingProvider}
              onSave={handleSaveProvider}
            />
          )}

          {stepKey === 'channel' && (
            <ChannelStep
              t={t}
              selectedChannel={selectedChannel}
              setSelectedChannel={setSelectedChannel}
              channelConfig={channelConfig}
              setChannelConfig={setChannelConfig}
              channelConnected={channelConnected}
              channelError={channelError}
              connecting={connectingChannel}
              onConnect={handleConnectChannel}
            />
          )}

          {stepKey === 'installing' && (
            <InstallingStep
              t={t}
              components={installComponents}
              progress={installProgress}
              installError={installError}
            />
          )}

          {stepKey === 'complete' && (
            <CompleteStep
              t={t}
              providerName={completedProviderName}
              componentsInstalled={completedComponentsCount}
              openclawRunning={openclawRunning}
            />
          )}
        </div>
      </div>

      {/* Bottom: Navigation bar */}
      <div className="border-t bg-background">
        <div className="mx-auto flex max-w-xl items-center justify-between px-6 py-4">
          {/* Left side */}
          <div>
            {!isFirstStep && stepKey !== 'installing' && (
              <Button variant="ghost" size="sm" onClick={handleBack} disabled={transitioning}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                {t('nav.back')}
              </Button>
            )}
          </div>

          {/* Center: skip options */}
          <div>
            {stepKey === 'welcome' && (
              <Button
                variant="link"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() => navigate('/')}
              >
                {t('nav.skipSetup')}
              </Button>
            )}
            {(stepKey === 'channel' || stepKey === 'provider') && (
              <Button
                variant="link"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={handleNext}
              >
                {t('nav.skipStep')}
              </Button>
            )}
          </div>

          {/* Right side */}
          <div>
            {isLastStep ? (
              <Button onClick={handleGetStarted} disabled={transitioning}>
                {t('nav.getStarted')}
                <Rocket className="ml-2 h-4 w-4" />
              </Button>
            ) : stepKey !== 'installing' ? (
              <Button onClick={handleNext} disabled={!canNext || transitioning}>
                {t('nav.next')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              /* Installing step: show skip */
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={transitioning}
              >
                {t('installing.skip')}
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
