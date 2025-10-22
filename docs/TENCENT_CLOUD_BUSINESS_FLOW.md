# 腾讯云语音服务业务流程集成文档

## 📋 概述

本文档详细说明了如何在 Reeftotem Assistant 中集成腾讯云语音服务（ASR 语音识别 + TTS 语音合成），构建完整的语音交互系统。

## 🏗️ 系统架构

### 整体架构图

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   前端 React    │    │   Tauri 后端    │    │  腾讯云 API     │
│                 │    │                 │    │                 │
│ VoiceRecorder   │───▶│ Rust Commands   │───▶│ 语音识别 API    │
│ VoiceProcessor  │    │ Signature Auth  │    │ 语音合成 API    │
│ TencentService  │    │ Error Handling  │    │ 计费管理        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### 核心组件

1. **前端层**：负责音频采集、UI交互、结果展示
2. **Tauri 后端层**：负责 API 签名认证、请求转发、错误处理
3. **腾讯云服务层**：提供语音识别和合成服务

## 🔄 完整业务流程

### 1. 语音识别流程（ASR）

#### 1.1 前端音频采集
```typescript
// 用户点击录音按钮
// ↓
AudioProcessor.startRecording()
// ↓
MediaRecorder 开始采集 WebM/Opus 格式音频
// ↓
实时显示音频波形可视化
// ↓
用户停止录音，获得 ArrayBuffer 音频数据
```

#### 1.2 配置验证
```typescript
// 检查腾讯云配置完整性
if (!tencentCloudVoiceService.isConfigured()) {
    throw new Error('腾讯云语音服务未配置');
}

// 验证配置参数
const config = tencentCloudVoiceService.getASRConfig();
console.log('ASR配置验证:', {
    engineModelType: config.engineModelType,  // 16k_zh, 8k_zh, 16k_en
    channelNum: config.channelNum,           // 1 (单声道)
    sampleRate: config.sampleRate,          // 16000 Hz
    region: config.region,                  // ap-beijing
});
```

#### 1.3 后端 API 调用
```rust
// 接收前端请求
#[tauri::command]
async fn tencent_asr(config: TencentASRConfig, audio_data: Vec<u8>) -> Result<ASRResult, String>

// 创建腾讯云服务实例
let voice_service = TencentCloudVoiceService::new(tencent_config);

// 生成 API 签名 (TC3-HMAC-SHA256)
let signature = generate_signature(
    method: "POST",
    uri: "/",
    headers: &request_headers,
    payload: &json_payload,
    timestamp: current_timestamp,
);

// 发送 HTTP 请求到腾讯云
let response = client.post("https://asr.tencentcloudapi.com/")
    .header("Authorization", authorization)
    .header("X-TC-Timestamp", timestamp)
    .header("X-TC-Action", "SentenceRecognition")
    .json(&asr_request)
    .send().await?;
```

#### 1.4 识别结果处理
```typescript
// 接收识别结果
const result = await tencentCloudVoiceService.recognizeSpeech(audioData);

// 结果验证
if (!result || !result.text || result.text.trim() === '') {
    console.warn('识别结果为空，可能是音频质量问题');
    return null;
}

// 返回识别文本
return {
    text: result.text,
    confidence: result.confidence,
    startTime: result.start_time,
    endTime: result.end_time
};
```

### 2. 语音合成流程（TTS）

#### 2.1 文本预处理
```typescript
// 接收 AI 生成的回复文本
const aiResponse = "这是要合成的语音内容";

// 文本验证
if (!text || text.trim() === '') {
    throw new Error('文本内容不能为空');
}

if (text.length > 10000) {
    throw new Error('文本长度不能超过10000字符');
}
```

#### 2.2 合成参数配置
```typescript
// TTS 配置参数
const ttsConfig = {
    secretId: import.meta.env.VITE_TENCENT_SECRET_ID,
    secretKey: import.meta.env.VITE_TENCENT_SECRET_KEY,
    region: import.meta.env.VITE_TENCENT_REGION || 'ap-beijing',
    appId: import.meta.env.VITE_TENCENT_APP_ID,
    voiceType: 1001,        // 智逍遥 - 成熟女声
    volume: 1.0,            // 音量 (0.0-1.0)
    speed: 1.0,             // 语速 (0.2-2.0)
    pitch: 0.0,             // 音调 (-20.0-20.0)
    sampleRate: 16000       // 采样率
};
```

