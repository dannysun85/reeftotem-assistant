import React from "react";
import ReactDOMClient from "react-dom/client";
import { Live2DWindow } from "./pages/Live2DWindow";
import "./index.css";
import { createLogger, initializeLogger } from "./utils/Logger";
import { getLive2DCorePath } from "./utils/tauriPathUtils";

initializeLogger('live2d-entry');
const logger = createLogger('live2d-entry');

// ✅ 导入 Tauri API Shim - 确保 Tauri API 正确初始化
import "./tauri-shim";

// 导入 LAppDelegate 用于暴露到全局
import { LAppDelegate } from "./lib/live2d/src/lappdelegate";

// 预加载 Live2D Core
async function loadLive2DCore(): Promise<void> {
  if ((window as any).Live2DCubismCore) {
    logger.info('Live2D Core 已存在');
    return;
  }

  const candidatePaths = [
    getLive2DCorePath(),
    '/src/lib/live2d/Core/live2dcubismcore.min.js',
    '/src/lib/live2d/Core/live2dcubismcore.js'
  ];

  const loadScript = (src: string) => new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.type = 'text/javascript';
    script.async = false;

    script.onload = () => {
      setTimeout(() => {
        if ((window as any).Live2DCubismCore) {
          logger.info('Live2D Core 加载成功', { src });
          resolve();
        } else {
          reject(new Error(`Live2D Core 脚本已加载但全局变量缺失: ${src}`));
        }
      }, 100);
    };

    script.onerror = () => {
      reject(new Error(`Live2D Core 脚本加载失败: ${src}`));
    };

    document.head.appendChild(script);
  });

  let lastError: Error | null = null;
  for (const src of candidatePaths) {
    try {
      logger.info('尝试加载 Live2D Core', { src });
      await loadScript(src);
      return;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      logger.warn('Live2D Core 路径失败', { src, error: lastError.message });
    }
  }

  throw lastError ?? new Error('Live2D Core 加载失败');
}

// 初始化函数
async function initializeLive2DApp() {
  try {
    await loadLive2DCore();

    const root = document.getElementById("root");

    if (root) {
      const reactRoot = ReactDOMClient.createRoot(root);
      reactRoot.render(React.createElement(Live2DWindow));
    } else {
      logger.error('Root element not found');
    }
  } catch (error) {
    logger.error("Live2D app initialization failed", error);
  }
}

// 立即将 LAppDelegate 暴露到全局对象，确保在 React 渲染前可用
(window as any).LAppDelegate = LAppDelegate;

// 开始初始化
initializeLive2DApp().then(() => {
  // 导入并暴露 ParameterMapper
  import('./utils/parameterMapper').then((module) => {
    (window as any).ParameterMapper = module.default;
  }).catch((error) => {
    logger.warn('ParameterMapper import failed', error);
  });
});
