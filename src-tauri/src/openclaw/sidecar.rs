use std::process::Stdio;
use std::sync::Arc;
use std::time::Duration;
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};

use super::types::OpenClawStatus;

/// Default port for the OpenClaw engine
const DEFAULT_PORT: u16 = 18789;
/// Max number of automatic restart attempts
const MAX_RESTARTS: u32 = 3;
/// Health check interval in seconds
const HEALTH_CHECK_INTERVAL: u64 = 5;
/// Startup timeout when waiting for WS ready (seconds)
const STARTUP_TIMEOUT: u64 = 30;

/// Manages the OpenClaw sidecar process lifecycle
pub struct OpenClawSidecar {
    pub process: Option<Child>,
    pub status: OpenClawStatus,
    pub port: u16,
    restart_count: u32,
}

impl OpenClawSidecar {
    pub fn new() -> Self {
        Self {
            process: None,
            status: OpenClawStatus::default(),
            port: DEFAULT_PORT,
            restart_count: 0,
        }
    }

    /// Start the OpenClaw sidecar process
    pub async fn start(&mut self, app: &AppHandle) -> Result<OpenClawStatus, String> {
        if self.status.state == "running" {
            return Ok(self.status.clone());
        }

        self.status.state = "starting".into();
        self.status.error = None;

        // Kill any existing process on this port so we can start our own
        if is_port_in_use(self.port).await {
            app_info!("Port {} already in use — killing existing process", self.port);
            kill_process_on_port(self.port).await;
            // Wait for port to become available
            for _ in 0..10 {
                tokio::time::sleep(Duration::from_millis(500)).await;
                if !is_port_in_use(self.port).await {
                    break;
                }
            }
            if is_port_in_use(self.port).await {
                let msg = format!("Port {} still in use after killing existing process", self.port);
                app_error!("{}", msg);
                self.status.state = "error".into();
                self.status.error = Some(msg.clone());
                let _ = app.emit("openclaw_status", &self.status);
                return Err(msg);
            }
        }

        // Build environment variables with API keys
        let env_vars = build_env_vars(app);

        // Generate/load gateway token
        let token = get_or_create_gateway_token(app)?;

        // Try to find the openclaw binary/script
        let openclaw_cmd = find_openclaw_command(app);

        match &openclaw_cmd {
            Some(cmd) => {
                app_info!("Starting OpenClaw: {} on port {}", cmd, self.port);

                let mut env_with_token = env_vars;
                env_with_token.push(("OPENCLAW_GATEWAY_TOKEN".into(), token.clone()));

                let result = Command::new(cmd)
                    .args([
                        "gateway",
                        "--port",
                        &self.port.to_string(),
                        "--token",
                        &token,
                        "--bind",
                        "loopback",
                    ])
                    .envs(env_with_token)
                    .stdout(Stdio::piped())
                    .stderr(Stdio::piped())
                    .kill_on_drop(true)
                    .spawn();

                match result {
                    Ok(child) => {
                        let pid = child.id();
                        self.process = Some(child);
                        self.status.pid = pid;

                        // Wait for OpenClaw to be ready via WS probe
                        match wait_for_ready(self.port, STARTUP_TIMEOUT).await {
                            Ok(()) => {
                                self.status.state = "running".into();
                                self.restart_count = 0;
                                app_info!("OpenClaw started successfully (pid: {:?})", pid);
                                let _ = app.emit("openclaw_status", &self.status);
                                Ok(self.status.clone())
                            }
                            Err(e) => {
                                let msg = format!("OpenClaw started but readiness check failed: {}", e);
                                app_warn!("{}", msg);
                                // Process started but not responding — still mark as running
                                self.status.state = "running".into();
                                self.status.error = Some(msg.clone());
                                let _ = app.emit("openclaw_status", &self.status);
                                Ok(self.status.clone())
                            }
                        }
                    }
                    Err(e) => {
                        let msg = format!("Failed to spawn OpenClaw process: {}", e);
                        app_error!("{}", msg);
                        self.status.state = "error".into();
                        self.status.error = Some(msg.clone());
                        let _ = app.emit("openclaw_status", &self.status);
                        Err(msg)
                    }
                }
            }
            None => {
                let msg = "OpenClaw not found. Install it with: npm install -g openclaw".to_string();
                app_warn!("{}", msg);
                self.status.state = "error".into();
                self.status.error = Some(msg.clone());
                let _ = app.emit("openclaw_status", &self.status);
                Err(msg)
            }
        }
    }

