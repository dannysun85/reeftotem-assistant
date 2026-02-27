use tauri::{AppHandle, Emitter};
use super::db::KnowledgeDb;
use super::document_parser;
use super::text_chunker;
use super::embedding::EmbeddingClient;
use super::types::*;

const BATCH_SIZE: usize = 32;

/// Process a document: parse → chunk → embed → store
pub async fn process_document(
    app: AppHandle,
    db: &KnowledgeDb,
    document_id: &str,
    file_path: &str,
    file_type: &str,
    kb_id: &str,
    embedding_model: &str,
    chunk_size: usize,
    chunk_overlap: usize,
) -> Result<(), String> {
    // Step 1: Mark as processing
    db.update_document(document_id, "processing", None, None)?;
    emit_progress(&app, document_id, "parsing", 10);

    // Step 2: Parse document
    let parsed = document_parser::parse_document(file_path, file_type)?;
    if parsed.text.trim().is_empty() {
        db.update_document(document_id, "error", Some("Document is empty or could not be parsed"), None)?;
        return Err("Document is empty".to_string());
    }

    // Step 3: Chunk text
    emit_progress(&app, document_id, "chunking", 20);
    let text_chunks = text_chunker::chunk_text(&parsed.text, chunk_size, chunk_overlap);
    if text_chunks.is_empty() {
        db.update_document(document_id, "error", Some("No chunks produced"), None)?;
        return Err("No chunks produced".to_string());
    }

    // Step 4: Create embedding client
    emit_progress(&app, document_id, "embedding", 30);
    let embed_client = EmbeddingClient::from_provider(&app, embedding_model)?;

    // Step 5: Batch embed
    let total_chunks = text_chunks.len();
    let mut all_chunk_inserts: Vec<ChunkInsert> = Vec::with_capacity(total_chunks);
    let texts: Vec<String> = text_chunks.iter().map(|c| c.content.clone()).collect();

    let total_batches = (total_chunks + BATCH_SIZE - 1) / BATCH_SIZE;
    for (batch_idx, batch_texts) in texts.chunks(BATCH_SIZE).enumerate() {
        let embeddings = embed_client.embed(&batch_texts.to_vec()).await?;

        for (i, embedding) in embeddings.into_iter().enumerate() {
            let chunk_idx = batch_idx * BATCH_SIZE + i;
            let text_chunk = &text_chunks[chunk_idx];
            all_chunk_inserts.push(ChunkInsert {
                id: uuid::Uuid::new_v4().to_string(),
                document_id: document_id.to_string(),
                content: text_chunk.content.clone(),
                metadata: text_chunk.metadata.clone(),
                embedding,
            });
        }

        // Progress: 30 → 85, distributed across batches
        let progress = 30 + ((batch_idx + 1) as u32 * 55 / total_batches as u32);
        emit_progress(&app, document_id, "embedding", progress);
    }

    // Step 6: Store chunks
    emit_progress(&app, document_id, "storing", 90);
    db.insert_chunks(kb_id, &all_chunk_inserts)?;

    // Step 7: Update document status
    db.update_document(document_id, "ready", None, Some(total_chunks as u32))?;

    // Step 8: Refresh KB stats
    db.refresh_kb_stats(kb_id)?;
    emit_progress(&app, document_id, "done", 100);

    Ok(())
}

fn emit_progress(app: &AppHandle, document_id: &str, stage: &str, percent: u32) {
    let event = DocumentProgressEvent {
        document_id: document_id.to_string(),
        stage: stage.to_string(),
        percent,
    };
    let _ = app.emit("knowledge_documentProgress", &event);
}
