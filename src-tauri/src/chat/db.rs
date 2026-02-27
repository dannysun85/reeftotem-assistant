use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection};
use serde_json::Value;

pub struct ChatDb {
    conn: Mutex<Connection>,
}

impl ChatDb {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("chat.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open chat database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                agent_id TEXT,
                provider_id TEXT,
                model TEXT
            );
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                role TEXT NOT NULL,
                content TEXT NOT NULL DEFAULT '',
                thinking TEXT,
                tool_calls TEXT,
                attachments TEXT,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_messages_session_id ON messages(session_id);
            CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);"
        ).map_err(|e| format!("Failed to create chat tables: {}", e))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    /// List all sessions ordered by updated_at descending.
    pub fn list_sessions(&self) -> Result<Vec<Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, created_at, updated_at, agent_id, provider_id, model
                 FROM sessions ORDER BY updated_at DESC"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let title: String = row.get(1)?;
                let created_at: String = row.get(2)?;
                let updated_at: String = row.get(3)?;
                let agent_id: Option<String> = row.get(4)?;
                let provider_id: Option<String> = row.get(5)?;
                let model: Option<String> = row.get(6)?;
                Ok(serde_json::json!({
                    "id": id,
                    "title": title,
                    "createdAt": created_at,
                    "updatedAt": updated_at,
                    "agentId": agent_id,
                    "providerId": provider_id,
                    "model": model,
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    /// Create a new session and return it as JSON.
    pub fn create_session(
        &self,
        title: &str,
        agent_id: Option<&str>,
        provider_id: Option<&str>,
        model: Option<&str>,
    ) -> Result<Value, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO sessions (id, title, created_at, updated_at, agent_id, provider_id, model)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![id, title, now, now, agent_id, provider_id, model],
        )
        .map_err(|e| e.to_string())?;

        Ok(serde_json::json!({
            "id": id,
            "title": title,
            "createdAt": now,
            "updatedAt": now,
            "agentId": agent_id,
            "providerId": provider_id,
            "model": model,
        }))
    }

    /// Rename a session.
    pub fn rename_session(&self, id: &str, title: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE sessions SET title = ?1, updated_at = ?2 WHERE id = ?3",
            params![title, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Update the updated_at timestamp for a session.
    pub fn touch_session(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
            params![now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// Delete a session and all its messages.
    pub fn delete_session(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM messages WHERE session_id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM sessions WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    /// List all messages for a session ordered by created_at ascending.
    pub fn list_messages(&self, session_id: &str) -> Result<Vec<Value>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, session_id, role, content, thinking, tool_calls, attachments, created_at
                 FROM messages WHERE session_id = ?1 ORDER BY created_at ASC"
            )
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map(params![session_id], |row| {
                let id: String = row.get(0)?;
                let session_id: String = row.get(1)?;
                let role: String = row.get(2)?;
                let content: String = row.get(3)?;
                let thinking: Option<String> = row.get(4)?;
                let tool_calls: Option<String> = row.get(5)?;
                let attachments: Option<String> = row.get(6)?;
                let created_at: String = row.get(7)?;

                // Parse JSON fields, falling back to null if invalid
                let thinking_val: Value = thinking
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or(Value::Null);
                let tool_calls_val: Value = tool_calls
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or(Value::Null);
                let attachments_val: Value = attachments
                    .and_then(|s| serde_json::from_str(&s).ok())
                    .unwrap_or(Value::Null);

                Ok(serde_json::json!({
                    "id": id,
                    "sessionId": session_id,
                    "role": role,
                    "content": content,
                    "thinking": thinking_val,
                    "toolCalls": tool_calls_val,
                    "attachments": attachments_val,
                    "createdAt": created_at,
                }))
            })
            .map_err(|e| e.to_string())?;

        let mut result = Vec::new();
        for row in rows {
            result.push(row.map_err(|e| e.to_string())?);
        }
        Ok(result)
    }

    /// Save a message and return it as JSON.
    pub fn save_message(
        &self,
        session_id: &str,
        role: &str,
        content: &str,
        thinking: Option<&str>,
        tool_calls: Option<&Value>,
        attachments: Option<&Value>,
    ) -> Result<Value, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();

        let thinking_str = thinking.map(|t| t.to_string());
        let tool_calls_str = tool_calls.map(|v| serde_json::to_string(v).unwrap_or_default());
        let attachments_str = attachments.map(|v| serde_json::to_string(v).unwrap_or_default());

        conn.execute(
            "INSERT INTO messages (id, session_id, role, content, thinking, tool_calls, attachments, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                id,
                session_id,
                role,
                content,
                thinking_str,
                tool_calls_str,
                attachments_str,
                now,
            ],
        )
        .map_err(|e| e.to_string())?;

        // Also update session's updated_at
        conn.execute(
            "UPDATE sessions SET updated_at = ?1 WHERE id = ?2",
            params![now, session_id],
        )
        .map_err(|e| e.to_string())?;

        let thinking_val: Value = thinking
            .map(|s| serde_json::from_str(s).unwrap_or(Value::Null))
            .unwrap_or(Value::Null);
        let tool_calls_val: Value = tool_calls.cloned().unwrap_or(Value::Null);
        let attachments_val: Value = attachments.cloned().unwrap_or(Value::Null);

        Ok(serde_json::json!({
            "id": id,
            "sessionId": session_id,
            "role": role,
            "content": content,
            "thinking": thinking_val,
            "toolCalls": tool_calls_val,
            "attachments": attachments_val,
            "createdAt": now,
        }))
    }

    /// Clear all messages in a session.
    pub fn delete_messages(&self, session_id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute(
            "DELETE FROM messages WHERE session_id = ?1",
            params![session_id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }
}
