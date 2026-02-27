# ClawX → Reeftotem 功能差距分析报告

> 生成日期：2026-02-22
> 对比版本：ClawX v0.2.0 (Tauri) vs Reeftotem Assistant v0.2.0

---

## 一、总体概览

| 维度 | ClawX | Reeftotem | 差距 |
|------|-------|-----------|------|
| 前端页面 | 11 个 | 7 个（+1 占位） | 缺 4 个 |
| Zustand Store | 12 个 | 7 个（1 个 stub） | 缺 5 个 |
| Tauri 命令 | ~123 个 | ~60 个 | 缺 ~63 个 |
| 类型定义 | 11 个 | 12 个 | ✅ 完整 |
| i18n 命名空间 | 12 × 3 语言 | 12 × 3 语言 | ✅ 完整 |
| SQLite 数据库 | 2 个 | 2 个 | ✅ 完整 |
| 数据文件 | 5+ 个 | 5+ 个 | ✅ 完整 |

---

## 二、已完成模块（无需迁移）

### 2.1 Rust 后端 — 全部已实现

| 模块 | 状态 | 说明 |
|------|------|------|
| AI 多模型聊天 | ✅ 完整 | 8 种 Provider，流式+非流式，Anthropic/OpenAI 兼容 |
| Knowledge RAG | ✅ 完整 | 23 条命令，PDF/DOCX/TXT 解析，向量嵌入，余弦相似搜索 |
| Workflow 引擎 | ✅ 完整 | 13 条命令，DAG 拓扑排序，5 节点类型，取消支持 |
| Settings 管理 | ✅ 完整 | Provider/Agent CRUD，API Key 加密存储 |
| 语音服务 | ✅ 完整 | 腾讯云 ASR/TTS，TC3-HMAC-SHA256 签名 |
| 窗口管理 | ✅ 完整 | Live2D 窗口控制，定位，透明度 |
| 边缘检测 | ✅ 完整 | 屏幕边界，拖拽约束，碰撞预测 |
| 托盘菜单 | ✅ 完整 | 动态菜单，12 模型切换 |

### 2.2 前端页面 — 核心页面已实现

| 页面 | 状态 | 行数 | 说明 |
|------|------|------|------|
| ChatPage | ✅ 完整 | 479 | 多会话，流式，TTS/ASR，Markdown |
| AgentsPage | ✅ 完整 | 285+ | CRUD，模板，克隆，导入导出 |
| KnowledgePage | ✅ 完整 | 198+ | 列表/详情视图，文档上传，搜索 |
| WorkflowPage | ✅ 完整 | 275+ | 画布编辑器，模板库，运行历史 |
| DashboardPage | ✅ 完整 | 291 | 统计卡片，快捷操作，实时计时 |
| SettingsPage | ✅ 完整 | 384 | 主题/语言/语音/Provider/开发者模式 |
| Live2DWindow | ✅ 完整 | 310 | Live2D 渲染，操作面板，模型切换 |

### 2.3 前端 Store — 核心 Store 已实现

| Store | 状态 | 行数 | 说明 |
|-------|------|------|------|
| chat-store | ✅ 完整 | 340 | 多会话，实时流式，事件监听 |
| agents-store | ✅ 完整 | 143 | Agent CRUD + 活跃 Agent 管理 |
| providers-store | ✅ 完整 | 139 | 10 种 Provider，API Key 管理 |
| settings-store | ✅ 完整 | 106 | 主题/语言/语音/开发者模式 |
| knowledge-store | ✅ 完整 | 241 | KB CRUD + 文档处理进度监听 |
| workflow-store | ✅ 完整 | 271 | Workflow CRUD + 执行进度追踪 |

### 2.4 基础设施 — 全部就绪

| 模块 | 状态 | 说明 |
|------|------|------|
| 类型定义 (12 文件) | ✅ 完整 | agent, channel, workflow, knowledge, skill, cron, spotlight, gateway, commands 等 |
| i18n (3 语言 × 12 NS) | ✅ 完整 | 中/英/日，覆盖所有模块 |
| Bridge (Tauri IPC) | ✅ 完整 | invoke/on 抽象，通道名标准化 |
| Provider 元数据 | ✅ 完整 | 10 种 Provider 配置和图标 |
| 数据模板 | ✅ 完整 | 6 Agent 模板 + 6 Workflow 模板 + 11 快捷命令 |
| UI 组件库 | ✅ 完整 | shadcn/ui + Tailwind CSS 4 |
| Layout 组件 | ✅ 完整 | MainLayout + Sidebar + Header |
| 通用组件 | ✅ 完整 | ErrorBoundary, LoadingSpinner, StatusBadge |

