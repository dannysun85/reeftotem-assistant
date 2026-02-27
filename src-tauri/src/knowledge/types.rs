use serde::{Deserialize, Serialize};

/// Knowledge base configuration — mirrors frontend KnowledgeBase
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeBaseConfig {
    pub id: String,
    pub name: String,
    pub description: String,
    pub embedding_model: String,
    pub embedding_dimension: u32,
    pub document_count: u32,
    pub total_chunks: u32,
    pub total_size: u64,
    pub chunk_size: usize,
    pub chunk_overlap: usize,
    pub watched_folder: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Document configuration — mirrors frontend KnowledgeDocument
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentConfig {
    pub id: String,
    pub knowledge_base_id: String,
    pub file_name: String,
    pub file_path: String,
    pub file_type: String,
    pub file_size: u64,
    pub chunk_count: u32,
    pub status: String,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

/// Search result — mirrors frontend RAGResult
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub chunk_id: String,
    pub document_id: String,
    pub document_name: String,
    pub content: String,
    pub score: f32,
}

/// RAG configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RAGConfig {
    #[serde(default = "default_top_k")]
    pub top_k: usize,
    #[serde(default = "default_score_threshold")]
    pub score_threshold: f32,
    #[serde(default = "default_max_context_tokens")]
    pub max_context_tokens: usize,
}

fn default_top_k() -> usize { 5 }
fn default_score_threshold() -> f32 { 0.3 }
fn default_max_context_tokens() -> usize { 4000 }

impl Default for RAGConfig {
    fn default() -> Self {
        Self {
            top_k: default_top_k(),
            score_threshold: default_score_threshold(),
            max_context_tokens: default_max_context_tokens(),
        }
    }
}

/// Embedding option for frontend select
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmbeddingOption {
    pub label: String,
    pub value: String,
    pub dimension: u32,
    pub available: bool,
}

/// Document processing progress event
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentProgressEvent {
    pub document_id: String,
    pub stage: String,
    pub percent: u32,
}

// ---- Internal types (not sent to frontend) ----

/// Chunk ready for DB insertion
pub struct ChunkInsert {
    pub id: String,
    pub document_id: String,
    pub content: String,
    pub metadata: serde_json::Value,
    pub embedding: Vec<f32>,
}

/// Result of parsing a document file
#[allow(dead_code)]
pub struct ParsedDocument {
    pub text: String,
    pub metadata: serde_json::Value,
}

/// A single text chunk with line metadata
pub struct TextChunk {
    pub content: String,
    pub metadata: serde_json::Value,
}
