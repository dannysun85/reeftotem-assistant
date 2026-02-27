import type { ModelInteractionConfig } from '@/types/model-interaction';

/**
 * 12 个 Live2D 模型的个性化互动配置
 *
 * 每个模型根据实际 motion group / expression 资源定义独特互动。
 * motion 字段对应 model3.json 中的 motion group name（如 "TapBody"），
 * expression 字段对应 Expressions 中的 Name。
 */

const haruGreeterConfig: ModelInteractionConfig = {
  modelName: 'HaruGreeter',
  clickInteractions: [
    { id: 'hg-click-1', label: '随机表情', category: 'happy', motion: null, expression: null }, // fallback: triggerRandomExpression
  ],
  menuInteractions: [
    // greet — TapBody indices: [3]浅鞠躬 [4]深鞠躬 [5]右指引 [6]左指引 [8]点头 [9]背手点头
    { id: 'hg-bow-shallow',  label: '浅鞠躬',     category: 'greet', motion: 'TapBody', motionIndex: 3,  expression: 'smile' },
    { id: 'hg-bow-deep',     label: '深鞠躬',     category: 'greet', motion: 'TapBody', motionIndex: 4,  expression: 'smile' },
    { id: 'hg-guide-right',  label: '向右指引',   category: 'greet', motion: 'TapBody', motionIndex: 5,  expression: 'smile' },
    { id: 'hg-guide-left',   label: '向左指引',   category: 'greet', motion: 'TapBody', motionIndex: 6,  expression: 'smile' },
    { id: 'hg-nod-back',     label: '背手点头',   category: 'greet', motion: 'TapBody', motionIndex: 9,  expression: 'smile' },
    // happy — [25]左右摇摆 [26]前倾眯眼 [8]微笑点头
    { id: 'hg-swing',        label: '开心摇摆',   category: 'happy', motion: 'TapBody', motionIndex: 25, expression: 'happy-01' },
    { id: 'hg-lean-happy',   label: '前倾眯眼笑', category: 'happy', motion: 'TapBody', motionIndex: 26, expression: 'happy-02' },
    { id: 'hg-nod',          label: '微笑点头',   category: 'happy', motion: 'TapBody', motionIndex: 8,  expression: 'smile' },
    // surprised — [10]后仰 [11]闭眼张手 [12]叉手点头
    { id: 'hg-lean-back',    label: '惊吓后仰',   category: 'surprised', motion: 'TapBody', motionIndex: 10, expression: 'surprise' },
    { id: 'hg-hands-open',   label: '惊讶张手',   category: 'surprised', motion: 'TapBody', motionIndex: 11, expression: 'surprise' },
    { id: 'hg-nod-surprise', label: '惊讶叉手点头', category: 'surprised', motion: 'TapBody', motionIndex: 12, expression: 'surprise' },
    // shy — [20]眯眼埋头 [21]眯眼笑 [22]身体前倾
    { id: 'hg-blush-hide',   label: '脸红埋头',   category: 'shy', motion: 'TapBody', motionIndex: 20, expression: 'shy' },
    { id: 'hg-blush-smile',  label: '脸红笑',     category: 'shy', motion: 'TapBody', motionIndex: 21, expression: 'shy' },
    { id: 'hg-blush-lean',   label: '脸红前倾',   category: 'shy', motion: 'TapBody', motionIndex: 22, expression: 'shy' },
    // sad — [23]双手放胸前 [24]睁眼瘪嘴
    { id: 'hg-sad-chest',    label: '双手放胸前',  category: 'sad', motion: 'TapBody', motionIndex: 23, expression: 'sad' },
    { id: 'hg-sad-pout',     label: '睁眼瘪嘴',   category: 'sad', motion: 'TapBody', motionIndex: 24, expression: 'sad' },
    // angry — [17]定睛狠看
    { id: 'hg-angry-glare',  label: '瞪眼看',     category: 'angry', motion: 'TapBody', motionIndex: 17, expression: 'angry' },
    // thinking — [19]手放嘴角 [15]无奈叉手
    { id: 'hg-think',        label: '手放嘴角',   category: 'thinking', motion: 'TapBody', motionIndex: 19, expression: 'coldness' },
    { id: 'hg-helpless',     label: '无奈叉手',   category: 'thinking', motion: 'TapBody', motionIndex: 15, expression: 'coldness' },
    // special — [1]摇头否定 [2]摆手否定 [0]俏皮微摇头
    { id: 'hg-deny-shake',   label: '摇头否定',   category: 'special', motion: 'TapBody', motionIndex: 1,  expression: 'angry' },
    { id: 'hg-deny-wave',    label: '摆手否定',   category: 'special', motion: 'TapBody', motionIndex: 2,  expression: 'surprise' },
    { id: 'hg-playful',      label: '俏皮微摇头', category: 'special', motion: 'TapBody', motionIndex: 0,  expression: 'happy-02' },
  ],
  ttsEmotionMap: {
    happy: 'happy-01',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprise',
    thinking: 'coldness',
    shy: 'shy',
    neutral: 'smile',
  },
};

