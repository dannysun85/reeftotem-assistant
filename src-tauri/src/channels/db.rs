use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection};

use super::types::ChannelConfig;

pub struct ChannelDb {
    conn: Mutex<Connection>,
}

impl ChannelDb {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("channels.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open channels database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS channels (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'disconnected',
                config TEXT NOT NULL DEFAULT '{}',
                agent_id TEXT,
                account_id TEXT,
                metadata TEXT NOT NULL DEFAULT '{}',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );"
        ).map_err(|e| format!("Failed to create channels table: {}", e))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn list(&self) -> Result<Vec<ChannelConfig>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, type, name, status, config, agent_id, account_id, metadata, created_at, updated_at FROM channels ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let config_str: String = row.get(4)?;
                let metadata_str: String = row.get(7)?;
                Ok(ChannelConfig {
                    id: row.get(0)?,
                    channel_type: row.get(1)?,
                    name: row.get(2)?,
                    status: row.get(3)?,
                    config: serde_json::from_str(&config_str).unwrap_or(serde_json::json!({})),
                    agent_id: row.get(5)?,
                    account_id: row.get(6)?,
                    metadata: serde_json::from_str(&metadata_str).unwrap_or(serde_json::json!({})),
                    created_at: row.get(8)?,
                    updated_at: row.get(9)?,
                })
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    pub fn add(&self, channel: &ChannelConfig) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let config_str = serde_json::to_string(&channel.config).unwrap_or_else(|_| "{}".into());
        let metadata_str = serde_json::to_string(&channel.metadata).unwrap_or_else(|_| "{}".into());

        conn.execute(
            "INSERT INTO channels (id, type, name, status, config, agent_id, account_id, metadata, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                channel.id,
                channel.channel_type,
                channel.name,
                channel.status,
                config_str,
                channel.agent_id,
                channel.account_id,
                metadata_str,
                channel.created_at,
                channel.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM channels WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update(&self, id: &str, updates: &serde_json::Value) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        if let Some(name) = updates.get("name").and_then(|n| n.as_str()) {
            conn.execute(
                "UPDATE channels SET name = ?1, updated_at = ?2 WHERE id = ?3",
                params![name, now, id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(config) = updates.get("config") {
            let config_str = serde_json::to_string(config).unwrap_or_else(|_| "{}".into());
            conn.execute(
                "UPDATE channels SET config = ?1, updated_at = ?2 WHERE id = ?3",
                params![config_str, now, id],
            )
            .map_err(|e| e.to_string())?;
        }
        if let Some(status) = updates.get("status").and_then(|s| s.as_str()) {
            conn.execute(
                "UPDATE channels SET status = ?1, updated_at = ?2 WHERE id = ?3",
                params![status, now, id],
            )
            .map_err(|e| e.to_string())?;
        }
        Ok(())
    }

    pub fn update_status(&self, id: &str, status: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE channels SET status = ?1, updated_at = ?2 WHERE id = ?3",
            params![status, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn bind_agent(&self, channel_id: &str, agent_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE channels SET agent_id = ?1, updated_at = ?2 WHERE id = ?3",
            params![agent_id, now, channel_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn unbind_agent(&self, channel_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE channels SET agent_id = NULL, updated_at = ?1 WHERE id = ?2",
            params![now, channel_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<ChannelConfig>, String> {
        let all = self.list()?;
        Ok(all.into_iter().find(|c| c.id == id))
    }
}
