# Live2D 透明度修复实施步骤

## 📋 实施计划概览

### 实施原则
- **渐进式修复**：从最可能有效的方案开始，逐步推进
- **可逆性**：每个步骤都可以独立回滚
- **验证导向**：每步都有明确的验证标准
- **最小影响**：确保不破坏现有功能

### 实施阶段
1. **第一阶段**：基础配置修复（预计 1-2 小时）
2. **第二阶段**：渲染系统优化（预计 2-3 小时）
3. **第三阶段**：运行时增强（预计 1-2 小时）
4. **第四阶段**：测试验证（预计 1 小时）

---

## 🚀 第一阶段：基础配置修复

### 步骤 1.1：增强 Tauri 配置

#### 📝 操作内容
修改 `src-tauri/tauri.conf.json` 中的 live2d 窗口配置

#### 🔧 具体修改
```json
{
  "label": "live2d",
  "title": "Live2D Pet",
  "url": "/live2d",
  "width": 800,
  "height": 1000,
  "minWidth": 200,
  "minHeight": 200,
  "center": false,
  "resizable": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": true,
  "dragDropEnabled": false,
  "webviewOptions": {
    "autoZoom": false,
    "dragDropEnabled": false
  },
  "titleBarStyle": "overlay"
}
```

#### ✅ 验证标准
- [ ] 配置文件 JSON 格式正确
- [ ] live2d 窗口包含 `transparent: true`
- [ ] 新增 `webviewOptions` 和 `titleBarStyle` 配置

#### 🔄 回滚方案
保留原配置文件的备份，如果出现问题可立即恢复

### 步骤 1.2：创建 macOS 权限文件

#### 📝 操作内容
创建 `src-tauri/entitlements.plist` 文件以支持 macOS 透明窗口

#### 🔧 具体操作
1. 在 `src-tauri/` 目录下创建 `entitlements.plist` 文件
2. 添加以下内容：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-only</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

3. 修改 `src-tauri/tauri.conf.json` 中的 bundle 配置：

```json
{
  "bundle": {
    "active": true,
    "targets": "all",
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": [
      "icons/*",
      "../dist/assets/**/*"
    ],
    "macOS": {
      "entitlements": "entitlements.plist",
      "providerShortName": null,
      "signingIdentity": null
    }
  }
}
```

#### ✅ 验证标准
- [ ] `entitlements.plist` 文件创建成功
- [ ] 文件格式正确（可通过在线 plist 验证器检查）
- [ ] `tauri.conf.json` 已更新引用权限文件

#### 🔄 回滚方案
删除 `entitlements.plist` 文件，移除 `tauri.conf.json` 中的相关配置

### 步骤 1.3：增强 CSS 透明化规则

#### 📝 操作内容
更新 `src/index.css` 文件，添加更强的透明化规则

#### 🔧 具体修改
在现有 `.live2d-window` 样式后添加：

```css
/* Live2D 窗口完全透明增强版 */
.live2d-window,
.live2d-window html,
.live2d-window body,
.live2d-window #root,
.live2d-window #root > div,
.live2d-window #live2dCanvas {
  background: none !important;
  background-color: transparent !important;
  background-image: none !important;
  background-clip: unset !important;
  -webkit-background-clip: unset !important;
  backdrop-filter: none !important;
  box-shadow: none !important;
  border: none !important;
  outline: none !important;
}

/* Canvas 特殊处理 */
.live2d-window canvas {
  background: transparent !important;
  background-color: transparent !important;
  mix-blend-mode: normal !important;
  isolation: isolate !important;
}

/* 防止伪元素产生背景 */
.live2d-window *,
.live2d-window *::before,
.live2d-window *::after {
  background: transparent !important;
  background-color: transparent !important;
  background-image: none !important;
  box-shadow: none !important;
}

/* 强制透明 - 最高优先级 */
.live2d-window {
  background: rgba(0, 0, 0, 0) !important;
  background-color: rgba(0, 0, 0, 0) !important;
}

/* macOS 特殊处理 */
@media (prefers-color-scheme: dark) {
  .live2d-window {
    background: rgba(0, 0, 0, 0) !important;
    -webkit-appearance: none !important;
  }
}
```

