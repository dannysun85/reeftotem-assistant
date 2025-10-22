import { useState, useCallback, useRef, useEffect } from 'react';

// 音频处理配置接口
interface AudioProcessingConfig {
  // 噪音抑制
  noiseThreshold: number;
  noiseGateEnabled: boolean;

  // 自动增益控制
  autoGainEnabled: boolean;
  targetLevel: number;

  // 静音检测
  silenceThreshold: number;
  silenceDuration: number;

  // 音频压缩
  compressionEnabled: boolean;
  compressionRatio: number;

  // 高通/低通滤波
  highPassFrequency: number;
  lowPassFrequency: number;
}

// 音频分析结果接口
interface AudioAnalysisResult {
  // 基础分析
  rms: number; // 均方根音量
  peak: number; // 峰值音量
  zeroCrossingRate: number; // 过零率

  // 频域分析
  spectralCentroid: number; // 频谱重心
  spectralRolloff: number; // 频谱滚降
  mfcc: number[]; // 梅尔频率倒谱系数

  // 语音活动检测
  isSpeech: boolean;
  speechProbability: number;

  // 静音检测
  isSilent: boolean;
  silenceDuration: number;

  // 时间戳
  timestamp: number;
}

// 音频处理Hook返回接口
interface UseAudioProcessorReturn {
  // 处理方法
  processAudioData: (audioData: Float32Array, sampleRate: number) => AudioAnalysisResult;

  // 配置方法
  updateConfig: (config: Partial<AudioProcessingConfig>) => void;
  getConfig: () => AudioProcessingConfig;

  // 实时状态
  isProcessing: boolean;
  currentLevel: number;
  isSpeechActive: boolean;
}

/**
 * 音频处理Hook
 * 提供音频数据分析、噪音抑制、语音活动检测等功能
 */
