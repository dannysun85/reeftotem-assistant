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
      if (!coreModel) return false;

      if (!model._expressions) return false;

      const expressionCount = model._expressions.getSize();
      if (expressionCount === 0) return false;

      if (typeof model.setRandomExpression === 'function') {
        model.setRandomExpression();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('触发随机表情失败:', error.message);
      return false;
    }
  }, []);

  /**
   * 触发指定表情
   */
  const triggerExpression = useCallback((expressionId: string): boolean => {
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
      if (!coreModel) return false;

      if (!model._expressions) return false;

      const expressionCount = model._expressions.getSize();
      if (expressionCount === 0) return false;

      // 验证表情ID是否有效
      let expressionExists = false;
      for (let i = 0; i < expressionCount; i++) {
        try {
          const expression = model._expressions._keyValues[i];
          if (expression && expression.first === expressionId) {
            expressionExists = true;
            break;
          }
        } catch (_e) {
          // skip unreadable expression entry
        }
      }

      if (!expressionExists) return false;

      if (typeof model.setExpression === 'function') {
        model.setExpression(expressionId);
        return true;
      }
      return false;
    } catch (error: any) {
      console.error(`触发表情[${expressionId}]失败:`, error.message);
      return false;
    }
  }, []);

  /**
   * 获取可用表情列表
   */
  const getAvailableExpressions = useCallback((): string[] => {
    try {
      const appDelegate = LAppDelegate.getInstance();
      if (!appDelegate) return [];

      const subdelegateList = appDelegate.getSubdelegate();
      if (!subdelegateList || subdelegateList.getSize() === 0) return [];

      const subdelegate = subdelegateList.at(0);
      if (!subdelegate) return [];

      const live2dManager = subdelegate.getLive2DManager();
      if (!live2dManager) return [];

      const modelList = live2dManager._models;
      if (!modelList || modelList.getSize() === 0) return [];

      const model = modelList.at(0);
      if (!model) return [];

      const coreModel = model.getModel();
      if (!coreModel) return [];

      if (!model._expressions) return [];

      const expressions: string[] = [];
      const expressionCount = model._expressions.getSize();

      for (let i = 0; i < expressionCount; i++) {
        try {
          const expression = model._expressions._keyValues[i];
          if (expression && expression.first) {
            expressions.push(expression.first);
          }
        } catch (_e) {
          // skip unreadable expression entry
        }
      }

      return expressions;
    } catch (error: any) {
      console.error('获取表情列表失败:', error.message);
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