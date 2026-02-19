# WebSocket ASR迁移实施计划

## 任务背景
- 当前ASR调用返回"undefined"问题
- 腾讯云官方文档推荐使用WebSocket实时识别API
- 需要从REST API迁移到WebSocket架构

## 实施方案
选择方案2：迁移到WebSocket实时识别API

## 阶段1：WebSocket ASR架构设计
1. 创建WebSocket客户端模块 (src-tauri/src/websocket_asr.rs)
2. 设计消息协议结构

## 阶段2：核心ASR功能实现
3. 实现实时语音流传输
4. 集成腾讯云认证和签名

## 阶段3：前端接口适配
5. 修改Tauri命令接口
6. 优化前端调用逻辑

## 阶段4：代码清理
7. 删除旧的REST API代码

## 技术要点
- 添加tokio-tungstenite依赖
- webm到PCM音频格式转换
- Rust异步运行时管理
- 连接重试和错误恢复机制