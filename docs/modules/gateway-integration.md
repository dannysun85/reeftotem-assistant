# OpenClaw Gateway 集成设计

> Tauri Rust 后端管理 OpenClaw Gateway sidecar 进程，前端通过 WebSocket 通信

## 1. 架构概览

```
Tauri App
├── Rust Backend
│   └── gateway.rs
│       ├── start_gateway()       spawn Node.js 子进程
│       ├── stop_gateway()        graceful shutdown
│       ├── restart_gateway()     stop + start
│       ├── get_gateway_status()  返回 pid/port/state
│       └── 进程监控              崩溃自动重启
│
├── React Frontend
│   └── src/lib/gateway/
│       ├── client.ts             WebSocket 客户端
│       ├── protocol.ts           JSON-RPC 类型定义
│       └── events.ts             事件处理
│
└── OpenClaw Gateway (Node.js Sidecar)
    ├── Port: 18789
    ├── WebSocket: ws://localhost:18789/ws
    └── 功能: AI 对话 / Cron / Channel / Skills
```

## 2. Rust 侧 Sidecar 管理

### 2.1 新增文件 `src-tauri/src/gateway.rs`

**核心职责**:
- 启动 OpenClaw Gateway 作为子进程
- 注入 API Key 环境变量
- 监控进程存活状态
- 崩溃后自动重启 (最多 3 次, 间隔递增)
- 优雅关闭 (发送 shutdown RPC 后等待退出)

**Tauri 命令**:

```rust
#[tauri::command]
async fn start_gateway(
    state: tauri::State<'_, GatewayState>
) -> Result<GatewayStatus, String>

#[tauri::command]
async fn stop_gateway(
    state: tauri::State<'_, GatewayState>
) -> Result<(), String>

#[tauri::command]
async fn restart_gateway(
    state: tauri::State<'_, GatewayState>
) -> Result<GatewayStatus, String>

#[tauri::command]
async fn get_gateway_status(
    state: tauri::State<'_, GatewayState>
) -> Result<GatewayStatus, String>

#[tauri::command]
async fn gateway_rpc(
    method: String,
    params: serde_json::Value,
    state: tauri::State<'_, GatewayState>
) -> Result<serde_json::Value, String>
```

**状态结构**:

```rust
struct GatewayState {
    process: Option<Child>,
    port: u16,                    // 默认 18789
    status: GatewayStatus,
    restart_count: u32,
    max_restarts: u32,            // 默认 3
}

#[derive(Serialize)]
struct GatewayStatus {
    state: String,                // "running" | "stopped" | "starting" | "error"
    port: u16,
    pid: Option<u32>,
    connected_at: Option<String>,
    error: Option<String>,
}
```

### 2.2 Gateway 启动流程

```
start_gateway()
    │
    ├─ 1. 查找 openclaw 入口脚本
    │     └─ dev: node_modules/.bin/openclaw
    │     └─ prod: bundled resources/openclaw
    │
    ├─ 2. 构建环境变量
    │     ├─ OPENCLAW_PORT=18789
    │     ├─ ANTHROPIC_API_KEY=...  (从安全存储读取)
    │     ├─ OPENAI_API_KEY=...
    │     └─ ... (所有已配置 provider 的 key)
    │
    ├─ 3. spawn 子进程
    │     └─ Command::new("node").args(["openclaw", "gateway"])
    │
    ├─ 4. 健康检查轮询 (最多 30 秒)
    │     └─ 尝试 WebSocket 连接 ws://localhost:18789/ws
    │
    ├─ 5. 发送 connect RPC 握手
    │     └─ { method: "connect", params: { auth: { token } } }
    │
    └─ 6. 返回 GatewayStatus { state: "running", pid, port }
```

### 2.3 进程监控

