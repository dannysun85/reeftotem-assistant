use std::path::PathBuf;
use std::sync::Mutex;
use byteorder::{LittleEndian, ReadBytesExt, WriteBytesExt};
use rusqlite::{params, Connection};

use super::types::*;

pub struct KnowledgeDb {
    data_dir: PathBuf,
    conn: Mutex<Option<Connection>>,
}

impl KnowledgeDb {
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
            let db_path = self.data_dir.join("knowledge.db");
            let conn = Connection::open(&db_path)
                .map_err(|e| format!("open db error: {e}"))?;
            init_schema(&conn)?;
            *guard = Some(conn);
        }
        let conn = guard.as_ref().ok_or_else(|| "connection not initialized".to_string())?;
        f(conn)
    }

    // ---- Knowledge Base CRUD ----

    pub fn create_kb(&self, kb: &KnowledgeBaseConfig) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO knowledge_bases (id, name, description, embedding_model, embedding_dimension, document_count, total_chunks, total_size, chunk_size, chunk_overlap, watched_folder, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    kb.id, kb.name, kb.description, kb.embedding_model, kb.embedding_dimension,
                    kb.document_count, kb.total_chunks, kb.total_size, kb.chunk_size, kb.chunk_overlap,
                    kb.watched_folder, kb.created_at, kb.updated_at
                ],
            ).map_err(|e| format!("insert kb error: {e}"))?;
            Ok(())
        })
    }

    pub fn get_kb(&self, id: &str) -> Result<KnowledgeBaseConfig, String> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, name, description, embedding_model, embedding_dimension, document_count, total_chunks, total_size, chunk_size, chunk_overlap, watched_folder, created_at, updated_at FROM knowledge_bases WHERE id = ?1",
                params![id],
                |row| Ok(row_to_kb(row)),
            ).map_err(|e| format!("get kb error: {e}"))
        })
    }

    pub fn list_kbs(&self) -> Result<Vec<KnowledgeBaseConfig>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, name, description, embedding_model, embedding_dimension, document_count, total_chunks, total_size, chunk_size, chunk_overlap, watched_folder, created_at, updated_at FROM knowledge_bases ORDER BY created_at DESC"
            ).map_err(|e| format!("prepare error: {e}"))?;
            let rows = stmt.query_map([], |row| Ok(row_to_kb(row)))
                .map_err(|e| format!("query error: {e}"))?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row.map_err(|e| format!("row error: {e}"))?);
            }
            Ok(result)
        })
    }

    pub fn update_kb(&self, id: &str, updates: &serde_json::Value) -> Result<(), String> {
        self.with_conn(|conn| {
            let mut sets = Vec::new();
            let mut values: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

            if let Some(v) = updates.get("name").and_then(|v| v.as_str()) {
                sets.push("name = ?");
                values.push(Box::new(v.to_string()));
            }
            if let Some(v) = updates.get("description").and_then(|v| v.as_str()) {
                sets.push("description = ?");
                values.push(Box::new(v.to_string()));
            }
            if let Some(v) = updates.get("chunkSize").and_then(|v| v.as_u64()) {
                sets.push("chunk_size = ?");
                values.push(Box::new(v as i64));
            }
            if let Some(v) = updates.get("chunkOverlap").and_then(|v| v.as_u64()) {
                sets.push("chunk_overlap = ?");
                values.push(Box::new(v as i64));
            }
            if updates.get("watchedFolder").is_some() {
                let v = updates.get("watchedFolder").and_then(|v| v.as_str()).map(|s| s.to_string());
                sets.push("watched_folder = ?");
                values.push(Box::new(v));
            }

            sets.push("updated_at = ?");
            values.push(Box::new(chrono::Utc::now().to_rfc3339()));
            values.push(Box::new(id.to_string()));

            let sql = format!(
                "UPDATE knowledge_bases SET {} WHERE id = ?",
                sets.join(", ")
            );

            let params: Vec<&dyn rusqlite::types::ToSql> = values.iter().map(|v| v.as_ref()).collect();
            conn.execute(&sql, params.as_slice())
                .map_err(|e| format!("update kb error: {e}"))?;
            Ok(())
        })
    }

    pub fn delete_kb(&self, id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM chunks WHERE knowledge_base_id = ?1", params![id])
                .map_err(|e| format!("delete chunks error: {e}"))?;
            conn.execute("DELETE FROM documents WHERE knowledge_base_id = ?1", params![id])
                .map_err(|e| format!("delete docs error: {e}"))?;
            conn.execute("DELETE FROM knowledge_bases WHERE id = ?1", params![id])
                .map_err(|e| format!("delete kb error: {e}"))?;
            Ok(())
        })
    }

    // ---- Document CRUD ----

    pub fn create_document(&self, doc: &DocumentConfig) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO documents (id, knowledge_base_id, file_name, file_path, file_type, file_size, chunk_count, status, error, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
                params![
                    doc.id, doc.knowledge_base_id, doc.file_name, doc.file_path, doc.file_type,
                    doc.file_size, doc.chunk_count, doc.status, doc.error, doc.created_at, doc.updated_at
                ],
            ).map_err(|e| format!("insert doc error: {e}"))?;
            Ok(())
        })
    }

    pub fn get_document(&self, id: &str) -> Result<DocumentConfig, String> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT id, knowledge_base_id, file_name, file_path, file_type, file_size, chunk_count, status, error, created_at, updated_at FROM documents WHERE id = ?1",
                params![id],
                |row| Ok(row_to_doc(row)),
            ).map_err(|e| format!("get doc error: {e}"))
        })
    }

    pub fn list_documents(&self, kb_id: &str) -> Result<Vec<DocumentConfig>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, knowledge_base_id, file_name, file_path, file_type, file_size, chunk_count, status, error, created_at, updated_at FROM documents WHERE knowledge_base_id = ?1 ORDER BY created_at DESC"
            ).map_err(|e| format!("prepare error: {e}"))?;
            let rows = stmt.query_map(params![kb_id], |row| Ok(row_to_doc(row)))
                .map_err(|e| format!("query error: {e}"))?;
            let mut result = Vec::new();
            for row in rows {
                result.push(row.map_err(|e| format!("row error: {e}"))?);
            }
            Ok(result)
        })
    }

    pub fn update_document(&self, id: &str, status: &str, error: Option<&str>, chunk_count: Option<u32>) -> Result<(), String> {
        self.with_conn(|conn| {
            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE documents SET status = ?1, error = ?2, chunk_count = COALESCE(?3, chunk_count), updated_at = ?4 WHERE id = ?5",
                params![status, error, chunk_count.map(|c| c as i64), now, id],
            ).map_err(|e| format!("update doc error: {e}"))?;
            Ok(())
        })
    }

    pub fn delete_document(&self, id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM chunks WHERE document_id = ?1", params![id])
                .map_err(|e| format!("delete chunks error: {e}"))?;
            conn.execute("DELETE FROM documents WHERE id = ?1", params![id])
                .map_err(|e| format!("delete doc error: {e}"))?;
            Ok(())
        })
    }

    // ---- Chunk operations ----

    pub fn insert_chunks(&self, kb_id: &str, chunks: &[ChunkInsert]) -> Result<(), String> {
        self.with_conn(|conn| {
            let tx = conn.unchecked_transaction()
                .map_err(|e| format!("transaction error: {e}"))?;
            {
                let mut stmt = tx.prepare(
                    "INSERT INTO chunks (id, knowledge_base_id, document_id, content, metadata, embedding) VALUES (?1, ?2, ?3, ?4, ?5, ?6)"
                ).map_err(|e| format!("prepare error: {e}"))?;

                for chunk in chunks {
                    let embedding_bytes = f32_vec_to_bytes(&chunk.embedding);
                    let metadata_str = chunk.metadata.to_string();
                    stmt.execute(params![
                        chunk.id, kb_id, chunk.document_id, chunk.content,
                        metadata_str, embedding_bytes
                    ]).map_err(|e| format!("insert chunk error: {e}"))?;
                }
            }
            tx.commit().map_err(|e| format!("commit error: {e}"))?;
            Ok(())
        })
    }

    pub fn delete_document_chunks(&self, document_id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            conn.execute("DELETE FROM chunks WHERE document_id = ?1", params![document_id])
                .map_err(|e| format!("delete chunks error: {e}"))?;
            Ok(())
        })
    }

    // ---- Vector search ----

    pub fn search_similar(&self, kb_id: &str, query_embedding: &[f32], top_k: usize, threshold: f32) -> Result<Vec<SearchResult>, String> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT c.id, c.document_id, c.content, c.embedding, d.file_name
                 FROM chunks c JOIN documents d ON c.document_id = d.id
                 WHERE c.knowledge_base_id = ?1"
            ).map_err(|e| format!("prepare error: {e}"))?;

            let rows = stmt.query_map(params![kb_id], |row| {
                let chunk_id: String = row.get(0)?;
                let document_id: String = row.get(1)?;
                let content: String = row.get(2)?;
                let embedding_bytes: Vec<u8> = row.get(3)?;
                let document_name: String = row.get(4)?;
                Ok((chunk_id, document_id, content, embedding_bytes, document_name))
            }).map_err(|e| format!("query error: {e}"))?;

            let mut results = Vec::new();
            for row in rows {
                let (chunk_id, document_id, content, embedding_bytes, document_name) =
                    row.map_err(|e| format!("row error: {e}"))?;
                let embedding = bytes_to_f32_vec(&embedding_bytes);
                let score = cosine_similarity(query_embedding, &embedding);
                if score >= threshold {
                    results.push(SearchResult {
                        chunk_id,
                        document_id,
                        document_name,
                        content,
                        score,
                    });
                }
            }

            results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
            results.truncate(top_k);
            Ok(results)
        })
    }

    // ---- Stats ----

    pub fn refresh_kb_stats(&self, kb_id: &str) -> Result<(), String> {
        self.with_conn(|conn| {
            let doc_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM documents WHERE knowledge_base_id = ?1",
                params![kb_id], |r| r.get(0),
            ).map_err(|e| format!("count docs error: {e}"))?;

            let chunk_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM chunks WHERE knowledge_base_id = ?1",
                params![kb_id], |r| r.get(0),
            ).map_err(|e| format!("count chunks error: {e}"))?;

            let total_size: i64 = conn.query_row(
                "SELECT COALESCE(SUM(file_size), 0) FROM documents WHERE knowledge_base_id = ?1",
                params![kb_id], |r| r.get(0),
            ).map_err(|e| format!("sum size error: {e}"))?;

            let now = chrono::Utc::now().to_rfc3339();
            conn.execute(
                "UPDATE knowledge_bases SET document_count = ?1, total_chunks = ?2, total_size = ?3, updated_at = ?4 WHERE id = ?5",
                params![doc_count, chunk_count, total_size, now, kb_id],
            ).map_err(|e| format!("update stats error: {e}"))?;
            Ok(())
        })
    }

    /// Get knowledge_base_id for a document
    pub fn get_document_kb_id(&self, document_id: &str) -> Result<String, String> {
        self.with_conn(|conn| {
            conn.query_row(
                "SELECT knowledge_base_id FROM documents WHERE id = ?1",
                params![document_id],
                |row| row.get(0),
            ).map_err(|e| format!("get doc kb_id error: {e}"))
        })
    }
}

