import { useRef, useState, useCallback, useEffect } from 'react';

// 音频录制状态接口
interface AudioRecorderState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  volumeLevel: number;
  error: string | null;
}

// 音频录制配置接口
interface AudioRecorderConfig {
  sampleRate: number;
  channelCount: number;
  bitDepth: number;
  bufferSize: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;
}

// 录音数据接口
interface AudioData {
  blob: Blob;
  arrayBuffer: ArrayBuffer;
  float32Array: Float32Array;
  duration: number;
  volumeLevel: number;
  timestamp: number;
}

// 音频录制Hook返回接口
interface UseAudioRecorderReturn {
  // 状态
  state: AudioRecorderState;

  // 操作方法
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<AudioData | null>;
  pauseRecording: () => boolean;
  resumeRecording: () => boolean;

  // 配置方法
  updateConfig: (config: Partial<AudioRecorderConfig>) => void;

  // 实时数据
  getVolumeLevel: () => number;
  getDuration: () => number;

  // 清理方法
  cleanup: () => void;
}

/**
 * 音频录制Hook
 * 提供完整的音频录制功能，包括实时音量监测、暂停恢复、错误处理等
 */
export const useAudioRecorder = (): UseAudioRecorderReturn => {
  // 状态管理
  const [state, setState] = useState<AudioRecorderState>({
    isRecording: false,
    isPaused: false,
    duration: 0,
    volumeLevel: 0,
    error: null
  });

  // 引用管理
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const microphoneRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const animationFrameRef = useRef<number | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // 配置管理
  const configRef = useRef<AudioRecorderConfig>({
    sampleRate: 44100,
    channelCount: 1,
    bitDepth: 16,
    bufferSize: 4096,
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true
  });

  /**
   * 实时音量监测
   */
  const monitorVolume = useCallback(() => {
    if (!analyserRef.current || !state.isRecording || state.isPaused) return;

    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(dataArray);

    // 计算平均音量
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length;
    const volumeLevel = Math.min(100, (average / 255) * 100 * 2); // 归一化到0-100

    setState(prev => ({ ...prev, volumeLevel }));

    // 继续监测
    animationFrameRef.current = requestAnimationFrame(monitorVolume);
  }, [state.isRecording, state.isPaused]);

  /**
   * 更新录制时长
   */
  const updateDuration = useCallback(() => {
    if (!state.isRecording || state.isPaused) return;

    const elapsed = Date.now() - startTimeRef.current;
    setState(prev => ({ ...prev, duration: elapsed }));
  }, [state.isRecording, state.isPaused]);

  /**
   * 请求麦克风权限并开始录制
   */
  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: configRef.current.sampleRate,
          channelCount: configRef.current.channelCount,
          echoCancellation: configRef.current.echoCancellation,
          noiseSuppression: configRef.current.noiseSuppression,
          autoGainControl: configRef.current.autoGainControl
        }
      });

      streamRef.current = stream;

      // 创建音频上下文和分析器
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = configRef.current.bufferSize;

      // 连接麦克风到分析器
      microphoneRef.current = audioContextRef.current.createMediaStreamSource(stream);
      microphoneRef.current.connect(analyserRef.current);

      // 创建MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 设置录制事件处理
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('录制错误:', event);
        setState(prev => ({
          ...prev,
          error: '录制过程中发生错误',
          isRecording: false
        }));
      };

      // 开始录制
      mediaRecorder.start(100); // 每100ms收集一次数据
      startTimeRef.current = Date.now();

      // 开始监测
      monitorVolume();
      durationIntervalRef.current = setInterval(updateDuration, 100);

      setState({
        isRecording: true,
        isPaused: false,
        duration: 0,
        volumeLevel: 0,
        error: null
      });

      console.log('✅ 音频录制已开始');
      return true;

    } catch (error: any) {
      console.error('❌ 开始录制失败:', error);
      setState(prev => ({
        ...prev,
        error: error.message || '无法访问麦克风',
        isRecording: false
      }));
      return false;
    }
  }, [monitorVolume, updateDuration]);

  /**
   * 停止录制并返回音频数据
   */
  const stopRecording = useCallback(async (): Promise<AudioData | null> => {
    if (!mediaRecorderRef.current || !state.isRecording) {
      return null;
    }

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

      // 转换为ArrayBuffer和Float32Array
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      const float32Array = audioBuffer.getChannelData(0);

      const audioData: AudioData = {
        blob: audioBlob,
        arrayBuffer,
        float32Array,
        duration: state.duration,
        volumeLevel: state.volumeLevel,
        timestamp: Date.now()
      };

      // 清理资源
      cleanup();

      setState(prev => ({
        ...prev,
        isRecording: false,
        isPaused: false
      }));

      console.log('✅ 音频录制已停止，数据准备完成');
      return audioData;

    } catch (error: any) {
      console.error('❌ 停止录制失败:', error);
      setState(prev => ({
        ...prev,
        error: error.message || '停止录制时发生错误',
        isRecording: false,
        isPaused: false
      }));
      return null;
    }
  }, [state.isRecording, state.duration, state.volumeLevel]);

  /**
   * 暂停录制
   */
  const pauseRecording = useCallback((): boolean => {
    if (!mediaRecorderRef.current || !state.isRecording || state.isPaused) {
      return false;
    }

    try {
      mediaRecorderRef.current.pause();
      setState(prev => ({ ...prev, isPaused: true }));

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      console.log('⏸️ 录制已暂停');
      return true;
    } catch (error) {
      console.error('❌ 暂停录制失败:', error);
      return false;
    }
  }, [state.isRecording, state.isPaused]);

  /**
   * 恢复录制
   */
  const resumeRecording = useCallback((): boolean => {
    if (!mediaRecorderRef.current || !state.isRecording || !state.isPaused) {
      return false;
    }

    try {
      mediaRecorderRef.current.resume();
      setState(prev => ({ ...prev, isPaused: false }));

      monitorVolume();

      console.log('▶️ 录制已恢复');
      return true;
    } catch (error) {
      console.error('❌ 恢复录制失败:', error);
      return false;
    }
  }, [state.isRecording, state.isPaused, monitorVolume]);

  /**
   * 更新配置
   */
  const updateConfig = useCallback((newConfig: Partial<AudioRecorderConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
    console.log('📝 录音配置已更新:', configRef.current);
  }, []);

  /**
   * 获取当前音量级别
   */
  const getVolumeLevel = useCallback((): number => {
    return state.volumeLevel;
  }, [state.volumeLevel]);

  /**
   * 获取当前录制时长
   */
  const getDuration = useCallback((): number => {
    return state.duration;
  }, [state.duration]);

  /**
   * 清理资源
   */
  const cleanup = useCallback(() => {
    // 停止录制
    if (mediaRecorderRef.current && state.isRecording) {
      mediaRecorderRef.current.stop();
    }

    // 停止所有音轨
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    // 取消动画帧
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    // 清除定时器
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }

    // 断开音频节点连接
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
    }

    // 关闭音频上下文
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }

    // 重置引用
    mediaRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    microphoneRef.current = null;
    streamRef.current = null;
    audioChunksRef.current = [];
    animationFrameRef.current = null;
    durationIntervalRef.current = null;

    console.log('🧹 录音资源已清理');
  }, [state.isRecording]);

  // 组件卸载时清理资源
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    state,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    updateConfig,
    getVolumeLevel,
    getDuration,
    cleanup
  };
};