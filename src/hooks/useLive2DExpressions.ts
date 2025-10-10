import { useRef, useCallback } from 'react';
import { LAppDelegate } from '../lib/live2d/src/lappdelegate';

// 类型定义
interface ExpressionReturn {
  triggerRandomExpression: () => boolean;
  triggerExpression: (expressionId: string) => boolean;
  getAvailableExpressions: () => string[];
  triggerHappyExpression: () => boolean;
  triggerSurprisedExpression: () => boolean;
  triggerSadExpression: () => boolean;
  triggerAngryExpression: () => boolean;
  scheduleExpression: (expressionFn: () => boolean, delay?: number) => void;
  clearScheduledExpression: () => void;
}

/**
 * Live2D表情管理Hook
 * 提供表情触发、状态管理和表情映射功能
 */
export const useLive2DExpressions = (): ExpressionReturn => {
  const expressionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * 触发随机表情
   */
  const triggerRandomExpression = useCallback((): boolean => {
    try {
      console.log('🎭 开始触发表情...');

      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) {
        console.warn('❌ LAppDelegate未初始化');
        return false;
      }

      const subdelegateList = appDelegate.getSubdelegate();
      if (!subdelegateList || subdelegateList.getSize() === 0) {
        console.warn('❌ Subdelegate未初始化或为空');
        return false;
      }

      const subdelegate = subdelegateList.at(0);
      if (!subdelegate) {
        console.warn('❌ 无法获取第一个Subdelegate');
        return false;
      }

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) {
        console.warn('❌ Live2D Manager未初始化');
        return false;
      }

      const modelList = live2dManager._models;
      if (!modelList || modelList.getSize() === 0) {
        // 静默失败: 模型可能正在切换中
        // console.warn('❌ 没有已加载的模型');
        return false;
      }

      const model = modelList.at(0);
      if (!model) {
        console.warn('❌ 无法获取第一个模型');
        return false;
      }

      // 检查模型是否完全加载
      const coreModel = model.getModel();
      if (!coreModel) {
        console.warn('❌ 模型Core未加载');
        return false;
      }

      // 检查是否有表情系统
      if (!model._expressions) {
        console.warn('❌ 模型没有表情系统');
        return false;
      }

      // 检查是否有可用的表情
      const expressionCount = model._expressions.getSize();
      console.log(`📋 发现 ${expressionCount} 个表情`);

      if (expressionCount === 0) {
        console.warn('⚠️ 模型没有配置任何表情');
        return false;
      }

      // 显示可用表情列表
      console.log('🎭 可用表情列表:');
      for (let i = 0; i < expressionCount; i++) {
        try {
          const expression = model._expressions._keyValues[i];
          if (expression && expression.first) {
            console.log(`  - ${expression.first}`);
          }
        } catch (e) {
          console.warn(`  ❌ 无法读取表情 ${i}`);
        }
      }

      // 触发随机表情
      if (typeof model.setRandomExpression === 'function') {
        console.log('🎲 触发随机表情...');
        model.setRandomExpression();
        console.log('✅ 随机表情触发成功');
        return true;
      } else {
        console.warn('❌ setRandomExpression方法不存在');
        return false;
      }
    } catch (error: any) {
      console.error('❌ 触发随机表情失败:', error.message);
      return false;
    }
  }, []);

  /**
   * 触发指定表情
   */
  const triggerExpression = useCallback((expressionId: string): boolean => {
    try {
      console.log(`🎭 触发指定表情: ${expressionId}`);

      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) {
        console.warn('❌ LAppDelegate未初始化');
        return false;
      }

      const subdelegateList = appDelegate.getSubdelegate();
      if (!subdelegateList || subdelegateList.getSize() === 0) {
        console.warn('❌ Subdelegate未初始化或为空');
        return false;
      }

      const subdelegate = subdelegateList.at(0);
      if (!subdelegate) {
        console.warn('❌ 无法获取第一个Subdelegate');
        return false;
      }

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) {
        console.warn('❌ Live2D Manager未初始化');
        return false;
      }

      const modelList = live2dManager._models;
      if (!modelList || modelList.getSize() === 0) {
        // 静默失败: 模型可能正在切换中
        // console.warn('❌ 没有已加载的模型');
        return false;
      }

      const model = modelList.at(0);
      if (!model) {
        console.warn('❌ 无法获取第一个模型');
        return false;
      }

      // 检查模型是否完全加载
      const coreModel = model.getModel();
      if (!coreModel) {
        console.warn('❌ 模型Core未加载');
        return false;
      }

      // 检查是否有表情系统
      if (!model._expressions) {
        console.warn('❌ 模型没有表情系统');
        return false;
      }

      // 检查表情是否存在
      const expressionCount = model._expressions.getSize();
      if (expressionCount === 0) {
        console.warn('⚠️ 模型没有配置任何表情');
        return false;
      }

      // 验证表情ID是否有效
      let expressionExists = false;
      console.log(`🔍 验证表情 "${expressionId}" 是否存在...`);

      for (let i = 0; i < expressionCount; i++) {
        try {
          const expression = model._expressions._keyValues[i];
          if (expression && expression.first === expressionId) {
            expressionExists = true;
            console.log(`✅ 找到表情: ${expressionId}`);
            break;
          }
        } catch (e) {
          console.warn(`  ❌ 检查表情 ${i} 时出错`);
        }
      }

      if (!expressionExists) {
        console.warn(`⚠️ 表情 "${expressionId}" 不存在`);
        // 显示可用表情供调试
        console.log('💡 可用表情:');
        for (let i = 0; i < expressionCount; i++) {
          try {
            const expression = model._expressions._keyValues[i];
            if (expression && expression.first) {
              console.log(`  - ${expression.first}`);
            }
          } catch (e) {
            console.warn(`  ❌ 无法读取表情 ${i}`);
          }
        }
        return false;
      }

      // 触发指定表情
      if (typeof model.setExpression === 'function') {
        console.log(`🎯 触发表情: ${expressionId}`);
        model.setExpression(expressionId);
        console.log(`✅ 表情 "${expressionId}" 触发成功`);
        return true;
      } else {
        console.warn('❌ setExpression方法不存在');
        return false;
      }
    } catch (error: any) {
      console.error(`❌ 触发表情[${expressionId}]失败:`, error.message);
      return false;
    }
  }, []);

  /**
   * 获取可用表情列表
   */
  const getAvailableExpressions = useCallback((): string[] => {
    try {
      console.log('📋 获取可用表情列表...');

      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) {
        console.warn('❌ LAppDelegate未初始化');
        return [];
      }

      const subdelegateList = appDelegate.getSubdelegate();
      if (!subdelegateList || subdelegateList.getSize() === 0) {
        console.warn('❌ Subdelegate未初始化或为空');
        return [];
      }

      const subdelegate = subdelegateList.at(0);
      if (!subdelegate) {
        console.warn('❌ 无法获取第一个Subdelegate');
        return [];
      }

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) {
        console.warn('❌ Live2D Manager未初始化');
        return [];
      }

      const modelList = live2dManager._models;
      if (!modelList || modelList.getSize() === 0) {
        // 静默失败: 模型可能正在切换中
        // console.warn('❌ 没有已加载的模型');
        return [];
      }

      const model = modelList.at(0);
      if (!model) {
        console.warn('❌ 无法获取第一个模型');
        return [];
      }

      // 检查模型是否完全加载
      const coreModel = model.getModel();
      if (!coreModel) {
        console.warn('❌ 模型Core未加载');
        return [];
      }

      // 检查是否有表情系统
      if (!model._expressions) {
        console.warn('❌ 模型没有表情系统');
        return [];
      }

      const expressions: string[] = [];
      const expressionCount = model._expressions.getSize();
      console.log(`🔍 扫描 ${expressionCount} 个表情...`);

      for (let i = 0; i < expressionCount; i++) {
        try {
          const expression = model._expressions._keyValues[i];
          if (expression && expression.first) {
            expressions.push(expression.first);
            console.log(`  ✅ 找到表情: ${expression.first}`);
          } else {
            console.warn(`  ⚠️ 表情 ${i} 数据不完整`);
          }
        } catch (e: any) {
          console.warn(`  ❌ 读取表情 ${i} 失败:`, e.message);
        }
      }

      console.log(`📊 成功获取 ${expressions.length} 个可用表情:`, expressions);
      return expressions;
    } catch (error: any) {
      console.error('❌ 获取表情列表失败:', error.message);
      return [];
    }
  }, []);

  /**
   * 触发开心表情
   */
  const triggerHappyExpression = useCallback((): boolean => {
    const expressions = getAvailableExpressions();
    const happyExpressions = expressions.filter(exp =>
      exp.toLowerCase().includes('happy') ||
      exp.toLowerCase().includes('smile') ||
      exp.toLowerCase().includes('joy')
    );

    if (happyExpressions.length > 0) {
      return triggerExpression(happyExpressions[0]);
    }
    return triggerRandomExpression();
  }, [getAvailableExpressions, triggerExpression, triggerRandomExpression]);

  /**
   * 触发惊讶表情
   */
  const triggerSurprisedExpression = useCallback((): boolean => {
    const expressions = getAvailableExpressions();
    const surprisedExpressions = expressions.filter(exp =>
      exp.toLowerCase().includes('surprised') ||
      exp.toLowerCase().includes('surprise')
    );

    if (surprisedExpressions.length > 0) {
      return triggerExpression(surprisedExpressions[0]);
    }
    return triggerRandomExpression();
  }, [getAvailableExpressions, triggerExpression, triggerRandomExpression]);

  /**
   * 触发悲伤表情
   */
  const triggerSadExpression = useCallback((): boolean => {
    const expressions = getAvailableExpressions();
    const sadExpressions = expressions.filter(exp =>
      exp.toLowerCase().includes('sad') ||
      exp.toLowerCase().includes('cry')
    );

    if (sadExpressions.length > 0) {
      return triggerExpression(sadExpressions[0]);
    }
    return triggerRandomExpression();
  }, [getAvailableExpressions, triggerExpression, triggerRandomExpression]);

  /**
   * 触发愤怒表情
   */
  const triggerAngryExpression = useCallback((): boolean => {
    const expressions = getAvailableExpressions();
    const angryExpressions = expressions.filter(exp =>
      exp.toLowerCase().includes('angry') ||
      exp.toLowerCase().includes('mad')
    );

    if (angryExpressions.length > 0) {
      return triggerExpression(angryExpressions[0]);
    }
    return triggerRandomExpression();
  }, [getAvailableExpressions, triggerExpression, triggerRandomExpression]);

  /**
   * 延迟触发表情
   */
  const scheduleExpression = useCallback((expressionFn: () => boolean, delay: number = 1000): void => {
    // 清除之前的定时器
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
    }

    expressionTimeoutRef.current = setTimeout(() => {
      expressionFn();
    }, delay);
  }, []);

  /**
   * 清除表情定时器
   */
  const clearScheduledExpression = useCallback((): void => {
    if (expressionTimeoutRef.current) {
      clearTimeout(expressionTimeoutRef.current);
      expressionTimeoutRef.current = null;
    }
  }, []);

  return {
    triggerRandomExpression,
    triggerExpression,
    getAvailableExpressions,
    triggerHappyExpression,
    triggerSurprisedExpression,
    triggerSadExpression,
    triggerAngryExpression,
    scheduleExpression,
    clearScheduledExpression
  };
};