```rust
// 后台 tokio task 定期检查进程状态
async fn monitor_gateway(state: Arc<Mutex<GatewayState>>) {
    loop {
        tokio::time::sleep(Duration::from_secs(5)).await;

        let mut s = state.lock().await;
        if let Some(ref mut process) = s.process {
            match process.try_wait() {
                Ok(Some(exit_status)) => {
                    // 进程退出, 尝试重启
                    if s.restart_count < s.max_restarts {
                        s.restart_count += 1;
                        // 重启逻辑...
                    }
                }
                Ok(None) => {} // 仍在运行
                Err(e) => { /* 错误处理 */ }
            }
        }
    }
}
```

## 3. 前端 WebSocket 客户端

### 3.1 `src/lib/gateway/client.ts`

```typescript
class GatewayClient {
  private ws: WebSocket | null = null;
  private pendingRequests: Map<string, { resolve, reject, timeout }>;
  private eventListeners: Map<string, Set<Function>>;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  // 连接
  async connect(port: number = 18789): Promise<void>;

  // 断线重连 (指数退避: 1s, 2s, 4s, 8s, ... 最大 30s)
  private scheduleReconnect(): void;

  // JSON-RPC 请求
  async rpc<T>(method: string, params?: object): Promise<T>;

  // 事件监听
  on(event: string, callback: Function): () => void;
  off(event: string, callback: Function): void;

  // 关闭
  disconnect(): void;
}

export const gatewayClient = new GatewayClient();
```

### 3.2 `src/lib/gateway/protocol.ts`

```typescript
// JSON-RPC 2.0 请求
interface GatewayRequest {
  type: 'req';
  id: string;          // UUID
  method: string;
  params?: object;
}

// JSON-RPC 2.0 响应
interface GatewayResponse {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

// 服务器推送事件
interface GatewayEvent {
  type: 'event';
  event: GatewayEventType;
  payload: any;
}

type GatewayEventType =
  | 'chat'              // AI 对话流式事件
  | 'channel.status'    // 渠道状态变化
  | 'notification'      // 通知
  | 'tick';             // 心跳
```

### 3.3 关键 RPC 方法

| 方法 | 用途 | 参数 | 返回 |
|------|------|------|------|
| `connect` | 握手认证 | `{ auth: { token } }` | `{ ok: true }` |
| `chat.send` | 发送对话消息 | `{ message, sessionKey, agent?, attachments? }` | 流式事件 |
| `chat.history` | 获取历史记录 | `{ sessionKey }` | `Message[]` |
| `chat.abort` | 终止流式响应 | `{ runId }` | `{ ok: true }` |
| `sessions.list` | 列出会话 | - | `Session[]` |
| `cron.list` | 列出定时任务 | - | `CronJob[]` |
| `cron.add` | 添加定时任务 | `CronJobInput` | `CronJob` |
| `cron.remove` | 删除定时任务 | `{ id }` | `{ ok: true }` |
| `cron.run` | 立即执行 | `{ id }` | `{ ok: true }` |
| `shutdown` | 关闭 Gateway | - | `{ ok: true }` |

### 3.4 Chat 流式事件类型

```typescript
type ChatEvent =
  | { type: 'delta'; text: string }         // 增量文本
  | { type: 'thinking'; text: string }       // 思维链增量
  | { type: 'tool_use'; toolCall: ToolCall } // 工具调用开始
  | { type: 'tool_result'; result: any }     // 工具调用结果
  | { type: 'final'; message: Message }      // 最终完整消息
  | { type: 'error'; error: string }         // 错误
  | { type: 'aborted' };                     // 用户中止
```

## 4. Gateway Store

### 4.1 `src/stores/gateway.ts`

```typescript
interface GatewayStore {
  status: GatewayStatus;
  health: boolean;
  isInitialized: boolean;
  lastError: string | null;

  // 初始化 (app mount 时调用)
  init(): Promise<void>;

  // 生命周期
  start(): Promise<void>;
  stop(): Promise<void>;
  restart(): Promise<void>;

  // 健康检查
  checkHealth(): Promise<boolean>;

  // RPC 代理
  rpc<T>(method: string, params?: object): Promise<T>;

  // 状态更新
  setStatus(status: GatewayStatus): void;
  clearError(): void;
}
```

