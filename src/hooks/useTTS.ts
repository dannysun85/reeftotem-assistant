/**
 * useTTS - TTS 语音播放 + Live2D 口型同步 + 情感表情 Hook
 * 调用腾讯云 TTS → 播放音频 → 模拟口型同步 → 驱动 Live2D 口型/表情
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { tencentCloudVoiceService } from '@/lib/ai/TencentCloudVoiceService';
import {
  triggerLive2DExpression,
  setLive2DLipSyncLevel,
  analyzeEmotion,
  emotionToExpressionId,
  emotionToExpressionIdForModel,
} from '@/lib/live2d-bridge';

/** 腾讯云 TextToVoice 中文最多 150 字, 英文最多 500 字母 */
const MAX_TTS_CHARS = 140;

/** Lip sync 更新间隔 (ms) — ~20fps */
const LIP_SYNC_INTERVAL = 50;

/** Strip markdown syntax for clean TTS input */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')   // code blocks
    .replace(/`([^`]+)`/g, '$1')      // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')   // images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1') // links → keep text
    .replace(/#{1,6}\s+/g, '')        // headings
    .replace(/(\*\*|__)(.*?)\1/g, '$2') // bold
    .replace(/(\*|_)(.*?)\1/g, '$2')  // italic
    .replace(/~~(.*?)~~/g, '$1')      // strikethrough
    .replace(/>\s+/g, '')             // blockquotes
    .replace(/[-*+]\s+/g, '')         // list markers
    .replace(/\d+\.\s+/g, '')         // ordered list
    .replace(/\|.*\|/g, '')           // tables
    .replace(/---+/g, '')             // horizontal rules
    .replace(/\n{2,}/g, '\n')         // collapse blank lines
    .trim();
}

/** 按句号/问号/叹号拆分文本, 每段不超过 MAX_TTS_CHARS */
function splitTextForTTS(text: string): string[] {
  if (text.length <= MAX_TTS_CHARS) return [text];

  const segments: string[] = [];
  const sentences = text.split(/(?<=[。！？.!?\n])/);
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length > MAX_TTS_CHARS) {
      if (current) segments.push(current.trim());
      if (sentence.length > MAX_TTS_CHARS) {
        segments.push(sentence.slice(0, MAX_TTS_CHARS));
      } else {
        current = sentence;
      }
    } else {
      current += sentence;
    }
  }
  if (current.trim()) segments.push(current.trim());

  return segments.filter(Boolean);
}

export interface UseTTSReturn {
  isSpeaking: boolean;
  speak: (text: string) => Promise<void>;
  stop: () => void;
}

export function useTTS(): UseTTSReturn {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const speakLockRef = useRef<Promise<void>>(Promise.resolve());
  const stoppedRef = useRef(false);
  const lipSyncTimerRef = useRef<number | null>(null);

  const stopLipSync = useCallback(() => {
    if (lipSyncTimerRef.current !== null) {
      clearInterval(lipSyncTimerRef.current);
      lipSyncTimerRef.current = null;
    }
    setLive2DLipSyncLevel(0);
  }, []);

  const cleanup = useCallback(() => {
    stopLipSync();

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onplay = null;
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, [stopLipSync]);

  const resetLive2D = useCallback(() => {
    stopLipSync();
    triggerLive2DExpression(emotionToExpressionId('neutral'));
  }, [stopLipSync]);

  const stop = useCallback(() => {
    stoppedRef.current = true;
    cleanup();
    setIsSpeaking(false);
    resetLive2D();
  }, [cleanup, resetLive2D]);

  /**
   * 模拟口型同步：用多频率正弦波叠加 + 随机扰动生成自然的嘴部开合
   * 不依赖 Web Audio API，兼容 Tauri WebView
   */
  const startSimulatedLipSync = useCallback(() => {
    stopLipSync();

    let phase = Math.random() * Math.PI * 2; // random start phase
    const speed1 = 5.0 + Math.random() * 2;  // primary ~5-7 Hz (syllable rate)
    const speed2 = 2.5 + Math.random();       // secondary ~2.5-3.5 Hz (word rate)
    const speed3 = 11 + Math.random() * 3;   // tertiary ~11-14 Hz (fast jitter)

    lipSyncTimerRef.current = window.setInterval(() => {
      phase += LIP_SYNC_INTERVAL / 1000;

      // Multi-frequency oscillation for natural mouth movement
      const wave1 = Math.abs(Math.sin(phase * speed1));            // primary: syllable
      const wave2 = 0.3 * Math.abs(Math.sin(phase * speed2));     // secondary: word
      const wave3 = 0.1 * Math.abs(Math.sin(phase * speed3));     // tertiary: jitter
      const noise = 0.05 * (Math.random() - 0.5);                 // random noise

      // Combine and clamp to 0.15 ~ 0.85 range for natural look
      const raw = wave1 * 0.6 + wave2 + wave3 + noise;
      const level = Math.max(0.1, Math.min(0.85, raw));

      setLive2DLipSyncLevel(level);
    }, LIP_SYNC_INTERVAL);

  }, [stopLipSync]);

  /** Play a single audio segment and return a promise that resolves when done */
  const playSegment = useCallback((audioData: number[], emotion: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      cleanup();

      const audioBytes = new Uint8Array(audioData);
      const blob = new Blob([audioBytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onplay = () => {
        setIsSpeaking(true);
        triggerLive2DExpression(emotion);
        // 不触发 body motion — 某些模型的 TapBody 动作会覆盖口型参数
        // Start simulated lip sync when audio starts
        startSimulatedLipSync();
      };

      audio.onended = () => {
        stopLipSync();
        cleanup();
        resolve();
      };

      audio.onerror = () => {
        const code = audio.error?.code;
        const msg = audio.error?.message || '未知';
        console.error(`[TTS] Audio 播放错误: code=${code} msg=${msg}`);
        cleanup();
        reject(new Error(`音频播放失败: ${msg}`));
      };

      audio.play().catch((e) => {
        console.error('[TTS] audio.play() rejected:', e);
        cleanup();
        reject(e);
      });
    });
  }, [cleanup, stopLipSync, startSimulatedLipSync]);

  /** 内部执行：实际的 TTS 合成 + 播放流程 */
  const speakInternal = useCallback(async (text: string) => {
    stoppedRef.current = false;
    cleanup();
    setIsSpeaking(false);

    const cleanText = stripMarkdown(text);
    if (!cleanText) {
      toast.error('文本为空，无法朗读');
      return;
    }

    // Analyze emotion from the full text for expression (模型感知)
    const emotion = analyzeEmotion(cleanText);
    const currentModel = localStorage.getItem('currentPersona') || '';
    const expressionId = currentModel
      ? emotionToExpressionIdForModel(emotion, currentModel)
      : emotionToExpressionId(emotion);
    // Split text into TTS-compatible segments
    const segments = splitTextForTTS(cleanText);

    for (let i = 0; i < segments.length; i++) {
      if (stoppedRef.current) break;

      const seg = segments[i];

      const result = await tencentCloudVoiceService.synthesizeSpeech(seg);

      if (stoppedRef.current) break;

      if (!result || !result.success) {
        const errMsg = result?.errorMessage || '合成返回 null';
        console.error('[TTS] 合成失败:', errMsg);
        if (errMsg.includes('PkgExhausted')) {
          toast.error('腾讯云 TTS 资源包已用完，请前往控制台续费');
        } else if (errMsg.includes('AuthFailure')) {
          toast.error('腾讯云认证失败，请检查 API 密钥配置');
        } else {
          toast.error(`语音合成失败: ${errMsg}`);
        }
        continue;
      }

      const rawData = result.audioData;
      if (!rawData || rawData.length === 0) continue;

      try {
        await playSegment(rawData, expressionId);
      } catch (playErr) {
        console.error('[TTS] 播放段失败:', playErr);
        continue;
      }
    }
  }, [cleanup, playSegment]);

  /**
   * speak() — 使用 Promise 链序列化，保证同一时刻只有一个 TTS 流程在执行。
   * 新调用会先中断旧的（通过 stoppedRef），然后等旧的完成后再启动。
   */
  const speak = useCallback(async (text: string) => {
    toast.info('语音合成中...');

    // 中断上一个播放（如果有）
    stoppedRef.current = true;
    cleanup();

    // 用 Promise 链序列化：等上一个流程结束后再启动新的
    const task = speakInternal(text).catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[TTS] speak() 异常:', msg);
      toast.error(`TTS 错误: ${msg}`);
    }).finally(() => {
      setIsSpeaking(false);
      resetLive2D();
    });

    speakLockRef.current = speakLockRef.current.then(() => task);
    await speakLockRef.current;
  }, [cleanup, resetLive2D, speakInternal]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      cleanup();
    };
  }, [cleanup]);

  return { isSpeaking, speak, stop };
}
