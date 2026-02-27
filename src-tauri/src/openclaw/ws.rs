// OpenClaw WebSocket Client — Actor pattern
// Maintains a WS connection to OpenClaw Gateway for RPC calls
// and push event forwarding to the Tauri frontend via app.emit().

use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tauri::{AppHandle, Emitter};
use tokio::sync::{mpsc, oneshot, Mutex};
use tokio_tungstenite::tungstenite::Message;

use super::types;

// ─── Constants ──────────────────────────────────────────

const MAX_RECONNECT_ATTEMPTS: u32 = 10;
const RECONNECT_BASE_DELAY_SECS: u64 = 3;
const RECONNECT_MAX_DELAY_SECS: u64 = 30;
/// How long to wait for the connect.challenge event (seconds)
const CHALLENGE_TIMEOUT_SECS: u64 = 3;

// ─── Actor Command ──────────────────────────────────────

enum BridgeCommand {
    Connect {
        port: u16,
        token: String,
        reply: oneshot::Sender<Result<(), String>>,
    },
    Reconnect {
        port: u16,
        token: String,
    },
    Rpc {
        method: String,
        params: Option<Value>,
        timeout_ms: u64,
        reply: oneshot::Sender<Result<Value, String>>,
    },
    GetStatus {
        reply: oneshot::Sender<Value>,
    },
    Disconnect,
}

// ─── Actor State ────────────────────────────────────────

struct ActorState {
    connected: bool,
    connected_at: Option<i64>,
    port: Option<u16>,
    write_tx: Option<mpsc::Sender<Message>>,
    pending: HashMap<String, oneshot::Sender<Result<Value, String>>>,
    last_token: Option<String>,
    reconnect_attempts: u32,
    cmd_tx: Option<mpsc::Sender<BridgeCommand>>,
}

impl ActorState {
    fn new() -> Self {
        Self {
            connected: false,
            connected_at: None,
            port: None,
            write_tx: None,
            pending: HashMap::new(),
            last_token: None,
            reconnect_attempts: 0,
            cmd_tx: None,
        }
    }
}

// ─── Public Client Handle ───────────────────────────────

pub struct WsBridge {
    cmd_tx: mpsc::Sender<BridgeCommand>,
    actor_state: Arc<Mutex<ActorState>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
}

impl WsBridge {
    pub fn new() -> Self {
        let (cmd_tx, cmd_rx) = mpsc::channel(64);
        let actor_state = Arc::new(Mutex::new(ActorState::new()));
        let app_handle: Arc<Mutex<Option<AppHandle>>> = Arc::new(Mutex::new(None));

        // Store cmd_tx in actor state so read tasks can request reconnection
        {
            let state = actor_state.clone();
            let tx = cmd_tx.clone();
            tauri::async_runtime::spawn(async move {
                state.lock().await.cmd_tx = Some(tx);
            });
        }

        let state_clone = actor_state.clone();
        let app_clone = app_handle.clone();

        // Spawn actor task
        tauri::async_runtime::spawn(actor_loop(cmd_rx, state_clone, app_clone));

        Self {
            cmd_tx,
            actor_state,
            app_handle,
        }
    }

    /// Set the AppHandle for event forwarding
    pub async fn set_app_handle(&self, app: AppHandle) {
        let mut handle = self.app_handle.lock().await;
        *handle = Some(app);
    }

