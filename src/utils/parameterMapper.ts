/**
 * Live2D参数映射工具
 * 用于将参数名称映射到正确的索引
 */

import { LAppDelegate } from '../lib/live2d/src/lappdelegate';

interface ParameterMapping {
  [paramName: string]: number | null;
}

class ParameterMapper {
  private static instance: ParameterMapper;
  private parameterMap: ParameterMapping = {};
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): ParameterMapper {
    if (!ParameterMapper.instance) {
      ParameterMapper.instance = new ParameterMapper();
    }
    return ParameterMapper.instance;
  }

  /**
   * 初始化参数映射
   */
  public initializeParameterMapping(maxRetries: number = 3): void {
    if (this.isInitialized) {
      // 静默跳过重复初始化 - 避免每次鼠标移动都输出
      return;
    }

    this.performInitializationWithRetry(maxRetries, 0);
  }

  /**
   * 带重试机制的初始化（增强版本）
   */
  private performInitializationWithRetry(maxRetries: number, currentAttempt: number): void {
    try {
      console.log(`🔍 检查Live2D系统状态... (尝试 ${currentAttempt + 1}/${maxRetries + 1})`);

      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) {
        throw new Error('LAppDelegate未初始化');
      }

      const subdelegateList = appDelegate.getSubdelegate();
      if (!subdelegateList || subdelegateList.getSize() === 0) {
        throw new Error('Subdelegate未初始化或为空');
      }

      const subdelegate = subdelegateList.at(0);
      if (!subdelegate) {
        throw new Error('无法获取第一个Subdelegate');
      }

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) {
        throw new Error('Live2D Manager未初始化');
      }

      const modelList = live2dManager._models;
      if (!modelList || modelList.getSize() === 0) {
        throw new Error('没有找到Live2D模型');
      }

      const model = modelList.at(0);
      if (!model) {
        throw new Error('无法获取第一个Live2D模型');
      }

      const coreModel = model.getModel();
      if (!coreModel) {
        throw new Error('模型Core未加载');
      }

      // 检查模型是否真正可用
      if (typeof coreModel.getParameterCount !== 'function') {
        throw new Error('模型Core API不可用');
      }

      const paramCount = coreModel.getParameterCount();
      if (paramCount === 0 || isNaN(paramCount)) {
        throw new Error('模型参数数量无效或为0');
      }

      // 模型已完全加载，开始映射
      console.log(`🎯 模型验证通过！参数数量: ${paramCount}`);
      this.performParameterMapping(coreModel, paramCount);

    } catch (error: any) {
      console.warn(`❌ 初始化失败 (尝试 ${currentAttempt + 1}):`, error.message);

      if (currentAttempt < maxRetries) {
        const delay = 2000 * (currentAttempt + 1); // 增加延迟时间
        console.log(`⏳ ${delay}ms后重试...`);

        setTimeout(() => {
          this.performInitializationWithRetry(maxRetries, currentAttempt + 1);
        }, delay);
      } else {
        console.error('❌ 参数映射初始化最终失败，已达到最大重试次数');
        console.error('💡 建议：检查Live2D模型文件是否正确加载');
        console.log('🔧 尝试手动运行 window.checkModelStatus() 获取详细信息');

        // 标记为初始化失败，避免重复尝试
        this.isInitialized = true;
      }
    }
  }

  /**
   * 执行实际的参数映射
   */
  private performParameterMapping(coreModel: any, paramCount: number): void {
    console.log(`✅ 模型已完全加载，开始映射 ${paramCount} 个参数...`);
    console.log('📋 可用参数列表:');

    // 先显示所有可用参数
    const validParams = [];
    for (let i = 0; i < paramCount; i++) {
      try {
        const paramId = coreModel.getParameterId(i);
        const defaultValue = coreModel.getParameterDefaultValue(i);
        const maxValue = coreModel.getParameterMaximumValue(i);
        const minValue = coreModel.getParameterMinimumValue(i);

        // 验证参数值是否有效
        if (typeof defaultValue === 'number' &&
            typeof maxValue === 'number' &&
            typeof minValue === 'number' &&
            !isNaN(defaultValue) && !isNaN(maxValue) && !isNaN(minValue)) {

          validParams.push({
            index: i,
            id: paramId,
            defaultValue,
            maxValue,
            minValue,
            range: maxValue - minValue
          });

          console.log(`  ✅ 参数 ${i}: ID=${paramId}, 默认值=${defaultValue.toFixed(3)}, 范围=[${minValue.toFixed(3)}, ${maxValue.toFixed(3)}]`);
        } else {
          console.warn(`  ⚠️ 参数 ${i} 数据无效，跳过`);
        }
      } catch (e: any) {
        console.warn(`  ❌ 无法读取参数 ${i}:`, e.message);
      }
    }

    console.log(`📊 有效参数数量: ${validParams.length}/${paramCount}`);

    if (validParams.length === 0) {
      console.warn('⚠️ 没有找到有效的参数，可能模型未完全加载');
      return;
    }

    // 进行智能参数映射
    console.log('🗺️ 开始智能参数名称映射...');
    let mappedCount = 0;

    for (const param of validParams) {
      try {
        const mappedName = this.identifyParameterByFeatures(param.index, param.defaultValue, param.minValue, param.maxValue, param.range);
        if (mappedName) {
          this.parameterMap[mappedName] = param.index;
          console.log(`✅ 智能识别参数 ${param.index} -> ${mappedName} (范围: ${param.minValue.toFixed(2)} ~ ${param.maxValue.toFixed(2)})`);
          mappedCount++;
        } else {
          console.log(`⚠️ 参数 ${param.index} 未能识别 (范围: ${param.minValue.toFixed(2)} ~ ${param.maxValue.toFixed(2)})`);
        }
      } catch (e: any) {
        console.warn(`映射参数 ${param.index} 失败:`, e.message);
      }
    }

    console.log(`✅ 参数映射完成: ${mappedCount}/${validParams.length} 个参数成功映射`);
    console.log('📋 已映射的参数:', Object.keys(this.parameterMap));
    this.isInitialized = true;
  }

  /**
   * 根据参数特征识别参数类型
   */
  private identifyParameterByFeatures(index: number, defaultValue: number, minValue: number, maxValue: number, range: number): string | null {
    console.log(`🔍 分析参数 ${index}: 范围=${range.toFixed(2)}, 默认值=${defaultValue.toFixed(3)}`);

    // 基于实际参数特征进行识别
    if (index === 0 && range >= 25 && range <= 35) {
      console.log(`  ✅ ParamAngleX (头部X轴旋转)`);
      return 'ParamAngleX';
    }
    if (index === 1 && range >= 25 && range <= 35) {
      console.log(`  ✅ ParamAngleY (头部Y轴旋转)`);
      return 'ParamAngleY';
    }
    if (index === 2 && range >= 25 && range <= 35) {
      console.log(`  ✅ ParamAngleZ (头部Z轴旋转)`);
      return 'ParamAngleZ';
    }
    if (index === 12 && range >= 1.5 && range <= 2.5) {
      console.log(`  ✅ ParamEyeBallX (眼球X轴)`);
      return 'ParamEyeBallX';
    }
    if (index === 13 && range >= 1.5 && range <= 2.5) {
      console.log(`  ✅ ParamEyeBallY (眼球Y轴)`);
      return 'ParamEyeBallY';
    }
    if (index === 25 && range >= 15 && range <= 25) {
      console.log(`  ✅ ParamBodyAngleX (身体X轴倾斜)`);
      return 'ParamBodyAngleX';
    }
    if (index === 26 && range >= 15 && range <= 25) {
      console.log(`  ✅ ParamBodyAngleY (身体Y轴倾斜)`);
      return 'ParamBodyAngleY';
    }
    if (index === 29 && range >= 0.8 && range <= 1.2) {
      console.log(`  ✅ ParamBreath (呼吸)`);
      return 'ParamBreath';
    }
    if (index === 23 && range >= 0.8 && range <= 1.2) {
      console.log(`  ✅ ParamMouthOpenY (嘴部开合)`);
      return 'ParamMouthOpenY';
    }
    if (index === 5 && range >= 0.8 && range <= 1.2) {
      console.log(`  ✅ ParamEyeLOpen (左眼开合)`);
      return 'ParamEyeLOpen';
    }
    if (index === 7 && range >= 0.8 && range <= 1.2) {
      console.log(`  ✅ ParamEyeROpen (右眼开合)`);
      return 'ParamEyeROpen';
    }

    // 眉毛参数特征：范围通常较小
    if (range >= 0.5 && range <= 2) {
      console.log(`  ⚠️ 可能是表情参数（眉毛等）`);
      // 这里可以添加更多表情参数的识别逻辑
    }

    return null;
  }

  /**
   * 获取参数索引
   */
  public getParameterIndex(paramName: string): number | null {
    if (!this.isInitialized) {
      // 不直接初始化，而是先检查模型状态
      if (!this.isModelAvailable()) {
        console.warn(`⚠️ 模型未加载，无法获取参数索引: ${paramName}`);
        return null;
      }
      this.initializeParameterMapping();
    }

    const index = this.parameterMap[paramName];
    if (index === undefined) {
      console.warn(`⚠️ 参数映射中未找到: ${paramName}`);
      // 只在参数未找到时显示可用参数 - 减少日志输出
      console.log('💡 可用参数:', Object.keys(this.parameterMap));
      return null;
    }

    return index;
  }

  /**
   * 检查模型是否可用
   */
  private isModelAvailable(): boolean {
    try {
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegateList = appDelegate.getSubdelegate();
      if (!subdelegateList || subdelegateList.getSize() === 0) return false;

      const subdelegate = subdelegateList.at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const modelList = live2dManager._models;
      if (!modelList || modelList.getSize() === 0) return false;

      const model = modelList.at(0);
      if (!model) return false;

      const coreModel = model.getModel();
      return coreModel !== null;
    } catch (error) {
      console.warn('检查模型可用性时出错:', error);
      return false;
    }
  }

  /**
   * 检查参数是否存在
   */
  public hasParameter(paramName: string): boolean {
    return this.getParameterIndex(paramName) !== null;
  }

  /**
   * 获取所有可用的参数名
   */
  public getAvailableParameters(): string[] {
    if (!this.isInitialized) {
      this.initializeParameterMapping();
    }

    return Object.keys(this.parameterMap);
  }

  /**
   * 重新初始化映射（用于模型切换时）
   */
  public reset(): void {
    this.parameterMap = {};
    this.isInitialized = false;
  }
}

export default ParameterMapper;