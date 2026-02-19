# Live2D 透明度修复实施步骤

## 实施计划概览

### 实施原则
- **渐进式修复**: 从最可能有效的方案开始，逐步推进
- **可逆性**: 每个步骤都可以独立回滚
- **验证导向**: 每步都有明确的验证标准
- **最小影响**: 确保不破坏现有功能

### 实施阶段
1. **第一阶段**: 基础配置修复（预计 1-2 小时）
2. **第二阶段**: 渲染系统优化（预计 2-3 小时）
3. **第三阶段**: 运行时增强（预计 1-2 小时）
4. **第四阶段**: 测试验证（预计 1 小时）

## 第一阶段：基础配置修复

### 步骤 1.1：增强 Tauri 配置

修改 `src-tauri/tauri.conf.json` 中的 live2d 窗口配置，添加 `webviewOptions` 和 `titleBarStyle`。

**验证**: 配置文件 JSON 格式正确，窗口包含 `transparent: true`。

### 步骤 1.2：创建 macOS 权限文件

创建 `src-tauri/entitlements.plist`，包含 JIT、unsigned-executable-memory 和 disable-library-validation 权限。

更新 `tauri.conf.json` 的 bundle.macOS 引用该权限文件。

### 步骤 1.3：增强 CSS 透明化规则

在 `src/index.css` 中添加更强的透明化规则，覆盖所有 `.live2d-window` 子元素、Canvas 和伪元素。

## 第二阶段：渲染系统优化

### 步骤 2.1：优化 Live2D Canvas 组件

修改 `src/components/Live2D/Live2DComponents.jsx`，确保 Canvas 初始化时设置 alpha=true 和透明背景。

### 步骤 2.2：添加 PixiJS 透明度配置

在 Live2D 初始化代码中设置 `backgroundAlpha: 0` 和 `transparent: true`。

### 步骤 2.3：创建透明度调试工具（可选）

创建 `TransparencyDebugger` 组件，快捷键 Ctrl/Cmd+Shift+T 切换显示，实时检查各元素背景色。

## 第三阶段：运行时增强

### 步骤 3.1：Rust 透明度控制命令

在 `lib.rs` 中添加 `set_window_transparency` 命令，通过 JavaScript 注入强制透明化。

### 步骤 3.2：增强窗口初始化逻辑

在 `position_live2d_window` 中添加 macOS 特殊的透明化脚本注入。

### 步骤 3.3：JavaScript 动态透明化

在 `Live2DWindow.tsx` 中添加 `enforceTransparency` 函数，在模型加载后和窗口焦点变化时执行。

## 第四阶段：测试验证

### 基础功能测试
```bash
pnpm tauri dev
# 验证：窗口背景透明，只显示 Live2D 角色
```

### 动态功能测试
- 模型切换时透明度保持
- 拖拽过程中透明度正常
- 系统主题切换不影响透明度

### 性能和稳定性测试
- 内存使用稳定，无持续增长
- CPU使用率 < 10%
- Live2D动画流畅 > 30 FPS

### 回归测试
- 托盘功能正常
- 语音交互正常
- 边缘检测正常

## 回滚计划

```bash
# 恢复所有文件
git checkout -- src-tauri/tauri.conf.json
git checkout -- src/index.css
git checkout -- src/components/Live2D/Live2DComponents.jsx
git checkout -- src/pages/Live2DWindow.tsx
git checkout -- src-tauri/src/lib.rs
rm -f src-tauri/entitlements.plist
rm -f src/components/debug/TransparencyDebugger.tsx
```

## 成功标准确认

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

---

*最后更新: 2026-02-19*
