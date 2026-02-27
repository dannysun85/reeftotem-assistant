/**
 * Live2D 核心引擎
 * 封装 Live2D SDK 的初始化、管理和渲染逻辑
 */

import { Live2DResourceManager, Live2DModelConfig } from './Live2DResourceManager';

/**
 * Live2D 引擎配置
 */
export interface Live2DEngineConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  transparentBackground?: boolean;
  enablePhysics?: boolean;
  enableExpressions?: boolean;
  maxFPS?: number;
}

/**
 * 渲染状态
 */
export interface RenderState {
  isInitialized: boolean;
  isRendering: boolean;
  currentModel: string | null;
  frameCount: number;
  lastFrameTime: number;
  fps: number;
}

/**
 * Live2D 核心引擎
 *
 * 职责：
 * 1. Live2D SDK 初始化
 * 2. 渲染循环管理
 * 3. 模型切换和生命周期管理
 * 4. 性能监控和优化
 * 5. 事件处理
 */
export class Live2DEngine {
  private static instance: Live2DEngine | null = null;

  // 核心组件
  private canvas: HTMLCanvasElement | null = null;
  private lAppDelegate: any = null; // LAppDelegate 实例
  private resourceManager: Live2DResourceManager;

  // 渲染状态
  private renderState: RenderState = {
    isInitialized: false,
    isRendering: false,
    currentModel: null,
    frameCount: 0,
    lastFrameTime: 0,
    fps: 60
  };

  // 配置
  private config: Live2DEngineConfig | null = null;

  // 事件监听器
  private eventListeners: Map<string, Array<(event: any) => void>> = new Map();

