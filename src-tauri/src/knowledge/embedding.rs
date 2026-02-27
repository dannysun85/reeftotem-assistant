use serde::Deserialize;
use tauri::AppHandle;
use super::types::EmbeddingOption;

pub struct EmbeddingClient {
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    #[allow(dead_code)]
    pub dimension: u32,
}

#[derive(Deserialize)]
struct EmbeddingResponse {
    data: Vec<EmbeddingData>,
}

#[derive(Deserialize)]
struct EmbeddingData {
    embedding: Vec<f32>,
}

impl EmbeddingClient {
    /// Create client from a provider specification like "provider_id:model_name" or "provider_id:default"
    pub fn from_provider(app: &AppHandle, embedding_model: &str) -> Result<Self, String> {
        let parts: Vec<&str> = embedding_model.splitn(2, ':').collect();
        let (provider_id, model_hint) = if parts.len() == 2 {
            (parts[0], parts[1])
        } else {
            (embedding_model, "default")
        };

        let settings = crate::settings::load_settings(app)?;
        let provider = settings.providers.iter()
            .find(|p| p.id == provider_id)
            .ok_or_else(|| format!("Provider not found: {}", provider_id))?;

        let keys = crate::settings::load_api_keys(app).unwrap_or_default();
        let api_key = keys.get(provider_id).cloned().unwrap_or_default();

        let base_url = provider.base_url.clone().unwrap_or_else(|| "https://api.openai.com/v1".to_string());

        let model = if model_hint == "default" {
            "text-embedding-3-small".to_string()
        } else {
            model_hint.to_string()
        };

        Ok(Self {
            base_url,
            api_key,
            model,
            dimension: 1536,
        })
    }

    /// Embed multiple texts in a single request
    pub async fn embed(&self, texts: &[String]) -> Result<Vec<Vec<f32>>, String> {
        if texts.is_empty() {
            return Ok(Vec::new());
        }

        let url = format!("{}/embeddings", self.base_url.trim_end_matches('/'));

        let body = serde_json::json!({
            "model": self.model,
            "input": texts,
        });

        let client = reqwest::Client::new();
        let resp = client.post(&url)
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Embedding request failed: {e}"))?;

        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(format!("Embedding API error {}: {}", status, text));
        }

        let result: EmbeddingResponse = resp.json().await
            .map_err(|e| format!("Parse embedding response error: {e}"))?;

        Ok(result.data.into_iter().map(|d| d.embedding).collect())
    }

    /// Embed a single query text
    pub async fn embed_query(&self, query: &str) -> Result<Vec<f32>, String> {
        let results = self.embed(&[query.to_string()]).await?;
        results.into_iter().next().ok_or_else(|| "No embedding returned".to_string())
    }
}

/// Detect actual dimension by sending a test embedding
pub async fn detect_dimension(app: &AppHandle, embedding_model: &str) -> Result<usize, String> {
    let client = EmbeddingClient::from_provider(app, embedding_model)?;
    let result = client.embed_query("test").await?;
    Ok(result.len())
}

/// Get available embedding options from configured providers
pub fn get_embedding_options(app: &AppHandle) -> Result<Vec<EmbeddingOption>, String> {
    let settings = crate::settings::load_settings(app)?;
    let keys = crate::settings::load_api_keys(app).unwrap_or_default();

    let mut options = Vec::new();

    for provider in &settings.providers {
        let has_key = keys.get(&provider.id).map_or(false, |k| !k.is_empty());
        let provider_type = provider.provider_type.as_str();

        // Add common embedding models based on provider type
        match provider_type {
            "openai" => {
                options.push(EmbeddingOption {
                    label: format!("{} / text-embedding-3-small", provider.name),
                    value: format!("{}:text-embedding-3-small", provider.id),
                    dimension: 1536,
                    available: has_key,
                });
                options.push(EmbeddingOption {
                    label: format!("{} / text-embedding-3-large", provider.name),
                    value: format!("{}:text-embedding-3-large", provider.id),
                    dimension: 3072,
                    available: has_key,
                });
            }
            _ => {
                // Generic OpenAI-compatible — offer text-embedding-3-small as default
                if provider.base_url.is_some() {
                    options.push(EmbeddingOption {
                        label: format!("{} / text-embedding-3-small", provider.name),
                        value: format!("{}:text-embedding-3-small", provider.id),
                        dimension: 1536,
                        available: has_key,
                    });
                }
            }
        }
    }

    Ok(options)
}
