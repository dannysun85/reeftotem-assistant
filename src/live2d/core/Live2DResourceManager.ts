/**
 * Live2D 统一资源管理器
 * 解决资源路径分散、环境配置复杂、重复代码等问题
 */

/**
 * Live2D 模型配置接口
 */
export interface Live2DModelConfig {
  id: string;
  name: string;
  displayName: string;
  modelPath: string;
  texturePaths: string[];
  expressionPaths?: string[];
  motionPaths?: string[];
  physicsPath?: string;
  posePath?: string;
  userDataPath?: string;
}

/**
 * 资源加载状态
 */
export interface ResourceLoadState {
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
  progress: number;
}

/**
 * Live2D 环境配置
 */
export interface Live2DEnvironment {
  isDevelopment: boolean;
  isProduction: boolean;
  resourceBasePath: string;
  modelBasePath: string;
  coreBasePath: string;
}

/**
 * Live2D 统一资源管理器
 *
 * 功能：
 * 1. 统一的资源路径管理
 * 2. 环境自适应配置
 * 3. 资源加载状态跟踪
 * 4. 缓存机制
 * 5. 错误处理和重试
 */
export class Live2DResourceManager {
  private static instance: Live2DResourceManager | null = null;

  // 配置和状态
  private environment: Live2DEnvironment;
  private modelConfigs: Map<string, Live2DModelConfig> = new Map();
  private loadStates: Map<string, ResourceLoadState> = new Map();
  private loadedResources: Map<string, any> = new Map();

  // 事件监听器
  private eventListeners: Map<string, Array<(event: any) => void>> = new Map();

  private constructor() {
    this.environment = this.detectEnvironment();
    this.initializeModelConfigs();
  }

  /**
   * 获取单例实例
   */
  public static getInstance(): Live2DResourceManager {
    if (!this.instance) {
      this.instance = new Live2DResourceManager();
    }
    return this.instance;
  }

  /**
   * 检测当前环境
   */
  private detectEnvironment(): Live2DEnvironment {
    const isDev = import.meta.env.DEV;
    const isProd = import.meta.env.PROD;

    const baseUrl = import.meta.env.BASE_URL || '/';
    const normalizedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const resourceBasePath = `${normalizedBaseUrl}assets/live2d`;
    const modelBasePath = `${resourceBasePath}/characters/free`;
    const coreBasePath = `${resourceBasePath}/core`;

    console.log(`🔍 环境检测: Dev=${isDev}, Prod=${isProd}, Base=${normalizedBaseUrl}`);
    console.log(`📁 Live2D路径配置 (Tauri 2.x 兼容):`, {
      resourceBasePath,
      modelBasePath,
      coreBasePath
    });

    return {
      isDevelopment: isDev,
      isProduction: isProd,
      resourceBasePath,
      modelBasePath,
      coreBasePath
    };
  }

  /**
   * 初始化模型配置
   */
  private initializeModelConfigs(): void {
    // 可用的模型列表
    const availableModels = [
      'Haru', 'HaruGreeter', 'Mao', 'Tsumiki', 'Chitose',
      'Epsilon', 'Hibiki', 'Hiyori', 'Izumi', 'Kei',
      'Rice', 'Shizuku'
    ];

    availableModels.forEach(modelName => {
      const config: Live2DModelConfig = {
        id: modelName.toLowerCase(),
        name: modelName,
        displayName: modelName,
        modelPath: this.resolveModelPath(modelName),
        texturePaths: []
      };

      this.modelConfigs.set(modelName, config);
    });
  }

  /**
   * 解析模型路径
   */
  private resolveModelPath(modelName: string): string {
    return `${this.environment.modelBasePath}/${modelName}/${modelName}.model3.json`;
  }

  private getModelDirectory(modelPath: string): string {
    const lastSlashIndex = modelPath.lastIndexOf('/');
    return lastSlashIndex > -1 ? modelPath.slice(0, lastSlashIndex) : modelPath;
  }