const maoConfig: ModelInteractionConfig = {
  modelName: 'Mao',
  clickInteractions: [
    { id: 'mao-click-1', label: '施放魔法', category: 'special', motion: 'TapBody', expression: 'happy' }, // random TapBody
  ],
  menuInteractions: [
    // happy — TapBody[2]微笑挥手
    { id: 'mao-smile-wave', label: '微笑挥手',   category: 'happy', motion: 'TapBody', motionIndex: 2, expression: 'smile' },
    { id: 'mao-happy',      label: '开心',       category: 'happy', motion: null, expression: 'happy' },
    // special — TapBody[0]画画成功爱心 [1]画画失败爱心
    { id: 'mao-magic-ok',   label: '魔法爱心(成功)', category: 'special', motion: 'TapBody', motionIndex: 0, expression: 'happy' },
    { id: 'mao-magic-fail', label: '魔法爱心(失败)', category: 'special', motion: 'TapBody', motionIndex: 1, expression: 'embarrass' },
    // surprised
    { id: 'mao-scared',     label: '被吓到',      category: 'surprised', motion: null, expression: 'scare' },
    { id: 'mao-surprised',  label: '惊喜',        category: 'surprised', motion: null, expression: 'surprised' },
    // sad
    { id: 'mao-sad',        label: '伤心',        category: 'sad', motion: null, expression: 'sad' },
    // angry
    { id: 'mao-angry',      label: '生气',        category: 'angry', motion: null, expression: 'angry' },
    // shy
    { id: 'mao-blush',      label: '脸红',        category: 'shy', motion: null, expression: 'blushing' },
    { id: 'mao-embarrass',  label: '尴尬',        category: 'shy', motion: null, expression: 'embarrass' },
  ],
  ttsEmotionMap: {
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'scare',
    thinking: 'smile',
    shy: 'blushing',
    neutral: 'smile',
  },
};

const riceConfig: ModelInteractionConfig = {
  modelName: 'Rice',
  clickInteractions: [
    { id: 'rice-click-1', label: '施放攻击', category: 'special', motion: 'TapBody', expression: null }, // random TapBody
  ],
  menuInteractions: [
    // special — TapBody[0]小能量攻击 [1]大能量攻击
    { id: 'rice-small-atk',  label: '小能量攻击',   category: 'special', motion: 'TapBody', motionIndex: 0, expression: null },
    { id: 'rice-big-atk',    label: '大能量攻击',   category: 'special', motion: 'TapBody', motionIndex: 1, expression: null },
    // thinking — Idle[1]魔法书点火
    { id: 'rice-book-fire',  label: '魔法书点火',   category: 'thinking', motion: 'Idle', motionIndex: 1, expression: null },
  ],
  // Rice 没有表情系统，不设 ttsEmotionMap
};

