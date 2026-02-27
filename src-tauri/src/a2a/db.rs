use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection};

pub struct A2ADb {
    conn: Mutex<Connection>,
}

impl A2ADb {
    pub fn new(path: PathBuf) -> Result<Self, String> {
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        let conn = Connection::open(&path).map_err(|e| format!("Failed to open a2a database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS delegations (
                id TEXT PRIMARY KEY,
                from_agent_id TEXT NOT NULL,
                to_agent_id TEXT NOT NULL,
                task TEXT NOT NULL,
                context TEXT,
                status TEXT DEFAULT 'pending',
                output TEXT,
                created_at TEXT,
                completed_at TEXT
            );"
        ).map_err(|e| format!("Failed to create delegations table: {}", e))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn create_delegation(
        &self,
        from_agent_id: &str,
        to_agent_id: &str,
        task: &str,
        context: Option<&str>,
    ) -> Result<serde_json::Value, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO delegations (id, from_agent_id, to_agent_id, task, context, status, created_at) VALUES (?1, ?2, ?3, ?4, ?5, 'pending', ?6)",
            params![id, from_agent_id, to_agent_id, task, context, now],
        ).map_err(|e| e.to_string())?;

        Ok(serde_json::json!({
            "id": id,
            "fromAgentId": from_agent_id,
            "toAgentId": to_agent_id,
            "task": task,
            "context": context,
            "status": "pending",
            "output": null,
            "createdAt": now,
            "completedAt": null
        }))
    }

    pub fn list_delegations(&self) -> Result<serde_json::Value, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, from_agent_id, to_agent_id, task, context, status, output, created_at, completed_at FROM delegations ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get::<_, String>(0).unwrap_or_default();
                let from_agent_id: String = row.get::<_, String>(1).unwrap_or_default();
                let to_agent_id: String = row.get::<_, String>(2).unwrap_or_default();
                let task: String = row.get::<_, String>(3).unwrap_or_default();
                let context: Option<String> = row.get::<_, Option<String>>(4).unwrap_or_default();
                let status: String = row.get::<_, String>(5).unwrap_or_default();
                let output: Option<String> = row.get::<_, Option<String>>(6).unwrap_or_default();
                let created_at: Option<String> = row.get::<_, Option<String>>(7).unwrap_or_default();
                let completed_at: Option<String> = row.get::<_, Option<String>>(8).unwrap_or_default();

                Ok(serde_json::json!({
                    "id": id,
                    "fromAgentId": from_agent_id,
                    "toAgentId": to_agent_id,
                    "task": task,
                    "context": context,
                    "status": status,
                    "output": output,
                    "createdAt": created_at,
                    "completedAt": completed_at
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(serde_json::Value::Array(result))
    }

    pub fn get_delegation(&self, id: &str) -> Result<serde_json::Value, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, from_agent_id, to_agent_id, task, context, status, output, created_at, completed_at FROM delegations WHERE id = ?1")
            .map_err(|e| e.to_string())?;

        let result = stmt
            .query_row(params![id], |row| {
                let id: String = row.get::<_, String>(0).unwrap_or_default();
                let from_agent_id: String = row.get::<_, String>(1).unwrap_or_default();
                let to_agent_id: String = row.get::<_, String>(2).unwrap_or_default();
                let task: String = row.get::<_, String>(3).unwrap_or_default();
                let context: Option<String> = row.get::<_, Option<String>>(4).unwrap_or_default();
                let status: String = row.get::<_, String>(5).unwrap_or_default();
                let output: Option<String> = row.get::<_, Option<String>>(6).unwrap_or_default();
                let created_at: Option<String> = row.get::<_, Option<String>>(7).unwrap_or_default();
                let completed_at: Option<String> = row.get::<_, Option<String>>(8).unwrap_or_default();

                Ok(serde_json::json!({
                    "id": id,
                    "fromAgentId": from_agent_id,
                    "toAgentId": to_agent_id,
                    "task": task,
                    "context": context,
                    "status": status,
                    "output": output,
                    "createdAt": created_at,
                    "completedAt": completed_at
                }))
            })
            .map_err(|e| e.to_string())?;

        Ok(result)
    }

    pub fn update_delegation_status(
        &self,
        id: &str,
        status: &str,
        output: Option<&str>,
    ) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE delegations SET status = ?1, output = ?2, completed_at = ?3 WHERE id = ?4",
            params![status, output, now, id],
        ).map_err(|e| e.to_string())?;

        Ok(())
    }

    pub fn delete_delegation(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM delegations WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}
