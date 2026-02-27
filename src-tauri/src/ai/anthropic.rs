use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

use crate::settings::ProviderConfig;
use super::types::*;
use super::CollectResponse;

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))
}

fn resolve_model<'a>(request: &'a AiChatRequest, provider: &'a ProviderConfig) -> &'a str {
    request
        .model
        .as_deref()
        .or(provider.model.as_deref())
        .unwrap_or("claude-sonnet-4-20250514")
}

fn resolve_base_url(provider: &ProviderConfig) -> &str {
    provider
        .base_url
        .as_deref()
        .filter(|u| !u.is_empty())
        .unwrap_or("https://api.anthropic.com")
        .trim_end_matches('/')
}

fn build_messages(request: &AiChatRequest) -> Vec<serde_json::Value> {
    request
        .messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| {
            if m.role == "assistant" && m.tool_calls.is_some() {
                // Build Anthropic assistant message with tool_use content blocks
                let mut content = Vec::new();
                if !m.content.is_empty() {
                    content.push(serde_json::json!({
                        "type": "text",
                        "text": m.content
                    }));
                }
                if let Some(ref tcs) = m.tool_calls {
                    for tc in tcs {
                        content.push(serde_json::json!({
                            "type": "tool_use",
                            "id": tc.id,
                            "name": tc.name,
                            "input": tc.arguments
                        }));
                    }
                }
                serde_json::json!({
                    "role": "assistant",
                    "content": content
                })
            } else if m.role == "tool" {
                // Convert tool result to Anthropic format
                serde_json::json!({
                    "role": "user",
                    "content": [{
                        "type": "tool_result",
                        "tool_use_id": m.tool_call_id.as_deref().unwrap_or(""),
                        "content": m.content
                    }]
                })
            } else {
                serde_json::json!({
                    "role": m.role,
                    "content": m.content
                })
            }
        })
        .collect()
}

fn build_body(
    model: &str,
    messages: &[serde_json::Value],
    request: &AiChatRequest,
    stream: bool,
) -> serde_json::Value {
    let mut body = serde_json::json!({
        "model": model,
        "messages": messages,
        "stream": stream,
        "max_tokens": request.max_tokens.unwrap_or(4096)
    });
    if let Some(ref sys) = request.system_prompt {
        if !sys.is_empty() {
            body["system"] = serde_json::json!(sys);
        }
    }
    if let Some(temp) = request.temperature {
        body["temperature"] = serde_json::json!(temp);
    }
    // Add tools if present
    if let Some(ref tools) = request.tools {
        if !tools.is_empty() {
            let tools_json: Vec<serde_json::Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "name": t.name,
                        "description": t.description,
                        "input_schema": t.input_schema
                    })
                })
                .collect();
            body["tools"] = serde_json::json!(tools_json);
        }
    }
    body
}

/// Non-streaming: collect full response text
pub async fn send_collect(
    _app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<String, String> {
    let api_key = api_key.ok_or("Anthropic 需要 API Key")?;
    let base_url = resolve_base_url(provider);
    let model = resolve_model(request, provider);
    let url = format!("{}/v1/messages", base_url);

    let messages = build_messages(request);
    let body = build_body(model, &messages, request, false);

    let client = build_client()?;
    let response = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API 返回错误 {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let content = json
        .get("content")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("text"))
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();

    Ok(content)
}

/// Non-streaming with tool call detection
pub async fn send_collect_with_tool_detection(
    _app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<CollectResponse, String> {
    let api_key = api_key.ok_or("Anthropic 需要 API Key")?;
    let base_url = resolve_base_url(provider);
    let model = resolve_model(request, provider);
    let url = format!("{}/v1/messages", base_url);

    let messages = build_messages(request);
    let body = build_body(model, &messages, request, false);

    let client = build_client()?;
    let response = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API 返回错误 {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let stop_reason = json
        .get("stop_reason")
        .and_then(|s| s.as_str())
        .unwrap_or("");

    let content_blocks = json
        .get("content")
        .and_then(|c| c.as_array())
        .cloned()
        .unwrap_or_default();

    let mut text_so_far = String::new();
    let mut tool_calls = Vec::new();

    for block in &content_blocks {
        let block_type = block.get("type").and_then(|t| t.as_str()).unwrap_or("");
        match block_type {
            "text" => {
                if let Some(text) = block.get("text").and_then(|t| t.as_str()) {
                    text_so_far.push_str(text);
                }
            }
            "tool_use" => {
                let id = block
                    .get("id")
                    .and_then(|i| i.as_str())
                    .unwrap_or("")
                    .to_string();
                let name = block
                    .get("name")
                    .and_then(|n| n.as_str())
                    .unwrap_or("")
                    .to_string();
                let input = block
                    .get("input")
                    .cloned()
                    .unwrap_or(serde_json::json!({}));
                tool_calls.push(ToolCallInfo {
                    id,
                    name,
                    arguments: input,
                });
            }
            _ => {}
        }
    }

    if stop_reason == "tool_use" && !tool_calls.is_empty() {
        Ok(CollectResponse::ToolCalls {
            text_so_far,
            tool_calls,
        })
    } else {
        Ok(CollectResponse::Text(text_so_far))
    }
}

pub async fn send_stream(
    app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<(), String> {
    let api_key = api_key.ok_or("Anthropic 需要 API Key")?;
    let base_url = resolve_base_url(provider);
    let model = resolve_model(request, provider);
    let url = format!("{}/v1/messages", base_url);

    let messages = build_messages(request);
    let body = build_body(model, &messages, request, true);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let req = client
        .post(&url)
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body);

    app_info!("Anthropic AI 请求: {} model={}", url, model);

    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Anthropic API 返回错误 {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut full_text = String::new();
    let mut buffer = String::new();
    let session_key = &request.session_key;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取流失败: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            // Anthropic SSE format: "event: ..." line followed by "data: ..." line
            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    let event_type = json
                        .get("type")
                        .and_then(|t| t.as_str())
                        .unwrap_or("");

                    match event_type {
                        "content_block_delta" => {
                            if let Some(text) = json
                                .get("delta")
                                .and_then(|d| d.get("text"))
                                .and_then(|t| t.as_str())
                            {
                                full_text.push_str(text);
                                let _ = app.emit(
                                    "ai_chat_delta",
                                    ChatDeltaEvent {
                                        session_key: session_key.clone(),
                                        text: text.to_string(),
                                    },
                                );
                            }
                        }
                        "message_stop" => {
                            let _ = app.emit(
                                "ai_chat_final",
                                ChatFinalEvent {
                                    session_key: session_key.clone(),
                                    full_text: full_text.clone(),
                                    model: model.to_string(),
                                },
                            );
                            return Ok(());
                        }
                        "error" => {
                            let error_msg = json
                                .get("error")
                                .and_then(|e| e.get("message"))
                                .and_then(|m| m.as_str())
                                .unwrap_or("Unknown error");
                            return Err(format!("Anthropic 错误: {}", error_msg));
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    // Stream ended without message_stop
    if !full_text.is_empty() {
        let _ = app.emit(
            "ai_chat_final",
            ChatFinalEvent {
                session_key: session_key.clone(),
                full_text,
                model: model.to_string(),
            },
        );
    }

    Ok(())
}
