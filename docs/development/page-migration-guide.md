# ClawX 页面迁移详细指南

> 逐页面描述从 ClawX 迁移到 Reeftotem Assistant 的具体步骤

## 总览

ClawX 共有 11 个页面/视图，加上 Reeftotem 独有的 Live2D 浮窗，融合后共 12 个视图。

| # | 路由 | 页面 | 来源 | 优先级 |
|---|------|------|------|--------|
| 1 | `/` | Chat | ClawX (重写) | P0 |
| 2 | `/agents` | Agents | ClawX (迁移) | P0 |
| 3 | `/knowledge`, `/knowledge/:id` | Knowledge | ClawX (迁移) | P1 |
| 4 | `/channels` | Channels | ClawX (迁移) | P1 |
| 5 | `/workflows`, `/workflows/:id` | Workflows | ClawX (迁移) | P2 |
| 6 | `/skills` | Skills | ClawX (迁移) | P2 |
| 7 | `/cron` | Cron | ClawX (迁移) | P2 |
| 8 | `/dashboard` | Dashboard | ClawX (迁移) | P3 |
| 9 | `/settings/*` | Settings | ClawX (迁移) | P1 |
| 10 | `/setup/*` | Setup Wizard | ClawX (迁移) | P1 |
| 11 | `/spotlight` | Spotlight | ClawX (迁移) | P3 |
| 12 | `/live2d-window.html` | Live2D Window | Reeftotem (保留) | - |

---

## 布局迁移

### MainLayout

**源文件**: `ClawX/src/components/layout/MainLayout.tsx`

```
+------------------------------------------+
|              TitleBar (40px)              |
+--------+---------------------------------+
|        |                                 |
| Sidebar|         Main Content            |
| (64/   |         <Outlet />              |
|  256px)|                                 |
|        |                                 |
+--------+---------------------------------+
```

**适配要点**:
- Tauri macOS 使用 `decorations: true`，TitleBar 改为仅在 Windows/Linux 显示
- macOS 需设置 `titleBarStyle: "hiddenInset"` 或保留原有 `decorations: true`
- 添加 `.drag-region` / `.no-drag` CSS 到全局样式

### Sidebar

**源文件**: `ClawX/src/components/layout/Sidebar.tsx`

**导航项**:

| 图标 | 标签 | 路由 | Badge |
|------|------|------|-------|
| MessageSquare | Chat | `/` | - |
| Users | Agents | `/agents` | - |
| BookOpen | Knowledge | `/knowledge` | - |
| GitBranch | Workflows | `/workflows` | - |
| Clock | Cron Tasks | `/cron` | - |
| Puzzle | Skills | `/skills` | - |
| Radio | Channels | `/channels` | - |
| LayoutDashboard | Dashboard | `/dashboard` | - |
| Settings | Settings | `/settings` | - |

**适配要点**:
- 折叠状态持久化到 `useSettingsStore.sidebarCollapsed`
- Dev Console 链接仅 `devModeUnlocked` 时显示
- lucide-react 图标已在项目依赖中

### TitleBar

**源文件**: `ClawX/src/components/layout/TitleBar.tsx`

**适配要点**:
- macOS: Tauri 已处理窗口控制按钮，TitleBar 仅需渲染拖拽区域
- Windows/Linux: 需要自定义 minimize/maximize/close 按钮
- Tauri 命令: `invoke('window:minimize')` 等需映射到 `appWindow.minimize()`

---

## 页面详细迁移

### 1. Chat 页面 (P0)

**源文件**: `ClawX/src/pages/Chat/index.tsx`

**子组件**:

| 组件 | 功能 |
|------|------|
| `ChatToolbar` | 会话切换器 + 新建会话 + 思维链开关 + 刷新 + Agent 过滤 |
| `ChatMessage` | 消息气泡: Markdown 渲染 + 图片 + 思维链块 + 工具调用卡片 |
| `ChatInput` | 文本输入 + 文件附件 + 发送/停止按钮 |
| `WelcomeScreen` | 无消息时的欢迎页 |
| `TypingIndicator` | 等待首个 token 时的打字动画 |
| `message-utils.ts` | `extractText`, `extractThinking`, `extractToolUse`, `extractImages` |

