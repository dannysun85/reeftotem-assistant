/**
 * EdgeCollisionDetector - 智能边缘碰撞检测算法
 *
 * 提供高级的边缘检测和碰撞预测功能，包括：
 * 1. 平滑的边界约束算法
 * 2. 预测性碰撞检测
 * 3. 弹性边界效果
 * 4. 多显示器边缘处理
 * 5. 自适应边距计算
 */

import type {
  ScreenBounds,
  WindowBounds,
  DragConstraints,
  ConstrainedPosition
} from '../hooks/useDragEdgeDetection';

// 配置接口
export interface CollisionDetectorConfig {
  /** 弹性系数，0-1，默认0.3 */
  elasticity?: number;
  /** 摩擦系数，0-1，默认0.1 */
  friction?: number;
  /** 最大弹跳速度，默认500px/s */
  maxBounceVelocity?: number;
  /** 边缘吸附距离，默认20px */
  snapDistance?: number;
  /** 吸附强度，0-1，默认0.8 */
  snapStrength?: number;
  /** 是否启用预测性检测，默认true */
  enablePrediction?: boolean;
  /** 预测时间窗口，默认100ms */
  predictionWindow?: number;
}

// 碰撞信息
export interface CollisionInfo {
  /** 是否发生碰撞 */
  isColliding: boolean;
  /** 碰撞边缘 */
  edges: string[];
  /** 碰撞深度（像素） */
  depth: { left: number; right: number; top: number; bottom: number };
  /** 碰撞法向量 */
  normal: { x: number; y: number };
  /** 碰撞点 */
  point: { x: number; y: number };
}

// 运动状态
export interface MotionState {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
  acceleration: { x: number; y: number };
  timestamp: number;
}

// 预测结果
export interface PredictionResult {
  /** 预测会碰撞 */
  willCollide: boolean;
  /** 预测碰撞时间（毫秒） */
  timeToCollision: number;
  /** 预测碰撞位置 */
  collisionPoint: { x: number; y: number };
  /** 预测碰撞边缘 */
  collisionEdges: string[];
  /** 建议的新速度 */
  suggestedVelocity: { x: number; y: number };
}

// 平滑约束结果
export interface SmoothConstraintResult {
  /** 约束后位置 */
  position: { x: number; y: number };
  /** 约束后速度 */
  velocity: { x: number; y: number };
  /** 是否应用了弹性效果 */
  hasElasticEffect: boolean;
  /** 是否被吸附 */
  isSnapped: boolean;
  /** 吸附边缘 */
  snappedEdge?: string;
}

export class EdgeCollisionDetector {
  private config: Required<CollisionDetectorConfig>;
  private motionHistory: MotionState[] = [];
  private maxHistorySize = 10;

  constructor(config: CollisionDetectorConfig = {}) {
    this.config = {
      elasticity: 0.3,
      friction: 0.1,
      maxBounceVelocity: 500,
      snapDistance: 20,
      snapStrength: 0.8,
      enablePrediction: true,
      predictionWindow: 100,
      ...config,
    };
  }

  /**
   * 检测当前位置是否与边界碰撞
   */
  detectCollision(
    position: { x: number; y: number },
    windowSize: { width: number; height: number },
    constraints: DragConstraints
  ): CollisionInfo {
    const windowRight = position.x + windowSize.width;
    const windowBottom = position.y + windowSize.height;

    const depth = {
      left: Math.max(0, constraints.min_x - position.x),
      right: Math.max(0, windowRight - constraints.max_x),
      top: Math.max(0, constraints.min_y - position.y),
      bottom: Math.max(0, windowBottom - constraints.max_y),
    };

    const edges: string[] = [];
    let normal = { x: 0, y: 0 };
    let point = { x: 0, y: 0 };

    if (depth.left > 0) {
      edges.push('left');
      normal.x = 1;
      point.x = constraints.min_x;
    }
    if (depth.right > 0) {
      edges.push('right');
      normal.x = -1;
      point.x = constraints.max_x;
    }
    if (depth.top > 0) {
      edges.push('top');
      normal.y = 1;
      point.y = constraints.min_y;
    }
    if (depth.bottom > 0) {
      edges.push('bottom');
      normal.y = -1;
      point.y = constraints.max_y;
    }

    // 归一化法向量
    const length = Math.sqrt(normal.x * normal.x + normal.y * normal.y);
    if (length > 0) {
      normal.x /= length;
      normal.y /= length;
    }

    // 计算碰撞点
    if (edges.length > 0) {
      point.x = edges.includes('left') ? constraints.min_x :
                edges.includes('right') ? constraints.max_x : position.x;
      point.y = edges.includes('top') ? constraints.min_y :
                edges.includes('bottom') ? constraints.max_y : position.y;
    }

    const isColliding = edges.length > 0;

    return {
      isColliding,
      edges,
      depth,
      normal,
      point,
    };
  }

