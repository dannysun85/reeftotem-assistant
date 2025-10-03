import React from "react";
import ReactDOMClient from "react-dom/client";
import { Live2DWindow } from "./pages/Live2DWindow";
import "./index.css";

console.log("live2d-entry.ts loaded");

// 预加载Live2D Core WebAssembly模块
async function loadLive2DCore(): Promise<void> {
    try {
        console.log("开始加载Live2D Core模块...");

        // 首先检查Live2DCubismCore是否已经存在
        if ((window as any).Live2DCubismCore) {
            console.log("Live2D Core模块已存在");
            return;
        }

        // 动态加载Live2D Core - 使用非模块方式
        const coreScript = document.createElement('script');
        coreScript.src = '/src/lib/live2d/Core/live2dcubismcore.js';
        coreScript.type = 'text/javascript';
        coreScript.async = false; // 同步加载确保顺序

        return new Promise<void>((resolve, reject) => {
            coreScript.onload = () => {
                console.log("Live2D Core脚本加载完成，检查Live2DCubismCore是否可用...");
                console.log("window.Live2DCubismCore:", (window as any).Live2DCubismCore);

                // 等待一小段时间确保全局变量设置完成
                setTimeout(() => {
                    if ((window as any).Live2DCubismCore) {
                        console.log("Live2D Core模块加载成功");
                        resolve();
                    } else {
                        console.error("Live2DCubismCore未找到，尝试加载min版本...");
                        // 尝试加载min版本
                        const minScript = document.createElement('script');
                        minScript.src = '/src/lib/live2d/Core/live2dcubismcore.min.js';
                        minScript.type = 'text/javascript';
                        minScript.onload = () => {
                            console.log("Live2D Core min版本加载成功");
                            resolve();
                        };
                        minScript.onerror = (error) => {
                            console.error("Live2D Core min版本加载失败:", error);
                            reject(error);
                        };
                        document.head.appendChild(minScript);
                    }
                }, 100);
            };
            coreScript.onerror = (error) => {
                console.error("Live2D Core脚本加载失败:", error);
                reject(error);
            };
            document.head.appendChild(coreScript);
        });
    } catch (error) {
        console.error("Live2D Core模块加载异常:", error);
        throw error;
    }
}

// 初始化函数
async function initializeLive2DApp() {
    try {
        await loadLive2DCore();
        console.log("Live2D Core加载完成，开始挂载React");

        const root = document.getElementById("root");
        console.log("Live2D root element:", root);

        if (root) {
            console.log("creating Live2D React root...");
            const reactRoot = ReactDOMClient.createRoot(root);
            console.log("rendering Live2D Window...");
            reactRoot.render(React.createElement(Live2DWindow));
            console.log("Live2D Window rendered!");
        } else {
            console.error("Live2D Root element not found!");
        }
    } catch (error) {
        console.error("Live2D Core加载失败:", error);
        // 继续执行，让用户看到错误
    }
}

// 开始初始化
initializeLive2DApp();