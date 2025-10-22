# Reeftotem Assistant 语音交互快速测试指南

## 🚀 5分钟快速测试

### 1. 打开应用
```bash
pnpm tauri dev
```

### 2. 打开语音交互页面
- 在主界面找到"语音交互"或"Live2D语音交互"页面
- 或者直接访问: `http://localhost:1420`

### 3. 检查配置状态
在页面底部找到"服务状态"区域，确认：
- ✅ 腾讯云配置：显示"已配置"
- ✅ AI大模型：显示"✅ ollama"或其他提供商
- ✅ Live2D集成：显示"已启用"

### 4. 开始测试
1. **基础测试**：
   - 点击"测试语音合成 + 口型同步"按钮
   - 应该能听到语音并看到Live2D角色说话

2. **完整流程测试**：
   - 点击"开始测试"按钮（在调试控制区域）
   - 应用会自动执行：录音 → 识别 → AI回复 → 语音合成 → 口型同步
   - 观察每个步骤的状态变化

## 🔧 如果遇到问题

### 检查控制台日志
1. 打开浏览器开发者工具 (F12)
2. 查看Console标签页
3. 寻找以下关键日志：
   ```
   🔧 AI服务初始化配置: {...}
   🎙️ ASR调用开始
   🤖 AI回复生成: 用户输入
   🔊 TTS调用开始
   🎭 Live2D口型同步
   ✅ 服务调用成功
   ```

### 常见问题诊断

#### 1. Ollama服务不可用
**症状**：AI服务显示"⚠️ 本地回复"
**解决方法**：
```bash
# 检查Ollama是否运行
ps aux | grep ollama

# 如果没有运行，启动Ollama
ollama serve

# 检查可用模型
ollama list

# 下载推荐模型
ollama pull qwen2.5:7b
```

#### 2. 腾讯云配置问题
**症状**：服务状态显示"❌ 未配置"
**解决方法**：
1. 复制配置文件：
   ```bash
   cp .env.example .env
   ```
2. 编辑.env文件，填入您的腾讯云API密钥

#### 3. 麦克风权限问题
**症状**：录音无法开始或立即失败
**解决方法**：
- 检查浏览器麦克风权限设置
- 重新加载页面并授权

#### 4. 语音识别失败
**症状**：录音后没有识别结果
**解决方法**：
- 确认腾讯云API密钥有效
- 检查网络连接
- 检查音频质量和环境噪音

#### 5. Live2D口型不同步
**症状**：播放语音时Live2D没有口型动作
**解决方法**：
- 确认使用支持的Live2D模型
- 刷新页面重新加载模型
- 检查音频播放权限

## 📊 性能调优

### 环境配置优化
```bash
# 启用详细调试日志
export VITE_DEBUG_VOICE=true
export VITE_DEBUG_AI=true
export VITE_DEBUG_LIVE2D=true

# 使用轻量级AI模型
export VITE_OLLAMA_MODEL=qwen2:1.8b
export VITE_AI_MAX_TOKENS=500
```

### 音频质量优化
- 使用高质量麦克风
- 确保录音环境安静
- 语速适中，发音清晰

## 📋 详细测试步骤

### 分步验证
1. **配置验证**：
   ```javascript
   // 在控制台运行
   import('./src/utils/debugHelper').logDebugInfo();
   ```

2. **单独测试各个组件**：
   ```javascript
   // 测试麦克风
   navigator.mediaDevices.getUserMedia({ audio: true });

   // 测试Ollama
   fetch('http://localhost:11434/api/tags');

   // 测试腾讯云API
   fetch('https://asr.tencentcloudapi.com/');
   ```

3. **端到端测试**：
   - 录音功能
   - ASR识别
   - AI回复
   - TTS合成
   - Live2D同步

## 🆘 获取帮助

- 查看完整文档：`docs/voice-interaction-guide.md`
- 在GitHub提交Issue
- 加入社区讨论

## ✅ 成功标志

当您看到以下情况时，说明语音交互功能正常：
- ✅ 完整测试显示所有步骤为成功状态
- ✅ 能够听到AI回复的语音
- ✅ Live2D角色在语音播放时有相应的口型动作
- ✅ 控制台显示正常的调用日志

## 🎉 进阶功能

### 自定义AI回复
修改 `src/lib/ai/AIService.ts` 中的 `systemPrompt` 来自定义AI性格

### 多模型切换
在 `.env` 中更改 `VITE_AI_PROVIDER` 或 `VITE_OLLAMA_MODEL`

### 音频参数调整
在 `.env` 中调整TTS参数：
```bash
VITE_AI_TEMPERATURE=0.9  # 更有创意
VITE_AI_MAX_TOKENS=1500    # 更长回复
```

现在您可以开始享受完整的语音交互体验了！🎉