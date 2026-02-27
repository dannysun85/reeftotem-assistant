# ClawX 融合总方案

> 将 ClawX (Electron AI Agent 桌面应用) 的全部功能融入 Reeftotem Assistant (Tauri Live2D 数字人助手)

## 1. 两个项目对比

| 维度 | Reeftotem Assistant v0.2.0 | ClawX v0.1.13 |
|------|---------------------------|---------------|
| **桌面框架** | Tauri 2.x (Rust) | Electron 40.x (Node.js) |
| **前端** | React 19 + TypeScript + Vite 7 | React 19 + TypeScript + Vite 7 |
| **UI** | shadcn/ui + Tailwind CSS 4.x | shadcn/ui + Tailwind CSS 3.x |
| **状态管理** | Zustand (1 store) | Zustand (12 stores) |
| **独特能力** | Live2D 数字人、语音 ASR/TTS、口型同步 | OpenClaw AI 代理、多渠道通信、RAG 知识库、DAG 工作流、技能市场 |
| **AI 集成** | 简单 AIService (ollama/openai/anthropic/local) | OpenClaw Gateway (WebSocket JSON-RPC)，流式对话、工具调用、思维链 |
| **窗口** | 双窗口 (main + live2d 浮窗) | 双窗口 (main + spotlight 浮窗) |
| **国际化** | 无 | i18next (en/zh/ja) |
| **路由** | 无 (单页面 ChatInterface) | react-router-dom 9 个页面 |

## 2. 融合后目标架构

```
+----------------------------------------------------------------+
|              Reeftotem Assistant v0.3.0                          |
|           (Tauri 2.x Desktop Application)                       |
|                                                                 |
|  +-----------------------------------------------------------+ |
|  |                 Rust Backend (Tauri)                        | |
|  |  - 窗口管理 (main + live2d + spotlight)                    | |
|  |  - Gateway sidecar 进程管理 (spawn/monitor/restart)       | |
|  |  - Live2D 模型控制事件分发                                 | |
|  |  - 语音服务 ASR/TTS (腾讯云签名在 Rust 侧)               | |
|  |  - 安全存储 (API Key 加密存储)                             | |
|  |  - 系统托盘 + 全局快捷键                                   | |
|  |  - 拖拽 / 屏幕边缘检测                                    | |
|  +-----------------------------+-----------------------------+ |
|                                | invoke() / events               |
|  +-----------------------------v-----------------------------+ |
|  |              React Renderer (主窗口)                       | |
|  |                                                            | |
|  |  路由: react-router-dom                                    | |
|  |  /          → Chat (AI 对话 + 流式 + 工具调用)            | |
|  |  /agents    → Agents (AI 代理人格管理)                     | |
|  |  /knowledge → Knowledge (知识库 & RAG)                     | |
|  |  /workflows → Workflows (DAG 可视化工作流)                 | |
|  |  /channels  → Channels (多渠道通信管理)                    | |
|  |  /skills    → Skills (技能市场 ClawHub)                    | |
|  |  /cron      → Cron (定时任务调度)                          | |
|  |  /dashboard → Dashboard (仪表板总览)                       | |
|  |  /settings  → Settings (Provider/Gateway/高级设置)         | |
|  |  /setup     → Setup (首次启动向导)                         | |
|  |                                                            | |
|  |  布局: TitleBar + Sidebar + MainContent                    | |
|  |  状态: 12 Zustand stores                                   | |
|  |  国际化: i18next (zh/en/ja)                                | |
|  +-----------------------------+-----------------------------+ |
|                                | WebSocket (JSON-RPC)            |
|  +-----------------------------v-----------------------------+ |
|  |           OpenClaw Gateway (Node.js Sidecar)               | |
|  |  - AI 代理运行时 (多模型, 流式, 工具调用)                 | |
|  |  - Cron 调度器                                             | |
|  |  - Channel 集成 (11 平台)                                  | |
|  |  - Chat session 管理                                       | |
|  |  - 技能执行 (Python via uv)                               | |
|  +-----------------------------------------------------------+ |
|                                                                 |
|  +-----------------------------------------------------------+ |
|  |         Live2D 浮窗 (透明 always-on-top)                   | |
|  |  - WebGL 渲染 Cubism SDK                                   | |
|  |  - 表情/动作 ← AI 回复情感分析                            | |
|  |  - 口型同步 ← TTS 音频                                    | |
|  |  - 气泡通知 ← 渠道新消息/工作流状态                       | |
|  |  - 右键菜单 + 拖拽 + 屏幕边缘检测                        | |
|  +-----------------------------------------------------------+ |
|                                                                 |
|  +-----------------------------------------------------------+ |
|  |         Spotlight 浮窗 (全局快捷键唤起)                    | |
|  |  - 快速对话 (复用 Chat 功能)                              | |
|  |  - 剪贴板上下文注入                                        | |
|  |  - 截图识别                                                | |
|  |  - 命令面板 (/ 前缀)                                      | |
|  |  - 文件搜索 (@ 触发)                                      | |
|  +-----------------------------------------------------------+ |
+----------------------------------------------------------------+
```

