import { useRef, useCallback } from 'react';
import { LAppDelegate } from '../lib/live2d/src/lappdelegate';
import ParameterMapper from '../utils/parameterMapper';
import { EyeTrackingConfig } from '../configs/eye-tracking-config';

// 类型定义
interface ParameterValues {
  eyeBallX: number;
  eyeBallY: number;
  angleX: number;
  angleY: number;
  angleZ: number;
  bodyAngleX: number;
  bodyAngleY: number;
  breathActive: boolean;
}

interface EyeTrackingResult {
  limitedX: number;
  limitedY: number;
}

interface ParametersReturn {
  setEyeTracking: (x: number, y: number, weight?: number) => boolean;
  setHeadRotation: (x: number, y: number, z: number, weight?: number) => boolean;
  setBodyAngle: (x: number, y: number, weight?: number) => boolean;
  setBreathing: (enabled: boolean) => boolean;
  optimizedEyeTracking: (
    mouseX: number,
    mouseY: number,
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number
  ) => EyeTrackingResult;
  resetParameters: () => boolean;
  getCurrentParameters: () => ParameterValues;
}

/**
 * Live2D参数精细控制Hook
 * 提供眼球跟随、头部动作、身体倾斜和呼吸效果等参数控制
 */
export const useLive2DParameters = (): ParametersReturn => {
  const parameterValuesRef = useRef<ParameterValues>({
    eyeBallX: 0,
    eyeBallY: 0,
    angleX: 0,
    angleY: 0,
    angleZ: 0,
    bodyAngleX: 0,
    bodyAngleY: 0,
    breathActive: false
  });

  /**
   * 设置眼球跟随参数
   */
  const setEyeTracking = useCallback((x: number, y: number, weight: number = 1.0): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) {
        console.error('❌ 眼神追踪失败: LAppDelegate未初始化');
        return false;
      }

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) {
        console.error('❌ 眼神追踪失败: Subdelegate未初始化');
        return false;
      }

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) {
        console.error('❌ 眼神追踪失败: Live2D Manager未初始化');
        return false;
      }

      const model = live2dManager._models.at(0);
      if (!model || !model.getModel()) {
        // 模型未加载是正常状态,不打印错误(避免鼠标移动时刷屏)
        return false;
      }

      // ✨ 新方案:直接设置 _dragManager,让 onUpdate 自动处理
      // Live2D 原生的 onUpdate 方法会读取 _dragManager 的值并应用到眼球参数
      // 这样可以避免参数被覆盖的问题
      
      // 应用权重
      const weightedX = x * weight;
      const weightedY = y * weight;

      // 限制在 -1 到 1 范围内
      const finalX = Math.max(-1, Math.min(1, weightedX));
      const finalY = Math.max(-1, Math.min(1, weightedY));

      // 保存当前值
      parameterValuesRef.current.eyeBallX = finalX;
      parameterValuesRef.current.eyeBallY = finalY;

      // 🎯 通过 _dragManager.set() 设置眼神追踪目标
      // 使用 CubismTargetPoint 的原生平滑系统,确保连贯自然
      const modelAny = model as any;
      if (modelAny._dragManager && typeof modelAny._dragManager.set === 'function') {
        // ✅ 使用官方 set() 方法设置目标位置
        // CubismTargetPoint 会自动进行平滑动画,避免抖动
        modelAny._dragManager.set(finalX, finalY);
        
        // 🐛 详细调试日志 (降低到 2% 避免刷屏)
        if (Math.random() < 0.02) {
          console.log('🎯 眼神追踪 (平滑模式):', {
            输入: { x, y },
            权重: weight,
            最终值: { finalX, finalY },
            当前状态: {
              target: { x: (modelAny._dragManager as any)._faceTargetX, y: (modelAny._dragManager as any)._faceTargetY },
              current: { x: (modelAny._dragManager as any)._faceX, y: (modelAny._dragManager as any)._faceY }
            }
          });
        }
        
        return true;
      } else {
        console.error('❌ 眼神追踪失败: _dragManager.set() 不可用', {
          _dragManager存在: !!modelAny._dragManager,
          set方法存在: typeof modelAny._dragManager?.set
        });
        return false;
      }
    } catch (error) {
      console.error('❌ 设置眼球跟随参数失败:', error);
      return false;
    }
  }, []);  /**
   * 设置头部旋转参数
   */
  const setHeadRotation = useCallback((x: number, y: number, z: number, weight: number = 1.0): boolean => {
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

      // 使用参数映射器获取正确的参数索引
      const coreModel = model.getModel();
      const paramMapper = ParameterMapper.getInstance();

      // 确保参数映射已初始化
      paramMapper.initializeParameterMapping();

      const angleXIndex = paramMapper.getParameterIndex('ParamAngleX');
      const angleYIndex = paramMapper.getParameterIndex('ParamAngleY');
      const angleZIndex = paramMapper.getParameterIndex('ParamAngleZ');

      // 验证参数是否存在
      if (angleXIndex === null || angleYIndex === null || angleZIndex === null) {
        console.warn('未找到头部旋转参数:', {
          angleX: angleXIndex,
          angleY: angleYIndex,
          angleZ: angleZIndex
        });
        return false;
      }

      // 应用权重和边界限制
      const weightedX = Math.max(-1, Math.min(1, x * weight));
      const weightedY = Math.max(-1, Math.min(1, y * weight));
      const weightedZ = Math.max(-1, Math.min(1, z * weight));

      // 保存当前值
      parameterValuesRef.current.angleX = weightedX;
      parameterValuesRef.current.angleY = weightedY;
      parameterValuesRef.current.angleZ = weightedZ;

      // 设置参数值 (范围通常 -30 到 30)
      try {
        coreModel.setParameterValueByIndex(angleXIndex, weightedX * 30);
        coreModel.setParameterValueByIndex(angleYIndex, weightedY * 30);
        coreModel.setParameterValueByIndex(angleZIndex, weightedZ * 30);
      } catch (e) {
        console.error('设置头部旋转参数值失败:', e);
        return false;
      }

      return true;
    } catch (error) {
      console.error('设置头部旋转参数失败:', error);
      return false;
    }
  }, []);

  /**
   * 设置身体倾斜参数
   */
  const setBodyAngle = useCallback((x: number, y: number, weight: number = 1.0): boolean => {
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

      // 使用参数映射器获取正确的参数索引
      const coreModel = model.getModel();
      const paramMapper = ParameterMapper.getInstance();

      // 确保参数映射已初始化
      paramMapper.initializeParameterMapping();

      const bodyAngleXIndex = paramMapper.getParameterIndex('ParamBodyAngleX');
      const bodyAngleYIndex = paramMapper.getParameterIndex('ParamBodyAngleY');

      // 验证参数是否存在
      if (bodyAngleXIndex === null || bodyAngleYIndex === null) {
        console.warn('未找到身体倾斜参数:', {
          bodyAngleX: bodyAngleXIndex,
          bodyAngleY: bodyAngleYIndex
        });
        return false;
      }

      // 应用权重和边界限制
      const weightedX = Math.max(-1, Math.min(1, x * weight));
      const weightedY = Math.max(-1, Math.min(1, y * weight));

      // 保存当前值
      parameterValuesRef.current.bodyAngleX = weightedX;
      parameterValuesRef.current.bodyAngleY = weightedY;

      // 设置参数值 (范围通常 -10 到 10)
      try {
        coreModel.setParameterValueByIndex(bodyAngleXIndex, weightedX * 10);
        coreModel.setParameterValueByIndex(bodyAngleYIndex, weightedY * 10);
      } catch (e) {
        console.error('设置身体倾斜参数值失败:', e);
        return false;
      }

      return true;
    } catch (error) {
      console.error('设置身体倾斜参数失败:', error);
      return false;
    }
  }, []);

  /**
   * 呼吸效果控制
   */
  const setBreathing = useCallback((enabled: boolean): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model) return false;

      // 暂时跳过呼吸效果，因为API访问受限
      parameterValuesRef.current.breathActive = enabled;
      console.log(`呼吸效果设置: ${enabled ? '启用' : '禁用'} (暂时未实现)`);

      return true;
    } catch (error) {
      console.error('设置呼吸效果失败:', error);
      return false;
    }
  }, []);

  /**
   * 智能眼神跟随优化
   * 使用可配置的参数来控制追踪行为
   */
  const optimizedEyeTracking = useCallback((
    mouseX: number,
    mouseY: number,
    canvasX: number,
    canvasY: number,
    canvasWidth: number,
    canvasHeight: number
  ): EyeTrackingResult => {
    // 计算相对位置
    const relativeX = (mouseX - canvasX) / canvasWidth;
    const relativeY = (mouseY - canvasY) / canvasHeight;

    // 中心偏移 (使眼部跟踪更自然)
    const centerX = 0.5;
    const centerY = 0.5;

    // 计算偏离中心的距离
    const offsetX = (relativeX - centerX) * 2; // -1 到 1
    const offsetY = (relativeY - centerY) * 2; // -1 到 1

    // 🔧 反转 Y 轴: 屏幕坐标 Y 向下为正,但 Live2D 眼球 Y 向上为正
    const correctedOffsetY = -offsetY;

    // 应用非线性映射，使边缘移动更平滑(使用配置的平滑因子)
    const smoothX = Math.sign(offsetX) * Math.pow(Math.abs(offsetX), EyeTrackingConfig.smoothingFactor);
    const smoothY = Math.sign(correctedOffsetY) * Math.pow(Math.abs(correctedOffsetY), EyeTrackingConfig.smoothingFactor);

    // 限制眼部移动范围(使用配置的最大移动范围)
    const limitedX = Math.max(-EyeTrackingConfig.maxEyeMovement, Math.min(EyeTrackingConfig.maxEyeMovement, smoothX));
    const limitedY = Math.max(-EyeTrackingConfig.maxEyeMovement, Math.min(EyeTrackingConfig.maxEyeMovement, smoothY));

    // 应用配置的权重
    setEyeTracking(limitedX, limitedY, EyeTrackingConfig.eyeWeight);
    setHeadRotation(limitedX * EyeTrackingConfig.headWeight, limitedY * EyeTrackingConfig.headWeight, 0, EyeTrackingConfig.headWeight);

    return { limitedX, limitedY };
  }, [setEyeTracking, setHeadRotation]);

  /**
   * 重置所有参数到默认值
   */
  const resetParameters = useCallback((): boolean => {
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

      // 重置前7个参数到默认值
      const paramCount = coreModel.getParameterCount();
      const resetCount = Math.min(7, paramCount);

      for (let i = 0; i < resetCount; i++) {
        try {
          coreModel.setParameterValueByIndex(i, 0);
        } catch (e) {
          console.warn(`重置参数 ${i} 失败:`, e);
        }
      }

      // 重置内部状态
      parameterValuesRef.current = {
        eyeBallX: 0,
        eyeBallY: 0,
        angleX: 0,
        angleY: 0,
        angleZ: 0,
        bodyAngleX: 0,
        bodyAngleY: 0,
        breathActive: false
      };

      console.log('Live2D参数已重置到默认值');
      return true;
    } catch (error) {
      console.error('重置参数失败:', error);
      return false;
    }
  }, []);

  /**
   * 获取当前参数值
   */
  const getCurrentParameters = useCallback((): ParameterValues => {
    return { ...parameterValuesRef.current };
  }, []);

  return {
    setEyeTracking,
    setHeadRotation,
    setBodyAngle,
    setBreathing,
    optimizedEyeTracking,
    resetParameters,
    getCurrentParameters
  };
};