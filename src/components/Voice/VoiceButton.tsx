import React, { useState, useCallback } from 'react';
import { Mic, MicOff, Pause, Play, Square } from 'lucide-react';

// 录音状态枚举
enum RecordingState {
  IDLE = 'idle',
  RECORDING = 'recording',
  PAUSED = 'paused'
}

// 语音控制按钮属性接口
interface VoiceButtonProps {
  isRecording: boolean;
  isPaused: boolean;
  volumeLevel: number;
  onStartRecording: () => Promise<void>;
  onStopRecording: () => Promise<void>;
  onPauseRecording: () => void;
  onResumeRecording: () => void;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  showVolumeIndicator?: boolean;
  variant?: 'primary' | 'secondary' | 'ghost';
  className?: string;
}

/**
 * 语音控制按钮组件
 * 提供录音、暂停、恢复等控制功能，带有音量指示器
 */
export const VoiceButton: React.FC<VoiceButtonProps> = ({
  isRecording,
  isPaused,
  volumeLevel,
  onStartRecording,
  onStopRecording,
  onPauseRecording,
  onResumeRecording,
  disabled = false,
  size = 'medium',
  showVolumeIndicator = true,
  variant = 'primary',
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [hoveredState, setHoveredState] = useState<string | null>(null);

  // 根据状态获取当前录音状态
  const getCurrentState = useCallback((): RecordingState => {
    if (isRecording && !isPaused) return RecordingState.RECORDING;
    if (isRecording && isPaused) return RecordingState.PAUSED;
    return RecordingState.IDLE;
  }, [isRecording, isPaused]);

  // 获取按钮尺寸
  const getSizeClasses = useCallback((): string => {
    switch (size) {
      case 'small':
        return 'w-12 h-12 text-sm';
      case 'medium':
        return 'w-16 h-16 text-base';
      case 'large':
        return 'w-20 h-20 text-lg';
      default:
        return 'w-16 h-16 text-base';
    }
  }, [size]);

  // 获取按钮样式
  const getButtonClasses = useCallback((): string => {
    const baseClasses = `
      ${getSizeClasses()}
      relative rounded-full flex items-center justify-center
      transition-all duration-300 ease-in-out
      focus:outline-none focus:ring-4
      ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
    `;

    const variantClasses = {
      primary: {
        idle: 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-300',
        recording: 'bg-red-500 hover:bg-red-600 text-white focus:ring-red-300 animate-pulse',
        paused: 'bg-yellow-500 hover:bg-yellow-600 text-white focus:ring-yellow-300'
      },
      secondary: {
        idle: 'bg-gray-200 hover:bg-gray-300 text-gray-700 focus:ring-gray-300',
        recording: 'bg-red-100 hover:bg-red-200 text-red-700 focus:ring-red-300',
        paused: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-700 focus:ring-yellow-300'
      },
      ghost: {
        idle: 'bg-transparent hover:bg-gray-100 text-gray-700 focus:ring-gray-300 border-2 border-gray-300',
        recording: 'bg-transparent hover:bg-red-100 text-red-700 focus:ring-red-300 border-2 border-red-300',
        paused: 'bg-transparent hover:bg-yellow-100 text-yellow-700 focus:ring-yellow-300 border-2 border-yellow-300'
      }
    };

    const currentState = getCurrentState();
    return `${baseClasses} ${variantClasses[variant][currentState]} ${className}`;
  }, [getSizeClasses, variant, getCurrentState, className, disabled]);

  // 处理按钮点击
  const handleButtonClick = useCallback(async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);

    try {
      const currentState = getCurrentState();

      switch (currentState) {
        case RecordingState.IDLE:
          await onStartRecording();
          break;
        case RecordingState.RECORDING:
          await onStopRecording();
          break;
        case RecordingState.PAUSED:
          if (isPaused) {
            onResumeRecording();
          } else {
            onPauseRecording();
          }
          break;
      }
    } catch (error) {
      console.error('语音控制操作失败:', error);
    } finally {
      setIsLoading(false);
    }
  }, [disabled, isLoading, getCurrentState, onStartRecording, onStopRecording, onPauseRecording, onResumeRecording, isPaused]);

  // 获取当前图标
  const getCurrentIcon = useCallback(() => {
    const currentState = getCurrentState();

    switch (currentState) {
      case RecordingState.IDLE:
        return <Mic size={size === 'small' ? 20 : size === 'medium' ? 24 : 32} />;
      case RecordingState.RECORDING:
        return <Square size={size === 'small' ? 20 : size === 'medium' ? 24 : 32} />;
      case RecordingState.PAUSED:
        return isPaused ? <Play size={size === 'small' ? 20 : size === 'medium' ? 24 : 32} /> : <Pause size={size === 'small' ? 20 : size === 'medium' ? 24 : 32} />;
      default:
        return <Mic size={size === 'small' ? 20 : size === 'medium' ? 24 : 32} />;
    }
  }, [getCurrentState, isPaused, size]);

  // 获取提示文本
  const getTooltipText = useCallback((): string => {
    const currentState = getCurrentState();

    switch (currentState) {
      case RecordingState.IDLE:
        return '开始录音';
      case RecordingState.RECORDING:
        return '停止录音';
      case RecordingState.PAUSED:
        return isPaused ? '恢复录音' : '暂停录音';
      default:
        return '语音控制';
    }
  }, [getCurrentState, isPaused]);

  // 音量指示器组件
  const VolumeIndicator = useCallback(() => {
    if (!showVolumeIndicator || getCurrentState() === RecordingState.IDLE) return null;

    return (
      <div className="absolute -top-1 -right-1 w-4 h-4">
        <div
          className="w-full h-full rounded-full bg-green-500 animate-pulse"
          style={{
            transform: `scale(${0.5 + volumeLevel / 200})`,
            opacity: 0.8 + (volumeLevel / 500)
          }}
        />
      </div>
    );
  }, [showVolumeIndicator, getCurrentState, volumeLevel]);

  return (
    <div className="voice-button-container relative inline-block">
      <button
        className={getButtonClasses()}
        onClick={handleButtonClick}
        onMouseEnter={() => setHoveredState(getCurrentState())}
        onMouseLeave={() => setHoveredState(null)}
        disabled={disabled || isLoading}
        title={getTooltipText()}
        aria-label={getTooltipText()}
      >
        {/* 按钮图标 */}
        <div className={`transition-transform duration-200 ${isLoading ? 'animate-spin' : ''}`}>
          {getCurrentIcon()}
        </div>

        {/* 音量指示器 */}
        <VolumeIndicator />

        {/* 录音状态指示器 */}
        {getCurrentState() === RecordingState.RECORDING && (
          <div className="absolute inset-0 rounded-full border-4 border-red-400 animate-ping opacity-75" />
        )}

        {/* 加载指示器 */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-full">
            <div className="w-1/2 h-1/2 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </button>

      {/* 悬停提示 */}
      {hoveredState && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap">
          {getTooltipText()}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-800" />
          </div>
        </div>
      )}

      {/* 状态文本 */}
      {size !== 'small' && (
        <div className="mt-2 text-center">
          <span className="text-sm font-medium text-gray-600">
            {getCurrentState() === RecordingState.IDLE && '点击录音'}
            {getCurrentState() === RecordingState.RECORDING && '录音中...'}
            {getCurrentState() === RecordingState.PAUSED && (isPaused ? '已暂停' : '暂停中')}
          </span>
        </div>
      )}
    </div>
  );
};

