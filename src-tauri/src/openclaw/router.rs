use std::future::Future;
use tauri::{AppHandle, Manager};

use crate::OpenClawState;

/// Call OpenClaw RPC via WsBridge. Returns `Err` when not connected.
pub async fn rpc_or_err(
    app: &AppHandle,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let state = app.state::<OpenClawState>();
    let bridge = &state.ws_bridge;
    if !bridge.is_connected().await {
        return Err("OpenClaw is not connected".to_string());
    }
    bridge.rpc(method, Some(params), 30_000).await
}

/// Try OpenClaw RPC first via WsBridge; if offline or the call fails,
/// execute the `fallback` closure instead.
pub async fn rpc_or_fallback<F, Fut>(
    app: &AppHandle,
    method: &str,
    params: serde_json::Value,
    fallback: F,
) -> Result<serde_json::Value, String>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<serde_json::Value, String>>,
{
    let state = app.state::<OpenClawState>();
    let bridge = &state.ws_bridge;
    if bridge.is_connected().await {
        match bridge.rpc(method, Some(params), 30_000).await {
            Ok(v) => return Ok(v),
            Err(e) => {
                app_warn!("OpenClaw RPC '{}' failed, using local fallback: {}", method, e);
            }
        }
    }
    fallback().await
}
