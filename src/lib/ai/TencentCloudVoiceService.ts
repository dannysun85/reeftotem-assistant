// 动态导入invoke函数以避免模块加载问题
let invokeCache: any = null;

const getTauriInvoke = async () => {
  if (invokeCache) {
    return invokeCache;
  }

  console.log('🔧 开始动态导入 Tauri invoke 函数...');

  try {
    // 首先尝试动态导入 @tauri-apps/api/core
    const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
    console.log('✅ 成功导入 Tauri invoke 函数');
    invokeCache = tauriInvoke;
    return invokeCache;
  } catch (importError) {
    console.warn('⚠️ 动态导入失败，尝试使用全局对象:', importError);

    // 如果动态导入失败，尝试使用全局对象
    if (typeof window !== 'undefined' && (window as any).__TAURI__) {
      console.log('🔧 检查全局 Tauri 对象...');

      if ((window as any).__TAURI__?.core?.invoke) {
        console.log('✅ 找到 Tauri core.invoke 函数');
        invokeCache = (window as any).__TAURI__.core.invoke;
        return invokeCache;
      } else if ((window as any).__TAURI__?.invoke) {
        console.log('✅ 找到 Tauri 直接 invoke 函数');
        invokeCache = (window as any).__TAURI__.invoke;
        return invokeCache;
      }
    }

    console.error('❌ 所有 Tauri invoke 获取方式都失败');
    throw new Error('Tauri API 不可用，请确保在 Tauri 环境中运行');
  }
};

// 安全的invoke函数包装器
const safeInvoke = async (command: string, args?: any): Promise<any> => {
  try {
    // 使用动态获取的Tauri invoke函数
    const invokeFn = await getTauriInvoke();
    console.log(`🔧 调用 Tauri 命令: ${command}`, args ? `参数数量: ${Object.keys(args).length}` : '无参数');
    const result = await invokeFn(command, args);
    console.log(`✅ Tauri 命令 ${command} 执行成功`);
    return result;
  } catch (error) {
    console.error(`❌ Tauri invoke 调用失败 (${command}):`, error);
    console.log('🔧 错误详情:', {
      message: error?.message,
      stack: error?.stack,
      command: command,
      hasArgs: !!args
    });
    throw new Error(`Tauri API 调用失败 [${command}]: ${error?.message || '未知错误'}`);
  }
};

// 腾讯云语音识别配置接口
export interface TencentASRConfig {
  secretId: string;
  secretKey: string;
  region: string;
  appId: string;
  engineModelType: '16k_zh' | '8k_zh' | '16k_en';
  channelNum: number;
  sampleRate: number;
}

// 腾讯云语音合成配置接口
export interface TencentTTSConfig {
  secretId: string;
  secretKey: string;
  region: string;
  appId: string;
  voiceType: number;
  volume: number;
  speed: number;
  pitch: number;
  sampleRate: number;
}

// ASR识别结果接口
export interface ASRResult {
  text: string;
  confidence: number;
  startTime: number;
  endTime: number;
  words?: Array<{
    word: string;
    startTime: number;
    endTime: number;
    confidence: number;
  }>;
}

// TTS合成结果接口
export interface TTSResult {
  audioData: ArrayBuffer;
  text: string;
  duration: number;
  voiceType: number;
  sampleRate: number;
  timestamp: number;
}

/**
 * 腾讯云语音服务类
 * 提供ASR（语音识别）和TTS（语音合成）功能
 */
export class TencentCloudVoiceService {
  private static instance: TencentCloudVoiceService;
  private asrConfig: TencentASRConfig;
  private ttsConfig: TencentTTSConfig;