### 4.2 初始化流程

```typescript
async init() {
  // 1. 检查 Gateway 状态
  const status = await invoke('get_gateway_status');

  if (status.state !== 'running') {
    // 2. 自动启动 (如果设置了 gatewayAutoStart)
    if (useSettingsStore.getState().gatewayAutoStart) {
      await invoke('start_gateway');
    }
  }

  // 3. 前端 WebSocket 连接
  await gatewayClient.connect(status.port);

  // 4. 监听事件
  gatewayClient.on('chat', (event) => {
    useChatStore.getState().handleChatEvent(event);
  });

  gatewayClient.on('channel.status', (event) => {
    useChannelsStore.getState().handleChannelEvent(event);
  });

  this.isInitialized = true;
}
```

## 5. Provider 安全存储

### 5.1 新增 `src-tauri/src/provider.rs`

ClawX 使用 `electron-store` 存储 API Key (明文)。Tauri 版本改为 Rust 文件加密存储。

**Tauri 命令**:

```rust
#[tauri::command]
async fn store_api_key(provider_id: String, api_key: String) -> Result<bool, String>

#[tauri::command]
async fn get_api_key(provider_id: String) -> Result<Option<String>, String>

#[tauri::command]
async fn delete_api_key(provider_id: String) -> Result<bool, String>

#[tauri::command]
async fn save_provider(config: ProviderConfig) -> Result<(), String>

#[tauri::command]
async fn get_all_providers() -> Result<Vec<ProviderConfig>, String>

#[tauri::command]
async fn delete_provider(provider_id: String) -> Result<bool, String>

#[tauri::command]
async fn set_default_provider(provider_id: String) -> Result<(), String>

#[tauri::command]
async fn get_default_provider() -> Result<Option<String>, String>

#[tauri::command]
async fn validate_api_key(
    provider_type: String,
    api_key: String,
    base_url: Option<String>
) -> Result<ValidationResult, String>
```

### 5.2 存储位置

```
~/.config/reeftotem-assistant/
├── providers.json        # Provider 配置 (不含 key)
├── keys.enc              # 加密的 API Key 文件
└── settings.json         # 通用设置

~/.openclaw/
├── auth-profiles.json    # Gateway 需要的 key 文件 (明文, 仅 Gateway 读取)
└── openclaw.json         # OpenClaw 配置 (channels, skills)
```

### 5.3 Key 同步流程

```
用户在 UI 添加 Provider + API Key
    │
    ├─ 1. invoke('store_api_key') → 加密存储到 keys.enc
    ├─ 2. invoke('save_provider') → 配置存储到 providers.json
    ├─ 3. 自动写入 ~/.openclaw/auth-profiles.json (Gateway 需要)
    └─ 4. 如果 Gateway 正在运行 → restart_gateway() 以加载新 key
```

## 6. 支持的 AI Provider

| Provider | 类型 | 默认模型 | API Key 环境变量 |
|----------|------|----------|-----------------|
| Anthropic | `anthropic` | `claude-opus-4-6` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai` | `gpt-5.2` | `OPENAI_API_KEY` |
| Google | `google` | `gemini-3-pro-preview` | `GEMINI_API_KEY` |
| OpenRouter | `openrouter` | `anthropic/claude-opus-4.6` | `OPENROUTER_API_KEY` |
| Moonshot (CN) | `moonshot` | `kimi-k2.5` | `MOONSHOT_API_KEY` |
| SiliconFlow (CN) | `siliconflow` | `deepseek-ai/DeepSeek-V3` | `SILICONFLOW_API_KEY` |
| Ollama | `ollama` | 用户指定 | 无需 key |
| Custom | `custom` | 用户指定 | 用户指定 |

---

*最后更新: 2026-02-20*