  private hydrateModelConfigFromModelData(config: Live2DModelConfig, modelData: any): void {
    const fileReferences = modelData?.FileReferences;
    if (!fileReferences) {
      return;
    }

    const baseDir = this.getModelDirectory(config.modelPath);
    const resolvePath = (relativePath?: string): string | undefined => {
      if (typeof relativePath !== 'string' || relativePath.length === 0) {
        return undefined;
      }
      return `${baseDir}/${relativePath}`;
    };

    if (Array.isArray(fileReferences.Textures)) {
      config.texturePaths = fileReferences.Textures
        .filter((texturePath: unknown): texturePath is string => typeof texturePath === 'string' && texturePath.length > 0)
        .map(texturePath => `${baseDir}/${texturePath}`);
    }

    const expressionFiles = Array.isArray(fileReferences.Expressions)
      ? fileReferences.Expressions
        .map((expression: any) => expression?.File)
        .filter((file: unknown): file is string => typeof file === 'string' && file.length > 0)
      : [];
    config.expressionPaths = expressionFiles.length > 0
      ? expressionFiles.map(file => `${baseDir}/${file}`)
      : undefined;

    const motionFiles: string[] = [];
    if (fileReferences.Motions && typeof fileReferences.Motions === 'object') {
      Object.values(fileReferences.Motions).forEach(motionGroup => {
        if (Array.isArray(motionGroup)) {
          motionGroup.forEach((motion: any) => {
            if (typeof motion?.File === 'string' && motion.File.length > 0) {
              motionFiles.push(motion.File);
            }
          });
        }
      });
    }

    const uniqueMotionFiles = Array.from(new Set(motionFiles));
    config.motionPaths = uniqueMotionFiles.length > 0
      ? uniqueMotionFiles.map(file => `${baseDir}/${file}`)
      : undefined;

    config.physicsPath = resolvePath(fileReferences.Physics);
    config.posePath = resolvePath(fileReferences.Pose);
    config.userDataPath = resolvePath(fileReferences.UserData);
  }

  /**
   * 解析纹理路径
   */
  private resolveTexturePaths(modelName: string): string[] {
    // 通常纹理位于 modelName.2048/ 目录下
    return [
      `${this.environment.modelBasePath}/${modelName}/${modelName}.2048/texture_00.png`,
      `${this.environment.modelBasePath}/${modelName}/${modelName}.2048/texture_01.png`,
      `${this.environment.modelBasePath}/${modelName}/${modelName}.2048/texture_02.png`
    ];
  }

  /**
   * 解析表情路径
   */
  private resolveExpressionPaths(modelName: string): string[] | undefined {
    // 表情文件通常在 expressions/ 目录下
    const expressionNames = [
      'smile', 'happy', 'angry', 'sad', 'surprised', 'neutral', 'sleepy', 'love'
    ];

    return expressionNames.map(name =>
      `${this.environment.modelBasePath}/${modelName}/expressions/${name}.exp3.json`
    ).filter(path => this.checkFileExists(path));
  }

  /**
   * 解析动作路径
   */
  private resolveMotionPaths(modelName: string): string[] | undefined {
    // 动作文件通常在 motions/ 目录下
    const motionCategories = ['tap', 'idle', 'pinch_in', 'pinch_out', 'shake', 'flick_head'];

    return motionCategories.map(category =>
      `${this.environment.modelBasePath}/${modelName}/motions/${category}.motion3.json`
    ).filter(path => this.checkFileExists(path));
  }

  /**
   * 解析物理路径
   */
  private resolvePhysicsPath(modelName: string): string | undefined {
    const path = `${this.environment.modelBasePath}/${modelName}/${modelName}.physics3.json`;
    return this.checkFileExists(path) ? path : undefined;
  }

  /**
   * 解析姿态路径
   */
  private resolvePosePath(modelName: string): string | undefined {
    const path = `${this.environment.modelBasePath}/${modelName}/${modelName}.pose3.json`;
    return this.checkFileExists(path) ? path : undefined;
  }

  /**
   * 解析用户数据路径
   */
  private resolveUserDataPath(modelName: string): string | undefined {
    const path = `${this.environment.modelBasePath}/${modelName}/${modelName}.userdata3.json`;
    return this.checkFileExists(path) ? path : undefined;
  }

  /**
   * 检查文件是否存在（简化实现）
   */
  private checkFileExists(path: string): boolean {
    // 在实际实现中，这里应该发送 HEAD 请求检查文件是否存在
    // 现在返回 true 作为占位符
    return true;
  }

  /**
   * 获取 Live2D Core 路径
   */
  public getLive2DCorePath(): string {
    return `${this.environment.coreBasePath}/live2dcubismcore.min.js`;
  }

  /**
   * 获取模型配置
   */
  public getModelConfig(modelName: string): Live2DModelConfig | undefined {
    return this.modelConfigs.get(modelName);
  }

  /**
   * 获取所有可用模型
   */
  public getAvailableModels(): Live2DModelConfig[] {
    return Array.from(this.modelConfigs.values());
  }

