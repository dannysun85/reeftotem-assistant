import React from 'react';
import { Live2DVoiceInteraction } from '../components/Voice/Live2DVoiceInteraction';

/**
 * 语音交互页面
 * 独立页面用于测试语音交互功能
 */
export const VoiceInteractionPage: React.FC = () => {
  return (
    <div className="voice-interaction-page">
      <Live2DVoiceInteraction />
    </div>
  );
};