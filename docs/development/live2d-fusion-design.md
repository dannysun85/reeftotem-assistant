# Live2D 数字人深度融合设计

> Live2D 数字人如何与 ClawX 各功能模块进行深度融合

## 1. 融合总览

Live2D 数字人不是一个孤立的装饰窗口，而是所有功能模块的"视觉出口"。每个模块的状态变化都通过数字人的表情、动作、口型、气泡等方式反馈给用户。

```
+------------------+      +------------------+      +------------------+
|   AI Chat 对话   |      |   Channel 渠道   |      |  Workflow 工作流  |
|   (情感分析)     |      |   (新消息通知)   |      |  (执行状态)       |
+--------+---------+      +--------+---------+      +--------+---------+
         |                         |                          |
         v                         v                          v
+---------------------------------------------------------------+
|                    Live2D 数字人控制总线                        |
|  Tauri Events: live2d_emotion / live2d_notification /         |
|               live2d_workflow / live2d_speaking /              |
|               live2d_lip_sync / switch_live2d_model            |
+---------------------------------------------------------------+
         |                         |                          |
         v                         v                          v
+------------------+      +------------------+      +------------------+
|   表情系统       |      |   动作系统       |      |   气泡通知系统    |
|   (Expression)   |      |   (Motion)       |      |   (Bubble)        |
+------------------+      +------------------+      +------------------+
```

## 2. AI 对话 → 数字人情感联动

### 2.1 情感分析引擎

新增 `src/lib/emotion/analyzer.ts`:

```typescript
export type EmotionType =
  | 'happy'      // 开心、兴奋
  | 'sad'        // 难过、抱歉
  | 'thinking'   // 思考、犹豫
  | 'surprised'  // 惊讶
  | 'confident'  // 自信、确定
  | 'idle';      // 默认

export interface EmotionResult {
  emotion: EmotionType;
  confidence: number;      // 0-1
  expression: string;      // Live2D expression name
  motion?: string;         // 可选的 motion 触发
}

// 基于关键词的快速情感判断 (本地, 无延迟)
export function analyzeEmotion(text: string): EmotionResult;

// 基于 AI 的深度情感分析 (可选, 用于完整回复)
export async function analyzeEmotionDeep(text: string): Promise<EmotionResult>;
```

### 2.2 情感 → 表情映射

| EmotionType | Live2D Expression | 触发条件 |
|-------------|-------------------|----------|
| `happy` | `exp_happy` / `smile` | 含有 "哈哈"、"!"、积极词汇 |
| `sad` | `exp_sad` / `sorry` | 含有 "抱歉"、"对不起"、"遗憾" |
| `thinking` | `exp_thinking` | 含有 "嗯"、"让我想想"、工具调用中 |
| `surprised` | `exp_surprised` | 含有 "哇"、"没想到"、"居然" |
| `confident` | `exp_confident` | RAG 引用知识库回答、代码解释 |
| `idle` | (default) | 默认/无法判断 |

### 2.3 对话流程中的触发时机

```
用户发送消息
    │
    ├─ 数字人: "listening" 表情 (等待中)
    │
    v
Gateway 开始流式响应
    │
    ├─ onStreamStart → 数字人: "thinking" 表情
    │
    ├─ onToolUse → 数字人: "thinking" motion (循环播放)
    │
    ├─ onDelta(chunk) → 每 50 字符分析一次情感
    │     └─ 如果情感变化 → 切换表情
    │
    ├─ onFinal(fullText) → 最终情感分析
    │     ├─ 触发最终表情
    │     ├─ TTS 合成语音
    │     └─ 开始口型同步
    │
    └─ onError → 数字人: "sad" 表情
```

### 2.4 实现代码示例

```typescript
// src/stores/chat.ts 中的流式处理
handleChatEvent(event: ChatEvent) {
  switch (event.type) {
    case 'delta':
      // 更新流式文本
      this.streamingMessage += event.text;

      // 每积累 50 字符分析一次情感
      if (this.streamingMessage.length % 50 === 0) {
        const emotion = analyzeEmotion(this.streamingMessage);
        invoke('trigger_live2d_expression', {
          expression: emotion.expression
        });
      }
      break;

    case 'tool_use':
      // 工具调用 → 思考动画
      invoke('trigger_live2d_motion', { motion: 'thinking' });
      break;

    case 'final':
      // 最终情感分析
      const finalEmotion = analyzeEmotion(event.fullText);
      invoke('trigger_live2d_expression', {
        expression: finalEmotion.expression
      });

      // TTS + 口型同步
      if (this.voiceEnabled) {
        const audio = await invoke('tencent_tts', {
          config: ttsConfig,
          text: event.fullText
        });
        invoke('trigger_live2d_lip_sync', {
          text: event.fullText,
          lipSyncData: audio
        });
      }
      break;

    case 'error':
      invoke('trigger_live2d_expression', { expression: 'exp_sad' });
      break;
  }
}
```