---

## 三、未实现功能 — 按优先级排序

### P0：Gateway 基础设施（阻塞 Channels/Skills/Cron）

> Gateway 是 OpenClaw 的运行时，负责函数调用、thinking blocks、多渠道消息分发。
> 没有 Gateway，Channels/Skills/Cron 完全无法工作。

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **Rust: Sidecar 进程管理** | `gateway.rs` — spawn/kill/restart Node.js 进程 | ❌ 无 | ~500 行 Rust |
| **Rust: WebSocket RPC 客户端** | `tokio-tungstenite` — JSON-RPC 2.0 协议 | ❌ 无 | ~400 行 Rust |
| **Rust: Gateway 命令** | `start/stop/restart/status/rpc` (5 条) | ❌ 无 | ~200 行 Rust |
| **Rust: 设备认证** | Ed25519 密钥对 + SHA-256 设备 ID | ❌ 无 | ~200 行 Rust |
| **前端: gateway-store** | 完整实现 (WebSocket, health, RPC) | ⚠️ Stub (52 行 no-op) | ~300 行 TS |
| **Settings: Gateway 控制区** | 状态/端口/重启/日志查看 | ❌ 无 | ~150 行 TSX |

**总计**: ~1,750 行

---

### P1：Channels 多渠道消息（需要 Gateway）

> ClawX 支持 11 种消息平台（Telegram, Discord, WhatsApp 等），
> 实现外部消息 → AI 回复 → 回传平台的完整链路。

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **前端: ChannelsPage** | 818 行 — 统计卡片 + 渠道网格 + 添加对话框 + 验证 | ❌ PlaceholderPage | ~800 行 TSX |
| **前端: channels-store** | 完整 CRUD + 状态监控 | ❌ 无 | ~150 行 TS |
| **Rust: Channel 命令** | ~8 条 (list/add/remove/validate/status) | ❌ 无 | ~300 行 Rust |
| **类型定义** | channel.ts (419 行, 11 平台元数据) | ✅ 已有 | 0 |

**总计**: ~1,250 行

**具体缺失功能**:
- 渠道统计卡片（总数/已连接/已断开）
- 11 平台支持（Telegram, Discord, WhatsApp, Signal, Feishu, iMessage, Matrix, LINE, Teams, Google Chat, Mattermost）
- 渠道配置表单生成（按平台不同字段）
- 凭证在线验证
- WhatsApp QR 码流程
- 渠道状态实时监控
- Agent-Channel 绑定

---

### P1：Settings 增强

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| Gateway 控制区 | 状态/端口/重启/日志/自动启动 | ❌ 无 | ~150 行 |
| Spotlight 快捷键设置 | 键盘快捷键录制器 | ❌ 无 | ~100 行 |
| 通知设置 | 系统通知开关 | ❌ 无 | ~30 行 |
| 自动更新设置 | 检查/下载/自动安装 | ❌ 无 | ~80 行 |
| 日志查看器 | 日志文件读取 + 显示 | ❌ 无 | ~60 行 |
| OpenClaw CLI 安装器 | Mac 专用安装脚本 | ❌ 无 | ~50 行 |

**总计**: ~470 行

---

### P2：Skills 技能系统（需要 Gateway）

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **前端: SkillsPage** | 1,052 行 — 已安装/市场双标签 + 详情对话框 + 配置 | ❌ PlaceholderPage | ~1,000 行 TSX |
| **前端: skills-store** | 完整管理 + 市场搜索 + 安装/卸载 | ❌ 无 | ~200 行 TS |
| **Rust: Skill 命令** | ~3 条 (list/enable-disable/config) | ❌ 无 | ~150 行 Rust |
| **类型定义** | skill.ts (54 行) | ✅ 已有 | 0 |

**总计**: ~1,350 行

**具体缺失功能**:
- 已安装技能网格 + 启用/禁用开关
- 市场搜索与发现
- 技能详情对话框（信息 + 配置双标签）
- API Key 和环境变量配置
- 安装/卸载功能
- ClawHub 链接导航
- 技能来源标签（Core, Bundled, User-installed）
- Python 环境管理（uv）

---

