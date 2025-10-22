import { invoke } from '@tauri-apps/api/core';

// 测试结果接口
export interface TestResult {
  success: boolean;
  message: string;
  timestamp: Date;
  details?: any;
  error?: string;
}

// 连接测试类型
export enum ConnectionTestType {
  TENCENT_CLOUD = 'tencent_cloud',
  LIVE2D_CORE = 'live2d_core',
  LIVE2D_MODELS = 'live2d_models',
  AUDIO_PERMISSIONS = 'audio_permissions',
  AUDIO_DEVICES = 'audio_devices',
  WINDOW_MANAGER = 'window_manager'
}

// 测试配置接口
export interface TestConfig {
  type: ConnectionTestType;
  timeout?: number;
  retryCount?: number;
  parameters?: Record<string, any>;
}

/**
 * 连接测试工具类
 * 负责测试各种服务的连接状态和可用性
 * 前端负责UI交互，后端负责实际测试逻辑
 */
export class ConnectionTester {
  private static instance: ConnectionTester;
  private testCache: Map<string, { result: TestResult; expires: Date }> = new Map();
  private readonly CACHE_DURATION = 60000; // 1分钟缓存

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ConnectionTester {
    if (!ConnectionTester.instance) {
      ConnectionTester.instance = new ConnectionTester();
    }
    return ConnectionTester.instance;
  }

  /**
   * 执行连接测试
   */
  async runTest(config: TestConfig): Promise<TestResult> {
    const cacheKey = this.getCacheKey(config);

    // 检查缓存
    const cached = this.testCache.get(cacheKey);
    if (cached && cached.expires > new Date()) {
      return cached.result;
    }

    try {
      // 调用后端测试接口
      const result = await invoke<TestResult>('run_connection_test', {
        config: {
          type: config.type,
          timeout: config.timeout || 5000,
          retryCount: config.retryCount || 1,
          parameters: config.parameters || {}
        }
      });

      const testResult = {
        ...result,
        timestamp: new Date(result.timestamp)
      };

      // 缓存结果
      this.testCache.set(cacheKey, {
        result: testResult,
        expires: new Date(Date.now() + this.CACHE_DURATION)
      });

      return testResult;
    } catch (error) {
      const errorResult: TestResult = {
        success: false,
        message: `测试失败: ${error instanceof Error ? error.message : String(error)}`,
        timestamp: new Date(),
        error: error instanceof Error ? error.stack : String(error)
      };

      return errorResult;
    }
  }

  /**
   * 批量测试多个连接
   */
  async runBatchTests(configs: TestConfig[]): Promise<TestResult[]> {
    const results = await Promise.allSettled(
      configs.map(config => this.runTest(config))
    );

    return results.map(result =>
      result.status === 'fulfilled' ? result.value : {
        success: false,
        message: `测试失败: ${result.reason}`,
        timestamp: new Date(),
        error: String(result.reason)
      }
    );
  }

  /**
   * 测试腾讯云服务连接
   */
  async testTencentCloud(): Promise<TestResult> {
    return this.runTest({
      type: ConnectionTestType.TENCENT_CLOUD,
      timeout: 10000,
      retryCount: 2
    });
  }

  /**
   * 测试Live2D核心库
   */
  async testLive2DCore(): Promise<TestResult> {
    return this.runTest({
      type: ConnectionTestType.LIVE2D_CORE,
      timeout: 5000
    });
  }

  /**
   * 测试Live2D模型文件
   */
  async testLive2DModels(): Promise<TestResult> {
    return this.runTest({
      type: ConnectionTestType.LIVE2D_MODELS,
      timeout: 8000
    });
  }

  /**
   * 测试音频权限
   */
  async testAudioPermissions(): Promise<TestResult> {
    return this.runTest({
      type: ConnectionTestType.AUDIO_PERMISSIONS,
      timeout: 3000
    });
  }

  /**
   * 测试音频设备
   */
  async testAudioDevices(): Promise<TestResult> {
    return this.runTest({
      type: ConnectionTestType.AUDIO_DEVICES,
      timeout: 3000
    });
  }

  /**
   * 测试窗口管理器
   */
  async testWindowManager(): Promise<TestResult> {
    return this.runTest({
      type: ConnectionTestType.WINDOW_MANAGER,
      timeout: 3000
    });
  }

