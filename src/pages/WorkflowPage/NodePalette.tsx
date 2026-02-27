/**
 * NodePalette - Left panel with draggable node types
 */
import { useTranslation } from 'react-i18next';
import { CirclePlay, CircleStop, Bot, GitBranch, Merge } from 'lucide-react';

const NODE_TYPES = [
  { type: 'input', icon: CirclePlay, colorClass: 'text-green-600 bg-green-100 dark:bg-green-900/40' },
  { type: 'output', icon: CircleStop, colorClass: 'text-blue-600 bg-blue-100 dark:bg-blue-900/40' },
  { type: 'agent', icon: Bot, colorClass: 'text-purple-600 bg-purple-100 dark:bg-purple-900/40' },
  { type: 'condition', icon: GitBranch, colorClass: 'text-orange-600 bg-orange-100 dark:bg-orange-900/40' },
  { type: 'merge', icon: Merge, colorClass: 'text-cyan-600 bg-cyan-100 dark:bg-cyan-900/40' },
] as const;

export function NodePalette() {
  const { t } = useTranslation('workflows');

  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/reactflow', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="w-48 border-r bg-card p-3 space-y-2 overflow-y-auto">
      <div className="text-xs font-medium text-muted-foreground uppercase mb-3">
        {t('editor.nodePanel')}
      </div>
      {NODE_TYPES.map(({ type: nodeType, icon: Icon, colorClass }) => (
        <div
          key={nodeType}
          className={`flex items-center gap-2 rounded-md px-3 py-2.5 cursor-grab active:cursor-grabbing border border-transparent hover:border-border transition-colors ${colorClass}`}
          draggable
          onDragStart={(e) => onDragStart(e, nodeType)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">{t(`nodeTypes.${nodeType}`)}</span>
        </div>
      ))}
      <div className="text-xs text-muted-foreground pt-2 px-1">
        {t('editor.dragHint')}
      </div>
    </div>
  );
}