  /**
   * 获取环境信息
   */
  public getEnvironment(): Live2DEnvironment {
    return { ...this.environment };
  }

  /**
   * 加载模型资源
   */
  public async loadModel(modelName: string): Promise<Live2DModelConfig> {
    const config = this.getModelConfig(modelName);
    if (!config) {
      throw new Error(`模型配置不存在: ${modelName}`);
    }

    // 检查是否已经加载
    if (this.loadStates.has(modelName)) {
      const state = this.loadStates.get(modelName)!;
      if (state.isLoaded) {
        return config;
      }
      if (state.isLoading) {
        return this.waitForLoad(modelName);
      }
    }

    // 开始加载
    this.setLoadState(modelName, {
      isLoading: true,
      isLoaded: false,
      error: null,
      progress: 0
    });

    try {
      // 加载模型配置文件
      const modelData = await this.fetchJSON(config.modelPath);
      this.hydrateModelConfigFromModelData(config, modelData);

      // 缓存加载的资源
      this.loadedResources.set(config.modelPath, modelData);

      // 更新加载状态
      this.setLoadState(modelName, {
        isLoading: false,
        isLoaded: true,
        error: null,
        progress: 100
      });

      this.emitEvent('modelLoaded', { modelName, config });

      return config;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.setLoadState(modelName, {
        isLoading: false,
        isLoaded: false,
        error: errorMessage,
        progress: 0
      });

      this.emitEvent('modelLoadError', { modelName, error: errorMessage });

      throw error;
    }
  }

  /**
   * 等待模型加载完成
   */
  private async waitForLoad(modelName: string): Promise<Live2DModelConfig> {
    return new Promise((resolve, reject) => {
      const checkState = () => {
        const state = this.loadStates.get(modelName);
        if (!state) {
          reject(new Error(`加载状态不存在: ${modelName}`));
          return;
        }

        if (state.isLoaded) {
          const config = this.getModelConfig(modelName);
          if (config) {
            resolve(config);
          } else {
            reject(new Error(`模型配置不存在: ${modelName}`));
          }
        } else if (state.error) {
          reject(new Error(state.error));
        } else {
          setTimeout(checkState, 100);
        }
      };

      checkState();
    });
  }

  /**
   * 设置加载状态
   */
  private setLoadState(modelName: string, state: ResourceLoadState): void {
    this.loadStates.set(modelName, { ...state });
    this.emitEvent('loadStateChanged', { modelName, state });
  }

  /**
   * 获取加载状态
   */
  public getLoadState(modelName: string): ResourceLoadState | undefined {
    return this.loadStates.get(modelName);
  }

  /**
   * 获取加载的资源
   */
  public getLoadedResource(path: string): any {
    return this.loadedResources.get(path);
  }

  /**
   * 加载 JSON 文件
   */
  private async fetchJSON(url: string): Promise<any> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return response.json();
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
  private emitEvent(event: string, data: any): void {
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
   * 清理缓存
   */
  public clearCache(): void {
    this.loadedResources.clear();
    this.loadStates.clear();
  }

  /**
   * 预加载指定模型
   */
  public async preloadModels(modelNames: string[]): Promise<void> {
    const loadPromises = modelNames.map(name => this.loadModel(name));
    await Promise.allSettled(loadPromises);
  }

  /**
   * 获取统计信息
   */
  public getStats(): {
    totalModels: number;
    loadedModels: number;
    loadingModels: number;
    errorModels: number;
    cachedResources: number;
  } {
    const states = Array.from(this.loadStates.values());

    return {
      totalModels: this.modelConfigs.size,
      loadedModels: states.filter(s => s.isLoaded).length,
      loadingModels: states.filter(s => s.isLoading).length,
      errorModels: states.filter(s => !!s.error).length,
      cachedResources: this.loadedResources.size
    };
  }
}

// 导出单例实例
export const live2DResourceManager = Live2DResourceManager.getInstance();

// 为 Live2D 系统提供全局环境信息函数
declare global {
  interface Window {
    getEnvironmentInfo: () => {
      isDevelopment: boolean;
      isProduction: boolean;
      resourceBasePath: string;
      modelBasePath: string;
      coreBasePath: string;
    };
  }
}

// 设置全局环境信息函数
window.getEnvironmentInfo = () => {
  const resourceManager = Live2DResourceManager.getInstance();
  return resourceManager.getEnvironment();
};
