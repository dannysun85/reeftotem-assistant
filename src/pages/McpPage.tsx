/**
 * MCP Tools Page
 * Displays registered MCP tools and allows testing them via a dialog.
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useMcpStore } from '@/stores/mcp-store';
import type { McpTool } from '@/types/mcp';
import {
  Wrench,
  RefreshCw,
  Loader2,
  Play,
  AlertTriangle,
  ChevronRight,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// ToolCard
// ---------------------------------------------------------------------------

interface ToolCardProps {
  tool: McpTool;
  onSelect: (tool: McpTool) => void;
}

function ToolCard({ tool, onSelect }: ToolCardProps) {
  const { t } = useTranslation('mcp');
  const schema = tool.input_schema as Record<string, unknown>;
  const properties = (schema?.properties ?? {}) as Record<string, unknown>;
  const paramCount = Object.keys(properties).length;

  return (
    <Card
      className="group transition-shadow hover:shadow-md cursor-pointer"
      onClick={() => onSelect(tool)}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Wrench className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm leading-tight truncate font-mono">
                {tool.name}
              </p>
              <p className="text-xs text-muted-foreground line-clamp-1">
                {tool.description}
              </p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px]">
            {paramCount > 0
              ? t('params', { count: paramCount })
              : t('noParams')}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// ToolTestDialog
// ---------------------------------------------------------------------------

interface ToolTestDialogProps {
  tool: McpTool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function ToolTestDialog({ tool, open, onOpenChange }: ToolTestDialogProps) {
  const { t } = useTranslation('mcp');
  const { callTool, calling, lastResult, clearResult } = useMcpStore();
  const [formValues, setFormValues] = useState<Record<string, string>>({});

  // Reset form when tool changes
  useEffect(() => {
    setFormValues({});
    clearResult();
  }, [tool, clearResult]);

  if (!tool) return null;

  const schema = tool.input_schema as Record<string, unknown>;
  const properties = (schema?.properties ?? {}) as Record<
    string,
    { type?: string; description?: string }
  >;
  const required = (schema?.required ?? []) as string[];
  const paramNames = Object.keys(properties);

  const handleExecute = async () => {
    // Build args from form, converting types
    const args: Record<string, unknown> = {};
    for (const key of paramNames) {
      const val = formValues[key];
      if (val === undefined || val === '') continue;
      const propType = properties[key]?.type;
      if (propType === 'number' || propType === 'integer') {
        args[key] = Number(val);
      } else if (propType === 'boolean') {
        args[key] = val === 'true';
      } else {
        args[key] = val;
      }
    }
    await callTool(tool.name, args);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Wrench className="h-5 w-5" />
            {tool.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">{tool.description}</p>

        {/* Parameter form */}
        {paramNames.length > 0 && (
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('inputLabel')}
            </Label>
            {paramNames.map((key) => {
              const prop = properties[key];
              const isRequired = required.includes(key);
              return (
                <div key={key} className="space-y-1">
                  <Label className="text-xs">
                    <span className="font-mono">{key}</span>
                    {prop?.type && (
                      <span className="text-muted-foreground ml-1">
                        ({prop.type})
                      </span>
                    )}
                    {isRequired && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  {prop?.description && (
                    <p className="text-[11px] text-muted-foreground">
                      {prop.description}
                    </p>
                  )}
                  <Input
                    value={formValues[key] ?? ''}
                    onChange={(e) =>
                      setFormValues((prev) => ({
                        ...prev,
                        [key]: e.target.value,
                      }))
                    }
                    placeholder={t('enterValue')}
                    className="font-mono text-xs"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Execute button */}
        <Button
          className="w-full"
          disabled={calling}
          onClick={handleExecute}
        >
          {calling ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('executing')}
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              {t('execute')}
            </>
          )}
        </Button>

        {/* Result */}
        {lastResult && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {lastResult.isError ? t('error') : t('result')}
              </Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs"
                onClick={clearResult}
              >
                <X className="h-3 w-3 mr-1" />
                {t('clearResult')}
              </Button>
            </div>
            <div
              className={`rounded-md border p-3 text-xs font-mono whitespace-pre-wrap max-h-60 overflow-y-auto ${
                lastResult.isError
                  ? 'border-destructive bg-destructive/5 text-destructive'
                  : 'bg-muted'
              }`}
            >
              {lastResult.output}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// McpPage
// ---------------------------------------------------------------------------

export default function McpPage() {
  const { t } = useTranslation('mcp');
  const { tools, loading, error, fetchTools, selectTool, selectedTool } =
    useMcpStore();
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    fetchTools();
  }, [fetchTools]);

  const handleSelect = useCallback(
    (tool: McpTool) => {
      selectTool(tool);
      setDialogOpen(true);
    },
    [selectTool],
  );

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">{t('title')}</h2>
            <p className="text-muted-foreground">{t('subtitle')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchTools()}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {t('refresh')}
          </Button>
        </div>

        {/* Error */}
        {error && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        {/* Tool count */}
        {!loading && tools.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t('toolCount', { count: tools.length })}
          </p>
        )}

        {/* Tools grid */}
        {loading && tools.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : tools.length > 0 ? (
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <ToolCard key={tool.name} tool={tool} onSelect={handleSelect} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 space-y-3">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                <Wrench className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium">{t('noTools')}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t('noToolsDesc')}
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Test Dialog */}
      <ToolTestDialog
        tool={selectedTool}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </div>
  );
}
