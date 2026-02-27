use tauri::{AppHandle, Manager};

use crate::McpState;

/// List all registered MCP tools
#[tauri::command]
pub async fn mcp_list_tools(app: AppHandle) -> Result<serde_json::Value, String> {
    let state = app.state::<McpState>();
    let tools = state.registry.get_tools();
    serde_json::to_value(tools).map_err(|e| e.to_string())
}

/// Get details of a specific tool by name
#[tauri::command]
pub async fn mcp_get_tool(app: AppHandle, name: String) -> Result<serde_json::Value, String> {
    let state = app.state::<McpState>();
    let tools = state.registry.get_tools();
    let tool = tools
        .iter()
        .find(|t| t.name == name)
        .ok_or_else(|| format!("Tool '{}' not found", name))?;
    serde_json::to_value(tool).map_err(|e| e.to_string())
}

/// Execute a tool by name with the given arguments
#[tauri::command]
pub async fn mcp_call_tool(
    app: AppHandle,
    name: String,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let state = app.state::<McpState>();

    if !state.registry.has_tool(&name) {
        return Err(format!("Tool '{}' not found", name));
    }

    let result = state.registry.execute(&name, arguments, &app).await?;
    Ok(serde_json::json!({ "output": result }))
}
