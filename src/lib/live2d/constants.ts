/**
 * Live2D 相关配置常量
 * 从原项目中提取的Live2D相关配置
 */

// 角色相关配置
export const LIVE2D_CHARACTER_PATH = "live2d/characters/";
export const LIVE2D_CHARACTER_IP_PATH = "live2d/characters/ip";
export const LIVE2D_CHARACTER_FREE_PATH = "live2d/characters/free";
export const LIVE2D_CHARACTER_IP_MODELS: string[] = [];
export const LIVE2D_CHARACTER_FREE_MODELS: string[] = [
  "HaruGreeter", "Haru", "Kei", "Chitose", "Epsilon",
  "Hibiki", "Hiyori", "Izumi", "Mao", "Rice",
  "Shizuku", "Tsumiki"
];
export const LIVE2D_CHARACTER_DEFAULT = "HaruGreeter";
export const LIVE2D_CHARACTER_DEFAULT_PORTRAIT: string =
  `${LIVE2D_CHARACTER_FREE_PATH}/${LIVE2D_CHARACTER_DEFAULT}/${LIVE2D_CHARACTER_DEFAULT}.png`;

// 音频和唇形同步配置
export const LIVE2D_TTS_PUNC: string[] = ['；', '！', '？', '。', '?'];
export const LIVE2D_TTS_SENTENCE_LENGTH_MIN = 6;
export const LIVE2D_RECODER_MIN_TIME: number = 1000; // 1s
export const LIVE2D_RECODER_MAX_TIME: number = 30000; // 30s
export const LIVE2D_LIPFACTOR_MIN: number = 0.0;
export const LIVE2D_LIPFACTOR_DEFAULT = 5.0;
export const LIVE2D_LIPFACTOR_MAX: number = 10.0;

// 音频测试文本
export const LIVE2D_VOICE_TEST_ZH: string[] = [
  "今天最浪漫的事就是遇见你。",
  "你有百般模样，我也会百般喜欢。",
  "这里什么都好，因为这就是你。"
];
export const LIVE2D_VOICE_TEST_EN: string[] = [
  "Someone said you were looking for me?"
];

// 画布配置
export const LIVE2D_CANVAS_ID = "live2dCanvas";
export const LIVE2D_CANVAS_SIZE = 'auto'; // 或者 { width: 1900, height: 1000 }
export const LIVE2D_CANVAS_NUM = 1;

// 视图配置
export const LIVE2D_VIEW_SCALE = 1.0;
export const LIVE2D_VIEW_MAX_SCALE = 2.0;
export const LIVE2D_VIEW_MIN_SCALE = 0.8;

// 调试配置
export const LIVE2D_DEBUG_LOG_ENABLE = false;
export const LIVE2D_DEBUG_TOUCH_LOG_ENABLE = false;
export const LIVE2D_MOC_CONSISTENCY_VALIDATION_ENABLE = true;

// 渲染目标配置
export const LIVE2D_RENDER_TARGET_WIDTH = 1900;
export const LIVE2D_RENDER_TARGET_HEIGHT = 1000;