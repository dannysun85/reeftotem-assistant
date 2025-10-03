# Live2D Desktop Pet

基于 Tauri + React + TypeScript + Live2D 的桌面宠物应用，实现类似金山毒霸小狮子的效果。

## 功能特性

- 🎭 Live2D 数字人渲染
- 🖱️ 可拖拽的透明窗口
- 📌 窗口置顶功能
- 🎨 交互式动作和表情
- ⌨️ 键盘快捷键支持
- 🎮 响应式设计

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS
- **桌面框架**: Tauri 2
- **Live2D渲染**: PixiJS + @pixi/live2d-display
- **状态管理**: Zustand
- **路由**: React Router

## 项目结构

```
src/
├── components/
│   └── live2d/
│       ├── Live2DViewer.tsx           # Live2D渲染组件
│       ├── DraggableLive2D.tsx        # 可拖拽包装器
│       ├── Live2DControls.tsx         # 控制面板
│       └── Live2DProvider.tsx         # Context提供者
├── hooks/
│   ├── useLive2D.ts                   # Live2D核心逻辑
│   ├── useDraggable.ts                # 拖拽逻辑
│   └── useWindowManager.ts            # 窗口管理
├── stores/
│   └── live2dStore.ts                 # 状态管理
├── utils/
│   ├── live2d-loader.ts               # 模型加载器
│   └── window-utils.ts                # 窗口工具
├── pages/
│   └── Live2DWindow.tsx               # 独立窗口页面
└── types/
    └── live2d.types.ts                # 类型定义
```

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 开发模式

```bash
npm run tauri dev
```

### 3. 构建应用

```bash
npm run tauri build
```

## 使用说明

### 基本操作

1. **启动应用**: 运行后在主界面点击 "Open Pet" 打开Live2D窗口
2. **拖拽移动**: 点击并拖拽Live2D模型到任意位置
3. **交互动作**:
   - 单击模型播放随机动作
   - 双击播放特殊动作并切换表情
   - 悬停触发追踪效果

### 键盘快捷键

- `1`: 切换到普通表情
- `2`: 切换到开心表情
- `空格`: 播放点击动作
- `R`: 重新加载模型

### 控制面板

主应用提供了完整的控制面板，可以：
- 显示/隐藏Live2D窗口
- 切换置顶状态
- 调整模型缩放
- 重置位置
- 查看调试信息

## 窗口配置

Live2D窗口具有以下特性：
- 透明背景，无边框
- 始终置顶（可切换）
- 不可调整大小
- 不在任务栏显示
- 300x400像素默认尺寸

## 模型文件

Live2D模型文件应放置在 `public/models/` 目录下：

```
public/models/
└── your-model/
    ├── model.model3.json
    ├── your-model.moc3
    ├── textures/
    │   └── texture_00.png
    ├── motions/
    │   └── *.motion3.json
    └── expressions/
        └── *.exp3.json
```

## 开发注意事项

1. **模型加载**: 确保 Live2D 模型文件格式正确
2. **性能优化**: 模型纹理不宜过大，建议 2048x2048 以下
3. **交互设计**: 合理设置动作触发频率
4. **窗口管理**: 注意多窗口状态同步

## 故障排除

### 常见问题

1. **模型不显示**: 检查模型文件路径和格式
2. **拖拽无响应**: 确认窗口获得焦点
3. **窗口不透明**: 检查Tauri配置中的透明设置
4. **性能问题**: 调整模型复杂度和渲染频率

### 调试模式

开发环境下会显示调试信息，包括：
- 模型名称和ID
- 当前缩放和位置
- 拖拽状态
- 窗口属性

## 扩展开发

### 添加新的动作

1. 在模型目录下添加 motion3.json 文件
2. 在 `useLive2D.ts` 中注册新的动作组
3. 更新交互逻辑

### 自定义皮肤

1. 修改 `Live2DControls.tsx` 中的样式
2. 使用 Tailwind CSS 类名
3. 支持明暗主题切换

### 多模型支持

1. 扩展 `live2d-loader.ts` 中的模型管理
2. 添加模型选择界面
3. 实现模型切换逻辑

## 许可证

本项目仅用于学习和演示目的。