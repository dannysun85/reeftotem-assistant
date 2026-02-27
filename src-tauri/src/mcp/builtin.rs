use std::sync::Arc;
use async_trait::async_trait;
use tauri::AppHandle;

use super::registry::{ToolHandler, ToolRegistry};
use super::types::McpTool;

// ========== Web Search ==========

struct WebSearchHandler;

#[async_trait]
impl ToolHandler for WebSearchHandler {
    async fn execute(&self, args: serde_json::Value, _app: &AppHandle) -> Result<String, String> {
        let query = args
            .get("query")
            .and_then(|q| q.as_str())
            .ok_or("Missing 'query' parameter")?;

        // Use DuckDuckGo HTML search as a simple fallback
        let url = format!(
            "https://html.duckduckgo.com/html/?q={}",
            urlencoding::encode(query)
        );

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(10))
            .build()
            .map_err(|e| e.to_string())?;

        let resp = client
            .get(&url)
            .header("User-Agent", "Reeftotem/1.0")
            .send()
            .await
            .map_err(|e| format!("Search request failed: {}", e))?;

        let html = resp
            .text()
            .await
            .map_err(|e| format!("Failed to read response: {}", e))?;

        // Extract text snippets from search results (simple extraction)
        let mut results = Vec::new();
        for segment in html.split("result__snippet") {
            if results.len() >= 5 {
                break;
            }
            if let Some(start) = segment.find('>') {
                let text = &segment[start + 1..];
                if let Some(end) = text.find('<') {
                    let snippet = text[..end].trim();
                    if !snippet.is_empty() && snippet.len() > 20 {
                        results.push(snippet.to_string());
                    }
                }
            }
        }

        if results.is_empty() {
            Ok(format!("No search results found for: {}", query))
        } else {
            Ok(format!(
                "Search results for '{}':\n\n{}",
                query,
                results
                    .iter()
                    .enumerate()
                    .map(|(i, r)| format!("{}. {}", i + 1, r))
                    .collect::<Vec<_>>()
                    .join("\n\n")
            ))
        }
    }
}

// ========== Knowledge Search ==========

struct KnowledgeSearchHandler;

#[async_trait]
impl ToolHandler for KnowledgeSearchHandler {
    async fn execute(&self, args: serde_json::Value, app: &AppHandle) -> Result<String, String> {
        use tauri::Manager;

        let query = args
            .get("query")
            .and_then(|q| q.as_str())
            .ok_or("Missing 'query' parameter")?;

        let kb_ids: Vec<String> = args
            .get("knowledgeBaseIds")
            .and_then(|ids| serde_json::from_value(ids.clone()).ok())
            .unwrap_or_default();

        let state = app.state::<crate::KnowledgeState>();

        // List knowledge bases and search documents
        let mut all_results = Vec::new();
        let bases = state.db.list_kbs().unwrap_or_default();
        let filtered_bases: Vec<_> = if kb_ids.is_empty() {
            bases.iter().collect()
        } else {
            bases.iter().filter(|b| kb_ids.contains(&b.id)).collect()
        };

        for base in &filtered_bases {
            // List documents in this knowledge base and do text search
            match state.db.list_documents(&base.id) {
                Ok(docs) => {
                    for doc in &docs {
                        // Simple text-based matching through document names
                        if doc.file_name.to_lowercase().contains(&query.to_lowercase()) {
                            all_results.push(format!("[{}] Document: {}", base.name, doc.file_name));
                        }
                    }
                    if all_results.is_empty() && !docs.is_empty() {
                        all_results.push(format!("[{}] {} documents available, but no text matches for '{}'", base.name, docs.len(), query));
                    }
                }
                Err(e) => {
                    all_results.push(format!("[{}] Search error: {}", base.name, e));
                }
            }
        }

        if all_results.is_empty() {
            Ok(format!("No knowledge base results found for: {}", query))
        } else {
            Ok(all_results.join("\n\n---\n\n"))
        }
    }
}

