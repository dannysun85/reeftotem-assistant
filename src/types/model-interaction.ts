import type { Emotion } from '@/lib/live2d-bridge';

export type InteractionCategory =
  | 'greet' | 'happy' | 'sad' | 'angry'
  | 'surprised' | 'shy' | 'special' | 'thinking';

export interface ModelInteraction {
  id: string;
  label: string;
  category: InteractionCategory;
  motion: string | null;      // 传给 triggerMotion 的 groupName，null=不触发
  motionIndex?: number;       // motion group 内的具体索引，undefined=随机
  expression: string | null;  // 传给 triggerExpression 的 name，null=不触发
}

export interface ModelInteractionConfig {
  modelName: string;
  clickInteractions: ModelInteraction[];  // 点击时随机选一个执行
  menuInteractions: ModelInteraction[];   // 右键菜单显示的动作列表
  ttsEmotionMap?: Partial<Record<Emotion, string>>;  // 覆盖全局情感→表情映射
}

export const CATEGORY_META: Record<InteractionCategory, { label: string; icon: string }> = {
  greet:     { label: '打招呼', icon: '👋' },
  happy:     { label: '开心',   icon: '😊' },
  sad:       { label: '难过',   icon: '😢' },
  angry:     { label: '生气',   icon: '😠' },
  surprised: { label: '惊讶',   icon: '😲' },
  shy:       { label: '害羞',   icon: '😳' },
  special:   { label: '特殊技能', icon: '✨' },
  thinking:  { label: '思考',   icon: '🤔' },
};