#### 2.3 后端合成请求
```rust
// 调用腾讯云 TTS API
let voice_service = TencentCloudVoiceService::new(tencent_config);

// 构建合成请求
let tts_request = TTSRequest {
    project_id: app_id,
    text: text.to_string(),
    text_type: 1,           // 普通文本
    model_type: 1,          // 默认模型
    voice_type: voice_type,
    volume: volume,
    speed: speed,
    pitch: pitch,
    primary_language: 1,    // 中文
    sample_rate: sample_rate,
    codec: "wav".to_string(),
    enable_subtitle: false,
};

// 发送请求到腾讯云
let response = client.post("https://tts.tencentcloudapi.com/")
    .header("X-TC-Action", "CreateTtsTask")
    .json(&tts_request)
    .send().await?;
```

#### 2.4 音频播放
```typescript
// 接收合成结果
const result = await tencentCloudVoiceService.synthesizeSpeech(text);

// 创建 Audio 对象播放
const audio = new Audio();
audio.src = URL.createObjectURL(new Blob([result.audioData], { type: 'audio/wav' }));
audio.play().catch(error => {
    console.error('音频播放失败:', error);
});
```

## 🔧 环境配置

### 3.1 开发环境配置

#### 3.1.1 环境变量设置
```bash
# 复制配置模板
cp .env.example .env

# 编辑配置文件
vim .env
```

#### 3.1.2 配置内容
```env
# 腾讯云语音服务配置
VITE_TENCENT_SECRET_ID=AKIDxxxxxxxxxxxxxxxxxxxxxxxx
VITE_TENCENT_SECRET_KEY=xxxxxxxxxxxxxxxxxxxxxxxx
VITE_TENCENT_REGION=ap-beijing
VITE_TENCENT_APP_ID=1234567890
```

#### 3.1.3 Rust 依赖
```toml
[dependencies]
# 腾讯云API依赖
reqwest = { version = "0.11", features = ["json"] }
hmac = "0.12"
sha2 = "0.10"
hex = "0.4"
base64 = "0.21"
url = "2.4"
```

### 3.2 生产环境部署

#### 3.2.1 服务开通
1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 开通语音识别服务（ASR）
3. 开通语音合成服务（TTS）
4. 创建 API 密钥

#### 3.2.2 权限配置
```json
{
  "version": "2.0",
  "statement": [
    {
      "effect": "allow",
      "action": [
        "asr:SentenceRecognition",
        "tts:CreateTtsTask"
      ],
      "resource": [
        "qcs::asr:::region/*",
        "qcs::tts:::region/*"
      ]
    }
  ]
}
```

## 📊 错误处理和监控

### 4.1 常见错误处理

#### 4.1.1 认证错误
```typescript
if (error.message.includes('AuthFailure')) {
    console.log('💡 解决方案：检查 SecretId 和 SecretKey 是否正确');
}
```

#### 4.1.2 限流错误
```typescript
if (error.message.includes('LimitExceeded')) {
    console.log('💡 解决方案：检查账户余额或提升调用限额');
}
```

#### 4.1.3 音频格式错误
```typescript
if (error.message.includes('FailedOperation')) {
    console.log('💡 解决方案：检查音频格式、采样率或质量');
}
```

### 4.2 性能监控

#### 4.2.1 关键指标
- **识别延迟**：从录音结束到获得文本结果的时间
- **合成延迟**：从发送文本到获得音频的时间
- **识别准确率**：语音识别的准确程度
- **API 调用次数**：统计使用量，控制成本

#### 4.2.2 日志记录
```typescript
console.log('🎙️ ASR调用 - 音频大小:', audioData.byteLength, 'bytes');
console.log('🔊 TTS调用 - 文本长度:', text.length, '字符');
console.log('⏱️ 识别耗时:', Date.now() - startTime, 'ms');
console.log('⏱️ 合成耗时:', Date.now() - startTime, 'ms');
```

## 💰 成本控制

### 5.1 计费方式

#### 5.1.1 语音识别（ASR）
- **一句话识别**：按次计费
- **实时语音识别**：按调用时长计费
- **录音文件识别**：按文件时长计费

#### 5.1.2 语音合成（TTS）
- **基础语音合成**：按字符数计费
- **长文本语音合成**：按字符数计费，支持更长的文本

### 5.2 成本优化策略

#### 5.2.1 使用限制
```typescript
// 设置最长录音时间
const MAX_RECORDING_DURATION = 30; // 秒

// 设置文本长度限制
const MAX_TEXT_LENGTH = 1000; // 字符

// 设置调用频率限制
const MIN_INTERVAL = 1000; // 毫秒
```

