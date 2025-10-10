/**
 * 眼神追踪配置
 * 
 * 这个文件包含了眼神追踪的所有可调参数
 * 可以轻松调整追踪行为而无需修改核心代码
 */

export const EyeTrackingConfig = {
  /**
   * 是否启用眼神追踪
   * @default true
   */
  enabled: true,

  /**
   * 追踪模式
   * - 'react-events': 仅使用 React onMouseMove 事件(推荐,性能最佳)
   * - 'global-polling': 使用 Rust 后端全局鼠标轮询(60fps,窗口外也能追踪)
   * - 'hybrid': 混合模式 - 窗口内用 React,窗口外用全局轮询
   * 
   * @default 'react-events'
   * @recommended 'react-events' - 性能最好,符合桌面宠物标准行为
   */
  mode: 'react-events' as 'react-events' | 'global-polling' | 'hybrid',

  /**
   * 眼球最大移动范围
   * 值越小,眼神移动范围越小,看起来越含蓄
   * @default 1.0 (增大以便更明显)
   * @range 0.1 - 1.0
   */
  maxEyeMovement: 1.0,

  /**
   * 眼神跟随权重
   * 值越大,眼神跟随鼠标越明显
   * @default 1.5 (增强效果)
   * @range 0.0 - 2.0
   */
  eyeWeight: 1.5,

  /**
   * 头部跟随权重
   * 值越大,头部跟随鼠标越明显
   * @default 0.3 (略微增加)
   * @range 0.0 - 1.0
   */
  headWeight: 0.3,

  /**
   * 非线性平滑指数
   * 值越小,边缘移动越平滑
   * @default 0.5 (降低以提高响应速度)
   * @range 0.5 - 1.0
   */
  smoothingFactor: 0.5,

  /**
   * 鼠标离开窗口后,眼神回到中心的延迟(毫秒)
   * 增加延迟可以让眼神有"思考"或"注视"的停留感
   * @default 300
   * @range 0 - 1000
   */
  resetDelay: 300,

  /**
   * 拖拽时是否禁用眼神追踪
   * @default true
   */
  disableWhileDragging: true,

  /**
   * 调试日志频率
   * 每 N 次移动打印一次日志(避免刷屏)
   * 设置为 0 禁用日志
   * @default 100
   */
  logFrequency: 100,

  /**
   * 全局轮询模式下的更新频率(毫秒)
   * 仅在 mode = 'global-polling' 或 'hybrid' 时有效
   * @default 16 (约 60fps)
   */
  pollingInterval: 16,
};

/**
 * 眼神追踪性能预设
 */
export const EyeTrackingPresets = {
  /**
   * 高性能模式 - 仅窗口内追踪,性能最佳
   */
  performance: {
    mode: 'react-events',
    maxEyeMovement: 0.25,
    eyeWeight: 0.9,
    headWeight: 0.15,
    smoothingFactor: 0.8,
    resetDelay: 200,
  },

  /**
   * 标准模式 - 平衡性能和效果(当前使用)
   */
  standard: {
    mode: 'react-events',
    maxEyeMovement: 0.3,
    eyeWeight: 1.0,
    headWeight: 0.2,
    smoothingFactor: 0.8,
    resetDelay: 300,
  },

  /**
   * 生动模式 - 更大的眼神移动范围,更活泼
   */
  lively: {
    mode: 'react-events',
    maxEyeMovement: 0.4,
    eyeWeight: 1.0,
    headWeight: 0.3,
    smoothingFactor: 0.7,
    resetDelay: 400,
  },

  /**
   * 全局追踪模式 - 窗口外也能追踪(CPU 占用较高)
   */
  global: {
    mode: 'global-polling',
    maxEyeMovement: 0.3,
    eyeWeight: 1.0,
    headWeight: 0.2,
    smoothingFactor: 0.8,
    resetDelay: 0, // 全局模式不需要重置
    pollingInterval: 16,
  },

  /**
   * 混合模式 - 窗口内用 React,窗口外用全局轮询
   */
  hybrid: {
    mode: 'hybrid',
    maxEyeMovement: 0.3,
    eyeWeight: 1.0,
    headWeight: 0.2,
    smoothingFactor: 0.8,
    resetDelay: 300,
    pollingInterval: 16,
  },
} as const;

/**
 * 应用预设配置
 */
export function applyPreset(presetName: keyof typeof EyeTrackingPresets) {
  const preset = EyeTrackingPresets[presetName];
  Object.assign(EyeTrackingConfig, preset);
  console.log(`✅ 已应用眼神追踪预设: ${presetName}`, EyeTrackingConfig);
}

// 导出类型
export type EyeTrackingMode = typeof EyeTrackingConfig.mode;
export type EyeTrackingPresetName = keyof typeof EyeTrackingPresets;
