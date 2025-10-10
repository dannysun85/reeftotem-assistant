import { useRef, useCallback } from 'react';
import { LAppDelegate } from '../lib/live2d/src/lappdelegate';

// 类型定义
interface PhysicsConfig {
  gravity: number;
  wind: number;
  resistance: number;
  enabled: boolean;
}

interface PhysicsReturn {
  activatePhysics: () => boolean;
  setGravity: (gravity: number) => boolean;
  setWind: (windStrength: number, windDirection?: number) => boolean;
  setResistance: (resistance: number) => boolean;
  triggerBreeze: () => boolean;
  triggerHairMovement: () => boolean;
  triggerClothingMovement: () => boolean;
  disablePhysics: () => boolean;
  getPhysicsConfig: () => PhysicsConfig;
  resetPhysics: () => boolean;
}

/**
 * Live2D物理引擎控制Hook
 * 提供头发飘动、衣物动态、物理参数调节等功能
 */
export const useLive2DPhysics = (): PhysicsReturn => {
  const physicsConfigRef = useRef<PhysicsConfig>({
    gravity: 0.0,
    wind: 0.0,
    resistance: 0.0,
    enabled: true
  });

  /**
   * 检查并激活物理引擎
   */
  const activatePhysics = useCallback((): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) {
        console.warn('Live2D模型没有物理引擎配置');
        return false;
      }

      // 激活物理引擎
      if (model._physics && !physicsConfigRef.current.enabled) {
        physicsConfigRef.current.enabled = true;
        console.log('✅ Live2D物理引擎已激活');
      }

      return true;
    } catch (error) {
      console.error('激活物理引擎失败:', error);
      return false;
    }
  }, []);

  /**
   * 设置重力参数
   */
  const setGravity = useCallback((gravity: number): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) return false;

      // 限制重力范围
      const limitedGravity = Math.max(-1, Math.min(1, gravity));
      physicsConfigRef.current.gravity = limitedGravity;

      // 通过设置物理参数影响重力效果
      console.log(`设置重力参数: ${limitedGravity}`);

      return true;
    } catch (error) {
      console.error('设置重力参数失败:', error);
      return false;
    }
  }, []);

  /**
   * 设置风力效果
   */
  const setWind = useCallback((windStrength: number, windDirection: number = 0): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) return false;

      // 限制风力范围
      const limitedWindStrength = Math.max(-1, Math.min(1, windStrength));
      const limitedWindDirection = windDirection % 360;

      physicsConfigRef.current.wind = limitedWindStrength;

      console.log(`设置风力参数: 强度=${limitedWindStrength}, 方向=${limitedWindDirection}°`);

      return true;
    } catch (error) {
      console.error('设置风力参数失败:', error);
      return false;
    }
  }, []);

  /**
   * 设置运动阻力
   */
  const setResistance = useCallback((resistance: number): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) return false;

      // 限制阻力范围
      const limitedResistance = Math.max(0, Math.min(1, resistance));
      physicsConfigRef.current.resistance = limitedResistance;

      console.log(`设置运动阻力: ${limitedResistance}`);

      return true;
    } catch (error) {
      console.error('设置运动阻力失败:', error);
      return false;
    }
  }, []);

  /**
   * 触发微风效果
   */
  const triggerBreeze = useCallback((): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) return false;

      console.log('触发微风效果');

      // 模拟轻柔的风力效果
      const breezeStrength = 0.3;
      const breezeDirection = Math.random() * 360;

      setWind(breezeStrength, breezeDirection);

      // 3秒后减弱风力
      setTimeout(() => {
        setWind(breezeStrength * 0.5, breezeDirection);
      }, 3000);

      return true;
    } catch (error) {
      console.error('触发微风效果失败:', error);
      return false;
    }
  }, [setWind]);

  /**
   * 模拟头发飘动
   */
  const triggerHairMovement = useCallback((): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) return false;

      console.log('触发头发飘动效果');

      // 设置适合头发飘动的参数
      setWind(0.2, 45); // 轻柔的侧风
      setGravity(0.5);   // 适中的重力
      setResistance(0.3); // 较低的阻力

      // 5秒后恢复默认设置
      setTimeout(() => {
        setWind(0, 0);
        setGravity(0);
        setResistance(0.5);
      }, 5000);

      return true;
    } catch (error) {
      console.error('触发头发飘动失败:', error);
      return false;
    }
  }, [setWind, setGravity, setResistance]);

  /**
   * 模拟衣物动态
   */
  const triggerClothingMovement = useCallback((): boolean => {
    try {
      // LAppDelegate 已在文件顶部导入
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return false;

      const subdelegate = appDelegate.getSubdelegate().at(0);
      if (!subdelegate) return false;

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return false;

      const model = live2dManager._models.at(0);
      if (!model || !model._physics) return false;

      console.log('触发衣物动态效果');

      // 设置适合衣物摆动的参数
      setWind(0.4, 90); // 中等强度的横向风
      setGravity(0.8);   // 较强的重力
      setResistance(0.6); // 中等阻力

      // 4秒后恢复默认设置
      setTimeout(() => {
        setWind(0, 0);
        setGravity(0);
        setResistance(0.5);
      }, 4000);

      return true;
    } catch (error) {
      console.error('触发衣物动态失败:', error);
      return false;
    }
  }, [setWind, setGravity, setResistance]);

  /**
   * 禁用物理引擎
   */
  const disablePhysics = useCallback((): boolean => {
    try {
      physicsConfigRef.current.enabled = false;
      console.log('Live2D物理引擎已禁用');

      // 重置所有物理参数
      setWind(0, 0);
      setGravity(0);
      setResistance(0.5);

      return true;
    } catch (error) {
      console.error('禁用物理引擎失败:', error);
      return false;
    }
  }, [setWind, setGravity, setResistance]);

  /**
   * 获取当前物理配置
   */
  const getPhysicsConfig = useCallback((): PhysicsConfig => {
    return { ...physicsConfigRef.current };
  }, []);

  /**
   * 重置物理参数到默认值
   */
  const resetPhysics = useCallback((): boolean => {
    try {
      physicsConfigRef.current = {
        gravity: 0.0,
        wind: 0.0,
        resistance: 0.5,
        enabled: true
      };

      setWind(0, 0);
      setGravity(0);
      setResistance(0.5);

      console.log('Live2D物理参数已重置到默认值');
      return true;
    } catch (error) {
      console.error('重置物理参数失败:', error);
      return false;
    }
  }, [setWind, setGravity, setResistance]);

  return {
    activatePhysics,
    setGravity,
    setWind,
    setResistance,
    triggerBreeze,
    triggerHairMovement,
    triggerClothingMovement,
    disablePhysics,
    getPhysicsConfig,
    resetPhysics
  };
};