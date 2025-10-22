# Reeftotem Assistant 语音交互使用指南

## 🎯 功能概述

Reeftotem Assistant 提供完整的语音交互体验，支持：
- 🎙️ **语音识别(ASR)**：将您的语音转换为文字
- 🤖 **AI大模型对话**：智能生成回复内容
- 🔊 **语音合成(TTS)**：将AI回复转换为语音
- 🎭 **Live2D口型同步**：Live2D角色与语音同步的口型动画

## 🚀 快速开始

### 1. 环境配置

#### 腾讯云语音服务配置
1. 复制 `.env.example` 为 `.env`
2. 填入您的腾讯云API密钥：
   ```bash
   VITE_TENCENT_SECRET_ID=您的SecretId
   VITE_TENCENT_SECRET_KEY=您的SecretKey
   VITE_TENCENT_APP_ID=您的应用ID
   ```

#### AI大模型配置（推荐Ollama）
1. 安装并启动 Ollama：
   ```bash
   # macOS
   brew install ollama

   # 启动Ollama服务
   ollama serve
   ```

2. 下载中文模型（推荐）：
   ```bash
   # 千问2.5 7B模型（推荐）
   ollama pull qwen2.5:7b

   # 或者其他中文模型
   ollama pull llama3.1:8b
   ollama pull qwen2:7b
   ```

### 2. 启动应用

```bash
# 开发模式
pnpm tauri dev

# 生产构建
pnpm tauri build
```

## 🎮 使用流程

### 完整语音交互流程

1. **点击录音按钮** 🎙️
   - 应用开始录音，显示实时音量波形
   - Live2D角色显示"倾听"表情

2. **说话** 🗣️
   - 对着麦克风说话
   - 实时显示音量级别和录音时长

3. **停止录音** ⏹️
   - 点击停止按钮或自动停止
   - 应用开始处理语音

4. **语音识别** 🔍
   - 腾讯云ASR服务将语音转换为文字
   - 显示识别结果

5. **AI生成回复** 🤖
   - 文字发送给AI大模型
   - Live2D角色显示"思考"表情
   - 生成智能回复

6. **语音合成** 🔊
   - AI回复转换为语音
   - 腾讯云TTS服务合成音频

7. **Live2D口型同步** 🎭
   - 播放语音时，Live2D角色口型与语音同步
   - 根据内容显示相应表情

## ⚙️ 高级配置

### AI模型配置

应用支持多种AI提供商：

#### 1. Ollama（推荐，本地部署）
```javascript
// 默认配置
{
  provider: 'ollama',
  model: 'qwen2.5:7b',
  baseUrl: 'http://localhost:11434',
  temperature: 0.7,
  maxTokens: 1000
}
```

#### 2. OpenAI
```javascript
{
  provider: 'openai',
  model: 'gpt-3.5-turbo',
  apiKey: 'your-api-key',
  temperature: 0.7,
  maxTokens: 1000
}
```

#### 3. Anthropic Claude
```javascript
{
  provider: 'anthropic',
  model: 'claude-3-haiku-20240307',
  apiKey: 'your-api-key',
  temperature: 0.7,
  maxTokens: 1000
}
```

### 腾讯云语音配置

#### ASR（语音识别）配置
- **引擎类型**：16k_zh（16kHz中文）
- **采样率**：16000Hz
- **声道数**：1（单声道）

#### TTS（语音合成）配置
- **语音类型**：1001（智逍遥 - 成熟女声）
- **音量**：1.0（100%）
- **语速**：1.0（正常）
- **音调**：0.0（标准）

## 🛠️ 故障排除

### 常见问题

#### 1. 语音识别失败
**症状**：录音后没有识别结果
**解决方案**：
- 检查腾讯云API密钥配置
- 确认网络连接正常
- 检查麦克风权限

#### 2. AI回复生成失败
**症状**：识别成功但没有AI回复
**解决方案**：
- 检查Ollama服务是否运行：`ollama list`
- 确认模型已下载：`ollama pull qwen2.5:7b`
- 检查API密钥（如果使用OpenAI/Claude）

#### 3. 语音合成失败
**症状**：AI回复生成了但没有语音
**解决方案**：
- 检查腾讯云TTS服务配置
- 确认账户余额充足
- 检查文本内容是否符合要求

#### 4. Live2D口型不同步
**症状**：语音播放时口型不动
**解决方案**：
- 检查Live2D模型是否支持唇形同步
- 刷新页面重新加载模型
- 检查音频播放权限

### 调试模式

1. **开启开发者工具**
   - 右键点击应用
   - 选择"检查"或"开发者工具"

2. **查看控制台日志**
   - 寻找以下日志标识：
     - 🎙️ ASR调用
     - 🤖 AI回复生成
     - 🔊 TTS合成
     - ✅/❌ 操作结果

3. **网络请求监控**
   - 检查API调用是否成功
   - 查看响应时间和状态码

## 📊 性能优化

### 语音质量优化
- 使用高质量麦克风
- 确保录音环境安静
- 语速适中，发音清晰

### AI响应速度优化
- 使用本地Ollama模型
- 调整`maxTokens`参数
- 选择合适的模型大小

### 系统资源优化
- 关闭不必要的后台应用
- 确保充足的内存和CPU资源
- 定期清理缓存

## 💡 使用技巧

### 1. 最佳对话体验
- 保持简短清晰的句子
- 避免背景噪音
- 给AI足够的思考时间

### 2. 表情互动
- 语音中的情感会被识别
- Live2D会根据内容显示相应表情
- 尝试不同的语调和情感

### 3. 多轮对话
- 支持上下文记忆
- 可以进行连续对话
- 记忆最近10轮对话

## 🔧 开发者信息

### 技术栈
- **前端**：React + TypeScript + Vite
- **后端**：Rust + Tauri
- **语音服务**：腾讯云ASR/TTS
- **AI模型**：Ollama/OpenAI/Claude
- **Live2D**：Cubism SDK for Web

### API文档
- [腾讯云语音识别](https://cloud.tencent.com/document/product/1093/37823)
- [腾讯云语音合成](https://cloud.tencent.com/document/product/1073/37823)
- [Ollama API](https://github.com/ollama/ollama/blob/main/docs/api.md)

### 贡献指南
欢迎提交Issue和Pull Request来改进项目！

---

**注意**：使用本应用需要有效的网络连接和相应的API密钥。建议在WiFi环境下使用以获得最佳体验。