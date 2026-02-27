/**
 * useChatTTS - 监听 AI 回复完成事件，自动触发 TTS 朗读
 */

import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useSettingsStore } from '@/stores/settings-store';
import type { UseTTSReturn } from '@/hooks/useTTS';

interface ChatFinalPayload {
  sessionKey: string;
  fullText: string;
  model: string;
}

export function useChatTTS(tts: UseTTSReturn): void {
  // Use ref to always have the latest tts without re-running effect
  const ttsRef = useRef(tts);
  ttsRef.current = tts;

  useEffect(() => {
    let unlisten: UnlistenFn | undefined;

    listen<ChatFinalPayload>('ai_chat_final', (event) => {
      const { autoTtsEnabled } = useSettingsStore.getState();
      const current = ttsRef.current;
      if (!autoTtsEnabled || current.isSpeaking) return;
      current.speak(event.payload.fullText);
    }).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, []); // empty deps - register once
}
