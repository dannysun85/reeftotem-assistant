/**
 * Knowledge Search Panel
 * Search within a knowledge base and display results.
 */

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useKnowledgeStore } from '@/stores/knowledge-store';
import { Search, Loader2 } from 'lucide-react';

interface Props {
  kbId: string;
}

export default function KnowledgeSearch({ kbId }: Props) {
  const { t } = useTranslation('knowledge');
  const { searchResults, searching, searchKB, clearSearch } = useKnowledgeStore();
  const [query, setQuery] = useState('');

  const handleSearch = async () => {
    if (!query.trim()) return;
    await searchKB(kbId, query.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('search.title')}</h3>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('search.placeholder')}
            className="pl-10"
          />
        </div>
        <Button onClick={handleSearch} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>

      {/* Results */}
      {searchResults.length > 0 && (
        <div className="space-y-3">
          {searchResults.map((result) => (
            <div key={result.chunkId} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('search.source')}: {result.documentName}
                </span>
                <Badge variant="outline">
                  {t('search.score')}: {(result.score * 100).toFixed(1)}%
                </Badge>
              </div>
              <p className="text-sm leading-relaxed line-clamp-4">{result.content}</p>
            </div>
          ))}
        </div>
      )}

      {searchResults.length === 0 && query && !searching && (
        <p className="text-sm text-muted-foreground text-center py-4">
          {t('search.noResults')}
        </p>
      )}
    </div>
  );
}
