use scraper::{Html, Selector};
use regex::Regex;
use std::sync::LazyLock;

static RE_BLANK_LINES: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"\n{3,}").expect("Invalid blank lines regex pattern")
});

pub struct ScrapedContent {
    pub text: String,
    pub title: String,
}

/// Fetch and extract text content from a URL.
pub async fn scrape_url(url: &str) -> Result<ScrapedContent, String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .user_agent("Mozilla/5.0 (compatible; ReeftotemBot/1.0)")
        .build()
        .map_err(|e| format!("Create HTTP client error: {e}"))?;

    let resp = client.get(url)
        .send()
        .await
        .map_err(|e| format!("Fetch URL error: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }

    let html_text = resp.text().await
        .map_err(|e| format!("Read response error: {e}"))?;

    extract_content(&html_text)
}

fn extract_content(html: &str) -> Result<ScrapedContent, String> {
    let document = Html::parse_document(html);

    // Extract title
    let title = Selector::parse("title").ok()
        .and_then(|sel| document.select(&sel).next())
        .map(|el| el.text().collect::<String>())
        .unwrap_or_default()
        .trim()
        .to_string();

    // Try content selectors in priority order
    let content_selectors = ["article", "main", "[role=main]", ".content", "#content", "body"];
    let skip_selectors = ["script", "style", "nav", "footer", "header", "aside", ".nav", ".sidebar", ".menu"];

    let mut text = String::new();

    for selector_str in &content_selectors {
        if let Ok(sel) = Selector::parse(selector_str) {
            if let Some(element) = document.select(&sel).next() {
                text = extract_text_from_element(&element, &skip_selectors);
                if !text.trim().is_empty() {
                    break;
                }
            }
        }
    }

    // Clean up whitespace
    text = RE_BLANK_LINES.replace_all(&text, "\n\n").to_string();
    text = text.trim().to_string();

    Ok(ScrapedContent { text, title })
}

fn extract_text_from_element(element: &scraper::ElementRef, skip_selectors: &[&str]) -> String {
    let mut text = String::new();

    for child in element.children() {
        if let Some(el) = scraper::ElementRef::wrap(child) {
            let tag = el.value().name();

            // Skip unwanted elements
            let should_skip = skip_selectors.iter().any(|sel| {
                // Simple tag match
                if !sel.starts_with('.') && !sel.starts_with('#') {
                    return tag == *sel;
                }
                false
            });

            if should_skip {
                continue;
            }

            // Block-level elements get newlines
            match tag {
                "p" | "div" | "section" | "article" | "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "li" | "br" | "tr" => {
                    let inner = extract_text_from_element(&el, skip_selectors);
                    if !inner.trim().is_empty() {
                        text.push('\n');
                        text.push_str(inner.trim());
                        text.push('\n');
                    }
                }
                _ => {
                    let inner = extract_text_from_element(&el, skip_selectors);
                    text.push_str(&inner);
                }
            }
        } else if let Some(text_node) = child.value().as_text() {
            text.push_str(text_node);
        }
    }

    text
}