// ---- Schema init ----

fn init_schema(conn: &Connection) -> Result<(), String> {
    conn.execute_batch(
        "PRAGMA journal_mode = WAL;
         PRAGMA busy_timeout = 5000;
         PRAGMA foreign_keys = ON;

         CREATE TABLE IF NOT EXISTS knowledge_bases (
             id TEXT PRIMARY KEY,
             name TEXT NOT NULL,
             description TEXT NOT NULL DEFAULT '',
             embedding_model TEXT NOT NULL,
             embedding_dimension INTEGER NOT NULL DEFAULT 1536,
             document_count INTEGER NOT NULL DEFAULT 0,
             total_chunks INTEGER NOT NULL DEFAULT 0,
             total_size INTEGER NOT NULL DEFAULT 0,
             chunk_size INTEGER NOT NULL DEFAULT 512,
             chunk_overlap INTEGER NOT NULL DEFAULT 50,
             watched_folder TEXT,
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL
         );

         CREATE TABLE IF NOT EXISTS documents (
             id TEXT PRIMARY KEY,
             knowledge_base_id TEXT NOT NULL,
             file_name TEXT NOT NULL,
             file_path TEXT NOT NULL DEFAULT '',
             file_type TEXT NOT NULL,
             file_size INTEGER NOT NULL DEFAULT 0,
             chunk_count INTEGER NOT NULL DEFAULT 0,
             status TEXT NOT NULL DEFAULT 'pending',
             error TEXT,
             created_at TEXT NOT NULL,
             updated_at TEXT NOT NULL,
             FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id)
         );

         CREATE TABLE IF NOT EXISTS chunks (
             id TEXT PRIMARY KEY,
             knowledge_base_id TEXT NOT NULL,
             document_id TEXT NOT NULL,
             content TEXT NOT NULL,
             metadata TEXT NOT NULL DEFAULT '{}',
             embedding BLOB,
             FOREIGN KEY (knowledge_base_id) REFERENCES knowledge_bases(id),
             FOREIGN KEY (document_id) REFERENCES documents(id)
         );

         CREATE INDEX IF NOT EXISTS idx_chunks_kb ON chunks(knowledge_base_id);
         CREATE INDEX IF NOT EXISTS idx_chunks_doc ON chunks(document_id);
         CREATE INDEX IF NOT EXISTS idx_documents_kb ON documents(knowledge_base_id);"
    ).map_err(|e| format!("schema init error: {e}"))?;
    Ok(())
}

