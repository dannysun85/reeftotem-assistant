use super::types::TextChunk;

const SEPARATORS: &[&str] = &["\n\n", "\n", ". ", " "];

/// Split text into chunks with overlap and line-number metadata.
pub fn chunk_text(text: &str, chunk_size: usize, chunk_overlap: usize) -> Vec<TextChunk> {
    if text.is_empty() {
        return Vec::new();
    }

    let line_map = build_line_map(text);
    let segments = recursive_split(text, SEPARATORS, chunk_size);

    let mut chunks = Vec::new();
    let mut current = String::new();
    let mut current_start_byte = 0usize;

    for segment in &segments {
        if current.is_empty() {
            current = segment.clone();
        } else if current.len() + segment.len() + 1 <= chunk_size {
            current.push(' ');
            current.push_str(segment);
        } else {
            // Emit current chunk
            let line_start = byte_offset_to_line(&line_map, current_start_byte);
            let line_end = byte_offset_to_line(&line_map, current_start_byte + current.len().saturating_sub(1));
            chunks.push(TextChunk {
                content: current.clone(),
                metadata: serde_json::json!({
                    "lineStart": line_start,
                    "lineEnd": line_end,
                }),
            });

            // Start new chunk with overlap
            let overlap_text = get_overlap(&current, chunk_overlap);
            current_start_byte = current_start_byte + current.len() - overlap_text.len();
            current = if overlap_text.is_empty() {
                segment.clone()
            } else {
                format!("{} {}", overlap_text, segment)
            };
        }
    }

    // Emit final chunk
    if !current.is_empty() {
        let line_start = byte_offset_to_line(&line_map, current_start_byte);
        let line_end = byte_offset_to_line(&line_map, current_start_byte + current.len().saturating_sub(1));
        chunks.push(TextChunk {
            content: current,
            metadata: serde_json::json!({
                "lineStart": line_start,
                "lineEnd": line_end,
            }),
        });
    }

    chunks
}

/// Recursively split text using separator hierarchy.
fn recursive_split(text: &str, separators: &[&str], chunk_size: usize) -> Vec<String> {
    if text.len() <= chunk_size || separators.is_empty() {
        return vec![text.to_string()];
    }

    let sep = separators[0];
    let parts: Vec<&str> = text.split(sep).collect();

    if parts.len() <= 1 {
        // This separator doesn't split; try next
        return recursive_split(text, &separators[1..], chunk_size);
    }

    let mut result = Vec::new();
    for part in parts {
        let trimmed = part.trim();
        if trimmed.is_empty() {
            continue;
        }
        if trimmed.len() <= chunk_size {
            result.push(trimmed.to_string());
        } else {
            // Need further splitting
            let sub = recursive_split(trimmed, &separators[1..], chunk_size);
            result.extend(sub);
        }
    }
    result
}

/// Build a mapping from line number to byte offset.
fn build_line_map(text: &str) -> Vec<usize> {
    let mut map = vec![0usize]; // line 1 starts at byte 0
    for (i, c) in text.char_indices() {
        if c == '\n' {
            map.push(i + c.len_utf8());
        }
    }
    map
}

/// Convert byte offset to 1-based line number using binary search.
fn byte_offset_to_line(line_map: &[usize], byte_offset: usize) -> usize {
    match line_map.binary_search(&byte_offset) {
        Ok(idx) => idx + 1,
        Err(idx) => idx, // idx is where it would be inserted; line = idx
    }
}

/// Get the last `overlap_chars` characters from text.
fn get_overlap(text: &str, overlap_chars: usize) -> String {
    if overlap_chars == 0 || text.is_empty() {
        return String::new();
    }
    let chars: Vec<char> = text.chars().collect();
    let start = chars.len().saturating_sub(overlap_chars);
    chars[start..].iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_chunk_text_basic() {
        let text = "Hello world. This is a test. Another sentence here.";
        let chunks = chunk_text(text, 30, 5);
        assert!(!chunks.is_empty());
        for chunk in &chunks {
            assert!(chunk.content.len() <= 35); // some tolerance due to overlap merge
        }
    }

    #[test]
    fn test_empty_text() {
        let chunks = chunk_text("", 100, 10);
        assert!(chunks.is_empty());
    }
}