### P2：Cron 定时任务（需要 Gateway）

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **前端: CronPage** | 725 行 — 任务卡片 + 创建对话框 + 立即执行 | ❌ PlaceholderPage | ~700 行 TSX |
| **前端: cron-store** | 完整 CRUD + 状态追踪 | ❌ 无 | ~150 行 TS |
| **Rust: Cron 命令** | ~6 条 (list/add/remove/toggle/run/status) | ❌ 无 | ~250 行 Rust |
| **类型定义** | cron.ts (56 行) | ✅ 已有 | 0 |

**总计**: ~1,100 行

**具体缺失功能**:
- 任务统计卡片（总数/活跃/暂停/失败）
- 创建/编辑对话框 + 8 种预设调度
- 自定义 cron 表达式输入
- 目标渠道选择（Discord 需 Channel ID）
- 启用/禁用切换
- 立即运行按钮
- 上次运行状态 + 下次运行时间
- 失败错误显示
- 人类可读 cron 解析器

---

### P3：Spotlight 桌面助手窗口

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **Tauri: Spotlight 窗口配置** | 680×480, 无装饰, 透明, always-on-top | ❌ 无 | ~50 行配置 |
| **前端: SpotlightPage** | 133 行 + 8 子组件 | ❌ 无 | ~800 行 TSX |
| **前端: spotlight-store** | 完整状态 + 剪贴板监控 | ❌ 无 | ~120 行 TS |
| **Rust: 全局快捷键** | `tauri-plugin-global-shortcut` | ❌ 无 | ~100 行 Rust |
| **类型定义** | spotlight.ts (18 行) | ✅ 已有 | 0 |

**总计**: ~1,070 行

**具体缺失功能**:
- 全局热键唤醒（⌃⇧Space）
- 快速输入 + 发送
- 剪贴板内容栏
- 截图按钮
- 命令面板（/ 前缀）
- 文件搜索（@ 前缀）
- Framer Motion 进出动画
- 专属会话路由

---

### P3：Setup 引导向导

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **前端: SetupPage** | 1,596 行 — 6 步向导 + Framer Motion | ❌ 无 | ~1,500 行 TSX |

**总计**: ~1,500 行

**6 步流程**:
1. 欢迎页 — 语言选择 + 功能介绍
2. 运行环境检查 — Node.js / OpenClaw / Gateway 状态
3. AI Provider 配置 — 选择提供商 + API Key 验证
4. 渠道连接（可选） — 选择平台 + 配置 Token
5. 依赖安装 — uv + Python + 默认技能 进度条
6. 完成摘要 — 跳转主页

---

### P3：Chat 增强功能

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| 文件附件支持 | 图片上传 + 预览 | ❌ 无 | ~200 行 |
| Tool Calling 显示 | 工具调用卡片 + 执行状态 | ❌ 无 | ~300 行 |
| Thinking Blocks 显示 | AI 推理过程折叠展示 | ❌ 无 | ~150 行 |
| 情感分析 → Live2D | 关键词实时情感检测 → 表情切换 | ❌ 无 | ~200 行 |

**总计**: ~850 行

---

### P3：Agent 增强功能

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| Skill 绑定 UI | Agent 编辑器中选择技能 | ❌ 无 | ~100 行 |
| Knowledge 绑定 UI | Agent 编辑器中选择知识库 | ❌ 无 | ~100 行 |
| Channel 绑定 UI | Agent 编辑器中选择渠道 | ❌ 无 | ~80 行 |
| Live2D 模型绑定 | Agent 配置 `live2dModel` 字段 | ❌ 无 | ~150 行 |

**总计**: ~430 行

---

### P4：Live2D 深度融合

> 这是 Reeftotem 独有的差异化功能，ClawX 不具备。

| 子项 | 设计文档 | 现状 | 工作量估算 |
|------|---------|------|-----------|
| Chat 情感 → 表情映射 | 每 50 字检测情感 → 切换表情 | ❌ 无 | ~300 行 |
| 渠道消息 → 通知气泡 | 平台消息 → 角色头顶冒泡 | ❌ 无 | ~400 行 |
| RAG 置信度 → 表情 | >0.8 自信, 部分匹配→思考 | ❌ 无 | ~100 行 |
| Workflow 执行 → 状态动画 | 开始→工作中, 完成→庆祝, 失败→难过 | ❌ 无 | ~200 行 |
| Agent 切换 → 模型绑定 | 切换 Agent → 自动切换 Live2D 模型 | ❌ 无 | ~150 行 |
| Cron 提醒 → 通知动画 | 定时任务执行 → 提醒气泡 | ❌ 无 | ~100 行 |

