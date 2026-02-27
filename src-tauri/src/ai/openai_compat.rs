use futures_util::StreamExt;
use tauri::{AppHandle, Emitter};

use crate::settings::ProviderConfig;
use super::types::*;
use super::CollectResponse;

/// Get the base URL for an OpenAI-compatible provider
fn get_base_url(provider: &ProviderConfig) -> String {
    if let Some(ref url) = provider.base_url {
        if !url.is_empty() {
            return url.trim_end_matches('/').to_string();
        }
    }

    match provider.provider_type.as_str() {
        "openai" => "https://api.openai.com/v1".to_string(),
        "deepseek" => "https://api.deepseek.com".to_string(),
        "dashscope" => "https://dashscope.aliyuncs.com/compatible-mode/v1".to_string(),
        "moonshot" => "https://api.moonshot.cn/v1".to_string(),
        "siliconflow" => "https://api.siliconflow.cn/v1".to_string(),
        "openrouter" => "https://openrouter.ai/api/v1".to_string(),
        "ollama" => "http://localhost:11434/v1".to_string(),
        _ => "https://api.openai.com/v1".to_string(),
    }
}

/// Get default model for provider type
fn get_default_model(provider: &ProviderConfig) -> &str {
    match provider.provider_type.as_str() {
        "openai" => "gpt-4o-mini",
        "deepseek" => "deepseek-chat",
        "dashscope" => "qwen-turbo-latest",
        "moonshot" => "kimi-k2.5",
        "siliconflow" => "Pro/moonshotai/Kimi-K2.5",
        "openrouter" => "openai/gpt-4o-mini",
        "ollama" => "qwen3:latest",
        _ => "gpt-4o-mini",
    }
}

