pub mod types;
mod openai_compat;
mod anthropic;

use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use crate::settings::ProviderConfig;
use crate::mcp::executor::execute_tool_call;
use crate::mcp::types::ToolCallRequest;
use types::*;

/// Route a chat stream request to the appropriate provider handler
pub async fn send_chat_stream(
    app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<(), String> {
    match provider.provider_type.as_str() {
        "anthropic" => anthropic::send_stream(app, provider, api_key, request).await,
        // All other types use OpenAI-compatible API
        _ => openai_compat::send_stream(app, provider, api_key, request).await,
    }
}

/// Non-streaming chat: collect full response text (used by workflow engine)
pub async fn send_chat_collect(
    app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<String, String> {
    match provider.provider_type.as_str() {
        "anthropic" => anthropic::send_collect(app, provider, api_key, request).await,
        _ => openai_compat::send_collect(provider, api_key, request).await,
    }
}

/// Stream chat with tool calling loop
/// When AI returns tool_use blocks, executes tools and continues the conversation
pub async fn send_chat_stream_with_tools(
    app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<(), String> {
    // If no tools, just do a normal stream
    if request.tools.as_ref().map_or(true, |t| t.is_empty()) {
        return send_chat_stream(app, provider, api_key, request).await;
    }

    // Get tool registry
    let registry = {
        let state = app.try_state::<crate::McpState>();
        match state {
            Some(s) => Arc::clone(&s.registry),
            None => return send_chat_stream(app, provider, api_key, request).await,
        }
    };

    let session_key = request.session_key.clone();

    // Tool calling loop: collect response, check for tool calls, execute, re-send
    let mut current_request = request.clone();
    let mut max_iterations = 10; // Safety limit

    loop {
        max_iterations -= 1;
        if max_iterations == 0 {
            return Err("Tool calling loop exceeded maximum iterations".into());
        }

        // Use collect mode to get full response with tool calls
        let response = match provider.provider_type.as_str() {
            "anthropic" => {
                anthropic::send_collect_with_tool_detection(app, provider, api_key, &current_request).await?
            }
            _ => {
                openai_compat::send_collect_with_tool_detection(provider, api_key, &current_request).await?
            }
        };

        match response {
            CollectResponse::Text(text) => {
                // No tool calls, emit the final text as streaming deltas
                let _ = app.emit(
                    "ai_chat_delta",
                    ChatDeltaEvent {
                        session_key: session_key.clone(),
                        text: text.clone(),
                    },
                );
                let _ = app.emit(
                    "ai_chat_final",
                    ChatFinalEvent {
                        session_key: session_key.clone(),
                        full_text: text,
                        model: current_request.model.clone().unwrap_or_default(),
                    },
                );
                return Ok(());
            }
            CollectResponse::ToolCalls { text_so_far, tool_calls } => {
                // Emit any text before tool calls
                if !text_so_far.is_empty() {
                    let _ = app.emit(
                        "ai_chat_delta",
                        ChatDeltaEvent {
                            session_key: session_key.clone(),
                            text: text_so_far.clone(),
                        },
                    );
                }

                // Execute each tool call
                let mut tool_results = Vec::new();
                for tc in &tool_calls {
                    // Emit tool call event to frontend
                    let _ = app.emit(
                        "ai_chat_tool_call",
                        ChatToolCallEvent {
                            session_key: session_key.clone(),
                            tool_call_id: tc.id.clone(),
                            tool_name: tc.name.clone(),
                            arguments: tc.arguments.clone(),
                        },
                    );

                    // Execute the tool
                    let tool_request = ToolCallRequest {
                        id: tc.id.clone(),
                        name: tc.name.clone(),
                        arguments: tc.arguments.clone(),
                    };
                    let result = execute_tool_call(&registry, &tool_request, app).await;

                    // Emit tool result event to frontend
                    let _ = app.emit(
                        "ai_chat_tool_result",
                        ChatToolResultEvent {
                            session_key: session_key.clone(),
                            tool_call_id: tc.id.clone(),
                            tool_name: tc.name.clone(),
                            result: result.output.clone(),
                            is_error: result.is_error,
                        },
                    );

                    tool_results.push(result);
                }

                // Build continuation request
                // Add assistant message with tool calls
                current_request.messages.push(ChatMessage {
                    role: "assistant".into(),
                    content: text_so_far,
                    tool_call_id: None,
                    tool_calls: Some(
                        tool_calls
                            .iter()
                            .map(|tc| ToolCallInfo {
                                id: tc.id.clone(),
                                name: tc.name.clone(),
                                arguments: tc.arguments.clone(),
                            })
                            .collect(),
                    ),
                });

                // Add tool result messages
                for result in &tool_results {
                    current_request.messages.push(ChatMessage {
                        role: "tool".into(),
                        content: result.output.clone(),
                        tool_call_id: Some(result.id.clone()),
                        tool_calls: None,
                    });
                }

                // Continue the loop
            }
        }
    }
}

/// Response from a collect-with-tool-detection call
pub enum CollectResponse {
    Text(String),
    ToolCalls {
        text_so_far: String,
        tool_calls: Vec<ToolCallInfo>,
    },
}
