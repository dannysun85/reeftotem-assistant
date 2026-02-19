/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Live2DCanvas, live2DResourceManager, useLive2D } from '../live2d';
import { isTauriEnvironment } from '../tauri-shim';
import ContextMenu from '../components/Live2D/ContextMenu';
import { createLogger } from '../utils/Logger';
import { useLive2DExpressions } from '../hooks/useLive2DExpressions';

const logger = createLogger('Live2DWindow');

const getInitialPersona = () => {
  if (typeof window === 'undefined') {
    return 'HaruGreeter';
  }
  const stored = localStorage.getItem('currentPersona');
  if (!stored) {
    return 'HaruGreeter';
  }
  const normalized = stored.trim();
  return normalized.length > 0 ? normalized : 'HaruGreeter';
};

export const Live2DWindow: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [currentPersona, setCurrentPersona] = useState<string>(getInitialPersona());
  const [canvasSize, setCanvasSize] = useState({ width: 350, height: 500 });
  const [canvasOpacity, setCanvasOpacity] = useState(0); // 初始为0，首次加载也带淡入

  const currentPersonaRef = useRef(currentPersona);
  const isInitializedRef = useRef(false);
  const pendingModelRef = useRef<string | null>(null);
  const hasInitialSwitchRef = useRef(false);
  const transitioningRef = useRef(false);

  const { state: live2dState, actions, canvasRef: live2dCanvasRef } = useLive2D({
    width: 350,
    height: 500,
    transparentBackground: true,
    enablePhysics: true,
    enableExpressions: true,
    maxFPS: 60
  });

  const { switchModel, triggerExpression, triggerMotion, setEyeTracking } = actions;
  const { triggerRandomExpression } = useLive2DExpressions();

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
    // 确保模型加载后显示（首次加载或事件驱动的切换）
    if (!transitioningRef.current) {
      setCanvasOpacity(1);
    }
  }, []);

  const switchToModel = useCallback(async (modelName: string) => {
    if (!modelName) {
      return;
    }
    if (modelName === currentPersonaRef.current && live2dState.currentModel === modelName) {
      return;
    }
    if (transitioningRef.current) {
      return; // 正在切换中，忽略重复请求
    }

    logger.info('切换模型请求', { modelName });
    transitioningRef.current = true;

    // 1. 淡出 (200ms)
    setCanvasOpacity(0);
    await new Promise(r => setTimeout(r, 250));

    // 2. 切换模型（异步加载）
    const success = await switchModel(modelName);
    if (!success) {
      logger.warn('模型切换失败', { modelName });
      setCanvasOpacity(1);
      transitioningRef.current = false;
      return;
    }

    // 3. 等待模型加载和首帧渲染
    await new Promise(r => setTimeout(r, 600));

    // 4. 淡入 (200ms)
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

        if (disposed) {
          listener();
          return;
        }

        unlisten = listener;
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
  }, [switchToModel]);

  const availableModels = useMemo(() => {
    if (live2dState.availableModels.length > 0) {
      return live2dState.availableModels;
    }
    return live2DResourceManager.getAvailableModels();
  }, [live2dState.availableModels]);

  const menuItems = useMemo(() => {
    const modelItems = availableModels.map((model) => ({
      id: model.name,
      label: currentPersona === model.name ? `✅ ${model.displayName}` : model.displayName,
      action: () => {
        void switchToModel(model.name);
      }
    }));

    return [
      {
        id: 'models',
        label: '👥 切换模型',
        children: modelItems
      },
      {
        type: 'separator' as const
      },
      {
        id: 'expressions',
        label: '😊 表情测试',
        children: [
          {
            id: 'random',
            label: '🎲 随机表情',
            action: () => triggerRandomExpression()
          },
          {
            id: 'happy',
            label: '😄 开心',
            action: () => triggerExpression('happy')
          },
          {
            id: 'surprised',
            label: '😲 惊讶',
            action: () => triggerExpression('surprised')
          },
          {
            id: 'sad',
            label: '😢 悲伤',
            action: () => triggerExpression('sad')
          }
        ]
      },
      {
        type: 'separator' as const
      },
      {
        id: 'eyeTracking',
        label: eyeTrackingEnabled ? '👁️ 关闭眼神跟随' : '👁️ 开启眼神跟随',
        action: () => {
          const next = !eyeTrackingEnabled;
          setEyeTrackingEnabled(next);
          if (!next) {
            setEyeTracking(0.5, 0.5);
          }
        }
      },
      {
        id: 'motion',
        label: '🎬 触发动作',
        action: () => triggerMotion('tap')
      },
      {
        type: 'separator' as const
      },
      {
        id: 'exit',
        label: '退出',
        action: async () => {
          try {
            if (isTauriEnvironment()) {
              const { invoke } = await import('@tauri-apps/api/core');
              await invoke('exit_app');
            }
          } catch (err) {
            logger.error('退出应用失败', err);
          }
        }
      }
    ];
  }, [availableModels, currentPersona, eyeTrackingEnabled, switchToModel, triggerExpression, triggerMotion, triggerRandomExpression, setEyeTracking]);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      visible: true,
      x: event.clientX,
      y: event.clientY
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
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

    triggerRandomExpression();
  }, [isDragging, triggerRandomExpression]);

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

      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
        menuItems={menuItems}
      />
    </div>
  );
};

export default Live2DWindow;