  /**
   * 运行完整的连接诊断
   */
  async runFullDiagnosis(): Promise<TestResult[]> {
    const configs: TestConfig[] = [
      { type: ConnectionTestType.TENCENT_CLOUD },
      { type: ConnectionTestType.LIVE2D_CORE },
      { type: ConnectionTestType.LIVE2D_MODELS },
      { type: ConnectionTestType.AUDIO_PERMISSIONS },
      { type: ConnectionTestType.AUDIO_DEVICES },
      { type: ConnectionTestType.WINDOW_MANAGER }
    ];

    return this.runBatchTests(configs);
  }

  /**
   * 获取系统诊断报告
   */
  async getSystemDiagnosis(): Promise<{
    overall: 'healthy' | 'warning' | 'error';
    summary: string;
    results: TestResult[];
    recommendations: string[];
  }> {
    const results = await this.runFullDiagnosis();

    const failedTests = results.filter(r => !r.success);
    const overallStatus = failedTests.length === 0 ? 'healthy' :
                          failedTests.length <= 2 ? 'warning' : 'error';

    const summary = this.generateSummary(results);
    const recommendations = this.generateRecommendations(results);

    return {
      overall: overallStatus,
      summary,
      results,
      recommendations
    };
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.testCache.clear();
  }

  /**
   * 获取缓存键
   */
  private getCacheKey(config: TestConfig): string {
    return `${config.type}_${JSON.stringify(config.parameters || {})}`;
  }

  /**
   * 生成诊断摘要
   */
  private generateSummary(results: TestResult[]): string {
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = total - passed;

    if (failed === 0) {
      return '所有系统组件运行正常';
    } else if (failed <= 2) {
      return `系统基本正常，${failed}个组件需要关注`;
    } else {
      return `系统存在多个问题，${failed}个组件需要修复`;
    }
  }

  /**
   * 生成修复建议
   */
  private generateRecommendations(results: TestResult[]): string[] {
    const recommendations: string[] = [];

    results.forEach(result => {
      if (!result.success) {
        switch (result.details?.type) {
          case ConnectionTestType.TENCENT_CLOUD:
            recommendations.push('检查腾讯云API密钥配置');
            recommendations.push('验证网络连接和防火墙设置');
            break;
          case ConnectionTestType.LIVE2D_CORE:
            recommendations.push('重新安装应用或联系技术支持');
            break;
          case ConnectionTestType.LIVE2D_MODELS:
            recommendations.push('检查模型文件完整性');
            break;
          case ConnectionTestType.AUDIO_PERMISSIONS:
            recommendations.push('在系统设置中允许麦克风访问');
            break;
          case ConnectionTestType.AUDIO_DEVICES:
            recommendations.push('检查音频设备是否正常工作');
            break;
          case ConnectionTestType.WINDOW_MANAGER:
            recommendations.push('重启应用或检查系统权限');
            break;
        }
      }
    });

    return [...new Set(recommendations)]; // 去重
  }
}

// 导出单例实例
export const connectionTester = ConnectionTester.getInstance();

// 便捷的Hook函数
export const useConnectionTester = () => {
  const [isTesting, setIsTesting] = useState(false);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [lastTestTime, setLastTestTime] = useState<Date | null>(null);

  const runSingleTest = useCallback(async (config: TestConfig) => {
    setIsTesting(true);
    try {
      const result = await connectionTester.runTest(config);
      setTestResults(prev => [result, ...prev.slice(0, 9)]); // 保留最近10个结果
      setLastTestTime(new Date());
      return result;
    } finally {
      setIsTesting(false);
    }
  }, []);

  const runFullDiagnosis = useCallback(async () => {
    setIsTesting(true);
    try {
      const results = await connectionTester.runFullDiagnosis();
      setTestResults(results);
      setLastTestTime(new Date());
      return results;
    } finally {
      setIsTesting(false);
    }
  }, []);

  const getSystemDiagnosis = useCallback(async () => {
    return await connectionTester.getSystemDiagnosis();
  }, []);

  const clearCache = useCallback(() => {
    connectionTester.clearCache();
  }, []);

  return {
    isTesting,
    testResults,
    lastTestTime,
    runSingleTest,
    runFullDiagnosis,
    getSystemDiagnosis,
    clearCache
  };
};

// React状态导入
import { useState, useCallback } from 'react';