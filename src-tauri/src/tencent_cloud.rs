// 腾讯云语音服务模块
// 提供完整的ASR（语音识别）和TTS（语音合成）功能

use base64::Engine;
use hmac::{Hmac, Mac};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

type HmacSha256 = Hmac<Sha256>;

// 腾讯云API基础配置
#[derive(Debug, Clone)]
pub struct TencentCloudConfig {
    pub secret_id: String,
    pub secret_key: String,
    pub region: String,
    pub app_id: String,
}

// ASR一句话识别请求
#[derive(Debug, Serialize)]
pub struct ASRRequest {
    #[serde(rename = "ProjectId")]
    pub project_id: i64,
    #[serde(rename = "SubServiceType")]
    pub sub_service_type: i64,
    #[serde(rename = "EngSerViceType")]
    pub eng_ser_vice_type: i64,
    #[serde(rename = "VoiceFormat")]
    pub voice_format: String,
    #[serde(rename = "UsrAudioKey")]
    pub usr_audio_key: String,
    #[serde(rename = "Data")]
    pub data: String,
    #[serde(rename = "DataLen")]
    pub data_len: i64,
    #[serde(rename = "SourceType")]
    pub source_type: i64,
}

// ASR识别结果
#[derive(Debug, Deserialize)]
pub struct ASRResponse {
    #[serde(rename = "Request")]
    pub request: String,
    #[serde(rename = "Error")]
    pub error: Option<ASRError>,
    #[serde(rename = "Response")]
    pub response: Option<ASRResponseData>,
}

#[derive(Debug, Deserialize)]
pub struct ASRError {
    #[serde(rename = "Code")]
    pub code: String,
    #[serde(rename = "Message")]
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct ASRResponseData {
    #[serde(rename = "Text")]
    pub text: String,
    #[serde(rename = "EngSerViceType")]
    pub eng_ser_vce_type: i64,
    #[serde(rename = "AudioDuration")]
    pub audio_duration: f64,
    #[serde(rename = "WordList")]
    pub word_list: Option<Vec<WordInfo>>,
}

#[derive(Debug, Deserialize)]
pub struct WordInfo {
    #[serde(rename = "Word")]
    pub word: String,
    #[serde(rename = "WordSize")]
    pub word_size: i64,
    #[serde(rename = "StartTime")]
    pub start_time: f64,
    #[serde(rename = "EndTime")]
    pub end_time: f64,
}

// TTS语音合成请求
#[derive(Debug, Serialize)]
pub struct TTSRequest {
    #[serde(rename = "ProjectId")]
    pub project_id: i64,
    #[serde(rename = "Text")]
    pub text: String,
    #[serde(rename = "TextType")]
    pub text_type: i64,
    #[serde(rename = "ModelType")]
    pub model_type: i64,
    #[serde(rename = "VoiceType")]
    pub voice_type: i64,
    #[serde(rename = "Volume")]
    pub volume: f64,
    #[serde(rename = "Speed")]
    pub speed: f64,
    #[serde(rename = "Pitch")]
    pub pitch: f64,
    #[serde(rename = "PrimaryLanguage")]
    pub primary_language: i64,
    #[serde(rename = "SampleRate")]
    pub sample_rate: i64,
    #[serde(rename = "Codec")]
    pub codec: String,
    #[serde(rename = "EnableSubtitle")]
    pub enable_subtitle: bool,
}

// TTS语音合成结果
#[derive(Debug, Deserialize)]
pub struct TTSResponse {
    #[serde(rename = "Request")]
    pub request: String,
    #[serde(rename = "Error")]
    pub error: Option<TTSError>,
    #[serde(rename = "Response")]
    pub response: Option<TTSResponseData>,
}

#[derive(Debug, Deserialize)]
pub struct TTSError {
    #[serde(rename = "Code")]
    pub code: String,
    #[serde(rename = "Message")]
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct TTSResponseData {
    #[serde(rename = "Audio")]
    pub audio: String,
    #[serde(rename = "SessionId")]
    pub session_id: String,
    #[serde(rename = "Size")]
    pub size: i64,
    #[serde(rename = "Duration")]
    pub duration: f64,
    #[serde(rename = "Codec")]
    pub codec: String,
}

// 腾讯云语音服务
pub struct TencentCloudVoiceService {
    config: TencentCloudConfig,
    client: Client,
}

impl TencentCloudVoiceService {
    pub fn new(config: TencentCloudConfig) -> Self {
        Self {
            config,
            client: Client::new(),
        }
    }

