/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from 'react';
// @ts-ignore - JS 文件没有类型声明
import { useLive2DCore } from '../components/Live2D/useLive2DCore';
// @ts-ignore - JS 文件没有类型声明
import { useLive2DInit } from '../components/Live2D/useLive2DInit';
// @ts-ignore - JS 文件没有类型声明
import { Live2DCanvas } from '../components/Live2D/Live2DComponents';
import ContextMenu from '../components/Live2D/ContextMenu';
// 重新启用表情系统功能
import { useLive2DExpressions } from '../hooks/useLive2DExpressions';
// 启用参数控制系统
import { useLive2DParameters } from '../hooks/useLive2DParameters';
// 眼神追踪配置
import { EyeTrackingConfig } from '../configs/eye-tracking-config';
// 启用物理引擎系统
import { useLive2DPhysics } from '../hooks/useLive2DPhysics';
// 启用唇形同步系统
import { useLive2DLipSync } from '../hooks/useLive2DLipSync';
// Tauri 环境检测
import { isTauriEnvironment } from '../tauri-shim';
// LAppDelegate 导入 (用于模型切换)
import { LAppDelegate } from '../lib/live2d/src/lappdelegate';
// ResourceModel 类型导入
import { RESOURCE_TYPE } from '../lib/live2d/types';
// 路径工具导入
import { getLive2DModelPath, getEnvironmentInfo } from '../utils/tauriPathUtils';
// 拖拽边缘检测Hook导入
import { useDragEdgeDetection } from '../hooks/useDragEdgeDetection';
// 边缘碰撞检测器导入
import EdgeCollisionDetector, { defaultCollisionDetector } from '../utils/edgeCollisionDetector';

/**
 * Live2D窗口组件（重构版）
 * 
 * 职责：
 * 1. 监听托盘菜单和右键菜单的模型切换事件
 * 2. 管理Live2D模型的加载和渲染
 * 3. 处理用户交互（鼠标跟踪、右键菜单、拖拽）
 * 4. 集成表情、参数、物理引擎、唇形同步等高级功能
 * 
 * 数据流：
 * Tauri事件 -> setCurrentPersona -> changeCharacter -> Live2D渲染
 * 
 * @version 2.0.0 - 合并Live2DWindow和RealLive2DComponent，消除双重状态管理
 */