// 快捷录音按钮（简化版本）
interface QuickVoiceButtonProps {
  isRecording: boolean;
  onToggleRecording: () => Promise<void>;
  disabled?: boolean;
  size?: 'small' | 'medium' | 'large';
  className?: string;
}

export const QuickVoiceButton: React.FC<QuickVoiceButtonProps> = ({
  isRecording,
  onToggleRecording,
  disabled = false,
  size = 'medium',
  className = ''
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleToggle = async () => {
    if (disabled || isLoading) return;

    setIsLoading(true);
    try {
      await onToggleRecording();
    } catch (error) {
      console.error('快捷录音操作失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'small': return 'w-10 h-10';
      case 'medium': return 'w-12 h-12';
      case 'large': return 'w-14 h-14';
      default: return 'w-12 h-12';
    }
  };

  return (
    <button
      className={`
        ${getSizeClasses()}
        ${isRecording
          ? 'bg-red-500 hover:bg-red-600 animate-pulse'
          : 'bg-blue-500 hover:bg-blue-600'
        }
        text-white rounded-full flex items-center justify-center
        transition-all duration-200
        focus:outline-none focus:ring-4 focus:ring-blue-300
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      onClick={handleToggle}
      disabled={disabled || isLoading}
      title={isRecording ? '停止录音' : '开始录音'}
    >
      {isLoading ? (
        <div className="w-1/2 h-1/2 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : isRecording ? (
        <Square size={size === 'small' ? 16 : size === 'medium' ? 20 : 24} />
      ) : (
        <Mic size={size === 'small' ? 16 : size === 'medium' ? 20 : 24} />
      )}
    </button>
  );
};