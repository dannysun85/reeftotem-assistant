/**
 * 统一的 Live2D 画布组件
 * 整合所有 Live2D 功能，提供简洁的使用接口
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useLive2D, Live2DState, Live2DActions } from '../hooks/useLive2D';
import { Live2DEngineConfig } from '../core/Live2DEngine';

/**
 * Live2D 画布组件属性
 */
export interface Live2DCanvasProps {
  // 画布配置
  width?: number;
  height?: number;
  className?: string;
  style?: React.CSSProperties;

  // Live2D 配置
  transparentBackground?: boolean;
  enablePhysics?: boolean;
  enableExpressions?: boolean;
  maxFPS?: number;

  // 模型配置
  autoStart?: boolean;
  preloadModels?: string[];

  // 交互配置
  enableMouseTracking?: boolean;
  enableTouchTracking?: boolean;

  // 事件回调
  onInitialized?: () => void;
  onModelSwitched?: (modelName: string) => void;
  onError?: (error: string) => void;
  onPerformanceUpdate?: (fps: number, frameCount: number) => void;

  // 调试显示
  showStatusOverlay?: boolean;

  // 外部传入的 Live2D 状态和操作（避免双重 useLive2D 调用）
  externalState?: Live2DState;
  externalActions?: Live2DActions;
  externalCanvasRef?: React.RefObject<HTMLCanvasElement>;
}

/**
 * Live2D 画布组件
 */
export const Live2DCanvas: React.FC<Live2DCanvasProps> = ({
  width = 800,
  height = 600,
  className = '',
  style = {},
  transparentBackground = true,
  enablePhysics = true,
  enableExpressions = true,
  maxFPS = 60,
  autoStart = true,
  preloadModels = [],
  enableMouseTracking = true,
  enableTouchTracking = true,
  onInitialized,
  onModelSwitched,
  onError,
  onPerformanceUpdate,
  showStatusOverlay = false,
  externalState,
  externalActions,
  externalCanvasRef
}) => {
  // 如果外部传入了 state/actions，跳过内部 hook 的事件监听和 cleanup
  // 避免重复事件注册和错误的 dispose 调用
  const hasExternalState = !!externalState;
  const internal = useLive2D(
    hasExternalState ? undefined : {
      width,
      height,
      transparentBackground,
      enablePhysics,
      enableExpressions,
      maxFPS
    },
    { skip: hasExternalState }
  );

  const state = externalState ?? internal.state;
  const actions = externalActions ?? internal.actions;
  const canvasRef = externalCanvasRef ?? internal.canvasRef;

  // Refs for tracking
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMousePosition = useRef({ x: 0, y: 0 });

  // 初始化（仅负责引擎初始化和启动渲染，不做模型切换）
  useEffect(() => {
    if (!canvasRef.current || state.isInitialized) {
      return;
    }

    let cancelled = false;

    const config: Live2DEngineConfig = {
      canvas: canvasRef.current,
      width,
      height,
      transparentBackground,
      enablePhysics,
      enableExpressions,
      maxFPS
    };

    const initializeAsync = async () => {
      const success = await actions.initialize(config);
      if (!success) {
        if (!cancelled) {
          onError?.('引擎初始化失败');
        }
        return;
      }

      if (cancelled) {
        return;
      }

      onInitialized?.();

      if (preloadModels.length > 0) {
        actions.preloadModels(preloadModels);
      }

      if (autoStart) {
        actions.startRendering();
      }
    };

    void initializeAsync();

    return () => {
      cancelled = true;
    };
  }, [
    state.isInitialized,
    width,
    height,
    transparentBackground,
    enablePhysics,
    enableExpressions,
    maxFPS,
    autoStart,
    preloadModels,
    actions,
    onInitialized,
    onError,
    canvasRef
  ]);

  // 鼠标追踪
  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!enableMouseTracking || !state.isInitialized) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // 归一化坐标 (0-1)
    const normalizedX = x / width;
    const normalizedY = y / height;

    actions.setEyeTracking(normalizedX, normalizedY);
    lastMousePosition.current = { x: normalizedX, y: normalizedY };
  }, [enableMouseTracking, state.isInitialized, width, height, actions, canvasRef]);

  // 触摸追踪
  const handleTouchMove = useCallback((event: React.TouchEvent<HTMLCanvasElement>) => {
    if (!enableTouchTracking || !state.isInitialized) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = event.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    // 归一化坐标 (0-1)
    const normalizedX = x / width;
    const normalizedY = y / height;

    actions.setEyeTracking(normalizedX, normalizedY);
    lastMousePosition.current = { x: normalizedX, y: normalizedY };
  }, [enableTouchTracking, state.isInitialized, width, height, actions, canvasRef]);

  // 窗口大小变化处理
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && state.isInitialized) {
        actions.resizeCanvas(containerRef.current.clientWidth, containerRef.current.clientHeight);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [state.isInitialized, actions]);

  // 性能更新回调
  useEffect(() => {
    if (onPerformanceUpdate) {
      onPerformanceUpdate(state.fps, state.frameCount);
    }
  }, [state.fps, state.frameCount, onPerformanceUpdate]);

  // 模型切换回调
  useEffect(() => {
    if (onModelSwitched && state.currentModel) {
      onModelSwitched(state.currentModel);
    }
  }, [state.currentModel, onModelSwitched]);

  // 错误处理回调
  useEffect(() => {
    if (onError && state.error) {
      onError(state.error);
    }
  }, [state.error, onError]);

  // 加载状态指示器
  const renderLoadingIndicator = () => {
    if (!showStatusOverlay) return null;
    if (!state.isLoading) return null;

    return (
      <div className="live2d-loading-indicator" style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        color: 'white',
        textShadow: '0 0 4px rgba(0,0,0,0.8)',
        pointerEvents: 'none'
      }}>
        <div>Loading Live2D...</div>
        <div style={{ fontSize: '12px', marginTop: '8px' }}>
          {state.loadProgress.toFixed(0)}%
        </div>
      </div>
    );
  };

  // 错误指示器
  const renderErrorIndicator = () => {
    if (!showStatusOverlay) return null;
    if (!state.error) return null;

    return (
      <div className="live2d-error-indicator" style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        textAlign: 'center',
        color: '#ff6b6b',
        backgroundColor: 'rgba(0,0,0,0.8)',
        padding: '16px',
        borderRadius: '8px',
        maxWidth: '80%',
        fontSize: '14px'
      }}>
        <div>Live2D Error</div>
        <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.8 }}>
          {state.error}
        </div>
      </div>
    );
  };

  // 性能指示器（开发环境）
  const renderPerformanceIndicator = () => {
    if (showStatusOverlay && import.meta.env.DEV) {
      return (
        <div className="live2d-performance-indicator" style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          fontSize: '10px',
          color: 'rgba(255,255,255,0.6)',
          backgroundColor: 'rgba(0,0,0,0.4)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontFamily: 'monospace',
          pointerEvents: 'none'
        }}>
          FPS: {state.fps} | Frame: {state.frameCount}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      ref={containerRef}
      className={`live2d-canvas-container ${className}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        ...style
      }}
    >
      <canvas
        ref={canvasRef as React.RefObject<HTMLCanvasElement>}
        id="live2dCanvas"
        className="live2d-canvas"
        width={width}
        height={height}
        onMouseMove={handleMouseMove}
        onTouchMove={handleTouchMove}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: enableMouseTracking ? 'grab' : 'default'
        }}
      />

      {renderLoadingIndicator()}
      {renderErrorIndicator()}
      {renderPerformanceIndicator()}
    </div>
  );
};

export default Live2DCanvas;
