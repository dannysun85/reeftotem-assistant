# Live2D 窗口透明度修复方案

## 问题分析总结

### 问题现象
- Live2D 窗口显示白色背景，透明化配置无效
- 尽管已正确配置 `"transparent": true`，窗口仍然不透明
- 影响用户视觉体验，不符合桌面宠物设计要求

### 当前配置状态

#### Tauri 配置（正确）
```json
{
  "label": "live2d",
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true
}
```

#### CSS 样式（已完善）
```css
.live2d-window,
.live2d-window html,
.live2d-window body,
.live2d-window #root {
  background-color: transparent !important;
  background: transparent !important;
}
```

### 根本原因分析

1. **macOS 系统级限制**
   - macOS 对透明窗口有特殊的权限和渲染要求
   - 可能需要启用 `macOSPrivateApi` 特殊权限

2. **Live2D Canvas 渲染背景**
   - Live2D SDK 可能在 Canvas 上设置了默认背景
   - PixiJS 渲染引擎可能有全局背景设置

3. **Tauri v2 兼容性问题**
   - Tauri v2 对透明窗口的处理可能与 v1.x 不同

4. **渲染时机问题**
   - 窗口显示时 Live2D 尚未初始化完成
   - CSS 样式可能在组件渲染后被覆盖

## 修复方案

### 方案一：系统级透明度优化（推荐）

#### Tauri 配置增强
```json
{
  "label": "live2d",
  "transparent": true,
  "decorations": false,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "webviewOptions": {
    "autoZoom": false,
    "dragDropEnabled": false
  },
  "titleBarStyle": "overlay"
}
```

#### macOS 权限配置
需要创建 `src-tauri/entitlements.plist` 并启用 `macOSPrivateApi`。

### 方案二：Live2D 渲染优化

#### PixiJS 透明配置
```javascript
const app = new PIXI.Application({
  transparent: true,
  backgroundColor: 0x000000,
  backgroundAlpha: 0,
  antialias: true,
  preserveDrawingBuffer: true
});

if (app.renderer) {
  app.renderer.background.alpha = 0;
}
```

### 方案三：窗口运行时透明度控制

通过 Rust 后端在窗口初始化时注入 JavaScript 强制设置透明背景。

```rust
#[tauri::command]
async fn set_window_transparency(app: AppHandle, transparent: bool) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        #[cfg(target_os = "macos")]
        {
            let script = r#"
                document.documentElement.style.backgroundColor = 'transparent';
                document.body.style.backgroundColor = 'transparent';
            "#;
            window.eval(script).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}
```

### 方案四：CSS 透明化增强

```css
.live2d-window *,
.live2d-window *::before,
.live2d-window *::after {
  background: transparent !important;
  background-color: transparent !important;
  box-shadow: none !important;
}

.live2d-window canvas {
  mix-blend-mode: normal !important;
  isolation: isolate !important;
}
```

### 方案五：渐进式验证

创建最小透明窗口测试页面和调试组件来逐步定位问题。

## 推荐实施顺序

1. 方案一（系统级透明度优化）- 高优先级
2. 方案二（Live2D 渲染优化）- 高优先级
3. 方案四（CSS 透明化增强）- 中优先级
4. 方案三（运行时透明度控制）- 中优先级
5. 方案五（渐进式验证方法）- 低优先级

## 风险评估

| 风险 | 缓解措施 |
|------|----------|
| 性能影响 | 实现可选的透明度开关 |
| 兼容性问题 | 添加版本检测和降级方案 |
| 渲染错误 | 实现渲染管线的透明度管理 |

## 成功标准

- 窗口背景完全透明（alpha = 0）
- Live2D 角色正常显示
- 无白色边框或背景残留
- 帧率保持在 30 FPS 以上
- 支持 macOS 12.0+ 及深色/浅色模式

---

*最后更新: 2026-02-19*
