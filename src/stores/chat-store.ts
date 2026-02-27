/**
 * Chat Store
 * Manages chat sessions and messages with real AI streaming via Tauri events.
 * Persistence is handled by SQLite on the Rust backend.
 */

import { create } from 'zustand';
import { invoke } from '@/lib/bridge';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useAgentsStore } from '@/stores/agents-store';
import { useProvidersStore } from '@/stores/providers-store';

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  status?: 'pending' | 'running' | 'done' | 'error';
  result?: string;
}

export interface ThinkingBlock {
  content: string;
}

export interface Attachment {
  name: string;
  type: string;
  size: number;
  dataUrl?: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: ToolCall[];
  thinking?: ThinkingBlock[];
  attachments?: Attachment[];
}

export interface ChatSession {
  key: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// Backend row shape returned by SQLite commands
interface DbSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  agentId?: string | null;
  providerId?: string | null;
  model?: string | null;
}

interface DbMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  thinking: ThinkingBlock[] | null;
  toolCalls: ToolCall[] | null;
  attachments: Attachment[] | null;
  createdAt: string;
}

interface ChatDeltaPayload {
  sessionKey: string;
  text: string;
}

interface ChatFinalPayload {
  sessionKey: string;
  fullText: string;
  model: string;
}

interface ChatErrorPayload {
  sessionKey: string;
  error: string;
}

interface ChatToolCallPayload {
  sessionKey: string;
  toolCallId: string;
  toolName: string;
  arguments: Record<string, unknown>;
}

interface ChatToolResultPayload {
  sessionKey: string;
  toolCallId: string;
  toolName: string;
  result: string;
  isError: boolean;
}

interface ChatState {
  sessions: ChatSession[];
  currentSessionKey: string;
  messagesBySession: Record<string, Message[]>;
  isSending: boolean;
  streamingText: string;
  error: string | null;
  sessionsLoaded: boolean;
}

interface ChatActions {
  loadSessions: () => Promise<void>;
  initListeners: () => () => void;
  newSession: () => Promise<void>;
  switchSession: (key: string) => Promise<void>;
  deleteSession: (key: string) => Promise<void>;
  renameSession: (key: string, title: string) => Promise<void>;
  sendMessage: (text: string, attachments?: Attachment[]) => Promise<void>;
  abortMessage: () => Promise<void>;
  clearError: () => void;
  getMessages: () => Message[];
}

function generateTitle(text: string): string {
  return text.length > 30 ? text.slice(0, 30) + '...' : text;
}

/** Convert a DB session row to the frontend ChatSession shape. */
function toSession(row: DbSession): ChatSession {
  return {
    key: row.id,
    title: row.title,
    createdAt: new Date(row.createdAt).getTime(),
    updatedAt: new Date(row.updatedAt).getTime(),
  };
}

/** Convert a DB message row to the frontend Message shape. */
function toMessage(row: DbMessage): Message {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    timestamp: new Date(row.createdAt).getTime(),
    toolCalls: row.toolCalls ?? undefined,
    thinking: row.thinking ?? undefined,
    attachments: row.attachments ?? undefined,
  };
}

/** Save a message to the backend. Errors are logged but never thrown. */
async function persistMessage(
  sessionId: string,
  role: string,
  content: string,
  thinking?: ThinkingBlock[],
  toolCalls?: ToolCall[],
  attachments?: Attachment[],
): Promise<DbMessage | null> {
  try {
    const saved = await invoke<DbMessage>('chat_message_save', {
      sessionId,
      role,
      content,
      thinking: thinking ? JSON.stringify(thinking) : null,
      toolCalls: toolCalls ?? null,
      attachments: attachments ?? null,
    });
    return saved;
  } catch (err) {
    console.error('[chat] Failed to persist message:', err);
    return null;
  }
}

