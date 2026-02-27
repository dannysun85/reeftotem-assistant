/**
 * Settings Page
 * Application settings including appearance, language, Live2D, providers, and advanced options.
 * Enhanced to match ClawX completeness.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSettingsStore } from '@/stores/settings-store';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import ProvidersSection from '@/components/settings/ProvidersSection';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { getVoicesForProvider, getDefaultVoiceId, getSpeedRange, getVolumeRange } from '@/data/voice-options';
import type { VoiceProvider } from '@/stores/settings-store';
import { useOpenClawStatus } from '@/hooks/useOpenClawStatus';
import {
  Palette,
  Bot,
  Globe,
  Info,
  Sun,
  Moon,
  Monitor,
  ChevronDown,
  Code,
  ExternalLink,
  Mic,
  Loader2,
  Zap,
  Bell,
  Keyboard,
  Download,
  RefreshCw,
  CheckCircle,
} from 'lucide-react';
import { useUpdateStore } from '@/stores/update-store';

export default function SettingsPage() {
  const { t } = useTranslation('settings');
  const {
    theme, setTheme,
    language, setLanguage,
    sidebarCollapsed, toggleSidebar,
    devModeUnlocked, setDevModeUnlocked,
    voiceProvider, setVoiceProvider,
    voiceId, setVoiceId,
    voiceSpeed, setVoiceSpeed,
    voiceVolume, setVoiceVolume,
    autoTtsEnabled, setAutoTtsEnabled,
  } = useSettingsStore();

  const [appVersion, setAppVersion] = useState('0.2.0');
  const openclawStatus = useOpenClawStatus();
  const {
    available: updateAvailable,
    checking: updateChecking,
    downloading: updateDownloading,
    progress: updateProgress,
    updateInfo,
    error: updateError,
    checkForUpdate,
    downloadAndInstall,
  } = useUpdateStore();

  useEffect(() => {
    getVersion().then(setAppVersion).catch(() => {});
  }, []);

  const handleShowPet = async () => {
    try {
      await invoke('show_live2d_window');
    } catch (error) {
      console.error('Failed to show Live2D pet:', error);
    }
  };

  const themeLabels = {
    light: t('appearance.light', 'Light'),
    dark: t('appearance.dark', 'Dark'),
    system: t('appearance.system', 'System'),
  };

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-6">
        <div>
          <h2 className="text-2xl font-bold">{t('title', 'Settings')}</h2>
          <p className="text-muted-foreground">{t('description', 'Configure application preferences')}</p>
        </div>

        {/* Appearance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              {t('appearance.title', 'Appearance')}
            </CardTitle>
            <CardDescription>{t('appearance.description', 'Customize the look and feel')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>{t('appearance.themeMode', 'Theme')}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {themeLabels[theme]}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setTheme('light')}>
                    <Sun className="mr-2 h-4 w-4" /> {themeLabels.light}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('dark')}>
                    <Moon className="mr-2 h-4 w-4" /> {themeLabels.dark}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setTheme('system')}>
                    <Monitor className="mr-2 h-4 w-4" /> {themeLabels.system}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <Label>{t('appearance.sidebar', 'Sidebar')}</Label>
              <Button variant="outline" size="sm" onClick={toggleSidebar}>
                {sidebarCollapsed ? t('appearance.expand', 'Expand') : t('appearance.collapse', 'Collapse')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Language */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" />
              {t('language.title', 'Language')}
            </CardTitle>
            <CardDescription>{t('language.description', 'Choose interface language')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <Label>{t('language.interfaceLanguage', 'Interface Language')}</Label>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    {SUPPORTED_LANGUAGES.find((l) => l.code === language)?.label ?? language}
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <DropdownMenuItem key={lang.code} onClick={() => setLanguage(lang.code)}>
                      {lang.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </CardContent>
        </Card>

        {/* Live2D */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              {t('live2d.title', 'Live2D')}
            </CardTitle>
            <CardDescription>{t('live2d.description', 'Virtual pet display settings')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleShowPet} className="w-full">
              <Bot className="mr-2 h-4 w-4" />
              {t('live2d.showPet', 'Show Live2D Pet')}
            </Button>
          </CardContent>
        </Card>

        {/* Voice */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              {t('voice.title', 'Voice')}
            </CardTitle>
            <CardDescription>{t('voice.description', 'Configure speech recognition and synthesis')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Voice Provider */}
            <div className="flex items-center justify-between">
              <Label>{t('voice.provider', 'Voice Provider')}</Label>
              <Select
                value={voiceProvider}
                onValueChange={(v: string) => {
                  const p = v as VoiceProvider;
                  setVoiceProvider(p);
                  setVoiceId(getDefaultVoiceId(p));
                  setVoiceSpeed(getSpeedRange(p).default);
                  setVoiceVolume(getVolumeRange(p).default);
                }}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="tencent">{t('voice.tencent', 'Tencent Cloud')}</SelectItem>
                  <SelectItem value="dashscope">{t('voice.dashscope', 'DashScope')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Separator />
            {/* Voice Type */}
            <div className="flex items-center justify-between">
              <Label>{t('voice.voiceType', 'Voice')}</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {getVoicesForProvider(voiceProvider).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name} - {v.desc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            {/* Speed */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('voice.speed', 'Speed')}</Label>
                <span className="text-sm text-muted-foreground">{voiceSpeed}</span>
              </div>
              <Slider
                value={[voiceSpeed]}
                onValueChange={([v]) => setVoiceSpeed(v)}
                min={getSpeedRange(voiceProvider).min}
                max={getSpeedRange(voiceProvider).max}
                step={getSpeedRange(voiceProvider).step}
              />
            </div>
            <Separator />
            {/* Volume */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('voice.volume', 'Volume')}</Label>
                <span className="text-sm text-muted-foreground">{voiceVolume}</span>
              </div>
              <Slider
                value={[voiceVolume]}
                onValueChange={([v]) => setVoiceVolume(v)}
                min={getVolumeRange(voiceProvider).min}
                max={getVolumeRange(voiceProvider).max}
                step={getVolumeRange(voiceProvider).step}
              />
            </div>
            <Separator />
            {/* Auto TTS */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('voice.autoTts', 'Auto-read AI Replies')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('voice.autoTtsDesc', 'Automatically synthesize speech after AI replies')}
                </p>
              </div>
              <Switch
                checked={autoTtsEnabled}
                onCheckedChange={setAutoTtsEnabled}
              />
            </div>
          </CardContent>
        </Card>

        {/* Spotlight */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              {t('spotlight.title', 'Spotlight')}
            </CardTitle>
            <CardDescription>{t('spotlight.description', 'Quick launcher for AI queries')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('spotlight.shortcut', 'Keyboard Shortcut')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('spotlight.shortcutDesc', 'Global shortcut to open Spotlight')}
                </p>
              </div>
              <Badge variant="outline" className="font-mono text-xs">
                <Keyboard className="mr-1 h-3 w-3" />
                {navigator.platform.includes('Mac') ? '⌥ Space' : 'Alt+Space'}
              </Badge>
            </div>
            <Separator />
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={async () => {
                try { await invoke('spotlight_show'); } catch {}
              }}
            >
              <Zap className="mr-2 h-4 w-4" />
              {t('spotlight.test', 'Test Spotlight')}
            </Button>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t('notifications.title', 'Notifications')}
            </CardTitle>
            <CardDescription>{t('notifications.description', 'Manage notification preferences')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('notifications.channelMessages', 'Channel Messages')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('notifications.channelMessagesDesc', 'Show notification for incoming channel messages')}
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('notifications.cronResults', 'Scheduled Task Results')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('notifications.cronResultsDesc', 'Notify when scheduled tasks complete')}
                </p>
              </div>
              <Switch defaultChecked />
            </div>
          </CardContent>
        </Card>

        {/* Update */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              {t('update.title', 'Update')}
            </CardTitle>
            <CardDescription>{t('update.description', 'Check for application updates')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {updateAvailable && updateInfo ? (
              <div className="rounded-md bg-blue-50 dark:bg-blue-950 p-3 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-blue-700 dark:text-blue-300">
                  <RefreshCw className="h-4 w-4" />
                  {t('update.newVersion', 'New version available')}: v{updateInfo.version}
                </div>
                {updateInfo.body && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 line-clamp-3">{updateInfo.body}</p>
                )}
                <Button
                  size="sm"
                  onClick={() => downloadAndInstall()}
                  disabled={updateDownloading}
                >
                  {updateDownloading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t('update.downloading', 'Downloading')}... {Math.round(updateProgress)}%
                    </>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      {t('update.install', 'Download & Install')}
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle className="h-4 w-4 text-green-500" />
                {t('update.upToDate', 'You are on the latest version')}
              </div>
            )}
            {updateError && (
              <p className="text-xs text-destructive">{updateError}</p>
            )}
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => checkForUpdate()}
              disabled={updateChecking}
            >
              {updateChecking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('update.check', 'Check for Updates')}
            </Button>
          </CardContent>
        </Card>

        {/* AI Providers */}
        <ProvidersSection />

        {/* Advanced */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              {t('advanced.title', 'Advanced')}
            </CardTitle>
            <CardDescription>{t('advanced.description', 'Developer and advanced options')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>{t('advanced.devMode', 'Developer Mode')}</Label>
                <p className="text-xs text-muted-foreground">
                  {t('advanced.devModeDesc', 'Enable developer tools and debug features')}
                </p>
              </div>
              <Switch
                checked={devModeUnlocked}
                onCheckedChange={setDevModeUnlocked}
              />
            </div>
          </CardContent>
        </Card>

        {/* Developer section - only when devMode is on */}
        {devModeUnlocked && (
          <Card className="border-dashed border-yellow-500/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                <Code className="h-5 w-5" />
                {t('developer.title', 'Developer')}
              </CardTitle>
              <CardDescription>{t('developer.description', 'Debug and diagnostic tools')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-md bg-muted p-3 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">App Version</span>
                  <span>{appVersion}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Framework</span>
                  <span>Tauri 2.x + React 19</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">OpenClaw</span>
                  <span className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${openclawStatus.state === 'running' ? 'bg-green-500' : openclawStatus.state === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                    {openclawStatus.state} (:{openclawStatus.port})
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => {
                  // Open DevTools via Tauri
                  try { (window as any).__TAURI_INTERNALS__?.invoke('plugin:webview|open_devtools'); } catch {}
                }}
              >
                {t('developer.openDevtools', 'Open DevTools')}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="h-5 w-5" />
              {t('about.title', 'About')}
            </CardTitle>
            <CardDescription>{t('about.description', 'Version and build information')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('about.version', 'Version')}</span>
                <Badge variant="secondary">v{appVersion}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{t('about.build', 'Build')}</span>
                <span className="text-muted-foreground text-xs">Development</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">React</span>
                <span className="text-muted-foreground text-xs">v19</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tauri</span>
                <span className="text-muted-foreground text-xs">v2</span>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3" />
                <span>Reeftotem Assistant - AI-powered desktop companion</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${openclawStatus.state === 'running' ? 'bg-green-500' : openclawStatus.state === 'error' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                <span className="text-xs text-muted-foreground">Powered by OpenClaw</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
