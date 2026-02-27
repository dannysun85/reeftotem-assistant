use tauri::{AppHandle, Manager, State};
use super::types::*;

// ========== Knowledge Base CRUD ==========

#[tauri::command]
pub async fn knowledge_list(state: State<'_, crate::KnowledgeState>) -> Result<Vec<KnowledgeBaseConfig>, String> {
    state.db.list_kbs()
}

#[tauri::command]
pub async fn knowledge_get(state: State<'_, crate::KnowledgeState>, id: String) -> Result<KnowledgeBaseConfig, String> {
    state.db.get_kb(&id)
}

#[tauri::command]
pub async fn knowledge_create(state: State<'_, crate::KnowledgeState>, config: serde_json::Value) -> Result<KnowledgeBaseConfig, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let id = uuid::Uuid::new_v4().to_string();

    let kb = KnowledgeBaseConfig {
        id: id.clone(),
        name: config.get("name").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string(),
        description: config.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        embedding_model: config.get("embeddingModel").and_then(|v| v.as_str()).unwrap_or("").to_string(),
        embedding_dimension: config.get("embeddingDimension").and_then(|v| v.as_u64()).unwrap_or(1536) as u32,
        document_count: 0,
        total_chunks: 0,
        total_size: 0,
        chunk_size: config.get("chunkSize").and_then(|v| v.as_u64()).unwrap_or(512) as usize,
        chunk_overlap: config.get("chunkOverlap").and_then(|v| v.as_u64()).unwrap_or(50) as usize,
        watched_folder: None,
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.create_kb(&kb)?;
    Ok(kb)
}

#[tauri::command]
pub async fn knowledge_update(state: State<'_, crate::KnowledgeState>, id: String, updates: serde_json::Value) -> Result<KnowledgeBaseConfig, String> {
    state.db.update_kb(&id, &updates)?;
    state.db.get_kb(&id)
}

#[tauri::command]
pub async fn knowledge_delete(state: State<'_, crate::KnowledgeState>, id: String) -> Result<bool, String> {
    state.db.delete_kb(&id)?;
    Ok(true)
}

// ========== Document CRUD ==========

#[tauri::command]
pub async fn knowledge_list_documents(state: State<'_, crate::KnowledgeState>, kb_id: String) -> Result<Vec<DocumentConfig>, String> {
    state.db.list_documents(&kb_id)
}

#[tauri::command]
pub async fn knowledge_get_document(state: State<'_, crate::KnowledgeState>, id: String) -> Result<DocumentConfig, String> {
    state.db.get_document(&id)
}

#[tauri::command]
pub async fn knowledge_delete_document(state: State<'_, crate::KnowledgeState>, id: String) -> Result<bool, String> {
    let kb_id = state.db.get_document_kb_id(&id)?;
    state.db.delete_document(&id)?;
    state.db.refresh_kb_stats(&kb_id)?;
    Ok(true)
}

// ========== Pipeline ==========

#[tauri::command]
pub async fn knowledge_add_document(
    app: AppHandle,
    state: State<'_, crate::KnowledgeState>,
    kb_id: String,
    file_path: String,
    file_name: String,
    file_type: String,
    file_size: u64,
) -> Result<DocumentConfig, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let doc_id = uuid::Uuid::new_v4().to_string();

    let doc = DocumentConfig {
        id: doc_id.clone(),
        knowledge_base_id: kb_id.clone(),
        file_name,
        file_path: file_path.clone(),
        file_type: file_type.clone(),
        file_size,
        chunk_count: 0,
        status: "pending".to_string(),
        error: None,
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.create_document(&doc)?;
    let kb = state.db.get_kb(&kb_id)?;

    let app_clone = app.clone();
    let doc_id_clone = doc_id.clone();
    let kb_id_clone = kb_id.clone();
    let embedding_model = kb.embedding_model.clone();
    let chunk_size = kb.chunk_size;
    let chunk_overlap = kb.chunk_overlap;

    tokio::spawn(async move {
        let ks = app_clone.state::<crate::KnowledgeState>();
        if let Err(e) = super::pipeline::process_document(
            app_clone.clone(), &ks.db,
            &doc_id_clone, &file_path, &file_type,
            &kb_id_clone, &embedding_model, chunk_size, chunk_overlap,
        ).await {
            crate::app_error!("Document processing failed: {}", e);
            let _ = ks.db.update_document(&doc_id_clone, "error", Some(&e), None);
        }
    });

    Ok(doc)
}

#[tauri::command]
pub async fn knowledge_add_url(
    app: AppHandle,
    state: State<'_, crate::KnowledgeState>,
    kb_id: String,
    url: String,
) -> Result<DocumentConfig, String> {
    let now = chrono::Utc::now().to_rfc3339();
    let doc_id = uuid::Uuid::new_v4().to_string();

    // Scrape URL first to get title
    let scraped = super::web_scraper::scrape_url(&url).await?;

    let file_name = if scraped.title.is_empty() {
        url.clone()
    } else {
        scraped.title.clone()
    };

    // Write scraped content to temp file
    let temp_dir = std::env::temp_dir();
    let temp_file = temp_dir.join(format!("reeftotem_url_{}.txt", doc_id));
    std::fs::write(&temp_file, &scraped.text)
        .map_err(|e| format!("Write temp file error: {e}"))?;

    let file_size = scraped.text.len() as u64;
    let file_path = temp_file.to_string_lossy().to_string();

    let doc = DocumentConfig {
        id: doc_id.clone(),
        knowledge_base_id: kb_id.clone(),
        file_name,
        file_path: file_path.clone(),
        file_type: "url".to_string(),
        file_size,
        chunk_count: 0,
        status: "pending".to_string(),
        error: None,
        created_at: now.clone(),
        updated_at: now,
    };

    state.db.create_document(&doc)?;
    let kb = state.db.get_kb(&kb_id)?;

    let app_clone = app.clone();
    let doc_id_clone = doc_id.clone();
    let kb_id_clone = kb_id.clone();
    let embedding_model = kb.embedding_model.clone();
    let chunk_size = kb.chunk_size;
    let chunk_overlap = kb.chunk_overlap;

    tokio::spawn(async move {
        let ks = app_clone.state::<crate::KnowledgeState>();
        if let Err(e) = super::pipeline::process_document(
            app_clone.clone(), &ks.db,
            &doc_id_clone, &file_path, "txt",
            &kb_id_clone, &embedding_model, chunk_size, chunk_overlap,
        ).await {
            crate::app_error!("URL document processing failed: {}", e);
            let _ = ks.db.update_document(&doc_id_clone, "error", Some(&e), None);
        }
        // Clean up temp file
        let _ = std::fs::remove_file(&temp_file);
    });

    Ok(doc)
}

#[tauri::command]
pub async fn knowledge_reprocess_document(app: AppHandle, state: State<'_, crate::KnowledgeState>, document_id: String) -> Result<(), String> {
    let doc = state.db.get_document(&document_id)?;
    let kb = state.db.get_kb(&doc.knowledge_base_id)?;

    // Clear existing chunks
    state.db.delete_document_chunks(&document_id)?;

    let app_clone = app.clone();
    let file_path = doc.file_path.clone();
    let file_type = doc.file_type.clone();
    let kb_id = doc.knowledge_base_id.clone();
    let embedding_model = kb.embedding_model.clone();
    let chunk_size = kb.chunk_size;
    let chunk_overlap = kb.chunk_overlap;

    tokio::spawn(async move {
        let ks = app_clone.state::<crate::KnowledgeState>();
        if let Err(e) = super::pipeline::process_document(
            app_clone.clone(), &ks.db,
            &document_id, &file_path, &file_type,
            &kb_id, &embedding_model, chunk_size, chunk_overlap,
        ).await {
            crate::app_error!("Reprocess document failed: {}", e);
            let _ = ks.db.update_document(&document_id, "error", Some(&e), None);
        }
    });

    Ok(())
}

#[tauri::command]
pub async fn knowledge_remove_document(state: State<'_, crate::KnowledgeState>, document_id: String) -> Result<(), String> {
    let kb_id = state.db.get_document_kb_id(&document_id)?;
    state.db.delete_document(&document_id)?;
    state.db.refresh_kb_stats(&kb_id)?;
    Ok(())
}

// ========== Search ==========

#[tauri::command]
pub async fn knowledge_search(
    app: AppHandle,
    state: State<'_, crate::KnowledgeState>,
    kb_id: String,
    query: String,
) -> Result<Vec<SearchResult>, String> {
    let kb = state.db.get_kb(&kb_id)?;
    let embed_client = super::embedding::EmbeddingClient::from_provider(&app, &kb.embedding_model)?;
    let query_embedding = embed_client.embed_query(&query).await?;
    state.db.search_similar(&kb_id, &query_embedding, 10, 0.0)
}

#[tauri::command]
pub async fn knowledge_rag(
    app: AppHandle,
    state: State<'_, crate::KnowledgeState>,
    kb_ids: Vec<String>,
    query: String,
    config: Option<RAGConfig>,
) -> Result<Vec<SearchResult>, String> {
    let rag_config = config.unwrap_or_default();

    if kb_ids.is_empty() {
        return Ok(Vec::new());
    }

    let first_kb = state.db.get_kb(&kb_ids[0])?;
    let embed_client = super::embedding::EmbeddingClient::from_provider(&app, &first_kb.embedding_model)?;
    let query_embedding = embed_client.embed_query(&query).await?;

    let mut all_results = Vec::new();
    for kb_id in &kb_ids {
        let results = state.db.search_similar(kb_id, &query_embedding, rag_config.top_k, rag_config.score_threshold)?;
        all_results.extend(results);
    }

    all_results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
    all_results.truncate(rag_config.top_k);

    Ok(all_results)
}

// ========== Config ==========

#[tauri::command]
pub async fn knowledge_get_embedding_options(app: AppHandle) -> Result<Vec<EmbeddingOption>, String> {
    super::embedding::get_embedding_options(&app)
}

#[tauri::command]
pub async fn knowledge_detect_dimension(app: AppHandle, embedding_model: String) -> Result<usize, String> {
    super::embedding::detect_dimension(&app, &embedding_model).await
}

#[tauri::command]
pub async fn knowledge_refresh_stats(state: State<'_, crate::KnowledgeState>, kb_id: String) -> Result<(), String> {
    state.db.refresh_kb_stats(&kb_id)
}

// ========== Watch (simplified get/set) ==========

#[tauri::command]
pub async fn knowledge_get_watch_status(state: State<'_, crate::KnowledgeState>, kb_id: String) -> Result<serde_json::Value, String> {
    let kb = state.db.get_kb(&kb_id)?;
    Ok(serde_json::json!({
        "watching": kb.watched_folder.is_some(),
        "folder": kb.watched_folder,
    }))
}

#[tauri::command]
pub async fn knowledge_set_watch_folder(state: State<'_, crate::KnowledgeState>, kb_id: String, folder_path: Option<String>) -> Result<(), String> {
    let updates = serde_json::json!({
        "watchedFolder": folder_path,
    });
    state.db.update_kb(&kb_id, &updates)
}