#### ✅ 验证标准
- [ ] CSS 语法正确
- [ ] 没有语法错误或警告
- [ ] 透明化规则使用了足够高的优先级

#### 🔄 回滚方案
保留原 CSS 文件备份，如出现问题可立即恢复

---

## 🎨 第二阶段：渲染系统优化

### 步骤 2.1：优化 Live2D Canvas 组件

#### 📝 操作内容
修改 `src/components/Live2D/Live2DComponents.jsx` 文件，增强 Canvas 透明度处理

#### 🔧 具体修改
将现有的 `Live2DCanvas` 组件替换为：

```jsx
/* @refresh skip */
import React, { useEffect, useRef } from 'react';

export const Live2DCanvas = ({ canvasRef }) => {
  const internalCanvasRef = useRef(null);

  // 合并外部和内部 ref
  const canvas = canvasRef || internalCanvasRef;

  useEffect(() => {
    const canvasElement = canvas.current;
    if (canvasElement) {
      console.log('🔧 初始化 Canvas 透明度设置');

      // 确保 Canvas 背景透明
      const ctx = canvasElement.getContext('2d', {
        alpha: true,
        willReadFrequently: false,
        desynchronized: false
      });

      if (ctx) {
        // 清除 Canvas 为完全透明
        ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);

        // 设置合成模式确保透明度
        ctx.globalCompositeOperation = 'source-over';

        // 重置任何可能的变换
        ctx.setTransform(1, 0, 0, 1, 0, 0);

        console.log('✅ Canvas 透明度设置完成');
      }

      // 强制设置 Canvas 样式
      canvasElement.style.backgroundColor = 'transparent';
      canvasElement.style.background = 'transparent';
      canvasElement.style.backgroundImage = 'none';
      canvasElement.style.boxShadow = 'none';
      canvasElement.style.border = 'none';

      // 移除任何可能的默认背景
      canvasElement.remove();

      console.log('✅ Canvas 样式强制透明化完成');
    }
  }, [canvas]);

  return (
    <canvas
      ref={canvas}
      id="live2dCanvas"
      style={{
        width: '800px',
        height: '1000px',
        display: 'block',
        backgroundColor: 'transparent',
        background: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none',
        border: 'none',
        outline: 'none',
        opacity: 1,
        mixBlendMode: 'normal',
        isolation: 'isolate'
      }}
      width={800}
      height={1000}
    />
  );
};
```

#### ✅ 验证标准
- [ ] 组件可以正常编译
- [ ] 没有 TypeScript/JavaScript 错误
- [ ] Canvas 元素正确设置了透明度属性

#### 🔄 回滚方案
保留原组件文件备份，如出现问题可立即恢复

### 步骤 2.2：添加 PixiJS 透明度配置

#### 📝 操作内容
在 Live2D 初始化代码中添加 PixiJS 透明度配置

#### 🔧 具体操作
需要找到 Live2D 初始化的相关文件（可能在 `src/lib/live2d/` 目录中），添加以下配置：

```javascript
// 在创建 PixiJS Application 时添加透明度配置
const app = new PIXI.Application({
  transparent: true,
  backgroundColor: 0x000000,
  backgroundAlpha: 0,
  antialias: true,
  preserveDrawingBuffer: true,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
});

// 确保渲染器背景透明
if (app.renderer) {
  app.renderer.background.alpha = 0;
  app.renderer.backgroundColor = 0x000000;
  app.renderer.transparent = true;

  console.log('✅ PixiJS 渲染器透明度配置完成');
}

// 确保 Stage 透明
if (app.stage) {
  app.stage.alpha = 1;
  app.stage.backgroundColor = 0x000000;
}

console.log('✅ PixiJS 透明度配置完成');
```

