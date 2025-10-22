import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

// 语音识别配置接口
export interface STTConfig {
  provider: 'openai' | 'azure' | 'google' | 'whisper';
  apiKey?: string;
  language: string;
  model?: string;
  enablePunctuation?: boolean;
  enableTimestamps?: boolean;
}

// 语音合成配置接口
export interface TTSConfig {
  provider: 'openai' | 'azure' | 'google' | 'elevenlabs';
  apiKey?: string;
  voice: string;
  language: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  enableSSML?: boolean;
}

// 语音识别结果接口
export interface STTResult {
  text: string;
  confidence: number;
  language: string;
  duration: number;
  timestamp: number;
  words?: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;
}

// 语音合成结果接口
export interface TTSResult {
  audioData: ArrayBuffer;
  text: string;
  duration: number;
  voice: string;
  timestamp: number;
}

// 语音服务状态接口
export interface VoiceServiceStatus {
  stt: {
    enabled: boolean;
    provider: string;
    status: 'idle' | 'processing' | 'error';
    lastError?: string;
  };
  tts: {
    enabled: boolean;
    provider: string;
    status: 'idle' | 'processing' | 'error';
    lastError?: string;
  };
}

/**
 * 语音服务类
 * 提供语音识别(ASR)和语音合成(TTS)功能，通过Tauri与Rust后端通信
 */
export class VoiceService {
  private static instance: VoiceService;
  private sttConfig: STTConfig;
  private ttsConfig: TTSConfig;
  private status: VoiceServiceStatus;

  constructor() {
    this.sttConfig = {
      provider: 'openai',
      language: 'zh-CN',
      enablePunctuation: true,
      enableTimestamps: false
    };

    this.ttsConfig = {
      provider: 'openai',
      voice: 'alloy',
      language: 'zh-CN',
      speed: 1.0,
      pitch: 1.0,
      volume: 1.0
    };

    this.status = {
      stt: {
        enabled: false,
        provider: this.sttConfig.provider,
        status: 'idle'
      },
      tts: {
        enabled: false,
        provider: this.ttsConfig.provider,
        status: 'idle'
      }
    };
  }

  /**
   * 获取语音服务单例
   */
  static getInstance(): VoiceService {
    if (!VoiceService.instance) {
      VoiceService.instance = new VoiceService();
    }
    return VoiceService.instance;
  }

  /**
   * 配置语音识别
   */
  configureSTT(config: Partial<STTConfig>): void {
    this.sttConfig = { ...this.sttConfig, ...config };
    this.status.stt.provider = config.provider || this.sttConfig.provider;
    console.log('STT配置已更新:', this.sttConfig);
  }

  /**
   * 配置语音合成
   */
  configureTTS(config: Partial<TTSConfig>): void {
    this.ttsConfig = { ...this.ttsConfig, ...config };
    this.status.tts.provider = config.provider || this.ttsConfig.provider;
    console.log('TTS配置已更新:', this.ttsConfig);
  }

  /**
   * 开始语音识别
   */
  async startSpeechRecognition(): Promise<boolean> {
    try {
      this.status.stt.status = 'processing';
      this.status.stt.lastError = undefined;

      const result = await invoke<boolean>('start_asr', {
        config: this.sttConfig
      });

      this.status.stt.enabled = result;
      this.status.stt.status = result ? 'idle' : 'error';

      if (!result) {
        this.status.stt.lastError = '启动语音识别失败';
      }

      console.log('语音识别启动结果:', result);
      return result;

    } catch (error: any) {
      this.status.stt.status = 'error';
      this.status.stt.lastError = error.message;
      console.error('启动语音识别失败:', error);
      return false;
    }
  }

  /**
   * 停止语音识别
   */
  async stopSpeechRecognition(): Promise<STTResult | null> {
    try {
      this.status.stt.status = 'processing';

      const result = await invoke<STTResult>('stop_asr');

      this.status.stt.status = 'idle';
      this.status.stt.enabled = false;

      console.log('语音识别结果:', result);
      return result;

    } catch (error: any) {
      this.status.stt.status = 'error';
      this.status.stt.lastError = error.message;
      console.error('停止语音识别失败:', error);
      return null;
    }
  }

  /**
   * 语音文本转语音
   */
  async textToSpeech(text: string, options?: Partial<TTSConfig>): Promise<TTSResult | null> {
    try {
      this.status.tts.status = 'processing';
      this.status.tts.lastError = undefined;

      // 合并配置
      const finalConfig = { ...this.ttsConfig, ...options };

      const result = await invoke<TTSResult>('text_to_speech', {
        text,
        config: finalConfig
      });

      this.status.tts.status = 'idle';

      console.log('语音合成完成，时长:', result.duration, 'ms');
      return result;

    } catch (error: any) {
      this.status.tts.status = 'error';
      this.status.tts.lastError = error.message;
      console.error('语音合成失败:', error);
      return null;
    }
  }

  /**
   * 检查语音服务状态
   */
  getStatus(): VoiceServiceStatus {
    return { ...this.status };
  }

  /**
   * 获取STT配置
   */
  getSTTConfig(): STTConfig {
    return { ...this.sttConfig };
  }

  /**
   * 获取TTS配置
   */
  getTTSConfig(): TTSConfig {
    return { ...this.ttsConfig };
  }

  /**
   * 测试语音识别
   */
  async testSTT(audioData: ArrayBuffer): Promise<STTResult | null> {
    try {
      const result = await invoke<STTResult>('test_asr', {
        audioData: Array.from(new Uint8Array(audioData))
      });

      console.log('STT测试结果:', result);
      return result;

    } catch (error: any) {
      console.error('STT测试失败:', error);
      return null;
    }
  }

  /**
   * 测试语音合成
   */
  async testTTS(text: string = '这是一个语音合成测试'): Promise<TTSResult | null> {
    try {
      const result = await this.textToSpeech(text);
      console.log('TTS测试结果:', result);
      return result;

    } catch (error: any) {
      console.error('TTS测试失败:', error);
      return null;
    }
  }
}

// 导出单例实例
export const voiceService = VoiceService.getInstance();

// Hook封装
export const useVoiceService = () => {
  const [status, setStatus] = useState<VoiceServiceStatus>(voiceService.getStatus());

  // 定期更新状态
  useEffect(() => {
    const interval = setInterval(() => {
      setStatus(voiceService.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    status,
    configureSTT: voiceService.configureSTT.bind(voiceService),
    configureTTS: voiceService.configureTTS.bind(voiceService),
    startSpeechRecognition: voiceService.startSpeechRecognition.bind(voiceService),
    stopSpeechRecognition: voiceService.stopSpeechRecognition.bind(voiceService),
    textToSpeech: voiceService.textToSpeech.bind(voiceService),
    testSTT: voiceService.testSTT.bind(voiceService),
    testTTS: voiceService.testTTS.bind(voiceService),
    getSTTConfig: voiceService.getSTTConfig.bind(voiceService),
    getTTSConfig: voiceService.getTTSConfig.bind(voiceService)
  };
};