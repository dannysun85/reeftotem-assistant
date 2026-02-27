/**
 * 统一的 Live2D React Hook
 * 整合所有 Live2D 功能，提供简洁的 API
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { live2DEngine, Live2DEngineConfig } from '../core/Live2DEngine';
import { live2DResourceManager, Live2DModelConfig, ResourceLoadState } from '../core/Live2DResourceManager';
import { Live2DManager } from '@/lib/live2d/Live2DManager';

/**
 * Live2D Hook 状态
 */
export interface Live2DState {
  // 引擎状态
  isInitialized: boolean;
  isRendering: boolean;
  currentModel: string | null;

  // 加载状态
  isLoading: boolean;
  loadProgress: number;
  error: string | null;

  // 性能信息
  fps: number;
  frameCount: number;

  // 可用模型
  availableModels: Live2DModelConfig[];
}

/**
 * Live2D Hook 功能
 */
export interface Live2DActions {
  // 初始化和控制
  initialize: (config: Live2DEngineConfig) => Promise<boolean>;
  startRendering: () => void;
  stopRendering: () => void;
  dispose: () => void;

  // 模型管理
  switchModel: (modelName: string) => Promise<boolean>;
  preloadModels: (modelNames: string[]) => Promise<void>;

  // 交互控制
  triggerExpression: (expressionName: string) => void;
  triggerMotion: (motionName: string, motionIndex?: number) => void;
  setEyeTracking: (x: number, y: number) => void;
  setLipSync: (value: number) => void;

  // 画布管理
  resizeCanvas: (width: number, height: number) => void;

  // 资源管理
  getModelConfig: (modelName: string) => Live2DModelConfig | undefined;
  getLoadState: (modelName: string) => ResourceLoadState | undefined;
}

/**
 * Live2D 统一 Hook
 *
 * 使用示例：
 * ```tsx
 * const { state, actions, canvasRef } = useLive2D({
 *   width: 800,
 *   height: 600,
 *   transparentBackground: true
 * });
 * ```
 */
