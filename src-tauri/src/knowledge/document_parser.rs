use std::io::Read;
use super::types::ParsedDocument;

/// Parse a document file into text based on file type.
pub fn parse_document(file_path: &str, file_type: &str) -> Result<ParsedDocument, String> {
    match file_type {
        "pdf" => parse_pdf(file_path),
        "docx" => parse_docx(file_path),
        "txt" | "md" | "csv" => parse_text(file_path),
        _ => parse_text(file_path),
    }
}

fn parse_pdf(file_path: &str) -> Result<ParsedDocument, String> {
    let doc = lopdf::Document::load(file_path)
        .map_err(|e| format!("PDF load error: {e}"))?;

    let page_count = doc.get_pages().len();
    let mut all_text = String::new();

    for page_num in 1..=page_count as u32 {
        if let Ok(text) = doc.extract_text(&[page_num]) {
            if !all_text.is_empty() {
                all_text.push_str("\n\n");
            }
            all_text.push_str(&text);
        }
    }

    Ok(ParsedDocument {
        text: all_text,
        metadata: serde_json::json!({ "pageCount": page_count }),
    })
}

fn parse_docx(file_path: &str) -> Result<ParsedDocument, String> {
    let file = std::fs::File::open(file_path)
        .map_err(|e| format!("open file error: {e}"))?;
    let mut archive = zip::ZipArchive::new(file)
        .map_err(|e| format!("zip open error: {e}"))?;

    let mut xml_content = String::new();
    {
        let mut entry = archive.by_name("word/document.xml")
            .map_err(|e| format!("no document.xml: {e}"))?;
        entry.read_to_string(&mut xml_content)
            .map_err(|e| format!("read xml error: {e}"))?;
    }

    let mut text = String::new();
    let mut reader = quick_xml::Reader::from_str(&xml_content);
    let mut in_t = false;
    let mut in_p = false;
    let mut buf = Vec::new();

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(quick_xml::events::Event::Start(ref e)) | Ok(quick_xml::events::Event::Empty(ref e)) => {
                let local = e.local_name();
                if local.as_ref() == b"t" {
                    in_t = true;
                } else if local.as_ref() == b"p" {
                    if in_p && !text.is_empty() {
                        text.push('\n');
                    }
                    in_p = true;
                }
            }
            Ok(quick_xml::events::Event::End(ref e)) => {
                let local = e.local_name();
                if local.as_ref() == b"t" {
                    in_t = false;
                } else if local.as_ref() == b"p" {
                    in_p = false;
                }
            }
            Ok(quick_xml::events::Event::Text(e)) => {
                if in_t {
                    if let Ok(t) = e.unescape() {
                        text.push_str(&t);
                    }
                }
            }
            Ok(quick_xml::events::Event::Eof) => break,
            Err(e) => return Err(format!("xml parse error: {e}")),
            _ => {}
        }
        buf.clear();
    }

    Ok(ParsedDocument {
        text,
        metadata: serde_json::json!({}),
    })
}

fn parse_text(file_path: &str) -> Result<ParsedDocument, String> {
    let text = std::fs::read_to_string(file_path)
        .map_err(|e| format!("read file error: {e}"))?;
    Ok(ParsedDocument {
        text,
        metadata: serde_json::json!({}),
    })
}
