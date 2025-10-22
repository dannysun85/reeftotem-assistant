# Live2D拖拽边缘检测系统使用指南

## 概述

本系统为Tauri + Rust架构的Live2D应用提供了完整的拖拽边缘检测和约束功能。通过Rust后端的精确屏幕信息获取和前端的智能碰撞检测算法，实现了窗口在屏幕边界内的平滑拖拽体验。

## 核心特性

### 1. 精确的边缘检测
- 基于操作系统级别的屏幕信息获取
- 支持多显示器环境
- 实时屏幕分辨率变化检测
- 可配置的边缘缓冲距离

### 2. 智能碰撞检测
- 预测性碰撞检测算法
- 弹性边界效果
- 边缘吸附功能
- 平滑的约束过渡

### 3. 完善的错误处理
- 自动错误恢复机制
- 降级策略支持
- 详细的错误分类和诊断
- 系统健康状态监控

### 4. 高级功能
- 运动轨迹记录
- 速度和加速度计算
- 调试模式支持
- 性能监控

## 快速开始

### 1. 在React组件中使用Hook

```typescript
import React from 'react';
import { useDragEdgeDetection } from '../hooks/useDragEdgeDetection';

const Live2DComponent: React.FC = () => {
  const {
    constraints,
    isInitialized,
    error,
    dragState,
    initializeConstraints,
    constrainPosition,
    predictCollision,
    startDrag,
    updateDrag,
    endDrag,
  } = useDragEdgeDetection({
    margin: 10,
    smoothConstraint: true,
    debug: true,
    updateInterval: 500,
  });

  // 拖拽处理
  const handleMouseDown = async (e: React.MouseEvent) => {
    startDrag(e.clientX, e.clientY);
  };

  const handleMouseMove = async (e: React.MouseEvent) => {
    if (dragState.isDragging) {
      const constrained = await updateDrag(e.clientX, e.clientY);
      console.log('约束后位置:', constrained);
    }
  };

  const handleMouseUp = () => {
    endDrag();
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      {isInitialized ? '边缘检测已启用' : '正在初始化...'}
      {error && <div className="error">错误: {error}</div>}
    </div>
  );
};
```

### 2. 直接使用边缘检测器

```typescript
import EdgeCollisionDetector from '../utils/edgeCollisionDetector';

const detector = new EdgeCollisionDetector({
  elasticity: 0.3,
  friction: 0.1,
  snapDistance: 20,
  enablePrediction: true,
});

// 检测碰撞
const collision = detector.detectCollision(
  { x: 100, y: 100 },
  { width: 800, height: 600 },
  {
    min_x: 0,
    min_y: 0,
    max_x: 1920,
    max_y: 1080,
    screen_bounds: { x: 0, y: 0, width: 1920, height: 1080 },
  }
);

// 应用平滑约束
const result = detector.applySmoothConstraint(
  { x: 100, y: 100, velocity: { x: 5, y: 3 } },
  { width: 800, height: 600 },
  constraints
);
```

### 3. 错误处理集成

```typescript
import { withDragErrorHandling } from '../utils/dragErrorHandler';

const safeDragOperation = async () => {
  const result = await withDragErrorHandling(
    async () => {
      // 可能失败的拖拽操作
      await constrainPosition(x, y);
    },
    'constrainPosition',
    { x, y }
  );

  if (result.success) {
    console.log('操作成功');
  } else {
    console.log('操作失败，但已恢复:', result.recovered);
    if (result.fallbackUsed) {
      console.log('使用了降级策略');
    }
  }
};
```

## 配置选项

### useDragEdgeDetection Hook选项

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `margin` | `number` | `10` | 边缘缓冲距离（像素） |
| `smoothConstraint` | `boolean` | `true` | 是否启用平滑约束 |
| `constraintStrength` | `number` | `0.3` | 约束回弹强度（0-1） |
| `debug` | `boolean` | `false` | 是否启用调试模式 |
| `updateInterval` | `number` | `100` | 约束更新间隔（毫秒） |

### EdgeCollisionDetector配置

| 选项 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `elasticity` | `number` | `0.3` | 弹性系数（0-1） |
| `friction` | `number` | `0.1` | 摩擦系数（0-1） |
| `maxBounceVelocity` | `number` | `500` | 最大弹跳速度（像素/秒） |
| `snapDistance` | `number` | `20` | 边缘吸附距离（像素） |
| `snapStrength` | `number` | `0.8` | 吸附强度（0-1） |
| `enablePrediction` | `boolean` | `true` | 是否启用预测性检测 |
| `predictionWindow` | `number` | `100` | 预测时间窗口（毫秒） |

## API参考

### Rust后端命令

#### `get_screen_bounds()`
获取当前窗口所在屏幕的边界信息。

**返回值:**
```typescript
ScreenBounds {
  x: number;      // 屏幕左上角X坐标
  y: number;      // 屏幕左上角Y坐标
  width: number;  // 屏幕宽度
  height: number; // 屏幕高度
}
```

#### `calculate_drag_constraints(margin?: number)`
计算窗口拖拽的安全边界。

**参数:**
- `margin`: 可选的边缘缓冲距离