export const Live2DWindow: React.FC = () => {
  console.log('🔥 Live2DWindow组件开始渲染...');
  
  // ========== Refs ==========
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // ========== Hooks ==========
  const { loadLive2DCore } = useLive2DCore();
  const { initializeLive2D } = useLive2DInit(loadLive2DCore);
  
    // Live2D 表情系统
  const {
    triggerRandomExpression,
    triggerHappyExpression,
    triggerSurprisedExpression,
    triggerSadExpression,
    triggerAngryExpression,
    // scheduleExpression,
    // clearScheduledExpression,
    // getAvailableExpressions
  } = useLive2DExpressions();
  
  // 参数控制系统
  const {
    optimizedEyeTracking,
    // setHeadRotation,
    // setBodyAngle,
    setBreathing,
    // resetParameters,
    // getCurrentParameters
  } = useLive2DParameters();
  
  // 物理引擎系统
  const {
    activatePhysics,
    // triggerBreeze,
    // triggerHairMovement,
    // triggerClothingMovement,
    resetPhysics,
    // getPhysicsConfig
  } = useLive2DPhysics();
  
  // 唇形同步系统
  const {
    activateLipSync,
    deactivateLipSync,
    // testLipSync,
    // processTTSData,
    // getLipSyncIds,
    // configureLipSync,
    // getCurrentLipSyncLevel
  } = useLive2DLipSync();
  
  // ========== State ==========
  const [currentPersona, setCurrentPersona] = useState<string>("HaruGreeter");
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });
  // const [opacity, setOpacity] = useState<number>(100);
  // const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(true);
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState<boolean>(true);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const [isModelLoaded, setIsModelLoaded] = useState<boolean>(false);
  
  // ========== Refs for synchronous state ==========
  // 使用 ref 实现同步状态检查,避免 React 异步更新导致的时序问题
  const isDraggingRef = useRef<boolean>(false);
  const [isMouseDown, setIsMouseDown] = useState<boolean>(false);
  
  // 🔧 新增：防止重复初始化的标志位
  const isInitializedRef = useRef<boolean>(false);
  // 🔧 新增：防止并发切换模型的锁
  const isSwitchingModelRef = useRef<boolean>(false);

  // 🔧 debugMode需要在useDragEdgeDetection之前定义
  const [debugMode, setDebugMode] = useState<boolean>(false);

  // 其他功能开关
  const [physicsEnabled, setPhysicsEnabled] = useState<boolean>(false);
  const [breathingEnabled, setBreathingEnabled] = useState<boolean>(false);
  const [lipSyncEnabled, setLipSyncEnabled] = useState<boolean>(false);

  // ========== 拖拽边缘检测系统 ==========
  const {
    constraints,
    isInitialized: edgeDetectionInitialized,
    error: edgeDetectionError,
    dragState,
    initializeConstraints,
    constrainPosition,
    predictCollision,
    startDrag: startDragDetection,
    updateDrag: updateDragDetection,
    endDrag: endDragDetection,
    refreshScreenInfo,
    isNearEdge,
    getDistanceToEdges,
  } = useDragEdgeDetection({
    margin: 10,
    smoothConstraint: true,
    debug: debugMode, // 使用调试模式设置
    updateInterval: 500, // 每500ms更新一次约束
  });

  // 拖拽状态refs（用于同步状态检查）
  const dragStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const lastWindowPosRef = useRef<{ x: number; y: number } | null>(null);
  const isManualDraggingRef = useRef<boolean>(false);

  // 边缘碰撞检测器实例
  const collisionDetectorRef = useRef<EdgeCollisionDetector>(defaultCollisionDetector);

  // 调试: 打印初始状态
  console.log('🔍 Live2DWindow 组件初始化:', {
    eyeTrackingEnabled,
    isDragging,
    isHovering,
    currentPersona,
    edgeDetectionInitialized,
    hasConstraints: !!constraints,
    edgeDetectionError,
    debugMode,
  });

  // ========== 初始化Live2D ==========
  useEffect(() => {
    // 🔧 优化：防止重复初始化
    if (isInitializedRef.current) {
      console.log('⚠️ Live2D已初始化，跳过重复初始化');
      return;
    }
    
    console.log('🚀 首次初始化Live2D，初始模型:', currentPersona);
    
    // 🔍 检查 Tauri 环境
    console.log('🔍 Tauri 环境检查:', {
      windowExists: typeof window !== 'undefined',
      isTauriEnv: isTauriEnvironment(),
      tauriApiAvailable: '__TAURI__' in window || '__TAURI_INTERNALS__' in window
    });
    
    const timer = setTimeout(() => {
      initializeLive2D(
        canvasRef,
        undefined, // status callback
        (error: any) => {
          console.error('❌ Live2D初始化错误:', error);
          setIsModelLoaded(false);
          isInitializedRef.current = false; // 失败时允许重试
        }, // error callback
        () => {
          // 模型加载完成回调
          console.log('✅ Live2D初始化完成，首个模型加载成功');
          console.log('👁️ 眼神追踪使用 React onMouseMove 事件（不依赖 Tauri API）');
          setIsModelLoaded(true);
          isInitializedRef.current = true; // 标记为已初始化
          
          console.log('🔍 初始化状态验证:', {
            isInitialized: true,
            isModelLoaded: true,
            eyeTrackingEnabled,
            currentPersona
          });
        }, // loaded callback
        currentPersona
      );
    }, 100);
    
    return () => {
      clearTimeout(timer);
      // 注意：不在这里重置 isInitializedRef，避免组件重渲染时重新初始化
    };
  }, []); // 🔧 优化：只在组件挂载时初始化一次，永不重新初始化
  
  // ========== 监听模型切换事件 ==========
  useEffect(() => {
    console.log('✅ 设置模型切换监听器 (已启用)');
    
    let unlistenFn: (() => void) | null = null;
    
    const setupEventListener = async () => {
      try {
        // 检查 Tauri 环境
        if (typeof window === 'undefined' || !('__TAURI__' in window)) {
          console.warn('⚠️ Tauri 环境不可用，跳过模型切换监听器设置');
          return;
        }
        
        // 直接导入 Tauri v2 的 listen 函数
        const { listen } = await import('@tauri-apps/api/event');
        
        console.log('✅ Tauri event API 已导入，设置模型切换监听器');
        
        // Tauri v2 的 listen 需要泛型类型
        interface SwitchModelPayload {
          model_name: string;
        }
        
        unlistenFn = await listen<SwitchModelPayload>('switch_live2d_model', (event) => {
          console.log('🎯 收到模型切换事件:', event);
          
          const { model_name } = event.payload;
          if (model_name) {
            console.log('� 执行模型切换，目标:', model_name);
            setCurrentPersona(model_name);
            setTimeout(() => {
              handleModelSwitch(model_name);
            }, 50);
          }
        });
        
        console.log('✅ 模型切换监听器设置成功', typeof unlistenFn);
      } catch (error) {
        console.error('❌ 设置监听器失败:', error);
      }
    };
    
    setupEventListener();
    
    return () => {
      if (unlistenFn) {
        console.log('🧹 清理模型切换监听器');
        unlistenFn();
      }
    };
  }, []); // 只在挂载时设置一次

  // ========== 拖拽边缘约束监听器 ==========
  useEffect(() => {
    if (!edgeDetectionInitialized || !isTauriEnvironment()) {
      return;
    }

    const handleGlobalMouseMove = async (event: MouseEvent) => {
      // 只在手动拖拽状态下处理
      if (!isManualDraggingRef.current || !dragState.isDragging) {
        return;
      }

      try {
        // 更新碰撞检测器的运动历史
        collisionDetectorRef.current.updateMotionHistory(
          { x: event.clientX, y: event.clientY },
          Date.now()
        );

        // 预测碰撞
        const deltaX = event.clientX - dragState.currentX;
        const deltaY = event.clientY - dragState.currentY;

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          const [willCollide, edge] = await predictCollision(deltaX, deltaY);

          if (debugMode && willCollide) {
            console.log('⚠️ 预测碰撞:', { edge, deltaX, deltaY });
          }

          // 更新拖拽位置
          const constrained = await updateDragDetection(event.clientX, event.clientY);

          if (debugMode && constrained.is_constrained) {
            console.log('🎯 位置已约束:', constrained);
          }
        }
      } catch (err) {
        console.error('❌ 拖拽边缘约束处理失败:', err);
      }
    };

    // 添加全局监听器
    document.addEventListener('mousemove', handleGlobalMouseMove);

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
    };
  }, [
    edgeDetectionInitialized,
    dragState.isDragging,
    dragState.currentX,
    dragState.currentY,
    predictCollision,
    updateDragDetection,
    debugMode
  ]);

  // 边缘状态监听（用于调试和UI反馈）
  useEffect(() => {
    if (!edgeDetectionInitialized || !debugMode) {
      return;
    }

    const checkEdgeStatus = async () => {
      if (!isManualDraggingRef.current) {
        try {
          const nearEdge = await isNearEdge(30);
          const distances = await getDistanceToEdges();

          if (nearEdge) {
            console.log('📍 靠近边缘:', distances);
          }
        } catch (err) {
          console.error('❌ 边缘状态检查失败:', err);
        }
      }
    };

    const interval = setInterval(checkEdgeStatus, 1000);
    return () => clearInterval(interval);
  }, [edgeDetectionInitialized, debugMode, isNearEdge, getDistanceToEdges]);

  // 屏幕分辨率变化监听
  useEffect(() => {
    if (!edgeDetectionInitialized || !isTauriEnvironment()) {
      return;
    }

    const handleScreenChange = () => {
      console.log('🖥️ 检测到屏幕变化，刷新约束...');
      refreshScreenInfo();
    };

    // 监听屏幕方向变化和分辨率变化
    window.addEventListener('resize', handleScreenChange);
    window.addEventListener('orientationchange', handleScreenChange);

    return () => {
      window.removeEventListener('resize', handleScreenChange);
      window.removeEventListener('orientationchange', handleScreenChange);
    };
  }, [edgeDetectionInitialized, refreshScreenInfo]);

  // ========== 模型切换处理函数 ==========
  const handleModelSwitch = useCallback((modelName: string) => {
    console.log('🔄 handleModelSwitch 执行, 目标模型:', modelName);
    
    // 🔧 优化：检查是否已初始化
    if (!isInitializedRef.current) {
      console.error('❌ Live2D尚未初始化，无法切换模型');
      return;
    }
    
    // 🔧 优化：防止并发切换
    if (isSwitchingModelRef.current) {
      console.warn('⚠️ 模型正在切换中，忽略新的切换请求');
      return;
    }
    
    // 🔧 优化：防止切换到相同模型
    if (currentPersona === modelName) {
      console.log('ℹ️ 目标模型与当前模型相同，跳过切换');
      return;
    }
    
    console.log('🔍 切换前状态:', {
      from: currentPersona,
      to: modelName,
      isInitialized: isInitializedRef.current,
      isSwitching: isSwitchingModelRef.current
    });

    try {
      // 🔒 加锁
      isSwitchingModelRef.current = true;
      
      const appDelegate = LAppDelegate.getInstance();
      console.log('🔍 appDelegate 实例:', {
        exists: !!appDelegate,
        type: typeof appDelegate,
        hasChangeCharacter: typeof appDelegate?.changeCharacter,
        hasNotifyActivity: typeof appDelegate?.notifyActivity
      });

      if (!appDelegate) {
        console.error('❌ LAppDelegate 实例不存在');
        isSwitchingModelRef.current = false; // 🔓 解锁
        return;
      }

      if (typeof appDelegate.changeCharacter !== 'function') {
        console.error('❌ changeCharacter 方法不存在');
        isSwitchingModelRef.current = false; // 🔓 解锁
        return;
      }

      // 使用统一的路径处理函数
      const modelPath = getLive2DModelPath(modelName);

      const characterModel = {
        resource_id: 'menu_switch',
        name: modelName,
        type: RESOURCE_TYPE.CHARACTER,
        link: modelPath
      };

      console.log('🔍 模型路径:', modelPath, '环境信息:', getEnvironmentInfo());

      console.log('🚀 调用LAppDelegate.changeCharacter:', characterModel);
      appDelegate.changeCharacter(characterModel);
      console.log('✅ 模型切换命令已发送');

      // 🔧 优化：在模型切换成功后再更新状态（延迟更新，等待模型加载完成）
      setTimeout(() => {
        setCurrentPersona(modelName);
        localStorage.setItem('currentPersona', modelName);
        console.log('✅ 状态已更新:', modelName);
        
        // 🔓 解锁（延迟解锁，确保模型切换流程完全结束）
        setTimeout(() => {
          isSwitchingModelRef.current = false;
          console.log('🔓 模型切换锁已释放');
        }, 1000); // 1秒后解锁，确保不会立即触发新的切换
      }, 500);

      // 通知渲染循环保持活跃
      if (typeof appDelegate.notifyActivity === 'function') {
        appDelegate.notifyActivity();
        console.log('✅ 已通知渲染循环活跃');
      }
    } catch (error) {
      console.error('❌ handleModelSwitch 执行失败:', error);
      isSwitchingModelRef.current = false; // 🔓 解锁
    }
  }, [currentPersona]); // 🔧 优化：添加 currentPersona 依赖，用于检查是否切换到相同模型
  
  // ========== 鼠标事件处理 ==========
  // 全局鼠标移动 - 眼神追踪 (不需要点击)
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    // 降低日志频率到 1% - 眼神追踪已确认工作
    const shouldLog = Math.random() < 0.01;
    
    if (shouldLog) {
      console.log('🖱️ handleMouseMove 触发', {
        isModelLoaded,
        eyeTrackingEnabled,
        isMouseDown,
        isDraggingRef: isDraggingRef.current,
        mouse: { x: e.clientX, y: e.clientY }
      });
    }
    
    // ✅ 三重检查避免拖拽时触发眼神追踪:
    // 1. 模型已加载
    // 2. 眼神追踪启用
    // 3. 鼠标未按下 (防止拖拽时追踪)
    // 4. 非拖拽状态 (使用同步 ref 检查)
    if (
      isModelLoaded && 
      eyeTrackingEnabled && 
      !isMouseDown &&           // ✅ 鼠标按下时不追踪
      !isDraggingRef.current    // ✅ 使用 ref 进行同步检查
    ) {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        // 传递完整的6个参数给 optimizedEyeTracking
        const result = optimizedEyeTracking(
          e.clientX,           // mouseX
          e.clientY,           // mouseY
          rect.left,           // canvasX
          rect.top,            // canvasY
          rect.width,          // canvasWidth
          rect.height          // canvasHeight
        );
        
        if (shouldLog) {
          console.log('✅ 眼神追踪执行:', {
            mouse: { x: e.clientX, y: e.clientY },
            rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
            result
          });
        }
      } else if (shouldLog) {
        console.warn('⚠️ containerRef 为空');
      }
    } else if (shouldLog && (isMouseDown || isDraggingRef.current)) {
      console.log('🚫 拖拽中,跳过眼神追踪');
    } else if (shouldLog) {
      console.warn('⚠️ 眼神追踪条件未满足:', { 
        isModelLoaded, 
        eyeTrackingEnabled,
        isMouseDown,
        isDragging: isDraggingRef.current
      });
    }
  }, [isModelLoaded, eyeTrackingEnabled, isMouseDown, optimizedEyeTracking]);
  
  const handleMouseLeave = () => {
    // ✅ 鼠标离开也重置拖拽状态
    isDraggingRef.current = false;
    setIsMouseDown(false);
    setIsDragging(false);
    
    if (eyeTrackingEnabled) {
      // 鼠标离开时,添加平滑过渡动画,眼神缓慢回到中心
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // 使用配置的延迟时间,让眼神有短暂停留感,更自然
        setTimeout(() => {
          optimizedEyeTracking(
            centerX,
            centerY,
            rect.left,
            rect.top,
            rect.width,
            rect.height
          );
        }, EyeTrackingConfig.resetDelay);
      }
    }
    setIsHovering(false);
  };
  
  // 拖拽处理 - 按下鼠标开始拖拽 (优先级高于点击)
  const handleMouseDown = useCallback(async (e: React.MouseEvent) => {
    console.log('🖱️ handleMouseDown 被触发', {
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
      target: e.target,
      edgeDetectionInitialized,
      hasConstraints: !!constraints,
    });

    // 只处理左键,忽略右键(右键用于菜单)
    if (e.button !== 0) {
      console.log('⚠️ 不是左键点击，忽略');
      return;
    }

    // 阻止默认行为和事件冒泡,防止触发其他事件
    e.preventDefault();
    e.stopPropagation();

    // ✅ 立即同步设置拖拽标志 (防止眼神追踪在异步期间被触发)
    isDraggingRef.current = true;
    setIsMouseDown(true);
    setIsDragging(true);
    isManualDraggingRef.current = true;

    // 记录拖拽开始位置
    dragStartPosRef.current = { x: e.clientX, y: e.clientY };

    console.log('✅ 拖拽标志已设置 (同步)', {
      isDraggingRef: isDraggingRef.current,
      isMouseDown: true,
      isManualDragging: isManualDraggingRef.current,
      dragStartPos: dragStartPosRef.current,
    });

    // 初始化边缘检测约束（如果尚未初始化）
    if (!edgeDetectionInitialized && isTauriEnvironment()) {
      try {
        console.log('🔄 初始化边缘检测约束...');
        await initializeConstraints();
        console.log('✅ 边缘检测约束初始化成功');
      } catch (err) {
        console.error('❌ 边缘检测约束初始化失败:', err);
      }
    }

    // 启动边缘检测拖拽
    if (edgeDetectionInitialized) {
      try {
        console.log('🎯 启动边缘检测拖拽...');
        startDragDetection(e.clientX, e.clientY);

        // 更新碰撞检测器的运动历史
        collisionDetectorRef.current.updateMotionHistory({ x: e.clientX, y: e.clientY });

        console.log('✅ 边缘检测拖拽已启动');
      } catch (err) {
        console.error('❌ 启动边缘检测拖拽失败:', err);
      }
    }

    // ✅ 只在 Tauri 环境中调用拖拽命令（作为fallback）
    if (isTauriEnvironment()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        console.log('🚀 调用 Tauri start_manual_drag 命令...');
        await invoke('start_manual_drag');
        console.log('✅ start_manual_drag 命令成功');
      } catch (err) {
        console.error('❌ 启动拖拽失败:', err);
        // 失败时重置所有标志
        isDraggingRef.current = false;
        setIsMouseDown(false);
        setIsDragging(false);
        isManualDraggingRef.current = false;
        dragStartPosRef.current = null;
      }
    } else {
      console.warn('⚠️ 非 Tauri 环境,无法拖拽');
      // 浏览器环境中无法拖拽,立即重置
      setTimeout(() => {
        isDraggingRef.current = false;
        setIsMouseDown(false);
        setIsDragging(false);
        isManualDraggingRef.current = false;
        dragStartPosRef.current = null;
      }, 100);
    }
  }, [
    edgeDetectionInitialized,
    constraints,
    initializeConstraints,
    startDragDetection
  ]);
  
  // 拖拽结束
  const handleMouseUp = useCallback(() => {
    console.log('🖱️ handleMouseUp - 鼠标松开', {
      isManualDragging: isManualDraggingRef.current,
      edgeDetectionInitialized,
      hasDragState: dragState.isDragging,
    });

    // ✅ 同步重置所有拖拽标志
    isDraggingRef.current = false;
    setIsMouseDown(false);
    setIsDragging(false);
    isManualDraggingRef.current = false;

    // 结束边缘检测拖拽
    if (edgeDetectionInitialized && dragState.isDragging) {
      try {
        console.log('🏁 结束边缘检测拖拽...');
        endDragDetection();
        console.log('✅ 边缘检测拖拽已结束');
      } catch (err) {
        console.error('❌ 结束边缘检测拖拽失败:', err);
      }
    }

    // 清理拖拽相关状态
    dragStartPosRef.current = null;
    lastWindowPosRef.current = null;

    // 清理碰撞检测器历史（可选）
    if (debugMode) {
      collisionDetectorRef.current.clearHistory();
    }

    console.log('✅ 所有拖拽状态已重置');
  }, [edgeDetectionInitialized, dragState.isDragging, endDragDetection, debugMode]);
  
  // 点击事件 - 触发表情 (在拖拽完成后)
  const handleClick = useCallback((e: React.MouseEvent) => {
    // 如果刚刚拖拽过,不触发表情
    if (isDragging) return;
    
    // 点击触发随机表情
    if (e.button === 0) { // 左键
      triggerRandomExpression();
    }
  }, [isDragging, triggerRandomExpression]);
  
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };
  
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };
  
  // ========== 右键菜单切换模型 ==========
  const switchToModel = useCallback(async (modelName: string) => {
    console.log('🎯 右键菜单 switchToModel 调用:', modelName);
    console.log('🔍 当前状态:', {
      currentPersona,
      targetModel: modelName,
      isInitialized: isInitializedRef.current,
      isSwitching: isSwitchingModelRef.current
    });
    
    try {
      // 🔧 优化：不再在这里立即更新状态，而是由 handleModelSwitch 在模型加载成功后更新
      // 这样可以确保状态与实际加载的模型保持同步
      handleModelSwitch(modelName);
      console.log('✅ handleModelSwitch 已调用，等待模型加载完成后更新状态');
    } catch (error) {
      console.error('❌ switchToModel 失败:', error);
    }
  }, [handleModelSwitch, currentPersona]);
  
  // ========== 菜单项定义 ==========
  const menuItems = [
    {
      id: 'models',
      label: '👥 切换模型',
      children: [
        {
          id: 'HaruGreeter',
          label: currentPersona === 'HaruGreeter' ? '👋 Haru Greeter ✓' : '👋 Haru Greeter',
          action: () => switchToModel('HaruGreeter')
        },
        {
          id: 'Haru',
          label: currentPersona === 'Haru' ? '🌸 Haru ✓' : '🌸 Haru',
          action: () => switchToModel('Haru')
        },
        {
          id: 'Kei',
          label: currentPersona === 'Kei' ? '💼 Kei ✓' : '💼 Kei',
          action: () => switchToModel('Kei')
        },
        {
          id: 'Chitose',
          label: currentPersona === 'Chitose' ? '🌸 Chitose ✓' : '🌸 Chitose',
          action: () => switchToModel('Chitose')
        },
        {
          id: 'Epsilon',
          label: currentPersona === 'Epsilon' ? '🚀 Epsilon ✓' : '🚀 Epsilon',
          action: () => switchToModel('Epsilon')
        },
        {
          id: 'Hibiki',
          label: currentPersona === 'Hibiki' ? '🎸 Hibiki ✓' : '🎸 Hibiki',
          action: () => switchToModel('Hibiki')
        },
        {
          id: 'Hiyori',
          label: currentPersona === 'Hiyori' ? '🌺 Hiyori ✓' : '🌺 Hiyori',
          action: () => switchToModel('Hiyori')
        },
        {
          id: 'Izumi',
          label: currentPersona === 'Izumi' ? '💎 Izumi ✓' : '💎 Izumi',
          action: () => switchToModel('Izumi')
        },
        {
          id: 'Mao',
          label: currentPersona === 'Mao' ? '🔥 Mao ✓' : '🔥 Mao',
          action: () => switchToModel('Mao')
        },
        {
          id: 'Rice',
          label: currentPersona === 'Rice' ? '🍚 Rice ✓' : '🍚 Rice',
          action: () => switchToModel('Rice')
        },
        {
          id: 'Shizuku',
          label: currentPersona === 'Shizuku' ? '🍃 Shizuku ✓' : '🍃 Shizuku',
          action: () => switchToModel('Shizuku')
        },
        {
          id: 'Tsumiki',
          label: currentPersona === 'Tsumiki' ? '🎀 Tsumiki ✓' : '🎀 Tsumiki',
          action: () => switchToModel('Tsumiki')
        }
      ]
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
          action: () => triggerHappyExpression()
        },
        {
          id: 'surprised',
          label: '😲 惊讶',
          action: () => triggerSurprisedExpression()
        },
        {
          id: 'sad',
          label: '😢 悲伤',
          action: () => triggerSadExpression()
        },
        {
          id: 'angry',
          label: '😠 愤怒',
          action: () => triggerAngryExpression()
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
        setEyeTrackingEnabled(!eyeTrackingEnabled);
        // 如果关闭眼神跟随,重置眼睛到中心位置
        if (eyeTrackingEnabled) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const centerX = rect.left + rect.width / 2;
            const centerY = rect.top + rect.height / 2;
            optimizedEyeTracking(
              centerX,
              centerY,
              rect.left,
              rect.top,
              rect.width,
              rect.height
            );
          }
        }
      }
    },
    {
      id: 'physics',
      label: physicsEnabled ? '🌪️ 关闭物理引擎' : '🌪️ 开启物理引擎',
      action: () => {
        setPhysicsEnabled(!physicsEnabled);
        if (!physicsEnabled) {
          activatePhysics();
        } else {
          resetPhysics();
        }
      }
    },
    {
      id: 'breathing',
      label: breathingEnabled ? '💨 关闭呼吸效果' : '💨 开启呼吸效果',
      action: () => {
        setBreathingEnabled(!breathingEnabled);
        setBreathing(!breathingEnabled);
      }
    },
    {
      id: 'lipSync',
      label: lipSyncEnabled ? '🗣️ 关闭唇形同步' : '🗣️ 开启唇形同步',
      action: () => {
        setLipSyncEnabled(!lipSyncEnabled);
        if (!lipSyncEnabled) {
          activateLipSync();
        } else {
          deactivateLipSync();
        }
      }
    },
    {
      type: 'separator' as const
    },
    {
      id: 'voice-interaction',
      label: '🎤 语音交互演示',
      action: async () => {
        try {
          // 直接在默认浏览器中打开本地服务器的语音交互页面
          if (typeof window !== 'undefined') {
            // 检测是否在Tauri环境中
            const isTauri = '__TAURI__' in window;

            if (isTauri) {
              // 在Tauri环境中，使用shell.open打开浏览器
              const { invoke } = await import('@tauri-apps/api/core');
              await invoke('shell_open', {
                url: 'http://localhost:1420/voice-interaction'
              });
            } else {
              // 在浏览器环境中，直接跳转
              window.open('http://localhost:1420/voice-interaction', '_blank');
            }
          }
        } catch (err) {
          console.error('打开语音交互演示失败:', err);
          // 备用方案：直接跳转
          window.open('http://localhost:1420/voice-interaction', '_blank');
        }
      }
    },
    {
      id: 'debug',
      label: debugMode ? '关闭调试模式' : '开启调试模式',
      action: () => {
        setDebugMode(!debugMode);
        console.log(`调试模式已${debugMode ? '关闭' : '开启'}`);
      }
    },
    {
      type: 'separator' as const
    },
    {
      id: 'edge-detection-info',
      label: '📏 边缘检测信息',
      children: [
        {
          id: 'refresh-constraints',
          label: '🔄 刷新约束',
          action: async () => {
            try {
              await refreshScreenInfo();
              console.log('✅ 约束已刷新');
            } catch (err) {
              console.error('❌ 刷新约束失败:', err);
            }
          }
        },
        {
          id: 'check-edges',
          label: '📍 检查边缘距离',
          action: async () => {
            try {
              const distances = await getDistanceToEdges();
              const nearEdge = await isNearEdge(50);
              console.log('📍 边缘距离信息:', { distances, nearEdge });
            } catch (err) {
              console.error('❌ 检查边缘失败:', err);
            }
          }
        },
        {
          id: 'constraint-status',
          label: constraints ? '✅ 约束已启用' : '❌ 约束未初始化',
          action: () => {
            console.log('🔧 约束状态:', {
              initialized: edgeDetectionInitialized,
              hasConstraints: !!constraints,
              error: edgeDetectionError,
              constraints: constraints,
            });
          }
        }
      ]
    },
    {
      type: 'separator' as const
    },
    {
      id: 'exit',
      label: '退出',
      action: async () => {
        try {
          if (typeof window !== 'undefined' && '__TAURI__' in window) {
            const { invoke } = await import('@tauri-apps/api/core');
            await invoke('exit_app');
          }
        } catch (err) {
          console.error('退出应用失败:', err);
        }
      }
    }
  ];
  
  // ========== 渲染 ==========
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
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : (isHovering ? 'pointer' : 'default')
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Live2DCanvas canvasRef={canvasRef} />
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