  constructor() {
    console.log('🔧 初始化腾讯云语音服务...');
    console.log('📦 环境变量检查:', {
      secretId: import.meta.env.VITE_TENCENT_SECRET_ID ? '***已配置***' : '❌ 未配置',
      secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY ? '***已配置***' : '❌ 未配置',
      region: import.meta.env.VITE_TENCENT_REGION || '默认值: ap-beijing',
      appId: import.meta.env.VITE_TENCENT_APP_ID || '❌ 未配置'
    });

    // 默认配置 - 实际使用时需要从环境变量或配置文件读取
    this.asrConfig = {
      secretId: import.meta.env.VITE_TENCENT_SECRET_ID || '',
      secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY || '',
      region: import.meta.env.VITE_TENCENT_REGION || 'ap-beijing',
      appId: import.meta.env.VITE_TENCENT_APP_ID || '',
      engineModelType: '16k_zh',
      channelNum: 1,
      sampleRate: 16000
    };

    this.ttsConfig = {
      secretId: import.meta.env.VITE_TENCENT_SECRET_ID || '',
      secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY || '',
      region: import.meta.env.VITE_TENCENT_REGION || 'ap-beijing',
      appId: import.meta.env.VITE_TENCENT_APP_ID || '',
      voiceType: 1001, // 默认女声
      volume: 1.0,
      speed: 1.0,
      pitch: 0.0,
      sampleRate: 16000
    };

    console.log('✅ 腾讯云语音服务初始化完成');
    console.log('🔍 ASR配置:', {
      ...this.asrConfig,
      secretId: this.asrConfig.secretId ? '***已配置***' : '❌ 未配置',
      secretKey: this.asrConfig.secretKey ? '***已配置***' : '❌ 未配置',
      appId: this.asrConfig.appId ? '***已配置***' : '❌ 未配置'
    });
  }

  /**
   * 测试Tauri invoke系统
   */
  private testTauriInvoke() {
    try {
      console.log('🧪 测试Tauri invoke系统...');
      const invokeFn = getTauriInvoke();
      console.log('✅ Tauri invoke测试成功，invoke函数类型:', typeof invokeFn);
    } catch (error) {
      console.error('❌ Tauri invoke测试失败:', error);
    }
  }

  /**
   * 获取语音服务单例
   */
  static getInstance(): TencentCloudVoiceService {
    if (!TencentCloudVoiceService.instance) {
      TencentCloudVoiceService.instance = new TencentCloudVoiceService();
    }
    return TencentCloudVoiceService.instance;
  }

  /**
   * 配置ASR参数
   */
  configureASR(config: Partial<TencentASRConfig>): void {
    this.asrConfig = { ...this.asrConfig, ...config };
  }

  /**
   * 配置TTS参数
   */
  configureTTS(config: Partial<TencentTTSConfig>): void {
    this.ttsConfig = { ...this.ttsConfig, ...config };
  }

  /**
   * 实时语音识别
   * 使用腾讯云一句话识别API
   */
  async recognizeSpeech(audioData: ArrayBuffer): Promise<ASRResult | null> {
    try {
      console.log('🎙️ 开始腾讯云语音识别...');

      // 检查配置是否完整
      if (!this.isConfigured()) {
        throw new Error('腾讯云语音服务未配置，请检查配置信息');
      }

      console.log('📝 配置检查通过，开始调用API...');
      console.log('📊 音频数据大小:', audioData.byteLength, 'bytes');
      console.log('🔧 ASR配置:', {
        engineModelType: this.asrConfig.engineModelType,
        channelNum: this.asrConfig.channelNum,
        sampleRate: this.asrConfig.sampleRate,
        region: this.asrConfig.region,
        appId: this.asrConfig.appId ? '***' : '未配置'
      });

      // 调用Rust后端的ASR命令
      try {
        console.log('🔧 调用 tencent_asr 命令...');
        const result = await safeInvoke('tencent_asr', {
          config: this.asrConfig,
          audioData: Array.from(new Uint8Array(audioData))
        });

        console.log('✅ 语音识别完成:', result);

        // 验证识别结果
        if (!result || !result.text || result.text.trim() === '') {
          console.warn('⚠️ 识别结果为空，可能是音频质量问题或服务错误');
          return null;
        }

        return result;

      } catch (invokeError: any) {
        console.error('❌ Tauri invoke 调用失败:', invokeError);
        console.log('🔧 错误详情:', {
          message: invokeError?.message,
          stack: invokeError?.stack
        });
        throw new Error(`Tauri API 调用失败: ${invokeError?.message || '未知错误'}`);
      }

    } catch (error: any) {
      console.error('❌ 腾讯云语音识别失败:', error);

      // 详细错误处理
      if (error.message && error.message.includes('腾讯云语音服务未配置')) {
        console.log('💡 提示：请在.env文件中配置腾讯云API密钥');
      } else if (error.message && error.message.includes('AuthFailure')) {
        console.log('💡 提示：请检查SecretId和SecretKey是否正确');
      } else if (error.message && error.message.includes('LimitExceeded')) {
        console.log('💡 提示：API调用次数超限，请检查账户余额');
      } else if (error.message && error.message.includes('FailedOperation')) {
        console.log('💡 提示：音频格式或参数错误，请检查音频质量');
      } else if (error.message && error.message.includes('Tauri API 调用失败')) {
        console.log('💡 提示：Tauri API 不可用，请确保在 Tauri 环境中运行');
      }

      return null;
    }
  }

