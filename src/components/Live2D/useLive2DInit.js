/* @refresh skip */
import { useCallback } from 'react';

export const useLive2DInit = (loadLive2DCore) => {
  const initializeLive2D = useCallback(async (canvasRef, setStatus, setError, setIsLoaded, initialPersona = null) => {
    if (!canvasRef.current) return;

    try {
      setStatus('正在初始化Live2D框架...');

      const coreLoaded = await loadLive2DCore(setStatus, setError);
      if (!coreLoaded) {
        throw new Error('Live2D Core加载失败');
      }

      const { LAppDelegate } = await import('../../lib/live2d/src/lappdelegate');

      setStatus('正在创建Live2D应用...');

      const appDelegate = LAppDelegate.getInstance();
      const success = await appDelegate.initialize();

      if (success) {
        console.log('LAppDelegate初始化成功，准备设置角色');
        // 如果提供了initialPersona，设置默认角色
        if (initialPersona) {
          console.log('设置默认角色:', initialPersona);
          const characterModel = {
            resource_id: 'default',
            name: initialPersona,
            type: 'CHARACTER',
            link: `/assets/live2d/characters/free/${initialPersona}/`
          };
          console.log('角色模型配置:', characterModel);
          appDelegate.changeCharacter(characterModel);
          console.log('已调用changeCharacter方法');
        } else {
          console.log('未提供initialPersona参数，使用默认设置');
        }

        // 启动渲染循环
        console.log('开始启动Live2D渲染循环');
        appDelegate.run();

        setIsLoaded(true);
        setStatus('Live2D初始化成功');
        console.log('Live2D初始化成功');
      } else {
        throw new Error('LAppDelegate初始化失败');
      }

    } catch (err) {
      console.error('Live2D初始化错误:', err);
      setError(`初始化失败: ${err instanceof Error ? err.message : String(err)}`);
      setStatus('初始化失败');
    }
  }, [loadLive2DCore]);

  return { initializeLive2D };
};
