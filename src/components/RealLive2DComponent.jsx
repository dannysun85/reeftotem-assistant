/* @refresh skip */
import { useEffect, useRef, useState } from 'react';
import { useLive2DCore } from './Live2D/useLive2DCore';
import { useLive2DInit } from './Live2D/useLive2DInit';
import { Live2DCanvas } from './Live2D/Live2DComponents';
import ContextMenu from './Live2D/ContextMenu';
import { invoke } from '@tauri-apps/api/core';

const RealLive2DComponentSimple = (props) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  const { loadLive2DCore } = useLive2DCore();
  const { initializeLive2D } = useLive2DInit(loadLive2DCore);

  // 右键菜单状态
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0
  });

  // 透明度状态
  const [opacity, setOpacity] = useState(100);

  // 置顶状态
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // 眼神跟随状态
  const [eyeTrackingEnabled, setEyeTrackingEnabled] = useState(true);

  // 拖拽状态
  const [isDragging, setIsDragging] = useState(false);

  // 鼠标悬停状态
  const [isHovering, setIsHovering] = useState(false);

  // 检查鼠标是否在模型区域
  const isMouseOverModel = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return false;

    const rect = canvas.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;

    return relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1;
  };

  // 眼神跟随：鼠标进入模型区域时触发
  const handleMouseMove = (e) => {
    const overModel = isMouseOverModel(e);
    setIsHovering(overModel);

    if (!eyeTrackingEnabled || isDragging || !overModel) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const relativeX = (e.clientX - rect.left) / rect.width;
    const relativeY = (e.clientY - rect.top) / rect.height;

    try {
      const { LAppDelegate } = require('../../lib/live2d/src/lappdelegate');
      const appDelegate = LAppDelegate.getInstance();
      if (appDelegate) {
        const subdelegate = appDelegate.getSubdelegate().at(0);
        if (subdelegate) {
          const live2dManager = subdelegate.getLive2DManager();
          if (live2dManager) {
            live2dManager.onDrag(relativeX, relativeY);
          }
        }
      }
    } catch (error) {
      // 静默处理错误
    }
  };

  // 单击计数器，用于检测双击
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  // 鼠标离开处理
  const handleMouseLeave = () => {
    setIsHovering(false);
  };

  // 单击：触发眼神跟随（如果有位置信息）
  const handleClick = (e) => {
    // 只有在模型上才能点击
    if (!isMouseOverModel(e)) return;

    const currentTime = Date.now();
    const timeDiff = currentTime - lastClickTime;

    // 检查是否为双击（两次点击间隔小于500ms）
    if (timeDiff < 500 && clickCount === 1) {
      // 双击：启动拖拽
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(true);

      // 启动Tauri原生拖拽
      if (window.__TAURI__?.invoke) {
        window.__TAURI__.invoke('start_manual_drag').catch(err => {
          console.error('启动拖拽失败:', err);
        });
      }

      // 1秒后重置状态
      setTimeout(() => {
        setClickCount(0);
        setIsDragging(false);
      }, 1000);
    } else {
      // 单击：重置计数器
      setClickCount(1);
      setTimeout(() => {
        if (clickCount === 1) {
          setClickCount(0);
        }
      }, 500);
    }

    setLastClickTime(currentTime);
  };

  // 右键菜单处理
  const handleContextMenu = (e) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  };

  // 关闭右键菜单
  const closeContextMenu = () => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  };

  // 菜单项定义
  const menuItems = [
    {
      label: '切换模型',
      action: () => {
        // TODO: 实现模型切换逻辑
      }
    },
    {
      type: 'separator'
    },
    {
      label: eyeTrackingEnabled ? '关闭眼神跟随' : '开启眼神跟随',
      action: () => {
        setEyeTrackingEnabled(!eyeTrackingEnabled);
      }
    },
    {
      label: '透明度',
      type: 'slider',
      min: 30,
      max: 100,
      value: opacity,
      onChange: async (value) => {
        setOpacity(value);
        try {
          await invoke('set_window_opacity', {
            windowLabel: 'live2d',
            opacity: value / 100.0
          });
        } catch (err) {
          console.error('设置透明度失败:', err);
        }
      }
    },
    {
      label: isAlwaysOnTop ? '取消置顶' : '窗口置顶',
      action: async () => {
        try {
          const newTopmost = await invoke('toggle_always_on_top');
          setIsAlwaysOnTop(newTopmost);
        } catch (err) {
          console.error('切换置顶状态失败:', err);
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: '重置位置',
      action: async () => {
        try {
          await invoke('reset_window_position');
        } catch (err) {
          console.error('重置窗口位置失败:', err);
        }
      }
    },
    {
      label: '关于',
      action: async () => {
        try {
          const aboutText = await invoke('show_about_dialog');
          // 使用浏览器的alert显示关于信息
          alert(aboutText);
        } catch (err) {
          console.error('显示关于对话框失败:', err);
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      action: async () => {
        try {
          await invoke('exit_app');
        } catch (err) {
          console.error('退出应用失败:', err);
        }
      }
    }
  ];

  useEffect(() => {
    const timer = setTimeout(() => {
      initializeLive2D(
        canvasRef,
        (status) => console.log('Live2D状态:', status), // setStatus
        (error) => console.error('Live2D错误:', error), // setError
        (loaded) => console.log('Live2D加载完成:', loaded), // setIsLoaded
        props.initialPersona
      );
    }, 100);

    return () => clearTimeout(timer);
  }, [initializeLive2D, props.initialPersona]);

  return (
    <div
      ref={containerRef}
      className={props.className}
      style={{
        ...props.style,
        width: '100vw',
        height: '100vh',
        margin: 0,
        padding: 0,
        backgroundColor: 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
        cursor: isDragging ? 'grabbing' : (isHovering ? 'pointer' : 'default')
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      onContextMenu={handleContextMenu}
    >
      <Live2DCanvas canvasRef={canvasRef} />
      <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
        menuItems={menuItems}
      />
    </div>
  );
};

export default RealLive2DComponentSimple;
