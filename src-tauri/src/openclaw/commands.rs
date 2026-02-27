use std::process::Stdio;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};

use super::types::OpenClawStatus;

// ========== OpenClaw Status ==========

/// Get current OpenClaw status (read-only)
#[tauri::command]
pub async fn get_openclaw_status(app: AppHandle) -> Result<OpenClawStatus, String> {
    let state = app.state::<crate::OpenClawState>();
    let sidecar = state.sidecar.lock().await;
    Ok(sidecar.status.clone())
}

// ========== Environment Detection ==========

/// Check if Node.js is installed, return version string
#[tauri::command]
pub async fn check_nodejs() -> Result<String, String> {
    let output = tokio::process::Command::new("node")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|_| "Node.js not found. Please install Node.js 22.12+ from https://nodejs.org".to_string())?;

    if !output.status.success() {
        return Err("Node.js check failed".into());
    }

    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();

    // Verify minimum version (v22.12+)
    let parts: Vec<u32> = version
        .trim_start_matches('v')
        .split('.')
        .filter_map(|v| v.parse::<u32>().ok())
        .collect();
    let major = parts.first().copied().unwrap_or(0);
    let minor = parts.get(1).copied().unwrap_or(0);

    if major < 22 || (major == 22 && minor < 12) {
        return Err(format!(
            "Node.js {} is too old. OpenClaw requires v22.12+",
            version
        ));
    }

    Ok(version)
}

/// Check if OpenClaw is installed, return version string
#[tauri::command]
pub async fn check_openclaw() -> Result<String, String> {
    // Try 'openclaw --version' first
    let result = tokio::process::Command::new("openclaw")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await;

    match result {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            Ok(version)
        }
        _ => {
            // Try npx as fallback
            let npx_result = tokio::process::Command::new("npx")
                .args(["openclaw", "--version"])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await;

            match npx_result {
                Ok(output) if output.status.success() => {
                    let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    Ok(format!("{} (via npx)", version))
                }
                _ => Err("OpenClaw not installed".into()),
            }
        }
    }
}

/// Install OpenClaw globally via npm.
/// Emits 'install_progress' events with { component, status, line, progress }.
#[tauri::command]
pub async fn install_openclaw(app: AppHandle) -> Result<(), String> {
    // First verify npm is available
    let npm_check = tokio::process::Command::new("npm")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(|_| "npm not found. Please install Node.js first.".to_string())?;

    if !npm_check.status.success() {
        return Err("npm is not available".into());
    }

    emit_progress(&app, "openclaw", "installing", "Starting npm install -g openclaw...", 10);

    // Run npm install -g openclaw
    let mut child = tokio::process::Command::new("npm")
        .args(["install", "-g", "openclaw"])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to start npm: {}", e))?;

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stdout);
            let mut lines = reader.lines();
            let mut progress = 20;
            while let Ok(Some(line)) = lines.next_line().await {
                progress = (progress + 5).min(85);
                emit_progress(&app_clone, "openclaw", "installing", &line, progress);
            }
        });
    }

    // Stream stderr (npm often outputs to stderr)
    if let Some(stderr) = child.stderr.take() {
        let app_clone = app.clone();
        tokio::spawn(async move {
            let reader = BufReader::new(stderr);
            let mut lines = reader.lines();
            while let Ok(Some(line)) = lines.next_line().await {
                // npm progress lines go to stderr
                emit_progress(&app_clone, "openclaw", "installing", &line, 50);
            }
        });
    }

    let status = child
        .wait()
        .await
        .map_err(|e| format!("npm process error: {}", e))?;

    if status.success() {
        emit_progress(&app, "openclaw", "installed", "OpenClaw installed successfully", 100);
        Ok(())
    } else {
        emit_progress(&app, "openclaw", "failed", "Installation failed", 0);
        Err("npm install -g openclaw failed. Check permissions or try with sudo.".into())
    }
}

fn emit_progress(app: &AppHandle, component: &str, status: &str, line: &str, progress: u32) {
    let _ = app.emit("install_progress", serde_json::json!({
        "component": component,
        "status": status,
        "line": line,
        "progress": progress,
    }));
}