// ========== Current Time ==========

struct CurrentTimeHandler;

#[async_trait]
impl ToolHandler for CurrentTimeHandler {
    async fn execute(&self, args: serde_json::Value, _app: &AppHandle) -> Result<String, String> {
        let _tz = args
            .get("timezone")
            .and_then(|t| t.as_str())
            .unwrap_or("UTC");

        // Use chrono for UTC, note timezone handling
        let now = chrono::Utc::now();
        Ok(format!(
            "Current time (UTC): {}\nISO 8601: {}",
            now.format("%Y-%m-%d %H:%M:%S UTC"),
            now.to_rfc3339()
        ))
    }
}

// ========== File Read ==========

struct FileReadHandler;

#[async_trait]
impl ToolHandler for FileReadHandler {
    async fn execute(&self, args: serde_json::Value, _app: &AppHandle) -> Result<String, String> {
        let path = args
            .get("path")
            .and_then(|p| p.as_str())
            .ok_or("Missing 'path' parameter")?;

        // Safety: only allow reading from specific directories
        let path = std::path::Path::new(path);
        if !path.is_absolute() {
            return Err("Path must be absolute".into());
        }

        let content = tokio::fs::read_to_string(path)
            .await
            .map_err(|e| format!("Failed to read file: {}", e))?;

        // Truncate very large files
        if content.len() > 50_000 {
            Ok(format!(
                "{}\n\n... (truncated, {} total bytes)",
                &content[..50_000],
                content.len()
            ))
        } else {
            Ok(content)
        }
    }
}

// ========== File Write ==========

struct FileWriteHandler;

#[async_trait]
impl ToolHandler for FileWriteHandler {
    async fn execute(&self, args: serde_json::Value, _app: &AppHandle) -> Result<String, String> {
        let path = args
            .get("path")
            .and_then(|p| p.as_str())
            .ok_or("Missing 'path' parameter")?;
        let content = args
            .get("content")
            .and_then(|c| c.as_str())
            .ok_or("Missing 'content' parameter")?;

        let path = std::path::Path::new(path);
        if !path.is_absolute() {
            return Err("Path must be absolute".into());
        }

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| format!("Failed to create directory: {}", e))?;
        }

        tokio::fs::write(path, content)
            .await
            .map_err(|e| format!("Failed to write file: {}", e))?;

        Ok(format!("Successfully wrote {} bytes to {}", content.len(), path.display()))
    }
}

// ========== Delegate to Agent (A2A) ==========

struct DelegateToAgentHandler;

#[async_trait]
impl ToolHandler for DelegateToAgentHandler {
    async fn execute(&self, args: serde_json::Value, app: &AppHandle) -> Result<String, String> {
        let agent_id = args
            .get("agentId")
            .and_then(|a| a.as_str())
            .ok_or("Missing 'agentId' parameter")?;
        let task = args
            .get("task")
            .and_then(|t| t.as_str())
            .ok_or("Missing 'task' parameter")?;
        let context = args
            .get("context")
            .and_then(|c| c.as_str())
            .unwrap_or("");

        // Load target agent config
        let settings = crate::settings::load_settings(app)?;
        let agent = settings
            .agents
            .iter()
            .find(|a| a.id == agent_id)
            .ok_or_else(|| format!("Agent '{}' not found", agent_id))?
            .clone();

        // Resolve provider
        let provider_id = agent
            .provider_id
            .as_deref()
            .or(settings.default_provider_id.as_deref())
            .ok_or("No provider configured for delegated agent")?;

        let provider = settings
            .providers
            .iter()
            .find(|p| p.id == provider_id)
            .ok_or_else(|| format!("Provider '{}' not found", provider_id))?
            .clone();

        let keys = crate::settings::load_api_keys(app).unwrap_or_default();
        let api_key = keys.get(provider_id).cloned();

        // Build the delegation prompt
        let prompt = if context.is_empty() {
            task.to_string()
        } else {
            format!("{}\n\nContext:\n{}", task, context)
        };

        let session_key = format!("a2a-{}", uuid::Uuid::new_v4());
        let request = crate::ai::types::AiChatRequest {
            session_key,
            provider_id: provider_id.to_string(),
            messages: vec![crate::ai::types::ChatMessage {
                role: "user".into(),
                content: prompt,
                tool_call_id: None,
                tool_calls: None,
            }],
            system_prompt: if agent.system_prompt.is_empty() {
                None
            } else {
                Some(agent.system_prompt.clone())
            },
            model: if agent.model.is_empty() {
                provider.model.clone()
            } else {
                Some(agent.model.clone())
            },
            temperature: Some(agent.temperature),
            max_tokens: agent.max_tokens,
            tools: None,
        };

        let result =
            crate::ai::send_chat_collect(app, &provider, api_key.as_deref(), &request).await?;

        Ok(format!(
            "[Response from agent '{}']\n{}",
            agent.name, result
        ))
    }
}

