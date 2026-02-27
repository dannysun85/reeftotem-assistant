/**
 * Knowledge Base Card
 * Displays KB summary in a card layout.
 */

import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { KnowledgeBase } from '@/types/knowledge';
import { BookOpen, MoreVertical, Pencil, Trash2, FolderSync } from 'lucide-react';

interface Props {
  kb: KnowledgeBase;
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export default function KnowledgeCard({ kb, onClick, onEdit, onDelete }: Props) {
  const { t } = useTranslation('knowledge');

  return (
    <div
      className="group relative rounded-lg border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      {/* Menu */}
      <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(); }}>
              <Pencil className="mr-2 h-4 w-4" />
              {t('editor.editTitle')}
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Icon + Name */}
      <div className="flex items-start gap-3 mb-3">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
          <BookOpen className="h-5 w-5 text-blue-500" />
        </div>
        <div className="min-w-0">
          <h3 className="font-semibold truncate">{kb.name}</h3>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {kb.description || t('card.noDescription')}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="secondary">
          {t('card.documents', { count: kb.documentCount })}
        </Badge>
        <Badge variant="outline">
          {t('card.chunks', { count: kb.totalChunks })}
        </Badge>
        {kb.watchedFolder && (
          <Badge variant="outline" className="text-green-600">
            <FolderSync className="h-3 w-3 mr-1" />
            {t('card.watchActive')}
          </Badge>
        )}
      </div>
    </div>
  );
}
