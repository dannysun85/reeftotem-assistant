import React, { useState, useEffect } from 'react';

// 安全的Tauri invoke函数
const safeInvoke = async (command: string, args?: any) => {
  try {
    // 检查是否在Tauri环境中
    if (typeof window !== 'undefined' && '__TAURI__' in window) {
      const { invoke } = await import('@tauri-apps/api/core');
      return await invoke(command, args);
    } else {
      console.warn(`Tauri环境不可用，跳过命令: ${command}`);
      return null;
    }
  } catch (error) {
    console.error(`Tauri invoke失败 (${command}):`, error);
    return null;
  }
};

/**
 * Persona调试器组件
 * 用于调试和管理Live2D数字人角色
 */
const PersonaDebugger: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [live2dStatus, setLive2dStatus] = useState<string>('未知');

  useEffect(() => {
    // 检查Live2D状态
    const checkLive2DStatus = async () => {
      const status = await safeInvoke('get_live2d_status');
      if (status !== null) {
        setLive2dStatus(String(status));
      } else {
        setLive2dStatus('Tauri不可用');
      }
    };

    checkLive2DStatus();
    const interval = setInterval(checkLive2DStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleLive2D = async () => {
    await safeInvoke('toggle_live2d_window');
  };

  const handleReloadLive2D = async () => {
    await safeInvoke('reload_live2d');
  };

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded-lg shadow-lg"
        title="打开调试器"
      >
        🎭
      </button>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-xl p-4 mb-4 w-80">
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Live2D 调试器</h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>

      <div className="space-y-3">
        <div className="bg-gray-50 p-3 rounded">
          <p className="text-sm font-medium text-gray-700">状态:</p>
          <p className="text-sm text-gray-600">{live2dStatus}</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleToggleLive2D}
            className="flex-1 bg-blue-500 hover:bg-blue-600 text-white px-3 py-2 rounded text-sm"
          >
            切换窗口
          </button>
          <button
            onClick={handleReloadLive2D}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-3 py-2 rounded text-sm"
          >
            重新加载
          </button>
        </div>
      </div>
    </div>
  );
};

export default PersonaDebugger;