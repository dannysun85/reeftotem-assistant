/**
 * NotificationBubble - Live2D 角色通知气泡
 *
 * 监听渠道消息和系统通知事件，在 Live2D 角色上方显示气泡。
 * 支持自动消失、队列显示和简单动画。
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

// ─── Types ───────────────────────────────────────────────────

interface BubbleMessage {
  id: string;
  source: 'channel' | 'workflow' | 'cron' | 'system';
  icon: string;
  title: string;
  text: string;
  timestamp: number;
}

interface ChannelMessagePayload {
  channelId: string;
  channelType: string;
  senderName: string;
  text: string;
}

interface WorkflowStatusPayload {
  workflowId: string;
  runId: string;
  status: string;
  workflowName?: string;
}

interface CronResultPayload {
  jobId: string;
  jobName: string;
  success: boolean;
  message?: string;
}

interface NotificationBubbleProps {
  /** 气泡显示持续时间 (ms)，默认 5000 */
  duration?: number;
  /** 最大同时显示气泡数，默认 3 */
  maxVisible?: number;
  /** 是否启用，默认 true */
  enabled?: boolean;
}

// ─── Source icons ────────────────────────────────────────────

const SOURCE_ICONS: Record<BubbleMessage['source'], string> = {
  channel: '💬',
  workflow: '⚙️',
  cron: '⏰',
  system: '🔔',
};

// ─── Component ───────────────────────────────────────────────

export default function NotificationBubble({
  duration = 5000,
  maxVisible = 3,
  enabled = true,
}: NotificationBubbleProps) {
  const [messages, setMessages] = useState<BubbleMessage[]>([]);
  const counterRef = useRef(0);

  const addMessage = useCallback(
    (source: BubbleMessage['source'], title: string, text: string) => {
      const id = `bubble-${++counterRef.current}`;
      const msg: BubbleMessage = {
        id,
        source,
        icon: SOURCE_ICONS[source],
        title,
        text: text.length > 80 ? text.slice(0, 77) + '...' : text,
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const next = [msg, ...prev];
        return next.slice(0, maxVisible + 2); // keep a few extra for fade-out
      });

      // Auto-dismiss
      setTimeout(() => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
      }, duration);
    },
    [duration, maxVisible]
  );

  useEffect(() => {
    if (!enabled) return;

    const unlistens: Promise<UnlistenFn>[] = [];

    // Channel messages
    unlistens.push(
      listen<ChannelMessagePayload>('channel_message_received', (event) => {
        const { senderName, text, channelType } = event.payload;
        addMessage('channel', `${senderName} (${channelType})`, text);
      })
    );

    // Workflow completions
    unlistens.push(
      listen<WorkflowStatusPayload>('workflow_status_changed', (event) => {
        const { status, workflowName } = event.payload;
        if (status === 'completed' || status === 'failed') {
          const name = workflowName || 'Workflow';
          addMessage(
            'workflow',
            name,
            status === 'completed' ? 'Completed successfully' : 'Execution failed'
          );
        }
      })
    );

    // Cron results
    unlistens.push(
      listen<CronResultPayload>('cron_job_completed', (event) => {
        const { jobName, success, message } = event.payload;
        addMessage(
          'cron',
          jobName,
          success ? (message || 'Task completed') : (message || 'Task failed')
        );
      })
    );

    return () => {
      Promise.all(unlistens).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [enabled, addMessage]);

  const visibleMessages = messages.slice(0, maxVisible);

  if (visibleMessages.length === 0) return null;

  return (
    <div
      className="fixed top-2 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-1.5 pointer-events-none"
      style={{ maxWidth: '220px' }}
    >
      {visibleMessages.map((msg, idx) => (
        <div
          key={msg.id}
          className="pointer-events-auto bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm
                     rounded-xl px-3 py-2 shadow-lg border border-gray-200/50 dark:border-gray-700/50
                     text-xs max-w-[200px] animate-in slide-in-from-top-2 fade-in duration-300"
          style={{ opacity: 1 - idx * 0.15 }}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-sm">{msg.icon}</span>
            <span className="font-medium text-gray-700 dark:text-gray-200 truncate">
              {msg.title}
            </span>
          </div>
          <p className="text-gray-500 dark:text-gray-400 line-clamp-2 leading-tight">
            {msg.text}
          </p>
        </div>
      ))}
    </div>
  );
}
