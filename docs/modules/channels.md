# 多渠道通信模块

> 将 AI 数字人助手连接到 11 个消息平台

## 1. 模块概览

多渠道通信模块通过 OpenClaw Gateway 将 AI Agent 连接到各种消息平台。用户在平台上发送的消息由 AI 处理后自动回复，实现跨平台智能助手。

## 2. 支持的渠道

| 渠道 | 连接方式 | 认证类型 | 状态 |
|------|----------|----------|------|
| WhatsApp | QR 扫码 | Session auth | 核心 |
| Telegram | Bot Token | Token | 核心 |
| Discord | Bot Token + Guild ID | Token | 核心 |
| 飞书/Lark | App ID + Secret | Token | 核心 |
| Signal | Phone Number | Token | 扩展 |
| iMessage | Server URL + Password | Token | 扩展 |
| Matrix | Homeserver + Access Token | Token | 插件 |
| LINE | Channel Token + Secret | Token | 插件 |
| Microsoft Teams | App ID + Password | Token | 插件 |
| Google Chat | Service Account Key | Webhook | 插件 |
| Mattermost | Server URL + Bot Token | Token | 插件 |

## 3. 渠道配置流程

```
用户点击 "添加渠道"
    │
    v
步骤 1: 选择渠道类型
    │  (显示所有可用渠道的卡片网格)
    │
    v
步骤 2: 填写配置
    │  ├─ 通用渠道: Token/Key 表单
    │  └─ WhatsApp: 显示 QR 码扫描
    │
    v
步骤 3: 验证凭据
    │  invoke('channel:validateCredentials', type, config)
    │
    v
步骤 4: 保存 + 重启 Gateway
    │  ├─ 配置写入 ~/.openclaw/openclaw.json
    │  └─ restart_gateway() 加载新渠道
    │
    v
渠道已连接 (StatusBadge: "connected")
```

## 4. 渠道配置数据结构

```typescript
type ChannelType =
  | 'whatsapp' | 'telegram' | 'discord' | 'signal'
  | 'feishu' | 'imessage' | 'matrix' | 'line'
  | 'msteams' | 'googlechat' | 'mattermost';

type ChannelConnectionType = 'token' | 'qr' | 'webhook';

interface Channel {
  id: string;
  type: ChannelType;
  name: string;
  status: 'connected' | 'disconnected' | 'connecting' | 'error';
  accountId?: string;
  error?: string;
}

interface ChannelConfigField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  required?: boolean;
  envVar?: string;
  description?: string;
}
```

## 5. 各渠道配置字段

### Telegram
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `botToken` | password | 是 | Bot Token (from @BotFather) |
| `allowedUsers` | text | 是 | 允许的用户 ID (逗号分隔) |

### Discord
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `token` | password | 是 | Bot Token |
| `guildId` | text | 是 | 服务器 ID |
| `channelId` | text | 否 | 指定频道 ID (可选) |

### 飞书/Lark
| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `appId` | text | 是 | App ID |
| `appSecret` | password | 是 | App Secret |

### WhatsApp (特殊流程)
不使用表单，而是通过 QR 码扫描:
1. 调用 `channel:requestQrCode`
2. 监听 `channel:whatsapp-qr` 事件 → 显示 QR 码
3. 用户手机扫码
4. 监听 `channel:whatsapp-success` → 连接成功
5. 或 `channel:whatsapp-error` → 显示错误

## 6. 状态监控

### 实时状态更新

Gateway 通过 WebSocket 事件推送渠道状态变化:

```typescript
// Gateway → Frontend
interface ChannelStatusEvent {
  type: 'channel.status';
  payload: {
    channelType: ChannelType;
    status: 'connected' | 'disconnected' | 'error';
    accountId?: string;
    error?: string;
  };
}
```

### 状态徽章

| 状态 | 颜色 | 说明 |
|------|------|------|
| `connected` | 绿色 | 渠道正常运行 |
| `connecting` | 黄色 (脉冲) | 正在连接 |
| `disconnected` | 灰色 | 未连接 |
| `error` | 红色 | 连接错误 |

## 7. 渠道消息处理

```
外部用户在 Telegram 发送 "你好"
    │
    v
OpenClaw Gateway 接收消息
    │
    ├─ 匹配到绑定的 Agent (通过 channelBindings)
    │
    ├─ 如果 Agent 有知识库 → RAG 检索
    │
    ├─ 调用 AI 生成回复
    │
    ├─ 回复发送到 Telegram
    │
    └─ 同时推送 channel.status 事件到前端
         └─ Live2D 数字人: 通知动画 + 气泡
```

## 8. 与 Live2D 融合

| 渠道事件 | 数字人反应 |
|----------|-----------|
| 收到新消息 | "notification" 动作 + 气泡 "XX 平台有新消息" |
| 渠道连接成功 | "happy" 表情 (短暂) |
| 渠道断开 | "sad" 表情 (短暂) |
| 渠道错误 | "surprised" 表情 |

## 9. Agent-Channel 绑定

每个 Agent 可以绑定多个渠道，绑定后该渠道的消息由该 Agent 处理:

```typescript
interface AgentConfig {
  // ... 其他字段
  channelBindings: string[];  // 绑定的渠道 ID 列表
}
```

同一个渠道只能绑定一个 Agent，切换 Agent 绑定会影响该渠道的回复风格。

---

*最后更新: 2026-02-20*
