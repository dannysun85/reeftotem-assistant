import { Handle, Position, type NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';
import type { ConditionRule } from '@/types/workflow';

export function ConditionNode({ data }: NodeProps) {
  const d = data as { label?: string; conditionRules?: ConditionRule[] };
  const rules = d.conditionRules || [];

  return (
    <div className="rounded-lg border-2 border-orange-500 bg-orange-50 dark:bg-orange-950/30 px-4 py-3 min-w-[160px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-orange-500 !w-3 !h-3" />
      <div className="flex items-center gap-1.5 mb-1">
        <GitBranch className="h-3.5 w-3.5 text-orange-600" />
        <span className="text-xs text-orange-600 font-medium">CONDITION</span>
      </div>
      <div className="text-sm font-semibold">{d.label || '条件'}</div>
      {rules.length > 0 && (
        <div className="text-xs text-muted-foreground mt-1">
          {rules.length} 个分支
        </div>
      )}
      {/* One source handle per rule, distributed horizontally */}
      {rules.length > 0 ? (
        rules.map((rule, i) => (
          <Handle
            key={rule.id}
            type="source"
            position={Position.Bottom}
            id={rule.handle}
            className="!bg-orange-500 !w-2.5 !h-2.5"
            style={{ left: `${((i + 1) / (rules.length + 1)) * 100}%` }}
          />
        ))
      ) : (
        <Handle type="source" position={Position.Bottom} className="!bg-orange-500 !w-3 !h-3" />
      )}
    </div>
  );
}
