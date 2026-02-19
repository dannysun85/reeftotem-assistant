# WebSocket ASR 迁移实施计划

## 任务背景

- 当前 ASR 调用返回 "undefined" 问题
- 腾讯云官方文档推荐使用 WebSocket 实时识别 API
- 需要从 REST API 迁移到 WebSocket 架构

## 实施方案

选择方案：迁移到 WebSocket 实时识别 API

## 实施阶段

### 阶段1：WebSocket ASR 架构设计
1. 创建 WebSocket 客户端模块 (`src-tauri/src/websocket_asr.rs`)
2. 设计消息协议结构

### 阶段2：核心 ASR 功能实现
3. 实现实时语音流传输
4. 集成腾讯云认证和签名

### 阶段3：前端接口适配
5. 修改 Tauri 命令接口
6. 优化前端调用逻辑

### 阶段4：代码清理
7. 删除旧的 REST API 代码

## 技术要点

| 技术点 | 说明 |
|--------|------|
| 依赖 | 添加 `tokio-tungstenite` |
| 音频格式 | webm 到 PCM 音频格式转换 |
| 异步运行时 | Rust 异步运行时管理 |
| 错误恢复 | 连接重试和错误恢复机制 |

## WebSocket 连接流程

```
前端录音 → PCM数据 → Tauri invoke → Rust WebSocket客户端 → 腾讯云ASR → 识别结果 → 前端展示
```

## 预期收益

- 实时语音流传输，降低延迟
- 支持长时间连续语音识别
- 更可靠的连接管理

---

*最后更新: 2026-02-19*
