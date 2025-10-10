import React from "react";
import ReactDOMClient from "react-dom/client";
import { Live2DWindow } from "./pages/Live2DWindow";
import "./index.css";

// ✅ 导入 Tauri API Shim - 确保 Tauri API 正确初始化
import "./tauri-shim";

// 导入LAppDelegate用于测试
import { LAppDelegate } from "./lib/live2d/src/lappdelegate";

// 预加载Live2D Core WebAssembly模块
async function loadLive2DCore(): Promise<void> {
    try {
        // 首先检查Live2DCubismCore是否已经存在
        if ((window as any).Live2DCubismCore) {
            return;
        }

        // 动态加载Live2D Core - 使用非模块方式
        const coreScript = document.createElement('script');
        coreScript.src = '/src/lib/live2d/Core/live2dcubismcore.js';
        coreScript.type = 'text/javascript';
        coreScript.async = false; // 同步加载确保顺序

        return new Promise<void>((resolve, reject) => {
            coreScript.onload = () => {
                // 等待一小段时间确保全局变量设置完成
                setTimeout(() => {
                    if ((window as any).Live2DCubismCore) {
                        resolve();
                    } else {
                        // 尝试加载min版本
                        const minScript = document.createElement('script');
                        minScript.src = '/src/lib/live2d/Core/live2dcubismcore.min.js';
                        minScript.type = 'text/javascript';
                        minScript.onload = () => {
                            resolve();
                        };
                        minScript.onerror = (error) => {
                            reject(error);
                        };
                        document.head.appendChild(minScript);
                    }
                }, 100);
            };
            coreScript.onerror = (error) => {
                reject(error);
            };
            document.head.appendChild(coreScript);
        });
    } catch (error) {
        throw error;
    }
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
            console.error('Root element not found');
        }
    } catch (error) {
        console.error("Live2D app initialization failed:", error);
    }
}

// 立即将LAppDelegate暴露到全局对象，确保在React渲染前可用
(window as any).LAppDelegate = LAppDelegate;

// 开始初始化
initializeLive2DApp().then(() => {
    // 导入并暴露ParameterMapper
    import('./utils/parameterMapper').then((module) => {
        (window as any).ParameterMapper = module.default;
    }).catch((error) => {
        console.warn('ParameterMapper import failed:', error);
    });
});