## 3. 核心设计决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 桌面框架 | **Tauri** (保持) | 更轻量 (相比 Electron 约 1/10 体积)、Rust 性能优势、已有 Live2D/语音/窗口管理基础设施 |
| AI 运行时 | **引入 OpenClaw Gateway** | ClawX 已有成熟的多模型支持、流式对话、工具调用、思维链；重写成本极高 |
| Gateway 通信 | **前端直连 WebSocket** | ClawX 的 bridge.ts Tauri 分支通过 HTTP sidecar 通信，但直接 WebSocket 更高效 |
| Provider 管理 | **Rust 侧安全存储** | Tauri 不支持 `electron-store`，改用 Rust 加密文件存储 API Key |
| 知识库存储 | **Gateway sidecar 处理** | 文档解析/Embedding/向量搜索在 Node.js 侧完成 (better-sqlite3 + sqlite-vec)，前端通过 Gateway RPC 调用 |
| 工作流引擎 | **Gateway sidecar 执行** | DAG 执行依赖 Gateway 的 chat.send RPC，自然放在 sidecar |
| 前端路由 | **引入 react-router-dom** | 已有依赖 (v7.9.3)，需要 10+ 个页面的导航 |
| 国际化 | **引入 i18next** | ClawX 已有完整 zh/en/ja 翻译，代码改动最小化 |
| Live2D | **保持现有双层架构** | `src/live2d/` React 层 + `src/lib/live2d/` SDK 层，已验证稳定 |
| 语音 | **保持 Rust 侧 ASR/TTS** | 腾讯云签名在 Rust 更安全 |
| Tailwind 版本 | **保持 v4.x** | 已配置好，ClawX 的 v3.x 组件需适配（差异很小） |

## 4. 迁移源文件映射

### 4.1 直接复用 (从 ClawX `src/` 复制)

| ClawX 源文件 | 目标位置 | 改动 |
|-------------|----------|------|
| `src/types/*.ts` (10 个) | `src/types/` | 原样复制 |
| `src/stores/agents.ts` | `src/stores/agents.ts` | `invoke` → Tauri `invoke` |
| `src/stores/channels.ts` | `src/stores/channels.ts` | 同上 |
| `src/stores/knowledge.ts` | `src/stores/knowledge.ts` | 同上 |
| `src/stores/workflow.ts` | `src/stores/workflow.ts` | 同上 |
| `src/stores/skills.ts` | `src/stores/skills.ts` | 同上 |
| `src/stores/cron.ts` | `src/stores/cron.ts` | 同上 |
| `src/stores/providers.ts` | `src/stores/providers.ts` | 同上 |
| `src/stores/settings.ts` | `src/stores/settings.ts` | 合并现有设置 |
| `src/stores/gateway.ts` | `src/stores/gateway.ts` | WebSocket 客户端改为前端直连 |
| `src/stores/spotlight.ts` | `src/stores/spotlight.ts` | 同上 |
| `src/stores/update.ts` | `src/stores/update.ts` | Tauri 自动更新替代 electron-updater |
| `src/data/*.ts` (3 个) | `src/data/` | 原样复制 |
| `src/i18n/` | `src/i18n/` | 原样复制，增加 Live2D 相关翻译 |
| `src/components/common/*.tsx` (3 个) | `src/components/common/` | 原样复制 |
| `src/components/settings/*.tsx` (2 个) | `src/components/settings/` | `invoke` 适配 |
| `src/assets/providers/` | `src/assets/providers/` | 原样复制 |
| `src/lib/providers.ts` | `src/lib/providers.ts` | 原样复制 |

