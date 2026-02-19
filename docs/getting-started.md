# 快速入门

## 项目简介

Reeftotem Assistant 是一个基于 Tauri + React + TypeScript + Live2D 的桌面宠物助手应用，实现类似金山毒霸小狮子的效果，并集成了语音识别、语音合成和 AI 对话功能。

## 功能特性

- Live2D 数字人渲染
- 可拖拽的透明窗口
- 窗口置顶功能
- 交互式动作和表情
- 键盘快捷键支持
- 语音识别 (ASR) 和语音合成 (TTS)
- AI 多模型对话集成
- 右键菜单系统

## 技术栈

- **前端**: React 19 + TypeScript + Tailwind CSS
- **桌面框架**: Tauri 2.x (Rust 后端)
- **UI 组件库**: shadcn/ui
- **Live2D 渲染**: Live2D Cubism SDK + WebGL
- **状态管理**: Zustand
- **语音服务**: 腾讯云 ASR/TTS
- **AI 服务**: Ollama 本地部署
- **构建工具**: Vite 7.x

## 环境要求

- Node.js 20+
- Rust 1.75+
- pnpm 8+
- 支持 WebGL 的现代浏览器

## 安装和运行

### 1. 安装依赖

```bash
pnpm install
```

### 2. 配置环境变量

在项目根目录创建 `.env` 文件：

```env
# 腾讯云语音服务配置
VITE_TENCENT_SECRET_ID=your_secret_id
VITE_TENCENT_SECRET_KEY=your_secret_key
VITE_TENCENT_REGION=ap-beijing
VITE_TENCENT_APP_ID=your_app_id

# AI 服务配置
VITE_AI_PROVIDER=local
VITE_OLLAMA_BASE_URL=http://localhost:11434
VITE_OLLAMA_MODEL=qwen2.5:7b
```

> 详细的腾讯云配置请参考 [腾讯云语音服务配置指南](./guides/tencent-cloud-voice-setup.md)

### 3. 开发模式

```bash
# 启动 Tauri 桌面应用（推荐）
pnpm tauri dev

# 仅启动 Vite 前端开发服务器
pnpm dev
```

### 4. 构建应用

```bash
# 构建前端
pnpm build

# 构建 Tauri 桌面应用
pnpm tauri build
```

## 使用说明

### 基本操作

1. **启动应用**: 运行后在主界面点击 "Open Pet" 打开 Live2D 窗口
2. **拖拽移动**: 点击并拖拽 Live2D 模型到任意位置
3. **交互动作**:
   - 单击模型播放随机动作
   - 双击播放特殊动作并切换表情
   - 悬停触发追踪效果

### 键盘快捷键

| 按键 | 功能 |
|------|------|
| `1` | 切换到普通表情 |
| `2` | 切换到开心表情 |
| `空格` | 播放点击动作 |
| `R` | 重新加载模型 |

### 右键菜单

右键点击 Live2D 角色可访问：
- 透明度滑块控制 (30%-100%)
- 窗口置顶切换
- 窗口位置重置
- 语音交互演示
- 关于对话框
- 退出应用

### 控制面板

主应用提供了完整的控制面板：
- 显示/隐藏 Live2D 窗口
- 切换置顶状态
- 调整模型缩放
- 重置位置
- 查看调试信息

## 窗口配置

Live2D 窗口特性：
- 透明背景，无边框
- 始终置顶（可切换）
- 不可调整大小
- 不在任务栏显示
- 800x1000 像素默认尺寸

## 模型文件

Live2D 模型文件放置在 `public/models/` 目录下：

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

## 项目结构

```
src/
├── components/
│   ├── ChatInterface/      # 主聊天界面
│   ├── Live2D/             # Live2D 组件
│   ├── Voice/              # 语音交互组件
│   └── ui/                 # shadcn/ui 基础组件
├── pages/
│   └── Live2DWindow.tsx    # Live2D 独立窗口页面
├── hooks/                  # 自定义 Hooks
├── stores/                 # Zustand 状态管理
├── lib/
│   ├── live2d/             # Live2D SDK 封装
│   ├── ai/                 # AI 语音服务
│   ├── audio/              # 音频处理
│   └── tauriApi/           # Tauri API 封装
├── utils/                  # 工具函数
└── configs/                # 配置文件

src-tauri/
├── src/                    # Rust 后端代码
├── capabilities/           # 权限配置
└── tauri.conf.json         # Tauri 配置
```

## 开发注意事项

1. **模型加载**: 确保 Live2D 模型文件格式正确
2. **性能优化**: 模型纹理不宜过大，建议 2048x2048 以下
3. **交互设计**: 合理设置动作触发频率
4. **窗口管理**: 注意多窗口状态同步
5. **安全**: 不要在前端代码中硬编码 API 密钥

## 故障排除

| 问题 | 解决方案 |
|------|----------|
| 模型不显示 | 检查模型文件路径和格式 |
| 拖拽无响应 | 确认窗口获得焦点 |
| 窗口不透明 | 检查 Tauri 配置中的透明设置 |
| 性能问题 | 调整模型复杂度和渲染频率 |
| 语音识别失败 | 检查腾讯云配置和网络连接 |

### 调试模式

开发环境下会显示调试信息，包括：
- 模型名称和 ID
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

---

*最后更新: 2026-02-19*
