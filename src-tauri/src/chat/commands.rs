use tauri::{AppHandle, Manager};
use serde_json::Value;

use crate::ChatState;

#[tauri::command]
pub async fn chat_session_list(app: AppHandle) -> Result<Value, String> {
    let state = app.state::<ChatState>();
    let sessions = state.db.list_sessions()?;
    Ok(Value::Array(sessions))
}

#[tauri::command]
pub async fn chat_session_create(
    app: AppHandle,
    title: String,
    agent_id: Option<String>,
    provider_id: Option<String>,
    model: Option<String>,
) -> Result<Value, String> {
    let state = app.state::<ChatState>();
    state.db.create_session(
        &title,
        agent_id.as_deref(),
        provider_id.as_deref(),
        model.as_deref(),
    )
}

#[tauri::command]
pub async fn chat_session_rename(
    app: AppHandle,
    id: String,
    title: String,
) -> Result<Value, String> {
    let state = app.state::<ChatState>();
    state.db.rename_session(&id, &title)?;
    Ok(serde_json::json!({ "success": true }))
}

#[tauri::command]
pub async fn chat_session_delete(app: AppHandle, id: String) -> Result<(), String> {
    let state = app.state::<ChatState>();
    state.db.delete_session(&id)
}

#[tauri::command]
pub async fn chat_message_list(
    app: AppHandle,
    session_id: String,
) -> Result<Value, String> {
    let state = app.state::<ChatState>();
    let messages = state.db.list_messages(&session_id)?;
    Ok(Value::Array(messages))
}

#[tauri::command]
pub async fn chat_message_save(
    app: AppHandle,
    session_id: String,
    role: String,
    content: String,
    thinking: Option<String>,
    tool_calls: Option<Value>,
    attachments: Option<Value>,
) -> Result<Value, String> {
    let state = app.state::<ChatState>();
    state.db.save_message(
        &session_id,
        &role,
        &content,
        thinking.as_deref(),
        tool_calls.as_ref(),
        attachments.as_ref(),
    )
}

#[tauri::command]
pub async fn chat_message_clear(
    app: AppHandle,
    session_id: String,
) -> Result<(), String> {
    let state = app.state::<ChatState>();
    state.db.delete_messages(&session_id)
}
