import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, Square, Volume2, Clock, AlertCircle, Settings, TestTube, Loader2, MessageCircle, VolumeX, Brain } from 'lucide-react';
import { tencentCloudVoiceService, TencentASRConfig, TencentTTSConfig } from '../../lib/ai/TencentCloudVoiceService';
import { aiService, useAIService } from '../../lib/ai/AIService';
import { VoiceInteractionTester } from './VoiceInteractionTester';
import { logDebugInfo } from '../../utils/debugHelper';

// 动态导入invoke函数以避免模块加载问题
let invoke: any = null;

// 初始化invoke函数
const initInvoke = async () => {
  if (!invoke) {
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    invoke = tauriInvoke;
  }
  return invoke;
};

// Live2D语音交互状态
interface Live2DVoiceState {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  volumeLevel: number;
  error: string | null;
  // ASR相关
  lastRecognizedText: string;
  asrHistory: Array<{
    id: number;
    text: string;
    confidence: number;
    timestamp: Date;
    audioDuration: number;
  }>;
  // TTS相关
  ttsHistory: Array<{
    id: number;
    text: string;
    voiceType: number;
    duration: number;
    timestamp: Date;
    audioUrl?: string;
  }>;
  // Live2D状态
  isModelSpeaking: boolean;
  currentExpression: string;
  lipSyncData: Array<{
    time: number;
    openness: number;
  }>;
}

/**
 * Live2D语音交互组件
 * 集成语音识别、合成和Live2D模型互动
 */
