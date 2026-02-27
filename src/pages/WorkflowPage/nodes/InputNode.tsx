import { Handle, Position, type NodeProps } from '@xyflow/react';

export function InputNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border-2 border-green-500 bg-green-50 dark:bg-green-950/30 px-4 py-3 min-w-[140px] shadow-sm">
      <div className="text-xs text-green-600 font-medium mb-1">INPUT</div>
      <div className="text-sm font-semibold">{(data as { label?: string }).label || '输入'}</div>
      <Handle type="source" position={Position.Bottom} className="!bg-green-500 !w-3 !h-3" />
    </div>
  );
}
