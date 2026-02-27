/**
 * Skills Page
 * Manages installed skills and marketplace browsing.
 * Provides two tabs: "Installed" (with filter chips, search, enable/disable, detail dialog)
 * and "Marketplace" (search, install, security notice).
 */

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSkillsStore } from '@/stores/skills-store';
import type { Skill, MarketplaceSkill } from '@/types/skill';
import {
  Puzzle,
  Search,
  RefreshCw,
  Loader2,
  Download,
  Trash2,
  Star,
  AlertTriangle,
  Info,
  Settings2,
  Power,
  FolderOpen,
  ChevronRight,
  Plus,
  X,
  ExternalLink,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

type FilterKind = 'all' | 'builtIn' | 'marketplace';
type TabKind = 'installed' | 'marketplace';
type DetailTab = 'info' | 'config';

// ---------------------------------------------------------------------------
// SkillCard (internal component)
// ---------------------------------------------------------------------------

interface SkillCardProps {
  skill: Skill;
  onToggle: (id: string, enabled: boolean) => void;
  onSelect: (skill: Skill) => void;
}

function SkillCard({ skill, onToggle, onSelect }: SkillCardProps) {
  const { t } = useTranslation('skills');

  const sourceBadge = skill.isCore
    ? { label: t('detail.coreSystem'), variant: 'default' as const }
    : skill.isBundled
      ? { label: t('detail.bundled'), variant: 'secondary' as const }
      : { label: t('detail.userInstalled'), variant: 'outline' as const };

  return (
    <Card
      className="group relative transition-shadow hover:shadow-md cursor-pointer"
      onClick={() => onSelect(skill)}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header: icon + name + switch */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
              {skill.icon ? (
                <span>{skill.icon}</span>
              ) : (
                <Puzzle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{skill.name}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{skill.description}</p>
            </div>
          </div>
          <Switch
            checked={skill.enabled}
            onCheckedChange={(checked) => {
              // Stop propagation so card click does not fire
              onToggle(skill.id, checked);
            }}
            onClick={(e) => e.stopPropagation()}
            aria-label={skill.enabled ? t('detail.enabled') : t('detail.disabled')}
          />
        </div>

        {/* Footer: source badge + arrow */}
        <div className="flex items-center justify-between">
          <Badge variant={sourceBadge.variant} className="text-[10px]">
            {sourceBadge.label}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// SkillDetailDialog (internal component)
// ---------------------------------------------------------------------------

interface SkillDetailDialogProps {
  skill: Skill | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string, enabled: boolean) => void;
  onSaveConfig: (id: string, config: Record<string, unknown>) => Promise<void>;
  onUninstall: (id: string) => Promise<void>;
}

function SkillDetailDialog({
  skill,
  open,
  onOpenChange,
  onToggle,
  onSaveConfig,
  onUninstall,
}: SkillDetailDialogProps) {
  const { t } = useTranslation('skills');

  const [detailTab, setDetailTab] = useState<DetailTab>('info');
  const [apiKey, setApiKey] = useState('');
  const [envVars, setEnvVars] = useState<{ key: string; value: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uninstalling, setUninstalling] = useState(false);

  // Reset state when skill changes
  useEffect(() => {
    if (skill) {
      setDetailTab('info');
      setApiKey((skill.config?.apiKey as string) ?? '');
      const existing = (skill.config?.envVars as Record<string, string>) ?? {};
      const entries = Object.entries(existing).map(([key, value]) => ({ key, value }));
      setEnvVars(entries.length > 0 ? entries : []);
      setSaved(false);
    }
  }, [skill]);

  const handleSave = async () => {
    if (!skill) return;
    setSaving(true);
    setSaved(false);
    try {
      // Filter out entries with empty keys
      const validEnvVars = envVars
        .filter((e) => e.key.trim().length > 0)
        .reduce<Record<string, string>>((acc, e) => {
          acc[e.key.trim()] = e.value;
          return acc;
        }, {});

      await onSaveConfig(skill.id, {
        ...skill.config,
        apiKey: apiKey || undefined,
        envVars: Object.keys(validEnvVars).length > 0 ? validEnvVars : undefined,
      });
      setSaved(true);
    } catch (err) {
      console.error('Failed to save skill config:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleUninstall = async () => {
    if (!skill) return;
    setUninstalling(true);
    try {
      await onUninstall(skill.id);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to uninstall skill:', err);
    } finally {
      setUninstalling(false);
    }
  };

  const addEnvVar = () => {
    setEnvVars((prev) => [...prev, { key: '', value: '' }]);
  };

  const updateEnvVar = (index: number, field: 'key' | 'value', val: string) => {
    setEnvVars((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, [field]: val } : entry)),
    );
    setSaved(false);
  };

  const removeEnvVar = (index: number) => {
    setEnvVars((prev) => prev.filter((_, i) => i !== index));
    setSaved(false);
  };

  if (!skill) return null;

  const sourceLabel = skill.isCore
    ? t('detail.coreSystem')
    : skill.isBundled
      ? t('detail.bundled')
      : t('detail.userInstalled');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center text-base shrink-0">
              {skill.icon ? (
                <span>{skill.icon}</span>
              ) : (
                <Puzzle className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {skill.name}
          </DialogTitle>
        </DialogHeader>

        {/* Inner tabs */}
        <div className="flex gap-1 border-b">
          <button
            type="button"
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              detailTab === 'info'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setDetailTab('info')}
          >
            <Info className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5" />
            {t('detail.info')}
          </button>
          {skill.configurable && (
            <button
              type="button"
              className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                detailTab === 'config'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setDetailTab('config')}
            >
              <Settings2 className="inline-block h-3.5 w-3.5 mr-1.5 -mt-0.5" />
              {t('detail.config')}
            </button>
          )}
        </div>

        {/* Info tab */}
        {detailTab === 'info' && (
          <div className="space-y-4 pt-2">
            {/* Description */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('detail.description')}</Label>
              <p className="text-sm mt-1">{skill.description}</p>
            </div>

            {/* Version */}
            {skill.version && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('detail.version')}</Label>
                <p className="text-sm mt-1">{skill.version}</p>
              </div>
            )}

            {/* Author */}
            {skill.author && (
              <div>
                <Label className="text-xs text-muted-foreground">{t('detail.author')}</Label>
                <p className="text-sm mt-1">{skill.author}</p>
              </div>
            )}

            {/* Source */}
            <div>
              <Label className="text-xs text-muted-foreground">{t('detail.source')}</Label>
              <p className="text-sm mt-1">{sourceLabel}</p>
            </div>

            {/* Configurable badge */}
            {skill.configurable && (
              <Badge variant="outline" className="text-xs">
                <Settings2 className="h-3 w-3 mr-1" />
                {t('detail.configurable')}
              </Badge>
            )}

            {/* Enable / disable toggle */}
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="flex items-center gap-2">
                <Power className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {skill.enabled ? t('detail.enabled') : t('detail.disabled')}
                </span>
              </div>
              <Switch
                checked={skill.enabled}
                onCheckedChange={(checked) => onToggle(skill.id, checked)}
              />
            </div>

            {/* Uninstall button (only for user-installed skills) */}
            {!skill.isCore && !skill.isBundled && (
              <Button
                variant="destructive"
                size="sm"
                className="w-full"
                disabled={uninstalling}
                onClick={handleUninstall}
              >
                {uninstalling ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Uninstall
              </Button>
            )}
          </div>
        )}

        {/* Config tab */}
        {detailTab === 'config' && skill.configurable && (
          <div className="space-y-4 pt-2">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label>{t('detail.apiKey')}</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setSaved(false);
                }}
                placeholder={t('detail.apiKeyPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('detail.apiKeyDesc')}</p>
            </div>

            {/* Environment variables */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>{t('detail.envVars')}</Label>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={addEnvVar}>
                  <Plus className="mr-1 h-3 w-3" />
                  {t('detail.addVariable')}
                </Button>
              </div>

              {envVars.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">{t('detail.noEnvVars')}</p>
              ) : (
                <div className="space-y-2">
                  {envVars.map((entry, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <Input
                        className="flex-1 font-mono text-xs"
                        value={entry.key}
                        onChange={(e) => updateEnvVar(index, 'key', e.target.value)}
                        placeholder={t('detail.keyPlaceholder')}
                      />
                      <Input
                        className="flex-1 text-xs"
                        value={entry.value}
                        onChange={(e) => updateEnvVar(index, 'value', e.target.value)}
                        placeholder={t('detail.valuePlaceholder')}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 shrink-0"
                        onClick={() => removeEnvVar(index)}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <p className="text-xs text-muted-foreground/60">{t('detail.envNote')}</p>
            </div>

            {/* Save button */}
            <Button className="w-full" disabled={saving} onClick={handleSave}>
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('detail.saving')}
                </>
              ) : saved ? (
                t('detail.configSaved')
              ) : (
                t('detail.saveConfig')
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// MarketplaceCard (internal component)
// ---------------------------------------------------------------------------

interface MarketplaceCardProps {
  skill: MarketplaceSkill;
  onInstall: (slug: string) => void;
  installing: boolean;
}

function MarketplaceCard({ skill, onInstall, installing }: MarketplaceCardProps) {
  const { t } = useTranslation('skills');
  const hasMissing = skill.missing && Array.isArray(skill.missing) && skill.missing.length > 0;

  return (
    <Card className="transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-lg shrink-0">
              {skill.icon ? (
                <span>{skill.icon}</span>
              ) : (
                <Puzzle className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate">{skill.name}</p>
              {skill.author && (
                <p className="text-xs text-muted-foreground">by {skill.author}</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {skill.eligible ? (
              <Badge variant="default" className="text-[10px]">{t('marketplace.eligible')}</Badge>
            ) : (
              <Badge variant="secondary" className="text-[10px]">{t('marketplace.unavailable')}</Badge>
            )}
          </div>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground line-clamp-2">{skill.description}</p>

        {/* Missing deps warning */}
        {hasMissing && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span>{t('marketplace.missingDeps')}: {skill.missing!.join(', ')}</span>
          </div>
        )}

        {/* Footer: bundled badge + install */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {skill.bundled && (
              <Badge variant="outline" className="text-[10px]">{t('detail.bundled')}</Badge>
            )}
            {skill.disabled && (
              <Badge variant="destructive" className="text-[10px]">{t('detail.disabled')}</Badge>
            )}
          </div>
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={installing || !skill.eligible}
            onClick={() => onInstall(skill.slug)}
          >
            {installing ? (
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
            ) : (
              <Download className="mr-1 h-3 w-3" />
            )}
            {t('marketplace.install')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function SkillsPage() {
  const { t } = useTranslation('skills');

  const {
    skills,
    marketplaceResults,
    loading,
    searching,
    error,
    fetchSkills,
    toggleSkill,
    updateSkillConfig,
    searchMarketplace,
    installSkill,
    uninstallSkill,
  } = useSkillsStore();

  const [activeTab, setActiveTab] = useState<TabKind>('installed');
  const [filter, setFilter] = useState<FilterKind>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [marketplaceQuery, setMarketplaceQuery] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [installingSlug, setInstallingSlug] = useState<string | null>(null);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Auto-load marketplace when switching to marketplace tab
  useEffect(() => {
    if (activeTab === 'marketplace' && marketplaceResults.length === 0 && !searching) {
      searchMarketplace('');
    }
  }, [activeTab, marketplaceResults.length, searching, searchMarketplace]);

  // -- Filter counts --
  const builtInCount = useMemo(
    () => skills.filter((s) => s.isCore || s.isBundled).length,
    [skills],
  );
  const marketplaceCount = useMemo(
    () => skills.filter((s) => !s.isCore && !s.isBundled).length,
    [skills],
  );
  const allCount = skills.length;

  // -- Filtered skills --
  const filteredSkills = useMemo(() => {
    let result = skills;

    // Apply category filter
    if (filter === 'builtIn') {
      result = result.filter((s) => s.isCore || s.isBundled);
    } else if (filter === 'marketplace') {
      result = result.filter((s) => !s.isCore && !s.isBundled);
    }

    // Apply search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q),
      );
    }

    return result;
  }, [skills, filter, searchQuery]);

  // -- Handlers --
  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await toggleSkill(id, enabled);
      // Update selectedSkill if it is the same one
      if (selectedSkill?.id === id) {
        setSelectedSkill((prev) => (prev ? { ...prev, enabled } : null));
      }
    },
    [toggleSkill, selectedSkill],
  );

  const handleSelectSkill = useCallback((skill: Skill) => {
    setSelectedSkill(skill);
    setDetailOpen(true);
  }, []);

  const handleSaveConfig = useCallback(
    async (id: string, config: Record<string, unknown>) => {
      await updateSkillConfig(id, config);
    },
    [updateSkillConfig],
  );

  const handleUninstall = useCallback(
    async (id: string) => {
      await uninstallSkill(id);
    },
    [uninstallSkill],
  );

  const handleMarketplaceSearch = useCallback(async () => {
    await searchMarketplace(marketplaceQuery.trim());
  }, [marketplaceQuery, searchMarketplace]);

  const handleInstall = useCallback(
    async (slug: string) => {
      setInstallingSlug(slug);
      try {
        await installSkill(slug);
      } catch (err) {
        console.error('Failed to install skill:', err);
      } finally {
        setInstallingSlug(null);
      }
    },
    [installSkill],
  );

  // -- Filter chip data --
  const filterChips: { kind: FilterKind; label: string }[] = [
    { kind: 'all', label: t('filter.all', { count: allCount }) },
    { kind: 'builtIn', label: t('filter.builtIn', { count: builtInCount }) },
    { kind: 'marketplace', label: t('filter.marketplace', { count: marketplaceCount }) },
  ];

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
            <Button variant="outline" size="sm" onClick={() => fetchSkills()} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('refresh')}
            </Button>
            <Button variant="outline" size="sm">
              <FolderOpen className="mr-2 h-4 w-4" />
              {t('openFolder')}
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b">
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'installed'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('installed')}
          >
            <Puzzle className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
            {t('tabs.installed')}
          </button>
          <button
            type="button"
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'marketplace'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
            onClick={() => setActiveTab('marketplace')}
          >
            <ExternalLink className="inline-block h-4 w-4 mr-1.5 -mt-0.5" />
            {t('tabs.marketplace')}
          </button>
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

        {/* ============================================================== */}
        {/* Installed Tab                                                   */}
        {/* ============================================================== */}
        {activeTab === 'installed' && (
          <div className="space-y-4">
            {/* Filter chips + search */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              {/* Filter chips */}
              <div className="flex items-center gap-2">
                {filterChips.map((chip) => (
                  <button
                    key={chip.kind}
                    type="button"
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      filter === chip.kind
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-muted text-muted-foreground border-transparent hover:bg-accent hover:text-accent-foreground'
                    }`}
                    onClick={() => setFilter(chip.kind)}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="relative flex-1 sm:max-w-xs ml-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={t('search')}
                />
              </div>
            </div>

            {/* Skills grid */}
            {loading && skills.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSkills.length > 0 ? (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {filteredSkills.map((skill) => (
                  <SkillCard
                    key={skill.id}
                    skill={skill}
                    onToggle={handleToggle}
                    onSelect={handleSelectSkill}
                  />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Puzzle className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t('noSkills')}</p>
                    {searchQuery.trim() && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t('noSkillsSearch')}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* Marketplace Tab                                                 */}
        {/* ============================================================== */}
        {activeTab === 'marketplace' && (
          <div className="space-y-4">
            {/* Security note */}
            <Card className="border-dashed border-blue-500/50">
              <CardContent className="flex items-center gap-3 p-4">
                <Info className="h-5 w-5 text-blue-500 shrink-0" />
                <p className="text-xs text-muted-foreground">
                  {t('marketplace.securityNote')}
                </p>
              </CardContent>
            </Card>

            {/* Search bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8"
                  value={marketplaceQuery}
                  onChange={(e) => setMarketplaceQuery(e.target.value)}
                  placeholder={t('searchMarketplace')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMarketplaceSearch();
                  }}
                />
              </div>
              <Button
                size="sm"
                disabled={searching}
                onClick={handleMarketplaceSearch}
              >
                {searching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Search className="mr-2 h-4 w-4" />
                )}
                {t('searchButton')}
              </Button>
            </div>

            {/* Searching state */}
            {searching && (
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('marketplace.searching')}</p>
                </div>
              </div>
            )}

            {/* Results grid */}
            {!searching && marketplaceResults.length > 0 && (
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {marketplaceResults.map((ms) => (
                  <MarketplaceCard
                    key={ms.slug}
                    skill={ms}
                    onInstall={handleInstall}
                    installing={installingSlug === ms.slug}
                  />
                ))}
              </div>
            )}

            {/* No results */}
            {!searching && marketplaceResults.length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                    <Search className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('marketplace.noResults')}</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>

      {/* Skill Detail Dialog */}
      <SkillDetailDialog
        skill={selectedSkill}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onToggle={handleToggle}
        onSaveConfig={handleSaveConfig}
        onUninstall={handleUninstall}
      />
    </div>
  );
}