#### ✅ 验证标准
- [ ] 找到了正确的 Live2D 初始化文件
- [ ] PixiJS 配置代码正确添加
- [ ] 没有语法错误

#### 🔍 注意事项
需要先通过搜索找到正确的 PixiJS 初始化位置：
- 搜索 `new PIXI.Application`
- 搜索 `PIXI.Application`
- 搜索 `app.renderer`

#### 🔄 回滚方案
注释或删除新增的 PixiJS 配置代码

### 步骤 2.3：创建透明度调试工具

#### 📝 操作内容
创建一个透明度调试组件，用于验证透明化效果

#### 🔧 具体操作
1. 创建新文件 `src/components/debug/TransparencyDebugger.tsx`：

```typescript
import React, { useState, useEffect } from 'react';

interface DebugInfo {
  rootBackground?: string;
  canvasBackground?: string;
  bodyBackground?: string;
  htmlBackground?: string;
  computedAlpha?: number;
  timestamp: string;
}

export const TransparencyDebugger: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({ timestamp: '' });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const checkTransparency = () => {
      try {
        const root = document.getElementById('root');
        const canvas = document.getElementById('live2dCanvas');

        const info: DebugInfo = {
          rootBackground: root ? window.getComputedStyle(root).backgroundColor : 'not found',
          canvasBackground: canvas ? window.getComputedStyle(canvas).backgroundColor : 'not found',
          bodyBackground: window.getComputedStyle(document.body).backgroundColor,
          htmlBackground: window.getComputedStyle(document.documentElement).backgroundColor,
          timestamp: new Date().toLocaleTimeString()
        };

        // 计算 alpha 值
        if (canvas) {
          const canvasStyle = window.getComputedStyle(canvas);
          const bgColor = canvasStyle.backgroundColor;
          const alphaMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (alphaMatch && alphaMatch[4]) {
            info.computedAlpha = parseFloat(alphaMatch[4]);
          }
        }

        setDebugInfo(info);
      } catch (error) {
        console.error('透明度检查失败:', error);
        setDebugInfo({
          timestamp: new Date().toLocaleTimeString(),
          rootBackground: 'error',
          canvasBackground: 'error',
          bodyBackground: 'error',
          htmlBackground: 'error'
        });
      }
    };

    // 初始检查
    checkTransparency();

    // 定期检查
    const interval = setInterval(checkTransparency, 2000);
    return () => clearInterval(interval);
  }, []);

  // 键盘快捷键：Ctrl/Cmd + Shift + T 切换显示
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') {
        setIsVisible(!isVisible);
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [isVisible]);

  if (!isVisible) {
    return (
      <div style={{
        position: 'fixed',
        top: '10px',
        right: '10px',
        background: 'rgba(0, 0, 0, 0.5)',
        color: 'white',
        padding: '5px 10px',
        borderRadius: '3px',
        fontSize: '10px',
        zIndex: 9999,
        cursor: 'pointer'
      }} onClick={() => setIsVisible(true)}>
        🔍 T
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.9)',
      color: 'white',
      padding: '15px',
      borderRadius: '8px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 9999,
      maxWidth: '400px',
      maxHeight: '80vh',
      overflow: 'auto',
      border: '1px solid rgba(255, 255, 255, 0.2)'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '10px'
      }}>
        <h4 style={{ margin: 0, color: '#4CAF50' }}>🔍 透明度调试</h4>
        <button
          onClick={() => setIsVisible(false)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            fontSize: '16px',
            cursor: 'pointer',
            padding: '0',
            width: '20px',
            height: '20px'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ marginBottom: '10px', fontSize: '10px', color: '#ccc' }}>
        快捷键: Ctrl/Cmd + Shift + T
      </div>

      <pre style={{
        margin: 0,
        fontSize: '11px',
        lineHeight: '1.4',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {JSON.stringify(debugInfo, null, 2)}
      </pre>

      <div style={{ marginTop: '10px', fontSize: '10px' }}>
        <div style={{ color: debugInfo.canvasBackground?.includes('transparent') ? '#4CAF50' : '#f44336' }}>
          Canvas: {debugInfo.canvasBackground?.includes('transparent') ? '✅ 透明' : '❌ 不透明'}
        </div>
        <div style={{ color: debugInfo.bodyBackground?.includes('transparent') ? '#4CAF50' : '#f44336' }}>
          Body: {debugInfo.bodyBackground?.includes('transparent') ? '✅ 透明' : '❌ 不透明'}
        </div>
        <div style={{ color: (debugInfo.computedAlpha !== undefined && debugInfo.computedAlpha < 0.1) ? '#4CAF50' : '#f44336' }}>
          Alpha: {debugInfo.computedAlpha !== undefined ? `${debugInfo.computedAlpha.toFixed(3)}` : '未知'}
        </div>
      </div>
    </div>
  );
};
```

