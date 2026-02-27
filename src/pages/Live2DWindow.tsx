/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Live2DCanvas, live2DResourceManager, useLive2D } from '../live2d';
import { isTauriEnvironment } from '../tauri-shim';
import Live2DActionPanel from '../components/Live2D/Live2DActionPanel';
import { createLogger } from '../utils/Logger';
import { useLive2DExpressions } from '../hooks/useLive2DExpressions';
import { useModelInteraction } from '../hooks/useModelInteraction';
import { getModelInteractionConfig } from '../data/model-interactions';

const logger = createLogger('Live2DWindow');

const DEFAULT_PERSONA = 'HaruGreeter';

const getInitialPersona = () => {
  if (typeof window === 'undefined') {
    return DEFAULT_PERSONA;
  }
  const stored = localStorage.getItem('currentPersona');
  if (!stored || !stored.trim()) {
    return DEFAULT_PERSONA;
  }
  // Validate against available Live2D models
  const available = live2DResourceManager.getAvailableModels();
  const match = available.find(m => m.name === stored.trim());
  if (!match) {
    // Invalid model name stored (e.g. agent name) — reset to default
    localStorage.setItem('currentPersona', DEFAULT_PERSONA);
    return DEFAULT_PERSONA;
  }
  return stored.trim();
};