const epsilonConfig: ModelInteractionConfig = {
  modelName: 'Epsilon',
  clickInteractions: [
    { id: 'eps-click-1', label: '生气叉手', category: 'angry', motion: 'TapBody', motionIndex: 0, expression: 'angry' },
  ],
  menuInteractions: [
    // angry — TapBody[0]生气叉手 [1]生气皱眉
    { id: 'eps-cross-arms',  label: '生气叉手',    category: 'angry', motion: 'TapBody', motionIndex: 0, expression: 'angry' },
    { id: 'eps-frown',       label: '生气皱眉',    category: 'angry', motion: 'TapBody', motionIndex: 1, expression: 'angry' },
    // sad
    { id: 'eps-upset',       label: '不悦',        category: 'sad', motion: null, expression: 'upset' },
    { id: 'eps-sad',         label: '伤心',        category: 'sad', motion: null, expression: 'sad' },
    // special
    { id: 'eps-innocent',    label: '无辜脸',      category: 'special', motion: null, expression: 'innocent' },
    { id: 'eps-scare',       label: '惊吓',        category: 'surprised', motion: null, expression: 'scare' },
    // happy
    { id: 'eps-smile',       label: '微笑',        category: 'happy', motion: null, expression: 'smile' },
    { id: 'eps-happy',       label: '开心',        category: 'happy', motion: null, expression: 'happy' },
    // shy
    { id: 'eps-blush',       label: '脸红',        category: 'shy', motion: null, expression: 'blushing' },
  ],
  ttsEmotionMap: {
    happy: 'smile',
    sad: 'upset',
    angry: 'angry',
    surprised: 'scare',
    thinking: 'smile',
    shy: 'blushing',
    neutral: 'smile',
  },
};

const chitoseConfig: ModelInteractionConfig = {
  modelName: 'Chitose',
  clickInteractions: [
    { id: 'chi-click-1', label: '挥手打招呼', category: 'greet', motion: 'TapBody', motionIndex: 1, expression: 'happy' },
  ],
  menuInteractions: [
    // greet — TapBody[0]向左指引 [1]挥手打招呼 [2]单手插腰
    { id: 'chi-wave',        label: '挥手打招呼',  category: 'greet', motion: 'TapBody', motionIndex: 1, expression: 'happy' },
    { id: 'chi-guide-left',  label: '向左指引',    category: 'greet', motion: 'TapBody', motionIndex: 0, expression: 'smile' },
    { id: 'chi-hip',         label: '单手插腰',    category: 'greet', motion: 'TapBody', motionIndex: 2, expression: 'smile' },
    // happy
    { id: 'chi-happy',       label: '开心',        category: 'happy', motion: null, expression: 'happy' },
    { id: 'chi-smile',       label: '微笑',        category: 'happy', motion: null, expression: 'smile' },
    // surprised
    { id: 'chi-surprised',   label: '惊讶',        category: 'surprised', motion: null, expression: 'surprised' },
    // sad
    { id: 'chi-sad',         label: '伤心',        category: 'sad', motion: null, expression: 'sad' },
    // angry
    { id: 'chi-angry',       label: '生气',        category: 'angry', motion: null, expression: 'angry' },
    // shy
    { id: 'chi-blush',       label: '脸红',        category: 'shy', motion: null, expression: 'blushing' },
    { id: 'chi-embarrass',   label: '尴尬',        category: 'shy', motion: null, expression: 'embarrass' },
  ],
  ttsEmotionMap: {
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprised',
    thinking: 'smile',
    shy: 'blushing',
    neutral: 'smile',
  },
};

