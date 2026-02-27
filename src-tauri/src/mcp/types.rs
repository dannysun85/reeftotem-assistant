use serde::{Deserialize, Serialize};

/// A tool definition sent to AI providers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct McpTool {
    pub name: String,
    pub description: String,
    #[serde(rename = "input_schema")]
    pub input_schema: serde_json::Value,
}

/// Request to call a tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallRequest {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

/// Result of a tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallResult {
    pub id: String,
    pub name: String,
    pub output: String,
    #[serde(default)]
    pub is_error: bool,
}

/// Event emitted to frontend when a tool is called
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ToolCallEvent {
    pub session_key: String,
    pub tool_call: ToolCallRequest,
}

/// Event emitted to frontend when a tool result is returned
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct ToolResultEvent {
    pub session_key: String,
    pub tool_result: ToolCallResult,
}