  private constructor() {
    this.resourceManager = Live2DResourceManager.getInstance();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Live2DEngine {
    if (!this.instance) {
      this.instance = new Live2DEngine();
    }
    return this.instance;
  }

  /**
   * 初始化 Live2D 引擎
   */
  public async initialize(config: Live2DEngineConfig): Promise<boolean> {
    if (this.renderState.isInitialized) {
      console.warn('Live2D 引擎已经初始化');
      return true;
    }

    this.config = config;
    this.canvas = config.canvas;

    try {
      // 1. 检查和准备画布
      if (!this.canvas) {
        throw new Error('Canvas 元素不存在');
      }

      // 2. 加载 Live2D Core
      await this.loadLive2DCore();

      // 3. 初始化 LAppDelegate（由其内部的 LAppGlManager 创建 WebGL2 上下文）
      await this.initializeLAppDelegate();

      // 4. 更新状态
      this.renderState.isInitialized = true;

      this.emitEvent('engineInitialized', { config });

      return true;

    } catch (error) {
      console.error('Live2D 引擎初始化失败:', error);
      this.emitEvent('engineError', { error });
      return false;
    }
  }

  /**
   * 加载 Live2D Core
   */
  private async loadLive2DCore(): Promise<void> {
    // 检查是否已经加载
    if ((window as any).Live2DCubismCore) {
      return;
    }

    // 尝试多个可能的路径
    const possiblePaths = [
      this.resourceManager.getLive2DCorePath(),
      '/src/lib/live2d/Core/live2dcubismcore.min.js',
      '/src/lib/live2d/Core/live2dcubismcore.js'
    ];

    for (let i = 0; i < possiblePaths.length; i++) {
      const corePath = possiblePaths[i];

      try {
        await this.loadScript(corePath);
        return;
      } catch (error) {
        if (i === possiblePaths.length - 1) {
          // 最后一个路径也失败了
          throw new Error(`所有 Live2D Core 路径都加载失败。已尝试${possiblePaths.length}个路径:\n${possiblePaths.map(p => `- ${p}`).join('\n')}`);
        }
      }
    }
  }

  /**
   * 加载单个脚本文件
   */
  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 检查是否已经加载
      if ((window as any).Live2DCubismCore) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.type = 'text/javascript';
      script.async = true;

      const timeout = setTimeout(() => {
        script.remove();
        reject(new Error(`脚本加载超时: ${src}`));
      }, 10000); // 10秒超时

      script.onload = () => {
        clearTimeout(timeout);
        // 等待 Core 初始化
        setTimeout(() => {
          if ((window as any).Live2DCubismCore) {
            resolve();
          } else {
            reject(new Error(`脚本加载成功但全局变量未设置: ${src}`));
          }
        }, 200);
      };

      script.onerror = (error) => {
        clearTimeout(timeout);
        reject(new Error(`脚本加载失败: ${src}`));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 初始化 LAppDelegate
   */
  private async initializeLAppDelegate(): Promise<void> {
    try {
      // 动态导入 LAppDelegate - 使用正确路径
      const { LAppDelegate } = await import('../../lib/live2d/src/lappdelegate');

      // 获取单例实例
      this.lAppDelegate = LAppDelegate.getInstance();

      // 初始化 LAppDelegate
      const success = this.lAppDelegate.initialize();

      if (!success) {
        throw new Error('LAppDelegate 初始化失败');
      }
    } catch (error) {
      console.error('LAppDelegate 初始化失败:', error);
      throw error;
    }
  }

  /**
   * 启动渲染循环
   */
  public startRendering(): void {
    if (!this.renderState.isInitialized) {
      throw new Error('引擎未初始化，无法启动渲染');
    }

    if (this.renderState.isRendering) {
      console.warn('渲染循环已在运行');
      return;
    }

    this.renderState.isRendering = true;

    if (this.lAppDelegate) {
      this.lAppDelegate.run();
    }

    // 启动性能监控
    this.startPerformanceMonitoring();

    this.emitEvent('renderingStarted');
  }

  /**
   * 停止渲染循环
   */
  public stopRendering(): void {
    if (!this.renderState.isRendering) {
      return;
    }

    this.renderState.isRendering = false;

    if (this.lAppDelegate) {
      // LAppDelegate 可能有 stop 方法，或者设置为 null
      // 具体实现取决于 LAppDelegate 的 API
    }

    this.emitEvent('renderingStopped');
  }

  /**
   * 切换模型
   */
  public async switchModel(modelName: string): Promise<boolean> {
    if (!this.renderState.isInitialized) {
      throw new Error('引擎未初始化');
    }

    try {
      // 1. 加载模型配置
      const modelConfig = await this.resourceManager.loadModel(modelName);
      if (!modelConfig) {
        throw new Error(`模型配置不存在: ${modelName}`);
      }

      // 2. 创建模型资源对象
      const characterModel = {
        resource_id: modelName.toLowerCase(),
        name: modelName,
        type: 'CHARACTER' as const,
        link: modelConfig.modelPath
      };

      // 3. 通知 LAppDelegate 切换模型
      if (this.lAppDelegate && this.lAppDelegate.changeCharacter) {
        this.lAppDelegate.changeCharacter(characterModel);

        // 延迟通知活动状态
        setTimeout(() => {
          if (this.lAppDelegate && this.lAppDelegate.notifyActivity) {
            this.lAppDelegate.notifyActivity();
          }
        }, 800);
      } else {
        throw new Error('LAppDelegate 未就绪，无法切换模型');
      }

      // 4. 更新状态
      this.renderState.currentModel = modelName;

      this.emitEvent('modelSwitched', { modelName, config: modelConfig });

      return true;

    } catch (error) {
      console.error(`模型切换失败 (${modelName}):`, error);
      this.emitEvent('modelSwitchError', { modelName, error });
      return false;
    }
  }

  /**
   * 调整画布尺寸
   */
  public resizeCanvas(width: number, height: number): void {
    // 更新配置
    if (this.config) {
      this.config.width = width;
      this.config.height = height;
    }

    // 通知 LAppDelegate 画布尺寸变化（由 LAppSubdelegate 正确处理 canvas 尺寸和 viewport）
    if (this.lAppDelegate) {
      this.lAppDelegate.onResize();
    }

    this.emitEvent('canvasResized', { width, height });
  }

  /**
   * 触发表情
   */
  public triggerExpression(expressionName: string): void {
    if (this.lAppDelegate && this.lAppDelegate.setExpression) {
      this.lAppDelegate.setExpression(expressionName);
      this.emitEvent('expressionTriggered', { expression: expressionName });
    }
  }

  /**
   * 触发动作
   */
  public triggerMotion(motionName: string, motionIndex?: number): void {
    if (this.lAppDelegate && this.lAppDelegate.startMotion) {
      this.lAppDelegate.startMotion(motionName, motionIndex);
      this.emitEvent('motionTriggered', { motion: motionName, motionIndex });
    }
  }

  /**
   * 设置视线追踪
   */
  public setEyeTracking(x: number, y: number): void {
    if (this.lAppDelegate && this.lAppDelegate.setEyeTracking) {
      this.lAppDelegate.setEyeTracking(x, y);
    }
  }

  /**
   * 设置唇形同步
   */
  public setLipSync(value: number): void {
    if (this.lAppDelegate && this.lAppDelegate.setLipSync) {
      this.lAppDelegate.setLipSync(value);
    }
  }

  /**
   * 性能监控
   */
  private startPerformanceMonitoring(): void {
    const monitor = () => {
      if (!this.renderState.isRendering) {
        return;
      }

      const now = performance.now();
      const deltaTime = now - this.renderState.lastFrameTime;

      if (deltaTime > 0) {
        this.renderState.fps = Math.round(1000 / deltaTime);
      }

      this.renderState.frameCount++;
      this.renderState.lastFrameTime = now;

      // 每 60 帧输出一次性能信息
      if (this.renderState.frameCount % 60 === 0) {
        this.emitEvent('performanceUpdate', {
          fps: this.renderState.fps,
          frameCount: this.renderState.frameCount,
          currentModel: this.renderState.currentModel
        });
      }

      requestAnimationFrame(monitor);
    };

    requestAnimationFrame(monitor);
  }

  /**
   * 获取渲染状态
   */
  public getRenderState(): RenderState {
    return { ...this.renderState };
  }

  /**
   * 获取引擎配置
   */
  public getConfig(): Live2DEngineConfig | null {
    return this.config ? { ...this.config } : null;
  }

  /**
   * 添加事件监听器
   */
  public addEventListener(event: string, listener: (event: any) => void): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, []);
    }
    this.eventListeners.get(event)!.push(listener);
  }

  /**
   * 移除事件监听器
   */
  public removeEventListener(event: string, listener: (event: any) => void): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 触发事件
   */
  private emitEvent(event: string, data?: any): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(`事件监听器错误 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 销毁引擎
   */
  public dispose(): void {
    // 停止渲染
    this.stopRendering();

    // 清理 LAppDelegate
    if (this.lAppDelegate) {
      if (this.lAppDelegate.release) {
        this.lAppDelegate.release();
      }
      this.lAppDelegate = null;
    }

    // 清理画布
    this.canvas = null;

    // 重置状态
    this.renderState = {
      isInitialized: false,
      isRendering: false,
      currentModel: null,
      frameCount: 0,
      lastFrameTime: 0,
      fps: 60
    };

    // 清理配置
    this.config = null;

    // 清理事件监听器
    this.eventListeners.clear();

    this.emitEvent('engineDisposed');
  }
}

// 导出单例实例
export const live2DEngine = Live2DEngine.getInstance();