  /**
   * 计算平滑的约束位置和速度
   */
  applySmoothConstraint(
    position: { x: number; y: number },
    velocity: { x: number; y: number },
    windowSize: { width: number; height: number },
    constraints: DragConstraints
  ): SmoothConstraintResult {
    const collision = this.detectCollision(position, windowSize, constraints);

    let newPosition = { ...position };
    let newVelocity = { ...velocity };
    let hasElasticEffect = false;
    let isSnapped = false;
    let snappedEdge: string | undefined;

    if (collision.isColliding) {
      // 应用弹性碰撞
      if (collision.normal.x !== 0) {
        newVelocity.x = -newVelocity.x * this.config.elasticity;
        hasElasticEffect = true;
      }
      if (collision.normal.y !== 0) {
        newVelocity.y = -newVelocity.y * this.config.elasticity;
        hasElasticEffect = true;
      }

      // 限制弹跳速度
      const speed = Math.sqrt(newVelocity.x * newVelocity.x + newVelocity.y * newVelocity.y);
      if (speed > this.config.maxBounceVelocity) {
        const scale = this.config.maxBounceVelocity / speed;
        newVelocity.x *= scale;
        newVelocity.y *= scale;
      }

      // 修正位置到边界内
      newPosition.x = Math.max(constraints.min_x,
                     Math.min(position.x, constraints.max_x - windowSize.width));
      newPosition.y = Math.max(constraints.min_y,
                     Math.min(position.y, constraints.max_y - windowSize.height));

      // 应用摩擦力
      newVelocity.x *= (1 - this.config.friction);
      newVelocity.y *= (1 - this.config.friction);
    }

    // 检查边缘吸附
    if (!collision.isColliding) {
      const distances = {
        left: position.x - constraints.min_x,
        right: (constraints.max_x - windowSize.width) - position.x,
        top: position.y - constraints.min_y,
        bottom: (constraints.max_y - windowSize.height) - position.y,
      };

      for (const [edge, distance] of Object.entries(distances)) {
        if (distance < this.config.snapDistance) {
          if (edge === 'left') {
            newPosition.x = constraints.min_x;
            snappedEdge = 'left';
          } else if (edge === 'right') {
            newPosition.x = constraints.max_x - windowSize.width;
            snappedEdge = 'right';
          } else if (edge === 'top') {
            newPosition.y = constraints.min_y;
            snappedEdge = 'top';
          } else if (edge === 'bottom') {
            newPosition.y = constraints.max_y - windowSize.height;
            snappedEdge = 'bottom';
          }

          // 应用吸附速度衰减
          newVelocity.x *= this.config.snapStrength;
          newVelocity.y *= this.config.snapStrength;
          isSnapped = true;
          break;
        }
      }
    }

    return {
      position: newPosition,
      velocity: newVelocity,
      hasElasticEffect,
      isSnapped,
      snappedEdge,
    };
  }

  /**
   * 更新运动历史
   */
  updateMotionHistory(position: { x: number; y: number }, timestamp: number = Date.now()) {
    let velocity = { x: 0, y: 0 };
    let acceleration = { x: 0, y: 0 };

    if (this.motionHistory.length > 0) {
      const lastState = this.motionHistory[this.motionHistory.length - 1];
      const dt = (timestamp - lastState.timestamp) / 1000; // 转换为秒

      if (dt > 0) {
        velocity = {
          x: (position.x - lastState.position.x) / dt,
          y: (position.y - lastState.position.y) / dt,
        };

        if (this.motionHistory.length > 1) {
          const prevVelocity = {
            x: (lastState.position.x - this.motionHistory[this.motionHistory.length - 2].position.x) /
               ((lastState.timestamp - this.motionHistory[this.motionHistory.length - 2].timestamp) / 1000),
            y: (lastState.position.y - this.motionHistory[this.motionHistory.length - 2].position.y) /
               ((lastState.timestamp - this.motionHistory[this.motionHistory.length - 2].timestamp) / 1000),
          };

          const prevDt = dt + ((lastState.timestamp - this.motionHistory[this.motionHistory.length - 2].timestamp) / 1000);
          if (prevDt > 0) {
            acceleration = {
              x: (velocity.x - prevVelocity.x) / dt,
              y: (velocity.y - prevVelocity.y) / dt,
            };
          }
        }
      }
    }

    const currentState: MotionState = {
      position: { ...position },
      velocity,
      acceleration,
      timestamp,
    };

    this.motionHistory.push(currentState);

    // 限制历史记录大小
    if (this.motionHistory.length > this.maxHistorySize) {
      this.motionHistory.shift();
    }
  }