2. 在 `src/pages/Live2DWindow.tsx` 中引入并使用：

```typescript
// 在文件顶部导入
import { TransparencyDebugger } from '../components/debug/TransparencyDebugger';

// 在组件的 return 语句中添加
return (
  <div className="live2d-window" /* ... 其他属性 */}>
    {/* ... 现有内容 */}
    <TransparencyDebugger />
  </div>
);
```

#### ✅ 验证标准
- [ ] 调试组件可以正常编译
- [ ] 快捷键 Ctrl/Cmd + Shift + T 可以切换显示
- [ ] 调试信息正确显示各元素背景色

#### 🔄 回滚方案
移除调试组件的导入和使用

---

## 🛠️ 第三阶段：运行时增强

### 步骤 3.1：添加 Rust 透明度控制命令

#### 📝 操作内容
在 `src-tauri/src/lib.rs` 中添加透明度控制命令

#### 🔧 具体操作
在 Rust 文件中添加以下函数：

```rust
#[tauri::command]
async fn set_window_transparency(app: AppHandle, transparent: bool) -> Result<(), String> {
    println!("🔧 设置窗口透明度: {}", transparent);

    if let Some(window) = app.get_webview_window("live2d") {
        // macOS 特殊处理
        #[cfg(target_os = "macos")]
        {
            // 设置窗口背景色
            window.set_decorations(false).map_err(|e| e.to_string())?;

            // 使用 JavaScript 强制设置透明背景
            let script = if transparent {
                r#"
                    console.log('🔧 执行透明化脚本');

                    // 强制设置所有元素的背景为透明
                    const elements = [
                        document.documentElement,
                        document.body,
                        document.getElementById('root'),
                        document.querySelector('.live2d-window'),
                        document.getElementById('live2dCanvas')
                    ];

                    elements.forEach(el => {
                        if (el) {
                            el.style.backgroundColor = 'transparent';
                            el.style.background = 'transparent';
                            el.style.backgroundImage = 'none';
                            el.style.boxShadow = 'none';
                            el.style.border = 'none';
                            el.style.outline = 'none';

                            console.log('✅ 元素透明化:', el.tagName, el.id || el.className);
                        }
                    });

                    // 处理所有可能的背景元素
                    const allElements = document.querySelectorAll('*');
                    let fixedCount = 0;
                    allElements.forEach(el => {
                        const computedStyle = window.getComputedStyle(el);
                        if (computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                            computedStyle.backgroundColor !== 'transparent' &&
                            !computedStyle.backgroundColor.includes('rgba(0, 0, 0, 0)')) {
                            el.style.backgroundColor = 'transparent';
                            fixedCount++;
                        }
                    });

                    // 特别处理 Canvas
                    const canvas = document.getElementById('live2dCanvas');
                    if (canvas) {
                        const ctx = canvas.getContext('2d');
                        if (ctx) {
                            ctx.clearRect(0, 0, canvas.width, canvas.height);
                            ctx.globalCompositeOperation = 'source-over';
                        }
                        canvas.style.backgroundColor = 'transparent';
                        canvas.style.background = 'transparent';
                        canvas.style.mixBlendMode = 'normal';

                        console.log('✅ Canvas 特殊处理完成');
                    }

                    console.log(`✅ 透明化脚本执行完成，修复了 ${fixedCount} 个元素`);
                    '透明化完成';
                "#
            } else {
                r#"
                    document.documentElement.style.backgroundColor = '';
                    document.body.style.backgroundColor = '';
                    console.log('🔧 透明化已移除');
                    '透明化已移除';
                "#
            };

            match window.eval(script) {
                Ok(result) => println!("✅ 透明化脚本执行成功: {:?}", result),
                Err(e) => eprintln!("❌ 透明化脚本执行失败: {}", e),
            }
        }

        println!("✅ 窗口透明度设置完成: {}", transparent);
    } else {
        return Err("找不到 Live2D 窗口".to_string());
    }

    Ok(())
}
```

