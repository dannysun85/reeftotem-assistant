/**
 * 调试辅助工具
 * 帮助开发者快速诊断语音交互问题
 */

export interface DebugInfo {
  timestamp: string;
  environment: string;
  tencentCloud: {
    configured: boolean;
    secretId: boolean;
    secretKey: boolean;
    appId: boolean;
  };
  ai: {
    provider: string;
    model: string;
    available: boolean;
    config: any;
  };
  permissions: {
    microphone: boolean;
  };
  network: {
    online: boolean;
    ollamaReachable: boolean;
  };
  browser: {
    userAgent: string;
    platform: string;
    languages: string[];
  };
}

/**
 * 获取完整的调试信息
 */
export const getDebugInfo = async (): Promise<DebugInfo> => {
  const timestamp = new Date().toISOString();
  const userAgent = navigator.userAgent;
  const platform = navigator.platform;
  const languages = [...navigator.languages];

  // 检查网络状态
  const online = navigator.onLine;
  let ollamaReachable = false;

  try {
    // 检查Ollama服务是否可达
    const response = await fetch('http://localhost:11434/api/tags', {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    ollamaReachable = response.ok;
  } catch (error) {
    ollamaReachable = false;
  }

  // 检查麦克风权限
  let microphonePermission = false;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    microphonePermission = true;
    stream.getTracks().forEach(track => track.stop());
  } catch (error) {
    microphonePermission = false;
  }

  // 腾讯云配置检查
  const tencentCloud = {
    configured: !!(import.meta.env.VITE_TENCENT_SECRET_ID &&
                   import.meta.env.VITE_TENCENT_SECRET_KEY &&
                   import.meta.env.VITE_TENCENT_APP_ID),
    secretId: !!import.meta.env.VITE_TENCENT_SECRET_ID,
    secretKey: !!import.meta.env.VITE_TENCENT_SECRET_KEY,
    appId: !!import.meta.env.VITE_TENCENT_APP_ID
  };

  // AI配置检查
  const aiConfig = {
    provider: import.meta.env.VITE_AI_PROVIDER || 'ollama',
    model: import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:7b',
    baseUrl: import.meta.env.VITE_OLLAMA_BASE_URL || 'http://localhost:11434',
    temperature: parseFloat(import.meta.env.VITE_AI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(import.meta.env.VITE_AI_MAX_TOKENS || '1000')
  };

  // 动态导入AI服务
  let aiAvailable = false;
  let aiServiceInstance: any = null;
  try {
    const { aiService } = await import('../lib/ai/AIService');
    aiServiceInstance = aiService;
    aiAvailable = await aiServiceInstance.checkAvailability();
  } catch (error) {
    console.warn('AI服务加载失败:', error);
  }

  return {
    timestamp,
    environment: import.meta.env.MODE || 'development',
    tencentCloud,
    ai: {
      provider: aiConfig.provider,
      model: aiConfig.model,
      available: aiAvailable,
      config: aiConfig
    },
    permissions: {
      microphone: microphonePermission
    },
    network: {
      online,
      ollamaReachable
    },
    browser: {
      userAgent,
      platform,
      languages
    }
  };
};

/**
 * 生成调试报告
 */
export const generateDebugReport = (debugInfo: DebugInfo): string => {
  const report = [];

  report.push('=== Reeftotem Assistant 调试报告 ===');
  report.push(`生成时间: ${debugInfo.timestamp}`);
  report.push(`环境: ${debugInfo.environment}`);
  report.push('');

  // 腾讯云配置
  report.push('📡 腾讯云语音服务配置:');
  report.push(`  已配置: ${debugInfo.tencentCloud.configured ? '✅' : '❌'}`);
  report.push(`  SecretId: ${debugInfo.tencentCloud.secretId ? '✅' : '❌'}`);
  report.push(`  SecretKey: ${debugInfo.tencentCloud.secretKey ? '✅' : '❌'}`);
  report.push(`  AppId: ${debugInfo.tencentCloud.appId ? '✅' : '❌'}`);
  report.push('');

  // AI配置
  report.push('🤖 AI大模型配置:');
  report.push(`  提供商: ${debugInfo.ai.provider}`);
  report.push(`  模型: ${debugInfo.ai.model}`);
  report.push(`  可用性: ${debugInfo.ai.available ? '✅' : '❌'}`);
  report.push(`  配置: ${JSON.stringify(debugInfo.ai.config, null, 2)}`);
  report.push('');

  // 权限检查
  report.push('🎤 权限状态:');
  report.push(`  麦克风: ${debugInfo.permissions.microphone ? '✅' : '❌'}`);
  report.push('');

  // 网络状态
  report.push('🌐 网络状态:');
  report.push(`  在线状态: ${debugInfo.network.online ? '✅' : '❌'}`);
  report.push(`  Ollama服务: ${debugInfo.network.ollamaReachable ? '✅' : '❌'}`);
  report.push('');

  // 浏览器信息
  report.push('🌍 浏览器信息:');
  report.push(`  平台: ${debugInfo.browser.platform}`);
  report.push(`  用户代理: ${debugInfo.browser.userAgent.substring(0, 100)}...`);
  report.push(`  语言: ${debugInfo.browser.languages.join(', ')}`);
  report.push('');

  // 问题诊断
  report.push('🔍 问题诊断:');
  const issues = [];

  if (!debugInfo.tencentCloud.configured) {
    issues.push('❌ 腾讯云服务未配置，请检查.env文件');
  }

  if (!debugInfo.ai.available) {
    if (debugInfo.ai.provider === 'ollama' && !debugInfo.network.ollamaReachable) {
      issues.push('❌ Ollama服务不可达，请运行: ollama serve');
    } else if (debugInfo.ai.provider === 'openai' && !debugInfo.ai.config.apiKey) {
      issues.push('❌ OpenAI API密钥未配置');
    } else if (debugInfo.ai.provider === 'anthropic' && !debugInfo.ai.config.apiKey) {
      issues.push('❌ Anthropic API密钥未配置');
    }
  }

  if (!debugInfo.permissions.microphone) {
    issues.push('❌ 麦克风权限未获取');
  }

  if (issues.length === 0) {
    issues.push('✅ 所有配置正常，可以开始使用语音交互功能');
  }

  report.push(issues.join('\n'));
  report.push('');

  // 解决建议
  report.push('💡 解决建议:');

  if (!debugInfo.tencentCloud.configured) {
    report.push('1. 复制 .env.example 为 .env');
    report.push('2. 填入腾讯云API密钥信息');
    report.push('3. 重新启动应用');
    report.push('');
  }

  if (debugInfo.ai.provider === 'ollama' && !debugInfo.network.ollamaReachable) {
    report.push('1. 安装Ollama: brew install ollama');
    report.push('2. 启动服务: ollama serve');
    report.push('3. 下载模型: ollama pull qwen2.5:7b');
    report.push('');
  }

  if (!debugInfo.permissions.microphone) {
    report.push('1. 检查浏览器麦克风权限设置');
    report.push('2. 重新加载页面并授权麦克风访问');
    report.push('');
  }

  report.push('🔧 更多帮助:');
  report.push('- 打开浏览器开发者工具查看详细日志');
  report.push('- 设置 VITE_DEBUG_VOICE=true 启用详细调试');
  report.push('- 使用测试组件逐步验证功能');

  return report.join('\n');
};

/**
 * 将调试信息输出到控制台
 */
export const logDebugInfo = async (): Promise<void> => {
  try {
    const debugInfo = await getDebugInfo();
    const report = generateDebugReport(debugInfo);

    console.log('%c🔍 Reeftotem Assistant 调试信息', 'color: #4F46E5; font-weight: bold; font-size: 14px;');
    console.log(report);

    // 在开发环境中显示更详细信息
    if (import.meta.env.DEV) {
      console.table(debugInfo);
    }
  } catch (error) {
    console.error('调试信息生成失败:', error);
  }
};

/**
 * 检查特定服务是否可用
 */
export const checkServiceAvailability = async (serviceName: string): Promise<boolean> => {
  switch (serviceName) {
    case 'tencent_cloud':
      return !!(import.meta.env.VITE_TENCENT_SECRET_ID &&
                     import.meta.env.VITE_TENCENT_SECRET_KEY &&
                     import.meta.env.VITE_TENCENT_APP_ID);

    case 'ollama':
      try {
        const response = await fetch('http://localhost:11434/api/tags', {
          method: 'GET',
          signal: AbortSignal.timeout(3000)
        });
        return response.ok;
      } catch {
        return false;
      }

    case 'microphone':
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }

    default:
      return false;
  }
};