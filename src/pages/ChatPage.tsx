/**
 * Chat Page
 * Main chat interface with session list, streaming AI chat, mic input and TTS.
 */

import { useRef, useEffect, useState, useCallback, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useChatStore } from '@/stores/chat-store';
import { useChatLive2D } from '@/hooks/useChatLive2D';
import { useMicInput } from '@/hooks/useMicInput';
import { useTTS } from '@/hooks/useTTS';
import { useChatTTS } from '@/hooks/useChatTTS';
import { useAgentsStore } from '@/stores/agents-store';
import { useProvidersStore } from '@/stores/providers-store';
import ChatToolbar from '@/pages/ChatPage/ChatToolbar';
import { open as dialogOpen } from '@tauri-apps/plugin-dialog';
import {
  Send,
  Plus,
  Search,
  Bot,
  User,
  Mic,
  MessageSquare,
  Square,
  Trash2,
  AlertCircle,
  X,
  Copy,
  Check,
  Lightbulb,
  PenLine,
  Volume2,
  Loader2,
  Paperclip,
  ChevronDown,
  ChevronRight,
  Wrench,
  Brain,
  FileIcon,
  ImageIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

export default function ChatPage() {
  const { t } = useTranslation('chat');
  const {
    sessions,
    currentSessionKey,
    isSending,
    streamingText,
    error,
    initListeners,
    newSession,
    switchSession,
    deleteSession,
    sendMessage,
    abortMessage,
    clearError,
    getMessages,
  } = useChatStore();
  const { fetchAgents, fetchActiveAgentId } = useAgentsStore();
  const { fetchProviders, fetchDefaultProvider } = useProvidersStore();

  useChatLive2D(); // Live2D 数字人聊天联动

  const tts = useTTS();
  useChatTTS(tts);
  const mic = useMicInput();

  // Manual speak: stop any ongoing auto-TTS first, then speak
  const handleSpeak = useCallback((text: string) => {
    console.log('[ChatPage] handleSpeak called, text length:', text.length);
    tts.stop();
    tts.speak(text);
  }, [tts.stop, tts.speak]);

  const messages = getMessages();
  const [inputText, setInputText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [attachments, setAttachments] = useState<import('@/stores/chat-store').Attachment[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isComposingRef = useRef(false);

  // Initialize listeners and fetch data
  useEffect(() => {
    const unlisten = initListeners();
    fetchAgents();
    fetchActiveAgentId();
    fetchProviders();
    fetchDefaultProvider();
    return unlisten;
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputText]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isComposingRef.current && e.nativeEvent.keyCode !== 229) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    if (!inputText.trim() || isSending) return;
    sendMessage(inputText, attachments.length > 0 ? attachments : undefined);
    setInputText('');
    setAttachments([]);
  };

  const handleAttach = async () => {
    try {
      const selected = await dialogOpen({
        multiple: true,
        filters: [
          { name: 'All Files', extensions: ['*'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] },
          { name: 'Documents', extensions: ['pdf', 'txt', 'md', 'csv'] },
        ],
      });
      if (!selected) return;
      const files = Array.isArray(selected) ? selected : [selected];
      const newAttachments: import('@/stores/chat-store').Attachment[] = [];
      for (const filePath of files) {
        const name = filePath.split(/[/\\]/).pop() || filePath;
        const ext = name.split('.').pop()?.toLowerCase() || '';
        const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
        newAttachments.push({
          name,
          type: isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : `application/${ext}`,
          size: 0, // TODO: get actual file size via tauri-plugin-fs when available
        });
      }
      setAttachments((prev) => [...prev, ...newAttachments]);
    } catch (err) {
      console.error('File selection failed:', err);
    }
  };

  // Show mic errors as toast
  useEffect(() => {
    if (mic.error) toast.error(mic.error);
  }, [mic.error]);

  const handleMicClick = async () => {
    if (mic.isRecording) {
      const text = await mic.stopAndRecognize();
      if (text) setInputText((prev) => prev + text);
    } else {
      await mic.startRecording();
    }
  };

  const filteredSessions = sessions.filter((s) =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex h-full min-h-0">
      {/* Session List */}
      <div className="w-64 border-r bg-card flex flex-col min-h-0 shrink-0">
        <div className="p-3 border-b">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">{t('sessions.title', '对话')}</h2>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="sm" variant="default" className="h-7 w-7 p-0" onClick={newSession}>
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">{t('toolbar.newSession', '新会话')}</TooltipContent>
            </Tooltip>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder={t('sessions.search', '搜索...')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {filteredSessions.map((session) => (
              <div
                key={session.key}
                className={`group flex items-center justify-between px-3 py-2 rounded-md cursor-pointer text-sm transition-colors ${
                  session.key === currentSessionKey
                    ? 'bg-primary/10 text-foreground font-medium'
                    : 'hover:bg-muted/50 text-muted-foreground'
                }`}
                onClick={() => switchSession(session.key)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{session.title}</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSession(session.key);
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1 hover:text-destructive transition-opacity shrink-0"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <ChatToolbar />

        {/* Error banner */}
        {error && (
          <div className="mx-4 mt-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={clearError}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Messages - scrollable area */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="max-w-3xl mx-auto px-6 py-6">
            {messages.length === 0 && !isSending && (
              <WelcomeScreen />
            )}

            <div className="space-y-4">
              {messages.map((message) => (
                <MessageBubble key={message.id} message={message} onSpeak={handleSpeak} />
              ))}

              {/* Streaming message */}
              {isSending && streamingText && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3 max-w-[80%]">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-green-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg px-4 py-2 bg-muted prose prose-sm dark:prose-invert max-w-none">
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                        {streamingText}
                      </ReactMarkdown>
                      <span className="inline-block w-2 h-4 bg-foreground/50 animate-pulse ml-0.5" />
                    </div>
                  </div>
                </div>
              )}

              {/* Loading indicator */}
              {isSending && !streamingText && (
                <div className="flex justify-start">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-green-500 text-white">
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="rounded-lg px-4 py-3 bg-muted">
                      <div className="flex space-x-1">
                        <div className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce" />
                        <div className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.1s]" />
                        <div className="h-2 w-2 bg-foreground/40 rounded-full animate-bounce [animation-delay:0.2s]" />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t bg-card p-4 shrink-0">
          <div className="max-w-3xl mx-auto">
            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((att, i) => (
                  <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted text-xs">
                    {att.type.startsWith('image/') ? (
                      <ImageIcon className="h-3 w-3 text-blue-500" />
                    ) : (
                      <FileIcon className="h-3 w-3 text-muted-foreground" />
                    )}
                    <span className="max-w-[120px] truncate">{att.name}</span>
                    <button
                      onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))}
                      className="ml-0.5 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-end gap-2">
              {/* Attach button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleAttach} disabled={isSending}>
                    <Paperclip className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('input.attach', '附件')}</TooltipContent>
              </Tooltip>
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onCompositionStart={() => { isComposingRef.current = true; }}
                  onCompositionEnd={() => { isComposingRef.current = false; }}
                  placeholder={t('input.placeholder', '输入消息...')}
                  className="min-h-[40px] max-h-[120px] resize-none"
                  rows={1}
                  disabled={isSending}
                />
              </div>
              {/* Mic button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={mic.isRecording ? 'destructive' : 'outline'}
                    size="icon"
                    onClick={handleMicClick}
                    disabled={mic.isProcessing || isSending}
                  >
                    {mic.isProcessing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : mic.isRecording ? (
                      <Square className="h-4 w-4" />
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {mic.isProcessing
                    ? t('mic.processing', '识别中...')
                    : mic.isRecording
                    ? t('mic.recording', '录音中...')
                    : 'ASR'}
                </TooltipContent>
              </Tooltip>
              {/* Send / Stop button */}
              {isSending ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button onClick={abortMessage} variant="destructive" size="icon">
                      <Square className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('streaming.abort', '停止生成')}</TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  onClick={handleSend}
                  disabled={!inputText.trim()}
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Welcome Screen ============

function WelcomeScreen() {
  const { t } = useTranslation('chat');
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6">
      <div className="h-16 w-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
        <Bot className="h-8 w-8 text-white" />
      </div>
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">{t('welcome.title', 'Reeftotem Chat')}</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          {t('welcome.subtitle', '您的 AI 助手已就绪。在下方开始对话。')}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 w-full max-w-md">
        <div className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
          <Lightbulb className="h-5 w-5 text-amber-500" />
          <h3 className="text-sm font-medium">{t('welcome.askQuestions', '提问')}</h3>
          <p className="text-xs text-muted-foreground">{t('welcome.askQuestionsDesc', '获取任何话题的答案')}</p>
        </div>
        <div className="rounded-lg border bg-card p-4 space-y-2 hover:shadow-sm transition-shadow">
          <PenLine className="h-5 w-5 text-blue-500" />
          <h3 className="text-sm font-medium">{t('welcome.creativeTasks', '创意任务')}</h3>
          <p className="text-xs text-muted-foreground">{t('welcome.creativeTasksDesc', '写作、头脑风暴、创意')}</p>
        </div>
      </div>
    </div>
  );
}

// ============ MessageBubble ============

function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (isToday) return time;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${time}`;
}

const MessageBubble = memo(function MessageBubble({
  message,
  onSpeak,
}: {
  message: import('@/stores/chat-store').Message;
  onSpeak?: (text: string) => void;
}) {
  const { t } = useTranslation('chat');
  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const isUser = message.role === 'user';

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  }, [message.content]);

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex items-start gap-3 max-w-[80%] ${
          isUser ? 'flex-row-reverse' : ''
        }`}
      >
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback
            className={isUser ? 'bg-blue-500 text-white' : 'bg-green-500 text-white'}
          >
            {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>
        <div className="flex flex-col gap-1">
          {/* User attachments */}
          {isUser && message.attachments && message.attachments.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-1">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1 px-2 py-0.5 rounded bg-primary/20 text-[11px]">
                  {att.type.startsWith('image/') ? (
                    <ImageIcon className="h-3 w-3" />
                  ) : (
                    <FileIcon className="h-3 w-3" />
                  )}
                  <span className="max-w-[100px] truncate">{att.name}</span>
                </div>
              ))}
            </div>
          )}

          {/* Thinking blocks (assistant only) */}
          {!isUser && message.thinking && message.thinking.length > 0 && (
            <button
              onClick={() => setThinkingOpen(!thinkingOpen)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mb-1"
            >
              <Brain className="h-3 w-3" />
              <span>{t('thinking.label', 'Thinking')}</span>
              {thinkingOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          )}
          {!isUser && thinkingOpen && message.thinking && (
            <div className="rounded-md px-3 py-2 mb-1 bg-muted/50 border border-dashed text-xs text-muted-foreground font-mono whitespace-pre-wrap max-h-[200px] overflow-y-auto">
              {message.thinking.map((t, i) => t.content).join('\n\n')}
            </div>
          )}

          {/* Tool calls (assistant only) */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mb-1">
              <button
                onClick={() => setToolsOpen(!toolsOpen)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Wrench className="h-3 w-3" />
                <span>{t('tools.label', 'Tool Calls')} ({message.toolCalls.length})</span>
                {toolsOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              </button>
              {toolsOpen && (
                <div className="mt-1 space-y-1">
                  {message.toolCalls.map((tc) => (
                    <div key={tc.id} className="rounded-md border px-3 py-2 bg-card text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-medium">{tc.name}</span>
                        <Badge variant={
                          tc.status === 'done' ? 'default' :
                          tc.status === 'error' ? 'destructive' :
                          'secondary'
                        } className="text-[10px]">
                          {tc.status ?? 'done'}
                        </Badge>
                      </div>
                      {tc.arguments && (
                        <pre className="mt-1 text-muted-foreground overflow-x-auto">{tc.arguments}</pre>
                      )}
                      {tc.result && (
                        <pre className="mt-1 text-green-600 dark:text-green-400 overflow-x-auto">{tc.result}</pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Message content */}
          <div
            className={`rounded-lg px-4 py-2 ${
              isUser
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted prose prose-sm dark:prose-invert max-w-none'
            }`}
          >
            {isUser ? (
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
            ) : (
              <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
                {message.content}
              </ReactMarkdown>
            )}
          </div>
          {/* Timestamp + Copy + Speak */}
          <div className={`flex items-center gap-2 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
            <span className="text-[10px] text-muted-foreground/60">
              {formatTimestamp(message.timestamp)}
            </span>
            {!isUser && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleCopy}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                    >
                      {copied ? (
                        <Check className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3 text-muted-foreground" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {copied ? 'Copied!' : 'Copy'}
                  </TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => onSpeak?.(message.content)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-muted"
                    >
                      <Volume2 className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">
                    {t('tts.speak', '朗读')}
                  </TooltipContent>
                </Tooltip>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
