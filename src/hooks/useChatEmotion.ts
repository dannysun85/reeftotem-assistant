/**
 * useChatEmotion - 聊天情感分析 → Live2D 表情/动作 融合 Hook
 *
 * 增强版情感处理管道：
 * 1. 监听 AI 聊天事件 (delta / final / error)
 * 2. 分析回复文本的情感
 * 3. 联动 Live2D 表情 + 动作（通过模型个性化配置）
 * 4. 支持 Workflow 执行状态 → Live2D 动画
 *
 * 合并了 useChatLive2D 的功能并扩展了 workflow + channel 事件支持。
 */

import { useEffect, useRef, useCallback } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  analyzeEmotion,
  emotionToExpressionIdForModel,
  triggerLive2DExpression,
  triggerLive2DMotion,
  type Emotion,
} from '@/lib/live2d-bridge';
import { getModelInteractionConfig } from '@/data/model-interactions';
import type { InteractionCategory } from '@/types/model-interaction';

// ─── Event payloads ──────────────────────────────────────────

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

interface WorkflowStatusPayload {
  workflowId: string;
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  nodeId?: string;
}

interface ChannelMessagePayload {
  channelId: string;
  channelType: string;
  senderName: string;
  text: string;
}

// ─── Emotion → Interaction category mapping ──────────────────

const EMOTION_TO_CATEGORY: Record<Emotion, InteractionCategory> = {
  happy: 'happy',
  sad: 'sad',
  angry: 'angry',
  surprised: 'surprised',
  thinking: 'thinking',
  shy: 'shy',
  neutral: 'greet',
};

// ─── Return type ─────────────────────────────────────────────

export interface UseChatEmotionReturn {
  /** 当前检测到的情感 */
  currentEmotion: React.MutableRefObject<Emotion>;
  /** 手动触发一个情感表达 */
  expressEmotion: (emotion: Emotion) => void;
}

// ─── Hook ────────────────────────────────────────────────────

export function useChatEmotion(enabled: boolean = true): UseChatEmotionReturn {
  const currentEmotion = useRef<Emotion>('neutral');
  const lastTriggeredRef = useRef<string | null>(null);

  /** 获取当前模型名 */
  const getCurrentModel = useCallback((): string => {
    return localStorage.getItem('currentPersona') || '';
  }, []);

  /**
   * 触发情感表达：表情 + 可能的动作
   * 使用模型个性化配置（如果有），否则降级到全局映射
   */
  const expressEmotion = useCallback((emotion: Emotion) => {
    const modelName = getCurrentModel();
    const expressionId = emotionToExpressionIdForModel(emotion, modelName);

    // 避免短时间内重复触发相同表情
    if (lastTriggeredRef.current === expressionId) return;
    lastTriggeredRef.current = expressionId;
    currentEmotion.current = emotion;

    triggerLive2DExpression(expressionId);

    // 尝试从模型配置中找到匹配情感类别的动作
    const config = getModelInteractionConfig(modelName);
    if (config) {
      const category = EMOTION_TO_CATEGORY[emotion];
      const matchingInteractions = config.menuInteractions.filter(
        (i) => i.category === category && i.motion != null
      );
      if (matchingInteractions.length > 0) {
        const picked = matchingInteractions[Math.floor(Math.random() * matchingInteractions.length)];
        if (picked.motion) {
          triggerLive2DMotion(picked.motion);
        }
      }
    }
  }, [getCurrentModel]);

  useEffect(() => {
    if (!enabled) return;

    const unlistens: Promise<UnlistenFn>[] = [];

    // ── AI 流式输出开始 → 思考表情 ──
    unlistens.push(
      listen<ChatDeltaPayload>('ai_chat_delta', () => {
        if (currentEmotion.current !== 'thinking') {
          expressEmotion('thinking');
        }
      })
    );

    // ── AI 回复完成 → 分析情感并表达 ──
    unlistens.push(
      listen<ChatFinalPayload>('ai_chat_final', (event) => {
        const emotion = analyzeEmotion(event.payload.fullText);
        lastTriggeredRef.current = null; // 允许触发新表情
        expressEmotion(emotion);
      })
    );

    // ── AI 出错 → 悲伤 ──
    unlistens.push(
      listen<ChatErrorPayload>('ai_chat_error', () => {
        lastTriggeredRef.current = null;
        expressEmotion('sad');
      })
    );

    // ── Workflow 状态变化 → 对应动画 ──
    unlistens.push(
      listen<WorkflowStatusPayload>('workflow_status_changed', (event) => {
        const { status } = event.payload;
        lastTriggeredRef.current = null;
        switch (status) {
          case 'running':
            expressEmotion('thinking');
            break;
          case 'completed':
            expressEmotion('happy');
            break;
          case 'failed':
            expressEmotion('sad');
            break;
          case 'cancelled':
            expressEmotion('surprised');
            break;
        }
      })
    );

    // ── 渠道消息到达 → 分析消息情感 ──
    unlistens.push(
      listen<ChannelMessagePayload>('channel_message_received', (event) => {
        const emotion = analyzeEmotion(event.payload.text);
        lastTriggeredRef.current = null;
        expressEmotion(emotion === 'neutral' ? 'happy' : emotion);
      })
    );

    return () => {
      Promise.all(unlistens).then((fns) => fns.forEach((fn) => fn()));
    };
  }, [enabled, expressEmotion]);

  return { currentEmotion, expressEmotion };
}
