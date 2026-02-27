use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub parameters: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    #[serde(default)]
    pub icon: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub author: String,
    #[serde(default)]
    pub configurable: bool,
    #[serde(default)]
    pub config: serde_json::Value,
    #[serde(default)]
    pub is_core: bool,
    #[serde(default)]
    pub is_bundled: bool,
    #[serde(default)]
    pub tools: Vec<ToolDefinition>,
    pub created_at: String,
    pub updated_at: String,
}
