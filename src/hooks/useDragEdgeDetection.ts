/**
 * useDragEdgeDetection Hook
 *
 * 提供Live2D窗口的智能边缘检测和拖拽约束功能
 * 集成Rust后端的屏幕边缘检测API，实现精确的窗口边界控制
 *
 * 功能特性：
 * 1. 实时屏幕边界检测
 * 2. 智能边缘碰撞预测
 * 3. 平滑的边界约束效果
 * 4. 多显示器支持
 * 5. 自定义边距设置
 * 6. 错误处理和恢复机制
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { isTauriEnvironment } from '../tauri-shim';
import { withDragErrorHandling, DragErrorType } from '../utils/dragErrorHandler';

// 类型定义
export interface ScreenBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DragConstraints {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  screen_bounds: ScreenBounds;
}

export interface ConstrainedPosition {
  x: number;
  y: number;
  is_constrained: boolean;
  constraint_edge?: string; // "left", "right", "top", "bottom", "left-top", etc.
}

export interface DragEdgeDetectionOptions {
  /** 边缘缓冲距离，默认10像素 */
  margin?: number;
  /** 是否启用平滑约束，默认true */
  smoothConstraint?: boolean;
  /** 约束回弹强度，0-1，默认0.3 */
  constraintStrength?: number;
  /** 是否启用调试模式，默认false */
  debug?: boolean;
  /** 边界检测更新间隔，默认100ms */
  updateInterval?: number;
}

export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  lastConstrainedPosition?: ConstrainedPosition;
}

export interface UseDragEdgeDetectionReturn {
  // 状态
  constraints: DragConstraints | null;
  isInitialized: boolean;
  error: string | null;

  // 拖拽状态
  dragState: DragState;

  // 方法
  initializeConstraints: () => Promise<void>;
  updateConstraints: () => Promise<void>;
  constrainPosition: (x: number, y: number) => Promise<ConstrainedPosition>;
  predictCollision: (deltaX: number, deltaY: number) => Promise<[boolean, string?]>;
  startDrag: (startX: number, startY: number) => void;
  updateDrag: (currentX: number, currentY: number) => Promise<ConstrainedPosition>;
  endDrag: () => void;

  // 实用方法
  refreshScreenInfo: () => Promise<void>;
  isNearEdge: (threshold?: number) => Promise<boolean>;
  getDistanceToEdges: () => Promise<{left: number, right: number, top: number, bottom: number}>;
}

// 默认配置
const DEFAULT_OPTIONS: Required<DragEdgeDetectionOptions> = {
  margin: 10,
  smoothConstraint: true,
  constraintStrength: 0.3,
  debug: false,
  updateInterval: 100,
};

