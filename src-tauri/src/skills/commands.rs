use tauri::{AppHandle, Manager};

use crate::SkillState;
use crate::openclaw::router::rpc_or_fallback;
use crate::openclaw::clawhub;

#[tauri::command]
pub async fn skill_list(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    rpc_or_fallback(
        &app,
        "skills.status",
        serde_json::json!({ "agentId": serde_json::Value::Null }),
        || async move {
            let state = app_ref.state::<SkillState>();
            let skills = state.db.list()?;
            serde_json::to_value(&skills).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn skill_toggle(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    rpc_or_fallback(
        &app,
        "skills.update",
        serde_json::json!({ "skillKey": id, "enabled": enabled }),
        || async move {
            let state = app_ref.state::<SkillState>();
            state.db.toggle(&id2, enabled)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

#[tauri::command]
pub async fn skill_update_config(
    app: AppHandle,
    id: String,
    config: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    let cfg = config.clone();

    let mut params = serde_json::json!({ "skillKey": id });
    if let Some(obj) = config.as_object() {
        for (k, v) in obj {
            params[k] = v.clone();
        }
    }

    rpc_or_fallback(
        &app,
        "skills.update",
        params,
        || async move {
            let state = app_ref.state::<SkillState>();
            state.db.update_config(&id2, &cfg)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

// ── Marketplace commands (use OpenClaw CLI) ──

#[tauri::command]
pub async fn skill_search_marketplace(
    _app: AppHandle,
    query: String,
) -> Result<serde_json::Value, String> {
    clawhub::openclaw_skills_list(&query).await
}

#[tauri::command]
pub async fn skill_install(
    _app: AppHandle,
    slug: String,
) -> Result<serde_json::Value, String> {
    clawhub::clawhub_install(&slug).await
}

#[tauri::command]
pub async fn skill_uninstall(
    _app: AppHandle,
    id: String,
) -> Result<serde_json::Value, String> {
    clawhub::clawhub_uninstall(&id)
}
