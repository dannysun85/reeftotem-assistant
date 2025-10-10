/**
 * 音频处理类型定义
 * 整合自live2d-web-sdk
 */

export interface AudioSettings {
  sampleRate: number;
  channels: number;
  bufferSize: number;
  volume: number;
}

export interface AudioAnalyzer {
  context: AudioContext;
  analyzer: AnalyserNode;
  dataArray: Uint8Array;
  floatArray: Float32Array;
}

export interface AudioVisualizerSettings {
  width: number;
  height: number;
  type: 'waveform' | 'frequency' | 'circular';
  color: string;
  backgroundColor: string;
  barCount: number;
  sensitivity: number;
  smoothing: number;
}

export interface LipSyncAnalyzer {
  context: AudioContext;
  analyser: AnalyserNode;
  scriptNode?: ScriptProcessorNode;
  dataArray: Uint8Array;
  sensitivity: number;
  smoothing: number;
  lastValue: number;
}

export interface AudioBufferOptions {
  length?: number;
  sampleRate?: number;
  channels?: number;
}

export interface AudioProcessor {
  input: AudioNode;
  output: AudioNode;
  analyser: AnalyserNode;
  gainNode: GainNode;
}

export interface AudioStreamOptions {
  constraints: MediaStreamConstraints;
  autoPlay: boolean;
  muted: boolean;
}

export interface RecordedAudio {
  blob: Blob;
  buffer: ArrayBuffer;
  duration: number;
  sampleRate: number;
}

export interface AudioFormat {
  type: 'wav' | 'mp3' | 'ogg' | 'aac';
  sampleRate: number;
  bitRate?: number;
  channels: number;
}

export interface SpeechSynthesisOptions {
  text: string;
  voice?: string;
  lang?: string;
  rate?: number;
  pitch?: number;
  volume?: number;
}

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface AudioEffect {
  name: string;
  type: 'filter' | 'delay' | 'reverb' | 'distortion' | 'equalizer';
  parameters: Record<string, number>;
  node: AudioNode;
}

export interface AudioQueue {
  items: ArrayBuffer[];
  currentIndex: number;
  isPlaying: boolean;
  autoPlay: boolean;
  loop: boolean;
}

export interface LipSyncValue {
  value: number;
  timestamp: number;
  smoothed: number;
}

export interface AudioVisualizationData {
  type: 'frequency' | 'waveform' | 'volume';
  values: number[] | number;
  timestamp: number;
}

// Live2D相关类型
export interface ResourceModel {
  name: string;
  link: string;
  description?: string;
  category?: string;
}

export interface Live2DConfig {
  canvasId: string;
  modelPath?: string;
  resourcesPath?: string;
  audioEnabled?: boolean;
  lipSyncEnabled?: boolean;
  autoStart?: boolean;
  debug?: boolean;
}

export interface AudioConfig {
  sampleRate?: number;
  channels?: number;
  volume?: number;
  autoPlay?: boolean;
}

export interface LipSyncConfig {
  enabled: boolean;
  sensitivity?: number;
  smoothing?: number;
  minThreshold?: number;
}

export interface ModelConfig {
  scale?: number;
  position?: { x: number; y: number };
  rotation?: number;
  opacity?: number;
}

export interface APIConfig {
  baseURL: string;
  endpoints: {
    tts: string;
    asr: string;
    agent: string;
  };
  headers?: Record<string, string>;
  timeout?: number;
}

export interface Live2DModelSettings {
  expressions: string[];
  parameters: string[];
  physics: boolean;
  lipSync: boolean;
}

export interface Live2DExpression {
  id: string;
  name: string;
  parameters: Record<string, number>;
}

export interface Live2DParameter {
  id: string;
  name: string;
  value: number;
  min: number;
  max: number;
  defaultValue: number;
}