// Hook实现
export const useDragEdgeDetection = (options: DragEdgeDetectionOptions = {}): UseDragEdgeDetectionReturn => {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // 状态管理
  const [constraints, setConstraints] = useState<DragConstraints | null>(null);
  const [isInitialized, setIsInitialized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // 拖拽状态
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
  });

  // Refs用于非状态数据
  const constraintsRef = useRef<DragConstraints | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isUpdatingRef = useRef<boolean>(false);

  // 调试日志
  const debugLog = useCallback((message: string, ...args: any[]) => {
    if (config.debug) {
      console.log(`[useDragEdgeDetection] ${message}`, ...args);
    }
  }, [config.debug]);

  // 错误处理
  const handleError = useCallback((err: any, context: string) => {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[useDragEdgeDetection] Error in ${context}:`, err);
    setError(errorMessage);
    debugLog(`Error: ${context} - ${errorMessage}`);
  }, [debugLog]);

  // 检查Tauri环境
  const checkTauriEnvironment = useCallback(() => {
    if (!isTauriEnvironment()) {
      throw new Error('Tauri environment not available');
    }
  }, []);

  // 初始化约束条件
  const initializeConstraints = useCallback(async (): Promise<void> => {
    return withDragErrorHandling(async () => {
      checkTauriEnvironment();
      debugLog('Initializing drag constraints...');

      if (isUpdatingRef.current) {
        debugLog('Already updating, skipping...');
        return;
      }

      isUpdatingRef.current = true;
      setError(null);

      const constraints = await invoke<DragConstraints>('calculate_drag_constraints', {
        margin: config.margin,
      });

      constraintsRef.current = constraints;
      setConstraints(constraints);
      setIsInitialized(true);

      debugLog('Constraints initialized:', constraints);
    }, 'initializeConstraints', {
      margin: config.margin,
    }).then(result => {
      isUpdatingRef.current = false;

      if (!result.success && result.error) {
        setError(result.error.message);
        debugLog('Initialization failed:', result.error);

        // 如果恢复失败，设置初始化失败状态
        if (!result.recovered && !result.fallbackUsed) {
          setIsInitialized(false);
        }
      }
    });
  }, [config.margin, checkTauriEnvironment, debugLog]);

  // 更新约束条件
  const updateConstraints = useCallback(async (): Promise<void> => {
    try {
      checkTauriEnvironment();
      debugLog('Updating drag constraints...');

      if (isUpdatingRef.current) {
        debugLog('Already updating, skipping...');
        return;
      }

      isUpdatingRef.current = true;

      const constraints = await invoke<DragConstraints>('calculate_drag_constraints', {
        margin: config.margin,
      });

      constraintsRef.current = constraints;
      setConstraints(constraints);

      debugLog('Constraints updated:', constraints);
    } catch (err) {
      handleError(err, 'updateConstraints');
    } finally {
      isUpdatingRef.current = false;
    }
  }, [config.margin, checkTauriEnvironment, debugLog, handleError]);

  // 约束位置到安全区域内
  const constrainPosition = useCallback(async (x: number, y: number): Promise<ConstrainedPosition> => {
    const result = await withDragErrorHandling(async () => {
      checkTauriEnvironment();
      debugLog(`Constraining position: (${x}, ${y})`);

      const constrained = await invoke<ConstrainedPosition>('constrain_window_position', {
        x,
        y,
        margin: config.margin,
      });

      debugLog('Position constrained:', constrained);
      return constrained;
    }, 'constrainPosition', {
      targetPosition: { x, y },
      margin: config.margin,
    });

    if (result.success && result.data) {
      return result.data;
    } else {
      // 返回原始位置作为fallback
      return {
        x,
        y,
        is_constrained: false,
      };
    }
  }, [config.margin, checkTauriEnvironment, debugLog]);

  // 预测边界碰撞
  const predictCollision = useCallback(async (deltaX: number, deltaY: number): Promise<[boolean, string?]> => {
    try {
      checkTauriEnvironment();
      debugLog(`Predicting collision for delta: (${deltaX}, ${deltaY})`);

      const [willCollide, edge] = await invoke<[boolean, string?]>('predict_boundary_collision', {
        deltaX,
        deltaY,
        margin: config.margin,
      });

      debugLog('Collision prediction:', { willCollide, edge });
      return [willCollide, edge];
    } catch (err) {
      handleError(err, 'predictCollision');
      return [false, undefined];
    }
  }, [config.margin, checkTauriEnvironment, debugLog, handleError]);

  // 开始拖拽
  const startDrag = useCallback((startX: number, startY: number) => {
    debugLog(`Starting drag at: (${startX}, ${startY})`);

    setDragState({
      isDragging: true,
      startX,
      startY,
      currentX: startX,
      currentY: startY,
    });
  }, [debugLog]);

  // 更新拖拽位置
  const updateDrag = useCallback(async (currentX: number, currentY: number): Promise<ConstrainedPosition> => {
    if (!dragState.isDragging) {
      throw new Error('Not currently dragging');
    }

    try {
      debugLog(`Updating drag to: (${currentX}, ${currentY})`);

      const constrained = await constrainPosition(currentX, currentY);

      setDragState(prev => ({
        ...prev,
        currentX,
        currentY,
        lastConstrainedPosition: constrained,
      }));

      debugLog('Drag updated:', constrained);
      return constrained;
    } catch (err) {
      handleError(err, 'updateDrag');
      throw err;
    }
  }, [dragState.isDragging, constrainPosition, debugLog, handleError]);

  // 结束拖拽
  const endDrag = useCallback(() => {
    debugLog('Ending drag');

    setDragState(prev => ({
      ...prev,
      isDragging: false,
      lastConstrainedPosition: undefined,
    }));
  }, [debugLog]);

  // 刷新屏幕信息
  const refreshScreenInfo = useCallback(async (): Promise<void> => {
    debugLog('Refreshing screen information...');
    await updateConstraints();
  }, [updateConstraints, debugLog]);

  // 检查是否靠近边缘
  const isNearEdge = useCallback(async (threshold: number = 50): Promise<boolean> => {
    try {
      if (!constraintsRef.current) {
        await initializeConstraints();
      }

      const windowBounds = await invoke<WindowBounds>('get_window_bounds');
      const constraints = constraintsRef.current!;

      const distanceToLeft = windowBounds.x - constraints.min_x;
      const distanceToRight = constraints.max_x - windowBounds.x;
      const distanceToTop = windowBounds.y - constraints.min_y;
      const distanceToBottom = constraints.max_y - windowBounds.y;

      const nearEdge = distanceToLeft < threshold ||
                      distanceToRight < threshold ||
                      distanceToTop < threshold ||
                      distanceToBottom < threshold;

      debugLog('Near edge check:', {
        threshold,
        distances: { left: distanceToLeft, right: distanceToRight, top: distanceToTop, bottom: distanceToBottom },
        nearEdge
      });

      return nearEdge;
    } catch (err) {
      handleError(err, 'isNearEdge');
      return false;
    }
  }, [initializeConstraints, debugLog, handleError]);

  // 获取到各边缘的距离
  const getDistanceToEdges = useCallback(async (): Promise<{left: number, right: number, top: number, bottom: number}> => {
    try {
      if (!constraintsRef.current) {
        await initializeConstraints();
      }

      const windowBounds = await invoke<WindowBounds>('get_window_bounds');
      const constraints = constraintsRef.current!;

      const distances = {
        left: windowBounds.x - constraints.min_x,
        right: constraints.max_x - windowBounds.x,
        top: windowBounds.y - constraints.min_y,
        bottom: constraints.max_y - windowBounds.y,
      };

      debugLog('Distance to edges:', distances);
      return distances;
    } catch (err) {
      handleError(err, 'getDistanceToEdges');
      return { left: 0, right: 0, top: 0, bottom: 0 };
    }
  }, [initializeConstraints, debugLog, handleError]);

  // 初始化
  useEffect(() => {
    if (isTauriEnvironment()) {
      initializeConstraints();
    } else {
      setError('Tauri environment not available');
    }

    return () => {
      if (updateTimerRef.current) {
        clearInterval(updateTimerRef.current);
      }
    };
  }, [initializeConstraints]);

  // 定期更新约束条件（处理屏幕分辨率变化等）
  useEffect(() => {
    if (isInitialized && config.updateInterval > 0) {
      updateTimerRef.current = setInterval(() => {
        updateConstraints();
      }, config.updateInterval);

      return () => {
        if (updateTimerRef.current) {
          clearInterval(updateTimerRef.current);
        }
      };
    }
  }, [isInitialized, config.updateInterval, updateConstraints]);

  return {
    // 状态
    constraints,
    isInitialized,
    error,

    // 拖拽状态
    dragState,

    // 方法
    initializeConstraints,
    updateConstraints,
    constrainPosition,
    predictCollision,
    startDrag,
    updateDrag,
    endDrag,

    // 实用方法
    refreshScreenInfo,
    isNearEdge,
    getDistanceToEdges,
  };
};

export default useDragEdgeDetection;