  /**
   * 文本转语音
   * 使用腾讯云语音合成API
   */
  async synthesizeSpeech(text: string): Promise<TTSResult | null> {
    try {
      console.log('🔊 开始腾讯云语音合成...');

      // 检查配置是否完整
      if (!this.isConfigured()) {
        throw new Error('腾讯云语音服务未配置，请检查配置信息');
      }

      // 验证输入文本
      if (!text || text.trim() === '') {
        throw new Error('文本内容不能为空');
      }

      if (text.length > 10000) {
        throw new Error('文本长度不能超过10000字符');
      }

      console.log('📝 配置检查通过，开始调用API...');
      console.log('📊 文本内容:', text.substring(0, 100) + (text.length > 100 ? '...' : ''));
      console.log('🔧 TTS配置:', {
        voiceType: this.ttsConfig.voiceType,
        volume: this.ttsConfig.volume,
        speed: this.ttsConfig.speed,
        pitch: this.ttsConfig.pitch,
        sampleRate: this.ttsConfig.sampleRate,
        region: this.ttsConfig.region,
        appId: this.ttsConfig.appId ? '***' : '未配置'
      });

      // 调用Rust后端的TTS命令
      try {
        console.log('🔧 调用 tencent_tts 命令...');
        const result = await safeInvoke('tencent_tts', {
          config: this.ttsConfig,
          text: text
        });

        console.log('✅ 语音合成完成，时长:', result.duration, 'ms');
        console.log('🎵 音频数据大小:', result.audioData?.length || 0, 'bytes');

        // 验证合成结果
        if (!result || !result.audioData || result.audioData.length === 0) {
          console.warn('⚠️ 语音合成结果为空，可能是服务错误');
          return null;
        }

        return result;

      } catch (invokeError: any) {
        console.error('❌ Tauri invoke 调用失败:', invokeError);
        console.log('🔧 错误详情:', {
          message: invokeError?.message,
          stack: invokeError?.stack
        });
        throw new Error(`Tauri API 调用失败: ${invokeError?.message || '未知错误'}`);
      }

    } catch (error: any) {
      console.error('❌ 腾讯云语音合成失败:', error);

      // 详细错误处理
      if (error.message && error.message.includes('腾讯云语音服务未配置')) {
        console.log('💡 提示：请在.env文件中配置腾讯云API密钥');
      } else if (error.message && error.message.includes('AuthFailure')) {
        console.log('💡 提示：请检查SecretId和SecretKey是否正确');
      } else if (error.message && error.message.includes('LimitExceeded')) {
        console.log('💡 提示：API调用次数超限，请检查账户余额');
      } else if (error.message && error.message.includes('FailedOperation')) {
        console.log('💡 提示：文本内容或参数错误，请检查输入内容');
      } else if (error.message && error.message.includes('文本内容不能为空')) {
        console.log('💡 提示：请输入要合成语音的文本内容');
      } else if (error.message && error.message.includes('文本长度不能超过')) {
        console.log('💡 提示：请分段合成长文本');
      } else if (error.message && error.message.includes('Tauri API 调用失败')) {
        console.log('💡 提示：Tauri API 不可用，请确保在 Tauri 环境中运行');
      }

      return null;
    }
  }

  /**
   * 流式语音识别
   * 用于实时录音场景
   */
  async startStreamingRecognition(): Promise<boolean> {
    try {
      console.log('🎙️ 开始腾讯云流式语音识别...');

      const result = await safeInvoke('start_tencent_streaming_asr', {
        config: this.asrConfig
      });

      return result;

    } catch (error: any) {
      console.error('❌ 启动流式识别失败:', error);
      return false;
    }
  }

  /**
   * 停止流式识别
   */
  async stopStreamingRecognition(): Promise<ASRResult | null> {
    try {
      console.log('⏹️ 停止腾讯云流式语音识别...');

      const result = await safeInvoke('stop_tencent_streaming_asr');
      return result;

    } catch (error: any) {
      console.error('❌ 停止流式识别失败:', error);
      return null;
    }
  }

  /**
   * 获取ASR配置
   */
  getASRConfig(): TencentASRConfig {
    return { ...this.asrConfig };
  }

  /**
   * 获取TTS配置
   */
  getTTSConfig(): TencentTTSConfig {
    return { ...this.ttsConfig };
  }