## 3. 多渠道消息 → 数字人通知

### 3.1 通知触发流程

```
外部渠道消息 (Telegram/Discord/微信...)
    │
    v
OpenClaw Gateway → channel.status 事件
    │
    v
gatewayStore.on('channel.status') → 判断事件类型
    │
    ├─ message_received:
    │     ├─ invoke('live2d_notification', {
    │     │     type: 'channel_message',
    │     │     channel: 'telegram',
    │     │     preview: '张三: 你好...',
    │     │     duration: 3000
    │     │ })
    │     └─ 数字人: notification motion + 气泡
    │
    ├─ channel_connected:
    │     └─ 数字人: happy expression (短暂)
    │
    └─ channel_error:
          └─ 数字人: sad expression
```

### 3.2 气泡通知系统

在 Live2D 浮窗中新增气泡 UI 组件:

```
+-------------------------------------------+
|           Live2D 浮窗                      |
|                                            |
|    +------------------------------+        |
|    | Telegram 有新消息            |  ← 气泡 |
|    | "张三: 你好，请问..."       |        |
|    +------------------------------+        |
|                                            |
|         [Live2D 数字人模型]                |
|                                            |
+-------------------------------------------+
```

**气泡属性**:
- 位置: 数字人头部上方
- 动画: 淡入淡出 (300ms)
- 持续: 3-5 秒后自动消失
- 点击: 点击气泡跳转到主窗口 Chat 页面对应渠道

### 3.3 新增 Tauri Event

```typescript
// 新增事件: live2d_notification
interface Live2DNotification {
  type: 'channel_message' | 'workflow_complete' | 'cron_trigger' | 'system';
  title: string;
  message: string;
  icon?: string;       // 渠道图标
  duration?: number;   // 显示时长 ms
  action?: string;     // 点击动作 (路由跳转)
}
```

## 4. 知识库 RAG → 数字人 "博学" 表现

### 4.1 RAG 融合流程

```
用户提问 "量子计算的基本原理是什么?"
    │
    v
Chat store → sendMessage()
    │
    ├─ 1. 检测 activeAgent.knowledgeBaseIds
    │
    ├─ 2. 调用 knowledge:rag 检索
    │     └─ 返回 RAGResult[] (内容/文档名/分数)
    │
    ├─ 3. 注入 <knowledge> 块到 prompt
    │
    ├─ 4. 发送到 Gateway
    │     └─ AI 引用知识回答
    │
    └─ 5. 数字人表现:
          ├─ RAG 命中 (分数 > 0.8) → "confident" 表情
          ├─ RAG 部分命中 → "thinking" 表情
          └─ RAG 未命中 → "idle" 表情
```

### 4.2 知识引用视觉反馈

当 AI 回复中引用了知识库内容时:
- 数字人显示 "confident" 表情 (表示有据可查)
- Chat UI 中显示知识来源标注 (文档名 + 分数)

## 5. 工作流执行 → 数字人状态反馈

### 5.1 执行状态映射

| 工作流状态 | 数字人反应 | Expression/Motion |
|-----------|-----------|-------------------|
| 开始执行 | "工作中" 动画开始 | `motion: 'working'` (循环) |
| 步骤完成 | 短暂 "点头" | `motion: 'nod'` |
| Agent 节点思考 | "思考" 表情 | `expression: 'exp_thinking'` |
| Condition 分支 | "思考" 表情 | `expression: 'exp_thinking'` |
| 全部完成 (成功) | "庆祝" 动作 | `motion: 'celebrate'`, `expression: 'exp_happy'` |
| 执行失败 | "困惑" 表情 | `expression: 'exp_sad'` |

### 5.2 进度气泡

工作流执行过程中，Live2D 气泡显示进度:

```
+------------------------------+
| 工作流执行中 (3/5)           |
| ✓ 输入解析                   |
| ✓ AI 分析                    |
| → 条件判断...                |
+------------------------------+
```

### 5.3 事件定义

```typescript
interface Live2DWorkflowEvent {
  type: 'workflow_start' | 'step_complete' | 'workflow_complete' | 'workflow_error';
  workflowName: string;
  currentStep?: string;
  totalSteps?: number;
  completedSteps?: number;
  error?: string;
}
```