并将该命令添加到 `invoke_handler!` 宏中：

```rust
.invoke_handler(tauri::generate_handler![
    // ... 现有命令
    set_window_transparency,  // 新增
    // ... 其他命令
])
```

#### ✅ 验证标准
- [ ] Rust 代码可以正常编译
- [ ] 命令正确注册到 Tauri 处理器中
- [ ] 没有编译错误或警告

#### 🔄 回滚方案
注释或删除新增的命令函数

### 步骤 3.2：增强窗口初始化逻辑

#### 📝 操作内容
修改 `position_live2d_window` 函数，添加透明度初始化

#### 🔧 具体操作
在 `src-tauri/src/lib.rs` 的 `position_live2d_window` 函数中添加：

```rust
// 在现有的窗口设置代码后添加

// 设置窗口属性时添加透明度确保
window.set_decorations(false).map_err(|e| e.to_string())?;

// macOS 特殊处理
#[cfg(target_os = "macos")]
{
    // 强制设置透明背景
    let transparency_script = r#"
        console.log('🔧 窗口初始化透明化脚本');

        // 立即执行透明化
        document.documentElement.style.backgroundColor = 'transparent';
        document.body.style.backgroundColor = 'transparent';

        // 移除所有可能的背景
        const allElements = document.querySelectorAll('*');
        let fixedCount = 0;
        allElements.forEach(el => {
            const computedStyle = window.getComputedStyle(el);
            if (computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                computedStyle.backgroundColor !== 'transparent' &&
                !computedStyle.backgroundColor.includes('rgba(0, 0, 0, 0)') &&
                !el.classList.contains('keep-background')) {
                el.style.backgroundColor = 'transparent';
                fixedCount++;
            }
        });

        // 确保 canvas 透明
        const canvas = document.getElementById('live2dCanvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.globalCompositeOperation = 'source-over';
            }
            canvas.style.backgroundColor = 'transparent';
            canvas.style.background = 'transparent';
            canvas.style.mixBlendMode = 'normal';

            console.log('✅ Canvas 初始化透明化完成');
        }

        // 延迟再次执行透明化，确保在 Live2D 加载后生效
        setTimeout(() => {
            console.log('🔧 延迟透明化检查');

            const delayedCanvas = document.getElementById('live2dCanvas');
            if (delayedCanvas) {
                delayedCanvas.style.backgroundColor = 'transparent';
                delayedCanvas.style.background = 'transparent';

                const delayedCtx = delayedCanvas.getContext('2d');
                if (delayedCtx) {
                    delayedCtx.clearRect(0, 0, delayedCanvas.width, delayedCanvas.height);
                }

                console.log('✅ 延迟 Canvas 透明化完成');
            }
        }, 2000);

        console.log(`✅ 窗口初始化透明化完成，修复了 ${fixedCount} 个元素`);
        '初始化透明化完成';
    "#;

    match window.eval(transparency_script) {
        Ok(result) => println!("✅ 初始化透明化脚本执行成功: {:?}", result),
        Err(e) => eprintln!("❌ 初始化透明化脚本执行失败: {}", e),
    }
}

// 添加额外的透明度确保命令
tauri::async_runtime::spawn(async move {
    std::thread::sleep(Duration::from_millis(3000));

    if let Err(e) = set_window_transparency(app, true).await {
        eprintln!("❌ 延迟透明化设置失败: {}", e);
    } else {
        println!("✅ 延迟透明化设置成功");
    }
});
```

