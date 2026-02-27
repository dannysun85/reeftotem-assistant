use std::path::PathBuf;
use rusqlite::{params, Connection};
use std::sync::Mutex;

use super::types::SkillConfig;

pub struct SkillDb {
    conn: Mutex<Connection>,
}

impl SkillDb {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("skills.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open skills database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS skills (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL DEFAULT '',
                enabled INTEGER NOT NULL DEFAULT 1,
                icon TEXT NOT NULL DEFAULT '',
                version TEXT NOT NULL DEFAULT '1.0.0',
                author TEXT NOT NULL DEFAULT '',
                configurable INTEGER NOT NULL DEFAULT 0,
                config TEXT NOT NULL DEFAULT '{}',
                is_core INTEGER NOT NULL DEFAULT 0,
                is_bundled INTEGER NOT NULL DEFAULT 0,
                tools TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );"
        ).map_err(|e| format!("Failed to create skills table: {}", e))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn list(&self) -> Result<Vec<SkillConfig>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, description, enabled, icon, version, author, configurable, config, is_core, is_bundled, tools, created_at, updated_at FROM skills ORDER BY is_core DESC, name ASC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let config_str: String = row.get(8)?;
                let tools_str: String = row.get(11)?;
                Ok(SkillConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    description: row.get(2)?,
                    enabled: row.get::<_, i32>(3)? != 0,
                    icon: row.get(4)?,
                    version: row.get(5)?,
                    author: row.get(6)?,
                    configurable: row.get::<_, i32>(7)? != 0,
                    config: serde_json::from_str(&config_str).unwrap_or(serde_json::json!({})),
                    is_core: row.get::<_, i32>(9)? != 0,
                    is_bundled: row.get::<_, i32>(10)? != 0,
                    tools: serde_json::from_str(&tools_str).unwrap_or_default(),
                    created_at: row.get(12)?,
                    updated_at: row.get(13)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    pub fn get(&self, id: &str) -> Result<Option<SkillConfig>, String> {
        let all = self.list()?;
        Ok(all.into_iter().find(|s| s.id == id))
    }

    pub fn upsert(&self, skill: &SkillConfig) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let config_str = serde_json::to_string(&skill.config).unwrap_or_else(|_| "{}".into());
        let tools_str = serde_json::to_string(&skill.tools).unwrap_or_else(|_| "[]".into());

        conn.execute(
            "INSERT OR REPLACE INTO skills (id, name, description, enabled, icon, version, author, configurable, config, is_core, is_bundled, tools, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)",
            params![
                skill.id,
                skill.name,
                skill.description,
                skill.enabled as i32,
                skill.icon,
                skill.version,
                skill.author,
                skill.configurable as i32,
                config_str,
                skill.is_core as i32,
                skill.is_bundled as i32,
                tools_str,
                skill.created_at,
                skill.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn toggle(&self, id: &str, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE skills SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![enabled as i32, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_config(&self, id: &str, config: &serde_json::Value) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let config_str = serde_json::to_string(config).unwrap_or_else(|_| "{}".into());
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE skills SET config = ?1, updated_at = ?2 WHERE id = ?3",
            params![config_str, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn seed_if_empty(&self, seeds: Vec<SkillConfig>) -> Result<(), String> {
        let existing = self.list()?;
        for seed in seeds {
            if !existing.iter().any(|s| s.id == seed.id) {
                self.upsert(&seed)?;
            }
        }
        Ok(())
    }
}
