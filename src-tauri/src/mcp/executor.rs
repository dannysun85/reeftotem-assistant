use std::sync::Arc;
use tauri::AppHandle;

use super::registry::ToolRegistry;
use super::types::{ToolCallRequest, ToolCallResult};

/// Execute a tool call with timeout and error handling
pub async fn execute_tool_call(
    registry: &Arc<ToolRegistry>,
    request: &ToolCallRequest,
    app: &AppHandle,
) -> ToolCallResult {
    let timeout = tokio::time::Duration::from_secs(30);

    let result = tokio::time::timeout(timeout, async {
        registry
            .execute(&request.name, request.arguments.clone(), app)
            .await
    })
    .await;

    match result {
        Ok(Ok(output)) => ToolCallResult {
            id: request.id.clone(),
            name: request.name.clone(),
            output,
            is_error: false,
        },
        Ok(Err(e)) => ToolCallResult {
            id: request.id.clone(),
            name: request.name.clone(),
            output: format!("Tool error: {}", e),
            is_error: true,
        },
        Err(_) => ToolCallResult {
            id: request.id.clone(),
            name: request.name.clone(),
            output: "Tool execution timed out (30s)".into(),
            is_error: true,
        },
    }
}
