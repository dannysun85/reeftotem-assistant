/**
 * useChatLive2D - 聊天 ↔ Live2D 联动 Hook
 * 监听 AI 聊天事件，驱动 Live2D 数字人做出相应表情/动作反应。
 * 在 ChatPage 中调用一次即可。
 */

import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import {
  analyzeEmotion,
  emotionToExpressionIdForModel,
  triggerLive2DExpression,
  triggerLive2DMotion,
} from '@/lib/live2d-bridge';

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

export function useChatLive2D(enabled: boolean = true) {
  const lastEmotionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const unlistens: Promise<UnlistenFn>[] = [];

    const currentModel = () => localStorage.getItem('currentPersona') || '';

    // 1. AI 开始流式输出 → 首次 delta 触发思考表情
    unlistens.push(
      listen<ChatDeltaPayload>('ai_chat_delta', () => {
        if (lastEmotionRef.current !== 'thinking') {
          lastEmotionRef.current = 'thinking';
          triggerLive2DExpression(emotionToExpressionIdForModel('thinking', currentModel()));
        }
      })
    );

    // 2. AI 回复完成 → 分析情感 → 触发对应表情
    unlistens.push(
      listen<ChatFinalPayload>('ai_chat_final', (event) => {
        const { fullText } = event.payload;
        const emotion = analyzeEmotion(fullText);
        const expressionId = emotionToExpressionIdForModel(emotion, currentModel());
        lastEmotionRef.current = emotion;
        triggerLive2DExpression(expressionId);

        // 高兴时额外触发一个动作
        if (emotion === 'happy') {
          triggerLive2DMotion('TapBody');
        }
      })
    );

    // 3. AI 出错 → 悲伤表情
    unlistens.push(
      listen<ChatErrorPayload>('ai_chat_error', () => {
        lastEmotionRef.current = 'sad';
        triggerLive2DExpression(emotionToExpressionIdForModel('sad', currentModel()));
      })
    );

    return () => {
      Promise.all(unlistens)
        .then((fns) => fns.forEach((fn) => fn()))
        .catch((err) => console.warn('Failed to cleanup Live2D listeners:', err));
    };
  }, [enabled]);
}