**总计**: ~1,250 行

---

### P4：自动更新

| 子项 | ClawX 实现 | Reeftotem 现状 | 工作量估算 |
|------|-----------|---------------|-----------|
| **前端: update-store** | 检查/下载/安装 | ❌ 无 | ~80 行 |
| **前端: UpdateSettings** | 自动检查/自动下载开关 | ❌ 无 | ~60 行 |
| **Tauri: plugin-updater** | `@tauri-apps/plugin-updater` | ❌ 未配置 | 配置级 |

**总计**: ~140 行 + 插件配置

---

## 四、缺失 Store 清单

| Store | 用途 | 依赖 | 估算行数 |
|-------|------|------|---------|
| `channels-store` | 渠道 CRUD + 状态监控 | Gateway | ~150 |
| `skills-store` | 技能管理 + 市场搜索 + 安装 | Gateway | ~200 |
| `cron-store` | 定时任务 CRUD + 执行 | Gateway | ~150 |
| `spotlight-store` | Spotlight 窗口状态 + 剪贴板 | 全局快捷键 | ~120 |
| `update-store` | 应用更新检查/下载 | plugin-updater | ~80 |

**总计**: ~700 行

---

## 五、缺失 Rust 命令清单

### Gateway 管理（5 条）
```
gateway_start, gateway_stop, gateway_restart,
gateway_status, gateway_rpc
```

### Channel 管理（~8 条）
```
channel_list, channel_add, channel_remove,
channel_update, channel_validate, channel_status,
channel_bind_agent, channel_unbind_agent
```

### Skill 管理（~3 条）
```
skill_list, skill_toggle, skill_update_config
```

### Cron 管理（~6 条）
```
cron_list, cron_add, cron_remove,
cron_toggle, cron_run, cron_status
```

### Spotlight（~2 条）
```
spotlight_show, spotlight_hide
```

### 设备认证（~2 条）
```
device_get_identity, device_sign_challenge
```

### 更新管理（~3 条）
```
update_check, update_download, update_install
```

**总计**: ~29 条新命令

---

## 六、缺失 npm/Cargo 依赖

### npm（前端）
| 包名 | 用途 | 已安装? |
|------|------|---------|
| `@xyflow/react` | Workflow 画布编辑器 | ✅ 检查中 |
| `react-markdown` | Markdown 渲染 | ✅ 已有 |
| `framer-motion` | Spotlight/Setup 动画 | ❌ 需添加 |
| `tauri-plugin-global-shortcut` | 全局快捷键 | ❌ 需添加 |
| `tauri-plugin-updater` | 自动更新 | ❌ 需添加 |

### Cargo（Rust）
| crate | 用途 | 已安装? |
|-------|------|---------|
| `tokio-tungstenite` | Gateway WebSocket | ❌ 需添加 |
| `ed25519-dalek` | 设备认证签名 | ❌ 需添加 |
| `tauri-plugin-shell` | 子进程管理 | ❌ 需添加 |
| `tauri-plugin-global-shortcut` | 全局快捷键 | ❌ 需添加 |
| `tauri-plugin-autostart` | 自动启动 | ❌ 需添加 |

---

## 七、工作量总览

| 优先级 | 模块 | Rust 行数 | 前端行数 | 总计 | 依赖 |
|--------|------|----------|---------|------|------|
| **P0** | Gateway 基础设施 | 1,300 | 450 | **1,750** | 无（阻塞后续） |
| **P1** | Channels 多渠道 | 300 | 950 | **1,250** | Gateway |
| **P1** | Settings 增强 | 0 | 470 | **470** | 部分需 Gateway |
| **P2** | Skills 技能系统 | 150 | 1,200 | **1,350** | Gateway |
| **P2** | Cron 定时任务 | 250 | 850 | **1,100** | Gateway |
| **P3** | Spotlight 桌面助手 | 100 | 920 | **1,070** | 全局快捷键 |
| **P3** | Setup 引导向导 | 0 | 1,500 | **1,500** | Gateway |
| **P3** | Chat 增强 | 0 | 850 | **850** | Gateway(部分) |
| **P3** | Agent 增强 | 0 | 430 | **430** | 对应模块 |
| **P4** | Live2D 深度融合 | 0 | 1,250 | **1,250** | 各模块完成后 |
| **P4** | 自动更新 | 0 | 140 | **140** | plugin-updater |
| — | 缺失 Store | 0 | 700 | **700** | 各自模块 |
| | **总计** | **~2,100** | **~9,710** | **~11,860** | |

