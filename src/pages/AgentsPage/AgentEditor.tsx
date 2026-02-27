/**
 * AgentEditor
 * Form for creating/editing an agent.
 */

import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
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
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useProvidersStore } from '@/stores/providers-store';
import { useKnowledgeStore } from '@/stores/knowledge-store';
import type { AgentConfig } from '@/types/agent';
import { Loader2 } from 'lucide-react';

const AVATAR_OPTIONS = [
  '🤖', '💻', '✍️', '🌐', '📊', '📚',
  '🎭', '🧠', '🔬', '🎨', '🎵', '🏥',
  '📝', '🔧', '🎯', '💡', '🦊', '🐱',
  '🐼', '🦉', '🐲', '🌟', '🔮', '⚡',
];

interface AgentEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial?: Partial<AgentConfig>;
  onSave: (agent: AgentConfig) => Promise<void>;
  mode: 'create' | 'edit';
}

export default function AgentEditor({
  open,
  onOpenChange,
  initial,
  onSave,
  mode,
}: AgentEditorProps) {
  const { t } = useTranslation('agents');
  const { providers } = useProvidersStore();
  const { knowledgeBases, fetchKnowledgeBases } = useKnowledgeStore();

  const [avatar, setAvatar] = useState(initial?.avatar ?? '🤖');
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [systemPrompt, setSystemPrompt] = useState(initial?.systemPrompt ?? '');
  const [providerId, setProviderId] = useState<string>(initial?.providerId ?? '');
  const [model, setModel] = useState(initial?.model ?? '');
  const [temperature, setTemperature] = useState(initial?.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState<string>(
    initial?.maxTokens ? String(initial.maxTokens) : ''
  );
  const [knowledgeBaseIds, setKnowledgeBaseIds] = useState<string[]>(initial?.knowledgeBaseIds ?? []);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  // Re-initialize form when dialog opens with new initial data
  useEffect(() => {
    if (open) {
      setAvatar(initial?.avatar ?? '🤖');
      setName(initial?.name ?? '');
      setDescription(initial?.description ?? '');
      setSystemPrompt(initial?.systemPrompt ?? '');
      setProviderId(initial?.providerId ?? '');
      setModel(initial?.model ?? '');
      setTemperature(initial?.temperature ?? 0.7);
      setMaxTokens(initial?.maxTokens ? String(initial.maxTokens) : '');
      setKnowledgeBaseIds(initial?.knowledgeBaseIds ?? []);
      setShowAvatarPicker(false);
      setSaving(false);
      fetchKnowledgeBases();
    }
  }, [open, initial]);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const now = new Date().toISOString();
    const agent: AgentConfig = {
      id: initial?.id ?? crypto.randomUUID(),
      name: name.trim(),
      avatar,
      description: description.trim(),
      systemPrompt,
      providerId: providerId || null,
      model,
      temperature,
      maxTokens: maxTokens ? parseInt(maxTokens, 10) : null,
      skillIds: initial?.skillIds ?? [],
      knowledgeBaseIds,
      channelBindings: initial?.channelBindings ?? [],
      isDefault: initial?.isDefault ?? false,
      createdAt: initial?.createdAt ?? now,
      updatedAt: now,
    };
    try {
      await onSave(agent);
      onOpenChange(false);
    } catch {
      // error handled by caller
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create'
              ? t('editor.createTitle', 'Create Agent')
              : t('editor.editTitle', 'Edit Agent')}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Section 1: Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t('editor.basicInfo', 'Basic Info')}
            </h4>

            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setShowAvatarPicker(!showAvatarPicker)}
                className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center text-3xl hover:bg-muted/80 transition-colors shrink-0"
              >
                {avatar}
              </button>
              <div className="flex-1 space-y-2">
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('editor.namePlaceholder', 'Agent name')}
                />
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t('editor.descriptionPlaceholder', 'Brief description')}
                />
              </div>
            </div>

            {showAvatarPicker && (
              <div className="grid grid-cols-6 gap-2 p-3 rounded-lg border bg-muted/30">
                {AVATAR_OPTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => { setAvatar(emoji); setShowAvatarPicker(false); }}
                    className={`h-10 w-10 rounded-lg flex items-center justify-center text-xl hover:bg-background transition-colors ${
                      avatar === emoji ? 'ring-2 ring-primary bg-background' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: AI Config */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t('editor.aiConfig', 'AI Configuration')}
            </h4>

            <div className="space-y-2">
              <label className="text-sm">{t('editor.provider', 'Provider')}</label>
              <Select
                value={providerId || '_default'}
                onValueChange={(v) => setProviderId(v === '_default' ? '' : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('editor.selectProvider', 'Select provider...')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_default">{t('editor.defaultProvider', 'Use default')}</SelectItem>
                  {providers.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} <span className="text-muted-foreground text-xs ml-1">({p.type})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm">{t('editor.model', 'Model')}</label>
              <Input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder={t('editor.modelPlaceholder', 'e.g. gpt-4o-mini, claude-sonnet-4-20250514')}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm">{t('editor.temperature', 'Temperature')}</label>
                <span className="text-sm text-muted-foreground">{temperature.toFixed(1)}</span>
              </div>
              <Slider
                value={[temperature]}
                onValueChange={([v]) => setTemperature(v)}
                min={0}
                max={2}
                step={0.1}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm">{t('editor.maxTokens', 'Max Tokens')}</label>
              <Input
                type="number"
                value={maxTokens}
                onChange={(e) => setMaxTokens(e.target.value)}
                placeholder={t('editor.maxTokensPlaceholder', 'Leave empty for default')}
              />
            </div>
          </div>

          {/* Section 3: Knowledge Bases */}
          {knowledgeBases.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">
                {t('editor.knowledgeBases', 'Knowledge Bases')}
              </h4>
              <div className="space-y-2">
                {knowledgeBases.map((kb) => (
                  <div key={kb.id} className="flex items-center justify-between">
                    <Label className="text-sm">{kb.name}</Label>
                    <Switch
                      checked={knowledgeBaseIds.includes(kb.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setKnowledgeBaseIds((prev) => [...prev, kb.id]);
                        } else {
                          setKnowledgeBaseIds((prev) => prev.filter((id) => id !== kb.id));
                        }
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 4: System Prompt */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              {t('editor.systemPrompt', 'System Prompt')}
            </h4>
            <Textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder={t('editor.systemPromptPlaceholder', 'Instructions for the AI agent...')}
              className="min-h-[120px] font-mono text-sm"
              rows={6}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('editor.cancel', 'Cancel')}
          </Button>
          <Button onClick={handleSave} disabled={saving || !name.trim()}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {mode === 'create'
              ? t('editor.create', 'Create')
              : t('editor.save', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