**Store**: `useChatStore`

```typescript
interface ChatStore {
  messages: Message[];
  loading: boolean;
  sending: boolean;
  error: string | null;
  streamingMessage: string | null;
  streamingTools: ToolCall[];
  showThinking: boolean;
  thinkingLevel: 'normal' | 'extended';
  sessions: Session[];
  currentSessionKey: string;
  activeRunId: string | null;
  agentSessionFilter: boolean;

  // Actions
  sendMessage(text: string, options?: SendOptions): Promise<void>;
  abortRun(): void;
  loadSessions(): Promise<void>;
  switchSession(key: string): void;
  newSession(): Promise<void>;
  loadHistory(): Promise<void>;
  toggleThinking(): void;
  handleChatEvent(event: ChatEvent): void;
  clearError(): void;
  refresh(): void;
}
```

**Reeftotem 增强**:
- 发送消息后触发情感分析 → Live2D 表情
- 流式回复完成后触发 TTS → 口型同步
- 工具调用开始时触发 Live2D "思考" 动画
- 集成现有 Voice 组件 (ASR 录音按钮)

**依赖**: `react-markdown`, `remark-gfm`

---

### 2. Agents 页面 (P0)

**源文件**: `ClawX/src/pages/Agents/index.tsx`

**子组件**:

| 组件 | 功能 |
|------|------|
| `AgentCard` | 代理卡片: 头像(emoji) + 名称 + 描述 + 操作菜单 |
| `AgentEditor` | 编辑器 Dialog: 名称/描述/系统提示/模型/温度/技能绑定/知识库绑定 |
| `AgentTemplateSelector` | 模板选择 Dialog: 6 个预设模板 (translator/coder/writer/analyst/tutor/reviewer) |

**Store**: `useAgentStore`

```typescript
interface AgentStore {
  agents: AgentConfig[];
  activeAgentId: string;
  loading: boolean;
  error: string | null;

  fetchAgents(): Promise<void>;
  createAgent(agent: Partial<AgentConfig>): Promise<void>;
  updateAgent(id: string, updates: Partial<AgentConfig>): Promise<void>;
  deleteAgent(id: string): Promise<void>;
  setActiveAgent(id: string): void;
  cloneAgent(id: string): Promise<void>;
  exportAgent(id: string): Promise<string>;
  importAgent(json: string): Promise<void>;
}
```

**类型**: `src/types/agent.ts`

```typescript
interface AgentConfig {
  id: string;
  name: string;
  avatar: string;           // emoji
  description: string;
  systemPrompt: string;
  providerId: string | null;
  model: string;
  temperature: number;
  maxTokens: number | null;
  skillIds: string[];
  knowledgeBaseIds: string[];
  channelBindings: string[];
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}
```

**Reeftotem 增强**:
- Agent 可绑定 Live2D 模型 (新增 `live2dModel` 字段)
- 切换 Agent 时自动切换数字人模型和性格表现

**适配**: `invoke('agent:*')` → Tauri `invoke('agent_*')` (Rust 命名下划线)

---

### 3. Knowledge 页面 (P1)

**源文件**: `ClawX/src/pages/Knowledge/index.tsx`

**视图模式**:
- 列表视图 (`/knowledge`): 知识库卡片网格
- 详情视图 (`/knowledge/:id`): 文档管理 + 语义搜索

**子组件**:

| 组件 | 功能 |
|------|------|
| `KnowledgeCard` | 知识库卡片: 名称/描述/文档数/操作 |
| `KnowledgeEditor` | 创建/编辑 Dialog: 名称/描述/Embedding 模型/Chunk 大小/监控文件夹 |
| `KnowledgeDetail` | 详情面板: 文档列表 + 上传 + URL 添加 + 语义搜索 |
| `DocumentUpload` | 文件选择器 (PDF/TXT/MD/DOCX/CSV) |
| `KnowledgeSearch` | 搜索输入 + RAG 结果列表 (内容/文档名/分数) |

**Store**: `useKnowledgeStore`