## 6. 语音交互全链路

### 6.1 完整语音交互流程

```
                  用户
                    │
                    v
            [点击麦克风按钮]
                    │
                    v
            useAudioRecorder
            (WebAPI MediaRecorder)
                    │
                    ├─ 数字人: "listening" 表情
                    │  + 耳朵闪烁动画 (可选)
                    │
                    v
            [点击停止录音]
                    │
                    v
            Tauri invoke('tencent_asr')
            (Rust 侧腾讯云 ASR)
                    │
                    ├─ 数字人: "thinking" 表情
                    │
                    v
            ASR 结果 (文字)
                    │
                    v
            RAG 知识检索 (如有)
                    │
                    v
            Gateway chat.send (流式)
                    │
                    ├─ onDelta: 情感分析 → 表情变化
                    │
                    v
            AI 回复完成
                    │
                    v
            Tauri invoke('tencent_tts')
            (Rust 侧腾讯云 TTS)
                    │
                    v
            音频播放 + Live2D 口型同步
                    │
                    ├─ 数字人: 嘴部参数跟随音频振幅
                    │
                    v
            播放结束
                    │
                    └─ 数字人: 回到 "idle" 表情
```

### 6.2 口型同步参数

Live2D 口型同步通过 `ParamMouthOpenY` 参数实现:

```typescript
// 已有: src/hooks/useLive2DLipSync.ts
// 音频 PCM 数据 → 振幅分析 → 0.0-1.0 映射 → ParamMouthOpenY
```

### 6.3 语音与情感的协同

- TTS 播放期间，表情跟随最终情感分析结果
- 如果情感是 "happy"，嘴部参数在口型同步基础上微微上扬
- 如果情感是 "sad"，眉毛参数微微下垂

## 7. Agent 切换 → 数字人模型切换

### 7.1 Agent-Model 绑定

在 `AgentConfig` 中新增字段:

```typescript
interface AgentConfig {
  // ... 现有字段
  live2dModel?: string;       // 绑定的 Live2D 模型名
  live2dExpression?: string;  // 默认表情
  voiceType?: number;         // TTS 音色 ID
}
```

### 7.2 切换流程

```
用户在 Agents 页面选择 "代码助手" Agent
    │
    v
agentStore.setActiveAgent('coder')
    │
    ├─ 1. 读取 agent.live2dModel = 'Epsilon'
    ├─ 2. invoke('switch_live2d_model', { modelName: 'Epsilon' })
    ├─ 3. Live2D 窗口: 淡出 → 切换模型 → 淡入
    ├─ 4. 设置默认表情 agent.live2dExpression
    └─ 5. 更新 TTS 音色为 agent.voiceType
```

### 7.3 预设绑定建议

| Agent 模板 | Live2D 模型 | 表情倾向 | TTS 音色 |
|-----------|-------------|----------|----------|
| Assistant (默认) | Haru | 平和、友善 | 标准女声 |
| Coder | Epsilon | 专注、冷静 | 中性声 |
| Writer | Chitose | 优雅、文艺 | 柔和女声 |
| Analyst | Kei | 严肃、理性 | 标准男声 |
| Tutor | Hiyori | 活泼、耐心 | 温柔女声 |

## 8. Cron 定时任务 → 数字人提醒

当 Cron 定时任务触发时:

```
Cron 任务触发 (每日 9:00 发送日报)
    │
    v
Gateway cron 事件 → gatewayStore
    │
    v
invoke('live2d_notification', {
  type: 'cron_trigger',
  title: '定时任务执行',
  message: '日报已发送到 Telegram',
  duration: 5000
})
    │
    v
数字人: notification motion + 气泡显示
```

## 9. 实现优先级

| 优先级 | 融合点 | 所需工作量 |
|--------|--------|-----------|
| P0 | AI 对话 → 情感表情 | 新增 emotion/analyzer.ts + chat store 集成 |
| P0 | 语音 → 口型同步 | 已有基础，完善触发时机 |
| P1 | Agent → 模型切换 | AgentConfig 新增字段 + 切换逻辑 |
| P1 | 渠道消息 → 气泡通知 | Live2D 窗口新增气泡组件 |
| P2 | 工作流 → 状态动画 | 新增事件监听 + 进度气泡 |
| P2 | RAG → 自信表情 | 在 chat store 中判断 RAG 分数 |
| P3 | Cron → 提醒通知 | 复用气泡通知系统 |

---

*最后更新: 2026-02-20*