// ---- Vector helpers ----

fn f32_vec_to_bytes(v: &[f32]) -> Vec<u8> {
    let mut buf = Vec::with_capacity(v.len() * 4);
    for &val in v {
        let _ = buf.write_f32::<LittleEndian>(val);
    }
    buf
}

fn bytes_to_f32_vec(bytes: &[u8]) -> Vec<f32> {
    let mut cursor = std::io::Cursor::new(bytes);
    let mut result = Vec::with_capacity(bytes.len() / 4);
    while let Ok(val) = cursor.read_f32::<LittleEndian>() {
        result.push(val);
    }
    result
}

fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    if a.len() != b.len() || a.is_empty() {
        return 0.0;
    }
    let mut dot = 0.0f32;
    let mut norm_a = 0.0f32;
    let mut norm_b = 0.0f32;
    for i in 0..a.len() {
        dot += a[i] * b[i];
        norm_a += a[i] * a[i];
        norm_b += b[i] * b[i];
    }
    let denom = norm_a.sqrt() * norm_b.sqrt();
    if denom == 0.0 { 0.0 } else { dot / denom }
}

// ---- Row mappers ----

fn row_to_kb(row: &rusqlite::Row) -> KnowledgeBaseConfig {
    KnowledgeBaseConfig {
        id: row.get::<_, String>(0).unwrap_or_default(),
        name: row.get::<_, String>(1).unwrap_or_default(),
        description: row.get::<_, String>(2).unwrap_or_default(),
        embedding_model: row.get::<_, String>(3).unwrap_or_default(),
        embedding_dimension: row.get::<_, i64>(4).unwrap_or(0) as u32,
        document_count: row.get::<_, i64>(5).unwrap_or(0) as u32,
        total_chunks: row.get::<_, i64>(6).unwrap_or(0) as u32,
        total_size: row.get::<_, i64>(7).unwrap_or(0) as u64,
        chunk_size: row.get::<_, i64>(8).unwrap_or(512) as usize,
        chunk_overlap: row.get::<_, i64>(9).unwrap_or(50) as usize,
        watched_folder: row.get::<_, Option<String>>(10).unwrap_or(None),
        created_at: row.get::<_, String>(11).unwrap_or_default(),
        updated_at: row.get::<_, String>(12).unwrap_or_default(),
    }
}

fn row_to_doc(row: &rusqlite::Row) -> DocumentConfig {
    DocumentConfig {
        id: row.get::<_, String>(0).unwrap_or_default(),
        knowledge_base_id: row.get::<_, String>(1).unwrap_or_default(),
        file_name: row.get::<_, String>(2).unwrap_or_default(),
        file_path: row.get::<_, String>(3).unwrap_or_default(),
        file_type: row.get::<_, String>(4).unwrap_or_default(),
        file_size: row.get::<_, i64>(5).unwrap_or(0) as u64,
        chunk_count: row.get::<_, i64>(6).unwrap_or(0) as u32,
        status: row.get::<_, String>(7).unwrap_or_default(),
        error: row.get::<_, Option<String>>(8).unwrap_or(None),
        created_at: row.get::<_, String>(9).unwrap_or_default(),
        updated_at: row.get::<_, String>(10).unwrap_or_default(),
    }
}
