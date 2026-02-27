use serde::{Deserialize, Serialize};

use crate::mcp::types::McpTool;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AiChatRequest {
    #[serde(rename = "sessionKey")]
    pub session_key: String,
    #[serde(rename = "providerId")]
    pub provider_id: String,
    pub messages: Vec<ChatMessage>,
    #[serde(rename = "systemPrompt", default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub model: Option<String>,
    #[serde(default)]
    pub temperature: Option<f64>,
    #[serde(rename = "maxTokens", default)]
    pub max_tokens: Option<i64>,
    /// MCP tools available for this request
    #[serde(default)]
    pub tools: Option<Vec<McpTool>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
    /// For tool_result messages
    #[serde(rename = "toolCallId", default, skip_serializing_if = "Option::is_none")]
    pub tool_call_id: Option<String>,
    /// For assistant messages with tool_use content blocks
    #[serde(rename = "toolCalls", default, skip_serializing_if = "Option::is_none")]
    pub tool_calls: Option<Vec<ToolCallInfo>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolCallInfo {
    pub id: String,
    pub name: String,
    pub arguments: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatDeltaEvent {
    #[serde(rename = "sessionKey")]
    pub session_key: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatFinalEvent {
    #[serde(rename = "sessionKey")]
    pub session_key: String,
    #[serde(rename = "fullText")]
    pub full_text: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatErrorEvent {
    #[serde(rename = "sessionKey")]
    pub session_key: String,
    pub error: String,
}

/// Event emitted when AI makes a tool call
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatToolCallEvent {
    pub session_key: String,
    pub tool_call_id: String,
    pub tool_name: String,
    pub arguments: serde_json::Value,
}

/// Event emitted when a tool result is available
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatToolResultEvent {
    pub session_key: String,
    pub tool_call_id: String,
    pub tool_name: String,
    pub result: String,
    pub is_error: bool,
}
