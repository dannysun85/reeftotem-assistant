use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection};

use super::types::{CronJobConfig, CronLastRun};

pub struct CronDb {
    conn: Mutex<Connection>,
}

impl CronDb {
    pub fn new(data_dir: PathBuf) -> Result<Self, String> {
        std::fs::create_dir_all(&data_dir).ok();
        let db_path = data_dir.join("cron.db");
        let conn = Connection::open(&db_path)
            .map_err(|e| format!("Failed to open cron database: {}", e))?;

        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS cron_jobs (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                message TEXT NOT NULL DEFAULT '',
                schedule TEXT NOT NULL,
                enabled INTEGER NOT NULL DEFAULT 1,
                target TEXT NOT NULL DEFAULT '{}',
                last_run TEXT,
                next_run TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );"
        ).map_err(|e| format!("Failed to create cron_jobs table: {}", e))?;

        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn list(&self) -> Result<Vec<CronJobConfig>, String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare("SELECT id, name, message, schedule, enabled, target, last_run, next_run, created_at, updated_at FROM cron_jobs ORDER BY created_at DESC")
            .map_err(|e| e.to_string())?;

        let rows = stmt
            .query_map([], |row| {
                let target_str: String = row.get(5)?;
                let last_run_str: Option<String> = row.get(6)?;
                Ok(CronJobConfig {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    message: row.get(2)?,
                    schedule: row.get(3)?,
                    enabled: row.get::<_, i32>(4)? != 0,
                    target: serde_json::from_str(&target_str).unwrap_or(serde_json::json!({})),
                    last_run: last_run_str.and_then(|s| serde_json::from_str(&s).ok()),
                    next_run: row.get(7)?,
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

    pub fn add(&self, job: &CronJobConfig) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let target_str = serde_json::to_string(&job.target).unwrap_or_else(|_| "{}".into());
        let last_run_str = job.last_run.as_ref().and_then(|lr| serde_json::to_string(lr).ok());

        conn.execute(
            "INSERT INTO cron_jobs (id, name, message, schedule, enabled, target, last_run, next_run, created_at, updated_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                job.id,
                job.name,
                job.message,
                job.schedule,
                job.enabled as i32,
                target_str,
                last_run_str,
                job.next_run,
                job.created_at,
                job.updated_at,
            ],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn remove(&self, id: &str) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        conn.execute("DELETE FROM cron_jobs WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn toggle(&self, id: &str, enabled: bool) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "UPDATE cron_jobs SET enabled = ?1, updated_at = ?2 WHERE id = ?3",
            params![enabled as i32, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn update_last_run(&self, id: &str, last_run: &CronLastRun) -> Result<(), String> {
        let conn = self.conn.lock().map_err(|e| e.to_string())?;
        let now = chrono::Utc::now().to_rfc3339();
        let last_run_str = serde_json::to_string(last_run).unwrap_or_else(|_| "{}".into());
        conn.execute(
            "UPDATE cron_jobs SET last_run = ?1, updated_at = ?2 WHERE id = ?3",
            params![last_run_str, now, id],
        )
        .map_err(|e| e.to_string())?;
        Ok(())
    }

    pub fn get(&self, id: &str) -> Result<Option<CronJobConfig>, String> {
        let all = self.list()?;
        Ok(all.into_iter().find(|j| j.id == id))
    }
}
