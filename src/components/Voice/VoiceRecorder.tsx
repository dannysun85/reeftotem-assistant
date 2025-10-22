import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioRecorder } from '../../hooks/useAudioRecorder';
import { useAudioProcessor } from './AudioProcessor';
import { VoiceButton } from './VoiceButton';
import { WaveformVisualizer, VolumeIndicator } from './WaveformVisualizer';
import { useLive2DLipSync } from '../../hooks/useLive2DLipSync';
import { Clock, Volume2, Mic, AlertCircle } from 'lucide-react';

// 语音录制器属性接口
interface VoiceRecorderProps {
  onRecordingComplete?: (audioData: any) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  autoStart?: boolean;
  showAdvancedControls?: boolean;
  enableLipSync?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// 录音状态详情
interface RecordingDetails {
  duration: number;
  formattedDuration: string;
  maxDuration: number; // 最大录制时长（毫秒）
  quality: 'low' | 'medium' | 'high';
}

/**
 * 完整的语音录制器组件
 * 集成音频录制、处理、可视化、唇形同步等功能
 */
export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  autoStart = false,
  showAdvancedControls = false,
  enableLipSync = true,
  className = '',
  style = {}
}) => {
  // 录音器Hook
  const audioRecorder = useAudioRecorder();

  // 音频处理器Hook
  const audioProcessor = useAudioProcessor();

  // 唇形同步Hook
  const lipSync = useLive2DLipSync();

  // 本地状态
  const [isProcessing, setIsProcessing] = useState(false);
  const [recordingDetails, setRecordingDetails] = useState<RecordingDetails>({
    duration: 0,
    formattedDuration: '00:00',
    maxDuration: 60000, // 60秒最大录制时长
    quality: 'medium'
  });

  // 实时音频数据存储
  const realtimeAudioDataRef = useRef<Float32Array | null>(null);

  // 格式化时间显示
  const formatDuration = useCallback((milliseconds: number): string => {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // 处理录音开始
  const handleRecordingStart = useCallback(async () => {
    try {
      setIsProcessing(true);

      // 开始录音
      const success = await audioRecorder.startRecording();

      if (success) {
        // 激活唇形同步（如果启用）
        if (enableLipSync) {
          lipSync.activateLipSync();
        }

        // 回调通知
        onRecordingStart?.();

        console.log('✅ 录音已开始');
      } else {
        console.error('❌ 录音开始失败');
      }
    } catch (error) {
      console.error('录音开始异常:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [audioRecorder, enableLipSync, lipSync, onRecordingStart]);

  // 处理录音停止
  const handleRecordingStop = useCallback(async () => {
    try {
      setIsProcessing(true);

      // 停止录音
      const audioData = await audioRecorder.stopRecording();

      if (audioData) {
        // 处理音频数据
        const analysisResult = audioProcessor.processAudioData(
          audioData.float32Array,
          audioRecorder.state.duration > 0 ? 44100 : undefined
        );

        const enhancedAudioData = {
          ...audioData,
          analysis: analysisResult,
          quality: recordingDetails.quality,
          lipSyncData: enableLipSync ? lipSync.getLipSyncConfig() : null
        };

        // 回调通知
        onRecordingComplete?.(enhancedAudioData);

        console.log('✅ 录音已停止，数据已处理');
      } else {
        console.error('❌ 录音停止失败');
      }

      // 禁用唇形同步（如果启用）
      if (enableLipSync) {
        lipSync.deactivateLipSync();
      }

      // 回调通知
      onRecordingStop?.();

    } catch (error) {
      console.error('录音停止异常:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [audioRecorder, audioProcessor, enableLipSync, lipSync, recordingDetails.quality, onRecordingComplete, onRecordingStop]);

  // 处理录音暂停
  const handleRecordingPause = useCallback(() => {
    const success = audioRecorder.pauseRecording();
    if (success) {
      console.log('⏸️ 录音已暂停');
    }
  }, [audioRecorder]);

  // 处理录音恢复
  const handleRecordingResume = useCallback(() => {
    const success = audioRecorder.resumeRecording();
    if (success) {
      console.log('▶️ 录音已恢复');
    }
  }, [audioRecorder]);

  // 实时处理音频数据（模拟）
  useEffect(() => {
    if (audioRecorder.state.isRecording && !audioRecorder.state.isPaused) {
      const interval = setInterval(() => {
        // 模拟实时音频数据处理
        if (audioRecorder.state.volumeLevel > 0) {
          // 生成模拟音频数据用于唇形同步
          const sampleRate = 44100;
          const samplesPerChunk = Math.floor(sampleRate * 0.1); // 100ms的音频数据
          const audioData = new Float32Array(samplesPerChunk);

          // 基于音量级别生成模拟音频数据
          for (let i = 0; i < samplesPerChunk; i++) {
            // 添加基础噪声和语音特征
            const noise = (Math.random() - 0.5) * 0.1;
            const signal = Math.sin(i * 0.1) * audioRecorder.state.volumeLevel / 100;
            audioData[i] = noise + signal;
          }

          realtimeAudioDataRef.current = audioData;

          // 更新唇形同步
          if (enableLipSync) {
            lipSync.processAudioForLipSync(audioData);
          }

          // 处理音频分析
          audioProcessor.processAudioData(audioData, sampleRate);
        }
      }, 100); // 每100ms处理一次

      return () => clearInterval(interval);
    }
  }, [audioRecorder.state.isRecording, audioRecorder.state.isPaused, audioRecorder.state.volumeLevel, enableLipSync, lipSync, audioProcessor]);

  // 更新录制详情
  useEffect(() => {
    setRecordingDetails(prev => ({
      ...prev,
      duration: audioRecorder.state.duration,
      formattedDuration: formatDuration(audioRecorder.state.duration)
    }));
  }, [audioRecorder.state.duration, formatDuration]);

  // 自动开始录音
  useEffect(() => {
    if (autoStart && !audioRecorder.state.isRecording) {
      handleRecordingStart();
    }
  }, [autoStart, audioRecorder.state.isRecording, handleRecordingStart]);

  // 检查最大录制时长
  useEffect(() => {
    if (audioRecorder.state.isRecording &&
        audioRecorder.state.duration >= recordingDetails.maxDuration) {
      handleRecordingStop();
    }
  }, [audioRecorder.state.isRecording, audioRecorder.state.duration, recordingDetails.maxDuration, handleRecordingStop]);

  // 获取状态指示器颜色
  const getStatusColor = useCallback((): string => {
    if (audioRecorder.state.error) return 'text-red-500';
    if (audioRecorder.state.isRecording) return 'text-red-600 animate-pulse';
    if (audioRecorder.state.isPaused) return 'text-yellow-600';
    return 'text-green-600';
  }, [audioRecorder.state.error, audioRecorder.state.isRecording, audioRecorder.state.isPaused]);

  return (
    <div className={`voice-recorder bg-white rounded-lg shadow-lg p-6 ${className}`} style={style}>
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Mic className={`w-5 h-5 ${getStatusColor()}`} />
          <h3 className="text-lg font-semibold text-gray-800">
            语音录制器
          </h3>
        </div>

        {audioRecorder.state.error && (
          <div className="flex items-center space-x-1 text-red-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{audioRecorder.state.error}</span>
          </div>
        )}
      </div>

      {/* 主要控制区域 */}
      <div className="flex flex-col items-center space-y-4">
        {/* 语音控制按钮 */}
        <VoiceButton
          isRecording={audioRecorder.state.isRecording}
          isPaused={audioRecorder.state.isPaused}
          volumeLevel={audioRecorder.state.volumeLevel}
          onStartRecording={handleRecordingStart}
          onStopRecording={handleRecordingStop}
          onPauseRecording={handleRecordingPause}
          onResumeRecording={handleRecordingResume}
          disabled={isProcessing}
          size="large"
          variant="primary"
        />

        {/* 波形可视化 */}
        <div className="w-full">
          <WaveformVisualizer
            isRecording={audioRecorder.state.isRecording}
            volumeLevel={audioRecorder.state.volumeLevel}
            width={300}
            height={80}
            barCount={30}
          />
        </div>

        {/* 状态信息 */}
        <div className="flex items-center space-x-6 text-sm text-gray-600">
          {/* 时长显示 */}
          <div className="flex items-center space-x-1">
            <Clock className="w-4 h-4" />
            <span className="font-mono">{recordingDetails.formattedDuration}</span>
            <span className="text-gray-400">/ {formatDuration(recordingDetails.maxDuration)}</span>
          </div>

          {/* 音量显示 */}
          <div className="flex items-center space-x-1">
            <Volume2 className="w-4 h-4" />
            <span>{Math.round(audioRecorder.state.volumeLevel)}%</span>
          </div>

          {/* 状态显示 */}
          <div className="flex items-center space-x-1">
            <div className={`w-2 h-2 rounded-full ${
              audioRecorder.state.isRecording ? 'bg-red-500 animate-pulse' :
              audioRecorder.state.isPaused ? 'bg-yellow-500' :
              'bg-gray-400'
            }`} />
            <span>
              {audioRecorder.state.isRecording ? '录音中' :
               audioRecorder.state.isPaused ? '已暂停' :
               '就绪'}
            </span>
          </div>
        </div>
      </div>

      {/* 高级控制选项 */}
      {showAdvancedControls && (
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-2 gap-4">
            {/* 音频质量设置 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                音频质量
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={recordingDetails.quality}
                onChange={(e) => setRecordingDetails(prev => ({ ...prev, quality: e.target.value as any }))}
                disabled={audioRecorder.state.isRecording}
              >
                <option value="low">低质量 (节省空间)</option>
                <option value="medium">中等质量</option>
                <option value="high">高质量 (推荐)</option>
              </select>
            </div>

            {/* 最大录制时长 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                最大时长
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={recordingDetails.maxDuration}
                onChange={(e) => setRecordingDetails(prev => ({ ...prev, maxDuration: Number(e.target.value) }))}
                disabled={audioRecorder.state.isRecording}
              >
                <option value={30000}>30秒</option>
                <option value={60000}>60秒</option>
                <option value={120000}>2分钟</option>
                <option value={300000}>5分钟</option>
              </select>
            </div>

            {/* 唇形同步开关 */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="lipSync"
                checked={enableLipSync}
                onChange={(e) => {
                  if (e.target.checked && !lipSync.getLipSyncIds().length) {
                    console.warn('当前Live2D模型不支持唇形同步');
                    return;
                  }
                  // 这里可以添加状态更新逻辑
                }}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="lipSync" className="text-sm font-medium text-gray-700">
                启用唇形同步
              </label>
            </div>

            {/* 实时处理状态 */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                audioProcessor.isProcessing ? 'bg-green-500 animate-pulse' : 'bg-gray-400'
              }`} />
              <span className="text-sm text-gray-600">
                {audioProcessor.isProcessing ? '处理中' : '空闲'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 实时音频分析信息（调试用） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <details className="text-xs text-gray-500">
            <summary className="cursor-pointer font-medium">调试信息</summary>
            <div className="mt-2 space-y-1 font-mono">
              <div>当前音量: {audioRecorder.state.volumeLevel.toFixed(2)}</div>
              <div>语音活动: {audioProcessor.isSpeechActive ? '是' : '否'}</div>
              <div>唇形同步: {enableLipSync ? (lipSync.getLipSyncIds().length > 0 ? '可用' : '不支持') : '禁用'}</div>
              <div>处理状态: {audioProcessor.isProcessing ? '活跃' : '空闲'}</div>
            </div>
          </details>
        </div>
      )}
    </div>
  );
};