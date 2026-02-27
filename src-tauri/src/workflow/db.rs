use std::path::PathBuf;
use std::sync::Mutex;
use rusqlite::{params, Connection};

use super::types::*;

pub struct WorkflowDb {
    data_dir: PathBuf,
    conn: Mutex<Option<Connection>>,
}

impl WorkflowDb {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            data_dir,
            conn: Mutex::new(None),
        }
    }

    fn with_conn<F, T>(&self, f: F) -> Result<T, String>
    where
        F: FnOnce(&Connection) -> Result<T, String>,
    {
        let mut guard = self.conn.lock().map_err(|e| format!("lock error: {e}"))?;
        if guard.is_none() {
            std::fs::create_dir_all(&self.data_dir)
                .map_err(|e| format!("create dir error: {e}"))?;
            let db_path = self.data_dir.join("workflows.db");
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("open db error: {e}"))?;
            init_schema(&conn)?;
            *guard = Some(conn);
        }
        let conn = guard.as_ref().ok_or_else(|| "connection not initialized".to_string())?;
        f(conn)
    }

    // ---- Workflow CRUD ----

    pub fn list_workflows(&self) -> Result<Vec<WorkflowConfig>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, icon, nodes, edges, triggers, enabled, created_at, updated_at
                 FROM workflows ORDER BY created_at DESC"
            ).map_err(|e| format!("prepare error: {e}"))?;
            let rows = stmt.query_map([], |row| Ok(row_to_workflow(row)))
                .map_err(|e| format!("query error: {e}"))?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row.map_err(|e| format!("row error: {e}"))?);
            }
            Ok(result)
        })
    }

    pub fn get_workflow(&self, id: &str) -> Result<WorkflowConfig, String> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, description, icon, nodes, edges, triggers, enabled, created_at, updated_at
                 FROM workflows WHERE id = ?1",
                params![id],
                |row| Ok(row_to_workflow(row)),
            ).map_err(|e| format!("get workflow error: {e}"))
        })
    }

    pub fn create_workflow(&self, wf: &WorkflowConfig) -> Result<(), String> {
        self.with_conn(|conn| {
            let nodes_json = serde_json::to_string(&wf.nodes).map_err(|e| format!("serialize nodes: {e}"))?;
            let edges_json = serde_json::to_string(&wf.edges).map_err(|e| format!("serialize edges: {e}"))?;
            let triggers_json = serde_json::to_string(&wf.triggers).map_err(|e| format!("serialize triggers: {e}"))?;
            conn.execute(
                "INSERT INTO workflows (id, name, description, icon, nodes, edges, triggers, enabled, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    wf.id, wf.name, wf.description, wf.icon,
                    nodes_json, edges_json, triggers_json,
                    wf.enabled as i32, wf.created_at, wf.updated_at
                ],
            ).map_err(|e| format!("insert workflow error: {e}"))?;
            Ok(())
        })
    }

    pub fn update_workflow(&self, id: &str, wf: &WorkflowConfig) -> Result<(), String> {
        self.with_conn(|conn| {
            let nodes_json = serde_json::to_string(&wf.nodes).map_err(|e| format!("serialize nodes: {e}"))?;
            let edges_json = serde_json::to_string(&wf.edges).map_err(|e| format!("serialize edges: {e}"))?;
            let triggers_json = serde_json::to_string(&wf.triggers).map_err(|e| format!("serialize triggers: {e}"))?;
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE workflows SET name=?1, description=?2, icon=?3, nodes=?4, edges=?5, triggers=?6, enabled=?7, updated_at=?8 WHERE id=?9",
                params![
                    wf.name, wf.description, wf.icon,
                    nodes_json, edges_json, triggers_json,
                    wf.enabled as i32, now, id
                ],
            ).map_err(|e| format!("update workflow error: {e}"))?;
            Ok(())
        })
    }

    pub fn delete_workflow(&self, id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM workflow_runs WHERE workflow_id = ?1", params![id])
                .map_err(|e| format!("delete runs error: {e}"))?;
            conn.execute("DELETE FROM workflows WHERE id = ?1", params![id])
                .map_err(|e| format!("delete workflow error: {e}"))?;
            Ok(())
        })
    }

    // ---- Run CRUD ----

    pub fn create_run(&self, run: &WorkflowRun) -> Result<(), String> {
        self.with_conn(|conn| {
            let steps_json = serde_json::to_string(&run.steps).map_err(|e| format!("serialize steps: {e}"))?;
            conn.execute(
                "INSERT INTO workflow_runs (id, workflow_id, status, trigger_type, trigger_input, started_at, completed_at, steps, final_output, error)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    run.id, run.workflow_id, run.status, run.trigger_type,
                    run.trigger_input, run.started_at, run.completed_at,
                    steps_json, run.final_output, run.error
                ],
            ).map_err(|e| format!("insert run error: {e}"))?;
            Ok(())
        })
    }

    pub fn update_run(&self, run: &WorkflowRun) -> Result<(), String> {
        self.with_conn(|conn| {
            let steps_json = serde_json::to_string(&run.steps).map_err(|e| format!("serialize steps: {e}"))?;
            conn.execute(
                "UPDATE workflow_runs SET status=?1, completed_at=?2, steps=?3, final_output=?4, error=?5 WHERE id=?6",
                params![
                    run.status, run.completed_at, steps_json, run.final_output, run.error, run.id
                ],
            ).map_err(|e| format!("update run error: {e}"))?;
            Ok(())
        })
    }

    pub fn list_runs(&self, workflow_id: &str, limit: Option<i64>) -> Result<Vec<WorkflowRun>, String> {
        self.with_conn(|conn| {
            let limit_val = limit.unwrap_or(50);
            let mut stmt = conn.prepare(
                "SELECT id, workflow_id, status, trigger_type, trigger_input, started_at, completed_at, steps, final_output, error
                 FROM workflow_runs WHERE workflow_id = ?1 ORDER BY started_at DESC LIMIT ?2"
            ).map_err(|e| format!("prepare error: {e}"))?;
            let rows = stmt.query_map(params![workflow_id, limit_val], |row| Ok(row_to_run(row)))
                .map_err(|e| format!("query error: {e}"))?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row.map_err(|e| format!("row error: {e}"))?);
            }
            Ok(result)
        })
    }

    pub fn get_run(&self, id: &str) -> Result<WorkflowRun, String> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, workflow_id, status, trigger_type, trigger_input, started_at, completed_at, steps, final_output, error
                 FROM workflow_runs WHERE id = ?1",
                params![id],
                |row| Ok(row_to_run(row)),
            ).map_err(|e| format!("get run error: {e}"))
        })
    }

    pub fn delete_run(&self, id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM workflow_runs WHERE id = ?1", params![id])
                .map_err(|e| format!("delete run error: {e}"))?;
            Ok(())
        })
    }

    pub fn clear_runs(&self, workflow_id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM workflow_runs WHERE workflow_id = ?1", params![workflow_id])
                .map_err(|e| format!("clear runs error: {e}"))?;
            Ok(())
        })
    }
}

