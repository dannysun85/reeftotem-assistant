# Tauri前后端通信修复 - 执行计划

## 任务概述
解决Tauri + React项目中前端invoke调用无法到达后端Rust函数的问题，确保WebSocket ASR功能正常工作。

## 上下文
- 项目：Tauri 2.0 + React 19 + TypeScript + Rust
- 问题：前端调用`tencent_asr`命令返回undefined，后端无日志输出
- 目标：修复前后端通信，实现语音识别功能

## 执行计划

### 阶段1：Tauri 2.0 API兼容性修复（主方案）

#### 步骤1.1：检查Tauri 2.0正确API调用方式
- 分析当前invoke调用代码
- 对比Tauri 2.0文档要求
- 验证`window.__TAURI__`对象结构

#### 步骤1.2：修复前端invoke API调用
- 修改`src/components/Voice/VoiceInteractionDebug.tsx`
- 使用正确的Tauri 2.0 API调用方式
- 确保参数传递格式正确

#### 步骤1.3：添加前端错误处理增强
- 增强try-catch错误处理
- 获取更详细的错误信息
- 添加调试日志

#### 步骤1.4：测试修复效果
- 重新编译并测试
- 验证后端日志输出
- 确认功能正常

### 阶段2：调试中间层方案（备用方案）

#### 步骤2.1-2.4：如果主方案失败，创建测试命令逐步调试

## 成功标准
1. 前端调用`tencent_asr`命令时，后端输出日志
2. WebSocket ASR能够正常识别语音并返回文本
3. 代码保持简洁，错误处理完善

## 进度记录
- [x] 步骤1.1：检查API调用方式
- [x] 步骤1.2：修复invoke调用
- [x] 步骤1.3：增强错误处理
- [ ] 步骤1.4：测试修复效果 ← 当前步骤

## 已完成的修复
### 1. 前端API调用方式修复
- 修复了`testBasicInvoke`函数：使用`const { invoke } = await import('@tauri-apps/api/core')`
- 修复了`testRealASR`函数：同样使用Tauri 2.0正确的API调用方式
- 更新了调试日志，明确显示使用Tauri 2.0 API

### 2. 后端命令注册验证
- 确认`tencent_asr`命令已在`invoke_handler`中正确注册
- 确认函数签名与前端调用匹配
- 添加了详细的测试日志输出