---

## 八、推荐实施路线

```
Phase 1 (P0): Gateway 基础设施
  └─ Rust sidecar 管理 + WebSocket RPC + 设备认证
  └─ gateway-store 完整实现
  └─ Settings Gateway 控制区
  └─ 🎯 里程碑: pnpm tauri dev 可以启动 OpenClaw Gateway

Phase 2 (P1): Channels + Chat 增强
  └─ ChannelsPage + channels-store + Rust 命令
  └─ Chat: file attachments + tool calling + thinking blocks
  └─ Agent: skill/knowledge/channel 绑定 UI
  └─ 🎯 里程碑: Telegram 消息可以被 AI 回复

Phase 3 (P2): Skills + Cron
  └─ SkillsPage + skills-store + 市场搜索
  └─ CronPage + cron-store + 定时执行
  └─ 🎯 里程碑: 定时任务 → AI 回复 → 发送到 Telegram

Phase 4 (P3): Spotlight + Setup
  └─ Spotlight 窗口 + 全局快捷键
  └─ Setup 向导 6 步流程
  └─ Settings 完善（通知/更新/日志）
  └─ 🎯 里程碑: 新用户可以从零开始配置

Phase 5 (P4): Live2D 融合 + 打磨
  └─ Chat 情感 → 表情映射
  └─ 渠道通知气泡
  └─ Workflow 状态动画
  └─ Agent → 模型绑定
  └─ 自动更新
  └─ 🎯 里程碑: v1.0.0 发布
```

---

## 九、按模块完成度汇总

```
Chat              ████████████████░░░░  80%  (缺文件附件/Tool Call/Thinking/情感)
Agents            ████████████████░░░░  80%  (缺 Skill/KB/Channel/Live2D 绑定)
Knowledge         ██████████████████░░  90%  (后端完整，前端 RAG 细节待打磨)
Workflows         ██████████████████░░  90%  (后端完整，前端画布基本可用)
Dashboard         ██████████████████░░  90%  (缺 Gateway 状态和渠道统计)
Settings          ████████████████░░░░  75%  (缺 Gateway/通知/更新/日志)
Live2D            ████████████████████  95%  (渲染/操作完整，缺深度融合)
Providers         ████████████████████  95%  (CRUD + Key 管理完整)
i18n              ████████████████████  95%  (3语言12NS完整)
Gateway           ████░░░░░░░░░░░░░░░░  10%  (仅 stub store + 类型定义)
Channels          ██░░░░░░░░░░░░░░░░░░   5%  (仅类型定义)
Skills            ██░░░░░░░░░░░░░░░░░░   5%  (仅类型定义)
Cron              ██░░░░░░░░░░░░░░░░░░   5%  (仅类型定义)
Spotlight         ██░░░░░░░░░░░░░░░░░░   5%  (仅类型定义)
Setup Wizard      ░░░░░░░░░░░░░░░░░░░░   0%
Auto Update       ░░░░░░░░░░░░░░░░░░░░   0%
Live2D 深度融合    ░░░░░░░░░░░░░░░░░░░░   0%  (设计文档完整，代码未开始)
```

**整体完成度**: ~55%（核心功能完整，扩展功能待实现）

---

## 十、关键洞察

### 已有优势
1. **Rust 后端功能完整** — AI/Knowledge/Workflow 全部在 Rust 中实现，不依赖 Gateway
2. **Live2D 是独有卖点** — ClawX 没有虚拟人，Reeftotem 在此领域有差异化
3. **类型和 i18n 就绪** — 所有未实现模块的类型定义和翻译文件已准备好
4. **数据模板完整** — Agent/Workflow 模板、快捷命令、语音选项全部就位

### 关键依赖链
```
Gateway → Channels, Skills, Cron
         → Chat Tool Calling / Thinking Blocks
         → Setup Wizard (环境检查)
Global Shortcut Plugin → Spotlight
All Modules → Live2D 深度融合
```

### 核心决策
- **Gateway 是一切扩展的前提** — 不启动 OpenClaw Gateway，Channels/Skills/Cron 完全无法工作
- **Knowledge/Workflow 独立于 Gateway** — 可以先独立打磨，不受阻塞
- **Live2D 融合应最后做** — 依赖所有模块完成，但 ROI 最高（用户体验差异化）
