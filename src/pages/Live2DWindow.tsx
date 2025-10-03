import React, { useEffect } from 'react';
// @ts-ignore
import RealLive2DComponent from '../components/RealLive2DComponent.jsx';

/**
 * Live2D窗口组件
 * 用于显示Live2D数字人角色
 */
export const Live2DWindow: React.FC = () => {
  useEffect(() => {
    console.log('Live2DWindow组件已加载');
  }, []);

  return (
    <div className="w-full h-full bg-transparent" style={{ backgroundColor: 'transparent' }}>
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100vw',
        height: '100vh'
      }}>
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '16px',
          color: 'white',
          textAlign: 'center'
        }}>
          <div>
            <div>Live2D Loading...</div>
            <div style={{ fontSize: '12px', marginTop: '10px' }}>Check console for details</div>
            <RealLive2DComponent
              initialPersona="HaruGreeter"
              className="w-full h-full"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0.8
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Live2DWindow;