    // 生成腾讯云API签名
    fn generate_signature(
        &self,
        method: &str,
        uri: &str,
        query_string: &str,
        headers: &HashMap<String, String>,
        payload: &str,
        timestamp: u64,
    ) -> String {
        let algorithm = "TC3-HMAC-SHA256";
        let service = "asr";
        let _host = "asr.tencentcloudapi.com";

        // 1. 拼接规范请求串
        let canonical_request = format!(
            "{}\n{}\n{}\n{}\n{}\n{}",
            method,
            uri,
            query_string,
            headers
                .iter()
                .map(|(k, v)| format!("{}:{}", k.to_lowercase(), v))
                .collect::<Vec<_>>()
                .join("\n"),
            headers.keys().map(|k| k.to_lowercase()).collect::<Vec<_>>().join(";"),
            hex::encode(sha2::Sha256::digest(payload.as_bytes()))
        );

        // 2. 拼接待签名字符串
        let date = chrono::DateTime::from_timestamp(timestamp as i64, 0)
            .unwrap()
            .format("%Y-%m-%d")
            .to_string();
        let credential_scope = format!("{}/{}/tc3_request", date, service);
        let string_to_sign = format!(
            "{}\n{}\n{}\n{}",
            algorithm,
            timestamp,
            credential_scope,
            hex::encode(sha2::Sha256::digest(canonical_request.as_bytes()))
        );

        // 3. 计算签名
        let secret_date = self
            .hmac_sha256(format!("TC3{}", self.config.secret_key), date)
            .unwrap();
        let secret_service = self.hmac_sha256(secret_date, service).unwrap();
        let secret_signing = self.hmac_sha256(secret_service, "tc3_request").unwrap();
        let signature = self.hmac_sha256(secret_signing, string_to_sign).unwrap();

        // 4. 拼接Authorization
        hex::encode(signature)
    }

    fn hmac_sha256(&self, key: impl AsRef<[u8]>, data: impl AsRef<[u8]>) -> Result<Vec<u8>, hmac::digest::InvalidLength> {
        let mut mac = HmacSha256::new_from_slice(key.as_ref())?;
        mac.update(data.as_ref());
        Ok(mac.finalize().into_bytes().to_vec())
    }

    // 一句话语音识别
    pub async fn recognize_speech(
        &self,
        audio_data: &[u8],
        engine_type: &str,
    ) -> Result<String, String> {
        let endpoint = "https://asr.tencentcloudapi.com/";
        let service = "asr";
        let version = "2019-06-14";
        let action = "SentenceRecognition";
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 确定引擎类型
        let (sub_service_type, eng_ser_vce_type) = match engine_type {
            "16k_zh" => (1, 16),
            "8k_zh" => (1, 8),
            "16k_en" => (1, 16),
            _ => (1, 16),
        };

        // 准备请求数据
        let asr_request = ASRRequest {
            project_id: self.config.app_id.parse::<i64>().unwrap_or(0),
            sub_service_type,
            eng_ser_vice_type: eng_ser_vce_type,
            voice_format: "webm".to_string(),
            usr_audio_key: format!("audio_{}", timestamp),
            data: base64::engine::general_purpose::STANDARD.encode(audio_data),
            data_len: audio_data.len() as i64,
            source_type: 1,
        };

        let payload = serde_json::json!({
            "Action": action,
            "Version": version,
            "Region": self.config.region,
            "ProjectId": asr_request.project_id,
            "SubServiceType": asr_request.sub_service_type,
            "EngSerVceType": asr_request.eng_ser_vice_type,
            "VoiceFormat": asr_request.voice_format,
            "UsrAudioKey": asr_request.usr_audio_key,
            "Data": asr_request.data,
            "DataLen": asr_request.data_len,
            "SourceType": asr_request.source_type,
        });

        let payload_str = serde_json::to_string(&payload).unwrap();

        // 准备请求头
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
        headers.insert("Host".to_string(), "asr.tencentcloudapi.com".to_string());
        headers.insert("X-TC-Action".to_string(), action.to_string());
        headers.insert("X-TC-Timestamp".to_string(), timestamp.to_string());
        headers.insert("X-TC-Version".to_string(), version.to_string());
        headers.insert("X-TC-Region".to_string(), self.config.region.clone());

        // 生成签名
        let signature = self.generate_signature(
            "POST",
            "/",
            "",
            &headers,
            &payload_str,
            timestamp,
        );

        let authorization = format!(
            "TC3-HMAC-SHA256 Credential={}/{}/{}/tc3_request, SignedHeaders=content-type;host;x-tc-action;x-tc-timestamp;x-tc-version;x-tc-region, Signature={}",
            self.config.secret_id,
            chrono::DateTime::from_timestamp(timestamp as i64, 0)
                .unwrap()
                .format("%Y-%m-%d")
                .to_string(),
            service,
            signature
        );

        headers.insert("Authorization".to_string(), authorization);

        // 发送请求
        let mut req = self.client.post(endpoint);
        for (k, v) in headers.iter() {
            req = req.header(k, v);
        }
        let response = req
            .body(payload_str)
            .send()
            .await
            .map_err(|e| format!("请求发送失败: {}", e))?;

        if response.status().is_success() {
            let asr_response: ASRResponse = response
                .json()
                .await
                .map_err(|e| format!("响应解析失败: {}", e))?;

            if let Some(error) = asr_response.error {
                return Err(format!("ASR错误 [{}]: {}", error.code, error.message));
            }

            if let Some(response_data) = asr_response.response {
                return Ok(response_data.text);
            }

            Err("ASR响应为空".to_string())
        } else {
            Err(format!("HTTP请求失败: {}", response.status()))
        }
    }