    /// Stop the OpenClaw process
    pub async fn stop(&mut self, app: &AppHandle) -> Result<(), String> {
        // Disconnect WS bridge first
        if let Some(state) = app.try_state::<crate::OpenClawState>() {
            state.ws_bridge.disconnect().await;
        }

        if let Some(ref mut child) = self.process {
            // Kill process directly (OpenClaw handles SIGTERM gracefully)
            let _ = child.kill().await;
            let _ = child.wait().await;
        }

        self.process = None;
        self.status.state = "stopped".into();
        self.status.pid = None;
        self.status.error = None;
        self.restart_count = 0;
        let _ = app.emit("openclaw_status", &self.status);
        app_info!("OpenClaw stopped");
        Ok(())
    }

    /// Restart OpenClaw
    pub async fn restart(&mut self, app: &AppHandle) -> Result<OpenClawStatus, String> {
        self.stop(app).await?;
        tokio::time::sleep(Duration::from_millis(500)).await;
        self.start(app).await
    }

    /// Check if the process is still alive
    pub async fn check_alive(&mut self) -> bool {
        if let Some(ref mut child) = self.process {
            match child.try_wait() {
                Ok(Some(_exit)) => {
                    // Process exited
                    self.process = None;
                    self.status.state = "stopped".into();
                    self.status.pid = None;
                    false
                }
                Ok(None) => true, // Still running
                Err(_) => false,
            }
        } else {
            false
        }
    }

    /// Attempt auto-restart if within limits
    pub async fn try_auto_restart(&mut self, app: &AppHandle) -> bool {
        if self.restart_count >= MAX_RESTARTS {
            app_error!("OpenClaw exceeded max restart attempts ({})", MAX_RESTARTS);
            self.status.state = "error".into();
            self.status.error = Some(format!("Exceeded {} restart attempts", MAX_RESTARTS));
            let _ = app.emit("openclaw_status", &self.status);
            return false;
        }

        self.restart_count += 1;
        let delay = Duration::from_secs(2u64.pow(self.restart_count));
        app_info!(
            "Auto-restarting OpenClaw (attempt {}/{}) in {:?}",
            self.restart_count,
            MAX_RESTARTS,
            delay
        );
        tokio::time::sleep(delay).await;

        match self.start(app).await {
            Ok(_) => true,
            Err(_) => false,
        }
    }
}

/// Start background monitoring task
pub fn spawn_monitor(sidecar: Arc<Mutex<OpenClawSidecar>>, app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(HEALTH_CHECK_INTERVAL)).await;

            let mut guard = sidecar.lock().await;
            if guard.status.state != "running" {
                drop(guard);
                continue;
            }

            // Check if our process is alive
            if !guard.check_alive().await {
                app_warn!("OpenClaw process died unexpectedly");
                let _ = app.emit("openclaw_status", &guard.status);
                let restarted = guard.try_auto_restart(&app).await;
                if restarted {
                    let port = guard.port;
                    drop(guard);
                    connect_ws_bridge(&app, port).await;
                } else {
                    drop(guard);
                }
            } else {
                drop(guard);
            }
        }
    });
}

// ========== Helper Functions ==========

/// Get or create the gateway token that Reeftotem uses for its own OpenClaw instance.
/// Stored in app data dir. We always use our own token (not external config).
fn get_or_create_gateway_token(app: &AppHandle) -> Result<String, String> {
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("No app data dir: {}", e))?;
    let token_path = data_dir.join("openclaw_token");

    // Try reading our saved token
    if let Ok(token) = std::fs::read_to_string(&token_path) {
        let token = token.trim().to_string();
        if !token.is_empty() {
            return Ok(token);
        }
    }

    // Generate a new token
    let token = uuid::Uuid::new_v4().to_string();
    let _ = std::fs::create_dir_all(&data_dir);
    std::fs::write(&token_path, &token)
        .map_err(|e| format!("Failed to save gateway token: {}", e))?;

    app_info!("Generated new OpenClaw gateway token");
    Ok(token)
}

