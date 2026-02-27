/**
 * useMicInput - 麦克风录音 + ASR 语音识别 Hook
 * 使用 AudioContext 采集 16kHz 原始 PCM，兼容腾讯云 ASR。
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { tencentCloudVoiceService } from '@/lib/ai/TencentCloudVoiceService';

export interface UseMicInputReturn {
  isRecording: boolean;
  isProcessing: boolean;
  error: string | null;
  startRecording: () => Promise<void>;
  stopAndRecognize: () => Promise<string | null>;
}

/** Float32 → Int16 PCM (little-endian) */
function float32ToInt16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return int16;
}

export function useMicInput(): UseMicInputReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  const cleanup = useCallback(() => {
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    audioCtxRef.current?.close();
    processorRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true },
      });
      streamRef.current = stream;

      // Force 16kHz context
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // ScriptProcessorNode to capture raw PCM
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      chunksRef.current = [];

      processor.onaudioprocess = (e) => {
        const data = e.inputBuffer.getChannelData(0);
        chunksRef.current.push(new Float32Array(data));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

      setIsRecording(true);
    } catch {
      setError('无法访问麦克风');
    }
  }, []);

  const stopAndRecognize = useCallback(async (): Promise<string | null> => {
    if (!audioCtxRef.current) return null;

    // Collect all PCM data
    const chunks = chunksRef.current;
    const totalLength = chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    cleanup();
    setIsRecording(false);

    if (totalLength === 0) {
      setError('未录到音频');
      return null;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const int16 = float32ToInt16(merged);
      const buffer = int16.buffer as ArrayBuffer;
      const result = await tencentCloudVoiceService.recognizeSpeech(buffer);
      return result?.text ?? null;
    } catch {
      setError('语音识别失败');
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, [cleanup]);

  return { isRecording, isProcessing, error, startRecording, stopAndRecognize };
}
