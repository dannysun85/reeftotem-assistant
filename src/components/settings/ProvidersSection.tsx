/**
 * ProvidersSection
 * Full Provider CRUD management for Settings page.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProvidersStore } from '@/stores/providers-store';
import {
  PROVIDER_TYPE_INFO,
  getProviderIconUrl,
  shouldInvertInDark,
  type ProviderType,
  type ProviderConfig,
  type ProviderTypeInfo,
} from '@/lib/providers';
import { toast } from 'sonner';
import {
  Plus,
  MoreHorizontal,
  Star,
  Trash2,
  Pencil,
  Check,
  Eye,
  EyeOff,
  Shield,
  Loader2,
  ArrowLeft,
} from 'lucide-react';

export default function ProvidersSection() {
  const { t } = useTranslation('settings');
  const {
    providers,
    defaultProviderId,
    isLoading,
    fetchProviders,
    fetchDefaultProvider,
    saveProvider,
    deleteProvider,
    setDefaultProvider,
    saveApiKey,
    getApiKey,
    deleteApiKey,
    validateApiKey,
  } = useProvidersStore();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    fetchProviders();
    fetchDefaultProvider();
  }, []);

  const handleDelete = async (id: string) => {
    try {
      await deleteProvider(id);
      toast.success(t('aiProviders.toast.deleted'));
    } catch {
      toast.error(t('aiProviders.toast.failedDelete'));
    }
    setDeleteConfirm(null);
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultProvider(id);
      toast.success(t('aiProviders.toast.defaultUpdated'));
    } catch {
      toast.error(t('aiProviders.toast.failedDefault'));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {t('aiProviders.title')}
        </CardTitle>
        <CardDescription>{t('aiProviders.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : providers.length === 0 ? (
          <div className="text-center py-8 space-y-3">
            <p className="text-sm text-muted-foreground">{t('aiProviders.empty.desc')}</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('aiProviders.empty.cta')}
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {providers.map((p) => (
                <ProviderCard
                  key={p.id}
                  provider={p}
                  isDefault={p.id === defaultProviderId}
                  onSetDefault={() => handleSetDefault(p.id)}
                  onEdit={() => setEditingProvider(p.id)}
                  onDelete={() => setDeleteConfirm(p.id)}
                />
              ))}
            </div>
            <Button variant="outline" className="w-full" onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('aiProviders.add')}
            </Button>
          </>
        )}

        {/* Add Provider Dialog */}
        <AddProviderDialog
          open={showAddDialog}
          onOpenChange={setShowAddDialog}
          existingTypes={new Set(providers.map((p) => p.type))}
        />

        {/* Edit Provider Dialog */}
        {editingProvider && (
          <EditProviderDialog
            open={!!editingProvider}
            onOpenChange={(open) => { if (!open) setEditingProvider(null); }}
            providerId={editingProvider}
          />
        )}

        {/* Delete Confirmation Dialog */}
        <Dialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('aiProviders.card.delete')}</DialogTitle>
              <DialogDescription>
                {t('aiProviders.toast.failedDelete', 'Are you sure?')}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                {t('aiProviders.dialog.cancel')}
              </Button>
              <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>
                {t('aiProviders.card.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============ ProviderCard ============

function ProviderCard({
  provider,
  isDefault,
  onSetDefault,
  onEdit,
  onDelete,
}: {
  provider: import('@/lib/providers').ProviderWithKeyInfo;
  isDefault: boolean;
  onSetDefault: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation('settings');
  const iconUrl = getProviderIconUrl(provider.type);
  const invertInDark = shouldInvertInDark(provider.type);

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center overflow-hidden">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={provider.name}
              className={`h-5 w-5 ${invertInDark ? 'dark:invert' : ''}`}
            />
          ) : (
            <span className="text-lg">
              {PROVIDER_TYPE_INFO.find((t) => t.id === provider.type)?.icon ?? '⚙️'}
            </span>
          )}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{provider.name}</span>
            {isDefault && (
              <Badge variant="secondary" className="text-xs">
                <Star className="h-3 w-3 mr-1 fill-current" />
                {t('aiProviders.card.default')}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge variant="outline" className="text-xs">{provider.type}</Badge>
            {provider.hasKey ? (
              <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="h-3 w-3" />
                {t('aiProviders.card.configured')}
              </span>
            ) : (
              <span className="text-xs text-amber-600 dark:text-amber-400">
                {t('aiProviders.card.noKey')}
              </span>
            )}
          </div>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={onEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('aiProviders.card.editKey')}
          </DropdownMenuItem>
          {!isDefault && (
            <DropdownMenuItem onClick={onSetDefault}>
              <Star className="h-4 w-4 mr-2" />
              {t('aiProviders.card.setDefault')}
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={onDelete} className="text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            {t('aiProviders.card.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

// ============ AddProviderDialog ============

function AddProviderDialog({
  open,
  onOpenChange,
  existingTypes,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingTypes: Set<string>;
}) {
  const { t } = useTranslation('settings');
  const { saveProvider, saveApiKey, validateApiKey } = useProvidersStore();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedType, setSelectedType] = useState<ProviderTypeInfo | null>(null);
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [modelId, setModelId] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [validating, setValidating] = useState(false);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setStep(1);
    setSelectedType(null);
    setName('');
    setApiKey('');
    setBaseUrl('');
    setModelId('');
    setShowKey(false);
    setValidating(false);
    setSaving(false);
  };

  const handleSelectType = (info: ProviderTypeInfo) => {
    setSelectedType(info);
    setName(info.name);
    setBaseUrl(info.defaultBaseUrl ?? '');
    setModelId(info.defaultModelId ?? '');
    setStep(2);
  };

  const handleValidate = async () => {
    if (!selectedType) return;
    setValidating(true);
    // Save provider first so validate can find it
    const tempId = `temp-${Date.now()}`;
    const provider: ProviderConfig = {
      id: tempId,
      name,
      type: selectedType.id,
      enabled: true,
      baseUrl: baseUrl || undefined,
      model: modelId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProvider(provider);
      const valid = await validateApiKey(tempId, apiKey);
      if (valid) {
        toast.success('API Key is valid');
      } else {
        toast.error(t('aiProviders.toast.invalidKey'));
      }
      // Clean up temp provider
      await useProvidersStore.getState().deleteProvider(tempId);
    } catch {
      toast.error(t('aiProviders.toast.invalidKey'));
      try { await useProvidersStore.getState().deleteProvider(tempId); } catch { /* ignore */ }
    }
    setValidating(false);
  };

  const handleSave = async () => {
    if (!selectedType) return;
    setSaving(true);
    // Built-in providers use type as ID (singleton); custom uses UUID (multi-instance)
    const id = selectedType.id === 'custom'
      ? `custom-${crypto.randomUUID().slice(0, 8)}`
      : selectedType.id;
    const provider: ProviderConfig = {
      id,
      name,
      type: selectedType.id,
      enabled: true,
      baseUrl: baseUrl || undefined,
      model: modelId || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    try {
      await saveProvider(provider);
      if (apiKey) {
        await saveApiKey(id, apiKey);
      }
      // Auto-set as default if it's the first provider
      const { providers: currentProviders, setDefaultProvider: setDefault } = useProvidersStore.getState();
      if (currentProviders.length <= 1) {
        try { await setDefault(id); } catch { /* ignore */ }
      }
      toast.success(t('aiProviders.toast.added'));
      reset();
      onOpenChange(false);
    } catch {
      toast.error(t('aiProviders.toast.failedAdd'));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('aiProviders.dialog.title')}</DialogTitle>
          <DialogDescription>{t('aiProviders.dialog.desc')}</DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid grid-cols-2 gap-3 py-4">
            {PROVIDER_TYPE_INFO.map((info) => {
              const iconUrl = getProviderIconUrl(info.id);
              const invertInDark = shouldInvertInDark(info.id);
              // Built-in (non-custom) types are singletons — disable if already exists
              const alreadyExists = info.id !== 'custom' && existingTypes.has(info.id);
              return (
                <button
                  key={info.id}
                  onClick={() => !alreadyExists && handleSelectType(info)}
                  disabled={alreadyExists}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors text-left ${
                    alreadyExists
                      ? 'opacity-40 cursor-not-allowed'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {iconUrl ? (
                      <img
                        src={iconUrl}
                        alt={info.name}
                        className={`h-5 w-5 ${invertInDark ? 'dark:invert' : ''}`}
                      />
                    ) : (
                      <span className="text-lg">{info.icon}</span>
                    )}
                  </div>
                  <div>
                    <div className="text-sm font-medium">{info.name}</div>
                    {alreadyExists ? (
                      <div className="text-xs text-muted-foreground">{t('aiProviders.card.configured')}</div>
                    ) : info.model ? (
                      <div className="text-xs text-muted-foreground">{info.model}</div>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <button
              onClick={() => setStep(1)}
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              {t('aiProviders.dialog.change')}
            </button>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t('aiProviders.dialog.displayName')}</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>

            {selectedType?.requiresApiKey && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('aiProviders.dialog.apiKey')}</label>
                <div className="relative">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={selectedType.placeholder}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">{t('aiProviders.dialog.apiKeyStored')}</p>
              </div>
            )}

            {(selectedType?.showBaseUrl || selectedType?.defaultBaseUrl) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('aiProviders.dialog.baseUrl')}</label>
                <Input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder={selectedType.defaultBaseUrl ?? 'https://api.example.com/v1'}
                />
              </div>
            )}

            {selectedType?.showModelId && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('aiProviders.dialog.modelId')}</label>
                <Input
                  value={modelId}
                  onChange={(e) => setModelId(e.target.value)}
                  placeholder={selectedType.modelIdPlaceholder ?? 'model-id'}
                />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <DialogFooter className="gap-2">
            {selectedType?.requiresApiKey && apiKey && (
              <Button variant="outline" onClick={handleValidate} disabled={validating}>
                {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {t('aiProviders.dialog.validate')}
              </Button>
            )}
            <Button onClick={handleSave} disabled={saving || !name}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('aiProviders.dialog.add')}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============ EditProviderDialog ============

function EditProviderDialog({
  open,
  onOpenChange,
  providerId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
}) {
  const { t } = useTranslation('settings');
  const { providers, saveProvider, saveApiKey, getApiKey, validateApiKey, fetchProviders } =
    useProvidersStore();
  const provider = providers.find((p) => p.id === providerId);
  const typeInfo = PROVIDER_TYPE_INFO.find((ti) => ti.id === provider?.type);

  const [name, setName] = useState(provider?.name ?? '');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState(provider?.baseUrl ?? '');
  const [modelId, setModelId] = useState(provider?.model ?? '');
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [keyLoaded, setKeyLoaded] = useState(false);

  useEffect(() => {
    if (open && providerId && !keyLoaded) {
      getApiKey(providerId).then((key) => {
        if (key) setApiKey(key);
        setKeyLoaded(true);
      });
    }
  }, [open, providerId]);

  if (!provider) return null;

  const handleValidate = async () => {
    setValidating(true);
    try {
      const valid = await validateApiKey(providerId, apiKey);
      if (valid) {
        toast.success('API Key is valid');
      } else {
        toast.error(t('aiProviders.toast.invalidKey'));
      }
    } catch {
      toast.error(t('aiProviders.toast.invalidKey'));
    }
    setValidating(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: ProviderConfig = {
        id: provider.id,
        name,
        type: provider.type as import('@/lib/providers').ProviderType,
        enabled: provider.enabled,
        baseUrl: baseUrl || undefined,
        model: modelId || undefined,
        createdAt: provider.createdAt,
        updatedAt: new Date().toISOString(),
      };
      await saveProvider(updated);
      if (apiKey) {
        await saveApiKey(providerId, apiKey);
      }
      await fetchProviders();
      toast.success(t('aiProviders.toast.updated'));
      onOpenChange(false);
    } catch {
      toast.error(t('aiProviders.toast.failedUpdate'));
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{provider.name}</DialogTitle>
          <DialogDescription>{t('aiProviders.dialog.desc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('aiProviders.dialog.displayName')}</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {typeInfo?.requiresApiKey !== false && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('aiProviders.dialog.apiKey')}</label>
              <div className="relative">
                <Input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={typeInfo?.placeholder}
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                >
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          {(typeInfo?.showBaseUrl || provider.baseUrl) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('aiProviders.dialog.baseUrl')}</label>
              <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
            </div>
          )}

          {(typeInfo?.showModelId || provider.model) && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t('aiProviders.dialog.modelId')}</label>
              <Input value={modelId} onChange={(e) => setModelId(e.target.value)} />
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          {typeInfo?.requiresApiKey && apiKey && (
            <Button variant="outline" onClick={handleValidate} disabled={validating}>
              {validating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {t('aiProviders.dialog.validate')}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving || !name}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {t('aiProviders.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