#### 5.2.2 缓存策略
```typescript
// 缓存常用语音合成结果
const ttsCache = new Map<string, ArrayBuffer>();

function getCachedAudio(text: string): ArrayBuffer | null {
    return ttsCache.get(text) || null;
}

function setCachedAudio(text: string, audioData: ArrayBuffer): void {
    if (ttsCache.size < 100) { // 限制缓存大小
        ttsCache.set(text, audioData);
    }
}
```

## 🚀 部署和测试

### 6.1 测试流程

#### 6.1.1 单元测试
```typescript
// 测试配置验证
test('should validate Tencent Cloud configuration', () => {
    expect(tencentCloudVoiceService.isConfigured()).toBe(true);
});

// 测试音频格式
test('should validate audio format', () => {
    const validAudio = new ArrayBuffer(16000); // 1秒 16kHz
    expect(tencentCloudVoiceService.validateAudio(validAudio)).toBe(true);
});
```

#### 6.1.2 集成测试
```typescript
// 测试完整语音识别流程
test('should complete ASR flow', async () => {
    const mockAudio = generateMockAudioData();
    const result = await tencentCloudVoiceService.recognizeSpeech(mockAudio);
    expect(result).toHaveProperty('text');
    expect(result.text.length).toBeGreaterThan(0);
});

// 测试完整语音合成流程
test('should complete TTS flow', async () => {
    const text = "测试语音合成";
    const result = await tencentCloudVoiceService.synthesizeSpeech(text);
    expect(result).toHaveProperty('audioData');
    expect(result.audioData.length).toBeGreaterThan(0);
});
```

### 6.2 生产部署检查清单

#### 6.2.1 配置检查
- [ ] 环境变量配置正确
- [ ] API 密钥有效且有足够权限
- [ ] 账户余额充足
- [ ] 网络连接正常

#### 6.2.2 功能测试
- [ ] 语音识别功能正常
- [ ] 语音合成功能正常
- [ ] 错误处理机制完善
- [ ] 性能指标达标

#### 6.2.3 监控设置
- [ ] API 调用监控
- [ ] 错误日志监控
- [ ] 成本监控
- [ ] 性能监控

## 📈 扩展和优化

### 7.1 功能扩展

#### 7.1.1 多语言支持
```typescript
// 支持英文识别
const asrConfig = {
    engineModelType: '16k_en',  // 英文引擎
    language: 'en-US'
};

// 支持英文合成
const ttsConfig = {
    voiceType: 1010,  // 英文语音
    language: 'en-US'
};
```

#### 7.1.2 实时语音识别
```typescript
// WebSocket 实时识别
async function startRealTimeASR() {
    const ws = new WebSocket('wss://asr.tencentcloudapi.com/');
    ws.onmessage = (event) => {
        const result = JSON.parse(event.data);
        handleRealTimeResult(result);
    };
}
```

### 7.2 性能优化

#### 7.2.1 音频压缩
```typescript
// 降低音频质量以减少传输大小
const audioConstraints = {
    audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true
    }
};
```

#### 7.2.2 请求优化
```typescript
// 批量处理
async function batchTextToSpeech(texts: string[]) {
    const promises = texts.map(text =>
        tencentCloudVoiceService.synthesizeSpeech(text)
    );
    return Promise.all(promises);
}

// 重试机制
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3
): Promise<T> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(resolve =>
                setTimeout(resolve, Math.pow(2, i) * 1000)
            );
        }
    }
    throw new Error('Max retries exceeded');
}
```

## 📞 技术支持

### 8.1 常见问题

#### 8.1.1 Q: 语音识别准确率低怎么办？
A:
- 确保录音环境安静，减少背景噪音
- 使用正确的音频格式（16kHz, 单声道）
- 选择适合的引擎类型（16k_zh 适合中文）

#### 8.1.2 Q: 语音合成速度慢怎么办？
A:
- 减少文本长度，分段处理长文本
- 选择合适的音频格式（wav 比 mp3 更快）
- 启用音频缓存机制

#### 8.1.3 Q: API 调用失败如何排查？
A:
1. 检查网络连接
2. 验证 API 密钥配置
3. 查看错误代码和消息
4. 检查账户余额和权限
5. 参考官方文档错误码说明

### 8.2 官方资源

- [腾讯云语音识别文档](https://cloud.tencent.com/document/product/1093)
- [腾讯云语音合成文档](https://cloud.tencent.com/document/product/1073)
- [腾讯云控制台](https://console.cloud.tencent.com/)
- [API 错误码查询](https://cloud.tencent.com/document/product/1093/51935)

---

*文档版本: v1.0*
*最后更新: 2025-10-14*
*维护者: Reeftotem Assistant 开发团队*