/* @refresh skip */
import { useCallback } from 'react';

export const useLive2DCore = () => {
  const loadLive2DCore = useCallback(async (setStatus, setError) => {
    try {
      setStatus('正在加载Live2D核心...');

      const script = document.createElement('script');
      script.src = '/src/lib/live2d/Core/live2dcubismcore.js';
      script.type = 'text/javascript';

      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      setStatus('Live2D核心加载完成');
      return true;
    } catch (err) {
      console.error('Live2D Core加载失败:', err);
      setError('Live2D核心加载失败');
      return false;
    }
  }, []);

  return { loadLive2DCore };
};