// ---- Schema ----

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA foreign_keys = ON;

         CREATE TABLE IF NOT EXISTS workflows (
             id          TEXT PRIMARY KEY,
             name        TEXT NOT NULL,
             description TEXT NOT NULL DEFAULT '',
             icon        TEXT NOT NULL DEFAULT '⚡',
             nodes       TEXT NOT NULL DEFAULT '[]',
             edges       TEXT NOT NULL DEFAULT '[]',
             triggers    TEXT NOT NULL DEFAULT '[]',
             enabled     INTEGER NOT NULL DEFAULT 1,
             created_at  TEXT NOT NULL,
             updated_at  TEXT NOT NULL
         );

         CREATE TABLE IF NOT EXISTS workflow_runs (
             id            TEXT PRIMARY KEY,
             workflow_id   TEXT NOT NULL,
             status        TEXT NOT NULL DEFAULT 'pending',
             trigger_type  TEXT NOT NULL DEFAULT 'manual',
             trigger_input TEXT,
             started_at    INTEGER NOT NULL,
             completed_at  INTEGER,
             steps         TEXT NOT NULL DEFAULT '[]',
             final_output  TEXT,
             error         TEXT
         );

         CREATE INDEX IF NOT EXISTS idx_wf_runs_wf ON workflow_runs(workflow_id);
         CREATE INDEX IF NOT EXISTS idx_wf_runs_started ON workflow_runs(started_at DESC);"
    ).map_err(|e| format!("schema init error: {e}"))?;
    Ok(())
}

// ---- Row mappers ----

fn row_to_workflow(row: &rusqlite::Row) -> WorkflowConfig {
    let nodes_str: String = row.get::<_, String>(4).unwrap_or_default();
    let edges_str: String = row.get::<_, String>(5).unwrap_or_default();
    let triggers_str: String = row.get::<_, String>(6).unwrap_or_default();

    WorkflowConfig {
        id: row.get::<_, String>(0).unwrap_or_default(),
        name: row.get::<_, String>(1).unwrap_or_default(),
        description: row.get::<_, String>(2).unwrap_or_default(),
        icon: row.get::<_, String>(3).unwrap_or_default(),
        nodes: serde_json::from_str(&nodes_str).unwrap_or_default(),
        edges: serde_json::from_str(&edges_str).unwrap_or_default(),
        triggers: serde_json::from_str(&triggers_str).unwrap_or_default(),
        enabled: row.get::<_, i32>(7).unwrap_or(1) != 0,
        created_at: row.get::<_, String>(8).unwrap_or_default(),
        updated_at: row.get::<_, String>(9).unwrap_or_default(),
    }
}

fn row_to_run(row: &rusqlite::Row) -> WorkflowRun {
    let steps_str: String = row.get::<_, String>(7).unwrap_or_default();

    WorkflowRun {
        id: row.get::<_, String>(0).unwrap_or_default(),
        workflow_id: row.get::<_, String>(1).unwrap_or_default(),
        status: row.get::<_, String>(2).unwrap_or_default(),
        trigger_type: row.get::<_, String>(3).unwrap_or_default(),
        trigger_input: row.get::<_, Option<String>>(4).unwrap_or(None),
        started_at: row.get::<_, i64>(5).unwrap_or(0),
        completed_at: row.get::<_, Option<i64>>(6).unwrap_or(None),
        steps: serde_json::from_str(&steps_str).unwrap_or_default(),
        final_output: row.get::<_, Option<String>>(8).unwrap_or(None),
        error: row.get::<_, Option<String>>(9).unwrap_or(None),
    }
}