  /**
   * 检查配置是否完整
   */
  isConfigured(): boolean {
    const configured = !!(this.asrConfig.secretId &&
             this.asrConfig.secretKey &&
             this.asrConfig.appId &&
             this.ttsConfig.secretId &&
             this.ttsConfig.secretKey &&
             this.ttsConfig.appId);

    console.log('🔍 配置检查结果:', {
      configured,
      hasSecretId: !!this.asrConfig.secretId,
      hasSecretKey: !!this.asrConfig.secretKey,
      hasAppId: !!this.asrConfig.appId
    });

    return configured;
  }

  /**
   * 获取可用的语音类型
   */
  getAvailableVoiceTypes(): Array<{ id: number; name: string; description: string }> {
    return [
      { id: 1001, name: '智逍遥', description: '成熟女声，适合客服' },
      { id: 1002, name: '智瑜', description: '成熟男声，适合播报' },
      { id: 1003, name: '智美', description: '温柔女声，适合故事' },
      { id: 1004, name: '智云', description: '磁性男声，适合新闻' },
      { id: 1005, name: '智莉', description: '甜美女声，适合助理' },
      { id: 1007, name: '智芸', description: '知性女声，适合教学' },
      { id: 1008, name: '智娜', description: '可爱女声，适合儿童' },
      { id: 1010, name: '智琪', description: '甜美女声，适合助手' },
      { id: 1011, name: '智小甜', description: '萝莉女声，适合娱乐' },
      { id: 1012, name: '智小夏', description: '青春女声，适合娱乐' },
      { id: 1013, name: '智小萌', description: '萌萌女声，适合娱乐' },
      { id: 1014, name: '智小流', description: '御姐女声，适合娱乐' },
      { id: 1015, name: '智雅', description: '优雅女声，适合朗读' },
      { id: 1016, name: '智贝', description: '萝莉女声，适合娱乐' },
      { id: 1017, name: '智小婧', description: '青春女声，适合娱乐' },
      { id: 1018, name: '智小琳', description: '青春女声，适合娱乐' },
      { id: 1019, name: '智小美', description: '温柔女声，适合娱乐' },
      { id: 1020, name: '智小佩', description: '温柔女声，适合娱乐' },
      { id: 1021, name: '智晓晓', description: '青春女声，适合娱乐' },
      { id: 1022, name: '智小爱', description: '温柔女声，适合娱乐' },
      { id: 1023, name: '智小凡', description: '青春女声，适合娱乐' },
      { id: 1024, name: '智小悠', description: '温柔女声，适合娱乐' },
      { id: 1025, name: '智小棠', description: '青春女声，适合娱乐' },
      { id: 1026, name: '智小沫', description: '温柔女声，适合娱乐' },
      { id: 1027, name: '智小薇', description: '青春女声，适合娱乐' },
      { id: 1028, name: '智小桃', description: '可爱女声，适合娱乐' },
      { id: 1029, name: '智小艾', description: '青春女声，适合娱乐' },
      { id: 1030, name: '智小希', description: '可爱女声，适合娱乐' },
      { id: 1031, name: '智小洛', description: '温柔女声，适合娱乐' },
      { id: 1032, name: '智小墨', description: '成熟女声，适合朗读' },
      { id: 1033, name: '智小凝', description: '温柔女声，适合娱乐' },
      { id: 1034, name: '智小晴', description: '青春女声，适合娱乐' },
      { id: 1035, name: '智小雪', description: '温柔女声，适合娱乐' },
      { id: 1036, name: '智小星', description: '青春女声，适合娱乐' },
      { id: 1037, name: '智小舞', description: '可爱女声，适合娱乐' },
      { id: 1038, name: '智小诗', description: '温柔女声，适合娱乐' },
      { id: 1039, name: '智小安', description: '青春女声，适合娱乐' },
      { id: 1040, name: '智小诺', description: '温柔女声，适合娱乐' },
      { id: 1041, name: '智小悦', description: '可爱女声，适合娱乐' },
      { id: 1042, name: '智小清', description: '青春女声，适合娱乐' },
      { id: 1043, name: '智小楚', description: '温柔女声，适合娱乐' },
      { id: 1044, name: '智小馨', description: '可爱女声，适合娱乐' },
      { id: 1045, name: '智小秋', description: '青春女声，适合娱乐' },
      { id: 1046, name: '智小丹', description: '温柔女声，适合娱乐' },
      { id: 1047, name: '智小灵', description: '可爱女声，适合娱乐' },
      { id: 1048, name: '智小梦', description: '温柔女声，适合娱乐' },
      { id: 1049, name: '智小然', description: '青春女声，适合娱乐' },
      { id: 1050, name: '智小枫', description: '成熟女声，适合朗读' },
      { id: 1051, name: '智小柔', description: '温柔女声，适合娱乐' },
      { id: 1052, name: '智小宁', description: '青春女声，适合娱乐' },
      { id: 1053, name: '智小瑶', description: '可爱女声，适合娱乐' },
      { id: 1054, name: '智小琳', description: '温柔女声，适合娱乐' },
      { id: 1055, name: '智小珊', description: '青春女声，适合娱乐' },
      { id: 1056, name: '智小露', description: '可爱女声，适合娱乐' },
      { id: 1057, name: '智小菲', description: '温柔女声，适合娱乐' },
      { id: 1058, name: '智小佳', description: '青春女声，适合娱乐' },
      { id: 1059, name: '智小玉', description: '可爱女声，适合娱乐' },
      { id: 1060, name: '智小芳', description: '温柔女声，适合娱乐' },
      { id: 1061, name: '智小希', description: '青春女声，适合娱乐' },
      { id: 1062, name: '智小甜', description: '可爱女声，适合娱乐' },
      { id: 1063, name: '智小静', description: '温柔女声，适合娱乐' },
      { id: 1064, name: '智小慧', description: '青春女声，适合娱乐' },
      { id: 1065, name: '智小琳', description: '可爱女声，适合娱乐' },
      { id: 1066, name: '智小云', description: '温柔女声，适合娱乐' },
      { id: 1067, name: '智小晴', description: '青春女声，适合娱乐' },
      { id: 1068, name: '智小月', description: '可爱女声，适合娱乐' },
      { id: 1069, name: '智小霞', description: '温柔女声，适合娱乐' },
      { id: 1070, name: '智小瑶', description: '青春女声，适合娱乐' },
      { id: 1071, name: '智小雪', description: '可爱女声，适合娱乐' },
      { id: 1072, name: '智小冰', description: '温柔女声，适合娱乐' },
      { id: 1073, name: '智小霜', description: '青春女声，适合娱乐' },
      { id: 1074, name: '智小露', description: '可爱女声，适合娱乐' },
      { id: 1075, name: '智小烟', description: '温柔女声，适合娱乐' },
      { id: 1076, name: '智小溪', description: '青春女声，适合娱乐' },
      { id: 1077, name: '智小晨', description: '可爱女声，适合娱乐' },
      { id: 1078, name: '智小暮', description: '温柔女声，适合娱乐' },
      { id: 1079, name: '智小夜', description: '青春女声，适合娱乐' },
      { id: 1080, name: '智小晓', description: '可爱女声，适合娱乐' },
      { id: 1081, name: '智小晨', description: '温柔女声，适合娱乐' },
      { id: 1082, name: '智小暮', description: '青春女声，适合娱乐' },
      { id: 1083, name: '智小夜', description: '可爱女声，适合娱乐' },
      { id: 1084, name: '智小晓', description: '温柔女声，适合娱乐' },
      { id: 1085, name: '智小晨', description: '青春女声，适合娱乐' },
      { id: 1086, name: '智小暮', description: '可爱女声，适合娱乐' },
      { id: 1087, name: '智小夜', description: '温柔女声，适合娱乐' },
      { id: 1088, name: '智小晓', description: '青春女声，适合娱乐' },
      { id: 1089, name: '智小晨', description: '可爱女声，适合娱乐' },
      { id: 1090, name: '智小暮', description: '温柔女声，适合娱乐' },
      { id: 1091, name: '智小夜', description: '青春女声，适合娱乐' },
      { id: 1092, name: '智小晓', description: '可爱女声，适合娱乐' },
      { id: 1093, name: '智小晨', description: '温柔女声，适合娱乐' },
      { id: 1094, name: '智小暮', description: '青春女声，适合娱乐' },
      { id: 1095, name: '智小夜', description: '可爱女声，适合娱乐' },
      { id: 1096, name: '智小晓', description: '青春女声，适合娱乐' },
      { id: 1097, name: '智小晨', description: '可爱女声，适合娱乐' },
      { id: 1098, name: '智小暮', description: '温柔女声，适合娱乐' },
      { id: 1099, name: '智小夜', description: '青春女声，适合娱乐' },
      { id: 1100, name: '智小晓', description: '可爱女声，适合娱乐' }
    ];
  }
}

// 导出单例实例
export const tencentCloudVoiceService = TencentCloudVoiceService.getInstance();