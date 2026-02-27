use tauri::{AppHandle, Manager};

use crate::ChannelState;
use crate::openclaw::router::rpc_or_fallback;
use super::types::ChannelConfig;
use super::manager;

#[tauri::command]
pub async fn channel_list(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    rpc_or_fallback(&app, "channel.list", serde_json::json!({}), || async move {
        let state = app_ref.state::<ChannelState>();
        let channels = state.db.list()?;
        serde_json::to_value(&channels).map_err(|e| e.to_string())
    })
    .await
}

#[tauri::command]
pub async fn channel_add(
    app: AppHandle,
    channel_type: String,
    name: String,
    config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let ct = channel_type.clone();
    let nm = name.clone();
    let cfg = config.clone();

    rpc_or_fallback(
        &app,
        "channel.add",
        serde_json::json!({ "type": channel_type, "name": name, "config": config }),
        || async move {
            let state = app_ref.state::<ChannelState>();
            let now = chrono::Utc::now().to_rfc3339();
            let channel = ChannelConfig {
                id: uuid::Uuid::new_v4().to_string(),
                channel_type: ct,
                name: nm,
                status: "disconnected".into(),
                config: cfg,
                agent_id: None,
                account_id: None,
                metadata: serde_json::json!({}),
                created_at: now.clone(),
                updated_at: now,
            };
            state.db.add(&channel)?;
            serde_json::to_value(&channel).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn channel_remove(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    rpc_or_fallback(
        &app,
        "channel.remove",
        serde_json::json!({ "id": id }),
        || async move {
            let state = app_ref.state::<ChannelState>();
            state.db.remove(&id2)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

#[tauri::command]
pub async fn channel_update(
    app: AppHandle,
    id: String,
    updates: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    let upd = updates.clone();
    rpc_or_fallback(
        &app,
        "channel.update",
        serde_json::json!({ "id": id, "updates": updates }),
        || async move {
            let state = app_ref.state::<ChannelState>();
            state.db.update(&id2, &upd)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

#[tauri::command]
pub async fn channel_validate(
    app: AppHandle,
    channel_type: String,
    config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let ct = channel_type.clone();
    let cfg = config.clone();
    rpc_or_fallback(
        &app,
        "channel.validate",
        serde_json::json!({ "type": channel_type, "config": config }),
        || async move {
            let valid = manager::validate_channel(&ct, &cfg).await?;
            Ok(serde_json::json!({ "valid": valid }))
        },
    )
    .await
}

#[tauri::command]
pub async fn channel_status(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    rpc_or_fallback(
        &app,
        "channels.status",
        serde_json::json!({ "probe": true }),
        || async move {
            let state = app_ref.state::<ChannelState>();
            let channel = state.db.get(&id2)?;
            match channel {
                Some(ch) => Ok(serde_json::json!({
                    "id": ch.id,
                    "status": ch.status,
                    "agentId": ch.agent_id
                })),
                None => Err(format!("Channel '{}' not found", id2)),
            }
        },
    )
    .await
}

#[tauri::command]
pub async fn channel_bind_agent(
    app: AppHandle,
    channel_id: String,
    agent_id: String,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let cid = channel_id.clone();
    let aid = agent_id.clone();
    rpc_or_fallback(
        &app,
        "channel.bind_agent",
        serde_json::json!({ "channelId": channel_id, "agentId": agent_id }),
        || async move {
            let state = app_ref.state::<ChannelState>();
            state.db.bind_agent(&cid, &aid)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

#[tauri::command]
pub async fn channel_unbind_agent(
    app: AppHandle,
    channel_id: String,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let cid = channel_id.clone();
    rpc_or_fallback(
        &app,
        "channel.unbind_agent",
        serde_json::json!({ "channelId": channel_id }),
        || async move {
            let state = app_ref.state::<ChannelState>();
            state.db.unbind_agent(&cid)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}