**返回值:**
```typescript
DragConstraints {
  min_x: number;                     // 最小X坐标
  min_y: number;                     // 最小Y坐标
  max_x: number;                     // 最大X坐标
  max_y: number;                     // 最大Y坐标
  screen_bounds: ScreenBounds;       // 屏幕边界信息
}
```

#### `constrain_window_position(x, y, margin?)`
约束指定位置到安全区域内。

**参数:**
- `x`: 目标X坐标
- `y`: 目标Y坐标
- `margin`: 可选的边缘缓冲距离

**返回值:**
```typescript
ConstrainedPosition {
  x: number;                    // 约束后X坐标
  y: number;                    // 约束后Y坐标
  is_constrained: boolean;      // 是否被约束
  constraint_edge?: string;     // 约束边缘
}
```

### 前端Hook API

#### useDragEdgeDetection返回值

| 属性/方法 | 类型 | 描述 |
|-----------|------|------|
| `constraints` | `DragConstraints \| null` | 当前拖拽约束条件 |
| `isInitialized` | `boolean` | 是否已初始化 |
| `error` | `string \| null` | 错误信息 |
| `dragState` | `DragState` | 当前拖拽状态 |
| `initializeConstraints()` | `Promise<void>` | 初始化约束条件 |
| `constrainPosition(x, y)` | `Promise<ConstrainedPosition>` | 约束位置 |
| `predictCollision(deltaX, deltaY)` | `Promise<[boolean, string?]>` | 预测碰撞 |
| `startDrag(x, y)` | `void` | 开始拖拽 |
| `updateDrag(x, y)` | `Promise<ConstrainedPosition>` | 更新拖拽 |
| `endDrag()` | `void` | 结束拖拽 |

## 调试和监控

### 启用调试模式

```typescript
const dragDetection = useDragEdgeDetection({
  debug: true,
});
```

调试模式下会输出详细的日志信息，包括：
- 约束计算过程
- 碰撞检测结果
- 性能指标
- 错误详情

### 系统健康检查

```typescript
import { globalDragErrorHandler } from '../utils/dragErrorHandler';

// 获取系统健康状态
const health = globalDragErrorHandler.getSystemHealth();
console.log('系统健康状态:', health);

// 获取错误历史
const errors = globalDragErrorHandler.getErrorHistory(10);
console.log('最近的错误:', errors);
```

### 右键菜单调试选项

在Live2D窗口中右键点击，选择"调试模式"→"边缘检测信息"可以：
- 刷新约束条件
- 检查边缘距离
- 查看约束状态
- 监控系统健康

## 常见问题和解决方案

### Q: 拖拽时窗口无法移动到屏幕边缘
**A:** 检查`margin`配置，可能边缘缓冲距离过大。可以尝试减小margin值或设置为0。

### Q: 拖拽响应迟钝
**A:** 检查`updateInterval`配置，可能更新间隔过长。建议设置为100ms或更小。

### Q: 约束计算失败
**A:** 确保在Tauri环境中使用，并且窗口已正确创建。可以查看控制台错误信息。

### Q: 多显示器环境下拖拽异常
**A:** 系统会自动检测当前显示器。如果仍有问题，可以尝试手动刷新约束条件。

### Q: 内存使用过高
**A:** 定期清理错误历史和运动历史。可以在组件卸载时调用cleanup方法。

## 性能优化建议

1. **合理设置更新间隔**: 根据应用需求调整`updateInterval`，平衡响应性和性能。

2. **限制调试日志**: 生产环境中关闭调试模式以减少日志输出。

3. **定期清理**: 定期调用错误处理器的cleanup方法清理过期数据。

4. **降级策略**: 在性能受限的环境中启用降级策略。

5. **异步操作**: 所有Rust命令调用都是异步的，确保正确处理Promise。

## 扩展开发

### 添加自定义恢复策略

```typescript
import { globalDragErrorHandler, DragErrorType } from '../utils/dragErrorHandler';

globalDragErrorHandler.addRecoveryStrategy(DragErrorType.WINDOW_NOT_FOUND, {
  name: 'custom-recovery',
  description: '自定义恢复策略',
  execute: async (error) => {
    // 自定义恢复逻辑
    return true;
  },
  maxRetries: 3,
  retryDelay: 1000,
});
```

### 自定义碰撞检测算法

```typescript
import EdgeCollisionDetector from '../utils/edgeCollisionDetector';

class CustomCollisionDetector extends EdgeCollisionDetector {
  // 重写碰撞检测方法
  detectCollision(position, windowSize, constraints) {
    // 自定义碰撞检测逻辑
    return super.detectCollision(position, windowSize, constraints);
  }
}
```

### 监听自定义事件

```typescript
// 监听边缘碰撞事件
useEffect(() => {
  const handleCollision = (event: CustomEvent) => {
    console.log('碰撞事件:', event.detail);
  };

  window.addEventListener('edge-collision', handleCollision);
  return () => window.removeEventListener('edge-collision', handleCollision);
}, []);
```

## 版本兼容性

- **Tauri**: 2.0+
- **Rust**: 1.70+
- **React**: 18.0+
- **TypeScript**: 5.0+

## 许可证

本系统遵循项目整体许可证。