    // 语音合成
    pub async fn synthesize_speech(
        &self,
        text: &str,
        voice_type: i32,
        volume: f32,
        speed: f32,
        pitch: f32,
        sample_rate: u32,
    ) -> Result<Vec<u8>, String> {
        let endpoint = "https://tts.tencentcloudapi.com/";
        let service = "tts";
        let version = "2019-08-23";
        let action = "CreateTtsTask";
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        // 准备请求数据
        let tts_request = TTSRequest {
            project_id: self.config.app_id.parse::<i64>().unwrap_or(0),
            text: text.to_string(),
            text_type: 1, // 普通文本
            model_type: 1, // 默认模型
            voice_type: voice_type as i64,
            volume: volume as f64,
            speed: speed as f64,
            pitch: pitch as f64,
            primary_language: 1, // 中文
            sample_rate: sample_rate as i64,
            codec: "wav".to_string(),
            enable_subtitle: false,
        };

        let payload = serde_json::json!({
            "Action": action,
            "Version": version,
            "Region": self.config.region,
            "ProjectId": tts_request.project_id,
            "Text": tts_request.text,
            "TextType": tts_request.text_type,
            "ModelType": tts_request.model_type,
            "VoiceType": tts_request.voice_type,
            "Volume": tts_request.volume,
            "Speed": tts_request.speed,
            "Pitch": tts_request.pitch,
            "PrimaryLanguage": tts_request.primary_language,
            "SampleRate": tts_request.sample_rate,
            "Codec": tts_request.codec,
            "EnableSubtitle": tts_request.enable_subtitle,
        });

        let payload_str = serde_json::to_string(&payload).unwrap();

        // 准备请求头
        let mut headers = HashMap::new();
        headers.insert("Content-Type".to_string(), "application/json; charset=utf-8".to_string());
        headers.insert("Host".to_string(), "tts.tencentcloudapi.com".to_string());
        headers.insert("X-TC-Action".to_string(), action.to_string());
        headers.insert("X-TC-Timestamp".to_string(), timestamp.to_string());
        headers.insert("X-TC-Version".to_string(), version.to_string());
        headers.insert("X-TC-Region".to_string(), self.config.region.clone());

        // 生成签名
        let signature = self.generate_signature(
            "POST",
            "/",
            "",
            &headers,
            &payload_str,
            timestamp,
        );

        let authorization = format!(
            "TC3-HMAC-SHA256 Credential={}/{}/{}/tc3_request, SignedHeaders=content-type;host;x-tc-action;x-tc-timestamp;x-tc-version;x-tc-region, Signature={}",
            self.config.secret_id,
            chrono::DateTime::from_timestamp(timestamp as i64, 0)
                .unwrap()
                .format("%Y-%m-%d")
                .to_string(),
            service,
            signature
        );

        headers.insert("Authorization".to_string(), authorization);

        // 发送请求
        let mut req = self.client.post(endpoint);
        for (k, v) in headers.iter() {
            req = req.header(k, v);
        }
        let response = req
            .body(payload_str)
            .send()
            .await
            .map_err(|e| format!("请求发送失败: {}", e))?;

        if response.status().is_success() {
            let tts_response: TTSResponse = response
                .json()
                .await
                .map_err(|e| format!("响应解析失败: {}", e))?;

            if let Some(error) = tts_response.error {
                return Err(format!("TTS错误 [{}]: {}", error.code, error.message));
            }

            if let Some(response_data) = tts_response.response {
                // 解码base64音频数据
                match base64::engine::general_purpose::STANDARD.decode(&response_data.audio) {
                    Ok(audio_bytes) => Ok(audio_bytes),
                    Err(e) => Err(format!("音频数据解码失败: {}", e)),
                }
            } else {
                Err("TTS响应为空".to_string())
            }
        } else {
            Err(format!("HTTP请求失败: {}", response.status()))
        }
    }
}