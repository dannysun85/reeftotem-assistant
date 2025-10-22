/* @refresh skip */
import { useCallback } from 'react';
import { getLive2DModelPath } from '../../utils/tauriPathUtils';

export const useLive2DInit = (loadLive2DCore) => {
  const initializeLive2D = useCallback(async (canvasRef, setStatus, setError, setIsLoaded, initialPersona = null) => {
    console.log('🚀🚀🚀 useLive2DInit.initializeLive2D 开始执行...');
    console.log('📋 canvasRef:', canvasRef);
    console.log('👤 initialPersona:', initialPersona);

    if (!canvasRef.current) {
      console.error('❌ canvasRef.current 为空，无法初始化Live2D');
      if (typeof setError === 'function') {
        setError('Canvas元素不存在');
      }
      return;
    }

    try {
      console.log('🔧 Live2D初始化开始...');
      if (typeof setStatus === 'function') {
        setStatus('正在初始化Live2D框架...');
      }

      console.log('📦 开始加载Live2D Core...');
      const coreLoaded = await loadLive2DCore(setStatus, setError);
      if (!coreLoaded) {
        console.error('❌ Live2D Core加载失败');
        throw new Error('Live2D Core加载失败');
      }
      console.log('✅ Live2D Core加载成功');

      console.log('📦 开始导入LAppDelegate...');
      const { LAppDelegate } = await import('../../lib/live2d/src/lappdelegate');
      console.log('✅ LAppDelegate导入成功');

      // 简单直接的初始化逻辑
      console.log('🏗️ 创建LAppDelegate实例');
      const appDelegate = LAppDelegate.getInstance();
      console.log('🏗️ LAppDelegate实例创建完成:', appDelegate);

      console.log('🔧 开始调用appDelegate.initialize()...');
      const success = appDelegate.initialize();
      console.log('📊 LAppDelegate初始化结果:', success);

      if (success) {
        console.log('LAppDelegate准备就绪，处理角色设置');

        // 如果提供了initialPersona，设置角色
        if (initialPersona) {
          console.log('🎭 设置角色:', initialPersona);
          const characterModel = {
            resource_id: 'default',
            name: initialPersona,
            type: 'CHARACTER',
            link: getLive2DModelPath(initialPersona)
          };
          console.log('角色模型配置:', characterModel);

          // 延迟设置角色，确保一切准备就绪（恢复原始的500ms延迟）
          setTimeout(() => {
            console.log('📋 开始调用changeCharacter方法');
            try {
              appDelegate.changeCharacter(characterModel);
              console.log('✅ 已调用changeCharacter方法');

              // 额外确保：在模型加载完成后再次通知活动状态，确保缩放逻辑执行
              setTimeout(() => {
                console.log('🔧 确保模型缩放正确应用');
                appDelegate.notifyActivity();
              }, 800); // 800ms额外延迟，确保模型完全加载并执行缩放逻辑

            } catch (error) {
              console.error('❌ changeCharacter方法调用失败:', error);
            }
          }, 500); // 恢复原始延迟时间，确保Live2D系统完全就绪
        } else {
          console.log('⚠️ 未提供initialPersona参数，使用默认设置');
        }

        // 启动渲染循环
        console.log('🚀 启动Live2D渲染循环');
        appDelegate.run();
        console.log('✅ Live2D渲染循环已启动');

        if (typeof setIsLoaded === 'function') {
          setIsLoaded(true);
        }
        if (typeof setStatus === 'function') {
          setStatus('Live2D初始化成功');
        }
        console.log('✅ Live2D初始化成功');
      } else {
        throw new Error('LAppDelegate初始化失败');
      }

    } catch (err) {
      console.error('Live2D初始化错误:', err);
      if (typeof setError === 'function') {
        setError(`初始化失败: ${err instanceof Error ? err.message : String(err)}`);
      }
      if (typeof setStatus === 'function') {
        setStatus('初始化失败');
      }
    }
  }, [loadLive2DCore]);

  return { initializeLive2D };
};