export const Live2DWindow: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [panelVisible, setPanelVisible] = useState(false);
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<string>(getInitialPersona());
  const [canvasSize, setCanvasSize] = useState({ width: 250, height: 350 });
  const [canvasOpacity, setCanvasOpacity] = useState(0);

  const currentPersonaRef = useRef(currentPersona);
  const isInitializedRef = useRef(false);
  const pendingModelRef = useRef<string | null>(null);
  const hasInitialSwitchRef = useRef(false);
  const transitioningRef = useRef(false);

  const { state: live2dState, actions, canvasRef: live2dCanvasRef } = useLive2D({
    width: 250,
    height: 350,
    transparentBackground: true,
    enablePhysics: true,
    enableExpressions: true,
    maxFPS: 60
  });

  const { switchModel, triggerExpression, triggerMotion, setEyeTracking, setLipSync } = actions;
  const { triggerRandomExpression } = useLive2DExpressions();
  const { executeInteraction, handleModelClick } = useModelInteraction({
    triggerMotion,
    triggerExpression,
    triggerRandomExpression,
  });

  useEffect(() => {
    currentPersonaRef.current = currentPersona;
  }, [currentPersona]);

  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const updateSize = () => {
      const target = containerRef.current;
      if (!target) {
        return;
      }
      const width = Math.max(1, Math.round(target.clientWidth));
      const height = Math.max(1, Math.round(target.clientHeight));
      setCanvasSize(prev => {
        if (prev.width === width && prev.height === height) {
          return prev;
        }
        return { width, height };
      });
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  const handleModelSwitched = useCallback((modelName: string) => {
    currentPersonaRef.current = modelName;
    setCurrentPersona(modelName);
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentPersona', modelName);
    }
    hasInitialSwitchRef.current = true;
    if (!transitioningRef.current) {
      setCanvasOpacity(1);
    }
  }, []);

  const switchToModel = useCallback(async (modelName: string) => {
    if (!modelName) {
      return;
    }
    // Validate model name against available models
    const models = live2DResourceManager.getAvailableModels();
    if (!models.find(m => m.name === modelName)) {
      logger.warn('无效的模型名称，忽略切换', { modelName });
      return;
    }
    if (modelName === currentPersonaRef.current && live2dState.currentModel === modelName) {
      return;
    }
    if (transitioningRef.current) {
      return;
    }

    logger.info('切换模型请求', { modelName });
    transitioningRef.current = true;

    setCanvasOpacity(0);
    await new Promise(r => setTimeout(r, 250));

    const success = await switchModel(modelName);
    if (!success) {
      logger.warn('模型切换失败', { modelName });
      setCanvasOpacity(1);
      transitioningRef.current = false;
      return;
    }

    await new Promise(r => setTimeout(r, 600));

    setCanvasOpacity(1);
    transitioningRef.current = false;
  }, [switchModel, live2dState.currentModel]);

  useEffect(() => {
    isInitializedRef.current = live2dState.isInitialized;
    if (live2dState.isInitialized && pendingModelRef.current) {
      const modelName = pendingModelRef.current;
      pendingModelRef.current = null;
      void switchToModel(modelName);
    }
  }, [live2dState.isInitialized, switchToModel]);

  useEffect(() => {
    if (!live2dState.isInitialized || hasInitialSwitchRef.current) {
      return;
    }

    hasInitialSwitchRef.current = true;
    void switchToModel(currentPersonaRef.current);
  }, [live2dState.isInitialized, switchToModel]);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    const setupEventListeners = async () => {
      try {
        if (!isTauriEnvironment()) {
          logger.warn('非 Tauri 环境，跳过事件监听');
          return;
        }

        const { listen } = await import('@tauri-apps/api/event');

        interface SwitchModelPayload {
          model_name: string;
        }

        const listener = await listen<SwitchModelPayload>('switch_live2d_model', (event) => {
          const modelName = event.payload?.model_name;
          if (!modelName) {
            return;
          }

          logger.info('收到模型切换事件', { modelName });
          if (modelName === currentPersonaRef.current) {
            return;
          }

          if (!isInitializedRef.current) {
            pendingModelRef.current = modelName;
            logger.warn('引擎未初始化，缓存切换请求', { modelName });
            return;
          }

          void switchToModel(modelName);
        });

        const exprListener = await listen<{ expression: string }>('live2d_expression', (event) => {
          const { expression } = event.payload;
          logger.info('收到表情事件', { expression });
          triggerExpression(expression);
        });

        const motionListener = await listen<{ motion: string }>('live2d_motion', (event) => {
          const { motion } = event.payload;
          logger.info('收到动作事件', { motion });
          triggerMotion(motion);
        });

        const lipSyncListener = await listen<{ text: string; data: any[] }>('live2d_lip_sync', () => {
          // Legacy event - now using live2d_lip_sync_level instead
        });

        const lipSyncLevelListener = await listen<number>('live2d_lip_sync_level', (event) => {
          setLipSync(event.payload);
        });

        if (disposed) {
          listener();
          exprListener();
          motionListener();
          lipSyncListener();
          lipSyncLevelListener();
          return;
        }

        unlisten = () => {
          listener();
          exprListener();
          motionListener();
          lipSyncListener();
          lipSyncLevelListener();
        };
        logger.info('事件监听器设置成功');
      } catch (error) {
        logger.error('设置事件监听器失败', error);
      }
    };

    void setupEventListeners();
    return () => {
      disposed = true;
      if (unlisten) {
        unlisten();
      }
    };
  }, [switchToModel, triggerExpression, triggerMotion, setLipSync]);

  const availableModels = useMemo(() => {
    if (live2dState.availableModels.length > 0) {
      return live2dState.availableModels;
    }
    return live2DResourceManager.getAvailableModels();
  }, [live2dState.availableModels]);

  // Current model display name
  const currentDisplayName = useMemo(() => {
    const model = availableModels.find(m => m.name === currentPersona);
    return model?.displayName || currentPersona;
  }, [availableModels, currentPersona]);

  // Current model interactions
  const currentInteractions = useMemo(() => {
    return getModelInteractionConfig(currentPersona)?.menuInteractions ?? [];
  }, [currentPersona]);

  // Model prev/next switching
  const handleSwitchPrev = useCallback(() => {
    if (availableModels.length <= 1) return;
    const idx = availableModels.findIndex(m => m.name === currentPersona);
    const prevIdx = (idx - 1 + availableModels.length) % availableModels.length;
    setPanelVisible(false);
    void switchToModel(availableModels[prevIdx].name);
  }, [availableModels, currentPersona, switchToModel]);

  const handleSwitchNext = useCallback(() => {
    if (availableModels.length <= 1) return;
    const idx = availableModels.findIndex(m => m.name === currentPersona);
    const nextIdx = (idx + 1) % availableModels.length;
    setPanelVisible(false);
    void switchToModel(availableModels[nextIdx].name);
  }, [availableModels, currentPersona, switchToModel]);

  const handleToggleEyeTracking = useCallback(() => {
    const next = !eyeTrackingEnabled;
    setEyeTrackingEnabled(next);
    if (!next) {
      setEyeTracking(0.5, 0.5);
    }
  }, [eyeTrackingEnabled, setEyeTracking]);

  const handleHideModel = useCallback(async () => {
    setPanelVisible(false);
    try {
      if (isTauriEnvironment()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('hide_live2d_window');
      }
    } catch (err) {
      logger.error('隐藏模型失败', err);
    }
  }, []);

  const handleExit = useCallback(async () => {
    setPanelVisible(false);
    try {
      if (isTauriEnvironment()) {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('exit_app');
      }
    } catch (err) {
      logger.error('退出应用失败', err);
    }
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setPanelVisible(true);
  }, []);

  const closePanel = useCallback(() => {
    setPanelVisible(false);
  }, []);

  const handleMouseDown = useCallback(async (event: React.MouseEvent) => {
    if (event.button !== 0) {
      return;
    }

    setIsDragging(true);

    if (!isTauriEnvironment()) {
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('start_manual_drag');
    } catch (err) {
      logger.error('启动拖拽失败', err);
      setIsDragging(false);
    }
  }, []);

  const handleMouseUp = useCallback(async () => {
    setIsDragging(false);

    if (!isTauriEnvironment()) {
      return;
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('end_manual_drag');
    } catch (err) {
      logger.error('停止拖拽失败', err);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    if (isDragging) {
      return;
    }

    handleModelClick(currentPersona);
  }, [isDragging, handleModelClick, currentPersona]);

  return (
    <div
      ref={containerRef}
      className="live2d-window"
      style={{
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'stretch',
        alignItems: 'stretch',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : 'default'
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <div style={{
        width: '100%',
        height: '100%',
        opacity: canvasOpacity,
        transition: 'opacity 0.25s ease-in-out',
      }}>
        <Live2DCanvas
          width={canvasSize.width}
          height={canvasSize.height}
          transparentBackground={true}
          enableMouseTracking={eyeTrackingEnabled && !isDragging}
          enableTouchTracking={eyeTrackingEnabled}
          enablePhysics={true}
          enableExpressions={true}
          maxFPS={60}
          autoStart={true}
          showStatusOverlay={false}
          externalState={live2dState}
          externalActions={actions}
          externalCanvasRef={live2dCanvasRef}
          onInitialized={() => {
            logger.info('Live2D 引擎初始化完成');
          }}
          onModelSwitched={handleModelSwitched}
          onError={(error) => {
            logger.error('Live2D 错误', error);
          }}
          onPerformanceUpdate={(fps, frameCount) => {
            if (import.meta.env.DEV && frameCount % 300 === 0) {
              logger.debug('Live2D 性能', { fps, frameCount });
            }
          }}
          style={{
            width: '100%',
            height: '100%'
          }}
        />
      </div>

      <Live2DActionPanel
        visible={panelVisible}
        onClose={closePanel}
        currentModel={currentPersona}
        currentModelDisplayName={currentDisplayName}
        onSwitchPrev={handleSwitchPrev}
        onSwitchNext={handleSwitchNext}
        interactions={currentInteractions}
        onExecuteInteraction={(item) => { executeInteraction(item); closePanel(); }}
        eyeTrackingEnabled={eyeTrackingEnabled}
        onToggleEyeTracking={handleToggleEyeTracking}
        onHideModel={handleHideModel}
        onExit={handleExit}
      />
    </div>
  );
};

export default Live2DWindow;
