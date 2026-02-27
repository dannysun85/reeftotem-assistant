import { useRef, useCallback } from 'react';
import { LAppDelegate } from '../lib/live2d/src/lappdelegate';

// 类型定义
interface LipSyncConfig {
  enabled: boolean;
  currentLevel: number;
  smoothingFactor: number;
  sensitivity: number;
  lastUpdateTime: number;
}

interface LipSyncReturn {
  activateLipSync: () => boolean;
  deactivateLipSync: () => void;
  setLipSyncValue: (level: number) => boolean;
  calculateLipSyncLevel: (audioData: Float32Array, sampleRate?: number) => number;
  processAudioForLipSync: (audioData: Float32Array, sampleRate?: number) => boolean;
  processTTSData: (ttsData: ArrayBuffer) => boolean;
  configureLipSync: (sensitivity?: number, smoothingFactor?: number) => void;
  testLipSync: () => boolean;
  getLipSyncIds: () => string[];
  getLipSyncConfig: () => LipSyncConfig;
  getCurrentLipSyncLevel: () => number;
}

/**
 * Live2D唇形同步Hook
 * 利用Live2D内置_lipSyncIds参数系统实现音频级别到嘴部开合的映射
 */
export const useLive2DLipSync = (): LipSyncReturn => {
  const lipSyncConfigRef = useRef<LipSyncConfig>({
    enabled: false,
    currentLevel: 0.0,
    smoothingFactor: 0.3,
    sensitivity: 1.0,
    lastUpdateTime: 0
  });

  /**
   * 检查并获取唇形同步参数ID
   */
  const getLipSyncIds = useCallback((): string[] => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return [];

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return [];

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return [];

      const model = live2dManager._models.at(0);
      if (!model || !model.getModel()) return [];

      // 获取内置的_lipSyncIds参数
      const lipSyncIds = (model as any)._lipSyncIds;
      if (!lipSyncIds || lipSyncIds.getSize() === 0) {
        console.warn('Live2D模型没有配置唇形同步参数');
        return [];
      }

      const lipSyncCount = lipSyncIds.getSize();

      // 转换为JavaScript数组，并提取字符串ID
      const lipSyncArray = [];
      for (let i = 0; i < lipSyncCount; i++) {
        const paramId = lipSyncIds.at(i);
        if (paramId) {
          // 尝试获取字符串值
          try {
            const stringId = paramId.getString ? paramId.getString() : String(paramId);
            lipSyncArray.push(stringId);
          } catch (e) {
            console.warn(`无法转换参数ID ${i} 为字符串`);
          }
        }
      }

      return lipSyncArray;
    } catch (error) {
      console.error('获取唇形同步参数失败:', error);
      return [];
    }
  }, []);

  /**
   * 激活唇形同步系统
   */
  const activateLipSync = useCallback((): boolean => {
    const lipSyncIds = getLipSyncIds();
    if (lipSyncIds.length === 0) {
      console.warn('无法激活唇形同步：模型没有唇形同步参数');
      return false;
    }

    lipSyncConfigRef.current.enabled = true;
    return true;
  }, [getLipSyncIds]);

  /**
   * 禁用唇形同步系统
   */
  const deactivateLipSync = useCallback((): void => {
    lipSyncConfigRef.current.enabled = false;
    lipSyncConfigRef.current.currentLevel = 0.0;

    // 强制重置所有唇形参数为0
    try {
      const appDelegate = LAppDelegate.getInstance();
      if (appDelegate) {
        const subdelegate = appDelegate.getSubdelegate().at(0);
        if (subdelegate) {
          const live2dManager = subdelegate.getLive2DManager();
          if (live2dManager) {
            const model = live2dManager._models.at(0);
            if (model && model.getModel() && model._lipSyncIds) {
              const coreModel = model.getModel();
              const lipSyncCount = model._lipSyncIds.getSize();
              for (let i = 0; i < lipSyncCount; i++) {
                const paramId = model._lipSyncIds.at(i);
                if (paramId) {
                  coreModel.setParameterValueById(paramId, 0.0);
                }
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('重置唇形参数失败:', error);
    }

  }, []);

  /**
   * 设置唇形同步参数值
   */
  const setLipSyncValue = useCallback((level: number): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model.getModel()) return false;

      const coreModel = model.getModel();
      const lipSyncIds = model._lipSyncIds;

      if (!lipSyncIds || lipSyncIds.getSize() === 0) return false;

      // 限制级别范围
      const limitedLevel = Math.max(0.0, Math.min(1.0, level));

      // 应用平滑处理
      const config = lipSyncConfigRef.current;
      const smoothedLevel = config.currentLevel +
        (limitedLevel - config.currentLevel) * config.smoothingFactor;

      config.currentLevel = smoothedLevel;

      // 设置唇形同步参数值
      const lipSyncCount = lipSyncIds.getSize();
      for (let i = 0; i < lipSyncCount; i++) {
        const paramId = lipSyncIds.at(i);
        if (paramId) {
          // 根据参数索引应用不同的权重和偏移
          let value = smoothedLevel;

          // HaruGreeter模型的唇形同步参数处理
          if (i === 0) {
            // 嘴部开合参数：直接映射
            value = smoothedLevel;
          } else if (i === 1) {
            // 第二个唇形参数：稍微延迟和平滑
            value = smoothedLevel * 0.8;
          } else {
            // 其他参数：根据需要调整
            value = smoothedLevel * (0.5 + i * 0.1);
          }

          // 应用灵敏度
          value *= config.sensitivity;

          // 设置参数值 (Live2D参数通常范围是0-1，但需要根据具体模型调整)
          coreModel.setParameterValueById(paramId, value);
        }
      }

      return true;
    } catch (error) {
      console.error('设置唇形同步值失败:', error);
      return false;
    }
  }, []);

  /**
   * 从音频数据计算唇形同步级别
   */
  const calculateLipSyncLevel = useCallback((audioData: Float32Array, sampleRate: number = 44100): number => {
    if (!audioData || audioData.length === 0) return 0.0;

    // 计算音频数据的RMS (Root Mean Square) 作为音量级别
    let sum = 0;
    for (let i = 0; i < audioData.length; i++) {
      sum += audioData[i] * audioData[i];
    }
    const rms = Math.sqrt(sum / audioData.length);

    // 对数缩放，使声音变化更自然
    const level = Math.log10(1 + rms * 9) / Math.log10(10);

    // 应用一些基本的频率过滤
    // 这里可以进一步优化，比如检测语音频率范围
    return Math.max(0.0, Math.min(1.0, level));
  }, []);

  /**
   * 处理音频数据进行实时唇形同步
   */
  const processAudioForLipSync = useCallback((audioData: Float32Array, sampleRate: number = 44100): boolean => {
    if (!lipSyncConfigRef.current.enabled) return false;

    const level = calculateLipSyncLevel(audioData, sampleRate);
    return setLipSyncValue(level);
  }, [calculateLipSyncLevel, setLipSyncValue]);

  /**
   * 设置唇形同步参数
   */
  const configureLipSync = useCallback((sensitivity: number = 1.0, smoothingFactor: number = 0.3): void => {
    const config = lipSyncConfigRef.current;
    config.sensitivity = Math.max(0.1, Math.min(2.0, sensitivity));
    config.smoothingFactor = Math.max(0.1, Math.min(0.9, smoothingFactor));

  }, []);

  /**
   * 测试唇形同步效果
   */
  const testLipSync = useCallback((): boolean => {
    if (!lipSyncConfigRef.current.enabled) {
      const activated = activateLipSync();
      if (!activated) return false;
    }

    // 模拟语音波形：渐强 -> 渐弱 -> 静音
    const testSequence = [
      { level: 0.0, duration: 500 },   // 静音
      { level: 0.3, duration: 300 },   // 弱音
      { level: 0.6, duration: 300 },   // 中音
      { level: 0.9, duration: 400 },   // 强音
      { level: 0.6, duration: 300 },   // 中音
      { level: 0.3, duration: 300 },   // 弱音
      { level: 0.0, duration: 500 }    // 静音
    ];

    let totalDelay = 0;
    testSequence.forEach(({ level, duration }) => {
      setTimeout(() => {
        setLipSyncValue(level);
      }, totalDelay);
      totalDelay += duration;
    });

    // 测试完成后重置
    setTimeout(() => {
      setLipSyncValue(0.0);
    }, totalDelay);

    return true;
  }, [activateLipSync, setLipSyncValue]);

  /**
   * 获取当前唇形同步配置
   */
  const getLipSyncConfig = useCallback((): LipSyncConfig => {
    return { ...lipSyncConfigRef.current };
  }, []);

  /**
   * 获取当前唇形同步级别
   */
  const getCurrentLipSyncLevel = useCallback((): number => {
    return lipSyncConfigRef.current.currentLevel;
  }, []);

  /**
   * 预留TTS数据接口 - 用于从Rust端接收TTS音频数据
   */
  const processTTSData = useCallback((ttsData: ArrayBuffer): boolean => {
    try {
      // 将ArrayBuffer转换为Float32Array
      const float32Array = new Float32Array(ttsData);

      // 处理音频数据进行唇形同步
      return processAudioForLipSync(float32Array);
    } catch (error) {
      console.error('处理TTS数据失败:', error);
      return false;
    }
  }, [processAudioForLipSync]);

  return {
    activateLipSync,
    deactivateLipSync,
    setLipSyncValue,
    calculateLipSyncLevel,
    processAudioForLipSync,
    processTTSData,
    configureLipSync,
    testLipSync,
    getLipSyncIds,
    getLipSyncConfig,
    getCurrentLipSyncLevel
  };
};