export const useAudioProcessor = (): UseAudioProcessorReturn => {
  // 配置管理
  const configRef = useRef<AudioProcessingConfig>({
    noiseThreshold: 0.02,
    noiseGateEnabled: true,
    autoGainEnabled: true,
    targetLevel: 0.7,
    silenceThreshold: 0.01,
    silenceDuration: 1000,
    compressionEnabled: true,
    compressionRatio: 4,
    highPassFrequency: 80,
    lowPassFrequency: 8000
  });

  // 状态管理
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(0);
  const [isSpeechActive, setIsSpeechActive] = useState(false);

  // 引用管理
  const silenceStartTimeRef = useRef<number | null>(null);
  const previousLevelRef = useRef<number>(0);

  /**
   * 计算RMS（均方根）音量
   */
  const calculateRMS = useCallback((audioData: Float32Array): number => {
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    return Math.sqrt(sum / audioData.length);
  }, []);

  /**
   * 计算峰值音量
   */
  const calculatePeak = useCallback((audioData: Float32Array): number => {
    let peak = 0;
    for (let i = 0; i < audioData.length; i++) {
      const absolute = Math.abs(audioData[i]);
      if (absolute > peak) {
        peak = absolute;
      }
    }
    return peak;
  }, []);

  /**
   * 计算过零率
   */
  const calculateZeroCrossingRate = useCallback((audioData: Float32Array): number => {
    let crossings = 0;
    for (let i = 1; i < audioData.length; i++) {
      if ((audioData[i] >= 0) !== (audioData[i - 1] >= 0)) {
        crossings++;
      }
    }
    return crossings / audioData.length;
  }, []);

  /**
   * 简单的FFT实现（用于频域分析）
   */
  const simpleFFT = useCallback((audioData: Float32Array): { real: number[], imag: number[] } => {
    const n = audioData.length;
    const real = new Array(n);
    const imag = new Array(n).fill(0);

    // 复制音频数据到实部
    for (let i = 0; i < n; i++) {
      real[i] = audioData[i];
    }

    // 简化的DFT实现（实际应用中建议使用专业库）
    const realResult = new Array(n);
    const imagResult = new Array(n);

    for (let k = 0; k < n; k++) {
      let realSum = 0;
      let imagSum = 0;

      for (let t = 0; t < n; t++) {
        const angle = -2 * Math.PI * k * t / n;
        realSum += real[t] * Math.cos(angle);
        imagSum += real[t] * Math.sin(angle);
      }

      realResult[k] = realSum;
      imagResult[k] = imagSum;
    }

    return { real: realResult, imag: imagResult };
  }, []);

  /**
   * 计算频谱重心
   */
  const calculateSpectralCentroid = useCallback((audioData: Float32Array, sampleRate: number): number => {
    const fft = simpleFFT(audioData);
    const n = fft.real.length / 2; // 只需要正频率部分

    let weightedSum = 0;
    let magnitudeSum = 0;

    for (let k = 0; k < n; k++) {
      const magnitude = Math.sqrt(fft.real[k] * fft.real[k] + fft.imag[k] * fft.imag[k]);
      const frequency = (k * sampleRate) / (2 * n);

      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }

    return magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
  }, [simpleFFT]);

  /**
   * 计算频谱滚降
   */
  const calculateSpectralRolloff = useCallback((audioData: Float32Array, sampleRate: number): number => {
    const fft = simpleFFT(audioData);
    const n = fft.real.length / 2;

    // 计算总能量
    let totalEnergy = 0;
    const magnitudes = new Array(n);

    for (let k = 0; k < n; k++) {
      const magnitude = Math.sqrt(fft.real[k] * fft.real[k] + fft.imag[k] * fft.imag[k]);
      magnitudes[k] = magnitude;
      totalEnergy += magnitude;
    }

    if (totalEnergy === 0) return 0;

    // 计算85%能量截止频率
    const threshold = totalEnergy * 0.85;
    let accumulatedEnergy = 0;

    for (let k = 0; k < n; k++) {
      accumulatedEnergy += magnitudes[k];
      if (accumulatedEnergy >= threshold) {
        return (k * sampleRate) / (2 * n);
      }
    }

    return sampleRate / 2; // 如果没有达到阈值，返回奈奎斯特频率
  }, [simpleFFT]);

  /**
   * 噪音抑制处理
   */
  const applyNoiseGate = useCallback((audioData: Float32Array): Float32Array => {
    if (!configRef.current.noiseGateEnabled) {
      return audioData;
    }

    const threshold = configRef.current.noiseThreshold;
    const processedData = new Float32Array(audioData.length);

    for (let i = 0; i < audioData.length; i++) {
      const abs = Math.abs(audioData[i]);
      processedData[i] = abs >= threshold ? audioData[i] : 0;
    }

    return processedData;
  }, []);

  /**
   * 自动增益控制
   */
  const applyAutoGain = useCallback((audioData: Float32Array): Float32Array => {
    if (!configRef.current.autoGainEnabled) {
      return audioData;
    }

    const targetLevel = configRef.current.targetLevel;
    const currentRMS = calculateRMS(audioData);

    if (currentRMS === 0) return audioData;

    const gain = targetLevel / currentRMS;
    const maxGain = 2.0; // 限制最大增益
    const limitedGain = Math.min(maxGain, Math.max(0.1, gain));

    const processedData = new Float32Array(audioData.length);
    for (let i = 0; i < audioData.length; i++) {
      processedData[i] = audioData[i] * limitedGain;
    }

    return processedData;
  }, [calculateRMS]);

  /**
   * 语音活动检测
   */
  const detectSpeechActivity = useCallback((audioData: Float32Array): { isSpeech: boolean, probability: number } => {
    const rms = calculateRMS(audioData);
    const zcr = calculateZeroCrossingRate(audioData);
    const peak = calculatePeak(audioData);

    // 简单的语音特征检测
    const hasEnergy = rms > configRef.current.silenceThreshold;
    const hasPeak = peak > configRef.current.silenceThreshold * 2;
    const hasVariation = zcr > 0.01 && zcr < 0.5;

    // 计算语音概率
    let probability = 0;
    if (hasEnergy) probability += 0.4;
    if (hasPeak) probability += 0.3;
    if (hasVariation) probability += 0.3;

    return {
      isSpeech: probability > 0.5,
      probability: Math.min(1, Math.max(0, probability))
    };
  }, [calculateRMS, calculateZeroCrossingRate, calculatePeak]);

  /**
   * 处理音频数据
   */
  const processAudioData = useCallback((audioData: Float32Array, sampleRate: number): AudioAnalysisResult => {
    setIsProcessing(true);

    try {
      // 1. 基础音频分析
      const rms = calculateRMS(audioData);
      const peak = calculatePeak(audioData);
      const zcr = calculateZeroCrossingRate(audioData);

      // 2. 语音活动检测
      const speechDetection = detectSpeechActivity(audioData);
      const isSpeech = speechDetection.isSpeech;
      const speechProbability = speechDetection.probability;

      // 3. 静音检测
      const currentTimestamp = Date.now();
      let isSilent = false;
      let silenceDuration = 0;

      if (rms < configRef.current.silenceThreshold) {
        if (silenceStartTimeRef.current === null) {
          silenceStartTimeRef.current = currentTimestamp;
        }
        isSilent = true;
        silenceDuration = currentTimestamp - silenceStartTimeRef.current;
      } else {
        silenceStartTimeRef.current = null;
      }

      // 4. 频域分析
      const spectralCentroid = calculateSpectralCentroid(audioData, sampleRate);
      const spectralRolloff = calculateSpectralRolloff(audioData, sampleRate);

      // 5. 简化的MFCC计算（实际应用中建议使用专业库）
      const mfcc = calculateSimpleMFCC(audioData, sampleRate);

      // 6. 更新实时状态
      setCurrentLevel(rms);
      setIsSpeechActive(isSpeech);
      previousLevelRef.current = rms;

      return {
        rms,
        peak,
        zeroCrossingRate: zcr,
        spectralCentroid,
        spectralRolloff,
        mfcc,
        isSpeech,
        speechProbability,
        isSilent,
        silenceDuration,
        timestamp: currentTimestamp
      };

    } catch (error) {
      console.error('音频处理失败:', error);

      // 返回默认结果
      return {
        rms: 0,
        peak: 0,
        zeroCrossingRate: 0,
        spectralCentroid: 0,
        spectralRolloff: 0,
        mfcc: [],
        isSpeech: false,
        speechProbability: 0,
        isSilent: true,
        silenceDuration: 0,
        timestamp: Date.now()
      };
    } finally {
      setIsProcessing(false);
    }
  }, [
    calculateRMS,
    calculatePeak,
    calculateZeroCrossingRate,
    detectSpeechActivity,
    calculateSpectralCentroid,
    calculateSpectralRolloff
  ]);

  /**
   * 简化的MFCC计算（实际应用中建议使用专业库）
   */
  const calculateSimpleMFCC = useCallback((audioData: Float32Array, sampleRate: number): number[] => {
    // 这是一个非常简化的MFCC实现，实际应用中应该使用专业的音频处理库
    const mfccCount = 13;
    const mfcc = new Array(mfccCount).fill(0);

    // 简单实现：使用频谱能量的对数作为"MFCC"
    const fft = simpleFFT(audioData);
    const n = fft.real.length / 2;

    for (let i = 0; i < Math.min(mfccCount, n); i++) {
      const magnitude = Math.sqrt(fft.real[i] * fft.real[i] + fft.imag[i] * fft.imag[i]);
      mfcc[i] = Math.log(Math.max(1e-10, magnitude));
    }

    return mfcc;
  }, [simpleFFT]);

  /**
   * 更新配置
   */
  const updateConfig = useCallback((newConfig: Partial<AudioProcessingConfig>) => {
    configRef.current = { ...configRef.current, ...newConfig };
    console.log('音频处理配置已更新:', configRef.current);
  }, []);

  /**
   * 获取当前配置
   */
  const getConfig = useCallback((): AudioProcessingConfig => {
    return { ...configRef.current };
  }, []);

  return {
    processAudioData,
    updateConfig,
    getConfig,
    isProcessing,
    currentLevel,
    isSpeechActive
  };
};