const tsumikiConfig: ModelInteractionConfig = {
  modelName: 'Tsumiki',
  clickInteractions: [
    { id: 'tsu-click-1', label: '微笑看着你', category: 'happy', motion: 'TapBody', motionIndex: 0, expression: 'smile' },
  ],
  menuInteractions: [
    // happy — TapBody only has [0]微笑看着你
    { id: 'tsu-happy-1',     label: '开心',        category: 'happy', motion: null, expression: 'happy-01' },
    { id: 'tsu-smile',       label: '微笑',        category: 'happy', motion: 'TapBody', motionIndex: 0, expression: 'smile' },
    // angry
    { id: 'tsu-angry',       label: '生气',        category: 'angry', motion: null, expression: 'angry' },
    { id: 'tsu-wigged',      label: '呵斥',        category: 'angry', motion: null, expression: 'wigged' },
    // sad
    { id: 'tsu-sad',         label: '伤心',        category: 'sad', motion: null, expression: 'sad' },
    // surprised
    { id: 'tsu-surprised',   label: '惊讶',        category: 'surprised', motion: null, expression: 'surprised' },
    // shy
    { id: 'tsu-blush',       label: '脸红',        category: 'shy', motion: null, expression: 'blushing' },
    { id: 'tsu-embarrass',   label: '尴尬',        category: 'shy', motion: null, expression: 'embarrass' },
    // thinking
    { id: 'tsu-speechless',  label: '无语',        category: 'thinking', motion: null, expression: 'speechless' },
  ],
  ttsEmotionMap: {
    happy: 'happy-01',
    sad: 'sad',
    angry: 'wigged',
    surprised: 'surprised',
    thinking: 'speechless',
    shy: 'blushing',
    neutral: 'smile',
  },
};

const shizukuConfig: ModelInteractionConfig = {
  modelName: 'Shizuku',
  clickInteractions: [
    { id: 'shz-click-1', label: '打哈欠', category: 'special', motion: 'TapBody', expression: null }, // random TapBody
  ],
  menuInteractions: [
    // special — TapBody[0]打哈欠眯眼 [1]打哈欠脸红
    { id: 'shz-yawn-squint', label: '打哈欠眯眼',   category: 'special', motion: 'TapBody', motionIndex: 0, expression: null },
    { id: 'shz-yawn-blush',  label: '打哈欠脸红',   category: 'special', motion: 'TapBody', motionIndex: 1, expression: null },
  ],
  // Shizuku 没有表情系统
};

const hiyoriConfig: ModelInteractionConfig = {
  modelName: 'Hiyori',
  clickInteractions: [
    { id: 'hiy-click-1', label: '无聊抬头', category: 'thinking', motion: 'TapBody', motionIndex: 1, expression: null },
  ],
  menuInteractions: [
    // sad — TapBody[0]难过皱眉
    { id: 'hiy-sad-frown',   label: '难过皱眉',   category: 'sad', motion: 'TapBody', motionIndex: 0, expression: null },
    // thinking — TapBody[1]无聊抬头望天摇摆
    { id: 'hiy-bored',       label: '无聊望天',   category: 'thinking', motion: 'TapBody', motionIndex: 1, expression: null },
  ],
  // Hiyori 没有表情系统
};

const keiConfig: ModelInteractionConfig = {
  modelName: 'Kei',
  clickInteractions: [
    { id: 'kei-click-1', label: '说话', category: 'special', motion: '', expression: null }, // group="" random
  ],
  menuInteractions: [
    // special — group ""[0]英文 [1]日文 [2]韩文 [3]中文
    { id: 'kei-en', label: '说英文', category: 'special', motion: '', motionIndex: 0, expression: null },
    { id: 'kei-jp', label: '说日文', category: 'special', motion: '', motionIndex: 1, expression: null },
    { id: 'kei-ko', label: '说韩文', category: 'special', motion: '', motionIndex: 2, expression: null },
    { id: 'kei-zh', label: '说中文', category: 'special', motion: '', motionIndex: 3, expression: null },
  ],
  // Kei 没有表情系统
};

