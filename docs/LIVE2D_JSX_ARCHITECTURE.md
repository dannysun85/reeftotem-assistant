# Live2D 组件架构说明

## 技术选型：为什么使用 JSX 而不是 TSX？

### 问题背景

在开发 Live2D 组件时，遇到了 `@vitejs/plugin-react` 的持久性错误：

```
@vitejs/plugin-react can't detect preamble. Something is wrong.
```

这个错误在不同的代码行反复出现，尝试了多种解决方案都无法根治。

### 尝试过的解决方案

1. ✗ 修改组件声明方式（函数声明、箭头函数、export default）
2. ✗ 移除 `@ts-nocheck` 注释
3. ✗ 使用 `React.createElement` 代替 JSX
4. ✗ 降级 `@vitejs/plugin-react` 到 4.3.4
5. ✗ 切换到 `@vitejs/plugin-react-swc`
6. ✗ 配置 exclude 规则
7. ✗ 使用 lazy loading 和 wrapper 组件
8. ✗ 拆分为多个小文件
9. ✗ 切换到 .jsx 文件扩展名

### 最终解决方案

**完全移除 React 插件，使用 Vite 内置的 esbuild 处理 JSX。**

#### Vite 配置

```typescript
// vite.config.ts
export default defineConfig({
  plugins: [],  // 不使用 @vitejs/plugin-react
  
  esbuild: {
    jsxInject: `import React from 'react'`,  // 自动注入 React
  },
});
```

#### 组件文件使用 .jsx 扩展名

```javascript
// src/components/RealLive2DComponent.jsx
/* @refresh skip */
import React, { useEffect, useState } from 'react';
// ... 其他代码
```

### 权衡与取舍

#### 失去的功能
- ❌ React Fast Refresh（热更新）
- ❌ TypeScript 类型检查（在 JSX 文件中）

#### 获得的收益
- ✅ 稳定的构建过程，无 preamble 错误
- ✅ 更简单的配置
- ✅ 更快的构建速度（esbuild 比 Babel 快）
- ✅ 完整的 React 功能支持

### 组件架构

Live2D 组件采用**拆分架构**，分为三个部分：

#### 1. useLive2DCore.js - Core 加载 Hook
负责动态加载 Live2D Core 库（live2dcubismcore.js）。

```javascript
export const useLive2DCore = () => {
  const [coreLoaded, setCoreLoaded] = useState(false);
  // 动态加载 Core 脚本...
};
```

#### 2. useLive2DInit.js - 初始化 Hook
负责初始化 Live2D 系统和 LAppDelegate。

```javascript
export const useLive2DInit = (coreLoaded, canvasId) => {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);
  // 初始化 Live2D...
};
```

#### 3. Live2DComponents.jsx - 展示组件
包含 UI 展示组件：Canvas、DebugInfo、LoadingIndicator。

```javascript
export const Live2DCanvas = ({ canvasId }) => (
  <canvas id={canvasId} style={{ width: '100%', height: '100%' }} />
);
```

#### 4. RealLive2DComponent.jsx - 主组件
组合以上三个部分，形成完整的 Live2D 组件。

### 关键技术细节

#### Canvas ID 匹配
Live2D 库期望的 canvas id 必须是 `"live2dCanvas"`（驼峰式），不能是 `"live2d-canvas"`（短横线）。

```javascript
const CANVAS_ID = "live2dCanvas";  // ✓ 正确
const CANVAS_ID = "live2d-canvas"; // ✗ 错误
```

#### 禁用 Fast Refresh
所有 Live2D 相关文件都包含 `/* @refresh skip */` 注释，避免热更新导致的状态问题。

### 导入方式

在 TypeScript 文件中导入 JSX 组件时需要添加 `@ts-ignore`：

```typescript
// src/pages/Live2DWindow.tsx
// @ts-ignore
import RealLive2DComponent from '../components/RealLive2DComponent.jsx';
```

### 未来改进方向

如果需要重新启用 Fast Refresh：
1. 等待 Vite 或 React 插件更新修复 preamble bug
2. 考虑将 Live2D 组件迁移到单独的微前端应用
3. 探索其他构建工具（如 Turbopack）

### 参考资料

- [Vite esbuild 文档](https://vitejs.dev/config/shared-options.html#esbuild)
- [@vitejs/plugin-react GitHub Issues](https://github.com/vitejs/vite-plugin-react/issues)
- [Live2D Cubism SDK for Web](https://www.live2d.com/en/sdk/)
