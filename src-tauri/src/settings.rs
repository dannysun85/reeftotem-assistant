use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// AI 服务提供者配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "type", alias = "provider_type")]
    pub provider_type: String,
    pub enabled: bool,
    #[serde(rename = "baseUrl", alias = "base_url", default)]
    pub base_url: Option<String>,
    pub model: Option<String>,
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: String,
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: String,
}

/// Provider with API key info (returned to frontend)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderWithKeyInfo {
    #[serde(flatten)]
    pub provider: ProviderConfig,
    #[serde(rename = "hasKey")]
    pub has_key: bool,
    #[serde(rename = "keyMasked")]
    pub key_masked: Option<String>,
}

/// Agent 配置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub id: String,
    pub name: String,
    pub avatar: String,
    pub description: String,
    #[serde(rename = "systemPrompt", alias = "system_prompt", default)]
    pub system_prompt: String,
    #[serde(rename = "providerId", alias = "provider_id", default)]
    pub provider_id: Option<String>,
    #[serde(default)]
    pub model: String,
    #[serde(default = "default_temperature")]
    pub temperature: f64,
    #[serde(rename = "maxTokens", alias = "max_tokens", default)]
    pub max_tokens: Option<i64>,
    #[serde(rename = "skillIds", alias = "skill_ids", default)]
    pub skill_ids: Vec<String>,
    #[serde(rename = "knowledgeBaseIds", alias = "knowledge_base_ids", default)]
    pub knowledge_base_ids: Vec<String>,
    #[serde(rename = "channelBindings", alias = "channel_bindings", default)]
    pub channel_bindings: Vec<String>,
    #[serde(rename = "isDefault", alias = "is_default", default)]
    pub is_default: bool,
    #[serde(rename = "createdAt", alias = "created_at")]
    pub created_at: String,
    #[serde(rename = "updatedAt", alias = "updated_at")]
    pub updated_at: String,
}

fn default_temperature() -> f64 {
    0.7
}

/// 应用全局设置
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub theme: String,
    pub language: String,
    pub providers: Vec<ProviderConfig>,
    #[serde(rename = "defaultProviderId", default)]
    pub default_provider_id: Option<String>,
    #[serde(default)]
    pub agents: Vec<AgentConfig>,
    #[serde(rename = "activeAgentId", default)]
    pub active_agent_id: Option<String>,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            theme: "system".to_string(),
            language: "zh-CN".to_string(),
            providers: Vec::new(),
            default_provider_id: None,
            agents: Vec::new(),
            active_agent_id: None,
        }
    }
}

/// 获取 settings.json 的完整路径
fn settings_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    Ok(data_dir.join("settings.json"))
}

/// 获取 api_keys.json 的完整路径
fn api_keys_path(app_handle: &AppHandle) -> Result<PathBuf, String> {
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取应用数据目录: {}", e))?;
    Ok(data_dir.join("api_keys.json"))
}

/// 从磁盘加载设置，文件不存在时返回默认值
pub fn load_settings(app_handle: &AppHandle) -> Result<AppSettings, String> {
    let path = settings_path(app_handle)?;

    if !path.exists() {
        app_info!("设置文件不存在，返回默认设置: {:?}", path);
        return Ok(AppSettings::default());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取设置文件失败: {}", e))?;

    let settings: AppSettings = serde_json::from_str(&content)
        .map_err(|e| format!("解析设置文件失败: {}", e))?;

    app_info!("已加载设置文件: {:?}", path);
    Ok(settings)
}

/// 将设置写入磁盘（自动创建目录）
pub fn save_settings(app_handle: &AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app_handle)?;

    // 确保父目录存在
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建设置目录失败: {}", e))?;
    }

    let content = serde_json::to_string_pretty(settings)
        .map_err(|e| format!("序列化设置失败: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("写入设置文件失败: {}", e))?;

    app_info!("已保存设置文件: {:?}", path);
    Ok(())
}

// ========== API Key 管理 ==========

/// 加载所有 API keys
pub fn load_api_keys(app_handle: &AppHandle) -> Result<HashMap<String, String>, String> {
    let path = api_keys_path(app_handle)?;

    if !path.exists() {
        return Ok(HashMap::new());
    }

    let content = fs::read_to_string(&path)
        .map_err(|e| format!("读取 API keys 文件失败: {}", e))?;

    let keys: HashMap<String, String> = serde_json::from_str(&content)
        .map_err(|e| format!("解析 API keys 文件失败: {}", e))?;

    Ok(keys)
}

/// 保存所有 API keys
pub fn save_api_keys(app_handle: &AppHandle, keys: &HashMap<String, String>) -> Result<(), String> {
    let path = api_keys_path(app_handle)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("创建 API keys 目录失败: {}", e))?;
    }

    let content = serde_json::to_string_pretty(keys)
        .map_err(|e| format!("序列化 API keys 失败: {}", e))?;

    fs::write(&path, content)
        .map_err(|e| format!("写入 API keys 文件失败: {}", e))?;

    Ok(())
}

/// 掩码 API key: "sk-ant-abc123xyz" → "sk-an...xyz"
pub fn mask_api_key(key: &str) -> String {
    if key.len() <= 8 {
        return "***".to_string();
    }
    let prefix = &key[..5];
    let suffix = &key[key.len() - 3..];
    format!("{}...{}", prefix, suffix)
}
