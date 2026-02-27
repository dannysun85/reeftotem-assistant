use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Manager, State};

use super::types::*;
use super::engine;

// ========== Workflow CRUD ==========

#[tauri::command]
pub async fn workflow_list(state: State<'_, crate::WorkflowState>) -> Result<Vec<WorkflowConfig>, String> {
    state.db.list_workflows()
}

#[tauri::command]
pub async fn workflow_get(state: State<'_, crate::WorkflowState>, id: String) -> Result<WorkflowConfig, String> {
    state.db.get_workflow(&id)
}

#[tauri::command]
pub async fn workflow_create(state: State<'_, crate::WorkflowState>, config: serde_json::Value) -> Result<WorkflowConfig, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    let wf = WorkflowConfig {
        id: id.clone(),
        name: config.get("name").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
        description: config.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        icon: config.get("icon").and_then(|v| v.as_str()).unwrap_or("⚡").to_string(),
        nodes: config.get("nodes")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or_default(),
        edges: config.get("edges")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or_default(),
        triggers: config.get("triggers")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or_default(),
        enabled: config.get("enabled").and_then(|v| v.as_bool()).unwrap_or(true),
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.create_workflow(&wf)?;
    Ok(wf)
}

#[tauri::command]
pub async fn workflow_update(state: State<'_, crate::WorkflowState>, id: String, config: serde_json::Value) -> Result<WorkflowConfig, String> {
    let existing = state.db.get_workflow(&id)?;

    let wf = WorkflowConfig {
        id: id.clone(),
        name: config.get("name").and_then(|v| v.as_str()).unwrap_or(&existing.name).to_string(),
        description: config.get("description").and_then(|v| v.as_str()).unwrap_or(&existing.description).to_string(),
        icon: config.get("icon").and_then(|v| v.as_str()).unwrap_or(&existing.icon).to_string(),
        nodes: config.get("nodes")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or(existing.nodes),
        edges: config.get("edges")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or(existing.edges),
        triggers: config.get("triggers")
            .map(|v| serde_json::from_value(v.clone()).unwrap_or_default())
            .unwrap_or(existing.triggers),
        enabled: config.get("enabled").and_then(|v| v.as_bool()).unwrap_or(existing.enabled),
        created_at: existing.created_at,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    state.db.update_workflow(&id, &wf)?;
    Ok(wf)
}

#[tauri::command]
pub async fn workflow_delete(state: State<'_, crate::WorkflowState>, id: String) -> Result<bool, String> {
    state.db.delete_workflow(&id)?;
    Ok(true)
}

// ========== Run Management ==========

#[tauri::command]
pub async fn workflow_list_runs(state: State<'_, crate::WorkflowState>, workflow_id: String, limit: Option<i64>) -> Result<Vec<WorkflowRun>, String> {
    state.db.list_runs(&workflow_id, limit)
}

#[tauri::command]
pub async fn workflow_get_run(state: State<'_, crate::WorkflowState>, id: String) -> Result<WorkflowRun, String> {
    state.db.get_run(&id)
}

#[tauri::command]
pub async fn workflow_delete_run(state: State<'_, crate::WorkflowState>, id: String) -> Result<bool, String> {
    state.db.delete_run(&id)?;
    Ok(true)
}

#[tauri::command]
pub async fn workflow_clear_runs(state: State<'_, crate::WorkflowState>, workflow_id: String) -> Result<bool, String> {
    state.db.clear_runs(&workflow_id)?;
    Ok(true)
}

// ========== Execution ==========

#[tauri::command]
pub async fn workflow_run(
    app: AppHandle,
    state: State<'_, crate::WorkflowState>,
    workflow_id: String,
    input: Option<String>,
) -> Result<String, String> {
    let workflow = state.db.get_workflow(&workflow_id)?;
    let run_id = uuid::Uuid::new_v4().to_string();
    let cancel = Arc::new(AtomicBool::new(false));

    // Store cancel flag
    if let Ok(mut flags) = state.cancel_flags.lock() {
        flags.insert(run_id.clone(), cancel.clone());
    }

    let run_id_clone = run_id.clone();
    let app_clone = app.clone();

    tokio::spawn(async move {
        // Scope the state borrow so it drops before the spawned future ends
        let result = {
            let ws = app_clone.state::<crate::WorkflowState>();
            engine::execute_workflow(
                app_clone.clone(),
                &ws.db,
                workflow,
                input,
                cancel,
            ).await
        };

        if let Err(e) = &result {
            crate::app_error!("Workflow execution failed: {}", e);
        }

        // Cleanup cancel flag
        let ws = app_clone.state::<crate::WorkflowState>();
        let _ = ws.cancel_flags.lock().map(|mut flags| {
            flags.remove(&run_id_clone);
        });
    });

    Ok(run_id)
}

#[tauri::command]
pub async fn workflow_cancel(state: State<'_, crate::WorkflowState>, run_id: String) -> Result<bool, String> {
    if let Ok(flags) = state.cancel_flags.lock() {
        if let Some(cancel) = flags.get(&run_id) {
            cancel.store(true, Ordering::Relaxed);
            return Ok(true);
        }
    }
    Ok(false)
}
