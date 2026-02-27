/**
 * Spotlight Page
 * Compact quick-launcher overlay window for AI queries, slash commands,
 * clipboard actions, and screenshot capture.
 * Rendered in its own Tauri window -- no MainLayout needed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSpotlightStore } from '@/stores/spotlight-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Command,
  Copy,
  Check,
  Camera,
  Loader2,
  Send,
  Languages,
  FileText,
  Code,
  Sparkles,
  AlertTriangle,
  X,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Command definitions
// ---------------------------------------------------------------------------

interface SpotlightCommand {
  id: string;
  name: string;
  description: string;
  category: 'general' | 'code' | 'writing' | 'analysis';
  icon: React.ReactNode;
}

const COMMANDS: SpotlightCommand[] = [
  {
    id: 'translate',
    name: 'commands.translate.name',
    description: 'commands.translate.description',
    category: 'general',
    icon: <Languages className="h-4 w-4" />,
  },
  {
    id: 'summarize',
    name: 'commands.summarize.name',
    description: 'commands.summarize.description',
    category: 'general',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'explain',
    name: 'commands.explain.name',
    description: 'commands.explain.description',
    category: 'general',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'review',
    name: 'commands.review.name',
    description: 'commands.review.description',
    category: 'code',
    icon: <Code className="h-4 w-4" />,
  },
  {
    id: 'explainCode',
    name: 'commands.explainCode.name',
    description: 'commands.explainCode.description',
    category: 'code',
    icon: <Code className="h-4 w-4" />,
  },
  {
    id: 'optimize',
    name: 'commands.optimize.name',
    description: 'commands.optimize.description',
    category: 'code',
    icon: <Sparkles className="h-4 w-4" />,
  },
  {
    id: 'rewrite',
    name: 'commands.rewrite.name',
    description: 'commands.rewrite.description',
    category: 'writing',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'fixGrammar',
    name: 'commands.fixGrammar.name',
    description: 'commands.fixGrammar.description',
    category: 'writing',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    id: 'ask',
    name: 'commands.ask.name',
    description: 'commands.ask.description',
    category: 'analysis',
    icon: <Search className="h-4 w-4" />,
  },
];

// ---------------------------------------------------------------------------
// Clipboard type to icon mapping
// ---------------------------------------------------------------------------

const CLIPBOARD_ICONS: Record<string, React.ReactNode> = {
  text: <FileText className="h-3.5 w-3.5" />,
  url: <Sparkles className="h-3.5 w-3.5" />,
  code: <Code className="h-3.5 w-3.5" />,
  image: <Camera className="h-3.5 w-3.5" />,
};

// ---------------------------------------------------------------------------
// Quick action buttons shown when the query is empty
// ---------------------------------------------------------------------------

interface QuickAction {
  labelKey: string;
  command: string;
}

const QUICK_ACTIONS: QuickAction[] = [
  { labelKey: 'actions.translate', command: '/translate' },
  { labelKey: 'actions.summarize', command: '/summarize' },
  { labelKey: 'actions.explain', command: '/explain' },
  { labelKey: 'actions.review', command: '/review' },
  { labelKey: 'actions.explainCode', command: '/explainCode' },
  { labelKey: 'actions.optimize', command: '/optimize' },
];

// ---------------------------------------------------------------------------
// SpotlightPage component
// ---------------------------------------------------------------------------

export default function SpotlightPage() {
  const { t } = useTranslation('spotlight');
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [screenshotAttached, setScreenshotAttached] = useState(false);

  const {
    query,
    response,
    thinking,
    error,
    clipboardType,
    clipboardPreview,
    setQuery,
    submit,
    clearResponse,
    detectClipboard,
    hide,
  } = useSpotlightStore();

  // Auto-focus input and detect clipboard on mount
  useEffect(() => {
    inputRef.current?.focus();
    void detectClipboard();
  }, [detectClipboard]);

  // Esc key handler -- close the spotlight window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void hide();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hide]);

  // Submit on Enter
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.nativeEvent.isComposing && query.trim()) {
        e.preventDefault();
        void submit(query.trim());
      }
    },
    [query, submit],
  );

  // Copy response to clipboard
  const handleCopyResponse = useCallback(async () => {
    if (!response) return;
    try {
      await navigator.clipboard.writeText(response);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // silently fail
    }
  }, [response]);

  // Screenshot capture placeholder
  const handleScreenshot = useCallback(() => {
    setScreenshotAttached(true);
    // Actual screenshot logic is handled via Tauri commands
  }, []);

  // Select a slash command
  const handleSelectCommand = useCallback(
    (cmd: SpotlightCommand) => {
      const commandQuery = `/${cmd.id} `;
      setQuery(commandQuery);
      inputRef.current?.focus();
    },
    [setQuery],
  );

  // Quick action click
  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      setQuery(action.command + ' ');
      inputRef.current?.focus();
    },
    [setQuery],
  );

  // Filtered commands when query starts with /
  const isCommandMode = query.startsWith('/');
  const filteredCommands = useMemo(() => {
    if (!isCommandMode) return [];
    const search = query.slice(1).toLowerCase();
    if (!search) return COMMANDS;
    return COMMANDS.filter(
      (cmd) =>
        cmd.id.toLowerCase().includes(search) ||
        t(cmd.name).toLowerCase().includes(search),
    );
  }, [isCommandMode, query, t]);

  // Group filtered commands by category
  const groupedCommands = useMemo(() => {
    const groups: Record<string, SpotlightCommand[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filteredCommands]);

  return (
    <div
      className="fixed inset-0 flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) void hide();
      }}
    >
      {/* Main panel */}
      <div className="w-full max-w-[560px] mx-4 animate-in fade-in zoom-in-95 duration-150">
        <div className="rounded-xl border border-border/50 bg-card shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/30">
            {thinking ? (
              <Loader2 className="h-5 w-5 text-muted-foreground animate-spin shrink-0" />
            ) : (
              <Search className="h-5 w-5 text-muted-foreground shrink-0" />
            )}
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('input.placeholder')}
              className="border-0 shadow-none focus-visible:ring-0 bg-transparent h-8 text-base px-0"
            />
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Screenshot button */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleScreenshot}
                className="text-muted-foreground hover:text-foreground"
                title={t('screenshot.capture')}
              >
                <Camera className="h-4 w-4" />
              </Button>
              {/* Submit button */}
              {query.trim() && !isCommandMode && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => void submit(query.trim())}
                  disabled={thinking}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
              {/* Close button */}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => void hide()}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Screenshot attached badge */}
          {screenshotAttached && (
            <div className="px-4 py-2 border-b border-border/30 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Camera className="h-3 w-3" />
                {t('screenshot.attached')}
              </Badge>
              <button
                onClick={() => setScreenshotAttached(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Content area */}
          <div className="max-h-[400px] overflow-y-auto">
            {/* Error display */}
            {error && (
              <div className="px-4 py-3 flex items-start gap-2 text-sm text-destructive bg-destructive/5">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span className="flex-1">{error}</span>
                <button onClick={clearResponse} className="shrink-0">
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Response area */}
            {response && (
              <div className="px-4 py-3 border-b border-border/30">
                <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                  {response}
                </div>
                <div className="flex items-center justify-end mt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyResponse}
                    className="h-7 text-xs text-muted-foreground gap-1.5"
                  >
                    {copied ? (
                      <>
                        <Check className="h-3 w-3 text-green-500" />
                        {t('response.copied')}
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        {t('response.copy')}
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Thinking indicator */}
            {thinking && !response && (
              <div className="px-4 py-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('response.thinking')}</span>
              </div>
            )}

            {/* Slash command list */}
            {isCommandMode && !response && !thinking && (
              <div className="py-1">
                {Object.keys(groupedCommands).length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    No matching commands
                  </div>
                ) : (
                  Object.entries(groupedCommands).map(([category, cmds]) => (
                    <div key={category}>
                      <div className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                        {t(`commands.categories.${category}`)}
                      </div>
                      {cmds.map((cmd) => (
                        <button
                          key={cmd.id}
                          onClick={() => handleSelectCommand(cmd)}
                          className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-left"
                        >
                          <span className="text-muted-foreground">{cmd.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground">
                              /{cmd.id}{' '}
                              <span className="font-normal text-muted-foreground">
                                {t(cmd.name)}
                              </span>
                            </div>
                            <div className="text-xs text-muted-foreground/70 truncate">
                              {t(cmd.description)}
                            </div>
                          </div>
                          <Command className="h-3 w-3 text-muted-foreground/40 shrink-0" />
                        </button>
                      ))}
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Default view: clipboard preview + quick actions */}
            {!isCommandMode && !response && !thinking && !error && (
              <div className="py-2">
                {/* Clipboard preview */}
                {clipboardType && (
                  <div className="px-4 py-2.5 border-b border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      {CLIPBOARD_ICONS[clipboardType]}
                      <Badge variant="outline" className="text-[10px]">
                        {t(`clipboard.${clipboardType}`)}
                      </Badge>
                    </div>
                    {clipboardPreview && (
                      <div className="text-xs text-muted-foreground line-clamp-3 font-mono bg-muted/30 rounded-md px-2.5 py-2">
                        {clipboardPreview}
                      </div>
                    )}
                  </div>
                )}

                {/* Quick actions */}
                <div className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {QUICK_ACTIONS.map((action) => (
                      <Button
                        key={action.command}
                        variant="outline"
                        size="sm"
                        onClick={() => handleQuickAction(action)}
                        className="h-7 text-xs gap-1"
                      >
                        {t(action.labelKey)}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Hint to use / for commands */}
                <div className="px-4 py-2 text-[11px] text-muted-foreground/50 flex items-center gap-1.5">
                  <Command className="h-3 w-3" />
                  <span>
                    Type <kbd className="px-1 py-0.5 rounded bg-muted text-[10px] font-mono">/</kbd>{' '}
                    for commands
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-border/30 flex items-center justify-between text-[10px] text-muted-foreground/40">
            <span className="flex items-center gap-1">
              <Command className="h-3 w-3" />
              Spotlight
            </span>
            <kbd className="px-1.5 py-0.5 rounded bg-muted/50 text-[10px] font-mono">
              Esc
            </kbd>
          </div>
        </div>
      </div>
    </div>
  );
}
