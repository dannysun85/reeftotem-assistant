/**
 * Voice options for TTS providers
 */

export interface VoiceOption {
  id: string;
  name: string;
  desc: string;
}

export const TENCENT_VOICES: VoiceOption[] = [
  { id: '1001', name: '智逍遥', desc: '成熟女声' },
  { id: '1002', name: '智瑜', desc: '成熟男声' },
  { id: '1003', name: '智美', desc: '温柔女声' },
  { id: '1004', name: '智云', desc: '磁性男声' },
  { id: '1005', name: '智莉', desc: '甜美女声' },
  { id: '1007', name: '智芸', desc: '知性女声' },
  { id: '1008', name: '智娜', desc: '可爱女声' },
  { id: '1010', name: '智琪', desc: '甜美女声' },
];

export const DASHSCOPE_VOICES: VoiceOption[] = [
  { id: 'longxiaochun', name: '龙小淳', desc: '温柔女声' },
  { id: 'longhua', name: '龙华', desc: '标准男声' },
  { id: 'longshu', name: '龙书', desc: '知性女声' },
  { id: 'longshuo', name: '龙硕', desc: '青年男声' },
  { id: 'longjielidou', name: '龙杰力豆', desc: '可爱童声' },
];

export function getVoicesForProvider(provider: 'tencent' | 'dashscope'): VoiceOption[] {
  return provider === 'dashscope' ? DASHSCOPE_VOICES : TENCENT_VOICES;
}

export function getDefaultVoiceId(provider: 'tencent' | 'dashscope'): string {
  return provider === 'dashscope' ? 'longxiaochun' : '1001';
}

export function getSpeedRange(provider: 'tencent' | 'dashscope') {
  return provider === 'dashscope'
    ? { min: 0.5, max: 2.0, step: 0.1, default: 1.0 }
    : { min: -2, max: 6, step: 1, default: 0 };
}

export function getVolumeRange(provider: 'tencent' | 'dashscope') {
  return provider === 'dashscope'
    ? { min: 0, max: 100, step: 1, default: 50 }
    : { min: 0, max: 10, step: 1, default: 5 };
}