#### ✅ 窌证标准
- [ ] Rust 代码可以正常编译
- [ ] 没有语法错误
- [ ] 透明化脚本语法正确

#### 🔄 回滚方案
注释或删除新增的透明化代码

### 步骤 3.3：添加 JavaScript 动态透明化

#### 📝 操作内容
在 `src/pages/Live2DWindow.tsx` 中添加动态透明化函数

#### 🔧 具体操作
在 Live2DWindow 组件中添加：

```typescript
// 在组件内部添加透明化强制执行函数
const enforceTransparency = useCallback(() => {
  console.log('🔧 执行 JavaScript 透明化强制执行');

  const elements = [
    document.documentElement,
    document.body,
    document.getElementById('root'),
    document.querySelector('.live2d-window'),
    document.getElementById('live2dCanvas')
  ];

  elements.forEach(el => {
    if (el) {
      el.style.backgroundColor = 'transparent';
      el.style.background = 'transparent';
      el.style.backgroundImage = 'none';
      el.style.boxShadow = 'none';
      el.style.border = 'none';
      el.style.outline = 'none';

      console.log('✅ 元素透明化:', el.tagName, el.id || el.className);
    }
  });

  // 处理所有可能的背景元素
  const allElements = document.querySelectorAll('*');
  let fixedCount = 0;
  allElements.forEach(el => {
    const computedStyle = window.getComputedStyle(el);
    if (computedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
        computedStyle.backgroundColor !== 'transparent' &&
        !computedStyle.backgroundColor.includes('rgba(0, 0, 0, 0)') &&
        !el.classList.contains('keep-background')) {
      el.style.backgroundColor = 'transparent';
      fixedCount++;
    }
  });

  // 特别处理 Canvas
  const canvas = document.getElementById('live2dCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    }

    // 强制设置 Canvas 样式
    canvas.style.backgroundColor = 'transparent';
    canvas.style.background = 'transparent';
    canvas.style.backgroundImage = 'none';
    canvas.style.boxShadow = 'none';
    canvas.style.border = 'none';
    canvas.style.mixBlendMode = 'normal';
    canvas.style.isolation = 'isolate';

    console.log('✅ Canvas 特殊透明化处理完成');
  }

  console.log(`✅ JavaScript 透明化强制执行完成，修复了 ${fixedCount} 个元素`);
}, []);

// 在 Live2D 初始化完成后调用
useEffect(() => {
  if (isModelLoaded) {
    console.log('🔧 Live2D 模型加载完成，执行透明化');

    // 立即执行透明化
    enforceTransparency();

    // 延迟再次执行，确保渲染完成
    const timer1 = setTimeout(enforceTransparency, 500);
    const timer2 = setTimeout(enforceTransparency, 2000);
    const timer3 = setTimeout(enforceTransparency, 5000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }
}, [isModelLoaded, enforceTransparency]);

// 添加窗口焦点变化时的透明化检查
useEffect(() => {
  const handleFocus = () => {
    console.log('🔧 窗口获得焦点，检查透明度');
    setTimeout(enforceTransparency, 100);
  };

  const handleVisibilityChange = () => {
    if (!document.hidden) {
      console.log('🔧 页面变为可见，检查透明度');
      setTimeout(enforceTransparency, 100);
    }
  };

  window.addEventListener('focus', handleFocus);
  window.addEventListener('visibilitychange', handleVisibilityChange);

  return () => {
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('visibilitychange', handleVisibilityChange);
  };
}, [enforceTransparency]);
```

