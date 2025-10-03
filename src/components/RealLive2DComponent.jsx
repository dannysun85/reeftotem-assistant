/* @refresh skip */
import { useEffect, useRef, useState } from 'react';
import { useLive2DCore } from './Live2D/useLive2DCore';
import { useLive2DInit } from './Live2D/useLive2DInit';
import { Live2DCanvas } from './Live2D/Live2DComponents';
// import ContextMenu from './Live2D/ContextMenu'; // 暂时禁用

const RealLive2DComponentSimple = (props) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // 状态只在初始化时使用
  const [, setStatus] = useState('正在初始化...');
  const [, setError] = useState(null);
  const [, setIsLoaded] = useState(false);

  const { loadLive2DCore } = useLive2DCore();
  const { initializeLive2D } = useLive2DInit(loadLive2DCore);

  // 拖拽状态管理
  const [isDragging, setIsDragging] = useState(false);

  // 右键菜单状态 - 暂时禁用
  // const [contextMenu, setContextMenu] = useState({
  //   visible: false,
  //   x: 0,
  //   y: 0
  // });

  // 透明度状态
  // const [opacity, setOpacity] = useState(100);

  // 置顶状态
  // const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(true);

  // 监听来自Rust端的全局鼠标事件
  useEffect(() => {
    const handleMouseMove = (event) => {
      const { x, y } = event.payload;
      const canvas = canvasRef.current;

      // 如果正在拖拽，处理拖拽移动
      if (isDragging) {
        if (window.__TAURI__?.invoke) {
          window.__TAURI__.invoke('handle_drag_move', { x, y }).catch(err => {
            console.error('处理拖拽移动失败:', err);
          });
        }
        return;
      }

      // 否则处理Live2D眼睛跟随
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      // 计算相对于画布的坐标
      const relativeX = (x - rect.left) / rect.width;
      const relativeY = (y - rect.top) / rect.height;

      // 只有在画布范围内才进行跟随
      if (relativeX >= 0 && relativeX <= 1 && relativeY >= 0 && relativeY <= 1) {
        // 调用Live2D模型的鼠标跟随方法
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
      }
    };

    // 处理拖拽结束事件
    const handleDragEnd = () => {
      setIsDragging(false);
      if (window.__TAURI__?.invoke) {
        window.__TAURI__.invoke('end_drag').catch(err => {
          console.error('结束拖拽失败:', err);
        });
      }
    };

    // 监听来自Rust端的鼠标事件
    if (window.__TAURI__?.listen) {
      const unlistenMouseMove = window.__TAURI__.listen('mouse_move', handleMouseMove);
      const unlistenMouseUp = window.__TAURI__.listen('mouse_up', handleDragEnd);

      return () => {
        unlistenMouseMove.then(fn => fn());
        unlistenMouseUp.then(fn => fn());
      };
    }
  }, [isDragging]);

  // 右键菜单处理 - 暂时禁用
  // const handleContextMenu = (e) => {
  //   e.preventDefault();
  //   setContextMenu({
  //     visible: true,
  //     x: e.clientX,
  //     y: e.clientY
  //   });
  // };

  // // 关闭右键菜单
  // const closeContextMenu = () => {
  //   setContextMenu(prev => ({ ...prev, visible: false }));
  // };

  // // 菜单项定义
  // const menuItems = [
  //   {
  //     label: '切换模型',
  //     action: () => {
  //       // 这里可以实现模型切换逻辑
  //       console.log('切换模型功能待实现');
  //     }
  //   },
  //   {
  //     type: 'separator'
  //   },
  //   {
  //     label: '透明度',
  //     type: 'slider',
  //     min: 30,
  //     max: 100,
  //     value: opacity,
  //     onChange: (value) => {
  //       setOpacity(value);
  //       if (window.__TAURI__?.invoke) {
  //         window.__TAURI__.invoke('set_window_opacity', {
  //           windowLabel: 'live2d',
  //           opacity: value / 100.0
  //         }).catch(err => {
  //           console.error('设置透明度失败:', err);
  //         });
  //       }
  //     }
  //   },
  //   {
  //     label: isAlwaysOnTop ? '取消置顶' : '窗口置顶',
  //     action: async () => {
  //       if (window.__TAURI__?.invoke) {
  //         try {
  //           const newTopmost = await window.__TAURI__.invoke('toggle_always_on_top');
  //           setIsAlwaysOnTop(newTopmost);
  //         } catch (err) {
  //           console.error('切换置顶状态失败:', err);
  //         }
  //       }
  //     }
  //   },
  //   {
  //     type: 'separator'
  //   },
  //   {
  //     label: '重置位置',
  //     action: () => {
  //       if (window.__TAURI__?.invoke) {
  //         window.__TAURI__.invoke('reset_window_position').catch(err => {
  //           console.error('重置窗口位置失败:', err);
  //         });
  //       }
  //     }
  //   },
  //   {
  //     label: '关于',
  //     action: async () => {
  //       if (window.__TAURI__?.invoke) {
  //         try {
  //           const aboutText = await window.__TAURI__.invoke('show_about_dialog');
  //           // 使用浏览器的alert显示关于信息
  //           alert(aboutText);
  //         } catch (err) {
  //           console.error('显示关于对话框失败:', err);
  //         }
  //       }
  //     }
  //   },
  //   {
  //     type: 'separator'
  //   },
  //   {
  //     label: '退出',
  //     action: () => {
  //       if (window.__TAURI__?.invoke) {
  //         window.__TAURI__.invoke('exit_app').catch(err => {
  //           console.error('退出应用失败:', err);
  //         });
  //       }
  //     }
  //   }
  // ];

  // 窗口拖拽处理 - 使用手动拖拽方法
  const handleMouseDown = (e) => {
    // 只处理左键点击的拖拽
    if (e.button !== 0) return;

    console.log('鼠标点击事件被触发，开始手动窗口拖拽');
    e.preventDefault(); // 防止其他事件干扰
    setIsDragging(true); // 设置拖拽状态

    if (window.__TAURI__?.invoke) {
      console.log('调用Tauri端手动拖拽开始命令');
      window.__TAURI__.invoke('start_manual_drag').catch(err => {
        console.error('开始手动拖拽失败:', err);
        // 回退到原生拖拽方法
        window.__TAURI__.invoke('start_window_drag').catch(err2 => {
          console.error('原生拖拽也失败:', err2);
        });
      });
    } else {
      console.error('Tauri API不可用');
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      initializeLive2D(canvasRef, setStatus, setError, setIsLoaded, props.initialPersona);
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
        cursor: 'grab'
      }}
      onMouseDown={handleMouseDown}
      // onContextMenu={handleContextMenu} // 暂时禁用
    >
      <Live2DCanvas canvasRef={canvasRef} />
      {/* 暂时禁用右键菜单 */}
      {/* <ContextMenu
        visible={contextMenu.visible}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={closeContextMenu}
        menuItems={menuItems}
      /> */}
    </div>
  );
};

export default RealLive2DComponentSimple;