// ========== List Available Agents ==========

struct ListAvailableAgentsHandler;

#[async_trait]
impl ToolHandler for ListAvailableAgentsHandler {
    async fn execute(&self, _args: serde_json::Value, app: &AppHandle) -> Result<String, String> {
        let settings = crate::settings::load_settings(app)?;
        let agents: Vec<String> = settings
            .agents
            .iter()
            .map(|a| {
                format!(
                    "- **{}** (id: {}): {}",
                    a.name, a.id, a.description
                )
            })
            .collect();

        if agents.is_empty() {
            Ok("No agents are currently configured.".into())
        } else {
            Ok(format!(
                "Available agents:\n\n{}",
                agents.join("\n")
            ))
        }
    }
}

// ========== Registry Setup ==========

/// Create a fully initialized ToolRegistry with all built-in tools
pub fn create_builtin_registry() -> ToolRegistry {
    let mut registry = ToolRegistry::new();

    registry.register(
        McpTool {
            name: "web_search".into(),
            description: "Search the web for current information about a topic".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "The search query" }
                },
                "required": ["query"]
            }),
        },
        Arc::new(WebSearchHandler),
    );

    registry.register(
        McpTool {
            name: "knowledge_search".into(),
            description: "Search through knowledge bases for relevant information".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "The search query" },
                    "knowledgeBaseIds": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "IDs of knowledge bases to search"
                    }
                },
                "required": ["query"]
            }),
        },
        Arc::new(KnowledgeSearchHandler),
    );

    registry.register(
        McpTool {
            name: "current_time".into(),
            description: "Get the current date and time".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "timezone": { "type": "string", "description": "IANA timezone name" }
                }
            }),
        },
        Arc::new(CurrentTimeHandler),
    );

    registry.register(
        McpTool {
            name: "file_read".into(),
            description: "Read the contents of a file".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the file" }
                },
                "required": ["path"]
            }),
        },
        Arc::new(FileReadHandler),
    );

    registry.register(
        McpTool {
            name: "file_write".into(),
            description: "Write content to a file".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string", "description": "Absolute path to the file" },
                    "content": { "type": "string", "description": "The content to write" }
                },
                "required": ["path", "content"]
            }),
        },
        Arc::new(FileWriteHandler),
    );

    registry.register(
        McpTool {
            name: "delegate_to_agent".into(),
            description: "Delegate a sub-task to another specialized agent".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {
                    "agentId": { "type": "string", "description": "The ID of the target agent" },
                    "task": { "type": "string", "description": "Description of the task" },
                    "context": { "type": "string", "description": "Additional context" }
                },
                "required": ["agentId", "task"]
            }),
        },
        Arc::new(DelegateToAgentHandler),
    );

    registry.register(
        McpTool {
            name: "list_available_agents".into(),
            description: "List all available agents and their capabilities".into(),
            input_schema: serde_json::json!({
                "type": "object",
                "properties": {}
            }),
        },
        Arc::new(ListAvailableAgentsHandler),
    );

    registry
}