```typescript
interface KnowledgeStore {
  knowledgeBases: KnowledgeBase[];
  currentKBId: string | null;
  documents: KnowledgeDocument[];
  loading: boolean;
  error: string | null;
  searchResults: RAGResult[];
  searchQuery: string;
  searching: boolean;
  embeddingOptions: EmbeddingOption[];

  fetchKnowledgeBases(): Promise<void>;
  createKnowledgeBase(kb: Partial<KnowledgeBase>): Promise<void>;
  updateKnowledgeBase(id: string, updates: Partial<KnowledgeBase>): Promise<void>;
  deleteKnowledgeBase(id: string): Promise<void>;
  fetchDocuments(kbId: string): Promise<void>;
  addDocuments(kbId: string, filePaths: string[]): Promise<void>;
  addUrl(kbId: string, url: string): Promise<void>;
  removeDocument(kbId: string, docId: string): Promise<void>;
  searchKB(kbId: string, query: string): Promise<void>;
  setWatchFolder(kbId: string, folderPath: string): Promise<void>;
}
```

**Gateway RPC**:
- 知识库 CRUD: 通过 Tauri 命令 → Gateway sidecar
- 文档处理管道: `parse → chunk → embed → sqlite-vec` 在 sidecar 完成
- RAG 检索: `knowledge:rag` IPC → sidecar 执行向量搜索

---

### 4. Channels 页面 (P1)

**源文件**: `ClawX/src/pages/Channels/index.tsx`

**子组件**:

| 组件 | 功能 |
|------|------|
| `ChannelCard` | 渠道卡片: 图标/名称/状态/删除 |
| `AddChannelDialog` | 多步骤添加: 类型选择 → 配置表单 (或 WhatsApp QR) → 验证 → 保存 |
| `ConfigField` | 动态表单字段 (text/password/select) |

**支持 11 个渠道**:

| 渠道 | 连接方式 | 特殊处理 |
|------|----------|---------|
| WhatsApp | QR 扫码 | baileys 库, IPC 事件流 |
| Telegram | Bot Token | - |
| Discord | Bot Token + Guild ID | 可选 Channel ID |
| Signal | Phone Number | - |
| Feishu/Lark | App ID + Secret | Plugin 模式 |
| iMessage | Server URL + Password | - |
| Matrix | Homeserver + Access Token | Plugin 模式 |
| LINE | Channel Access Token + Secret | Plugin 模式 |
| MS Teams | App ID + Password | Plugin 模式 |
| Google Chat | Service Account Key | Webhook 模式 |
| Mattermost | Server URL + Bot Token | Plugin 模式 |

**Store**: `useChannelsStore`

**Reeftotem 增强**:
- 新消息事件触发 Live2D 通知动画
- 数字人气泡显示 "XX 平台有新消息"

---

### 5. Workflows 页面 (P2)

**源文件**: `ClawX/src/pages/Workflows/index.tsx`

**视图模式**:
- 列表视图 (`/workflows`): 工作流卡片网格
- 编辑器视图 (`/workflows/:id`): 全页面 DAG 编辑器

**子组件**:

| 组件 | 功能 |
|------|------|
| `WorkflowCard` | 卡片: 名称/描述/节点数/操作 (运行/复制/导出/删除) |
| `WorkflowEditor` | @xyflow/react 节点图编辑器 |
| `WorkflowEditorToolbar` | 编辑器工具栏: 保存/运行/历史 |
| `WorkflowRunHistory` | 运行历史列表 |
| `WorkflowRunPanel` | 实时执行面板 (节点进度) |
| `WorkflowTemplateGallery` | 模板选择 Dialog (6 个预设模板) |
| `WorkflowTriggerEditor` | 触发器配置 (cron/文件/剪贴板/快捷键) |
| `nodes/*` | 各节点类型组件 (input/agent/condition/merge/output) |

**节点类型**:

| 类型 | 功能 | 配置 |
|------|------|------|
| `input` | 工作流输入 | 初始文本 |
| `agent` | AI 代理处理 | agentId, systemPrompt |
| `condition` | 条件分支 | keyword/regex 规则 |
| `merge` | 合并分支 | concat/first/custom 策略 |
| `output` | 工作流输出 | 输出标签 |

**依赖**: `@xyflow/react ^12.10.0`

**Store**: `useWorkflowStore`