export function useLive2D(config?: Partial<Live2DEngineConfig>, options?: { skip?: boolean }): {
  state: Live2DState;
  actions: Live2DActions;
  canvasRef: React.RefObject<HTMLCanvasElement>;
} {
  const skip = options?.skip ?? false;
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef(live2DEngine);
  const resourceManagerRef = useRef(live2DResourceManager);

  // 状态
  const [state, setState] = useState<Live2DState>({
    isInitialized: false,
    isRendering: false,
    currentModel: null,
    isLoading: false,
    loadProgress: 0,
    error: null,
    fps: 60,
    frameCount: 0,
    availableModels: []
  });

  // 更新状态的工具函数
  const updateState = useCallback((updates: Partial<Live2DState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  // 初始化引擎
  const initialize = useCallback(async (engineConfig: Live2DEngineConfig): Promise<boolean> => {
    updateState({ isLoading: true, error: null });

    try {
      const success = await engineRef.current.initialize(engineConfig);

      if (success) {
        updateState({
          isInitialized: true,
          isLoading: false,
          availableModels: resourceManagerRef.current.getAvailableModels()
        });
      } else {
        updateState({
          isLoading: false,
          error: '引擎初始化失败'
        });
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      updateState({
        isLoading: false,
        error: errorMessage
      });
      return false;
    }
  }, [updateState]);

  // Live2DCanvas 会负责初始化，避免重复初始化导致状态错乱

  // 启动渲染
  const startRendering = useCallback(() => {
    engineRef.current.startRendering();
    updateState({ isRendering: true });
  }, [updateState]);

  // 停止渲染
  const stopRendering = useCallback(() => {
    engineRef.current.stopRendering();
    updateState({ isRendering: false });
  }, [updateState]);

  // 销毁引擎
  const dispose = useCallback(() => {
    engineRef.current.dispose();
    updateState({
      isInitialized: false,
      isRendering: false,
      currentModel: null
    });
  }, [updateState]);

  // 切换模型
  const switchModel = useCallback(async (modelName: string): Promise<boolean> => {
    updateState({ isLoading: true, error: null });

    try {
      const success = await engineRef.current.switchModel(modelName);

      if (success) {
        updateState({
          currentModel: modelName,
          isLoading: false
        });
      } else {
        updateState({
          isLoading: false,
          error: `模型切换失败: ${modelName}`
        });
      }

      return success;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      updateState({
        isLoading: false,
        error: errorMessage
      });
      return false;
    }
  }, [updateState]);

  // 预加载模型
  const preloadModels = useCallback(async (modelNames: string[]): Promise<void> => {
    try {
      await resourceManagerRef.current.preloadModels(modelNames);
    } catch (error) {
      console.error('模型预加载失败:', error);
    }
  }, []);

  // 触发表情
  const triggerExpression = useCallback((expressionName: string): void => {
    engineRef.current.triggerExpression(expressionName);
  }, []);

  // 触发动作
  const triggerMotion = useCallback((motionName: string, motionIndex?: number): void => {
    engineRef.current.triggerMotion(motionName, motionIndex);
  }, []);

  // 设置视线追踪
  const setEyeTracking = useCallback((x: number, y: number): void => {
    engineRef.current.setEyeTracking(x, y);
  }, []);

  // 设置唇形同步（通过 Live2DManager 外部口型值，由 model update loop 读取）
  const setLipSync = useCallback((value: number): void => {
    Live2DManager.getInstance().setExternalLipSync(value);
  }, []);

  // 调整画布尺寸
  const resizeCanvas = useCallback((width: number, height: number): void => {
    engineRef.current.resizeCanvas(width, height);
  }, []);

  // 获取模型配置
  const getModelConfig = useCallback((modelName: string): Live2DModelConfig | undefined => {
    return resourceManagerRef.current.getModelConfig(modelName);
  }, []);

  // 获取加载状态
  const getLoadState = useCallback((modelName: string): ResourceLoadState | undefined => {
    return resourceManagerRef.current.getLoadState(modelName);
  }, []);

  // 事件监听器设置（skip 模式下不注册，避免重复监听和错误 dispose）
  useEffect(() => {
    if (skip) return;

    const engine = engineRef.current;
    const resourceManager = resourceManagerRef.current;

    // 引擎事件监听
    const handleEngineInitialized = () => {
      updateState({ isInitialized: true });
    };

    const handleEngineError = ({ error }: any) => {
      updateState({ error: error.message || String(error) });
    };

    const handleRenderingStarted = () => {
      updateState({ isRendering: true });
    };

    const handleRenderingStopped = () => {
      updateState({ isRendering: false });
    };

    const handleModelSwitched = ({ modelName }: any) => {
      updateState({ currentModel: modelName });
    };

    const handleModelSwitchError = ({ modelName, error }: any) => {
      updateState({ error: `模型切换失败 (${modelName}): ${error}` });
    };

    const handlePerformanceUpdate = ({ fps, frameCount }: any) => {
      updateState({ fps, frameCount });
    };

    // 资源管理器事件监听
    const handleLoadStateChanged = ({ modelName, state: loadState }: any) => {
      if (modelName === state.currentModel) {
        updateState({
          isLoading: loadState.isLoading,
          loadProgress: loadState.progress
        });
      }
    };

    const handleModelLoadError = ({ modelName, error }: any) => {
      if (modelName === state.currentModel) {
        updateState({ error: `模型加载失败 (${modelName}): ${error}` });
      }
    };

    // 注册事件监听器
    engine.addEventListener('engineInitialized', handleEngineInitialized);
    engine.addEventListener('engineError', handleEngineError);
    engine.addEventListener('renderingStarted', handleRenderingStarted);
    engine.addEventListener('renderingStopped', handleRenderingStopped);
    engine.addEventListener('modelSwitched', handleModelSwitched);
    engine.addEventListener('modelSwitchError', handleModelSwitchError);
    engine.addEventListener('performanceUpdate', handlePerformanceUpdate);

    resourceManager.addEventListener('loadStateChanged', handleLoadStateChanged);
    resourceManager.addEventListener('modelLoadError', handleModelLoadError);

    // 清理函数
    return () => {
      engine.removeEventListener('engineInitialized', handleEngineInitialized);
      engine.removeEventListener('engineError', handleEngineError);
      engine.removeEventListener('renderingStarted', handleRenderingStarted);
      engine.removeEventListener('renderingStopped', handleRenderingStopped);
      engine.removeEventListener('modelSwitched', handleModelSwitched);
      engine.removeEventListener('modelSwitchError', handleModelSwitchError);
      engine.removeEventListener('performanceUpdate', handlePerformanceUpdate);

      resourceManager.removeEventListener('loadStateChanged', handleLoadStateChanged);
      resourceManager.removeEventListener('modelLoadError', handleModelLoadError);
    };
  }, [skip, state.currentModel, updateState]);

  // 组件卸载时清理（skip 模式下不 dispose，避免外部 hook 的引擎被意外销毁）
  useEffect(() => {
    if (skip) return;
    return () => {
      if (state.isInitialized) {
        dispose();
      }
    };
  }, [skip, state.isInitialized, dispose]);

  // 构造 actions 对象
  const actions: Live2DActions = {
    initialize,
    startRendering,
    stopRendering,
    dispose,
    switchModel,
    preloadModels,
    triggerExpression,
    triggerMotion,
    setEyeTracking,
    setLipSync,
    resizeCanvas,
    getModelConfig,
    getLoadState
  };

  return {
    state,
    actions,
    canvasRef
  };
}
