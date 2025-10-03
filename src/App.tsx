import { useEffect } from 'react';
import { CleanSimpleChat } from './components/CleanSimpleChat';
import { WebGLTest } from './components/WebGLTest';

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

function App() {
  // 自动启动Live2D宠物
  useEffect(() => {
    const showLive2DPet = async () => {
      // 延迟2秒启动，让主界面先加载完成并确保Live2D窗口正确显示
      await new Promise(resolve => setTimeout(resolve, 2000));
      const result = await safeInvoke('show_live2d_window');
      if (result !== null) {
        console.log('Live2D宠物自动启动成功');
      } else {
        console.log('Tauri环境不可用，Live2D宠物自动启动跳过');
      }
    };

    showLive2DPet();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 主聊天界面 */}
      <div className="p-4">
        <CleanSimpleChat />
      </div>

      {/* WebGL测试 */}
      <WebGLTest />

      {/* Live2D状态显示 */}
      <div className="fixed top-4 right-4 z-50 bg-white rounded-lg shadow-lg p-4">
        <h3 className="text-sm font-semibold mb-2">Live2D状态</h3>
        <div className="text-xs text-gray-600">
          <p>Live2D窗口应该在启动2秒后自动显示</p>
          <p>Live2D Window should auto-start after 2s</p>
        </div>
      </div>
    </div>
  );
}

export default App;
