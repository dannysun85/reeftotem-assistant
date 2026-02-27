/**
 * NodeConfigPanel - Right panel for configuring selected node
 */
import { useTranslation } from 'react-i18next';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Plus, Trash2 } from 'lucide-react';
import { useAgentsStore } from '@/stores/agents-store';
import type { WorkflowNode, WorkflowNodeData, ConditionRule } from '@/types/workflow';
import { useEffect } from 'react';

interface Props {
  node: WorkflowNode | null;
  onUpdate: (nodeId: string, data: Partial<WorkflowNodeData>) => void;
}

export function NodeConfigPanel({ node, onUpdate }: Props) {
  const { t } = useTranslation('workflows');
  const { agents, fetchAgents } = useAgentsStore();

  useEffect(() => {
    if (agents.length === 0) fetchAgents();
  }, [agents.length, fetchAgents]);

  if (!node) {
    return (
      <div className="w-72 border-l bg-card p-4 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('editor.selectNode')}</p>
      </div>
    );
  }

  const update = (partial: Partial<WorkflowNodeData>) => onUpdate(node.id, partial);

  return (
    <div className="w-72 border-l bg-card p-4 space-y-4 overflow-y-auto">
      <div className="text-xs font-medium text-muted-foreground uppercase">
        {t('editor.configPanel')}
      </div>

      {/* Label - all node types */}
      <div className="space-y-1.5">
        <Label className="text-xs">Label</Label>
        <Input
          value={node.data.label}
          onChange={(e) => update({ label: e.target.value })}
          className="h-8 text-sm"
        />
      </div>

      {/* Agent config */}
      {node.type === 'agent' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.agentSelect')}</Label>
            <Select
              value={node.data.agentId || ''}
              onValueChange={(v) => update({ agentId: v })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder={t('editor.agentSelect')} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.promptTemplate')}</Label>
            <textarea
              className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[80px] resize-y"
              value={node.data.promptTemplate || ''}
              onChange={(e) => update({ promptTemplate: e.target.value })}
              placeholder={t('editor.promptTemplatePlaceholder')}
            />
          </div>
        </>
      )}

      {/* Condition config */}
      {node.type === 'condition' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.conditionType')}</Label>
            <Select
              value={node.data.conditionType || 'keyword'}
              onValueChange={(v) => update({ conditionType: v as 'keyword' | 'regex' })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="keyword">Keyword</SelectItem>
                <SelectItem value="regex">Regex</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">{t('editor.conditionRules')}</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={() => {
                  const rules = [...(node.data.conditionRules || [])];
                  const newId = `r${rules.length + 1}`;
                  rules.push({ id: newId, handle: newId, type: node.data.conditionType || 'keyword', value: '', isDefault: false });
                  update({ conditionRules: rules });
                }}
              >
                <Plus className="h-3 w-3 mr-1" />{t('editor.addRule')}
              </Button>
            </div>
            {(node.data.conditionRules || []).map((rule, idx) => (
              <div key={rule.id} className="flex items-center gap-1.5">
                <Input
                  className="h-7 text-xs flex-1"
                  value={rule.handle}
                  onChange={(e) => {
                    const rules = [...(node.data.conditionRules || [])];
                    rules[idx] = { ...rules[idx], handle: e.target.value };
                    update({ conditionRules: rules });
                  }}
                  placeholder={t('editor.ruleHandle')}
                />
                <Input
                  className="h-7 text-xs flex-1"
                  value={rule.value}
                  onChange={(e) => {
                    const rules = [...(node.data.conditionRules || [])];
                    rules[idx] = { ...rules[idx], value: e.target.value };
                    update({ conditionRules: rules });
                  }}
                  placeholder={t('editor.ruleValue')}
                />
                <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={rule.isDefault || false}
                    onChange={(e) => {
                      const rules = [...(node.data.conditionRules || [])];
                      rules[idx] = { ...rules[idx], isDefault: e.target.checked };
                      update({ conditionRules: rules as ConditionRule[] });
                    }}
                    className="h-3 w-3"
                  />
                  {t('editor.defaultBranch')}
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => {
                    const rules = (node.data.conditionRules || []).filter((_, i) => i !== idx);
                    update({ conditionRules: rules });
                  }}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Merge config */}
      {node.type === 'merge' && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs">{t('editor.mergeStrategy')}</Label>
            <Select
              value={node.data.mergeStrategy || 'concat'}
              onValueChange={(v) => update({ mergeStrategy: v as 'concat' | 'first' | 'custom' })}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="concat">{t('editor.mergeConcat')}</SelectItem>
                <SelectItem value="first">{t('editor.mergeFirst')}</SelectItem>
                <SelectItem value="custom">{t('editor.mergeCustom')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {node.data.mergeStrategy === 'custom' && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t('editor.mergeTemplate')}</Label>
              <textarea
                className="w-full rounded-md border bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                value={node.data.mergeTemplate || ''}
                onChange={(e) => update({ mergeTemplate: e.target.value })}
                placeholder={t('editor.mergeTemplatePlaceholder')}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
