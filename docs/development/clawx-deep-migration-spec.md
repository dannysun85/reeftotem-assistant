# ClawX → Reeftotem 深度移植规格书

> 基于对 ClawX 全部源码和 Reeftotem 当前实现的逐文件深度扫描，生成于 2026-02-20

---

## 目录

1. [总体差距概览](#1-总体差距概览)
2. [架构差异分析](#2-架构差异分析)
3. [模块级功能对比](#3-模块级功能对比)
4. [Tauri 命令对比 (97 vs ~35)](#4-tauri-命令对比)
5. [Store 对比 (12 vs 4)](#5-store-对比)
6. [页面级功能详细对比](#6-页面级功能详细对比)
7. [缺失模块完整规格](#7-缺失模块完整规格)
8. [分阶段移植计划](#8-分阶段移植计划)

---

## 1. 总体差距概览

### 量化对比

| 维度 | ClawX | Reeftotem | 差距 |
|------|-------|-----------|------|
| **Tauri 命令** | 97 个 | ~35 个 | **缺 62 个** |
| **Zustand Store** | 12 个 | 4 个 (+ 1 stub) | **缺 8 个** |
| **页面路由** | 13 个 | 4 个 | **缺 9 个** |
| **i18n 命名空间** | 12 个 × 3 语言 | 12 个 × 3 语言 | 翻译文件完整，但缺对应 UI |
| **Type 定义文件** | 10 个 | 10 个 | 类型完整，但缺对应实现 |
| **数据文件** | 3 个 (templates) | 0 个 | **缺全部模板数据** |
| **SQLite 数据库** | 2 个 (知识库 + 工作流) | 0 个 | **无本地数据库** |
| **WebSocket 协议** | OpenClaw Protocol v3 | 无 | **无 Gateway 通信** |

### 模块实现状态

| 模块 | Reeftotem 状态 | 完成度 |
|------|---------------|--------|
| AI 聊天 (文字) | 可用，直连 HTTP 流式 | 90% |
| Provider 管理 | 可用，完整 CRUD + API Key | 92% |
| Agent 管理 | 可用，CRUD + 模板 + 导入导出 | 85% |
| Dashboard | 可用，统计卡片 + 快捷操作 | 85% |
| Settings | 可用，外观/语言/Provider/高级 | 90% |
| Live2D / Voice | 可用 (ASR 签名是 stub) | 60% |
| **Knowledge 知识库** | **仅有类型定义和翻译** | **0%** |
| **Workflows 工作流** | **仅有类型定义和翻译** | **0%** |
| **Channels 渠道** | **仅有类型定义和翻译** | **0%** |
| **Skills 技能市场** | **仅有类型定义和翻译** | **0%** |
| **Cron 定时任务** | **仅有类型定义和翻译** | **0%** |
| **Spotlight 快捷窗口** | **仅有类型定义和翻译** | **0%** |
| **Setup 首次向导** | **不存在** | **0%** |
| **Gateway 管理** | **Store 是空 stub** | **5%** |
| **Chat 文件附件** | **不支持** | **0%** |
| **Chat 工具调用显示** | **不支持** | **0%** |
| **Chat Thinking 块** | **不支持** | **0%** |

---

## 2. 架构差异分析

### 2.1 AI 通信路径 — 根本性差异

**ClawX 架构 (Gateway Sidecar)**:
```
Frontend → Tauri invoke → Rust → Gateway RPC (WebSocket) → OpenClaw Node.js → AI Provider API
```
- Gateway 是 Node.js 进程，运行 OpenClaw 框架
- 支持工具调用 (function calling)、思维链 (thinking blocks)、多会话管理
- Channels、Skills、Cron 都在 Gateway 内执行
- 前端通过 Rust WebSocket 客户端与 Gateway 通信

**Reeftotem 架构 (直连 HTTP)**:
```
Frontend → Tauri invoke → Rust → HTTP SSE Stream → AI Provider API
```
- Rust 后端直接调用 Provider HTTP API
- 支持基本流式文字响应
- 不支持工具调用、思维链
- 无 Gateway，无 Sidecar

### 2.2 关键架构决策

**在不引入 Gateway 的情况下可以移植的功能**:
- Knowledge 知识库 — Rust 侧实现 SQLite + 向量搜索 (ClawX 就是 Rust 实现的)
- Workflow 工作流 — Rust 侧实现 DAG 引擎 (ClawX 就是 Rust 实现的)
- Agent 管理 — 已完成
- Provider 管理 — 已完成
- Dashboard — 已完成
- Settings — 已完成

**需要 Gateway 才能实现的功能**:
- Channels 多渠道通信 (Telegram/Discord/WhatsApp 等)
- Skills 技能执行 (Python via uv)
- Cron 定时任务 (通过 Gateway 调度)
- Chat 工具调用 (Tool Use / Function Calling)
- ClawHub 技能市场

**好消息**: ClawX 的 Knowledge 和 Workflow 模块的核心逻辑全部在 Rust 侧实现 (SQLite、向量搜索、DAG 引擎)，不依赖 Gateway，可以直接移植 Rust 代码。

---

## 3. 模块级功能对比

### 3.1 Chat 模块

| 功能 | ClawX | Reeftotem | 状态 |
|------|-------|-----------|------|
| 多会话管理 | session CRUD via Gateway RPC | session 本地 localStorage | 已有 |
| 流式文字显示 | Gateway event → store | Tauri event → store | 已有 |
| Markdown 渲染 | react-markdown + remark-gfm | react-markdown + remark-gfm + rehype-highlight | 已有 (更好) |
| 代码高亮 | 基础 | rehype-highlight | 已有 (更好) |
| 消息复制 | 有 | 有 | 已有 |
| 时间戳显示 | 相对时间 | 相对时间 | 已有 |
| 中止响应 | 有 (gateway:abort) | 有 (ai_chat_abort) | 已有 |
| **文件附件** | 有 (拖拽/粘贴/选择) | **无** | **缺失** |
| **图片预览** | 有 (base64 缩略图) | **无** | **缺失** |
| **工具调用显示** | 有 (ToolCard + ToolStatusBar) | **无** | **缺失** |
| **Thinking 块** | 有 (可折叠) | **无** | **缺失** |
| **Agent 会话过滤** | 有 (按 Agent 过滤会话) | **无** | **缺失** |
| **Knowledge RAG 注入** | 有 (发送前自动检索) | **无** | **缺失** |
| IME 保护 | 有 | 有 | 已有 |
| 语音交互 tab | 无 | 有 (Live2D + TTS/ASR) | Reeftotem 独有 |

**ClawX ChatInput 详细功能** (452 行):
- `invoke('dialog:open')` 打开原生文件选择器
- `invoke('file:stage')` 暂存磁盘文件
- `invoke('file:stageBuffer')` 暂存剪贴板/拖拽文件 (base64)
- 拖放区 (drag-over ring 指示器)
- 剪贴板粘贴 (image/file)
- 附件预览条 (图片缩略图 64x64，文件卡片带图标/名称/大小)
- FileAttachment 接口: `{ id, fileName, mimeType, fileSize, stagedPath, preview, status, error? }`

**ClawX ChatMessage 详细功能** (435 行):
- ThinkingBlock — 解析 `<thinking>` 标签，可展开/折叠
- ToolCard — 展开式工具调用卡片，显示 JSON 输入
- ToolStatusBar — 流式响应时显示工具执行状态列表
- FileCard — 非图片附件显示
- message-utils.ts (213 行):
  - `extractText()` — 清理 Gateway 元数据前缀
  - `extractThinking()` — 提取 thinking 块
  - `extractMediaRefs()` — 提取媒体引用
  - `extractImages()` — 提取 base64 图片
  - `extractToolUse()` — 提取工具调用 (支持 Anthropic 和 OpenAI 两种格式)

### 3.2 Agent 模块

| 功能 | ClawX | Reeftotem | 状态 |
|------|-------|-----------|------|
| Agent CRUD | 9 IPC 命令 | 6 IPC 命令 | 基本已有 |
| 模板选择器 | 6 模板 | 7 模板 | 已有 (更多) |
| 导入/导出 | 剪贴板 JSON | 文件下载/上传 | 已有 (不同方式) |
| 克隆 | 有 | 有 | 已有 |
| 设为默认 | 有 | 有 | 已有 |
| Avatar 选择 | emoji | emoji (24 选) | 已有 |
| Provider 选择 | 有 (下拉) | 有 (下拉) | 已有 |
| Temperature 滑块 | 有 | 有 (0-2, step 0.1) | 已有 |
| **Skill 绑定** | 有 (skillIds 选择器) | **无 UI** | **缺失** |
| **Knowledge 绑定** | 有 (knowledgeBaseIds) | **无 UI** | **缺失** |
| **Channel 绑定** | 有 (channelBindings) | **无 UI** | **缺失** |

### 3.3 Provider 模块

| 功能 | ClawX | Reeftotem | 状态 |
|------|-------|-----------|------|
| Provider CRUD | 12 IPC 命令 | 8 IPC 命令 | 基本已有 |
| API Key 存储 | 独立 JSON + OpenClaw 同步 | 独立 JSON | 已有 |
| Key 掩码显示 | 前4 + 星号 + 后4 | 前5 + 后3 | 已有 |
| Key 验证 | HTTP 测试 | HTTP 测试 | 已有 |
| 默认 Provider | 有 | 有 | 已有 |
| 支持类型 | 13+ 种 | 9 种 | 基本够用 |
| **OpenClaw 同步** | 有 (auth-profiles.json) | **无** | Gateway 依赖 |
| **模型列表获取** | Provider 特定 API | 有 (Ollama + /v1/models) | 已有 |

### 3.4 Settings 模块

| 功能 | ClawX | Reeftotem | 状态 |
|------|-------|-----------|------|
| 主题切换 | 有 | 有 | 已有 |
| 语言切换 | 有 | 有 | 已有 |
| Provider 管理 | 有 (嵌入) | 有 (嵌入) | 已有 |
| 开发者模式 | 有 | 有 | 已有 |
| 关于信息 | 有 | 有 | 已有 |
| **Gateway 状态/控制** | 有 (状态/重启/日志查看器) | **无** | **缺失** |
| **快捷键设置** | 有 (Spotlight 快捷键录制) | **无** | **缺失** |
| **通知设置** | 有 | **无** | **缺失** |
| **自动更新** | 有 (UpdateSettings 组件) | **无** | **缺失** |
| **日志查看器** | 有 (内联日志面板) | **无** | **缺失** |
| **CLI 安装** | 有 (openclaw CLI) | **无** | Gateway 依赖 |
| **Dev Console** | 有 (Gateway Web UI) | **无** | Gateway 依赖 |

---

## 4. Tauri 命令对比

### 4.1 ClawX 命令清单 (97 个)

#### 已在 Reeftotem 实现的 (~35 个)

| 类别 | ClawX 命令 | Reeftotem 对应 | 备注 |
|------|-----------|---------------|------|
| Window | `show_spotlight`, `hide_spotlight` | `show_live2d_window`, `hide_live2d_window` | 不同窗口 |
| App Info | `app_version`, `app_platform` | 内联在 lib.rs | |
| Agent | `agent_list` | `get_agents` | |
| Agent | `agent_create` / `agent_update` | `save_agent` | 合并为 upsert |
| Agent | `agent_delete` | `delete_agent` | |
| Agent | `agent_get_active` | `get_active_agent_id` | |
| Agent | `agent_set_active` | `set_active_agent` | |
| Provider | `provider_list` | `get_providers` | |
| Provider | `provider_save` | `save_provider` | |
| Provider | `provider_delete` | `delete_provider` | |
| Provider | `provider_set_api_key` | `save_api_key` | |
| Provider | `provider_get_api_key` | `get_api_key` | |
| Provider | `provider_delete_api_key` | `delete_api_key` | |
| Provider | `provider_set_default` | `set_default_provider` | |
| Provider | `provider_get_default` | `get_default_provider` | |
| Provider | `provider_validate_key` | `provider_validate_key` | |
| AI | (Gateway RPC chat.send) | `ai_chat_send` | 不同实现方式 |
| AI | (Gateway RPC chat.abort) | `ai_chat_abort` | |

#### 缺失的命令 (~62 个)

**Knowledge 知识库 (21 个)** — ClawX 全部在 Rust 实现:
```
knowledge_list              → 列出所有知识库
knowledge_get               → 获取单个知识库
knowledge_create            → 创建知识库 (+ SQLite)
knowledge_update            → 更新知识库
knowledge_delete            → 删除知识库 (+ SQLite 清理)
knowledge_list_documents    → 列出文档
knowledge_get_document      → 获取单文档
knowledge_create_document   → 创建文档记录
knowledge_update_document   → 更新文档
knowledge_delete_document   → 删除文档
knowledge_refresh_stats     → 刷新统计
knowledge_search            → 语义搜索 (cosine similarity top-5)
knowledge_rag               → 多知识库 RAG 检索
knowledge_remove_document   → 删除文档 + chunks
knowledge_get_watch_status  → 获取文件夹监控状态
knowledge_get_embedding_options → 可用 embedding 模型
knowledge_detect_dimension  → 检测 embedding 维度
knowledge_add_document      → 添加文档 (异步处理管线)
knowledge_add_url           → 添加 URL (抓取 → 处理)
knowledge_reprocess_document → 重新处理文档
knowledge_set_watch_folder  → 设置/取消文件夹监控
```

**知识库管线系统** (Rust 实现):
- 文档解析器: PDF (lopdf), DOCX (zip + quick-xml), 文本文件
- 文本分块器: 滑动窗口 (chunk_size=500, overlap=100)
- Embedding API: POST `{base_url}/embeddings` (batch=32)
- 向量搜索: 纯 Rust cosine similarity (无 sqlite-vec)
- SQLite 表: `knowledge_bases`, `documents`, `chunks` (含 embedding BLOB)
- 进度事件: `knowledge_documentProgress` (parsing→chunking→embedding→storing→done, 0-100%)
- 文件夹监控: `notify` crate FSEvent

**Workflow 工作流 (18 个)** — ClawX 全部在 Rust 实现:
```
workflow_list               → 列出工作流
workflow_get                → 获取单个
workflow_create             → 创建
workflow_update             → 更新
workflow_delete             → 删除
workflow_duplicate          → 克隆
workflow_export             → 导出 JSON
workflow_import             → 导入 JSON
workflow_get_runs           → 获取运行历史
workflow_get_run            → 获取单次运行
workflow_delete_run         → 删除运行记录
workflow_clear_runs         → 清空运行历史
workflow_execute            → 执行工作流 (DAG 引擎)
workflow_cancel             → 取消执行
workflow_register_triggers  → 注册触发器
workflow_unregister_triggers → 注销触发器
workflow_get_templates      → 获取模板
workflow_import_template    → 从模板导入
```

**DAG 执行引擎** (Rust 实现):
- Kahn 算法拓扑排序 → 按层顺序执行
- 验证: 恰好 1 个 Input 节点，至少 1 个 Output 节点，无环
- 节点类型: Input, Output, Agent, Condition, Merge
- Agent 节点: 调用 AI chat (可改为调用 `ai_chat_send` 而非 Gateway RPC)
- Condition 节点: keyword/regex 匹配
- Merge 节点: concat/first/custom 合并
- 取消: AtomicBool flag
- 进度事件: `workflow_stepProgress`
- SQLite 运行记录: `workflow_runs` 表

**触发器系统** (Rust 实现):
- Cron: tokio task + `cron::Schedule`
- 文件变更: `notify::RecommendedWatcher`
- 剪贴板: regex 模式 (轮询未实现)
- 快捷键: Tauri global shortcut

**Gateway 管理 (8 个)**:
```
gateway_status              → 连接状态
gateway_is_connected        → bool
gateway_rpc                 → 通用 RPC 调用
gateway_get_control_ui_url  → Dev Console URL
gateway_health              → 健康检查
gateway_start               → 启动进程
gateway_stop                → 停止进程
gateway_restart              → 重启
```

**Channel 渠道 (8 个)**:
```
channel_save_config          → 保存渠道配置
channel_get_config           → 获取配置
channel_get_form_values      → 获取表单值
channel_delete_config        → 删除配置
channel_list_configured      → 列出已配置渠道
channel_set_enabled          → 启用/禁用
channel_validate             → 验证配置
channel_validate_credentials → 验证凭据 (在线测试)
```

**Cron 定时任务 (6 个)** — 依赖 Gateway RPC:
```
cron_list    → Gateway cron.list
cron_create  → Gateway cron.add
cron_update  → Gateway cron.update
cron_delete  → Gateway cron.remove
cron_toggle  → Gateway cron.update (enabled)
cron_trigger → Gateway cron.run (立即执行)
```

**Skills 技能 (3 个)**:
```
skill_update_config   → 更新技能配置 (API key + env)
skill_get_config      → 获取技能配置
skill_get_all_configs → 获取所有技能配置
```

**Log 日志 (5 个)**:
```
log_read_file    → 读取日志文件尾部
log_get_file_path → 日志文件路径
log_get_dir       → 日志目录
log_list_files    → 列出日志文件
log_get_recent    → 最近日志条目
```

**File/Media (3 个)**:
```
file_stage           → 暂存文件 (路径 → temp)
file_stage_buffer    → 暂存 buffer (base64 → temp)
media_get_thumbnails → 生成缩略图
```

**FileSearch (2 个)**:
```
filesearch_search       → 系统文件搜索
filesearch_read_content → 读取文件内容
```

**OpenClaw (7 个)** — Gateway 依赖:
```
openclaw_status, openclaw_is_ready, openclaw_get_dir,
openclaw_get_config_dir, openclaw_get_skills_dir,
openclaw_get_cli_command, openclaw_install_cli_mac
```

**ClawHub (5 个)** — Gateway 依赖:
```
clawhub_search, clawhub_install, clawhub_uninstall,
clawhub_list, clawhub_open_skill_readme
```

**UV Python (2 个)**:
```
uv_check        → 检查 uv 是否安装
uv_install_all  → 安装 uv + Python 3.12
```

**Dialog/Shell (3 个)**:
```
dialog_open     → 原生文件选择
dialog_message  → 原生确认对话框
shell_open      → 打开文件/URL
```

---

## 5. Store 对比

### 5.1 已实现的 Store (4 个)

| Store | ClawX 代码行 | Reeftotem 代码行 | 缺失功能 |
|-------|-------------|-----------------|----------|
| `chat-store` | ~400 行 | ~345 行 | 文件附件、工具调用、thinking、RAG 注入、Agent 过滤 |
| `agents-store` | ~250 行 | ~150 行 | 基本完整 |
| `providers-store` | ~300 行 | ~200 行 | OpenClaw 同步 |
| `settings-store` | ~200 行 | ~100 行 | Gateway 设置、通知、快捷键 |

### 5.2 缺失的 Store (8 个)

#### `gateway-store` (当前仅 stub, 需完全重写)

**ClawX 实现**:
- 状态: `status: { state, port, pid, connectedAt }`, `error`, `initializing`
- 核心 Actions:
  - `init()` — 调用 `invoke('gateway_start')`，监听 `gateway_statusChanged` 事件
  - `start()` / `stop()` / `restart()` — Gateway 生命周期
  - `checkHealth()` — `invoke('gateway_health')`
  - `rpc(method, params)` — `invoke('gateway_rpc', { method, params })`
- 事件监听: `gateway_statusChanged`, `gateway_error`, `gateway_chatMessage`, `gateway_notification`
- 单例初始化 (防止多次 init)

#### `channels-store` (缺失)

**ClawX 实现**:
- 状态: `channels: Channel[]`, `loading`, `error`
- Actions:
  - `fetchChannels()` — `gateway.rpc('channels.status')`
  - `addChannel(type, config)` — `gateway.rpc('channels.add')`
  - `deleteChannel(type)` — `gateway.rpc('channels.delete')`
  - `connectChannel(type)` — `gateway.rpc('channels.connect')`
  - `disconnectChannel(type)` — `gateway.rpc('channels.disconnect')`
  - `requestQrCode(type)` — `gateway.rpc('channels.requestQr')`
- 依赖 Gateway RPC

#### `knowledge-store` (缺失)

**ClawX 实现**:
- 状态: `knowledgeBases: KB[]`, `currentKB`, `documents`, `searchResults`, `loading`, `error`
- Actions (直接 Tauri invoke, 不依赖 Gateway):
  - `fetchKnowledgeBases()` → `invoke('knowledge_list')`
  - `createKnowledgeBase(config)` → `invoke('knowledge_create')`
  - `updateKnowledgeBase(id, updates)` → `invoke('knowledge_update')`
  - `deleteKnowledgeBase(id)` → `invoke('knowledge_delete')`
  - `fetchDocuments(kbId)` → `invoke('knowledge_list_documents')`
  - `addDocument(kbId, file)` → `invoke('knowledge_add_document')`
  - `addUrl(kbId, url)` → `invoke('knowledge_add_url')`
  - `removeDocument(docId)` → `invoke('knowledge_remove_document')`
  - `reprocessDocument(docId)` → `invoke('knowledge_reprocess_document')`
  - `search(kbId, query)` → `invoke('knowledge_search')`
  - `rag(kbIds, query)` → `invoke('knowledge_rag')`
  - `setWatchFolder(kbId, path)` → `invoke('knowledge_set_watch_folder')`
  - `getEmbeddingOptions()` → `invoke('knowledge_get_embedding_options')`
- 监听事件: `knowledge_documentProgress`

#### `workflow-store` (缺失)

**ClawX 实现**:
- 状态: `workflows[]`, `currentWorkflow`, `runs[]`, `activeRunId`, `loading`, `error`
- Actions (直接 Tauri invoke, 不依赖 Gateway):
  - CRUD: `fetchWorkflows`, `createWorkflow`, `updateWorkflow`, `deleteWorkflow`, `duplicateWorkflow`
  - 导入导出: `exportWorkflow`, `importWorkflow`
  - 执行: `executeWorkflow(id, input)` → `invoke('workflow_execute')`
  - 取消: `cancelExecution(runId)` → `invoke('workflow_cancel')`
  - 运行历史: `fetchRuns(wfId)`, `deleteRun`, `clearRuns`
  - 触发器: `registerTriggers`, `unregisterTriggers`
- 监听事件: `workflow_stepProgress`

#### `skills-store` (缺失, 依赖 Gateway)

**ClawX 实现**:
- 状态: `skills[]`, `searchResults[]`, `loading`, `error`, `searching`, `installing`
- Actions:
  - `fetchSkills()` — Gateway RPC
  - `enableSkill(id)` / `disableSkill(id)` — Gateway RPC
  - `searchSkills(query)` — `invoke('clawhub_search')`
  - `installSkill(slug)` — `invoke('clawhub_install')`
  - `uninstallSkill(slug)` — `invoke('clawhub_uninstall')`

#### `cron-store` (缺失, 依赖 Gateway)

**ClawX 实现**:
- 状态: `jobs[]`, `loading`, `error`
- Actions:
  - `fetchJobs()` → `invoke('cron_list')`
  - `createJob(config)` → `invoke('cron_create')`
  - `updateJob(id, patch)` → `invoke('cron_update')`
  - `deleteJob(id)` → `invoke('cron_delete')`
  - `toggleJob(id, enabled)` → `invoke('cron_toggle')`
  - `triggerJob(id)` → `invoke('cron_trigger')`

#### `spotlight-store` (缺失)

**ClawX 实现**:
- 状态: `visible`, `input`, `response`, `loading`, `clipboardContent`, `sessionKey`
- Actions: `setVisible`, `readClipboard`, `handleChatEvent`, `clearConversation`, `sendMessage`

#### `update-store` (缺失)

**ClawX 实现**:
- 状态: `currentVersion`, `availableVersion`, `downloading`, `progress`, `ready`, `error`
- Actions: `checkForUpdate`, `startDownload`, `installUpdate`, `setAutoDownload`

---

## 6. 页面级功能详细对比

### 6.1 缺失页面完整功能清单

#### Knowledge 知识库页面 (ClawX: 118 行 + 子组件)

**路由**: `/knowledge`, `/knowledge/:id`

**列表视图**:
- 知识库卡片网格 (2/3 列响应式)
- 创建知识库按钮 → KnowledgeEditor 对话框
- 搜索过滤
- 删除确认

**详情视图** (KnowledgeDetail):
- 知识库信息: 名称、描述、embedding 模型、统计数据
- 文档列表: 状态标签 (pending/processing/ready/error)、处理进度条
- 文档上传: 文件选择 + URL 添加
- 语义搜索: 输入查询 → 显示相似文档片段和分数
- 文件夹监控: 设置/取消自动入库路径
- 重新处理文档

**KnowledgeEditor 对话框**:
- 名称、描述
- Embedding 模型选择 (从 `knowledge_get_embedding_options` 获取)
- Chunk size / overlap 配置

#### Workflows 工作流页面 (ClawX: 263+314 行 + 多个子组件)

**路由**: `/workflows`, `/workflows/:id`

**列表视图**:
- 工作流卡片网格 (3 列响应式)
- 创建/导入/模板 按钮
- 搜索过滤
- WorkflowCard: 名称、描述、运行/编辑/克隆/导出/删除

**编辑器视图** (WorkflowEditor, 基于 @xyflow/react):
- **左面板 — 节点面板** (5 种节点可拖拽):
  - InputNode (绿色, LogIn)
  - OutputNode (红色, LogOut)
  - AgentNode (蓝色, Bot)
  - ConditionNode (琥珀色, GitFork)
  - MergeNode (紫色, Merge)
- **中心 — ReactFlow 画布**:
  - 节点拖放创建
  - 边连接
  - MiniMap + Controls + Background dots
  - Delete 键删除
  - 缩放/适配视图
- **右面板 — 配置面板**:
  - NodeConfigPanel: 根据选中节点类型显示不同配置
  - 或 WorkflowRunPanel: 执行时显示运行状态
- **工具栏**: 名称编辑、保存、返回、运行/停止、缩放控制
- **运行历史抽屉**: WorkflowRunHistory
- **模板画廊**: WorkflowTemplateGallery (6 个预置模板)

**节点配置**:
- Agent 节点: Agent 选择器 + promptTemplate ({{input}} 占位)
- Condition 节点: keyword/regex 规则编辑
- Merge 节点: concat/first/custom 策略

#### Channels 渠道页面 (ClawX: 818 行)

**路由**: `/channels`

**统计卡片**: 总渠道数、已连接、未连接
**Gateway 警告横幅**: Gateway 未运行时显示
**已配置渠道网格**: ChannelCard 带状态指示和操作
**可用渠道网格**: 所有 11 种渠道类型 (CHANNEL_META)
- 已配置标记 (绿色)
- 插件标记 (二级)

**添加渠道对话框** (全屏 Modal):
- Step 1: 渠道类型选择网格
- Step 2: 配置表单
  - 已有配置加载 (`channel_get_form_values`)
  - 说明面板 + 文档链接
  - 渠道名称输入
  - 动态配置字段 (text/password + show/hide)
  - 验证按钮 (在线测试凭据)
  - 验证结果显示 (成功+机器人详情 / 错误列表+警告)
  - 保存 & 连接 → 保存配置 + 重启 Gateway

**支持的渠道** (11 种):
Telegram, Discord, WhatsApp, Signal, Feishu, iMessage, Matrix, LINE, MS Teams, Google Chat, Mattermost

#### Skills 技能页面 (ClawX: 1052 行)

**路由**: `/skills`

**两个 Tab**: 已安装 / 技能市场

**已安装 Tab**:
- 搜索栏
- 来源过滤: 全部/内置/市场 (带计数)
- 技能卡片: 启用/禁用 Switch、锁图标(核心)、地球(市场)、拼图(捆绑)
- 卸载市场技能按钮
- 点击打开 SkillDetailDialog
- 打开技能文件夹

**技能市场 Tab**:
- 搜索表单
- MarketplaceSkillCard: 安装/卸载动画按钮、下载量、星级
- 安全提示横幅

**SkillDetailDialog** (全屏 Modal):
- Info Tab: 描述、版本、作者、来源
- Config Tab: API key 字段、环境变量编辑器 (key=value 添加/删除)
- 启用/禁用 Switch
- ClawHub 链接
- 保存配置: `invoke('skill:updateConfig')`

#### Cron 定时任务页面 (ClawX: 725 行)

**路由**: `/cron`

**统计卡片**: 总任务数、活跃、暂停、失败
**Gateway 警告横幅**
**任务列表**: CronJobCard

**CronJobCard**:
- 时钟图标 (启用时绿色)
- 人类可读时间表 (parseCronSchedule)
- 启用/禁用 Switch + 状态 Badge
- 消息预览
- 目标渠道 + 图标
- 最后运行时间/状态
- 下次运行时间
- 错误显示
- 立即运行/编辑/删除按钮

**TaskDialog** (创建/编辑):
- 任务名称
- 消息内容
- 时间表选择: 8 个预设 (每分钟/5m/15m/每小时/每天9am/每天6pm/每周一/每月1号) + 自定义 cron 表达式
- 目标渠道选择器 (已连接渠道网格)
- Discord 频道 ID 字段 (仅 Discord)
- 立即启用开关

#### Spotlight 快捷窗口页面 (ClawX: 133 行 + 子组件)

**路由**: `/spotlight` (独立窗口)

- 毛玻璃效果 (backdrop-blur-xl)
- Framer Motion 入场动画
- SpotlightInput — 搜索/输入栏
- ClipboardBar — 剪贴板内容展示
- SpotlightResponse — AI 回复
- CommandPalette — / 命令面板
- FileSearchPanel — @ 文件搜索
- 每次隐藏时清空对话

#### Setup 首次启动向导 (ClawX: 1596 行)

**路由**: `/setup/*` (6 步向导)

1. **Welcome** — Logo + 语言选择 + 功能列表
2. **Environment Check** — Node.js + OpenClaw + Gateway 检查 (带重试/日志查看)
3. **AI Provider** — Provider 选择器 + API Key + Base URL + 验证
4. **Channel** (可选) — 渠道类型选择 + 配置 + 凭据验证
5. **Installing** — uv + Python + 默认技能安装 (进度条)
6. **Complete** — 摘要 + Get Started

---

## 7. 缺失模块完整规格

### 7.1 Knowledge 模块 (可独立移植, 不依赖 Gateway)

**Rust 侧需要移植的文件**:

| ClawX 源文件 | 用途 | 代码行 |
|-------------|------|--------|
| `commands/knowledge_cmd.rs` | 21 个 Tauri 命令 | ~600 |
| `knowledge_pipeline.rs` | 8 步文档处理管线 | ~300 |
| `embedding.rs` + `embedding_api.rs` | Embedding API 客户端 | ~200 |
| `document_parser.rs` | PDF/DOCX/文本解析 | ~200 |
| `text_chunker.rs` | 滑动窗口分块 | ~100 |
| `web_scraper.rs` | URL 内容抓取 | ~80 |
| `storage/knowledge.rs` | JSON + SQLite 存储 | ~400 |

**新增 Cargo 依赖**:
```toml
rusqlite = { version = "0.31", features = ["bundled"] }
lopdf = "0.33"          # PDF 解析
zip = { version = "2", features = ["deflate-zlib"] }  # DOCX
quick-xml = "0.36"      # DOCX XML
scraper = "0.20"        # Web 抓取
notify = { version = "6", features = ["macos_fsevent"] }  # 文件监控
byteorder = "1"         # f32 序列化
walkdir = "2"           # 目录遍历
```

**SQLite Schema**:
```sql
CREATE TABLE knowledge_bases (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    embedding_model TEXT NOT NULL,
    embedding_dimension INTEGER NOT NULL,
    document_count INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 0,
    total_size INTEGER DEFAULT 0,
    chunk_size INTEGER DEFAULT 500,
    chunk_overlap INTEGER DEFAULT 100,
    watched_folder TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    chunk_count INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE chunks (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    knowledge_base_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata TEXT DEFAULT '{}',
    embedding BLOB
);

CREATE INDEX idx_chunks_kb ON chunks(knowledge_base_id);
CREATE INDEX idx_chunks_doc ON chunks(document_id);
```

**向量搜索**: 纯 Rust cosine similarity 扫描 (从 BLOB 反序列化 f32)

**前端需要**: knowledge-store.ts + KnowledgePage + KnowledgeDetail + KnowledgeEditor + KnowledgeSearch + DocumentUpload

### 7.2 Workflow 模块 (可独立移植, 不依赖 Gateway)

**Rust 侧需要移植的文件**:

| ClawX 源文件 | 用途 | 代码行 |
|-------------|------|--------|
| `commands/workflows_cmd.rs` | 18 个 Tauri 命令 | ~500 |
| `workflow_engine.rs` | DAG 执行引擎 | ~400 |
| `workflow_triggers.rs` | 触发器管理 | ~300 |
| `storage/workflows.rs` | JSON + SQLite 存储 | ~300 |

**新增前端依赖**:
```json
"@xyflow/react": "^12.10.0"
```

**SQLite Schema**:
```sql
CREATE TABLE workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    trigger_type TEXT NOT NULL DEFAULT 'manual',
    trigger_input TEXT,
    started_at INTEGER NOT NULL,
    completed_at INTEGER,
    steps_json TEXT DEFAULT '[]',
    final_output TEXT,
    error TEXT
);
CREATE INDEX idx_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_runs_started_at ON workflow_runs(started_at DESC);
```

**注意**: ClawX 的 Agent 节点通过 Gateway RPC `chat.send` 调用 AI。在 Reeftotem 中需改为调用现有的 `ai_chat_send` + 事件监听。

**前端需要**: workflow-store.ts + WorkflowsPage + WorkflowEditor + 6 个节点组件 + WorkflowRunPanel + WorkflowRunHistory + WorkflowTemplateGallery

### 7.3 数据文件 (缺失)

| 文件 | 内容 | 行数 |
|------|------|------|
| `src/data/agent-templates.ts` | 6 个 Agent 模板 (translator/coder/writer/analyst/tutor/reviewer) | ~78 |
| `src/data/builtin-commands.ts` | 10 个快捷命令 (/translate /summarize /explain /review /optimize 等) | ~116 |
| `src/data/workflow-templates.ts` | 6 个工作流模板 (翻译管线/代码审查/内容创作/研究助手/邮件分类/日报) | ~147 |

---

## 8. 分阶段移植计划

### 优先级排序原则

1. **不依赖 Gateway 的功能优先** — Knowledge 和 Workflow 的核心全在 Rust 侧
2. **用户可见功能优先** — 空白页面是最大痛点
3. **复杂度递增** — 先完成独立模块，再做需要 Gateway 的模块

### Phase 3A: Knowledge 知识库 (不需要 Gateway)

**目标**: 完整的知识库 CRUD + 文档处理 + 语义搜索 + RAG

| 步骤 | 内容 | 文件 |
|------|------|------|
| 3A.1 | Cargo 依赖 + SQLite 初始化 | Cargo.toml, lib.rs |
| 3A.2 | 移植 Rust 知识库存储层 | storage/knowledge.rs |
| 3A.3 | 移植文档解析器 | document_parser.rs |
| 3A.4 | 移植文本分块器 | text_chunker.rs |
| 3A.5 | 移植 Embedding API | embedding.rs, embedding_api.rs |
| 3A.6 | 移植文档处理管线 | knowledge_pipeline.rs |
| 3A.7 | 移植 Web 抓取器 | web_scraper.rs |
| 3A.8 | 注册 21 个 Tauri 命令 | commands/knowledge_cmd.rs, lib.rs |
| 3A.9 | knowledge-store.ts | src/stores/knowledge-store.ts |
| 3A.10 | KnowledgePage + 子组件 | src/pages/Knowledge/ |
| 3A.11 | 路由注册 + Sidebar | App.tsx, Sidebar.tsx |
| 3A.12 | Chat RAG 注入 | chat-store.ts (sendMessage 中注入) |

### Phase 3B: Workflow 工作流 (不需要 Gateway)

**目标**: 完整的 DAG 可视化编辑 + 执行 + 运行历史

| 步骤 | 内容 | 文件 |
|------|------|------|
| 3B.1 | 安装 @xyflow/react | package.json |
| 3B.2 | 移植 Rust 工作流存储 | storage/workflows.rs |
| 3B.3 | 移植 DAG 引擎 | workflow_engine.rs |
| 3B.4 | 移植触发器系统 | workflow_triggers.rs |
| 3B.5 | 注册 18 个 Tauri 命令 | commands/workflows_cmd.rs, lib.rs |
| 3B.6 | workflow-store.ts | src/stores/workflow-store.ts |
| 3B.7 | WorkflowsPage 列表视图 | src/pages/Workflows/index.tsx |
| 3B.8 | WorkflowEditor + 节点 | src/pages/Workflows/WorkflowEditor.tsx + nodes/ |
| 3B.9 | WorkflowRunPanel + History | 子组件 |
| 3B.10 | 工作流模板数据 | src/data/workflow-templates.ts |
| 3B.11 | 路由注册 + Sidebar | App.tsx, Sidebar.tsx |

### Phase 4: Gateway 基础设施 + Channel + Cron

**前提**: 需要打包 OpenClaw Node.js 运行时

| 步骤 | 内容 |
|------|------|
| 4.1 | Rust Gateway 进程管理器 (spawn/stop/restart/health) |
| 4.2 | Rust WebSocket 客户端 (Actor 模式) |
| 4.3 | gateway-store.ts 重写 |
| 4.4 | Channel Rust 命令 (8 个) |
| 4.5 | channels-store.ts |
| 4.6 | ChannelsPage (818 行) |
| 4.7 | Cron Rust 命令 (6 个) |
| 4.8 | cron-store.ts |
| 4.9 | CronPage (725 行) |

### Phase 5: Skills 技能市场

| 步骤 | 内容 |
|------|------|
| 5.1 | ClawHub CLI 集成 |
| 5.2 | Skills Rust 命令 (3 个) |
| 5.3 | skills-store.ts |
| 5.4 | SkillsPage (1052 行) |
| 5.5 | UV Python 环境管理 (2 个命令) |

### Phase 6: Spotlight + Setup + 打磨

| 步骤 | 内容 |
|------|------|
| 6.1 | Spotlight 独立窗口 |
| 6.2 | spotlight-store.ts |
| 6.3 | Setup 首次向导 (1596 行) |
| 6.4 | 自动更新 (update-store.ts) |
| 6.5 | Chat 增强 (文件附件、工具调用、Thinking 块) |
| 6.6 | Settings 补全 (Gateway/快捷键/通知/日志) |
| 6.7 | Dashboard 补全 (Gateway 状态卡片) |
| 6.8 | Log 命令 (5 个) |
| 6.9 | File/FileSearch 命令 (5 个) |

---

## 附录 A: ClawX 完整文件清单

### 页面文件

| 文件 | 行数 | 路由 |
|------|------|------|
| `pages/Dashboard/index.tsx` | 299 | /dashboard |
| `pages/Settings/index.tsx` | 716 | /settings/* |
| `pages/Chat/index.tsx` | 237 | / |
| `pages/Chat/ChatInput.tsx` | 452 | |
| `pages/Chat/ChatMessage.tsx` | 435 | |
| `pages/Chat/ChatToolbar.tsx` | 205 | |
| `pages/Chat/message-utils.ts` | 213 | |
| `pages/Agents/index.tsx` | 251 | /agents |
| `pages/Channels/index.tsx` | 818 | /channels |
| `pages/Skills/index.tsx` | 1052 | /skills |
| `pages/Knowledge/index.tsx` | 118 | /knowledge |
| `pages/Knowledge/KnowledgeCard.tsx` | ~80 | |
| `pages/Knowledge/KnowledgeDetail.tsx` | ~300 | |
| `pages/Knowledge/KnowledgeEditor.tsx` | ~200 | |
| `pages/Knowledge/KnowledgeSearch.tsx` | ~150 | |
| `pages/Knowledge/DocumentUpload.tsx` | ~150 | |
| `pages/Cron/index.tsx` | 725 | /cron |
| `pages/Workflows/index.tsx` | 263 | /workflows |
| `pages/Workflows/WorkflowEditor.tsx` | 314 | /workflows/:id |
| `pages/Workflows/WorkflowCard.tsx` | ~100 | |
| `pages/Workflows/WorkflowEditorToolbar.tsx` | ~80 | |
| `pages/Workflows/WorkflowRunPanel.tsx` | ~120 | |
| `pages/Workflows/WorkflowRunHistory.tsx` | ~100 | |
| `pages/Workflows/WorkflowTriggerEditor.tsx` | ~100 | |
| `pages/Workflows/WorkflowTemplateGallery.tsx` | ~80 | |
| `pages/Workflows/nodes/InputNode.tsx` | ~40 | |
| `pages/Workflows/nodes/OutputNode.tsx` | ~40 | |
| `pages/Workflows/nodes/AgentNode.tsx` | ~60 | |
| `pages/Workflows/nodes/ConditionNode.tsx` | ~60 | |
| `pages/Workflows/nodes/MergeNode.tsx` | ~50 | |
| `pages/Workflows/nodes/NodeConfigPanel.tsx` | ~150 | |
| `pages/Spotlight/index.tsx` | 133 | /spotlight |
| `pages/Spotlight/SpotlightInput.tsx` | ~100 | |
| `pages/Spotlight/SpotlightResponse.tsx` | ~100 | |
| `pages/Spotlight/ClipboardBar.tsx` | ~60 | |
| `pages/Spotlight/CommandPalette.tsx` | ~150 | |
| `pages/Spotlight/FileSearchPanel.tsx` | ~100 | |
| `pages/Setup/index.tsx` | 1596 | /setup/* |

### Rust 后端文件

| 文件 | 命令数 | 代码行 |
|------|--------|--------|
| `commands/agents_cmd.rs` | 9 | ~300 |
| `commands/knowledge_cmd.rs` | 21 | ~600 |
| `commands/workflows_cmd.rs` | 18 | ~500 |
| `commands/gateway_cmd.rs` | 8 | ~300 |
| `commands/channel_cmd.rs` | 8 | ~400 |
| `commands/cron_cmd.rs` | 6 | ~200 |
| `commands/provider_cmd.rs` | 12 | ~500 |
| `commands/skill_cmd.rs` | 3 | ~100 |
| `commands/openclaw_cmd.rs` | 7 | ~200 |
| `commands/log_cmd.rs` | 5 | ~150 |
| `commands/file_cmd.rs` | 3 | ~200 |
| `commands/filesearch_cmd.rs` | 2 | ~100 |
| `commands/uv_cmd.rs` | 2 | ~100 |
| `commands/clawhub_cmd.rs` | 5 | ~200 |
| `commands/chat_cmd.rs` | 1 | ~150 |
| `gateway/client.rs` | — | ~400 |
| `gateway/mod.rs` | — | ~50 |
| `gateway_lifecycle.rs` | — | ~300 |
| `workflow_engine.rs` | — | ~400 |
| `workflow_triggers.rs` | — | ~300 |
| `knowledge_pipeline.rs` | — | ~300 |
| `embedding.rs` + `embedding_api.rs` | — | ~200 |
| `document_parser.rs` | — | ~200 |
| `text_chunker.rs` | — | ~100 |
| `web_scraper.rs` | — | ~80 |
| `secure_storage.rs` | — | ~200 |
| `channel_config.rs` | — | ~300 |
| `openclaw_auth.rs` | — | ~150 |
| `openclaw_paths.rs` | — | ~80 |

---

## 附录 B: ClawX SQLite 数据库详情

### Knowledge Database (`~/.openclaw/knowledge/knowledge.db`)

- **模式**: WAL, busy_timeout=5000ms
- **embedding 存储**: f32 little-endian packed bytes (BLOB)
- **搜索算法**: 全表扫描 cosine similarity (无向量索引)
- **默认 embedding**: text-embedding-3-small, dim=1536
- **batch 大小**: 32 embeddings per request
- **RAG 默认**: top_k=5, score_threshold=0.3, max_context_tokens=4000

### Workflow Runs Database (`~/.openclaw/workflows/runs.db`)

- **模式**: WAL, busy_timeout=5000ms
- **steps_json**: JSON array 序列化存储
- **时间戳**: Unix ms (INTEGER)

---

## 附录 C: 工作量估算

| Phase | 新增 Rust 代码 | 新增前端代码 | 新增依赖 | 预计工作量 |
|-------|--------------|------------|---------|-----------|
| 3A (Knowledge) | ~2000 行 | ~1500 行 | rusqlite, lopdf, zip, quick-xml, scraper, notify, byteorder | 大 |
| 3B (Workflow) | ~1500 行 | ~2000 行 | @xyflow/react, cron | 大 |
| 4 (Gateway+Channel+Cron) | ~1500 行 | ~2500 行 | tokio-tungstenite | 大 |
| 5 (Skills) | ~500 行 | ~1200 行 | — | 中 |
| 6 (Spotlight+Setup+打磨) | ~500 行 | ~3000 行 | framer-motion | 大 |

**总计**: ~6000 行 Rust + ~10000 行前端

---

*生成于 2026-02-20，基于 ClawX 和 Reeftotem 源码逐文件深度扫描*
