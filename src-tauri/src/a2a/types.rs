use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct AgentCapability {
    pub agent_id: String,
    pub agent_name: String,
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct DelegationRequest {
    pub id: String,
    pub from_agent_id: String,
    pub to_agent_id: String,
    pub task: String,
    #[serde(default)]
    pub context: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
pub struct DelegationResult {
    pub id: String,
    pub output: String,
    pub status: String, // "completed" | "failed"
}
