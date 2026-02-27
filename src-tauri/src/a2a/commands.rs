use tauri::{AppHandle, Manager};

use crate::A2AState;

#[tauri::command]
pub async fn a2a_delegate(
    app: AppHandle,
    from_agent_id: String,
    to_agent_id: String,
    task: String,
    context: Option<String>,
) -> Result<serde_json::Value, String> {
    let state = app.state::<A2AState>();

    // MVP v0.3.0: Create the delegation record with "pending" status.
    // Actual agent-to-agent invocation will be implemented in a future version.
    let delegation = state.db.create_delegation(
        &from_agent_id,
        &to_agent_id,
        &task,
        context.as_deref(),
    )?;

    Ok(delegation)
}

#[tauri::command]
pub async fn a2a_list(app: AppHandle) -> Result<serde_json::Value, String> {
    let state = app.state::<A2AState>();
    state.db.list_delegations()
}

#[tauri::command]
pub async fn a2a_get(app: AppHandle, id: String) -> Result<serde_json::Value, String> {
    let state = app.state::<A2AState>();
    state.db.get_delegation(&id)
}

#[tauri::command]
pub async fn a2a_cancel(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<A2AState>();
    state.db.update_delegation_status(&id, "failed", Some("Cancelled by user"))?;
    Ok(())
}
