import { Handle, Position, type NodeProps } from '@xyflow/react';

export function OutputNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-blue-500 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 min-w-[140px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-blue-500 !w-3 !h-3" />
      <div className="text-xs text-blue-600 font-medium mb-1">OUTPUT</div>
      <div className="text-sm font-semibold">{(data as { label?: string }).label || '输出'}</div>
    </div>
  );
}
