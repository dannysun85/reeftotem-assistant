/**
 * Drag Edge Detection Type Definitions
 *
 * 为拖拽边缘检测系统提供完整的TypeScript类型定义
 */

// Rust结构体的TypeScript映射
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
  constraint_edge?: string;
}

// Tauri命令类型定义
export interface TauriCommands {
  // 屏幕边缘检测命令
  get_screen_bounds: () => Promise<ScreenBounds>;
  get_window_bounds: () => Promise<WindowBounds>;
  calculate_drag_constraints: (params: { margin?: number }) => Promise<DragConstraints>;
  constrain_window_position: (params: { x: number; y: number; margin?: number }) => Promise<ConstrainedPosition>;
  predict_boundary_collision: (params: { delta_x: number; delta_y: number; margin?: number }) => Promise<[boolean, string?]>;
  set_constrained_window_position: (params: { x: number; y: number; margin?: number }) => Promise<ConstrainedPosition>;

  // 现有命令
  start_manual_drag: () => Promise<void>;
  get_window_position: () => Promise<[number, number]>;
  set_window_position: (params: { x: number; y: number }) => Promise<void>;
}

// 事件类型定义
export interface DragEvents {
  'drag-start': { x: number; y: number };
  'drag-move': { x: number; y: number; constrained: ConstrainedPosition };
  'drag-end': { x: number; y: number };
  'edge-collision': { edge: string; depth: number; position: ConstrainedPosition };
  'constraint-violation': { type: string; position: ConstrainedPosition };
  'screen-resolution-changed': { oldBounds: ScreenBounds; newBounds: ScreenBounds };
}

// Hook选项类型
export interface DragEdgeDetectionOptions {
  margin?: number;
  smoothConstraint?: boolean;
  constraintStrength?: number;
  debug?: boolean;
  updateInterval?: number;
  enablePrediction?: boolean;
  elasticity?: number;
  friction?: number;
  maxBounceVelocity?: number;
  snapDistance?: number;
  snapStrength?: number;
}

// 拖拽状态类型
export interface DragState {
  isDragging: boolean;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  lastConstrainedPosition?: ConstrainedPosition;
  velocity?: { x: number; y: number };
  acceleration?: { x: number; y: number };
}

// 错误类型
export enum DragErrorType {
  RUST_BACKEND_ERROR = 'RUST_BACKEND_ERROR',
  WINDOW_NOT_FOUND = 'WINDOW_NOT_FOUND',
  MONITOR_ACCESS_DENIED = 'MONITOR_ACCESS_DENIED',
  TAURI_API_ERROR = 'TAURI_API_ERROR',
  EDGE_DETECTION_NOT_INITIALIZED = 'EDGE_DETECTION_NOT_INITIALIZED',
  CONSTRAINTS_CALCULATION_FAILED = 'CONSTRAINTS_CALCULATION_FAILED',
  POSITION_CONSTRAINT_FAILED = 'POSITION_CONSTRAINT_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SCREEN_RESOLUTION_CHANGED = 'SCREEN_RESOLUTION_CHANGED',
  MULTIPLE_MONITOR_ERROR = 'MULTIPLE_MONITOR_ERROR',
  IPC_TIMEOUT = 'IPC_TIMEOUT',
  IPC_CONNECTION_LOST = 'IPC_CONNECTION_LOST',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface DragError {
  type: DragErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: any;
  timestamp: number;
  context?: {
    operation?: string;
    position?: { x: number; y: number };
    constraints?: DragConstraints;
    retryCount?: number;
  };
  canRecover: boolean;
  suggestedActions: string[];
}

// 碰撞检测类型
export interface CollisionInfo {
  isColliding: boolean;
  edges: string[];
  depth: { left: number; right: number; top: number; bottom: number };
  normal: { x: number; y: number };
  point: { x: number; y: number };
}

export interface MotionState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  timestamp: number;
}

export interface PredictionResult {
  willCollide: boolean;
  timeToCollision: number;
  collisionPoint: { x: number; y: number };
  collisionEdges: string[];
  suggestedVelocity: { x: number; y: number };
}

export interface SmoothConstraintResult {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  hasElasticEffect: boolean;
  isSnapped: boolean;
  snappedEdge?: string;
}

// 系统健康状态
export interface SystemHealth {
  isHealthy: boolean;
  lastCheckTime: number;
  errorCounts: Record<DragErrorType, number>;
  activeErrors: DragError[];
  performance: {
    averageResponseTime: number;
    successRate: number;
    totalOperations: number;
  };
}

// 调试信息类型
export interface DebugInfo {
  timestamp: number;
  operation: string;
  data: any;
  constraints?: DragConstraints;
  position?: { x: number; y: number };
  collision?: CollisionInfo;
  prediction?: PredictionResult;
  error?: DragError;
}

// 配置类型
export interface CollisionDetectorConfig {
  elasticity?: number;
  friction?: number;
  maxBounceVelocity?: number;
  snapDistance?: number;
  snapStrength?: number;
  enablePrediction?: boolean;
  predictionWindow?: number;
}

// 恢复策略类型
export interface RecoveryStrategy {
  name: string;
  description: string;
  execute: (error: DragError) => Promise<boolean>;
  maxRetries?: number;
  retryDelay?: number;
}

// 工具函数类型
export type PositionCallback = (position: { x: number; y: number }) => void;
export type ConstraintCallback = (constrained: ConstrainedPosition) => void;
export type ErrorCallback = (error: DragError) => void;
export type DebugCallback = (info: DebugInfo) => void;

// 兼容性类型（确保与现有代码兼容）
export type WindowPosition = [number, number];
export type EdgeDistance = { left: number; right: number; top: number; bottom: number };

// 模块导出声明
declare module '@tauri-apps/api/core' {
  interface InvokeCommands {
    'get_screen_bounds': () => Promise<ScreenBounds>;
    'get_window_bounds': () => Promise<WindowBounds>;
    'calculate_drag_constraints': (params: { margin?: number }) => Promise<DragConstraints>;
    'constrain_window_position': (params: { x: number; y: number; margin?: number }) => Promise<ConstrainedPosition>;
    'predict_boundary_collision': (params: { delta_x: number; delta_y: number; margin?: number }) => Promise<[boolean, string?]>;
    'set_constrained_window_position': (params: { x: number; y: number; margin?: number }) => Promise<ConstrainedPosition>;
  }
}

// 全局类型扩展
declare global {
  interface Window {
    __DRAG_EDGE_DETECTION_DEBUG__?: boolean;
    __DRAG_EDGE_DETECTION_CONFIG__?: DragEdgeDetectionOptions;
  }
}

export {};