### 4.2 需要重写的模块

| 模块 | 原因 | 策略 |
|------|------|------|
| `src/stores/chat.ts` | ClawX 依赖 Electron IPC，需改为前端直连 Gateway WebSocket | 基于 ClawX 重写，添加 Live2D 情感联动 |
| `src/lib/bridge.ts` | Tauri 模式下路由不同 | 简化为纯 Tauri invoke/listen 封装 |
| Gateway 管理 | ClawX 在 Electron main 进程管理 | 迁移到 Rust `src-tauri/src/gateway.rs` |
| Provider 安全存储 | ClawX 用 electron-store | Rust 侧实现 `src-tauri/src/provider.rs` |

### 4.3 新增模块

| 模块 | 用途 |
|------|------|
| `src/lib/gateway/client.ts` | 前端 WebSocket Gateway 客户端 |
| `src/lib/gateway/protocol.ts` | JSON-RPC 协议类型 (从 ClawX 移植) |
| `src/lib/emotion/analyzer.ts` | AI 回复情感分析 → Live2D 表情映射 |
| `src-tauri/src/gateway.rs` | Rust 侧 sidecar 进程管理 |
| `src-tauri/src/provider.rs` | Rust 侧 API Key 安全存储 |

## 5. 页面路由设计

```
/                  → ChatPage              (默认页)
/agents            → AgentsPage
/knowledge         → KnowledgePage         (列表)
/knowledge/:id     → KnowledgePage         (详情)
/workflows         → WorkflowsPage         (列表)
/workflows/:id     → WorkflowsPage         (编辑器)
/channels          → ChannelsPage
/skills            → SkillsPage
/cron              → CronPage
/dashboard         → DashboardPage
/settings/*        → SettingsPage
/setup/*           → SetupPage             (首次启动向导，无 Sidebar)
/spotlight         → SpotlightPage         (独立窗口，无 Sidebar)
/live2d-window     → Live2DWindow          (独立窗口，保持现有)
```

详细的页面迁移指南见: [页面迁移详细指南](./page-migration-guide.md)

## 6. 实施路线图

### Phase 1: 基础设施 (第 1 周)

| # | 任务 | 详情 |
|---|------|------|
| 1.1 | Rust 侧 Gateway sidecar 管理 | `gateway.rs`: spawn/stop/restart OpenClaw 子进程，WebSocket 端口 18789 |
| 1.2 | Rust 侧 Provider 安全存储 | `provider.rs`: CRUD API Key，写入 `~/.openclaw/auth-profiles.json` |
| 1.3 | 前端 Gateway WebSocket 客户端 | `src/lib/gateway/client.ts`: 连接/断线重连/RPC/事件分发 |
| 1.4 | 前端 Bridge 适配层 | `src/lib/bridge.ts`: 统一 Tauri invoke + Gateway RPC 调用接口 |
| 1.5 | 多页面路由 + Layout 组件 | `App.tsx` 路由配置 + `MainLayout` + `Sidebar` + `TitleBar` |
| 1.6 | i18n 初始化 | 引入 i18next，迁移 ClawX 翻译文件 |
| 1.7 | Zustand stores 迁移 | 迁移 12 个 store，适配 Tauri 调用方式 |

### Phase 2: AI 对话系统 (第 2 周)

| # | 任务 | 详情 |
|---|------|------|
| 2.1 | Chat store 重写 | 基于 ClawX，支持流式/工具调用/思维链/会话管理 |
| 2.2 | Chat 页面迁移 | ChatMessage + ChatInput + ChatToolbar + 流式渲染 |
| 2.3 | Agent 系统 | 多代理人格，模板，CRUD |
| 2.4 | Provider 管理 UI | ProvidersSettings 组件迁移 |
| 2.5 | 情感分析引擎 | AI 回复 → 情感标签 → Live2D 表情/动作 |
| 2.6 | 语音 + Live2D 联动 | 流式回复 → TTS → 口型同步 + 表情联动 |

### Phase 3: 知识库 & RAG (第 3 周)

| # | 任务 | 详情 |
|---|------|------|
| 3.1 | Knowledge store 迁移 | CRUD 知识库/文档，处理进度跟踪 |
| 3.2 | Knowledge 页面迁移 | 列表 + 详情 + 文档上传 + 语义搜索 |
| 3.3 | RAG 注入流程 | 对话发送前自动检索知识上下文 |
| 3.4 | 文件夹监控 | chokidar 自动入库 (通过 Gateway) |

