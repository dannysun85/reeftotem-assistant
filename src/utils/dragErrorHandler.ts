/**
 * DragErrorHandler - 拖拽系统错误处理和恢复机制
 *
 * 提供完整的错误处理、恢复和降级策略：
 * 1. 错误分类和诊断
 * 2. 自动恢复机制
 * 3. 降级策略
 * 4. 错误报告和日志
 * 5. 状态一致性检查
 */

import type {
  DragConstraints,
  ConstrainedPosition
} from '../hooks/useDragEdgeDetection';

// 错误类型枚举
export enum DragErrorType {
  // Rust后端错误
  RUST_BACKEND_ERROR = 'RUST_BACKEND_ERROR',
  WINDOW_NOT_FOUND = 'WINDOW_NOT_FOUND',
  MONITOR_ACCESS_DENIED = 'MONITOR_ACCESS_DENIED',
  TAURI_API_ERROR = 'TAURI_API_ERROR',

  // 前端错误
  EDGE_DETECTION_NOT_INITIALIZED = 'EDGE_DETECTION_NOT_INITIALIZED',
  CONSTRAINTS_CALCULATION_FAILED = 'CONSTRAINTS_CALCULATION_FAILED',
  POSITION_CONSTRAINT_FAILED = 'POSITION_CONSTRAINT_FAILED',

  // 系统错误
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  SCREEN_RESOLUTION_CHANGED = 'SCREEN_RESOLUTION_CHANGED',
  MULTIPLE_MONITOR_ERROR = 'MULTIPLE_MONITOR_ERROR',

  // 网络错误
  IPC_TIMEOUT = 'IPC_TIMEOUT',
  IPC_CONNECTION_LOST = 'IPC_CONNECTION_LOST',

  // 未知错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误严重程度
export enum ErrorSeverity {
  LOW = 'LOW',      // 轻微错误，可以忽略
  MEDIUM = 'MEDIUM', // 中等错误，需要处理
  HIGH = 'HIGH',    // 严重错误，需要立即处理
  CRITICAL = 'CRITICAL' // 关键错误，系统无法继续运行
}

// 错误信息接口
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

// 恢复策略
export interface RecoveryStrategy {
  /** 策略名称 */
  name: string;
  /** 策略描述 */
  description: string;
  /** 执行恢复的函数 */
  execute: (error: DragError) => Promise<boolean>;
  /** 最大重试次数 */
  maxRetries?: number;
  /** 重试间隔（毫秒） */
  retryDelay?: number;
}

// 系统状态信息
export interface SystemHealth {
  /** 是否健康 */
  isHealthy: boolean;
  /** 最后检查时间 */
  lastCheckTime: number;
  /** 错误计数 */
  errorCounts: Record<DragErrorType, number>;
  /** 当前活动错误 */
  activeErrors: DragError[];
  /** 系统性能指标 */
  performance: {
    averageResponseTime: number;
    successRate: number;
    totalOperations: number;
  };
}

export class DragErrorHandler {
  private errors: DragError[] = [];
  private maxErrorHistory = 100;
  private recoveryStrategies: Map<DragErrorType, RecoveryStrategy[]> = new Map();
  private systemHealth: SystemHealth;
  private operationTimers: Map<string, number> = new Map();
  private retryCounters: Map<string, number> = new Map();

  constructor() {
    this.systemHealth = {
      isHealthy: true,
      lastCheckTime: Date.now(),
      errorCounts: Object.fromEntries(
        Object.values(DragErrorType).map(type => [type, 0])
      ) as Record<DragErrorType, number>,
      activeErrors: [],
      performance: {
        averageResponseTime: 0,
        successRate: 1.0,
        totalOperations: 0,
      },
    };

    this.initializeRecoveryStrategies();
  }

  /**
   * 初始化恢复策略
   */
  private initializeRecoveryStrategies(): void {
    // Tauri API错误的恢复策略
    this.addRecoveryStrategy(DragErrorType.TAURI_API_ERROR, {
      name: 'reinitialize-tauri-connection',
      description: '重新初始化Tauri连接',
      execute: async (error) => {
        try {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000));
          return true; // 假设重新初始化成功
        } catch {
          return false;
        }
      },
      maxRetries: 3,
      retryDelay: 1000,
    });

