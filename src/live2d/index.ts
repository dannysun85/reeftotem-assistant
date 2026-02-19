/**
 * Live2D 统一模块入口
 * 提供简洁的 API 和类型定义
 */

// 核心实例
export { live2DResourceManager } from './core/Live2DResourceManager';
export { live2DEngine } from './core/Live2DEngine';

// Hooks
export { useLive2D } from './hooks/useLive2D';
export type { Live2DState, Live2DActions } from './hooks/useLive2D';

// 组件
export { Live2DCanvas } from './components/Live2DCanvas';
export type { Live2DCanvasProps } from './components/Live2DCanvas';