export const useChatStore = create<ChatState & ChatActions>()((set, get) => ({
  sessions: [],
  currentSessionKey: '',
  messagesBySession: {},
  isSending: false,
  streamingText: '',
  error: null,
  sessionsLoaded: false,

  loadSessions: async () => {
    try {
      const rows = await invoke<DbSession[]>('chat_session_list');
      const sessions = rows.map(toSession);

      if (sessions.length === 0) {
        // No sessions exist yet -- create one
        const row = await invoke<DbSession>('chat_session_create', {
          title: 'New Chat',
          agentId: null,
          providerId: null,
          model: null,
        });
        const session = toSession(row);
        set({
          sessions: [session],
          currentSessionKey: session.key,
          sessionsLoaded: true,
        });
      } else {
        const state = get();
        // Keep current key if it is still valid, otherwise pick first
        const validKey = sessions.find((s) => s.key === state.currentSessionKey)
          ? state.currentSessionKey
          : sessions[0].key;
        set({ sessions, currentSessionKey: validKey, sessionsLoaded: true });

        // Eagerly load messages for the active session
        try {
          const msgRows = await invoke<DbMessage[]>('chat_message_list', { sessionId: validKey });
          const messages = msgRows.map(toMessage);
          set((s) => ({
            messagesBySession: { ...s.messagesBySession, [validKey]: messages },
          }));
        } catch (err) {
          console.warn('[chat] Failed to load messages for session:', validKey, err);
        }
      }
    } catch (err) {
      console.error('[chat] loadSessions failed, starting with empty state:', err);
      set({ sessions: [], currentSessionKey: '', sessionsLoaded: true });
    }
  },

  initListeners: () => {
    let disposed = false;
    const unlistenFns: UnlistenFn[] = [];

    // Load sessions on init
    get().loadSessions();

    Promise.all([
      listen<ChatDeltaPayload>('ai_chat_delta', (event) => {
        if (disposed) return;
        const { sessionKey, text } = event.payload;
        const state = get();
        if (sessionKey === state.currentSessionKey) {
          set({ streamingText: state.streamingText + text });
        }
      }),
      listen<ChatFinalPayload>('ai_chat_final', (event) => {
        if (disposed) return;
        const { sessionKey, fullText } = event.payload;
        const state = get();
        const msgs = state.messagesBySession[sessionKey] ?? [];
        const assistantMsg: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: fullText,
          timestamp: Date.now(),
        };
        set({
          messagesBySession: {
            ...state.messagesBySession,
            [sessionKey]: [...msgs, assistantMsg],
          },
          isSending: false,
          streamingText: '',
        });

        // Persist assistant reply to SQLite (fire-and-forget)
        persistMessage(sessionKey, 'assistant', fullText);
      }),
      listen<ChatErrorPayload>('ai_chat_error', (event) => {
        if (disposed) return;
        const { sessionKey, error } = event.payload;
        const state = get();
        if (sessionKey === state.currentSessionKey) {
          set({ error, isSending: false, streamingText: '' });
        }
      }),
      listen<ChatToolCallPayload>('ai_chat_tool_call', (event) => {
        if (disposed) return;
        const { sessionKey, toolCallId, toolName, arguments: args } = event.payload;
        const state = get();
        const msgs = state.messagesBySession[sessionKey] ?? [];
        // Find or create the in-progress assistant message
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.toolCalls) {
          // Append to existing tool calls
          const updatedCalls = [
            ...lastMsg.toolCalls,
            { id: toolCallId, name: toolName, arguments: JSON.stringify(args), status: 'running' as const },
          ];
          const updatedMsgs = [...msgs.slice(0, -1), { ...lastMsg, toolCalls: updatedCalls }];
          set({
            messagesBySession: { ...state.messagesBySession, [sessionKey]: updatedMsgs },
          });
        } else {
          // Create new assistant message with tool call
          const assistantMsg: Message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            role: 'assistant',
            content: state.streamingText || '',
            timestamp: Date.now(),
            toolCalls: [{ id: toolCallId, name: toolName, arguments: JSON.stringify(args), status: 'running' }],
          };
          set({
            messagesBySession: { ...state.messagesBySession, [sessionKey]: [...msgs, assistantMsg] },
            streamingText: '',
          });
        }
      }),
      listen<ChatToolResultPayload>('ai_chat_tool_result', (event) => {
        if (disposed) return;
        const { sessionKey, toolCallId, result, isError } = event.payload;
        const state = get();
        const msgs = state.messagesBySession[sessionKey] ?? [];
        // Find the assistant message with this tool call
        const updatedMsgs = msgs.map((m) => {
          if (m.role === 'assistant' && m.toolCalls) {
            const updatedCalls = m.toolCalls.map((tc) =>
              tc.id === toolCallId
                ? { ...tc, status: (isError ? 'error' : 'done') as ToolCall['status'], result }
                : tc
            );
            return { ...m, toolCalls: updatedCalls };
          }
          return m;
        });
        set({
          messagesBySession: { ...state.messagesBySession, [sessionKey]: updatedMsgs },
        });
      }),
    ]).then((fns) => {
      if (disposed) {
        fns.forEach((fn) => fn());
      } else {
        unlistenFns.push(...fns);
      }
    });

    return () => {
      disposed = true;
      unlistenFns.forEach((fn) => fn());
    };
  },

  newSession: async () => {
    try {
      const row = await invoke<DbSession>('chat_session_create', {
        title: 'New Chat',
        agentId: null,
        providerId: null,
        model: null,
      });
      const session = toSession(row);
      set((state) => ({
        sessions: [session, ...state.sessions],
        currentSessionKey: session.key,
        messagesBySession: { ...state.messagesBySession, [session.key]: [] },
        isSending: false,
        streamingText: '',
        error: null,
      }));
    } catch (err) {
      console.error('[chat] newSession failed:', err);
      set({ error: String(err) });
    }
  },

  switchSession: async (key) => {
    set({ currentSessionKey: key, isSending: false, streamingText: '', error: null });

    // Lazy-load messages if not already cached
    const state = get();
    if (!state.messagesBySession[key]) {
      try {
        const msgRows = await invoke<DbMessage[]>('chat_message_list', { sessionId: key });
        const messages = msgRows.map(toMessage);
        set((s) => ({
          messagesBySession: { ...s.messagesBySession, [key]: messages },
        }));
      } catch (err) {
        console.warn('[chat] Failed to load messages for session:', key, err);
      }
    }
  },

  deleteSession: async (key) => {
    try {
      await invoke('chat_session_delete', { id: key });
    } catch (err) {
      console.error('[chat] deleteSession backend failed:', err);
      // Continue with local cleanup anyway
    }

    const state = get();
    const filtered = state.sessions.filter((s) => s.key !== key);
    const newMsgs = { ...state.messagesBySession };
    delete newMsgs[key];

    if (filtered.length === 0) {
      // Create a fresh session since we can't have zero sessions
      try {
        const row = await invoke<DbSession>('chat_session_create', {
          title: 'New Chat',
          agentId: null,
          providerId: null,
          model: null,
        });
        const session = toSession(row);
        set({
          sessions: [session],
          currentSessionKey: session.key,
          messagesBySession: { ...newMsgs, [session.key]: [] },
        });
      } catch (err) {
        console.error('[chat] Failed to create replacement session:', err);
        set({ sessions: [], currentSessionKey: '', messagesBySession: newMsgs });
      }
    } else {
      const newCurrent =
        state.currentSessionKey === key ? filtered[0].key : state.currentSessionKey;
      set({
        sessions: filtered,
        currentSessionKey: newCurrent,
        messagesBySession: newMsgs,
      });
    }
  },

  renameSession: async (key, title) => {
    // Optimistic update
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.key === key ? { ...s, title } : s
      ),
    }));

    try {
      await invoke('chat_session_rename', { id: key, title });
    } catch (err) {
      console.error('[chat] renameSession backend failed:', err);
    }
  },

  sendMessage: async (text, attachments) => {
    const state = get();
    if (!text.trim() || state.isSending) return;

    const sessionKey = state.currentSessionKey;
    const trimmed = text.trim();

    // Add user message to local state immediately
    const userMsg: Message = {
      id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      role: 'user',
      content: trimmed,
      timestamp: Date.now(),
      attachments: attachments?.length ? attachments : undefined,
    };

    const currentMsgs = state.messagesBySession[sessionKey] ?? [];
    const updatedMsgs = [...currentMsgs, userMsg];

    // Update session title from first user message
    const isFirstMessage = currentMsgs.length === 0;
    const newTitle = isFirstMessage ? generateTitle(trimmed) : undefined;
    const sessions = state.sessions.map((s) =>
      s.key === sessionKey && isFirstMessage
        ? { ...s, title: newTitle!, updatedAt: Date.now() }
        : s.key === sessionKey
        ? { ...s, updatedAt: Date.now() }
        : s
    );

    set({
      messagesBySession: { ...state.messagesBySession, [sessionKey]: updatedMsgs },
      sessions,
      isSending: true,
      streamingText: '',
      error: null,
    });

    // Persist user message to SQLite (fire-and-forget)
    persistMessage(
      sessionKey,
      'user',
      trimmed,
      undefined,
      undefined,
      attachments?.length ? attachments : undefined,
    );

    // Rename session in backend if this is the first message
    if (isFirstMessage && newTitle) {
      invoke('chat_session_rename', { id: sessionKey, title: newTitle }).catch((err: unknown) => {
        console.warn('[chat] Failed to rename session:', err);
      });
    }

    // Get active agent and provider
    const agent = useAgentsStore.getState().getActiveAgent();
    const { defaultProviderId, providers } = useProvidersStore.getState();

    // Resolve provider: agent override -> default -> first available
    let providerId = agent?.providerId || defaultProviderId;
    if (!providerId && providers.length > 0) {
      providerId = providers[0].id;
      console.warn('[chat] No default provider set, falling back to first provider:', providerId);
    }

    if (!providerId) {
      set({
        error: 'No provider configured. Please add a provider in Settings. / 未配置服务商，请在设置中添加。',
        isSending: false,
      });
      return;
    }

    console.info('[chat] sendMessage ->', {
      providerId,
      agentId: agent?.id ?? null,
      agentModel: agent?.model ?? null,
      sessionKey,
    });

    // Build messages for API
    const apiMessages = updatedMsgs.map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await invoke('ai_chat_send', {
        request: {
          sessionKey,
          providerId,
          messages: apiMessages,
          systemPrompt: agent?.systemPrompt || null,
          model: agent?.model || null,
          temperature: agent?.temperature ?? null,
          maxTokens: agent?.maxTokens ?? null,
        },
      });
    } catch (err) {
      console.error('[chat] ai_chat_send failed:', err);
      set({
        error: String(err),
        isSending: false,
        streamingText: '',
      });
    }
  },

  abortMessage: async () => {
    const state = get();
    const { currentSessionKey, streamingText } = state;
    try {
      await invoke('ai_chat_abort', { sessionKey: currentSessionKey });
    } catch {
      // ignore
    }

    // Preserve already-received text as an assistant message
    if (streamingText.trim()) {
      const msgs = state.messagesBySession[currentSessionKey] ?? [];
      const abortedMsg: Message = {
        id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'assistant',
        content: streamingText,
        timestamp: Date.now(),
      };
      set({
        messagesBySession: {
          ...state.messagesBySession,
          [currentSessionKey]: [...msgs, abortedMsg],
        },
        isSending: false,
        streamingText: '',
      });

      // Persist the aborted (partial) assistant message
      persistMessage(currentSessionKey, 'assistant', streamingText);
    } else {
      set({ isSending: false, streamingText: '' });
    }
  },

  clearError: () => set({ error: null }),

  getMessages: () => {
    const { messagesBySession, currentSessionKey } = get();
    return messagesBySession[currentSessionKey] ?? [];
  },
}));