**Reeftotem 增强**:
- 工作流执行时 Live2D 显示 "工作中" 动画
- 各步骤完成时 Live2D 表情变化
- 全部完成时 "庆祝" 动作

---

### 6. Skills 页面 (P2)

**源文件**: `ClawX/src/pages/Skills/index.tsx`

**两个标签页**:
- **Installed**: 已安装技能列表 + 搜索/过滤 + 启用/禁用/卸载 + 配置 (API Key/环境变量)
- **Marketplace**: ClawHub 市场搜索 + 安装/卸载

**子组件**:

| 组件 | 功能 |
|------|------|
| `SkillDetailDialog` | 技能详情 (Info + Config 标签页) |
| `MarketplaceSkillCard` | 市场技能卡片 + 安装按钮 |

**Store**: `useSkillsStore`

```typescript
interface SkillsStore {
  skills: Skill[];
  searchResults: MarketplaceSkill[];
  loading: boolean;
  searching: boolean;
  installing: Record<string, boolean>; // slug → loading
  error: string | null;

  fetchSkills(): Promise<void>;
  enableSkill(id: string): Promise<void>;
  disableSkill(id: string): Promise<void>;
  searchSkills(query: string): Promise<void>;
  installSkill(slug: string): Promise<void>;
  uninstallSkill(slug: string): Promise<void>;
}
```

---

### 7. Cron 页面 (P2)

**源文件**: `ClawX/src/pages/Cron/index.tsx`

**子组件**:

| 组件 | 功能 |
|------|------|
| `CronJobCard` | 任务卡片: 名称/调度/消息预览/上次运行/下次运行/开关/操作 |
| `TaskDialog` | 创建/编辑 Dialog: 名称/消息/调度 (8 个预设 + 自定义 cron)/目标渠道/启用 |

**调度预设**:

| 预设 | Cron 表达式 |
|------|------------|
| Every 5 minutes | `*/5 * * * *` |
| Every 15 minutes | `*/15 * * * *` |
| Every 30 minutes | `*/30 * * * *` |
| Every hour | `0 * * * *` |
| Every 6 hours | `0 */6 * * *` |
| Daily at 9 AM | `0 9 * * *` |
| Weekly Monday | `0 9 * * 1` |
| Monthly 1st | `0 9 1 * *` |

**Store**: `useCronStore`

---

### 8. Dashboard 页面 (P3)

**源文件**: `ClawX/src/pages/Dashboard/index.tsx`

**内容**:
- 4 个统计卡片: Gateway 状态 (端口/PID), 已连接渠道数, 启用技能数, 在线时长
- 快捷操作网格: 添加渠道, 浏览技能, 打开聊天, 设置, Dev Console
- 最近活动: Top 5 渠道 + 活跃技能列表

**Store**: `useGatewayStore`, `useChannelsStore`, `useSkillsStore`, `useSettingsStore`

---

### 9. Settings 页面 (P1)

**源文件**: `ClawX/src/pages/Settings/index.tsx`

**配置卡片**:

| 卡片 | 内容 |
|------|------|
| Appearance | 主题 (Light/Dark/System) + 语言选择 |
| AI Providers | ProvidersSettings 组件 (Provider CRUD + API Key 管理 + 默认设置) |
| Gateway | 状态 + 重启 + 日志查看 + 自动启动开关 |
| Desktop Assistant | Spotlight 快捷键录制 + 通知开关 |
| Updates | 检查更新 + 下载 + 安装 + 自动检查/下载开关 |
| Advanced | Dev Mode 开关 |
| Developer | Gateway Dev Console + Token + OpenClaw CLI (仅 dev mode) |
| About | 版本 + 链接 |

**Store**: `useSettingsStore` (persist to localStorage)

```typescript
interface SettingsStore {
  theme: 'light' | 'dark' | 'system';
  language: string;
  startMinimized: boolean;
  launchAtStartup: boolean;
  gatewayAutoStart: boolean;
  gatewayPort: number;
  updateChannel: 'stable' | 'beta';
  autoCheckUpdate: boolean;
  autoDownloadUpdate: boolean;
  enableNotifications: boolean;
  sidebarCollapsed: boolean;
  devModeUnlocked: boolean;
  setupComplete: boolean;

  // Actions
  setTheme(theme: string): void;
  setLanguage(lang: string): void;
  setSidebarCollapsed(collapsed: boolean): void;
  setDevModeUnlocked(unlocked: boolean): void;
  markSetupComplete(): void;
  resetSettings(): void;
}
```

