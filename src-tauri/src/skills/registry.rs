use super::types::{SkillConfig, ToolDefinition};

/// Returns the list of built-in (core) skills with their tool definitions
pub fn builtin_skills() -> Vec<SkillConfig> {
    let now = chrono::Utc::now().to_rfc3339();

    vec![
        SkillConfig {
            id: "core_web_search".into(),
            name: "Web Search".into(),
            description: "Search the web for information".into(),
            enabled: true,
            icon: "🔍".into(),
            version: "1.0.0".into(),
            author: "Reeftotem".into(),
            configurable: false,
            config: serde_json::json!({}),
            is_core: true,
            is_bundled: true,
            tools: vec![ToolDefinition {
                name: "web_search".into(),
                description: "Search the web for current information about a topic".into(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query"
                        }
                    },
                    "required": ["query"]
                }),
            }],
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SkillConfig {
            id: "core_knowledge_search".into(),
            name: "Knowledge Search".into(),
            description: "Search through knowledge bases using RAG".into(),
            enabled: true,
            icon: "📚".into(),
            version: "1.0.0".into(),
            author: "Reeftotem".into(),
            configurable: false,
            config: serde_json::json!({}),
            is_core: true,
            is_bundled: true,
            tools: vec![ToolDefinition {
                name: "knowledge_search".into(),
                description: "Search through knowledge bases for relevant information".into(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "The search query"
                        },
                        "knowledgeBaseIds": {
                            "type": "array",
                            "items": { "type": "string" },
                            "description": "IDs of knowledge bases to search"
                        }
                    },
                    "required": ["query"]
                }),
            }],
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SkillConfig {
            id: "core_current_time".into(),
            name: "Current Time".into(),
            description: "Get the current date and time".into(),
            enabled: true,
            icon: "🕐".into(),
            version: "1.0.0".into(),
            author: "Reeftotem".into(),
            configurable: false,
            config: serde_json::json!({}),
            is_core: true,
            is_bundled: true,
            tools: vec![ToolDefinition {
                name: "current_time".into(),
                description: "Get the current date and time, optionally in a specific timezone".into(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "timezone": {
                            "type": "string",
                            "description": "IANA timezone name (e.g. 'Asia/Shanghai'). Defaults to UTC."
                        }
                    }
                }),
            }],
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SkillConfig {
            id: "core_file_ops".into(),
            name: "File Operations".into(),
            description: "Read and write files on the local system".into(),
            enabled: false,
            icon: "📁".into(),
            version: "1.0.0".into(),
            author: "Reeftotem".into(),
            configurable: false,
            config: serde_json::json!({}),
            is_core: true,
            is_bundled: true,
            tools: vec![
                ToolDefinition {
                    name: "file_read".into(),
                    description: "Read the contents of a file".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Absolute path to the file to read"
                            }
                        },
                        "required": ["path"]
                    }),
                },
                ToolDefinition {
                    name: "file_write".into(),
                    description: "Write content to a file".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "path": {
                                "type": "string",
                                "description": "Absolute path to the file to write"
                            },
                            "content": {
                                "type": "string",
                                "description": "The content to write"
                            }
                        },
                        "required": ["path", "content"]
                    }),
                },
            ],
            created_at: now.clone(),
            updated_at: now.clone(),
        },
        SkillConfig {
            id: "core_agent_delegation".into(),
            name: "Agent Delegation".into(),
            description: "Delegate tasks to other specialized agents (A2A)".into(),
            enabled: true,
            icon: "🤝".into(),
            version: "1.0.0".into(),
            author: "Reeftotem".into(),
            configurable: false,
            config: serde_json::json!({}),
            is_core: true,
            is_bundled: true,
            tools: vec![
                ToolDefinition {
                    name: "delegate_to_agent".into(),
                    description: "Delegate a sub-task to another specialized agent".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {
                            "agentId": {
                                "type": "string",
                                "description": "The ID of the target agent"
                            },
                            "task": {
                                "type": "string",
                                "description": "Description of the task to delegate"
                            },
                            "context": {
                                "type": "string",
                                "description": "Additional context for the task"
                            }
                        },
                        "required": ["agentId", "task"]
                    }),
                },
                ToolDefinition {
                    name: "list_available_agents".into(),
                    description: "List all available agents and their capabilities".into(),
                    parameters: serde_json::json!({
                        "type": "object",
                        "properties": {}
                    }),
                },
            ],
            created_at: now.clone(),
            updated_at: now,
        },
    ]
}
