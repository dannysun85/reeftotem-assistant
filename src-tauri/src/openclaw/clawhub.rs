// ClawHub CLI interaction — search, install, uninstall, list
// The ClawHub CLI is bundled with OpenClaw under ~/.openclaw/node_modules/.bin/clawhub

use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::LazyLock;

use super::sidecar::get_openclaw_config_dir;

static ANSI_RE: LazyLock<regex::Regex> = LazyLock::new(|| {
    regex::Regex::new(r"\x1b\[[0-9;]*[a-zA-Z]|\x1b\].*?\x07")
        .expect("Invalid ANSI regex pattern")
});

/// Strip ANSI escape sequences from CLI output
fn strip_ansi(s: &str) -> String {
    ANSI_RE.replace_all(s, "").to_string()
}

/// Get the clawhub CLI path and runner args
fn get_cli_command() -> Option<(String, Vec<String>)> {
    let config_dir = get_openclaw_config_dir();
    let config_path = PathBuf::from(&config_dir);

    // Try direct binary first
    let cli_binary = config_path
        .join("node_modules")
        .join(".bin")
        .join("clawhub");

    if cli_binary.exists() {
        return Some((cli_binary.to_string_lossy().to_string(), vec![]));
    }

    // Fallback: use node with the entry script
    let entry = config_path
        .join("node_modules")
        .join("clawhub")
        .join("dist")
        .join("cli.js");

    if entry.exists() {
        return Some(("node".to_string(), vec![entry.to_string_lossy().to_string()]));
    }

    None
}

/// Run a clawhub CLI command and return stdout
async fn run_command(args: &[&str]) -> Result<String, String> {
    let (program, mut prefix_args) = get_cli_command()
        .ok_or_else(|| "ClawHub CLI not found. Make sure OpenClaw is installed.".to_string())?;
    let config_dir = get_openclaw_config_dir();

    for a in args {
        prefix_args.push(a.to_string());
    }

    let output = tokio::process::Command::new(&program)
        .args(&prefix_args)
        .env("CI", "true")
        .env("FORCE_COLOR", "0")
        .env("CLAWHUB_WORKDIR", &config_dir)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run clawhub CLI: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "clawhub CLI exited with {}: {}{}",
            output.status,
            strip_ansi(&stderr),
            if !stdout.is_empty() {
                format!("\n{}", strip_ansi(&stdout))
            } else {
                String::new()
            }
        ));
    }

    Ok(strip_ansi(&String::from_utf8_lossy(&output.stdout)))
}

/// Run an `openclaw` CLI command and return stdout.
async fn run_openclaw_command(args: &[&str]) -> Result<String, String> {
    let output = tokio::process::Command::new("openclaw")
        .args(args)
        .env("CI", "true")
        .env("FORCE_COLOR", "0")
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .output()
        .await
        .map_err(|e| format!("Failed to run openclaw CLI: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        return Err(format!(
            "openclaw CLI exited with {}: {}{}",
            output.status,
            strip_ansi(&stderr),
            if !stdout.is_empty() {
                format!("\n{}", strip_ansi(&stdout))
            } else {
                String::new()
            }
        ));
    }

    Ok(strip_ansi(&String::from_utf8_lossy(&output.stdout)))
}

/// List skills via `openclaw skills list --json`, with optional query filter.
pub async fn openclaw_skills_list(query: &str) -> Result<Value, String> {
    let stdout = run_openclaw_command(&["skills", "list", "--json"]).await?;

    let skills: Vec<Value> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse openclaw skills JSON: {}", e))?;

    let query_lower = query.trim().to_lowercase();

    let results: Vec<Value> = skills
        .into_iter()
        .filter(|s| {
            if query_lower.is_empty() {
                return true;
            }
            let name = s["name"].as_str().unwrap_or("");
            let desc = s["description"].as_str().unwrap_or("");
            name.to_lowercase().contains(&query_lower)
                || desc.to_lowercase().contains(&query_lower)
        })
        .map(|s| {
            let name = s["name"].as_str().unwrap_or("unknown").to_string();
            let emoji = s["emoji"].as_str().unwrap_or("");
            let source = s["source"].as_str().unwrap_or("");
            let description = s["description"].as_str().unwrap_or("").to_string();
            let homepage = s["homepage"].as_str().unwrap_or("");
            let eligible = s["eligible"].as_bool().unwrap_or(false);
            let disabled = s["disabled"].as_bool().unwrap_or(false);
            let bundled = s["bundled"].as_bool().unwrap_or(false);
            let missing = s.get("missing").cloned().unwrap_or(json!(null));

            json!({
                "slug": name,
                "name": name,
                "description": description,
                "version": "bundled",
                "author": source,
                "icon": emoji,
                "eligible": eligible,
                "disabled": disabled,
                "bundled": bundled,
                "homepage": homepage,
                "missing": missing,
            })
        })
        .collect();

    Ok(json!(results))
}

/// Search for skills on ClawHub (legacy, kept for fallback)
#[allow(dead_code)]
pub async fn clawhub_search(query: &str) -> Result<Value, String> {
    let mut args = vec![];

    let is_empty = query.trim().is_empty();
    if is_empty {
        args.push("explore");
    } else {
        args.push("search");
        args.push(query);
    }

    let stdout = run_command(&args).await?;
    let mut results = Vec::new();

    for line in stdout.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        // Parse: slug  version  description
        let parts: Vec<&str> = trimmed.splitn(3, char::is_whitespace).collect();
        if parts.len() >= 3 {
            let slug = parts[0].trim();
            let version = parts[1].trim().trim_start_matches('v');
            let description = parts[2].trim();

            if !slug.is_empty() && !version.is_empty() {
                results.push(json!({
                    "slug": slug,
                    "name": slug,
                    "version": version,
                    "description": description,
                }));
            }
        }
    }

    Ok(json!(results))
}

/// Install a skill from ClawHub
pub async fn clawhub_install(slug: &str) -> Result<Value, String> {
    run_command(&["install", slug]).await?;
    Ok(json!({ "success": true }))
}

/// Uninstall a skill (direct fs operation)
pub fn clawhub_uninstall(slug: &str) -> Result<Value, String> {
    let config_dir = get_openclaw_config_dir();
    let config_path = PathBuf::from(&config_dir);

    // Remove skill directory
    let skill_dir = config_path.join("skills").join(slug);
    if skill_dir.exists() {
        std::fs::remove_dir_all(&skill_dir)
            .map_err(|e| format!("Failed to remove skill directory: {}", e))?;
    }

    // Update lock.json
    let lock_path = config_path.join(".clawhub").join("lock.json");
    if lock_path.exists() {
        let content = std::fs::read_to_string(&lock_path)
            .map_err(|e| format!("Failed to read lock.json: {}", e))?;
        if let Ok(mut lock) = serde_json::from_str::<Value>(&content) {
            if let Some(obj) = lock.as_object_mut() {
                obj.remove(slug);
                let updated = serde_json::to_string_pretty(&lock)
                    .map_err(|e| format!("Failed to serialize lock.json: {}", e))?;
                std::fs::write(&lock_path, updated)
                    .map_err(|e| format!("Failed to write lock.json: {}", e))?;
            }
        }
    }

    Ok(json!({ "success": true }))
}
