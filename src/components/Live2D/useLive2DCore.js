/* @refresh skip */
import { useCallback } from 'react';

export const useLive2DCore = () => {
  const loadLive2DCore = useCallback(async (setStatus, setError) => {
    try {
      console.log('🚀🚀🚀 useLive2DCore.loadLive2DCore 开始执行...');

      if (typeof setStatus === 'function') {
        setStatus('正在检查Live2D核心...');
      }

      // 检查Live2D Core是否已经由live2d-entry.ts加载
      if (window.Live2DCubismCore) {
        console.log('✅ Live2D Core已由入口文件加载');
        if (typeof setStatus === 'function') {
          setStatus('Live2D核心就绪');
        }
        return true;
      }

      // 如果没有加载，尝试手动加载
      console.log('⚠️ Live2D Core未加载，尝试手动加载...');

      return new Promise((resolve, reject) => {
        // 尝试加载Core文件 - 使用多个可能的路径
        const tryLoadCore = (src) => {
          return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.type = 'text/javascript';

            script.onload = () => {
              setTimeout(() => {
                if (window.Live2DCubismCore) {
                  console.log(`✅ Live2D Core加载成功: ${src}`);
                  if (typeof setStatus === 'function') {
                    setStatus('Live2D核心加载完成');
                  }
                  resolve(true);
                } else {
                  console.warn(`⚠️ Live2D Core加载后全局变量未设置: ${src}`);
                  reject(new Error('Live2D Core全局变量未设置'));
                }
              }, 200);
            };

            script.onerror = (error) => {
              console.error(`❌ Live2D Core脚本加载失败: ${src}`, error);
              reject(error);
            };

            document.head.appendChild(script);
          });
        };

        // 尝试多个可能的路径
        const possiblePaths = [
          '/src/lib/live2d/Core/live2dcubismcore.js',
          '/src/lib/live2d/Core/live2dcubismcore.min.js',
          './src/lib/live2d/Core/live2dcubismcore.js',
          '../src/lib/live2d/Core/live2dcubismcore.js'
        ];

        console.log('🔍 开始尝试加载Live2D Core，可能的路径:', possiblePaths);

        // 依次尝试每个路径
        let loadPromise = Promise.reject();
        for (const path of possiblePaths) {
          loadPromise = loadPromise.catch(() => tryLoadCore(path));
        }

        loadPromise
          .then(() => {
            console.log('✅ Live2D Core最终加载成功');
            resolve(true);
          })
          .catch((error) => {
            console.error('❌ 所有Live2D Core路径都加载失败:', error);
            if (typeof setError === 'function') {
              setError('Live2D Core文件加载失败');
            }
            reject(new Error('Live2D Core文件加载失败'));
          });
      });

    } catch (err) {
      console.error('Live2D Core加载失败:', err);
      if (typeof setError === 'function') {
        setError(`Live2D核心加载失败: ${err.message}`);
      }
      return false;
    }
  }, []);

  return { loadLive2DCore };
};