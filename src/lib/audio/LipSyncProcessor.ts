/**
 * Enhanced Lip Sync Processor
 * 整合自live2d-web-sdk，提供高级唇形同步功能
 */

import { LipSyncConfig, LipSyncValue, AudioVisualizationData } from '../../types/audio';

interface LipSyncEvents {
  'value-changed': (value: number) => void;
  'start': () => void;
  'stop': () => void;
  'audio-data': (data: Float32Array) => void;
  'visualization-data': (data: AudioVisualizationData) => void;
}

/**
 * 简单的事件发射器实现
 */
export class EventEmitter<T extends Record<string, any[]>> {
  private listeners: { [K in keyof T]?: Array<(...args: T[K]) => void> } = {};

  on<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event]!.push(listener);
  }

  off<K extends keyof T>(event: K, listener: (...args: T[K]) => void): void {
    const index = this.listeners[event]?.indexOf(listener);
    if (index !== undefined && index > -1) {
      this.listeners[event]?.splice(index, 1);
    }
  }

  emit<K extends keyof T>(event: K, ...args: T[K]): void {
    this.listeners[event]?.forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${String(event)}:`, error);
      }
    });
  }

  removeAllListeners<K extends keyof T>(event?: K): void {
    if (event) {
      this.listeners[event] = [];
    } else {
      this.listeners = {};
    }
  }
}

/**
 * 增强的唇形同步处理器
 * 支持实时音频分析和多种可视化模式
 */
export class LipSyncProcessor extends EventEmitter<LipSyncEvents> {
  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | AudioBufferSourceNode | null = null;
  private dataArray: Uint8Array;
  private floatArray: Float32Array;

  private config: LipSyncConfig;
  private isActive = false;
  private currentValue = 0;
  private smoothedValue = 0;
  private targetValue = 0;

  private updateInterval: number | null = null;
  private animationId: number | null = null;

  constructor(config?: Partial<LipSyncConfig>) {
    super();

    this.config = {
      enabled: true,
      sensitivity: 1.0,
      smoothing: 0.8,
      minThreshold: 0.01,
      ...config
    };

    // Initialize arrays for frequency data
    this.dataArray = new Uint8Array(2048);
    this.floatArray = new Float32Array(2048);
  }

  /**
   * 初始化唇形同步处理器
   */
  public async initialize(config: LipSyncConfig): Promise<void> {
    this.config = { ...this.config, ...config };

    // Create audio context if not exists
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Create analyser node
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;

    // Set up array sizes based on FFT size
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Uint8Array(bufferLength);
    this.floatArray = new Float32Array(bufferLength);
  }

  /**
   * 使用音频数据开始唇形同步
   */
  public async start(audioData: ArrayBuffer): Promise<void> {
    if (!this.config.enabled || !this.context || !this.analyser) {
      return;
    }

    try {
      // Stop any existing lip sync
      this.stop();

      // Decode audio data
      const audioBuffer = await this.context.decodeAudioData(audioData.slice(0));

      // Create source node
      this.source = this.context.createBufferSource();
      this.source.buffer = audioBuffer;

      // Connect nodes
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination);

      // Start playback
      this.source.start();
      this.isActive = true;

      // Start monitoring
      this.startMonitoring();

      // Set up end listener
      this.source.onended = () => {
        this.stop();
      };

      this.emit('start');

    } catch (error) {
      console.error('Failed to start lip sync:', error);
      this.stop();
    }
  }

  /**
   * 使用音频元素开始唇形同步
   */
  public startWithElement(audioElement: HTMLAudioElement): void {
    if (!this.config.enabled || !this.context || !this.analyser) {
      return;
    }

    try {
      // Stop any existing lip sync
      this.stop();

      // Create source node from audio element
      this.source = this.context.createMediaElementSource(audioElement);

      // Connect nodes
      this.source.connect(this.analyser);
      this.analyser.connect(this.context.destination);

      this.isActive = true;
      this.startMonitoring();

      this.emit('start');

    } catch (error) {
      console.error('Failed to start lip sync with element:', error);
      this.stop();
    }
  }

  /**
   * 停止唇形同步
   */
  public stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;

    // Stop monitoring
    this.stopMonitoring();

    // Stop source if playing
    if (this.source) {
      try {
        if ('stop' in this.source && typeof this.source.stop === 'function') {
          (this.source as AudioBufferSourceNode).stop();
        }
        if ('disconnect' in this.source && typeof this.source.disconnect === 'function') {
          this.source.disconnect();
        }
      } catch (error) {
        console.warn('Error stopping audio source:', error);
      }
      this.source = null;
    }

    // Reset values
    this.currentValue = 0;
    this.smoothedValue = 0;
    this.targetValue = 0;

    this.emit('stop');
  }

  /**
   * 获取当前唇形同步值
   */
  public getValue(): number {
    return this.smoothedValue;
  }

  /**
   * 获取原始音频数据
   */
  public getAudioData(): Float32Array | null {
    if (!this.analyser || !this.isActive) {
      return null;
    }

    this.analyser.getFloatFrequencyData(this.floatArray);
    return new Float32Array(this.floatArray);
  }

  /**
   * 获取频率数据
   */
  public getFrequencyData(): Uint8Array | null {
    if (!this.analyser || !this.isActive) {
      return null;
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    return new Uint8Array(this.dataArray);
  }

  /**
   * 获取波形数据
   */
  public getWaveformData(): Uint8Array | null {
    if (!this.analyser || !this.isActive) {
      return null;
    }

    this.analyser.getByteTimeDomainData(this.dataArray);
    return new Uint8Array(this.dataArray);
  }

  /**
   * 更新配置
   */
  public updateConfig(config: Partial<LipSyncConfig>): void {
    this.config = { ...this.config, ...config };

    // Update analyser smoothing if available
    if (this.analyser && config.smoothing !== undefined) {
      this.analyser.smoothingTimeConstant = config.smoothing;
    }
  }

  /**
   * 检查唇形同步是否处于活动状态
   */
  public isProcessing(): boolean {
    return this.isActive;
  }

  /**
   * 销毁处理器
   */
  public destroy(): void {
    this.stop();

    if (this.context && this.context.state !== 'closed') {
      this.context.close();
    }

    this.removeAllListeners();
    this.context = null;
    this.analyser = null;
    this.source = null;
  }

  // Private methods

  private startMonitoring(): void {
    const update = () => {
      if (!this.isActive) {
        return;
      }

      this.updateLipSyncValue();
      this.animationId = requestAnimationFrame(update);
    };

    update();
  }

  private stopMonitoring(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }

    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  private updateLipSyncValue(): void {
    if (!this.analyser) {
      return;
    }

    // Get frequency data
    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate RMS for lip sync
    const rms = this.calculateRMS(this.dataArray);

    // Apply sensitivity and threshold
    this.targetValue = Math.max(0, (rms - this.config.minThreshold!) * this.config.sensitivity!);

    // Clamp to valid range
    this.targetValue = Math.min(1, Math.max(0, this.targetValue));

    // Apply smoothing
    const smoothingFactor = this.config.smoothing!;
    this.smoothedValue = (this.smoothedValue * smoothingFactor) + (this.targetValue * (1 - smoothingFactor));

    // Update current value
    this.currentValue = this.smoothedValue;

    // Emit change event
    this.emit('value-changed', this.currentValue);

    // Emit audio data for visualization
    if (this.dataArray.length > 0) {
      const audioData = new Float32Array(this.dataArray.length);
      for (let i = 0; i < this.dataArray.length; i++) {
        audioData[i] = this.dataArray[i] / 255.0;
      }
      this.emit('audio-data', audioData);
    }
  }

  private calculateRMS(dataArray: Uint8Array): number {
    let sum = 0;
    let count = 0;

    // Focus on lower frequency ranges for speech (typically 85-255 Hz for human voice)
    const startIndex = Math.floor(85 * dataArray.length / (this.context?.sampleRate || 44100));
    const endIndex = Math.floor(1000 * dataArray.length / (this.context?.sampleRate || 44100));

    for (let i = startIndex; i < Math.min(endIndex, dataArray.length); i++) {
      const normalized = dataArray[i] / 255.0;
      sum += normalized * normalized;
      count++;
    }

    return count > 0 ? Math.sqrt(sum / count) : 0;
  }

  /**
   * 获取音频级别用于可视化
   */
  public getAudioLevel(): number {
    if (!this.analyser || !this.isActive) {
      return 0;
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i];
    }

    return (sum / this.dataArray.length) / 255.0;
  }

  /**
   * 获取频段数据用于可视化
   */
  public getFrequencyBands(bandCount: number = 32): number[] {
    if (!this.analyser || !this.isActive) {
      return new Array(bandCount).fill(0);
    }

    this.analyser.getByteFrequencyData(this.dataArray);

    const bands = new Array(bandCount).fill(0);
    const samplesPerBand = Math.floor(this.dataArray.length / bandCount);

    for (let band = 0; band < bandCount; band++) {
      let sum = 0;
      const start = band * samplesPerBand;
      const end = Math.min(start + samplesPerBand, this.dataArray.length);

      for (let i = start; i < end; i++) {
        sum += this.dataArray[i];
      }

      bands[band] = (sum / (end - start)) / 255.0;
    }

    return bands;
  }

  /**
   * 获取音频可视化数据
   */
  public getVisualizationData(type: 'frequency' | 'waveform' | 'volume'): AudioVisualizationData {
    let values: number[] | number = 0;

    switch (type) {
      case 'frequency':
        values = this.getFrequencyBands();
        break;
      case 'waveform':
        const waveformData = this.getWaveformData();
        if (waveformData) {
          values = Array.from(waveformData).map(v => v / 255.0);
        }
        break;
      case 'volume':
        values = this.getAudioLevel();
        break;
    }

    return {
      type,
      values,
      timestamp: Date.now()
    };
  }
}