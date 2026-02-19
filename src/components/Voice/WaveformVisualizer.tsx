import React, { useRef, useEffect, useState, useCallback } from 'react';

// 波形可视化组件属性接口
interface WaveformVisualizerProps {
  isRecording: boolean;
  volumeLevel: number;
  width?: number;
  height?: number;
  barCount?: number;
  color?: string;
  backgroundColor?: string;
  borderRadius?: number;
  animationSpeed?: number;
}

/**
 * 实时音频波形可视化组件
 * 根据音量级别显示动态波形效果
 */
export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({
  isRecording,
  volumeLevel,
  width = 200,
  height = 60,
  barCount = 20,
  color = '#3b82f6',
  backgroundColor = 'rgba(59, 130, 246, 0.1)',
  borderRadius = 8,
  animationSpeed = 50
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const [bars, setBars] = useState<number[]>(Array(barCount).fill(0));

  // 生成随机波形数据
  const generateWaveformData = useCallback(() => {
    const newBars = Array(barCount).fill(0).map(() => {
      // 基础随机值
      let value = Math.random() * 0.3;

      // 如果正在录制，根据音量级别调整
      if (isRecording && volumeLevel > 0) {
        // 添加音量影响
        value += (volumeLevel / 100) * 0.7;

        // 添加一些变化
        value += Math.sin(Date.now() * 0.001) * 0.1;
      }

      // 确保值在合理范围内
      return Math.max(0, Math.min(1, value));
    });

    return newBars;
  }, [isRecording, volumeLevel, barCount]);

  // 绘制波形
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 清除画布
    ctx.clearRect(0, 0, width, height);

    // 设置背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, width, height);

    const barWidth = width / barCount;
    const maxHeight = height * 0.8; // 最大高度为画布高度的80%

    bars.forEach((bar, index) => {
      const barHeight = bar * maxHeight;
      const x = index * barWidth + barWidth * 0.1; // 留出间隙
      const y = (height - barHeight) / 2; // 居中对齐
      const actualBarWidth = barWidth * 0.8; // 实际条形宽度

      // 设置颜色渐变
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);

      if (isRecording) {
        // 录制时的渐变色
        gradient.addColorStop(0, color);
        gradient.addColorStop(1, color + '80'); // 添加透明度
      } else {
        // 静录制时的颜色
        gradient.addColorStop(0, color + '40');
        gradient.addColorStop(1, color + '20');
      }

      ctx.fillStyle = gradient;

      // 绘制圆角矩形
      ctx.beginPath();
      ctx.roundRect(x, y, actualBarWidth, barHeight, [actualBarWidth / 2, actualBarWidth / 2, 0, 0]);
      ctx.fill();
    });
  }, [bars, width, height, barCount, backgroundColor, color, isRecording]);

  // 动画循环
  const animate = useCallback(() => {
    if (isRecording) {
      setBars(generateWaveformData());
      animationRef.current = requestAnimationFrame(animate);
    }
  }, [isRecording, generateWaveformData]);

  // 更新波形数据
  useEffect(() => {
    if (isRecording) {
      animate();
    } else {
      // 静录制时逐渐降低波形
      const fadeInterval = setInterval(() => {
        setBars(prevBars =>
          prevBars.map(bar => Math.max(0, bar * 0.9))
        );
      }, 100);

      return () => clearInterval(fadeInterval);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, animate]);

  // 绘制波形
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  return (
    <div className="waveform-visualizer" style={{
      width: `${width}px`,
      height: `${height}px`,
      borderRadius: `${borderRadius}px`,
      overflow: 'hidden'
    }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        style={{
          display: 'block',
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

// 音量指示器组件
interface VolumeIndicatorProps {
  volumeLevel: number;
  isRecording: boolean;
  size?: number;
  color?: string;
}

export const VolumeIndicator: React.FC<VolumeIndicatorProps> = ({
  volumeLevel,
  isRecording,
  size = 40,
  color = '#3b82f6'
}) => {
  const [displayVolume, setDisplayVolume] = useState(0);

  // 平滑音量变化
  useEffect(() => {
    const targetVolume = isRecording ? volumeLevel : 0;
    const smoothingFactor = 0.2;

    const smoothVolume = () => {
      setDisplayVolume(prev => {
        const diff = targetVolume - prev;
        const newVolume = prev + diff * smoothingFactor;

        // 如果差距很小，直接设为目标值
        if (Math.abs(diff) < 0.5) {
          return targetVolume;
        }

        return newVolume;
      });
    };

    const interval = setInterval(smoothVolume, 50);
    return () => clearInterval(interval);
  }, [volumeLevel, isRecording]);

  return (
    <div
      className="volume-indicator"
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: isRecording
          ? `radial-gradient(circle, ${color}33 0%, ${color}66 50%, ${color}cc 100%)`
          : '#e5e7eb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        transition: 'background 0.3s ease'
      }}
    >
      {/* 中心圆点 */}
      <div
        style={{
          width: `${size * 0.3}px`,
          height: `${size * 0.3}px`,
          borderRadius: '50%',
          backgroundColor: isRecording ? color : '#9ca3af',
          transition: 'all 0.3s ease',
          transform: `scale(${1 + displayVolume / 100})`
        }}
      />

      {/* 音量波纹效果 */}
      {isRecording && displayVolume > 10 && (
        <div
          style={{
            position: 'absolute',
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: '50%',
            border: `2px solid ${color}66`,
            animation: 'pulse 1s infinite',
            transform: `scale(${1 + displayVolume / 200})`
          }}
        />
      )}

      {/* 脉冲动画样式 */}
      <style>{`
        @keyframes pulse {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(1.5);
          }
        }
      `}</style>
    </div>
  );
};