    /// Connect to the Gateway WebSocket
    pub async fn connect(&self, port: u16, token: &str) -> Result<(), String> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(BridgeCommand::Connect {
                port,
                token: token.to_string(),
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Actor channel closed".to_string())?;
        reply_rx
            .await
            .map_err(|_| "Reply channel closed".to_string())?
    }

    /// Make an RPC call
    pub async fn rpc(
        &self,
        method: &str,
        params: Option<Value>,
        timeout_ms: u64,
    ) -> Result<Value, String> {
        let (reply_tx, reply_rx) = oneshot::channel();
        self.cmd_tx
            .send(BridgeCommand::Rpc {
                method: method.to_string(),
                params,
                timeout_ms,
                reply: reply_tx,
            })
            .await
            .map_err(|_| "Actor channel closed".to_string())?;
        reply_rx
            .await
            .map_err(|_| "Reply channel closed".to_string())?
    }

    /// Check connection status
    pub async fn is_connected(&self) -> bool {
        self.actor_state.lock().await.connected
    }

    /// Get status as JSON
    #[allow(dead_code)]
    pub async fn status(&self) -> Value {
        let (reply_tx, reply_rx) = oneshot::channel();
        if self
            .cmd_tx
            .send(BridgeCommand::GetStatus { reply: reply_tx })
            .await
            .is_err()
        {
            return json!({ "connected": false });
        }
        reply_rx.await.unwrap_or(json!({ "connected": false }))
    }

    /// Disconnect the WebSocket bridge
    pub async fn disconnect(&self) {
        let _ = self.cmd_tx.send(BridgeCommand::Disconnect).await;
    }
}

// ─── Actor Loop ─────────────────────────────────────────

async fn actor_loop(
    mut cmd_rx: mpsc::Receiver<BridgeCommand>,
    state: Arc<Mutex<ActorState>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
) {
    while let Some(cmd) = cmd_rx.recv().await {
        match cmd {
            BridgeCommand::Connect {
                port,
                token,
                reply,
            } => {
                let result = do_connect(port, &token, state.clone(), app_handle.clone()).await;
                let _ = reply.send(result);
            }
            BridgeCommand::Reconnect { port, token } => {
                match do_connect(port, &token, state.clone(), app_handle.clone()).await {
                    Ok(()) => {
                        // Success — do_connect already emits "running" status
                    }
                    Err(e) => {
                        let attempts = state.lock().await.reconnect_attempts;
                        if let Some(app) = app_handle.lock().await.as_ref() {
                            if attempts >= MAX_RECONNECT_ATTEMPTS {
                                let _ = app.emit(
                                    "openclaw_status",
                                    json!({
                                        "state": "error",
                                        "port": port,
                                        "error": format!("Reconnect failed after {} attempts: {}", MAX_RECONNECT_ATTEMPTS, e)
                                    }),
                                );
                            }
                        }
                    }
                }
            }
            BridgeCommand::Rpc {
                method,
                params,
                timeout_ms,
                reply,
            } => {
                let result = do_rpc(&method, params, timeout_ms, state.clone()).await;
                let _ = reply.send(result);
            }
            BridgeCommand::GetStatus { reply } => {
                let s = state.lock().await;
                let status = json!({
                    "connected": s.connected,
                    "port": s.port,
                    "connectedAt": s.connected_at,
                });
                let _ = reply.send(status);
            }
            BridgeCommand::Disconnect => {
                let mut s = state.lock().await;
                s.connected = false;
                s.connected_at = None;
                s.write_tx = None;
                s.reconnect_attempts = MAX_RECONNECT_ATTEMPTS; // prevent auto-reconnect
                for (_, reply) in s.pending.drain() {
                    let _ = reply.send(Err("Disconnected".to_string()));
                }
            }
        }
    }
}

/// Perform WebSocket connection + OpenClaw v3 handshake
async fn do_connect(
    port: u16,
    token: &str,
    state: Arc<Mutex<ActorState>>,
    app_handle: Arc<Mutex<Option<AppHandle>>>,
) -> Result<(), String> {
    let url = format!("ws://127.0.0.1:{}/ws", port);
    app_info!("WsBridge: connecting to {}", url);

    let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
        .await
        .map_err(|e| format!("WebSocket connect failed: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // Phase 1: Wait for connect.challenge event (non-fatal timeout)
    let _nonce = wait_for_challenge(&mut read).await;

    // Phase 2: Send connect handshake (token auth only)
    let connect_frame = types::build_connect_frame(token);
    let connect_id = connect_frame.id.clone();
    let frame_json = serde_json::to_string(&connect_frame)
        .map_err(|e| format!("Serialize connect frame: {}", e))?;
    write
        .send(Message::Text(frame_json))
        .await
        .map_err(|e| format!("Send connect frame: {}", e))?;

    // Phase 3: Wait for handshake response (up to 10s)
    let handshake_result = tokio::time::timeout(
        Duration::from_secs(10),
        wait_for_handshake(&mut read, &connect_id),
    )
    .await
    .map_err(|_| "Connect handshake timeout".to_string())?;

    handshake_result?;

    app_info!("WsBridge: handshake completed");

    // Set up writer channel
    let (write_tx, mut write_rx) = mpsc::channel::<Message>(64);

    // Spawn write task
    tokio::spawn(async move {
        while let Some(msg) = write_rx.recv().await {
            if write.send(msg).await.is_err() {
                break;
            }
        }
    });

    // Update state — connection successful, reset reconnect counter
    let cmd_tx_for_read = {
        let mut s = state.lock().await;
        s.connected = true;
        s.connected_at = Some(chrono::Utc::now().timestamp_millis());
        s.port = Some(port);
        s.write_tx = Some(write_tx);
        s.last_token = Some(token.to_string());
        s.reconnect_attempts = 0;
        s.cmd_tx.clone()
    };

    // Emit "running" status to frontend
    if let Some(app) = app_handle.lock().await.as_ref() {
        let _ = app.emit(
            "openclaw_status",
            json!({ "state": "running", "port": port }),
        );
    }

    app_info!("WsBridge: connected to port {}", port);

    // Spawn read task
    let state_clone = state.clone();
    let app_clone = app_handle.clone();
    tokio::spawn(async move {
        while let Some(msg_result) = read.next().await {
            match msg_result {
                Ok(Message::Text(text)) => {
                    handle_incoming_message(&text, &state_clone, &app_clone).await;
                }
                Ok(Message::Close(_)) | Err(_) => {
                    // Connection closed — clean up pending requests
                    let (reconnect_port, reconnect_token, attempts) = {
                        let mut s = state_clone.lock().await;
                        s.connected = false;
                        s.connected_at = None;
                        s.write_tx = None;
                        for (_, reply) in s.pending.drain() {
                            let _ = reply.send(Err("Connection closed".to_string()));
                        }
                        (s.port, s.last_token.clone(), s.reconnect_attempts)
                    };

                    app_info!("WsBridge: connection closed");

                    // Emit disconnection event to frontend
                    if let Some(app) = app_clone.lock().await.as_ref() {
                        let _ = app.emit(
                            "openclaw_status",
                            json!({ "state": "reconnecting", "port": reconnect_port }),
                        );
                    }

                    // Auto-reconnect via actor command channel
                    if attempts < MAX_RECONNECT_ATTEMPTS {
                        if let (Some(r_port), Some(r_token), Some(tx)) =
                            (reconnect_port, reconnect_token, cmd_tx_for_read.clone())
                        {
                            // Increment attempt counter
                            state_clone.lock().await.reconnect_attempts = attempts + 1;

                            // Spawn a delay task that sends Reconnect command
                            tokio::spawn(async move {
                                let delay_secs = (RECONNECT_BASE_DELAY_SECS
                                    * 2u64.pow(attempts))
                                .min(RECONNECT_MAX_DELAY_SECS);
                                app_info!(
                                    "WsBridge: reconnecting in {}s (attempt {}/{})",
                                    delay_secs,
                                    attempts + 1,
                                    MAX_RECONNECT_ATTEMPTS
                                );
                                tokio::time::sleep(Duration::from_secs(delay_secs)).await;

                                let _ = tx
                                    .send(BridgeCommand::Reconnect {
                                        port: r_port,
                                        token: r_token,
                                    })
                                    .await;
                            });
                        }
                    }

                    break;
                }
                _ => {} // Ping/Pong/Binary ignored
            }
        }
    });

    Ok(())
}

/// Wait for the connect.challenge event sent by Gateway after WS upgrade.
/// Returns the nonce UUID if received, None on timeout.
async fn wait_for_challenge(
    read: &mut (impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
             + Unpin),
) -> Option<String> {
    match tokio::time::timeout(Duration::from_secs(CHALLENGE_TIMEOUT_SECS), read.next()).await {
        Ok(Some(Ok(Message::Text(text)))) => {
            if let Ok(json) = serde_json::from_str::<Value>(&text) {
                if json.get("type").and_then(|v| v.as_str()) == Some("event")
                    && json.get("event").and_then(|v| v.as_str()) == Some("connect.challenge")
                {
                    return json
                        .get("payload")
                        .and_then(|p| p.get("nonce"))
                        .and_then(|n| n.as_str())
                        .map(|s| s.to_string());
                }
            }
            None
        }
        _ => None,
    }
}

/// Wait for handshake response matching connect_id
async fn wait_for_handshake(
    read: &mut (impl StreamExt<Item = Result<Message, tokio_tungstenite::tungstenite::Error>>
             + Unpin),
    connect_id: &str,
) -> Result<(), String> {
    while let Some(msg_result) = read.next().await {
        match msg_result {
            Ok(Message::Text(text)) => {
                if let Ok(json) = serde_json::from_str::<Value>(&text) {
                    if json.get("type").and_then(|v| v.as_str()) == Some("res")
                        && json.get("id").and_then(|v| v.as_str()) == Some(connect_id)
                    {
                        if json.get("ok") == Some(&Value::Bool(false)) {
                            let err = json
                                .get("error")
                                .map(|e| e.to_string())
                                .unwrap_or_else(|| "Handshake rejected".to_string());
                            return Err(err);
                        }
                        return Ok(());
                    }
                }
            }
            Ok(Message::Close(_)) | Err(_) => {
                return Err("Connection closed during handshake".to_string());
            }
            _ => {}
        }
    }
    Err("Stream ended during handshake".to_string())
}

/// Handle an incoming WS message — route responses to pending requests,
/// and forward push events to the frontend via Tauri emit.
async fn handle_incoming_message(
    text: &str,
    state: &Arc<Mutex<ActorState>>,
    app_handle: &Arc<Mutex<Option<AppHandle>>>,
) {
    let frame: Value = match serde_json::from_str(text) {
        Ok(v) => v,
        Err(_) => return,
    };

    let frame_type = frame.get("type").and_then(|v| v.as_str()).unwrap_or("");

    // Handle RPC responses
    if frame_type == "res" {
        let id = match frame.get("id").and_then(|v| v.as_str()) {
            Some(id) => id.to_string(),
            None => return,
        };

        let mut s = state.lock().await;
        if let Some(reply) = s.pending.remove(&id) {
            if frame.get("ok") == Some(&Value::Bool(false)) || frame.get("error").is_some() {
                let error = frame
                    .get("error")
                    .and_then(|e| {
                        e.get("message")
                            .and_then(|m| m.as_str())
                            .map(|s| s.to_string())
                            .or_else(|| Some(e.to_string()))
                    })
                    .unwrap_or_else(|| "Unknown error".to_string());
                let _ = reply.send(Err(error));
            } else {
                let payload = frame
                    .get("payload")
                    .cloned()
                    .unwrap_or_else(|| frame.clone());
                let _ = reply.send(Ok(payload));
            }
        }
        return;
    }

    // Handle push events — forward to frontend via Tauri emit
    if frame_type != "event" {
        return;
    }

    let app_guard = app_handle.lock().await;
    let app = match app_guard.as_ref() {
        Some(app) => app,
        None => return,
    };

    let event_name = frame
        .get("event")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    let payload = frame
        .get("payload")
        .cloned()
        .unwrap_or(Value::Null);

    // Map OpenClaw event names → Tauri event names
    match event_name {
        "tick" | "" => { /* ignore heartbeat / unknown */ }
        "chat.delta" => {
            let _ = app.emit("ai_chat_delta", &payload);
        }
        "chat.thinking" => {
            let mut p = payload;
            if let Some(obj) = p.as_object_mut() {
                obj.insert("thinking".into(), Value::Bool(true));
            }
            let _ = app.emit("ai_chat_delta", &p);
        }
        "chat.tool_use" => {
            let _ = app.emit("ai_chat_tool_call", &payload);
        }
        "chat.tool_result" => {
            let _ = app.emit("ai_chat_tool_result", &payload);
        }
        "chat.final" => {
            let _ = app.emit("ai_chat_final", &payload);
        }
        "chat.error" => {
            let _ = app.emit("ai_chat_error", &payload);
        }
        "chat" => {
            // Generic chat event
            let _ = app.emit("ai_chat_delta", &payload);
        }
        "channel.status" => {
            let _ = app.emit("channel_status_changed", &payload);
        }
        "cron.status" => {
            let _ = app.emit("cron_status_changed", &payload);
        }
        _other => {
            // Unknown event — silently ignore
        }
    }
}

/// Send an RPC request and wait for the response
async fn do_rpc(
    method: &str,
    params: Option<Value>,
    timeout_ms: u64,
    state: Arc<Mutex<ActorState>>,
) -> Result<Value, String> {
    let frame = types::build_rpc_frame(method, params);
    let request_id = frame.id.clone();
    let frame_json = serde_json::to_string(&frame)
        .map_err(|e| format!("Serialize RPC frame: {}", e))?;

    let (reply_tx, reply_rx) = oneshot::channel();

    // Register pending request and send
    {
        let mut s = state.lock().await;
        if !s.connected {
            return Err("OpenClaw not connected".to_string());
        }
        if s.pending.len() >= 1000 {
            return Err("Too many pending RPC requests (limit: 1000)".to_string());
        }
        let write_tx = s
            .write_tx
            .as_ref()
            .ok_or("No write channel")?
            .clone();
        s.pending.insert(request_id.clone(), reply_tx);
        drop(s);

        write_tx
            .send(Message::Text(frame_json))
            .await
            .map_err(|_| "Failed to send RPC request".to_string())?;
    }

    // Wait with timeout
    match tokio::time::timeout(Duration::from_millis(timeout_ms), reply_rx).await {
        Ok(Ok(result)) => result,
        Ok(Err(_)) => {
            state.lock().await.pending.remove(&request_id);
            Err(format!("RPC reply channel closed: {}", method))
        }
        Err(_) => {
            state.lock().await.pending.remove(&request_id);
            Err(format!("RPC timeout: {}", method))
        }
    }
}
