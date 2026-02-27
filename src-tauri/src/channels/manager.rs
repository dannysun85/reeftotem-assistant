use tauri::{AppHandle, Emitter};

/// Validate channel credentials based on type
pub async fn validate_channel(
    channel_type: &str,
    config: &serde_json::Value,
) -> Result<bool, String> {
    match channel_type {
        "telegram" => {
            let token = config
                .get("botToken")
                .and_then(|t| t.as_str())
                .ok_or("Missing botToken")?;

            let url = format!("https://api.telegram.org/bot{}/getMe", token);
            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;

            let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            Ok(json.get("ok").and_then(|o| o.as_bool()).unwrap_or(false))
        }
        "discord" => {
            let token = config
                .get("botToken")
                .and_then(|t| t.as_str())
                .ok_or("Missing botToken")?;

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;

            let resp = client
                .get("https://discord.com/api/v10/users/@me")
                .header("Authorization", format!("Bot {}", token))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            Ok(resp.status().is_success())
        }
        "feishu" => {
            let app_id = config
                .get("appId")
                .and_then(|a| a.as_str())
                .ok_or("Missing appId")?;
            let app_secret = config
                .get("appSecret")
                .and_then(|s| s.as_str())
                .ok_or("Missing appSecret")?;

            let client = reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .map_err(|e| e.to_string())?;

            let resp = client
                .post("https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal")
                .json(&serde_json::json!({
                    "app_id": app_id,
                    "app_secret": app_secret
                }))
                .send()
                .await
                .map_err(|e| e.to_string())?;

            let json: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
            Ok(json.get("code").and_then(|c| c.as_i64()).unwrap_or(-1) == 0)
        }
        // For other types, just check that required fields are present
        _ => Ok(!config.is_null()),
    }
}

/// Emit channel status change event to frontend
#[allow(dead_code)]
pub fn emit_channel_status(app: &AppHandle, channel_id: &str, status: &str) {
    #[derive(serde::Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    struct ChannelStatusEvent {
        channel_id: String,
        status: String,
    }

    let _ = app.emit(
        "channel_status_changed",
        ChannelStatusEvent {
            channel_id: channel_id.to_string(),
            status: status.to_string(),
        },
    );
}

/// Emit incoming message event to frontend
#[allow(dead_code)]
pub fn emit_channel_message(app: &AppHandle, channel_id: &str, content: &str, sender: &str) {
    #[derive(serde::Serialize, Clone)]
    #[serde(rename_all = "camelCase")]
    struct ChannelMessageEvent {
        channel_id: String,
        content: String,
        sender: String,
        timestamp: i64,
    }

    let _ = app.emit(
        "channel_message_received",
        ChannelMessageEvent {
            channel_id: channel_id.to_string(),
            content: content.to_string(),
            sender: sender.to_string(),
            timestamp: chrono::Utc::now().timestamp(),
        },
    );
}
