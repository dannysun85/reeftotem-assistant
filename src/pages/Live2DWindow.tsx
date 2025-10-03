import React from 'react';
// @ts-ignore
import RealLive2DComponent from '../components/RealLive2DComponent.jsx';

/**
 * Live2D窗口组件
 * 用于显示Live2D数字人角色
 */
export const Live2DWindow: React.FC = () => {
  return (
    <div className="w-full h-full bg-transparent" style={{ backgroundColor: 'transparent' }}>
      <RealLive2DComponent
        initialPersona="HaruGreeter"
        className="w-full h-full"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
        }}
      />
    </div>
  );
};

export default Live2DWindow;