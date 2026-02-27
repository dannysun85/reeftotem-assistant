use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CronJobConfig {
    pub id: String,
    pub name: String,
    pub message: String,
    pub schedule: String,
    pub enabled: bool,
    #[serde(default)]
    pub target: serde_json::Value,
    #[serde(default)]
    pub last_run: Option<CronLastRun>,
    #[serde(default)]
    pub next_run: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CronLastRun {
    pub time: String,
    pub success: bool,
    #[serde(default)]
    pub error: Option<String>,
    #[serde(default)]
    pub duration_ms: Option<i64>,
}
