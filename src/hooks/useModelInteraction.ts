import { useCallback } from 'react';
import { getModelInteractionConfig } from '@/data/model-interactions';
import type { ModelInteraction, InteractionCategory } from '@/types/model-interaction';

interface UseModelInteractionOptions {
  triggerMotion: (groupName: string, motionIndex?: number) => void;
  triggerExpression: (name: string) => void;
  triggerRandomExpression: () => boolean;
}

/** Workflow 执行状态 → 互动类别映射 */
const WORKFLOW_STATUS_CATEGORY: Record<string, InteractionCategory> = {
  running: 'thinking',
  completed: 'happy',
  failed: 'sad',
  cancelled: 'surprised',
};

/**
 * 模型个性化互动 Hook
 * 根据模型配置执行差异化的 motion/expression 组合
 */
export function useModelInteraction({
  triggerMotion,
  triggerExpression,
  triggerRandomExpression,
}: UseModelInteractionOptions) {

  /** 执行单个互动（motion + expression） */
  const executeInteraction = useCallback((interaction: ModelInteraction) => {
    if (interaction.motion != null) {
      triggerMotion(interaction.motion, interaction.motionIndex);
    }
    if (interaction.expression != null) {
      triggerExpression(interaction.expression);
    }
    // 如果 motion 和 expression 都为 null，触发随机表情作为 fallback
    if (interaction.motion == null && interaction.expression == null) {
      triggerRandomExpression();
    }
  }, [triggerMotion, triggerExpression, triggerRandomExpression]);

  /** 处理模型点击——从配置的 clickInteractions 中随机选一个执行 */
  const handleModelClick = useCallback((modelName: string) => {
    const config = getModelInteractionConfig(modelName);

    if (!config || config.clickInteractions.length === 0) {
      // 没有配置或空配置 → 降级为随机表情
      triggerRandomExpression();
      return;
    }

    const idx = Math.floor(Math.random() * config.clickInteractions.length);
    executeInteraction(config.clickInteractions[idx]);
  }, [executeInteraction, triggerRandomExpression]);

  /**
   * 处理 Workflow 状态变化 → 从模型配置中选择匹配类别的互动并执行
   * @param modelName 当前 Live2D 模型名
   * @param status Workflow 执行状态
   */
  const handleWorkflowStatus = useCallback((modelName: string, status: string) => {
    const category = WORKFLOW_STATUS_CATEGORY[status];
    if (!category) return;

    const config = getModelInteractionConfig(modelName);
    if (!config) {
      triggerRandomExpression();
      return;
    }

    // 从 menuInteractions 中找匹配类别的互动
    const candidates = config.menuInteractions.filter((i) => i.category === category);
    if (candidates.length > 0) {
      const picked = candidates[Math.floor(Math.random() * candidates.length)];
      executeInteraction(picked);
    } else {
      triggerRandomExpression();
    }
  }, [executeInteraction, triggerRandomExpression]);

  return { executeInteraction, handleModelClick, handleWorkflowStatus };
}