/// Get the OpenClaw config directory path (~/.openclaw)
pub fn get_openclaw_config_dir() -> String {
    dirs::home_dir()
        .unwrap_or_default()
        .join(".openclaw")
        .to_string_lossy()
        .to_string()
}

/// Find the openclaw command (npm global, local node_modules, or bundled)
fn find_openclaw_command(app: &AppHandle) -> Option<String> {
    // 1. Check if openclaw is in PATH
    if which_exists("openclaw") {
        return Some("openclaw".into());
    }

    // 2. Check node_modules/.bin/openclaw in resource dir
    if let Ok(resource_dir) = app.path().resource_dir() {
        let local_bin = resource_dir.join("node_modules/.bin/openclaw");
        if local_bin.exists() {
            return Some(local_bin.to_string_lossy().into());
        }
    }

    // 3. Try npx as fallback
    if which_exists("npx") {
        return Some("npx".into());
    }

    None
}

/// Check if a command exists in PATH
fn which_exists(cmd: &str) -> bool {
    std::process::Command::new("which")
        .arg(cmd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Build environment variables for the OpenClaw process
fn build_env_vars(app: &AppHandle) -> Vec<(String, String)> {
    let mut vars = Vec::new();

    // Set the port
    vars.push(("OPENCLAW_PORT".into(), "18789".into()));

    // Load API keys from settings and inject them
    if let Ok(keys) = crate::settings::load_api_keys(app) {
        for (provider_id, key) in &keys {
            let env_name = match provider_id.as_str() {
                "anthropic" => "ANTHROPIC_API_KEY",
                "openai" => "OPENAI_API_KEY",
                "google" | "gemini" => "GEMINI_API_KEY",
                "openrouter" => "OPENROUTER_API_KEY",
                "moonshot" => "MOONSHOT_API_KEY",
                "siliconflow" => "SILICONFLOW_API_KEY",
                _ => continue,
            };
            vars.push((env_name.into(), key.clone()));
        }
    }

    vars
}

/// Check if a port is already in use by trying a TCP connection
async fn is_port_in_use(port: u16) -> bool {
    tokio::net::TcpStream::connect(format!("127.0.0.1:{}", port))
        .await
        .is_ok()
}

/// Kill whatever process is listening on the given port (via lsof + kill)
async fn kill_process_on_port(port: u16) {
    if let Ok(output) = tokio::process::Command::new("lsof")
        .args(["-ti", &format!(":{}", port)])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .output()
        .await
    {
        let pids = String::from_utf8_lossy(&output.stdout);
        for pid_str in pids.lines() {
            let pid = pid_str.trim();
            if !pid.is_empty() {
                app_info!("Killing process {} on port {}", pid, port);
                let _ = tokio::process::Command::new("kill")
                    .args(["-TERM", pid])
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .status()
                    .await;
            }
        }
    }
}

/// Wait for OpenClaw to be ready by trying WS connection
async fn wait_for_ready(port: u16, timeout_secs: u64) -> Result<(), String> {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(timeout_secs);

    while tokio::time::Instant::now() < deadline {
        // Try to connect WS — success means the server is ready
        let url = format!("ws://127.0.0.1:{}/ws", port);
        match tokio_tungstenite::connect_async(&url).await {
            Ok((ws_stream, _)) => {
                // Close the probe connection immediately
                let (mut write, _) = futures_util::StreamExt::split(ws_stream);
                let _ = futures_util::SinkExt::send(
                    &mut write,
                    tokio_tungstenite::tungstenite::Message::Close(None),
                )
                .await;
                return Ok(());
            }
            Err(_) => {}
        }
        tokio::time::sleep(Duration::from_millis(500)).await;
    }

    Err(format!(
        "OpenClaw did not respond within {} seconds",
        timeout_secs
    ))
}

/// Auto-bootstrap: detect OpenClaw -> install if missing -> start
/// Called once at app startup in a background task.
pub fn spawn_auto_bootstrap(sidecar: Arc<Mutex<OpenClawSidecar>>, app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        // Wait for app to fully initialize
        tokio::time::sleep(Duration::from_secs(3)).await;
        app_info!("OpenClaw auto-bootstrap: starting...");

        // 1. Check if OpenClaw is already available
        let openclaw_found = check_openclaw_async().await;

        if !openclaw_found {
            app_info!("OpenClaw auto-bootstrap: OpenClaw not found, checking Node.js...");

            // Check if npm is available for auto-install
            let npm_available = check_command_async("npm").await;
            if !npm_available {
                app_warn!("OpenClaw auto-bootstrap: npm not available, cannot auto-install OpenClaw. Skipping.");
                let _ = app.emit("openclaw_status", serde_json::json!({
                    "state": "error",
                    "port": 18789,
                    "pid": serde_json::Value::Null,
                    "error": "OpenClaw not installed. Please install Node.js 22.12+ and run: npm install -g openclaw"
                }));
                return;
            }

            // Auto-install OpenClaw
            app_info!("OpenClaw auto-bootstrap: installing OpenClaw via npm...");
            let _ = app.emit("install_progress", serde_json::json!({
                "component": "openclaw",
                "status": "installing",
                "line": "Auto-installing OpenClaw...",
                "progress": 10
            }));

            let install_result = tokio::process::Command::new("npm")
                .args(["install", "-g", "openclaw"])
                .stdout(Stdio::piped())
                .stderr(Stdio::piped())
                .output()
                .await;

            match install_result {
                Ok(output) if output.status.success() => {
                    app_info!("OpenClaw auto-bootstrap: OpenClaw installed successfully");
                    let _ = app.emit("install_progress", serde_json::json!({
                        "component": "openclaw",
                        "status": "installed",
                        "line": "OpenClaw installed successfully",
                        "progress": 100
                    }));
                }
                Ok(output) => {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    app_warn!("OpenClaw auto-bootstrap: npm install failed: {}", stderr);
                    let _ = app.emit("install_progress", serde_json::json!({
                        "component": "openclaw",
                        "status": "failed",
                        "line": format!("Install failed: {}", stderr.chars().take(200).collect::<String>()),
                        "progress": 0
                    }));
                    return;
                }
                Err(e) => {
                    app_warn!("OpenClaw auto-bootstrap: npm install error: {}", e);
                    return;
                }
            }
        } else {
            app_info!("OpenClaw auto-bootstrap: OpenClaw already installed");
        }

        // 2. Start OpenClaw
        app_info!("OpenClaw auto-bootstrap: starting...");
        let mut guard = sidecar.lock().await;
        match guard.start(&app).await {
            Ok(status) => {
                app_info!("OpenClaw auto-bootstrap: started (state={})", status.state);
                let port = guard.port;
                drop(guard); // Release lock before WS connect

                // 3. Connect WebSocket bridge
                connect_ws_bridge(&app, port).await;
            }
            Err(e) => {
                app_warn!("OpenClaw auto-bootstrap: failed to start: {}", e);
            }
        }
    });
}

/// Connect the WebSocket bridge to the running OpenClaw instance.
pub async fn connect_ws_bridge(app: &AppHandle, port: u16) {
    let token = get_or_create_gateway_token(app).unwrap_or_default();
    if let Some(state) = app.try_state::<crate::OpenClawState>() {
        state.ws_bridge.set_app_handle(app.clone()).await;
        if let Err(e) = state.ws_bridge.connect(port, &token).await {
            app_warn!("WsBridge connect failed: {}", e);
        }
    }
}

/// Check if openclaw command is available (async)
async fn check_openclaw_async() -> bool {
    if let Ok(output) = tokio::process::Command::new("openclaw")
        .arg("--version")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
    {
        if output.status.success() {
            return true;
        }
    }
    false
}

/// Check if a command exists (async)
async fn check_command_async(cmd: &str) -> bool {
    tokio::process::Command::new("which")
        .arg(cmd)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .await
        .map(|s| s.success())
        .unwrap_or(false)
}