#### ✅ 验证标准
- [ ] TypeScript 代码可以正常编译
- [ ] 没有类型错误
- [ ] 透明化函数逻辑正确

#### 🔄 回滚方案
注释或删除新增的透明化代码

---

## 🧪 第四阶段：测试验证

### 步骤 4.1：基础功能测试

#### 📝 测试内容
验证透明度修复的基本效果

#### 🔧 测试步骤
1. **编译和启动应用**
   ```bash
   cd /Users/sun/Documents/RustProject/reeftotem-assistant
   pnpm tauri dev
   ```

2. **基础透明度检查**
   - 启动应用后，Live2D 窗口应该完全透明
   - 背景应该显示桌面内容，无白色或有色背景
   - Live2D 角色应该正常显示和动画

3. **使用调试工具验证**
   - 按 `Ctrl/Cmd + Shift + T` 打开透明度调试器
   - 检查各元素的背景色是否为 `transparent`
   - 确认 Canvas 的 alpha 值为 0

#### ✅ 验收标准
- [ ] 窗口背景完全透明
- [ ] Live2D 角色正常显示
- [ ] 调试器显示所有元素都是透明的
- [ ] 没有白色边框或背景残留

### 步骤 4.2：动态功能测试

#### 📝 测试内容
验证动态场景下的透明度稳定性

#### 🔧 测试步骤
1. **模型切换测试**
   - 右键点击 Live2D 角色
   - 切换不同的 Live2D 模型
   - 验证切换过程中透明度保持

2. **交互功能测试**
   - 拖拽 Live2D 窗口到不同位置
   - 验证拖拽过程中透明度保持
   - 测试鼠标交互（眼神追踪、点击表情）

3. **环境适应测试**
   - 切换系统深色/浅色模式
   - 移动窗口到不同背景上
   - 验证透明度在不同环境下都正常

#### ✅ 验收标准
- [ ] 模型切换时透明度保持
- [ ] 拖拽过程中透明度正常
- [ ] 系统主题切换不影响透明度
- [ ] 在复杂背景下透明度效果良好

### 步骤 4.3：性能和稳定性测试

#### 📝 测试内容
验证透明度修复对性能的影响

#### 🔧 测试步骤
1. **性能监控**
   ```bash
   # 在另一个终端中监控资源使用
   top -p $(pgrep -f reeftotem-assistant)
   ```

2. **长时间运行测试**
   - 让应用运行 30 分钟以上
   - 观察内存使用是否稳定
   - 检查是否有内存泄漏

3. **渲染性能测试**
   - 观察 Live2D 动画流畅度
   - 检查是否有卡顿或掉帧
   - 验证透明度不影响渲染性能

#### ✅ 验收标准
- [ ] 内存使用稳定，无持续增长
- [ ] CPU 使用率保持在合理范围（<10%）
- [ ] Live2D 动画流畅（>30 FPS）
- [ ] 长时间运行无问题

### 步骤 4.4：回归测试

#### 📝 测试内容
确保修复没有破坏现有功能

#### 🔧 测试步骤
1. **托盘功能测试**
   - 测试托盘菜单显示/隐藏
   - 验证模型切换功能
   - 检查退出功能

2. **语音交互测试**
   - 测试语音录制功能
   - 验证语音识别和合成
   - 检查唇形同步效果

3. **边缘检测测试**
   - 测试窗口边缘约束
   - 验证拖拽边界检测
   - 检查碰撞预测功能

#### ✅ 验收标准
- [ ] 所有现有功能正常工作
- [ ] 没有功能回归问题
- [ ] 错误处理机制正常
- [ ] 日志记录正常

---

## 📊 测试结果记录

### 测试检查清单

#### 第一阶段验证
- [ ] Tauri 配置更新成功
- [ ] macOS 权限文件创建成功
- [ ] CSS 透明化规则生效

#### 第二阶段验证
- [ ] Live2D Canvas 透明化生效
- [ ] PixiJS 透明度配置成功
- [ ] 调试工具正常工作

