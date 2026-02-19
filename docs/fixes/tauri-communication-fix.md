# Tauri 前后端通信修复

## 任务概述

解决 Tauri + React 项目中前端 invoke 调用无法到达后端 Rust 函数的问题，确保 WebSocket ASR 功能正常工作。

## 上下文

- **项目**: Tauri 2.0 + React 19 + TypeScript + Rust
- **问题**: 前端调用 `tencent_asr` 命令返回 undefined，后端无日志输出
- **目标**: 修复前后端通信，实现语音识别功能

## 执行计划

### 阶段1：Tauri 2.0 API 兼容性修复（主方案）

#### 步骤 1.1：检查 Tauri 2.0 正确 API 调用方式
- 分析当前 invoke 调用代码
- 对比 Tauri 2.0 文档要求
- 验证 `window.__TAURI__` 对象结构

#### 步骤 1.2：修复前端 invoke API 调用
- 修改 `src/components/Voice/VoiceInteractionDebug.tsx`
- 使用正确的 Tauri 2.0 API 调用方式
- 确保参数传递格式正确

#### 步骤 1.3：添加前端错误处理增强
- 增强 try-catch 错误处理
- 获取更详细的错误信息
- 添加调试日志

#### 步骤 1.4：测试修复效果
- 重新编译并测试
- 验证后端日志输出
- 确认功能正常

### 阶段2：调试中间层方案（备用方案）

如果主方案失败，创建测试命令逐步调试。

## 成功标准

1. 前端调用 `tencent_asr` 命令时，后端输出日志
2. WebSocket ASR 能够正常识别语音并返回文本
3. 代码保持简洁，错误处理完善

## 已完成的修复

### 1. 前端 API 调用方式修复
- 修复了 `testBasicInvoke` 函数：使用 `const { invoke } = await import('@tauri-apps/api/core')`
- 修复了 `testRealASR` 函数：同样使用 Tauri 2.0 正确的 API 调用方式
- 更新了调试日志，明确显示使用 Tauri 2.0 API

### 2. 后端命令注册验证
- 确认 `tencent_asr` 命令已在 `invoke_handler` 中正确注册
- 确认函数签名与前端调用匹配
- 添加了详细的测试日志输出

## 关键修复点

**Tauri 2.0 中正确的 invoke 调用方式**:

```typescript
// 正确 - Tauri 2.0
const { invoke } = await import('@tauri-apps/api/core');
const result = await invoke('command_name', { param: value });

// 错误 - Tauri 1.x 方式
import { invoke } from '@tauri-apps/api/tauri';
```

---

*最后更新: 2026-02-19*
