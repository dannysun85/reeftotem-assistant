import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Bot } from 'lucide-react';

export function AgentNode({ data }: NodeProps) {
  const d = data as { label?: string; agentId?: string };
  return (
    <div className="rounded-lg border-2 border-purple-500 bg-purple-50 dark:bg-purple-950/30 px-4 py-3 min-w-[160px] shadow-sm">
      <Handle type="target" position={Position.Top} className="!bg-purple-500 !w-3 !h-3" />
      <div className="flex items-center gap-1.5 mb-1">
        <Bot className="h-3.5 w-3.5 text-purple-600" />
        <span className="text-xs text-purple-600 font-medium">AGENT</span>
      </div>
      <div className="text-sm font-semibold">{d.label || '智能体'}</div>
      {d.agentId && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[140px]">ID: {d.agentId.slice(0, 8)}...</div>}
      <Handle type="source" position={Position.Bottom} className="!bg-purple-500 !w-3 !h-3" />
    </div>
  );
}