const izumiConfig: ModelInteractionConfig = {
  modelName: 'Izumi',
  clickInteractions: [
    { id: 'izu-click-1', label: '开心眯眼', category: 'happy', motion: 'TapBody', motionIndex: 0, expression: 'happy' },
  ],
  menuInteractions: [
    // happy — TapBody only [0]开心眯眼
    { id: 'izu-happy',      label: '开心眯眼',    category: 'happy', motion: 'TapBody', motionIndex: 0, expression: 'happy' },
    { id: 'izu-smile',      label: '微笑',        category: 'happy', motion: null, expression: 'smile' },
    // angry
    { id: 'izu-angry',      label: '生气',        category: 'angry', motion: null, expression: 'angry' },
    // sad
    { id: 'izu-sad',        label: '伤心',        category: 'sad', motion: null, expression: 'sad' },
    // surprised
    { id: 'izu-surprised',  label: '惊讶',        category: 'surprised', motion: null, expression: 'surprised' },
    // shy
    { id: 'izu-blush',      label: '脸红',        category: 'shy', motion: null, expression: 'blushing' },
    // thinking
    { id: 'izu-cold',       label: '冷漠',        category: 'thinking', motion: null, expression: 'coldness' },
  ],
  ttsEmotionMap: {
    happy: 'happy',
    sad: 'sad',
    angry: 'angry',
    surprised: 'surprised',
    thinking: 'coldness',
    shy: 'blushing',
    neutral: 'smile',
  },
};

const haruConfig: ModelInteractionConfig = {
  modelName: 'Haru',
  clickInteractions: [
    { id: 'haru-click-1', label: '向右指引', category: 'greet', motion: 'TapBody', motionIndex: 0, expression: null },
  ],
  menuInteractions: [
    // greet — TapBody[0]向右指引 [1]肯定点头 ([2][3]是重复)
    { id: 'haru-guide',     label: '向右指引',    category: 'greet', motion: 'TapBody', motionIndex: 0, expression: null },
    { id: 'haru-nod',       label: '肯定点头',    category: 'greet', motion: 'TapBody', motionIndex: 1, expression: null },
  ],
  // Haru 没有表情系统
};

const hibikiConfig: ModelInteractionConfig = {
  modelName: 'Hibiki',
  clickInteractions: [
    { id: 'hib-click-1', label: '生气转无辜', category: 'special', motion: 'TapBody', motionIndex: 0, expression: null },
  ],
  menuInteractions: [
    // special — TapBody only [0]生气转无辜
    { id: 'hib-angry-innocent', label: '生气转无辜', category: 'special', motion: 'TapBody', motionIndex: 0, expression: null },
    // angry
    { id: 'hib-angry',    label: '生气',      category: 'angry', motion: null, expression: 'Angry' },
    // happy
    { id: 'hib-smile',    label: '微笑',      category: 'happy', motion: null, expression: 'smile' },
    // sad
    { id: 'hib-sad',      label: '伤心',      category: 'sad', motion: null, expression: 'Sad' },
    // surprised
    { id: 'hib-surprised', label: '惊讶',     category: 'surprised', motion: null, expression: 'Surprised' },
    // shy
    { id: 'hib-blush',    label: '脸红',      category: 'shy', motion: null, expression: 'Blushing' },
    // thinking
    { id: 'hib-cold',     label: '冷漠',      category: 'thinking', motion: null, expression: 'coldness' },
  ],
  ttsEmotionMap: {
    happy: 'smile',
    sad: 'Sad',
    angry: 'Angry',
    surprised: 'Surprised',
    thinking: 'coldness',
    shy: 'Blushing',
    neutral: 'smile',
  },
};

// ─── 注册表 ───────────────────────────────────────────────

const MODEL_INTERACTION_CONFIGS: Record<string, ModelInteractionConfig> = {
  HaruGreeter: haruGreeterConfig,
  Mao:         maoConfig,
  Rice:        riceConfig,
  Epsilon:     epsilonConfig,
  Chitose:     chitoseConfig,
  Tsumiki:     tsumikiConfig,
  Shizuku:     shizukuConfig,
  Hiyori:      hiyoriConfig,
  Kei:         keiConfig,
  Izumi:       izumiConfig,
  Haru:        haruConfig,
  Hibiki:      hibikiConfig,
};

/**
 * 获取指定模型的互动配置，未配置则返回 undefined
 */
export function getModelInteractionConfig(modelName: string): ModelInteractionConfig | undefined {
  return MODEL_INTERACTION_CONFIGS[modelName];
}