### Phase 4: 多渠道通信 (第 4 周)

| # | 任务 | 详情 |
|---|------|------|
| 4.1 | Channels store 迁移 | 渠道 CRUD + 状态监听 |
| 4.2 | Channels 页面迁移 | 渠道卡片 + 添加向导 + WhatsApp QR |
| 4.3 | Live2D 渠道通知 | 新消息 → 数字人气泡提示 + 动画 |

### Phase 5: 工作流引擎 (第 4-5 周)

| # | 任务 | 详情 |
|---|------|------|
| 5.1 | Workflow store 迁移 | CRUD + 执行 + 运行历史 |
| 5.2 | Workflow 页面迁移 | DAG 编辑器 (@xyflow/react) + 模板画廊 |
| 5.3 | 触发器系统 | cron/文件变更/剪贴板/快捷键触发 |
| 5.4 | Live2D 工作流联动 | 执行状态 → 数字人动画反馈 |

### Phase 6: 技能市场 & Cron (第 5 周)

| # | 任务 | 详情 |
|---|------|------|
| 6.1 | Skills store + 页面 | ClawHub 搜索/安装/卸载 |
| 6.2 | Cron store + 页面 | 定时任务 CRUD + 立即执行 |
| 6.3 | uv/Python 环境管理 | 技能运行所需的 Python 环境 |

### Phase 7: 辅助功能 & 打磨 (第 6 周)

| # | 任务 | 详情 |
|---|------|------|
| 7.1 | Setup 首次启动向导 | 6 步向导: 语言/运行时/Provider/Channel/技能/完成 |
| 7.2 | Dashboard 仪表板 | 统计卡片 + 快捷操作 + 活跃状态 |
| 7.3 | Spotlight 快捷窗口 | 全局快捷键 + 浮窗对话 + 剪贴板/截图 |
| 7.4 | Settings 完整设置 | 外观/Provider/Gateway/快捷键/更新/高级/开发者 |
| 7.5 | 自动更新 | Tauri 原生更新替代 electron-updater |

## 7. 依赖变更

### 新增 npm 依赖

```json
{
  "openclaw": "^2026.2.6",
  "@xyflow/react": "^12.10.0",
  "react-markdown": "^10.0.0",
  "remark-gfm": "^4.0.0",
  "i18next": "^25.0.0",
  "react-i18next": "^16.0.0",
  "framer-motion": "^12.0.0"
}
```

### 新增 Cargo 依赖

```toml
tauri-plugin-shell = "2.2.0"        # sidecar 进程管理
tauri-plugin-global-shortcut = "2"   # 全局快捷键 (Spotlight)
tauri-plugin-autostart = "2"         # 开机自启
```

### 可移除

```
src/lib/ai/AIService.ts              # 替换为 Gateway RPC
```

## 8. 风险评估

| 风险 | 级别 | 缓解措施 |
|------|------|---------|
| Gateway sidecar 启动慢 | 中 | 启动页 loading + 健康检查轮询 + 自动重启 |
| Gateway 内存占用 | 中 | 懒启动 (仅在需要 AI 功能时)，配置内存上限 |
| Tailwind v3→v4 差异 | 低 | ClawX 组件 class 语法大部分兼容，少量调整 |
| OpenClaw npm 包体积 | 中 | 作为 sidecar 外部进程，不进入前端 bundle |
| sqlite-vec 原生模块 | 中 | 在 Gateway sidecar 中运行，无需 Rust 重新编译 |
| Live2D 与新 UI 交互 | 低 | 保持现有 Tauri event 机制不变 |

## 9. 不做的事

- **不迁移** Electron 主进程代码 (`electron/main/`) — 用 Rust 替代
- **不迁移** `electron-store` — 用 Tauri Rust 安全存储替代
- **不迁移** `electron-updater` — 用 Tauri 原生更新替代
- **不迁移** WhatsApp baileys 库 — 通过 Gateway sidecar 处理
- **不降级** Tailwind CSS v4 → v3 — 适配 ClawX 组件到 v4
- **不删除** 现有 Live2D/Voice 代码 — 保持并增强

---

*最后更新: 2026-02-20*
