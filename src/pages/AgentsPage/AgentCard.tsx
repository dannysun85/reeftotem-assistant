/**
 * AgentCard
 * Card component for displaying an agent in the grid.
 */

import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AgentConfig } from '@/types/agent';
import {
  MoreHorizontal,
  Pencil,
  Copy,
  Download,
  Star,
  Trash2,
  Check,
} from 'lucide-react';

interface AgentCardProps {
  agent: AgentConfig;
  isActive: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onClone: () => void;
  onExport: () => void;
  onSetDefault: () => void;
  onDelete: () => void;
}

export default function AgentCard({
  agent,
  isActive,
  onSelect,
  onEdit,
  onClone,
  onExport,
  onSetDefault,
  onDelete,
}: AgentCardProps) {
  const { t } = useTranslation('agents');

  return (
    <Card
      className={`cursor-pointer transition-all hover:shadow-md ${
        isActive ? 'ring-2 ring-primary' : ''
      }`}
      onClick={onSelect}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-xl">
              {agent.avatar || '🤖'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-medium truncate">{agent.name}</h3>
                {isActive && (
                  <Check className="h-4 w-4 text-primary shrink-0" />
                )}
              </div>
              {agent.isDefault && (
                <Badge variant="secondary" className="text-xs mt-0.5">
                  <Star className="h-3 w-3 mr-1 fill-current" />
                  {t('card.default', 'Default')}
                </Badge>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
                <Pencil className="h-4 w-4 mr-2" />
                {t('card.edit', 'Edit')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onClone(); }}>
                <Copy className="h-4 w-4 mr-2" />
                {t('card.clone', 'Clone')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onExport(); }}>
                <Download className="h-4 w-4 mr-2" />
                {t('card.export', 'Export')}
              </DropdownMenuItem>
              {!agent.isDefault && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSetDefault(); }}>
                  <Star className="h-4 w-4 mr-2" />
                  {t('card.setDefault', 'Set Default')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {t('card.delete', 'Delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {agent.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{agent.description}</p>
        )}

        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {agent.model && (
            <Badge variant="outline" className="text-xs">{agent.model}</Badge>
          )}
          {agent.skillIds.length > 0 && (
            <Badge variant="outline" className="text-xs">
              {agent.skillIds.length} {t('card.skills', 'skills')}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
