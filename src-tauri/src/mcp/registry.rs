use std::collections::HashMap;
use std::sync::Arc;
use async_trait::async_trait;
use tauri::AppHandle;

use super::types::McpTool;

/// Trait for implementing tool handlers
#[async_trait]
pub trait ToolHandler: Send + Sync {
    async fn execute(&self, args: serde_json::Value, app: &AppHandle) -> Result<String, String>;
}

/// Registry of all available tools
pub struct ToolRegistry {
    handlers: HashMap<String, Arc<dyn ToolHandler>>,
    tools: Vec<McpTool>,
}

impl ToolRegistry {
    pub fn new() -> Self {
        Self {
            handlers: HashMap::new(),
            tools: Vec::new(),
        }
    }

    /// Register a tool handler with its definition
    pub fn register(&mut self, tool: McpTool, handler: Arc<dyn ToolHandler>) {
        self.handlers.insert(tool.name.clone(), handler);
        self.tools.push(tool);
    }

    /// Get tool definitions for AI provider requests
    pub fn get_tools(&self) -> &[McpTool] {
        &self.tools
    }

    /// Get tool definitions filtered by tool names
    pub fn get_tools_by_names(&self, names: &[String]) -> Vec<McpTool> {
        self.tools
            .iter()
            .filter(|t| names.contains(&t.name))
            .cloned()
            .collect()
    }

    /// Execute a tool by name
    pub async fn execute(
        &self,
        name: &str,
        args: serde_json::Value,
        app: &AppHandle,
    ) -> Result<String, String> {
        let handler = self
            .handlers
            .get(name)
            .ok_or_else(|| format!("Tool '{}' not found", name))?;

        handler.execute(args, app).await
    }

    /// Check if a tool exists
    pub fn has_tool(&self, name: &str) -> bool {
        self.handlers.contains_key(name)
    }
}