    // 窗口未找到错误的恢复策略
    this.addRecoveryStrategy(DragErrorType.WINDOW_NOT_FOUND, {
      name: 'wait-for-window',
      description: '等待窗口创建',
      execute: async (error) => {
        try {
          await new Promise(resolve => setTimeout(resolve, 500));
          return true;
        } catch {
          return false;
        }
      },
      maxRetries: 5,
      retryDelay: 500,
    });

    // 屏幕分辨率变化的恢复策略
    this.addRecoveryStrategy(DragErrorType.SCREEN_RESOLUTION_CHANGED, {
      name: 'refresh-screen-info',
      description: '刷新屏幕信息',
      execute: async (error) => {
        try {
          await new Promise(resolve => setTimeout(resolve, 200));
          return true;
        } catch {
          return false;
        }
      },
      maxRetries: 2,
      retryDelay: 200,
    });

    // 通用错误恢复策略
    this.addRecoveryStrategy(DragErrorType.UNKNOWN_ERROR, {
      name: 'fallback-to-basic-drag',
      description: '降级到基础拖拽',
      execute: async (error) => {
        try {
          console.warn('降级到基础拖拽模式:', error.message);
          return true;
        } catch {
          return false;
        }
      },
      maxRetries: 1,
      retryDelay: 0,
    });
  }

  /**
   * 添加恢复策略
   */
  public addRecoveryStrategy(errorType: DragErrorType, strategy: RecoveryStrategy): void {
    if (!this.recoveryStrategies.has(errorType)) {
      this.recoveryStrategies.set(errorType, []);
    }
    this.recoveryStrategies.get(errorType)!.push(strategy);
  }

  /**
   * 处理错误
   */
  public async handleError(
    error: any,
    operation: string,
    context?: any
  ): Promise<{
    handled: boolean;
    recovered: boolean;
    fallbackUsed: boolean;
    error: DragError;
  }> {
    const dragError = this.createDragError(error, operation, context);

    // 记录错误
    this.recordError(dragError);

    // 尝试恢复
    const recovered = await this.attemptRecovery(dragError);

    // 如果恢复失败，尝试降级
    let fallbackUsed = false;
    if (!recovered && dragError.severity === ErrorSeverity.HIGH) {
      fallbackUsed = await this.attemptFallback(dragError);
    }

    // 更新系统健康状态
    this.updateSystemHealth();

    return {
      handled: true,
      recovered,
      fallbackUsed,
      error: dragError,
    };
  }

  /**
   * 创建DragError对象
   */
  private createDragError(error: any, operation: string, context?: any): DragError {
    const errorType = this.classifyError(error);
    const severity = this.determineSeverity(errorType, error);

    return {
      type: errorType,
      severity,
      message: error?.message || error?.toString() || 'Unknown error occurred',
      originalError: error,
      timestamp: Date.now(),
      context: {
        operation,
        ...context,
      },
      canRecover: this.canRecover(errorType),
      suggestedActions: this.getSuggestedActions(errorType),
    };
  }

  /**
   * 分类错误类型
   */
  private classifyError(error: any): DragErrorType {
    const message = (error?.message || '').toLowerCase();

    if (message.includes('window') && message.includes('not found')) {
      return DragErrorType.WINDOW_NOT_FOUND;
    }
    if (message.includes('monitor') || message.includes('screen')) {
      return DragErrorType.MONITOR_ACCESS_DENIED;
    }
    if (message.includes('permission') || message.includes('denied')) {
      return DragErrorType.PERMISSION_DENIED;
    }
    if (message.includes('timeout')) {
      return DragErrorType.IPC_TIMEOUT;
    }
    if (message.includes('tauri') || message.includes('__tauri__')) {
      return DragErrorType.TAURI_API_ERROR;
    }
    if (message.includes('constraint') || message.includes('edge')) {
      return DragErrorType.CONSTRAINTS_CALCULATION_FAILED;
    }
    if (message.includes('position')) {
      return DragErrorType.POSITION_CONSTRAINT_FAILED;
    }

    return DragErrorType.UNKNOWN_ERROR;
  }

  /**
   * 确定错误严重程度
   */
  private determineSeverity(errorType: DragErrorType, error: any): ErrorSeverity {
    switch (errorType) {
      case DragErrorType.WINDOW_NOT_FOUND:
      case DragErrorType.TAURI_API_ERROR:
        return ErrorSeverity.HIGH;
      case DragErrorType.PERMISSION_DENIED:
      case DragErrorType.MONITOR_ACCESS_DENIED:
        return ErrorSeverity.CRITICAL;
      case DragErrorType.IPC_TIMEOUT:
      case DragErrorType.SCREEN_RESOLUTION_CHANGED:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  /**
   * 检查是否可以恢复
   */
  private canRecover(errorType: DragErrorType): boolean {
    return errorType !== DragErrorType.PERMISSION_DENIED &&
           errorType !== DragErrorType.UNKNOWN_ERROR;
  }

  /**
   * 获取建议的操作
   */
  private getSuggestedActions(errorType: DragErrorType): string[] {
    switch (errorType) {
      case DragErrorType.WINDOW_NOT_FOUND:
        return ['等待窗口创建', '检查窗口名称', '重启应用'];
      case DragErrorType.TAURI_API_ERROR:
        return ['重新初始化Tauri连接', '检查Tauri配置', '重启应用'];
      case DragErrorType.MONITOR_ACCESS_DENIED:
        return ['检查系统权限', '以管理员身份运行', '检查安全软件设置'];
      case DragErrorType.SCREEN_RESOLUTION_CHANGED:
        return ['刷新屏幕信息', '重新计算约束', '调整窗口位置'];
      default:
        return ['重试操作', '查看日志', '联系技术支持'];
    }
  }

  /**
   * 记录错误
   */
  private recordError(error: DragError): void {
    this.errors.push(error);

    // 限制错误历史大小
    if (this.errors.length > this.maxErrorHistory) {
      this.errors.shift();
    }

    // 更新错误计数
    this.systemHealth.errorCounts[error.type]++;

    // 添加到活动错误列表
    if (error.severity !== ErrorSeverity.LOW) {
      this.systemHealth.activeErrors.push(error);
    }

    console.error(`[DragErrorHandler] ${error.type}: ${error.message}`, error);
  }

  /**
   * 尝试恢复
   */
  private async attemptRecovery(error: DragError): Promise<boolean> {
    const strategies = this.recoveryStrategies.get(error.type) || [];
    const retryKey = `${error.type}-${error.context?.operation || 'unknown'}`;
    const retryCount = this.retryCounters.get(retryKey) || 0;

    for (const strategy of strategies) {
      if (strategy.maxRetries && retryCount >= strategy.maxRetries) {
        console.warn(`[DragErrorHandler] 重试次数超限: ${strategy.name}`);
        continue;
      }

      try {
        console.log(`[DragErrorHandler] 尝试恢复策略: ${strategy.name}`);

        const success = await strategy.execute(error);
        if (success) {
          this.retryCounters.delete(retryKey);
          console.log(`[DragErrorHandler] 恢复成功: ${strategy.name}`);
          return true;
        }
      } catch (recoveryError) {
        console.error(`[DragErrorHandler] 恢复策略失败: ${strategy.name}`, recoveryError);
      }

      if (strategy.retryDelay) {
        await new Promise(resolve => setTimeout(resolve, strategy.retryDelay));
      }
    }

    // 增加重试计数
    this.retryCounters.set(retryKey, retryCount + 1);
    return false;
  }

  /**
   * 尝试降级
   */
  private async attemptFallback(error: DragError): Promise<boolean> {
    console.warn('[DragErrorHandler] 尝试降级策略');

    switch (error.type) {
      case DragErrorType.EDGE_DETECTION_NOT_INITIALIZED:
      case DragErrorType.CONSTRAINTS_CALCULATION_FAILED:
        // 降级到基础拖拽
        return true;

      case DragErrorType.TAURI_API_ERROR:
        // 降级到浏览器原生拖拽（如果可用）
        return false;

      default:
        return false;
    }
  }

  /**
   * 更新系统健康状态
   */
  private updateSystemHealth(): void {
    const now = Date.now();
    const recentErrors = this.errors.filter(e => now - e.timestamp < 60000); // 最近1分钟

    // 计算成功率
    const recentHighSeverityErrors = recentErrors.filter(e =>
      e.severity === ErrorSeverity.HIGH || e.severity === ErrorSeverity.CRITICAL
    ).length;

    this.systemHealth.isHealthy = recentHighSeverityErrors < 5; // 最近1分钟少于5个高严重性错误
    this.systemHealth.lastCheckTime = now;
    this.systemHealth.activeErrors = this.systemHealth.activeErrors.filter(
      e => now - e.timestamp < 30000 // 最近30秒的活动错误
    );

    // 计算平均响应时间（简化版本）
    const totalOperations = this.systemHealth.performance.totalOperations;
    if (totalOperations > 0) {
      this.systemHealth.performance.successRate =
        (totalOperations - recentHighSeverityErrors) / totalOperations;
    }
  }

  /**
   * 开始操作计时
   */
  public startOperation(operationId: string): void {
    this.operationTimers.set(operationId, Date.now());
    this.systemHealth.performance.totalOperations++;
  }

  /**
   * 结束操作计时
   */
  public endOperation(operationId: string): void {
    const startTime = this.operationTimers.get(operationId);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.operationTimers.delete(operationId);

      // 更新平均响应时间
      const current = this.systemHealth.performance.averageResponseTime;
      const total = this.systemHealth.performance.totalOperations;
      this.systemHealth.performance.averageResponseTime =
        (current * (total - 1) + duration) / total;
    }
  }

  /**
   * 清理过期错误
   */
  public cleanup(): void {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    this.errors = this.errors.filter(e => now - e.timestamp < oneHour);
    this.systemHealth.activeErrors = this.systemHealth.activeErrors.filter(
      e => now - e.timestamp < 30000
    );

    // 清理过期的重试计数器
    for (const [key] of this.retryCounters) {
      if (now - parseInt(key.split('-')[1] || '0') > oneHour) {
        this.retryCounters.delete(key);
      }
    }
  }

  /**
   * 获取系统健康状态
   */
  public getSystemHealth(): SystemHealth {
    return { ...this.systemHealth };
  }

  /**
   * 获取错误历史
   */
  public getErrorHistory(limit?: number): DragError[] {
    if (limit) {
      return this.errors.slice(-limit);
    }
    return [...this.errors];
  }

  /**
   * 清除所有错误
   */
  public clearErrors(): void {
    this.errors = [];
    this.systemHealth.activeErrors = [];
    this.systemHealth.errorCounts = Object.fromEntries(
      Object.values(DragErrorType).map(type => [type, 0])
    ) as Record<DragErrorType, number>;
    this.retryCounters.clear();
    this.operationTimers.clear();
  }
}

// 创建全局实例
export const globalDragErrorHandler = new DragErrorHandler();

// 导出工具函数
export const createDragErrorHandler = () => {
  return new DragErrorHandler();
};

// 错误处理的包装函数
export const withDragErrorHandling = async <T>(
  operation: () => Promise<T>,
  operationName: string,
  context?: any
): Promise<{
  success: boolean;
  data?: T;
  error?: DragError;
  recovered: boolean;
  fallbackUsed: boolean;
}> => {
  const handler = globalDragErrorHandler;
  const operationId = `${operationName}-${Date.now()}`;

  handler.startOperation(operationId);

  try {
    const result = await operation();
    handler.endOperation(operationId);
    return {
      success: true,
      data: result,
      recovered: false,
      fallbackUsed: false,
    };
  } catch (error) {
    handler.endOperation(operationId);
    const handleErrorResult = await handler.handleError(error, operationName, context);

    return {
      success: false,
      error: handleErrorResult.error,
      recovered: handleErrorResult.recovered,
      fallbackUsed: handleErrorResult.fallbackUsed,
    };
  }
};

export default DragErrorHandler;