use tauri::{AppHandle, Manager};

use crate::CronState;
use crate::openclaw::router::{rpc_or_err, rpc_or_fallback};
use super::types::CronJobConfig;

#[tauri::command]
pub async fn cron_list(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    rpc_or_fallback(
        &app,
        "cron.list",
        serde_json::json!({ "includeDisabled": true }),
        || async move {
            let state = app_ref.state::<CronState>();
            let jobs = state.db.list()?;
            serde_json::to_value(&jobs).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn cron_add(
    app: AppHandle,
    name: String,
    message: String,
    schedule: String,
    target: serde_json::Value,
    enabled: Option<bool>,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let nm = name.clone();
    let msg = message.clone();
    let sched = schedule.clone();
    let tgt = target.clone();

    rpc_or_fallback(
        &app,
        "cron.add",
        serde_json::json!({
            "name": name,
            "message": message,
            "schedule": schedule,
            "sessionTarget": target,
            "wakeMode": "always",
            "payload": {},
            "enabled": enabled.unwrap_or(true),
        }),
        || async move {
            let state = app_ref.state::<CronState>();
            let now = chrono::Utc::now().to_rfc3339();
            let job = CronJobConfig {
                id: uuid::Uuid::new_v4().to_string(),
                name: nm,
                message: msg,
                schedule: sched,
                enabled: enabled.unwrap_or(true),
                target: tgt,
                last_run: None,
                next_run: None,
                created_at: now.clone(),
                updated_at: now,
            };
            state.db.add(&job)?;
            serde_json::to_value(&job).map_err(|e| e.to_string())
        },
    )
    .await
}

#[tauri::command]
pub async fn cron_remove(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    rpc_or_fallback(
        &app,
        "cron.remove",
        serde_json::json!({ "jobId": id }),
        || async move {
            let state = app_ref.state::<CronState>();
            state.db.remove(&id2)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

#[tauri::command]
pub async fn cron_toggle(
    app: AppHandle,
    id: String,
    enabled: bool,
) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    let id2 = id.clone();
    rpc_or_fallback(
        &app,
        "cron.update",
        serde_json::json!({ "jobId": id, "patch": { "enabled": enabled } }),
        || async move {
            let state = app_ref.state::<CronState>();
            state.db.toggle(&id2, enabled)?;
            Ok(serde_json::json!({ "success": true }))
        },
    )
    .await
}

/// Run a cron job immediately — requires OpenClaw for real channel delivery.
#[tauri::command]
pub async fn cron_run(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    rpc_or_err(&app, "cron.run", serde_json::json!({ "jobId": id })).await
}

#[tauri::command]
pub async fn cron_status(app: AppHandle) -> Result<serde_json::Value, String> {
    let app_ref = app.clone();
    rpc_or_fallback(&app, "cron.status", serde_json::json!({}), || async move {
        let state = app_ref.state::<CronState>();
        let jobs = state.db.list()?;
        let active = jobs.iter().filter(|j| j.enabled).count();
        Ok(serde_json::json!({
            "total": jobs.len(),
            "active": active,
            "status": "running"
        }))
    })
    .await
}