#### 第三阶段验证
- [ ] Rust 透明度命令正常
- [ ] 窗口初始化透明化生效
- [ ] JavaScript 动态透明化正常

#### 第四阶段验证
- [ ] 基础透明度效果达标
- [ ] 动态功能测试通过
- [ ] 性能和稳定性达标
- [ ] 回归测试通过

### 问题记录模板

```
## 发现的问题

### 问题 1：[问题描述]
- **现象**：[具体表现]
- **复现步骤**：[如何复现]
- **严重程度**：[高/中/低]
- **解决方案**：[如何解决]
- **状态**：[待处理/已解决]

### 问题 2：[问题描述]
...
```

### 成功标准确认

```
## ✅ 成功标准确认

### 透明度效果
- [ ] 窗口背景完全透明 (alpha = 0)
- [ ] Live2D 角色正常显示
- [ ] 无白色边框或背景残留

### 性能标准
- [ ] 帧率保持在 30 FPS 以上
- [ ] 内存使用增加不超过 10%
- [ ] 启动时间增加不超过 100ms

### 兼容性标准
- [ ] 支持 macOS 12.0+ 版本
- [ ] 支持深色和浅色模式
- [ ] 支持多显示器环境

### 用户体验标准
- [ ] 透明效果自然流畅
- [ ] Live2D 角色与桌面融合良好
- [ ] 无视觉闪烁或抖动
```

---

## 🔄 回滚计划

### 快速回滚步骤

如果修复过程中遇到严重问题，可以按以下步骤快速回滚：

1. **恢复配置文件**
   ```bash
   git checkout -- src-tauri/tauri.conf.json
   rm -f src-tauri/entitlements.plist
   ```

2. **恢复 CSS 文件**
   ```bash
   git checkout -- src/index.css
   ```

3. **恢复组件文件**
   ```bash
   git checkout -- src/components/Live2D/Live2DComponents.jsx
   git checkout -- src/pages/Live2DWindow.tsx
   ```

4. **恢复 Rust 代码**
   ```bash
   git checkout -- src-tauri/src/lib.rs
   ```

5. **清理调试组件**
   ```bash
   rm -f src/components/debug/TransparencyDebugger.tsx
   ```

### 部分回滚选项

如果只需要回滚特定部分：

- **只回滚 Rust 更改**：注释新增的 Rust 代码
- **只回滚 CSS 更改**：移除新增的 CSS 规则
- **只回滚组件更改**：恢复原始组件代码
- **禁用调试功能**：移除调试组件导入

---

## 📈 后续优化建议

### 短期优化（1-2 周内）

1. **性能监控**
   - 添加透明度性能监控
   - 收集用户反馈
   - 优化渲染性能

2. **用户体验优化**
   - 添加透明度调节选项
   - 实现智能背景检测
   - 优化不同光照环境下的显示效果

### 中期优化（1-2 月内）

1. **高级功能**
   - 实现动态透明度效果
   - 添加环境光感应
   - 支持透明度动画过渡

2. **兼容性增强**
   - 支持更多操作系统版本
   - 适配不同屏幕分辨率
   - 优化多显示器支持

### 长期优化（3-6 月内）

1. **智能化**
   - AI 驱动的透明度优化
   - 自适应背景环境
   - 智能渲染管线优化

2. **生态集成**
   - 与系统深色模式深度集成
   - 支持系统透明度设置
   - 实现跨平台统一体验

---

## 📞 支持和联系

如果在实施过程中遇到问题：

1. **技术支持**
   - 查看项目文档
   - 检查 Tauri 官方文档
   - 参考 Live2D SDK 文档

2. **调试帮助**
   - 使用内置调试工具
   - 查看浏览器控制台日志
   - 检查 Tauri 开发者工具

3. **社区支持**
   - 提交 GitHub Issue
   - 参与社区讨论
   - 分享使用经验

---

*此实施步骤文档将根据实际测试结果持续更新和完善。*