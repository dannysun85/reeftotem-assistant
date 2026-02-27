use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawStatus {
    pub state: String, // "running" | "stopped" | "starting" | "error"
    pub port: u16,
    pub pid: Option<u32>,
    pub error: Option<String>,
}

impl Default for OpenClawStatus {
    fn default() -> Self {
        Self {
            state: "stopped".into(),
            port: 18789,
            pid: None,
            error: None,
        }
    }
}

// ─── OpenClaw Protocol v3 Frame Types ───────────────────

/// Client ID used in the connect handshake.
/// "gateway-client" is the generic client ID that doesn't trigger controlUi origin checks.
pub const CLIENT_ID: &str = "gateway-client";
/// Client mode used in the connect handshake
pub const CLIENT_MODE: &str = "ui";
/// Role used in the connect handshake
pub const CLIENT_ROLE: &str = "operator";
/// Scopes requested in the connect handshake
pub const CLIENT_SCOPES: &[&str] = &["operator.admin"];

/// Request frame sent to Gateway
#[derive(Debug, Serialize)]
pub struct RequestFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub id: String,
    pub method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub params: Option<Value>,
}

/// Response frame received from Gateway
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct ResponseFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub id: String,
    #[serde(default)]
    pub ok: Option<bool>,
    pub payload: Option<Value>,
    pub error: Option<Value>,
}

/// Event frame received from Gateway (push events forwarded via app.emit)
#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct EventFrame {
    #[serde(rename = "type")]
    pub frame_type: String,
    pub event: String,
    pub payload: Option<Value>,
}

/// Build the connect handshake frame for OpenClaw Protocol v3 (token auth only).
pub fn build_connect_frame(token: &str) -> RequestFrame {
    let connect_id = format!("connect-{}", chrono::Utc::now().timestamp_millis());

    let platform = if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "win32"
    } else {
        "linux"
    };

    let params = serde_json::json!({
        "minProtocol": 3,
        "maxProtocol": 3,
        "client": {
            "id": CLIENT_ID,
            "displayName": "Reeftotem",
            "version": env!("CARGO_PKG_VERSION"),
            "platform": platform,
            "mode": CLIENT_MODE,
        },
        "auth": {
            "token": token,
        },
        "caps": ["tool-events"],
        "role": CLIENT_ROLE,
        "scopes": CLIENT_SCOPES,
    });

    RequestFrame {
        frame_type: "req".to_string(),
        id: connect_id,
        method: "connect".to_string(),
        params: Some(params),
    }
}

/// Build an RPC request frame
pub fn build_rpc_frame(method: &str, params: Option<Value>) -> RequestFrame {
    RequestFrame {
        frame_type: "req".to_string(),
        id: uuid::Uuid::new_v4().to_string(),
        method: method.to_string(),
        params,
    }
}