---

### 10. Setup 首次启动向导 (P1)

**源文件**: `ClawX/src/pages/Setup/index.tsx`

**6 步流程 (Framer Motion 动画过渡)**:

| 步骤 | 标题 | 内容 |
|------|------|------|
| 0 | Welcome | Logo + 功能列表 + 语言选择 |
| 1 | Runtime Check | 检查 Node.js + OpenClaw + Gateway; "Start Gateway" 按钮 |
| 2 | AI Provider | 选择 Provider 类型 + API Key + 验证 |
| 3 | Channel (可跳过) | 选择渠道类型 + 配置 + 验证 |
| 4 | Installing | 自动安装默认技能 (opencode/python-env/code-assist/file-tools/terminal) |
| 5 | Complete | 汇总已配置项 → 跳转 `/` |

**适配要点**:
- Step 1 改为检查 Gateway sidecar 是否可启动
- Step 4 的 `uv:install-all` 需要通过 Gateway sidecar 执行

---

### 11. Spotlight 快捷窗口 (P3)

**源文件**: `ClawX/src/pages/Spotlight/index.tsx`

**独立 Tauri 窗口配置**:

```json
{
  "label": "spotlight",
  "title": "Spotlight",
  "width": 680,
  "height": 480,
  "center": false,
  "resizable": false,
  "decorations": false,
  "transparent": true,
  "alwaysOnTop": true,
  "skipTaskbar": true,
  "visible": false
}
```

**子组件**:

| 组件 | 功能 |
|------|------|
| `SpotlightInput` | 输入栏 + 发送按钮 + 截图按钮 |
| `SpotlightResponse` | 流式回复渲染 |
| `ClipboardBar` | 剪贴板内容预览 (文本/图片/代码) |
| `FileAttachmentBar` | 文件附件栏 |
| `FileSearchPanel` | `@` 触发的文件搜索 |
| `CommandPalette` | `/` 前缀的命令面板 |

**Store**: `useSpotlightStore`

**适配要点**:
- 全局快捷键需要 `tauri-plugin-global-shortcut`
- 窗口显示/隐藏通过 Rust 命令控制
- 每次显示时读取剪贴板

---

### 12. Live2D Window (保留)

**现有文件**: `src/pages/Live2DWindow.tsx` + `live2d-window.html`

**不需要迁移**，但需要增强事件监听:

| 新增事件 | 触发场景 | 数字人反应 |
|----------|----------|-----------|
| `live2d_emotion` | AI 回复情感分析结果 | 切换对应表情 |
| `live2d_notification` | 渠道新消息 | 通知动画 + 气泡 |
| `live2d_workflow_status` | 工作流执行进度 | 工作中/完成/失败动画 |
| `live2d_speaking` | TTS 开始/结束 | 口型同步启停 |

---

## shadcn/ui 组件对齐

### ClawX 使用但 Reeftotem 缺少的组件

| 组件 | ClawX 使用场景 | 操作 |
|------|---------------|------|
| `badge` | StatusBadge, 技能标签, 渠道状态 | 需添加 `success`/`warning` variants |
| `checkbox` | 设置开关 | 已有但在 Phase 2 清理时删除，需重新添加 |
| `dialog` | Agent Editor, 添加渠道, 工作流模板 | 已有 |
| `input` | 所有表单 | 需添加 |
| `label` | 表单标签 | 需重新添加 |
| `progress` | 下载进度, 文档处理进度 | 需重新添加 |
| `select` | Provider 选择, 语言选择 | 已有 |
| `separator` | 页面分隔 | 已有 |
| `switch` | 开关 (技能启用/Cron 启用) | 需添加 |
| `tabs` | Chat 思维链, Skills 标签页 | 已有 |
| `textarea` | Cron 消息, Agent 系统提示 | 需添加 |
| `tooltip` | 各处工具提示 | 已有 |

### 重新添加命令

```bash
npx shadcn@latest add badge checkbox input label progress switch textarea
```

---

*最后更新: 2026-02-20*
