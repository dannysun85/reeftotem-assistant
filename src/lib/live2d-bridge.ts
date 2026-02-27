/**
 * Live2D Bridge - 情感分析与表情映射工具
 * 提供 AI 回复文本 → 情感分析 → Live2D 表情/动作 的转换管道
 */

import { invoke } from '@/lib/bridge';
import { getModelInteractionConfig } from '@/data/model-interactions';

/** 语义情感类型 */
export type Emotion = 'happy' | 'sad' | 'angry' | 'surprised' | 'thinking' | 'shy' | 'neutral';

/** 情感关键词映射 */
const EMOTION_KEYWORDS: Record<Emotion, string[]> = {
  happy:     ['😊', '开心', '高兴', '太好了', '哈哈', '不错', '恭喜', 'great', 'happy', 'glad', 'awesome', 'wonderful', '棒', '好的', '没问题'],
  sad:       ['😢', '难过', '遗憾', '抱歉', 'sorry', 'unfortunately', 'sad', '对不起', '失败'],
  angry:     ['😠', '生气', '愤怒', 'angry'],
  surprised: ['😲', '惊', 'wow', 'amazing', 'incredible', '没想到', '居然', '竟然'],
  thinking:  ['🤔', '让我想想', '思考', '分析', 'consider', 'hmm', 'well', '首先', '其次'],
  shy:       ['😳', '害羞', '不好意思', '谢谢夸奖', '过奖'],
  neutral:   [],
};

/** 情感 → 表情 ID 映射（按优先级排列，适配 Haru 模型） */
const EMOTION_TO_EXPRESSION: Record<Emotion, string[]> = {
  happy:     ['smile', 'happy-01', 'happy-02'],
  sad:       ['sad', 'cry'],
  angry:     ['angry'],
  surprised: ['surprise', 'surprised'],
  thinking:  ['coldness'],
  shy:       ['shy'],
  neutral:   ['smile'],
};

/** 从 AI 回复文本中分析情感 */
export function analyzeEmotion(text: string): Emotion {
  const lower = text.toLowerCase();

  let bestEmotion: Emotion = 'neutral';
  let bestScore = 0;

  for (const [emotion, keywords] of Object.entries(EMOTION_KEYWORDS) as [Emotion, string[]][]) {
    if (keywords.length === 0) continue;
    let score = 0;
    for (const kw of keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score++;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestEmotion = emotion;
    }
  }

  return bestEmotion;
}

/** 将语义情感映射到模型表情 ID（返回第一个候选） */
export function emotionToExpressionId(emotion: Emotion): string {
  const candidates = EMOTION_TO_EXPRESSION[emotion];
  return candidates[0] ?? 'smile';
}

/** 模型感知版：优先使用模型专属映射，兜底全局映射 */
export function emotionToExpressionIdForModel(emotion: Emotion, modelName: string): string {
  const config = getModelInteractionConfig(modelName);
  if (config?.ttsEmotionMap?.[emotion]) {
    return config.ttsEmotionMap[emotion]!;
  }
  return emotionToExpressionId(emotion);
}

/** 一步到位：分析文本并返回表情 ID */
export function textToExpressionId(text: string): string {
  return emotionToExpressionId(analyzeEmotion(text));
}

/** 触发 Live2D 表情（通过 Tauri invoke → Rust → emit → Live2D 窗口） */
export async function triggerLive2DExpression(expression: string): Promise<void> {
  try {
    await invoke('trigger_live2d_expression', { expression });
  } catch (e) {
    console.warn('Live2D 表情触发失败:', e);
  }
}

/** 触发 Live2D 动作 */
export async function triggerLive2DMotion(motion: string): Promise<void> {
  try {
    await invoke('trigger_live2d_motion', { motion });
  } catch (e) {
    console.warn('Live2D 动作触发失败:', e);
  }
}

/** 设置 Live2D 口型同步级别 (0.0 ~ 1.0)，高频调用，静默失败 */
export async function setLive2DLipSyncLevel(level: number): Promise<void> {
  try {
    await invoke('set_live2d_lip_sync_level', { level });
  } catch {
    // 静默失败，避免控制台刷屏
  }
}
