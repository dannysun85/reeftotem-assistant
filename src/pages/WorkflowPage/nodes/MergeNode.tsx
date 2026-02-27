import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Merge } from 'lucide-react';

export function MergeNode({ data }: NodeProps) {
  const d = data as { label?: string; mergeStrategy?: string };
  return (
    <div className="rounded-lg border-2 border-cyan-500 bg-cyan-50 dark:bg-cyan-950/30 px-4 py-3 min-w-[140px] shadow-sm">
      <Handle type="target" position={Position.Top} id="in_0" className="!bg-cyan-500 !w-2.5 !h-2.5" style={{ left: '33%' }} />
      <Handle type="target" position={Position.Top} id="in_1" className="!bg-cyan-500 !w-2.5 !h-2.5" style={{ left: '66%' }} />
      <div className="flex items-center gap-1.5 mb-1">
        <Merge className="h-3.5 w-3.5 text-cyan-600" />
        <span className="text-xs text-cyan-600 font-medium">MERGE</span>
      </div>
      <div className="text-sm font-semibold">{d.label || '合并'}</div>
      {d.mergeStrategy && (
        <div className="text-xs text-muted-foreground mt-0.5">{d.mergeStrategy}</div>
      )}
      <Handle type="source" position={Position.Bottom} className="!bg-cyan-500 !w-3 !h-3" />
    </div>
  );
}
