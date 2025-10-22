import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, Square, Volume2, Clock, AlertCircle, Settings, TestTube, Loader2, MessageCircle, VolumeX } from 'lucide-react';
import { tencentCloudVoiceService, TencentASRConfig, TencentTTSConfig } from '../../lib/ai/TencentCloudVoiceService';

// 语音交互状态
interface VoiceInteractionState {
  isRecording: boolean;
  isProcessing: boolean;
  duration: number;
  volumeLevel: number;
  error: string | null;
  recordingHistory: Array<{
    id: number;
    duration: number;
    volumeLevel: number;
    timestamp: Date;
    status: 'success' | 'error';
  }>;
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
  // 对话历史
  conversationHistory: Array<{
    id: number;
    type: 'user' | 'assistant';
    text: string;
    timestamp: Date;
    audioData?: ArrayBuffer;
    confidence?: number;
  }>;
}

/**
 * 语音交互演示组件
 * 展示完整的语音录制、识别、合成、Live2D表情联动流程
 */
export const VoiceInteractionDemo: React.FC = () => {
  // 本地状态
  const [interactionState, setInteractionState] = useState<VoiceInteractionState>({
    isRecording: false,
    isProcessing: false,
    duration: 0,
    volumeLevel: 0,
    error: null,
    recordingHistory: [],
    lastRecognizedText: '',
    asrHistory: [],
    ttsHistory: [],
    conversationHistory: []
  });

  const [showSettings, setShowSettings] = useState(false);
  const [testMode, setTestMode] = useState(false);

  // 音频相关引用
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 腾讯云服务配置
  const [asrConfig, setAsrConfig] = useState<TencentASRConfig>(tencentCloudVoiceService.getASRConfig());
  const [ttsConfig, setTtsConfig] = useState<TencentTTSConfig>(tencentCloudVoiceService.getTTSConfig());

  // 处理开始录音
  const handleStartRecording = useCallback(async () => {
    console.log('🎙️ 开始录音...');

    try {
      // 检查腾讯云配置
      if (!tencentCloudVoiceService.isConfigured()) {
        throw new Error('腾讯云语音服务未配置，请检查配置信息');
      }

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

      mediaRecorder.onerror = (event) => {
        console.error('录制错误:', event);
        setInteractionState(prev => ({
          ...prev,
          error: '录制过程中发生错误',
          isRecording: false,
          isProcessing: false
        }));
      };

      // 开始录音
      mediaRecorder.start(100); // 每100ms收集一次数据

      setInteractionState(prev => ({
        ...prev,
        isRecording: true,
        isProcessing: false,
        error: null,
        duration: 0,
        volumeLevel: 0
      }));

      console.log('✅ 录音已开始');

      // 监测音量
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      microphone.connect(analyser);

      const volumeInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const volumeLevel = Math.min(100, (volume / 255) * 100 * 2);

        setInteractionState(prev => ({
          ...prev,
          volumeLevel: volumeLevel,
          duration: prev.duration + 100
        }));
      }, 100);

      // 存储清理函数
      (window as any).cleanupRecording = () => {
        clearInterval(volumeInterval);
        microphone.disconnect();
        audioContext.close();
      };

    } catch (error: any) {
      console.error('❌ 开始录音失败:', error);
      setInteractionState(prev => ({
        ...prev,
        error: error.message || '无法访问麦克风',
        isRecording: false,
        isProcessing: false
      }));
    }
  }, [asrConfig]);

  // 处理停止录音
  const handleStopRecording = useCallback(async () => {
    console.log('⏹️ 停止录音...');

    if (!mediaRecorderRef.current) {
      console.error('❌ 录音器未初始化');
      return;
    }

    setInteractionState(prev => ({
      ...prev,
      isProcessing: true
    }));

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

      // 添加录音记录
      const newRecord = {
        id: Date.now(),
        duration: interactionState.duration,
        volumeLevel: interactionState.volumeLevel,
        timestamp: new Date(),
        status: 'success' as const
      };

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
          audioDuration: interactionState.duration
        };

        // 添加对话历史
        const conversationRecord = {
          id: Date.now(),
          type: 'user' as const,
          text: asrResult.text,
          timestamp: new Date(),
          confidence: asrResult.confidence
        };

        setInteractionState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          recordingHistory: [newRecord, ...prev.recordingHistory].slice(0, 10),
          asrHistory: [asrRecord, ...prev.asrHistory].slice(0, 10),
          conversationHistory: [conversationRecord, ...prev.conversationHistory].slice(0, 20),
          lastRecognizedText: asrResult.text,
          duration: 0,
          volumeLevel: 0
        }));

        // 生成AI回复并执行TTS
        await generateAIResponseAndTTS(asrResult.text);

      } else {
        console.log('⚠️ 语音识别未返回结果');
        setInteractionState(prev => ({
          ...prev,
          isRecording: false,
          isProcessing: false,
          recordingHistory: [newRecord, ...prev.recordingHistory].slice(0, 10),
          lastRecognizedText: '(识别失败)',
          duration: 0,
          volumeLevel: 0
        }));
      }

    } catch (error: any) {
      console.error('❌ 停止录音失败:', error);
      setInteractionState(prev => ({
        ...prev,
        error: error.message || '停止录音时发生错误',
        isRecording: false,
        isProcessing: false
      }));
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
  }, [interactionState.duration, interactionState.volumeLevel]);

  // 生成AI回复并执行TTS
  const generateAIResponseAndTTS = useCallback(async (userText: string) => {
    try {
      // 简单的AI回复生成
      const aiResponses = [
        '我明白了，这是一个很有趣的问题！',
        '让我想想该怎么回答你...',
        '听起来很棒！我能为你做些什么呢？',
        '谢谢你的分享，我很高兴能和你聊天。',
        '这个想法很有创意，我喜欢！'
      ];

      // 简单的关键词匹配回复
      const text = userText.toLowerCase();
      let aiResponse = aiResponses[Math.floor(Math.random() * aiResponses.length)];

      if (text.includes('你好') || text.includes('hi')) {
        aiResponse = '你好！很高兴见到你！有什么我可以帮助你的吗？';
      } else if (text.includes('再见') || text.includes('拜拜')) {
        aiResponse = '再见！期待下次和你聊天！';
      } else if (text.includes('天气')) {
        aiResponse = '今天天气很不错，适合出去走走呢！';
      } else if (text.includes('喜欢')) {
        aiResponse = '我也很喜欢和你聊天！你还有什么想说的吗？';
      }

      console.log('🤖 AI回复:', aiResponse);

      // 执行TTS合成
      console.log('🔊 开始语音合成...');
      const ttsResult = await tencentCloudVoiceService.synthesizeSpeech(aiResponse);

      if (ttsResult) {
        console.log('✅ 语音合成完成');

        // 添加TTS历史记录
        const ttsRecord = {
          id: Date.now(),
          text: aiResponse,
          voiceType: ttsConfig.voiceType,
          duration: ttsResult.duration,
          timestamp: new Date(),
          audioUrl: URL.createObjectURL(new Blob([ttsResult.audioData], { type: 'audio/wav' }))
        };

        // 添加对话历史
        const conversationRecord = {
          id: Date.now(),
          type: 'assistant' as const,
          text: aiResponse,
          timestamp: new Date(),
          audioData: ttsResult.audioData
        };

        setInteractionState(prev => ({
          ...prev,
          ttsHistory: [ttsRecord, ...prev.ttsHistory].slice(0, 10),
          conversationHistory: [conversationRecord, ...prev.conversationHistory].slice(0, 20)
        }));

        // 播放音频
        playAudio(ttsResult.audioData);

      } else {
        console.log('❌ 语音合成失败');
      }

    } catch (error: any) {
      console.error('❌ AI回复生成失败:', error);
    }
  }, [ttsConfig]);

  // 播放音频
  const playAudio = async (audioData: ArrayBuffer) => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(audioData);
      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      source.start();

      console.log('🔊 音频播放开始');
    } catch (error) {
      console.error('❌ 音频播放失败:', error);
    }
  };

  // 从URL播放音频
  const playAudioFromUrl = async (audioUrl: string) => {
    try {
      const audio = new Audio(audioUrl);
      await audio.play();
      console.log('🔊 音频播放开始 (URL)');
    } catch (error) {
      console.error('❌ 音频播放失败 (URL):', error);
    }
  };

  // 测试TTS功能
  const handleTestTTS = useCallback(async () => {
    console.log('🧪 测试TTS功能...');

    try {
      const testText = '这是一个语音合成测试，检查TTS功能是否正常工作。';
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

        // 添加对话历史
        const conversationRecord = {
          id: Date.now(),
          type: 'assistant' as const,
          text: testText,
          timestamp: new Date(),
          audioData: ttsResult.audioData
        };

        setInteractionState(prev => ({
          ...prev,
          ttsHistory: [ttsRecord, ...prev.ttsHistory].slice(0, 10),
          conversationHistory: [conversationRecord, ...prev.conversationHistory].slice(0, 20)
        }));

        // 播放音频
        await playAudio(ttsResult.audioData);
      } else {
        console.log('❌ TTS测试失败');
      }
    } catch (error: any) {
      console.error('❌ TTS测试异常:', error);
    }
  }, [ttsConfig]);

  // 测试基础功能
  const handleTestBasic = useCallback(() => {
    console.log('🧪 测试基础功能...');

    // 模拟测试录音
    const testRecord = {
      id: Date.now(),
      duration: 3000,
      volumeLevel: 75,
      timestamp: new Date(),
      status: 'success' as const
    };

    setInteractionState(prev => ({
      ...prev,
      recordingHistory: [testRecord, ...prev.recordingHistory].slice(0, 10)
    }));

    console.log('✅ 基础功能测试完成');
  }, []);

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
  }; // Fixed formatDuration function

  return (
    <div className="voice-interaction-demo bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto p-6">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">语音交互演示</h1>
          <p className="text-gray-600">测试语音录制和识别功能</p>
        </div>

        {/* 主要控制区域 */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex flex-col items-center space-y-6">

            {/* 录音按钮 */}
            <button
              onClick={interactionState.isRecording ? handleStopRecording : handleStartRecording}
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300 ${
                interactionState.isRecording
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-blue-500 hover:bg-blue-600'
              }`}
            >
              {interactionState.isRecording ? (
                <Square size={32} className="text-white" />
              ) : (
                <Mic size={32} className="text-white" />
              )}
            </button>

            {/* 状态指示器 */}
            <div className="text-center">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  interactionState.isRecording ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
                }`} />
                <span className="text-lg font-medium text-gray-700">
                  {interactionState.isRecording ? '录音中...' : '点击开始录音'}
                </span>
              </div>

              {/* 录音状态信息 */}
              {interactionState.isRecording && (
                <div className="flex items-center justify-center space-x-6 text-sm text-gray-600">
                  <div className="flex items-center space-x-1">
                    <Clock className="w-4 h-4" />
                    <span className="font-mono">{formatDuration(interactionState.duration)}</span>
                  </div>

                  <div className="flex items-center space-x-1">
                    <Volume2 className="w-4 h-4" />
                    <span>{Math.round(interactionState.volumeLevel)}%</span>
                  </div>
                </div>
              )}

              {/* 错误信息 */}
              {interactionState.error && (
                <div className="flex items-center justify-center space-x-1 text-red-500 text-sm mt-2">
                  <AlertCircle className="w-4 h-4" />
                  <span>{interactionState.error}</span>
                </div>
              )}
            </div>

            {/* 实时音量指示器 */}
            <div className="w-full max-w-md">
              <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-green-400 to-green-600 transition-all duration-100"
                  style={{ width: `${interactionState.volumeLevel}%` }}
                />
              </div>
              <p className="text-center text-sm text-gray-500 mt-1">音量级别</p>
            </div>
          </div>
        </div>

        {/* ASR识别历史 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <MessageCircle className="w-5 h-5 mr-2 text-blue-500" />
            语音识别历史
          </h2>

          {interactionState.asrHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>暂无识别记录</p>
              <p className="text-sm mt-1">录音后会自动识别语音内容</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {interactionState.asrHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-blue-50 border-blue-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-blue-500" />
                      <span className="text-sm font-medium text-blue-700">
                        识别结果
                      </span>
                      <span className="text-xs text-gray-500">
                        置信度: {Math.round(record.confidence * 100)}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{record.text}</p>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <div>时长: {formatDuration(record.audioDuration)}</div>
                    <div>{record.timestamp.toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* TTS合成历史 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center">
            <Volume2 className="w-5 h-5 mr-2 text-green-500" />
            语音合成历史
          </h2>

          {interactionState.ttsHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Volume2 className="w-8 h-8 mx-auto mb-2 text-gray-400" />
              <p>暂无合成记录</p>
              <p className="text-sm mt-1">识别后会自动生成语音回复</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {interactionState.ttsHistory.map((record) => (
                <div
                  key={record.id}
                  className="flex items-start justify-between p-3 rounded-lg border bg-green-50 border-green-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      <span className="text-sm font-medium text-green-700">
                        语音合成
                      </span>
                      <span className="text-xs text-gray-500">
                        时长: {formatDuration(record.duration)}
                      </span>
                      <button
                        onClick={() => record.audioUrl && playAudioFromUrl(record.audioUrl)}
                        className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                      >
                        播放
                      </button>
                    </div>
                    <p className="text-sm text-gray-700">{record.text}</p>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    <div>语音ID: {record.voiceType}</div>
                    <div>{record.timestamp.toLocaleTimeString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 对话历史 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">完整对话历史</h2>

          {interactionState.conversationHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无对话记录</p>
              <p className="text-sm mt-1">开始语音交互体验完整对话</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {interactionState.conversationHistory.map((record) => (
                <div
                  key={record.id}
                  className={`flex items-start space-x-3 p-3 rounded-lg ${
                    record.type === 'user'
                      ? 'bg-blue-50 border-l-4 border-blue-400'
                      : 'bg-green-50 border-l-4 border-green-400'
                  }`}
                >
                  <div className="flex-shrink-0">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                      record.type === 'user' ? 'bg-blue-500' : 'bg-green-500'
                    }`}>
                      {record.type === 'user' ? '👤' : '🤖'}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">
                        {record.type === 'user' ? '用户' : 'AI助手'}
                      </span>
                      <span className="text-xs text-gray-500">
                        {record.confidence && `置信度: ${Math.round(record.confidence * 100)}%`}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700">{record.text}</p>
                  </div>
                  <div className="text-xs text-gray-500 text-right">
                    {record.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 录音历史 */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">录音技术记录</h2>

          {interactionState.recordingHistory.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>暂无录音记录</p>
              <p className="text-sm mt-1">点击上方按钮开始录音</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {interactionState.recordingHistory.map((record) => (
                <div
                  key={record.id}
                  className={`flex items-center justify-between p-2 rounded border ${
                    record.status === 'success'
                      ? 'bg-gray-50 border-gray-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`w-2 h-2 rounded-full ${
                      record.status === 'success' ? 'bg-gray-400' : 'bg-red-500'
                    }`} />
                    <span className="text-xs font-medium">
                      {record.status === 'success' ? '录音成功' : '录音失败'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    {record.status === 'success' && (
                      <>
                        <span>时长: {formatDuration(record.duration)}</span>
                        <span>音量: {Math.round(record.volumeLevel)}%</span>
                      </>
                    )}
                    <span>{record.timestamp.toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 控制面板 */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">控制面板</h2>
            <div className="flex items-center space-x-2">
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

              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 rounded-md hover:bg-gray-200 transition-colors"
              >
                <Settings className="w-5 h-5 text-gray-600" />
              </button>
            </div>
          </div>

          {/* 测试按钮 */}
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={handleTestBasic}
              className="px-4 py-2 bg-blue-100 text-blue-700 rounded-md hover:bg-blue-200 transition-colors text-sm font-medium"
            >
              <TestTube className="w-4 h-4 inline mr-2" />
              测试录音功能
            </button>

            <button
              onClick={handleTestTTS}
              className="px-4 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm font-medium"
            >
              <Volume2 className="w-4 h-4 inline mr-2" />
              测试语音合成
            </button>
          </div>

          {/* 服务状态 */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h3 className="text-sm font-medium text-gray-700 mb-2">服务状态</h3>
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div>
                <span className="text-gray-500">腾讯云配置:</span>
                <span className={`ml-1 ${tencentCloudVoiceService.isConfigured() ? 'text-green-600' : 'text-red-600'}`}>
                  {tencentCloudVoiceService.isConfigured() ? '已配置' : '未配置'}
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
              <div>
                <span className="text-gray-500">当前语音:</span>
                <span className="ml-1 text-purple-600">
                  {ttsConfig.voiceType} ({tencentCloudVoiceService.getAvailableVoiceTypes().find(v => v.id === ttsConfig.voiceType)?.name || '未知'})
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};