  /**
   * 预测未来碰撞
   */
  predictCollision(
    currentPosition: { x: number; y: number },
    windowSize: { width: number; height: number },
    constraints: DragConstraints
  ): PredictionResult | null {
    if (!this.config.enablePrediction || this.motionHistory.length < 2) {
      return null;
    }

    const currentState = this.motionHistory[this.motionHistory.length - 1];
    const predictionTime = this.config.predictionWindow / 1000; // 转换为秒

    // 使用当前速度和加速度预测未来位置
    const futurePosition = {
      x: currentPosition.x + currentState.velocity.x * predictionTime +
         0.5 * currentState.acceleration.x * predictionTime * predictionTime,
      y: currentPosition.y + currentState.velocity.y * predictionTime +
         0.5 * currentState.acceleration.y * predictionTime * predictionTime,
    };

    // 检测预测位置的碰撞
    const futureCollision = this.detectCollision(futurePosition, windowSize, constraints);

    if (!futureCollision.isColliding) {
      return {
        willCollide: false,
        timeToCollision: this.config.predictionWindow,
        collisionPoint: futurePosition,
        collisionEdges: [],
        suggestedVelocity: currentState.velocity,
      };
    }

    // 计算碰撞时间
    let timeToCollision = 0;
    if (currentState.velocity.x !== 0 || currentState.velocity.y !== 0) {
      // 简化的碰撞时间计算
      const distances = futureCollision.depth;
      const velocities = {
        x: Math.abs(currentState.velocity.x),
        y: Math.abs(currentState.velocity.y),
      };

      const times = [];
      if (distances.left > 0 && velocities.x > 0) {
        times.push(distances.left / velocities.x);
      }
      if (distances.right > 0 && velocities.x > 0) {
        times.push(distances.right / velocities.x);
      }
      if (distances.top > 0 && velocities.y > 0) {
        times.push(distances.top / velocities.y);
      }
      if (distances.bottom > 0 && velocities.y > 0) {
        times.push(distances.bottom / velocities.y);
      }

      if (times.length > 0) {
        timeToCollision = Math.min(...times) * 1000; // 转换为毫秒
      }
    }

    // 计算建议的新速度
    let suggestedVelocity = { ...currentState.velocity };
    if (futureCollision.normal.x !== 0) {
      suggestedVelocity.x *= -this.config.elasticity;
    }
    if (futureCollision.normal.y !== 0) {
      suggestedVelocity.y *= -this.config.elasticity;
    }

    return {
      willCollide: true,
      timeToCollision,
      collisionPoint: futureCollision.point,
      collisionEdges: futureCollision.edges,
      suggestedVelocity,
    };
  }

  /**
   * 计算到各边缘的距离
   */
  getDistancesToEdges(
    position: { x: number; y: number },
    windowSize: { width: number; height: number },
    constraints: DragConstraints
  ): { left: number; right: number; top: number; bottom: number } {
    return {
      left: position.x - constraints.min_x,
      right: (constraints.max_x - windowSize.width) - position.x,
      top: position.y - constraints.min_y,
      bottom: (constraints.max_y - windowSize.height) - position.y,
    };
  }

  /**
   * 检查是否接近边缘
   */
  isNearEdge(
    position: { x: number; y: number },
    windowSize: { width: number; height: number },
    constraints: DragConstraints,
    threshold: number = 50
  ): boolean {
    const distances = this.getDistancesToEdges(position, windowSize, constraints);

    return distances.left < threshold ||
           distances.right < threshold ||
           distances.top < threshold ||
           distances.bottom < threshold;
  }

  /**
   * 获取当前速度
   */
  getCurrentVelocity(): { x: number; y: number } {
    if (this.motionHistory.length === 0) {
      return { x: 0, y: 0 };
    }

    return this.motionHistory[this.motionHistory.length - 1].velocity;
  }

  /**
   * 清除运动历史
   */
  clearHistory(): void {
    this.motionHistory = [];
  }

  /**
   * 获取配置
   */
  getConfig(): Required<CollisionDetectorConfig> {
    return { ...this.config };
  }

  /**
   * 更新配置
   */
  updateConfig(newConfig: Partial<CollisionDetectorConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// 创建默认实例
export const defaultCollisionDetector = new EdgeCollisionDetector();

// 导出工具函数
export const createCollisionDetector = (config?: CollisionDetectorConfig) => {
  return new EdgeCollisionDetector(config);
};

export default EdgeCollisionDetector;