fn build_messages(request: &AiChatRequest) -> Vec<serde_json::Value> {
    let mut messages = Vec::new();
    if let Some(ref sys) = request.system_prompt {
        if !sys.is_empty() {
            messages.push(serde_json::json!({ "role": "system", "content": sys }));
        }
    }
    for msg in &request.messages {
        if msg.role == "assistant" && msg.tool_calls.is_some() {
            let mut obj = serde_json::json!({ "role": "assistant" });
            if !msg.content.is_empty() {
                obj["content"] = serde_json::json!(msg.content);
            }
            if let Some(ref tcs) = msg.tool_calls {
                let tool_calls: Vec<serde_json::Value> = tcs
                    .iter()
                    .map(|tc| {
                        serde_json::json!({
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.name,
                                "arguments": serde_json::to_string(&tc.arguments).unwrap_or_default()
                            }
                        })
                    })
                    .collect();
                obj["tool_calls"] = serde_json::json!(tool_calls);
            }
            messages.push(obj);
        } else if msg.role == "tool" {
            messages.push(serde_json::json!({
                "role": "tool",
                "content": msg.content,
                "tool_call_id": msg.tool_call_id.as_deref().unwrap_or("")
            }));
        } else {
            messages.push(serde_json::json!({ "role": msg.role, "content": msg.content }));
        }
    }
    messages
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
        "stream": stream
    });
    if let Some(temp) = request.temperature {
        body["temperature"] = serde_json::json!(temp);
    }
    if let Some(max_tokens) = request.max_tokens {
        body["max_tokens"] = serde_json::json!(max_tokens);
    }
    // Add tools if present (OpenAI format)
    if let Some(ref tools) = request.tools {
        if !tools.is_empty() {
            let tools_json: Vec<serde_json::Value> = tools
                .iter()
                .map(|t| {
                    serde_json::json!({
                        "type": "function",
                        "function": {
                            "name": t.name,
                            "description": t.description,
                            "parameters": t.input_schema
                        }
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
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<String, String> {
    let base_url = get_base_url(provider);
    let model = request
        .model
        .as_deref()
        .or(provider.model.as_deref())
        .unwrap_or_else(|| get_default_model(provider));

    let url = format!("{}/chat/completions", base_url);
    let messages = build_messages(request);
    let body = build_body(model, &messages, request, false);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
    }
    if provider.provider_type == "openrouter" {
        req = req.header("HTTP-Referer", "https://reeftotem.app");
        req = req.header("X-Title", "Reeftotem Assistant");
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误 {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;
    let content = json
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    Ok(content)
}

/// Non-streaming with tool call detection
pub async fn send_collect_with_tool_detection(
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<CollectResponse, String> {
    let base_url = get_base_url(provider);
    let model = request
        .model
        .as_deref()
        .or(provider.model.as_deref())
        .unwrap_or_else(|| get_default_model(provider));

    let url = format!("{}/chat/completions", base_url);
    let messages = build_messages(request);
    let body = build_body(model, &messages, request, false);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let mut req = client.post(&url).json(&body);
    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
    }
    if provider.provider_type == "openrouter" {
        req = req.header("HTTP-Referer", "https://reeftotem.app");
        req = req.header("X-Title", "Reeftotem Assistant");
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;
    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误 {}: {}", status, body));
    }

    let json: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    let choice = json
        .get("choices")
        .and_then(|c| c.get(0))
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let message = choice.get("message").cloned().unwrap_or(serde_json::json!({}));
    let finish_reason = choice
        .get("finish_reason")
        .and_then(|f| f.as_str())
        .unwrap_or("");

    let content = message
        .get("content")
        .and_then(|c| c.as_str())
        .unwrap_or("")
        .to_string();

    // Check for tool calls
    if finish_reason == "tool_calls" || message.get("tool_calls").is_some() {
        if let Some(tool_calls_arr) = message.get("tool_calls").and_then(|t| t.as_array()) {
            let tool_calls: Vec<ToolCallInfo> = tool_calls_arr
                .iter()
                .filter_map(|tc| {
                    let id = tc.get("id")?.as_str()?.to_string();
                    let func = tc.get("function")?;
                    let name = func.get("name")?.as_str()?.to_string();
                    let args_str = func.get("arguments").and_then(|a| a.as_str()).unwrap_or("{}");
                    let arguments: serde_json::Value =
                        serde_json::from_str(args_str).unwrap_or(serde_json::json!({}));
                    Some(ToolCallInfo {
                        id,
                        name,
                        arguments,
                    })
                })
                .collect();

            if !tool_calls.is_empty() {
                return Ok(CollectResponse::ToolCalls {
                    text_so_far: content,
                    tool_calls,
                });
            }
        }
    }

    Ok(CollectResponse::Text(content))
}

pub async fn send_stream(
    app: &AppHandle,
    provider: &ProviderConfig,
    api_key: Option<&str>,
    request: &AiChatRequest,
) -> Result<(), String> {
    let base_url = get_base_url(provider);
    let model = request
        .model
        .as_deref()
        .or(provider.model.as_deref())
        .unwrap_or_else(|| get_default_model(provider));

    let url = format!("{}/chat/completions", base_url);
    let messages = build_messages(request);
    let body = build_body(model, &messages, request, true);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(60))
        .connect_timeout(std::time::Duration::from_secs(15))
        .build()
        .map_err(|e| format!("创建 HTTP 客户端失败: {}", e))?;
    let mut req = client.post(&url).json(&body);

    if let Some(key) = api_key {
        if !key.is_empty() {
            req = req.header("Authorization", format!("Bearer {}", key));
        }
    }

    // OpenRouter specific headers
    if provider.provider_type == "openrouter" {
        req = req.header("HTTP-Referer", "https://reeftotem.app");
        req = req.header("X-Title", "Reeftotem Assistant");
    }

    app_info!("AI 请求: {} model={}", url, model);

    let response = req
        .send()
        .await
        .map_err(|e| format!("HTTP 请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API 返回错误 {}: {}", status, body));
    }

    let mut stream = response.bytes_stream();
    let mut full_text = String::new();
    let mut buffer = String::new();
    let session_key = &request.session_key;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("读取流失败: {}", e))?;
        let text = String::from_utf8_lossy(&chunk);
        buffer.push_str(&text);

        // Process complete SSE lines
        while let Some(line_end) = buffer.find('\n') {
            let line = buffer[..line_end].trim().to_string();
            buffer = buffer[line_end + 1..].to_string();

            if line.is_empty() || line.starts_with(':') {
                continue;
            }

            if let Some(data) = line.strip_prefix("data: ") {
                let data = data.trim();

                if data == "[DONE]" {
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

                if let Ok(json) = serde_json::from_str::<serde_json::Value>(data) {
                    if let Some(content) = json
                        .get("choices")
                        .and_then(|c| c.get(0))
                        .and_then(|c| c.get("delta"))
                        .and_then(|d| d.get("content"))
                        .and_then(|c| c.as_str())
                    {
                        full_text.push_str(content);
                        let _ = app.emit(
                            "ai_chat_delta",
                            ChatDeltaEvent {
                                session_key: session_key.clone(),
                                text: content.to_string(),
                            },
                        );
                    }
                }
            }
        }
    }

    // Stream ended without [DONE] - emit final anyway
    let _ = app.emit(
        "ai_chat_final",
        ChatFinalEvent {
            session_key: session_key.clone(),
            full_text,
            model: model.to_string(),
        },
    );

    Ok(())
}