export const Live2DVoiceInteraction: React.FC = () => {
  // AI服务Hook
  const { generateResponse, checkAvailability, getConfig } = useAIService();

  // 本地状态
  const [voiceState, setVoiceState] = useState<Live2DVoiceState>({
    isRecording: false,
    isProcessing: false,
    duration: 0,
    volumeLevel: 0,
    error: null,
    lastRecognizedText: '',
    asrHistory: [],
    ttsHistory: [],
    isModelSpeaking: false,
    currentExpression: 'normal',
    lipSyncData: []
  });

  const [showSettings, setShowSettings] = useState(false);
  const [testMode, setTestMode] = useState(false);
  const [aiAvailable, setAiAvailable] = useState<boolean>(false);
  const [aiConfig, setAiConfig] = useState(getConfig());

  // 音频相关引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // 腾讯云服务配置
  const [asrConfig, setAsrConfig] = useState<TencentASRConfig>(tencentCloudVoiceService.getASRConfig());
  const [ttsConfig, setTtsConfig] = useState<TencentTTSConfig>(tencentCloudVoiceService.getTTSConfig());

  // 初始化AI服务状态检查
  useEffect(() => {
    const initializeAI = async () => {
      try {
        console.log('🔧 初始化AI服务...');
        const available = await checkAvailability();
        setAiAvailable(available);

        if (available) {
          console.log('✅ AI服务可用');
        } else {
          console.log('⚠️ AI服务不可用，将使用本地回复');
        }
      } catch (error) {
        console.error('❌ AI服务初始化失败:', error);
        setAiAvailable(false);
      }
    };

    initializeAI();
  }, [checkAvailability]);

  // 定期检查AI服务状态
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const available = await checkAvailability();
        setAiAvailable(available);
      } catch (error) {
        console.warn('AI服务状态检查失败:', error);
      }
    }, 30000); // 每30秒检查一次

    return () => clearInterval(interval);
  }, [checkAvailability]);

  // 初始化时输出调试信息
  useEffect(() => {
    if (import.meta.env.DEV) {
      logDebugInfo();
    }
  }, []);

  // Live2D控制函数
  const triggerLive2DExpression = useCallback(async (expression: string) => {
    // 发送表情变化事件到Live2D窗口
    const live2dWindow = window.open('', 'live2d') || window;
    if (live2dWindow && !live2dWindow.closed) {
      live2dWindow.postMessage({
        type: 'expression',
        expression: expression,
        timestamp: Date.now()
      }, '*');
    }

    // 通过Tauri发送事件（异步，不等待结果）
    try {
      const invokeFn = await initInvoke();
      invokeFn('trigger_live2d_expression', { expression }).catch(error => {
        console.warn('Live2D表情触发失败:', error);
      });
    } catch (error) {
      console.warn('Tauri invoke初始化失败:', error);
    }
  }, []);

  const triggerLive2DLipSync = useCallback(async (text: string, audioData: ArrayBuffer) => {
    // 生成简单的口型同步数据
    const words = text.split(' ');
    const lipSyncData = words.map((word, index) => ({
      time: index * 200, // 每个词200ms
      openness: word.length > 0 ? Math.min(1, word.length / 5) : 0
    }));

    // 发送口型同步数据到Live2D窗口
    const live2dWindow = window.open('', 'live2d') || window;
    if (live2dWindow && !live2dWindow.closed) {
      live2dWindow.postMessage({
        type: 'lip_sync',
        data: lipSyncData,
        text: text,
        timestamp: Date.now()
      }, '*');
    }

    // 通过Tauri发送事件（异步，不等待结果）
    try {
      const invokeFn = await initInvoke();
      invokeFn('trigger_live2d_lip_sync', {
        text,
        lipSyncData
      }).catch(error => {
        console.warn('Live2D口型同步失败:', error);
      });
    } catch (error) {
      console.warn('Tauri invoke初始化失败:', error);
    }

    setVoiceState(prev => ({
      ...prev,
      lipSyncData: lipSyncData
    }));
  }, []);

  const triggerLive2DMotion = useCallback(async (motion: string) => {
    // 发送动作事件到Live2D窗口
    const live2dWindow = window.open('', 'live2d') || window;
    if (live2dWindow && !live2dWindow.closed) {
      live2dWindow.postMessage({
        type: 'motion',
        motion: motion,
        timestamp: Date.now()
      }, '*');
    }

    // 通过Tauri发送事件（异步，不等待结果）
    try {
      const invokeFn = await initInvoke();
      invokeFn('trigger_live2d_motion', { motion }).catch(error => {
        console.warn('Live2D动作触发失败:', error);
      });
    } catch (error) {
      console.warn('Tauri invoke初始化失败:', error);
    }
  }, []);

  // 处理开始录音
  const handleStartRecording = useCallback(async () => {
    console.log('🎙️ 开始录音...');

    try {
      // 检查腾讯云配置
      if (!tencentCloudVoiceService.isConfigured()) {
        throw new Error('腾讯云语音服务未配置，请检查配置信息');
      }

      // 触发Live2D录音表情
      await triggerLive2DExpression('listening');
      await triggerLive2DMotion('start_listening');

      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: asrConfig.sampleRate,
          channelCount: asrConfig.channelNum,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      // 初始化音频数据存储
      audioChunksRef.current = [];
      streamRef.current = stream;
      mediaRecorderRef.current = mediaRecorder;

      // 设置录音事件处理
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = async (event) => {
        console.error('录制错误:', event);
        setVoiceState(prev => ({
          ...prev,
          error: '录制过程中发生错误',
          isRecording: false,
          isProcessing: false
        }));
        await triggerLive2DExpression('normal');
      };

      // 开始录音
      mediaRecorder.start(100);

      setVoiceState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null,
        duration: 0,
        volumeLevel: 0
      }));

      console.log('✅ 录音已开始');

      // 监测音量和实时音量可视化
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContextRef.current.createAnalyser();
      const microphone = audioContextRef.current.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);

      const volumeInterval = setInterval(async () => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const volumeLevel = Math.min(100, (volume / 255) * 100 * 2);

        setVoiceState(prev => ({
          ...prev,
          volumeLevel: volumeLevel,
          duration: prev.duration + 100
        }));

        // 实时音量触发Live2D反应
        if (volumeLevel > 30) {
          await triggerLive2DExpression('speaking');
        }
      }, 100);

      // 存储清理函数
      (window as any).cleanupRecording = () => {
        clearInterval(volumeInterval);
        microphone.disconnect();
        if (audioContextRef.current) {
          audioContextRef.current.close();
        }
      };

    } catch (error: any) {
      console.error('❌ 开始录音失败:', error);
      setVoiceState(prev => ({
        ...prev,
        error: error.message || '无法访问麦克风',
        isRecording: false,
        isProcessing: false
      }));
      await triggerLive2DExpression('normal');
    }
  }, [asrConfig, triggerLive2DExpression, triggerLive2DMotion]);

  // 处理停止录音
  const handleStopRecording = useCallback(async () => {
    console.log('⏹️ 停止录音...');

    if (!mediaRecorderRef.current) {
      console.error('❌ 录音器未初始化');
      return;
    }

    setVoiceState(prev => ({
      ...prev,
      isProcessing: true
    }));
    await triggerLive2DExpression('thinking');

    try {
      // 停止MediaRecorder
      mediaRecorderRef.current.stop();

      // 停止所有音轨
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      // 等待最后的dataavailable事件
      await new Promise<void>((resolve) => {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.onstop = () => resolve();
        } else {
          resolve();
        }
      });

      // 创建音频Blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      const audioBuffer = await audioBlob.arrayBuffer();

      // 执行ASR识别
      console.log('🔍 开始语音识别...');
      const asrResult = await tencentCloudVoiceService.recognizeSpeech(audioBuffer);

      if (asrResult && asrResult.text.trim()) {
        console.log('✅ 识别结果:', asrResult.text);

        // 添加ASR历史记录
        const asrRecord = {
          id: Date.now(),
          text: asrResult.text,
          confidence: asrResult.confidence,
          timestamp: new Date(),
          audioDuration: voiceState.duration
        };

        setVoiceState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          asrHistory: [asrRecord, ...prev.asrHistory].slice(0, 10),
          lastRecognizedText: asrResult.text,
          duration: 0,
          volumeLevel: 0
        }));

        // 生成AI回复并执行TTS
        await generateAIResponseAndTTS(asrResult.text);

      } else {
        console.log('⚠️ 语音识别未返回结果');
        setVoiceState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          lastRecognizedText: '(识别失败)',
          duration: 0,
          volumeLevel: 0
        }));
        await triggerLive2DExpression('normal');
      }

    } catch (error: any) {
      console.error('❌ 停止录音失败:', error);
      setVoiceState(prev => ({
        ...prev,
        error: error.message || '停止录音时发生错误',
        isRecording: false,
        isProcessing: false
      }));
      await triggerLive2DExpression('normal');
    } finally {
      // 清理资源
      if ((window as any).cleanupRecording) {
        (window as any).cleanupRecording();
        delete (window as any).cleanupRecording;
      }

      mediaRecorderRef.current = null;
      streamRef.current = null;
      audioChunksRef.current = [];

      console.log('✅ 录音处理完成');
    }
  }, [voiceState.duration, triggerLive2DExpression]);

  // 生成AI回复并执行TTS
  const generateAIResponseAndTTS = useCallback(async (userText: string) => {
    try {
      console.log('🤖 开始AI回复生成...');
      console.log('📝 用户输入:', userText);

      // 显示思考状态
      await triggerLive2DExpression('thinking');

      // 使用AI大模型生成回复
      const aiResponse = await generateResponse(userText);

      console.log('🤖 AI回复:', aiResponse.text);

      // 根据回复内容触发相应的表情
      const responseText = aiResponse.text.toLowerCase();
      if (responseText.includes('你好') || responseText.includes('hi') || responseText.includes('hello')) {
        await triggerLive2DExpression('happy');
      } else if (responseText.includes('再见') || responseText.includes('拜拜')) {
        await triggerLive2DExpression('waving');
      } else if (responseText.includes('😊') || responseText.includes('开心') || responseText.includes('高兴')) {
        await triggerLive2DExpression('happy');
      } else if (responseText.includes('🥰') || responseText.includes('喜欢') || responseText.includes('爱')) {
        await triggerLive2DExpression('shy');
      } else if (responseText.includes('🤔') || responseText.includes('想想') || responseText.includes('思考')) {
        await triggerLive2DExpression('thinking');
      } else {
        await triggerLive2DExpression('normal');
      }

      // 执行TTS合成
      console.log('🔊 开始语音合成...');
      const ttsResult = await tencentCloudVoiceService.synthesizeSpeech(aiResponse.text);

      if (ttsResult) {
        console.log('✅ 语音合成完成');

        // 添加TTS历史记录
        const ttsRecord = {
          id: Date.now(),
          text: aiResponse.text,
          voiceType: ttsConfig.voiceType,
          duration: ttsResult.duration,
          timestamp: new Date(),
          audioUrl: URL.createObjectURL(new Blob([ttsResult.audioData], { type: 'audio/wav' }))
        };

        setVoiceState(prev => ({
          ...prev,
          ttsHistory: [ttsRecord, ...prev.ttsHistory].slice(0, 10)
        }));

        // 触发Live2D说话状态和口型同步
        setVoiceState(prev => ({
          ...prev,
          isModelSpeaking: true
        }));

        await triggerLive2DMotion('start_speaking');
        await triggerLive2DLipSync(aiResponse.text, ttsResult.audioData);

        // 播放音频
        await playAudioWithLive2D(ttsResult.audioData, aiResponse.text);

      } else {
        console.log('❌ 语音合成失败');
        await triggerLive2DExpression('confused');
      }

    } catch (error: any) {
      console.error('❌ AI回复生成失败:', error);
      await triggerLive2DExpression('confused');
    }
  }, [ttsConfig, triggerLive2DExpression, triggerLive2DMotion, triggerLive2DLipSync]);

  // 播放音频并同步Live2D
  const playAudioWithLive2D = async (audioData: ArrayBuffer, text: string) => {
    try {
      const audio = new Audio();
      const audioUrl = URL.createObjectURL(new Blob([audioData], { type: 'audio/wav' }));
      audio.src = audioUrl;
      currentAudioRef.current = audio;

      // 音频开始播放
      audio.addEventListener('play', () => {
        console.log('🔊 Live2D开始说话');
        triggerLive2DExpression('speaking');
      });

      // 音频结束播放
      audio.addEventListener('ended', () => {
        console.log('🔊 Live2D停止说话');
        setVoiceState(prev => ({
          ...prev,
          isModelSpeaking: false
        }));
        triggerLive2DExpression('normal');
        triggerLive2DMotion('stop_speaking');

        // 清理URL
        URL.revokeObjectURL(audioUrl);
      });

      audio.addEventListener('error', (error) => {
        console.error('❌ 音频播放失败:', error);
        setVoiceState(prev => ({
          ...prev,
          isModelSpeaking: false
        }));
        triggerLive2DExpression('confused');
      });

      await audio.play();

    } catch (error) {
      console.error('❌ 音频播放失败:', error);
      setVoiceState(prev => ({
        ...prev,
        isModelSpeaking: false
      }));
      await triggerLive2DExpression('confused');
    }
  };

  // 测试TTS功能
  const handleTestTTS = useCallback(async () => {
    console.log('🧪 测试TTS功能...');

    try {
      const testText = '你好！这是一个语音合成测试，我将为你演示Live2D模型的口型同步功能。';
      const ttsResult = await tencentCloudVoiceService.synthesizeSpeech(testText);

      if (ttsResult) {
        console.log('✅ TTS测试成功');

        // 添加TTS历史记录
        const ttsRecord = {
          id: Date.now(),
          text: testText,
          voiceType: ttsConfig.voiceType,
          duration: ttsResult.duration,
          timestamp: new Date(),
          audioUrl: URL.createObjectURL(new Blob([ttsResult.audioData], { type: 'audio/wav' }))
        };

        setVoiceState(prev => ({
          ...prev,
          ttsHistory: [ttsRecord, ...prev.ttsHistory].slice(0, 10)
        }));

        // 触发Live2D说话
        setVoiceState(prev => ({
          ...prev,
          isModelSpeaking: true
        }));

        await triggerLive2DExpression('happy');
        await triggerLive2DMotion('start_speaking');
        await triggerLive2DLipSync(testText, ttsResult.audioData);

        // 播放音频
        await playAudioWithLive2D(ttsResult.audioData, testText);

      } else {
        console.log('❌ TTS测试失败');
        await triggerLive2DExpression('confused');
      }
    } catch (error: any) {
      console.error('❌ TTS测试异常:', error);
      await triggerLive2DExpression('confused');
    }
  }, [ttsConfig, triggerLive2DExpression, triggerLive2DMotion, triggerLive2DLipSync]);

  // 停止当前播放
  const handleStopPlayback = useCallback(async () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current = null;
    }

    setVoiceState(prev => ({
      ...prev,
      isModelSpeaking: false
    }));

    await triggerLive2DExpression('normal');
    await triggerLive2DMotion('stop_speaking');
  }, [triggerLive2DExpression, triggerLive2DMotion]);

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString();
  };

  // 格式化时长
  const formatDuration = (milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="live2d-voice-interaction bg-gradient-to-br from-purple-50 to-blue-50 min-h-screen">
      <div className="max-w-6xl mx-auto p-6">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 flex items-center justify-center gap-3">
            <Volume2 className="text-purple-600" />
            Live2D语音交互
            <Volume2 className="text-purple-600" />
          </h1>
          <p className="text-gray-600">与Live2D模型进行语音对话，支持实时口型同步</p>
        </div>

        {/* Live2D状态指示器 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-center space-x-8">
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-all duration-300 ${
                voiceState.isModelSpeaking
                  ? 'bg-green-500 animate-pulse'
                  : 'bg-gray-300'
              }`}>
                <Volume2 className="w-8 h-8 text-white" />
              </div>
              <p className="mt-2 text-sm font-medium text-gray-700">
                {voiceState.isModelSpeaking ? '模型说话中' : '模型待机'}
              </p>
            </div>

            <div className="text-center">
              <div className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                voiceState.currentExpression === 'happy' ? 'bg-yellow-100 text-yellow-700' :
                voiceState.currentExpression === 'listening' ? 'bg-blue-100 text-blue-700' :
                voiceState.currentExpression === 'speaking' ? 'bg-green-100 text-green-700' :
                'bg-gray-100 text-gray-700'
              }`}>
                表情: {voiceState.currentExpression}
              </div>
            </div>

            {voiceState.isModelSpeaking && (
              <button
                onClick={handleStopPlayback}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                停止播放
              </button>
            )}
          </div>
        </div>

        {/* 主要控制区域 */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex flex-col items-center space-y-6">

            {/* 录音按钮 */}
            <button
              onClick={voiceState.isRecording ? handleStopRecording : handleStartRecording}
              disabled={voiceState.isProcessing || voiceState.isModelSpeaking}
              className={`w-32 h-32 rounded-full flex items-center justify-center transition-all duration-300 ${
                voiceState.isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : voiceState.isProcessing || voiceState.isModelSpeaking
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600'
              }`}
            >
              {voiceState.isRecording ? (
                <Square size={40} className="text-white" />
              ) : (
                <Mic size={40} className="text-white" />
              )}
            </button>

            {/* 状态指示器 */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className={`w-4 h-4 rounded-full ${
                  voiceState.isRecording ? 'bg-red-500 animate-pulse' :
                  voiceState.isProcessing ? 'bg-yellow-500 animate-pulse' :
                  'bg-gray-400'
                }`} />
                <span className="text-xl font-medium text-gray-700">
                  {voiceState.isRecording ? '录音中...' :
                   voiceState.isProcessing ? '处理中...' :
                   voiceState.isModelSpeaking ? '模型说话中...' :
                   '点击开始录音'}
                </span>
              </div>

              {/* 录音状态信息 */}
              {voiceState.isRecording && (
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{formatDuration(voiceState.duration)}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Volume2 className="w-4 h-4" />
                    <span>{Math.round(voiceState.volumeLevel)}%</span>
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {voiceState.error && (
                <div className="flex items-center justify-center space-x-1 text-red-500 text-sm mt-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{voiceState.error}</span>
                </div>
              )}
            </div>

            {/* 实时音量指示器 */}
            <div className="w-full max-w-md">
              <div className="h-6 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-100"
                  style={{ width: `${voiceState.volumeLevel}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-1">音量级别</p>
            </div>
          </div>
        </div>

        {/* 调试控制 */}
        <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">调试控制</h2>
            <button
              onClick={() => setTestMode(!testMode)}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                testMode
                  ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TestTube className="w-4 h-4 inline mr-1" />
              测试模式
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={handleTestTTS}
              disabled={voiceState.isModelSpeaking}
              className="px-4 py-3 bg-gradient-to-r from-green-500 to-teal-500 text-white rounded-lg hover:from-green-600 hover:to-teal-600 transition-all font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Volume2 className="w-5 h-5 inline mr-2" />
              测试语音合成 + 口型同步
            </button>

            <button
              onClick={async () => await triggerLive2DExpression('happy')}
              className="px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all font-medium"
            >
              😊 测试表情
            </button>
          </div>

          {/* 调试信息 */}
          <div className="border-t pt-4">
            <h3 className="text-lg font-semibold mb-3">系统调试信息</h3>
            <div className="grid grid-cols-1 gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">TencentCloud 配置状态:</span>
                <span className={`font-medium ${tencentCloudVoiceService.isConfigured() ? 'text-green-600' : 'text-red-600'}`}>
                  {tencentCloudVoiceService.isConfigured() ? '✅ 已配置' : '❌ 未配置'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">环境变量 SecretId:</span>
                <span className="font-medium text-blue-600">
                  {import.meta.env.VITE_TENCENT_SECRET_ID ? '✅ 已加载' : '❌ 未加载'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">环境变量 SecretKey:</span>
                <span className="font-medium text-blue-600">
                  {import.meta.env.VITE_TENCENT_SECRET_KEY ? '✅ 已加载' : '❌ 未加载'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">环境变量 AppId:</span>
                <span className="font-medium text-blue-600">
                  {import.meta.env.VITE_TENCENT_APP_ID ? '✅ 已加载' : '❌ 未加载'}
                </span>
              </div>
            </div>
          </div>

          {/* 完整流程测试 */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">完整流程测试</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-4">
                测试完整的语音交互流程：录音 → 识别 → AI回复 → 合成 → 口型同步
              </p>
              <VoiceInteractionTester />
            </div>
          </div>

          {/* Tauri 命令测试 */}
          <div className="border-t pt-4 mt-4">
            <h3 className="text-lg font-semibold mb-3">Tauri 命令测试</h3>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={async () => {
                  try {
                    console.log('🧪 测试 Tauri invoke...');
                    console.log('🔧 检查全局对象:', {
                      hasTauri: !!(window as any).__TAURI__,
                      hasTauriCore: !!(window as any).__TAURI__?.core,
                      hasInvoke: !!(window as any).__TAURI__?.core?.invoke,
                      hasTauriInvoke: !!(window as any).__TAURI__?.invoke
                    });

                    // 使用我们修复的动态导入 invoke 函数
                    const { invoke } = await import('@tauri-apps/api/core');
                    console.log('✅ 成功导入 Tauri invoke 函数');

                    // 测试简单命令
                    const result = await invoke('test_invoke');
                    console.log('✅ Tauri invoke 成功:', result);
                    alert(`测试命令成功: ${result}`);
                  } catch (error) {
                    console.error('❌ Tauri invoke 失败:', error);
                    alert(`Tauri invoke 失败: ${error.message}`);
                  }
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                🔧 测试 Tauri Invoke
              </button>

              <button
                onClick={async () => {
                  try {
                    console.log('🔧 初始化腾讯云服务...');
                    const service = tencentCloudVoiceService;
                    console.log('✅ 服务实例:', service);
                    const configured = service.isConfigured();
                    console.log('🔍 配置状态:', configured);
                    const asrConfig = service.getASRConfig();
                    const ttsConfig = service.getTTSConfig();
                    console.log('📊 ASR配置:', asrConfig);
                    console.log('📊 TTS配置:', ttsConfig);
                    alert(`腾讯云服务初始化成功！\n配置状态: ${configured}`);
                  } catch (error) {
                    console.error('❌ 腾讯云服务初始化失败:', error);
                    alert(`腾讯云服务初始化失败: ${error.message}`);
                  }
                }}
                className="px-3 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors text-sm font-medium"
              >
                🎙️ 测试腾讯云服务
              </button>

              <button
                onClick={async () => {
                  try {
                    console.log('🧪 测试腾讯云 TTS 命令...');
                    const { invoke } = await import('@tauri-apps/api/core');
                    console.log('✅ 找到 Tauri invoke 函数');

                    // 使用真实的腾讯云配置进行测试
                    const result = await invoke('tencent_tts', {
                      config: {
                        secretId: import.meta.env.VITE_TENCENT_SECRET_ID || '',
                        secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY || '',
                        region: import.meta.env.VITE_TENCENT_REGION || 'ap-beijing',
                        appId: import.meta.env.VITE_TENCENT_APP_ID || '',
                        voiceType: 1001,
                        volume: 1.0,
                        speed: 1.0,
                        pitch: 0.0,
                        sampleRate: 16000
                      },
                      text: '这是一个语音合成测试'
                    });
                    console.log('✅ TTS命令测试成功:', result);
                    const ttsResult = result as { audioData?: { length?: number } };
                    alert(`TTS命令测试成功！音频大小: ${ttsResult.audioData?.length || 0} bytes`);
                  } catch (error: any) {
                    console.error('❌ TTS命令测试失败:', error);
                    alert(`TTS命令测试失败: ${error.message}`);
                  }
                }}
                className="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm font-medium"
              >
                🔊 测试 TTS 命令
              </button>

              <button
                onClick={async () => {
                  try {
                    console.log('🧪 测试腾讯云 ASR 命令...');
                    const { invoke } = await import('@tauri-apps/api/core');
                    console.log('✅ 找到 Tauri invoke 函数');

                    // 创建一个小的测试音频数据 (模拟1秒的静音音频)
                    const testAudioData = new Array(16000).fill(0); // 16kHz采样率，1秒静音

                    const result = await invoke('tencent_asr', {
                      config: {
                        secretId: import.meta.env.VITE_TENCENT_SECRET_ID || '',
                        secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY || '',
                        region: import.meta.env.VITE_TENCENT_REGION || 'ap-beijing',
                        appId: import.meta.env.VITE_TENCENT_APP_ID || '',
                        engineModelType: '16k_zh',
                        channelNum: 1,
                        sampleRate: 16000
                      },
                      audioData: testAudioData
                    });
                    console.log('✅ ASR命令测试成功:', result);
                    const asrResult = result as { text?: string };
                    alert(`ASR命令测试成功！识别结果: ${asrResult.text || '(无内容)'}`);
                  } catch (error: any) {
                    console.error('❌ ASR命令测试失败:', error);
                    alert(`ASR命令测试失败: ${error.message}`);
                  }
                }}
                className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm font-medium"
              >
                🎙️ 测试 ASR 命令
              </button>
            </div>
          </div>
        </div>

        {/* 识别结果 */}
        {voiceState.lastRecognizedText && (
          <div className="bg-blue-50 rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-lg font-semibold mb-3 text-blue-700">最新识别结果</h3>
            <p className="text-gray-700">{voiceState.lastRecognizedText}</p>
          </div>
        )}

        {/* 服务状态 */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold mb-4">服务状态</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">腾讯云配置:</span>
              <span className={`ml-1 ${tencentCloudVoiceService.isConfigured() ? 'text-green-600' : 'text-red-600'}`}>
                {tencentCloudVoiceService.isConfigured() ? '✅ 已配置' : '❌ 未配置'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">Live2D集成:</span>
              <span className="ml-1 text-purple-600">✅ 已启用</span>
            </div>
            <div>
              <span className="text-gray-500">AI大模型:</span>
              <span className={`ml-1 flex items-center ${aiAvailable ? 'text-green-600' : 'text-yellow-600'}`}>
                <Brain className="w-4 h-4 mr-1" />
                {aiAvailable ? '✅ ' + aiConfig.provider : '⚠️ 本地回复'}
              </span>
            </div>
            <div>
              <span className="text-gray-500">当前模型:</span>
              <span className="ml-1 text-blue-600 font-mono text-xs">
                {aiConfig.model}
              </span>
            </div>
            <div>
              <span className="text-gray-500">ASR服务:</span>
              <span className="ml-1 text-blue-600">腾讯云语音识别</span>
            </div>
            <div>
              <span className="text-gray-500">TTS服务:</span>
              <span className="ml-1 text-green-600">腾讯云语音合成</span>
            </div>
          </div>

          {/* AI服务详情 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">AI服务详情</span>
              <div className={`w-2 h-2 rounded-full ${aiAvailable ? 'bg-green-500' : 'bg-yellow-500'} animate-pulse`} />
            </div>
            <div className="text-xs text-gray-500 space-y-1">
              <div>提供商: {aiConfig.provider}</div>
              <div>模型: {aiConfig.model}</div>
              {!aiAvailable && (
                <div className="text-yellow-600">
                  💡 提示：启动Ollama服务以获得更好的AI体验
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};