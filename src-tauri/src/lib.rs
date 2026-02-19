// Tauri v2 模块化主文件
// 按照官方文档最佳实践组织代码

use std::fs;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager, Emitter,
};
use chrono;

#[macro_use]
mod logger;
use serde::Deserialize;
use tauri::Listener;



// 应用状态，用于保持托盘图标存活
pub struct AppState {
    pub tray_icon: Arc<Mutex<Option<TrayIcon>>>,
}

// ========== 模块化组织 ==========

/// 语音服务模块
mod voice_service {
    use super::*;
    use serde::{Deserialize, Serialize};
    use chrono::Utc;
    use base64::Engine;

    /// 腾讯云语音识别配置
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TencentASRConfig {
        pub secret_id: String,
        pub secret_key: String,
        pub region: String,
        pub app_id: String,
        pub engine_model_type: String,
        pub voice_id: String,
    }

    /// 腾讯云语音合成配置
    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct TencentTTSConfig {
        pub secret_id: String,
        pub secret_key: String,
        pub region: String,
        pub app_id: String,
        pub voice_type: Option<i32>,
        pub language: Option<i32>,
        pub speed: Option<f64>,
        pub volume: Option<f64>,
        pub pitch: Option<i32>,
    }

    /// ASR结果
    #[derive(Debug, Serialize, Deserialize)]
    pub struct ASRResult {
        pub success: bool,
        pub text: String,
        pub request_id: String,
        pub error_message: Option<String>,
    }

    /// TTS结果
    #[derive(Debug, Serialize, Deserialize)]
    pub struct TTSResult {
        pub success: bool,
        pub audio_data: Vec<u8>,
        pub content_type: String,
        pub request_id: String,
        pub error_message: Option<String>,
    }

    /// 腾讯云ASR语音识别
    pub async fn tencent_asr(config: TencentASRConfig, audio_data: Vec<u8>) -> Result<ASRResult, String> {
        app_info!("🎤 开始腾讯云ASR语音识别");

        // 检查音频数据大小
        if audio_data.is_empty() {
            return Ok(ASRResult {
                success: false,
                text: String::new(),
                request_id: uuid::Uuid::new_v4().to_string(),
                error_message: Some("音频数据为空".to_string()),
            });
        }

        // 构建请求参数
        let timestamp = Utc::now().timestamp() as u64;
        let mut header_map = reqwest::header::HeaderMap::new();
        header_map.insert("Content-Type", "application/json".parse().unwrap());
        header_map.insert("Host", "asr.tencentcloudapi.com".parse().unwrap());
        header_map.insert("X-TC-Action", "SentenceRecognition".parse().unwrap());
        header_map.insert("X-TC-Version", "2019-06-14".parse().unwrap());
        header_map.insert("X-TC-Region", config.region.parse().unwrap());
        header_map.insert("X-TC-Timestamp", timestamp.to_string().parse().unwrap());

        // 构建请求体
        let request_body = serde_json::json!({
            "ProjectId": 0,
            "SubServiceType": "sentence",
            "EngSerViceType": config.engine_model_type,
            "SourceType": 1,
            "VoiceFormat": "pcm",
            "UsrAudioKey": format!("voice_{}", timestamp),
            "Data": base64::engine::general_purpose::STANDARD.encode(&audio_data),
            "DataLen": audio_data.len()
        });

        let body_str = request_body.to_string();

        // 创建简化的Authorization头
        let auth_header = format!(
            "TC3-HMAC-SHA256 Credential={}/{}/asr/tc3_request, SignedHeaders=content-type;host, Signature=test_signature",
            config.secret_id,
            chrono::DateTime::from_timestamp(timestamp as i64, 0).unwrap().format("%Y-%m-%d")
        );

        header_map.insert("Authorization", auth_header.parse().unwrap());

        // 发送HTTP请求
        let client = reqwest::Client::new();
        let response = client
            .post("https://asr.tencentcloudapi.com/")
            .headers(header_map)
            .body(body_str)
            .send()
            .await
            .map_err(|e| format!("HTTP请求失败: {}", e))?;

        let response_text = response
            .text()
            .await
            .map_err(|e| format!("响应读取失败: {}", e))?;

        app_info!("🔍 ASR响应: {}", response_text);

        // 解析响应
        let response_json: serde_json::Value = serde_json::from_str(&response_text)
            .map_err(|e| format!("响应解析失败: {}", e))?;

        if let Some(error) = response_json.get("Response").and_then(|r| r.get("Error")) {
            let error_code = error.get("Code").and_then(|c| c.as_str()).unwrap_or("UNKNOWN");
            let error_message = error.get("Message").and_then(|m| m.as_str()).unwrap_or("未知错误");

            return Ok(ASRResult {
                success: false,
                text: String::new(),
                request_id: uuid::Uuid::new_v4().to_string(),
                error_message: Some(format!("ASR错误 [{}]: {}", error_code, error_message)),
            });
        }

        let text = response_json
            .get("Response")
            .and_then(|r| r.get("Result"))
            .and_then(|r| r.as_str())
            .unwrap_or("");

        Ok(ASRResult {
            success: true,
            text: text.to_string(),
            request_id: uuid::Uuid::new_v4().to_string(),
            error_message: None,
        })
    }

    /// 腾讯云TTS语音合成
    pub async fn tencent_tts(config: TencentTTSConfig, text: String) -> Result<TTSResult, String> {
        app_info!("🔊 开始腾讯云TTS语音合成: {}", text);

        let timestamp = Utc::now().timestamp() as u64;
        let mut header_map = reqwest::header::HeaderMap::new();
        header_map.insert("Content-Type", "application/json".parse().unwrap());
        header_map.insert("Host", "tts.tencentcloudapi.com".parse().unwrap());
        header_map.insert("X-TC-Action", "TextToStreamAudio".parse().unwrap());
        header_map.insert("X-TC-Version", "2019-07-23".parse().unwrap());
        header_map.insert("X-TC-Region", config.region.parse().unwrap());
        header_map.insert("X-TC-Timestamp", timestamp.to_string().parse().unwrap());

        // 构建请求体
        let request_body = serde_json::json!({
            "Text": base64::engine::general_purpose::STANDARD.encode(text.as_bytes()),
            "SessionId": uuid::Uuid::new_v4().to_string(),
            "ModelType": 1,
            "VoiceType": config.voice_type.unwrap_or(10010001), // 默认女声
            "Language": config.language.unwrap_or(1), // 中文
            "Speed": config.speed.unwrap_or(1.2),
            "Volume": config.volume.unwrap_or(5.0),
            "Pitch": config.pitch.unwrap_or(0)
        });

        let body_str = request_body.to_string();

        // 创建简化的Authorization头
        let auth_header = format!(
            "TC3-HMAC-SHA256 Credential={}/{}/tts/tc3_request, SignedHeaders=content-type;host, Signature=test_signature",
            config.secret_id,
            chrono::DateTime::from_timestamp(timestamp as i64, 0).unwrap().format("%Y-%m-%d")
        );

        header_map.insert("Authorization", auth_header.parse().unwrap());

        // 发送HTTP请求
        let client = reqwest::Client::new();
        let response = client
            .post("https://tts.tencentcloudapi.com/")
            .headers(header_map)
            .body(body_str)
            .send()
            .await
            .map_err(|e| format!("TTS HTTP请求失败: {}", e))?;

        let response_bytes = response
            .bytes()
            .await
            .map_err(|e| format!("TTS响应读取失败: {}", e))?;

        // 如果响应是JSON，说明是错误
        if let Ok(response_text) = String::from_utf8(response_bytes.to_vec()) {
            if response_text.starts_with('{') {
                if let Ok(response_json) = serde_json::from_str::<serde_json::Value>(&response_text) {
                    if let Some(error) = response_json.get("Response").and_then(|r| r.get("Error")) {
                        let error_code = error.get("Code").and_then(|c| c.as_str()).unwrap_or("UNKNOWN");
                        let error_message = error.get("Message").and_then(|m| m.as_str()).unwrap_or("未知错误");

                        return Ok(TTSResult {
                            success: false,
                            audio_data: Vec::new(),
                            content_type: "application/json".to_string(),
                            request_id: uuid::Uuid::new_v4().to_string(),
                            error_message: Some(format!("TTS错误 [{}]: {}", error_code, error_message)),
                        });
                    }
                }
            }
        }

        Ok(TTSResult {
            success: true,
            audio_data: response_bytes.to_vec(),
            content_type: "audio/octet-stream".to_string(),
            request_id: uuid::Uuid::new_v4().to_string(),
            error_message: None,
        })
    }
}

/// 窗口管理模块
mod window_manager {
    use super::*;

    /// 显示Live2D窗口
    pub async fn show_live2d_window<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
        if let Some(webview_window) = app.get_webview_window("live2d") {
            webview_window.show().map_err(|e| e.to_string())?;
            webview_window.set_focus().map_err(|e| e.to_string())?;
            app_info!("✅ Live2D窗口已显示");
        }
        Ok(())
    }

    /// 隐藏Live2D窗口
    pub async fn hide_live2d_window<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
        if let Some(webview_window) = app.get_webview_window("live2d") {
            webview_window.hide().map_err(|e| e.to_string())?;
            app_info!("✅ Live2D窗口已隐藏");
        }
        Ok(())
    }

    /// 定位Live2D窗口 - 使用当前窗口尺寸定位到屏幕右下角
    pub async fn position_live2d_window<R: tauri::Runtime>(
        app: AppHandle<R>,
    ) -> Result<(), String> {
        app_info!("🎯 开始定位Live2D窗口...");

        if let Some(window) = app.get_webview_window("live2d") {
            app_info!("✅ 找到Live2D窗口");

            // 🚫 隐藏窗口，避免显示中间位置
            window.hide().map_err(|e| e.to_string())?;

            // 等待窗口完全准备好
            std::thread::sleep(Duration::from_millis(300));

            // 📏 获取屏幕信息
            let monitor = window
                .current_monitor()
                .map_err(|e| e.to_string())?
                .ok_or("无法获取显示器信息")?;
            let screen_size = monitor.size();
            let scale_factor = monitor.scale_factor();

            // 📐 使用当前窗口实际尺寸（不再硬编码）
            let win_size = window.outer_size().map_err(|e| e.to_string())?;
            let physical_w = win_size.width;
            let physical_h = win_size.height;

            app_info!("📺 屏幕尺寸: {}x{}, 缩放: {}", screen_size.width, screen_size.height, scale_factor);
            app_info!("📐 当前窗口物理尺寸: {}x{}", physical_w, physical_h);

            // 📍 计算最终右下角位置（物理像素坐标系）
            let x = screen_size.width.saturating_sub(physical_w + 50);
            let y = screen_size.height.saturating_sub(physical_h + 50);

            app_info!("📍 计算最终位置: x={}, y={}", x, y);

            // 🎯 直接设置到最终位置
            window
                .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: x as i32,
                    y: y as i32,
                }))
                .map_err(|e| e.to_string())?;

            // 等待位置设置生效
            std::thread::sleep(Duration::from_millis(200));

            // ⚙️ 设置窗口属性
            window.set_always_on_top(true).map_err(|e| e.to_string())?;
            window.set_resizable(false).map_err(|e| e.to_string())?;
            window.set_decorations(false).map_err(|e| e.to_string())?;

            app_info!("✅ 窗口透明属性已设置完成");

            // ✅ 最后显示窗口在正确位置
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;

            app_info!(
                "✅ Live2D窗口已显示在最终位置: x={}, y={} (尺寸: {}x{})",
                x, y, physical_w, physical_h
            );
        } else {
            return Err("❌ 无法找到Live2D窗口".to_string());
        }
        Ok(())
    }
}

/// 事件发送模块
mod event_emitter {
    use super::*;
    use tauri::Emitter;

    /// 发送Live2D模型切换事件
    pub async fn emit_model_switch<R: tauri::Runtime>(
        app: AppHandle<R>,
        model_name: &str,
    ) -> Result<(), String> {
        app_info!("🔥 开始发送模型切换事件: {}", model_name);

        if let Some(webview_window) = app.get_webview_window("live2d") {
            app_info!("✅ 找到live2d窗口，准备发送事件");

            let payload = serde_json::json!({
                "model_name": model_name,
                "timestamp": chrono::Utc::now().to_rfc3339()
            });

            app_info!("📦 事件payload: {}", payload);

            // 发送到switch_live2d_model事件
            webview_window
                .emit("switch_live2d_model", &payload)
                .map_err(|e| format!("事件发送失败: {}", e))?;

            app_info!("✅ switch_live2d_model事件发送成功");

            // 同时发送到switch_persona事件以保持兼容性
            webview_window
                .emit(
                    "switch_persona",
                    &serde_json::json!({
                        "persona": model_name,
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    }),
                )
                .map_err(|e| format!("兼容事件发送失败: {}", e))?;

            app_info!("✅ switch_persona兼容事件发送成功");
        } else {
            return Err("找不到Live2D窗口".to_string());
        }
        Ok(())
    }

    /// 发送显示动画事件
    pub async fn emit_show_animation<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
        if let Some(webview_window) = app.get_webview_window("live2d") {
            webview_window
                .emit("show_animation", ())
                .map_err(|e| format!("显示动画事件发送失败: {}", e))?;
        }
        Ok(())
    }

    /// 发送隐藏动画事件
    pub async fn emit_hide_animation<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
        if let Some(webview_window) = app.get_webview_window("live2d") {
            webview_window
                .emit("hide_animation", ())
                .map_err(|e| format!("隐藏动画事件发送失败: {}", e))?;
        }
        Ok(())
    }
}

/// 窗口状态管理模块
mod window_state {

    #[derive(Clone)]
    pub struct WindowState {
        pub current_persona: String,
    }

    impl WindowState {
        pub fn new() -> Self {
            Self {
                current_persona: "HaruGreeter".to_string(),
            }
        }

        pub fn set_current_persona(&mut self, persona: String) {
            self.current_persona = persona;
        }
    }
}

/// 托盘菜单管理模块
mod tray_manager {
    use super::*;

    /// Live2D角色列表
    pub const LIVE2D_PERSONAS: &[(&str, &str, &str)] = &[
        ("HaruGreeter", "Haru Greeter", "👋"),
        ("Haru", "Haru", "🌸"),
        ("Kei", "Kei", "💼"),
        ("Chitose", "Chitose", "🌸"),
        ("Epsilon", "Epsilon", "🚀"),
        ("Hibiki", "Hibiki", "🎸"),
        ("Hiyori", "Hiyori", "🌺"),
        ("Izumi", "Izumi", "💎"),
        ("Mao", "Mao", "🔥"),
        ("Rice", "Rice", "🍚"),
        ("Shizuku", "Shizuku", "🍃"),
        ("Tsumiki", "Tsumiki", "🎀"),
    ];

    /// 重新构建托盘菜单以更新选中状态
    pub fn rebuild_tray_menu<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        menu_state: Arc<Mutex<window_state::WindowState>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        app_info!("🔄 重建托盘菜单...");

        // 创建新菜单
        let new_menu = create_tray_menu(app, menu_state.clone())?;

        // 更新托盘图标菜单
        if let Some(tray) = app.tray_by_id("main") {
            tray.set_menu(Some(new_menu))?;
            app_info!("✅ 托盘菜单更新成功");
        } else {
            app_info!("⚠️ 找不到托盘图标");
        }

        Ok(())
    }

    /// 创建托盘菜单
    pub fn create_tray_menu<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        menu_state: Arc<Mutex<window_state::WindowState>>,
    ) -> Result<tauri::menu::Menu<R>, Box<dyn std::error::Error>> {
        app_info!("🏗️ 开始创建托盘菜单...");

        // 获取当前状态
        let current_persona = {
            if let Ok(state) = menu_state.lock() {
                state.current_persona.clone()
            } else {
                "HaruGreeter".to_string()
            }
        };

        app_info!("📋 当前数字人: {}", current_persona);

        // 基础菜单项
        let show_live2d = MenuItem::with_id(app, "show_pet", "显示宠物", true, None::<&str>)?;
        let hide_live2d = MenuItem::with_id(app, "hide_pet", "隐藏宠物", true, None::<&str>)?;

        // 数字人子菜单
        let persona_submenu = Submenu::with_id(app, "persona_submenu", "切换数字人", true)?;

        // 添加Live2D角色
        for (id, name, emoji) in LIVE2D_PERSONAS {
            let display_name = if current_persona == *id {
                format!("{} {} ✓", emoji, name)
            } else {
                format!("{} {}", emoji, name)
            };

            let persona_item = MenuItem::with_id(
                app,
                id, // 直接使用角色名作为ID
                display_name,
                true,
                None::<&str>,
            )?;

            persona_submenu.append(&persona_item)?;
        }

        let quit_item = PredefinedMenuItem::quit(app, Some("退出应用"))?;

        let menu = MenuBuilder::new(app)
            .item(&show_live2d)
            .item(&hide_live2d)
            .separator()
            .item(&persona_submenu)
            .separator()
            .item(&quit_item)
            .build()?;

        app_info!("✅ 托盘菜单创建完成");
        Ok(menu)
    }

    /// 处理托盘菜单事件（主要用于Live2D角色切换）
    pub fn handle_tray_event<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        event_id: &tauri::menu::MenuId,
        menu_state: Arc<Mutex<window_state::WindowState>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        app_info!("🔔 托盘事件触发: {:?}", event_id);

        let event_str: &str = event_id.as_ref();

        // 检查是否为角色切换事件（直接匹配角色名称）
        let is_persona_event = LIVE2D_PERSONAS.iter().any(|(id, _, _)| *id == event_str);

        if is_persona_event {
            app_info!("🔄 触发模型切换: {}", event_str);

            if let Err(e) = tauri::async_runtime::block_on(async {
                event_emitter::emit_model_switch(app.clone(), event_str).await
            }) {
                app_error!("❌ 切换到{}失败: {}", event_str, e);
            } else {
                app_info!("✅ 切换到{}成功", event_str);
                if let Ok(mut state) = menu_state.lock() {
                    state.set_current_persona(event_str.to_string());
                    app_info!("✅ 状态已更新，当前选中: {}", event_str);
                }

                // 释放锁后再重建托盘菜单（避免死锁）
                if let Err(e) = rebuild_tray_menu::<R>(app, menu_state.clone()) {
                    app_error!("⚠️ 重建托盘菜单失败: {}", e);
                } else {
                    app_info!("✅ 托盘菜单已更新选中标记");
                }
            }
        } else {
            app_info!("⚠️ 未知事件: {:?}", event_id);
        }

        Ok(())
    }
}

// ========== Tauri命令定义 ==========

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}



// Screen edge detection module
mod screen_edge_detection {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ScreenBounds {
        pub x: i32,
        pub y: i32,
        pub width: u32,
        pub height: u32,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct WindowBounds {
        pub x: i32,
        pub y: i32,
        pub width: u32,
        pub height: u32,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct DragConstraints {
        pub min_x: i32,
        pub min_y: i32,
        pub max_x: i32,
        pub max_y: i32,
        pub screen_bounds: ScreenBounds,
    }

    #[derive(Debug, Clone, Serialize, Deserialize)]
    pub struct ConstrainedPosition {
        pub x: i32,
        pub y: i32,
        pub is_constrained: bool,
        pub constraint_edge: Option<String>, // "left", "right", "top", "bottom"
    }

    /// 获取当前窗口所在的屏幕边界信息
    pub fn get_screen_bounds<R: tauri::Runtime>(
        app: &AppHandle<R>,
    ) -> Result<ScreenBounds, String> {
        if let Some(window) = app.get_webview_window("live2d") {
            let monitor = window
                .current_monitor()
                .map_err(|e| format!("获取显示器失败: {}", e))?
                .ok_or("无法获取当前显示器信息")?;

            let position = monitor.position();
            let size = monitor.size();

            Ok(ScreenBounds {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            })
        } else {
            Err("无法找到Live2D窗口".to_string())
        }
    }

    /// 获取窗口当前边界信息
    pub fn get_window_bounds<R: tauri::Runtime>(
        app: &AppHandle<R>,
    ) -> Result<WindowBounds, String> {
        if let Some(window) = app.get_webview_window("live2d") {
            let position = window
                .outer_position()
                .map_err(|e| format!("获取窗口位置失败: {}", e))?;
            let size = window
                .inner_size()
                .map_err(|e| format!("获取窗口尺寸失败: {}", e))?;

            Ok(WindowBounds {
                x: position.x,
                y: position.y,
                width: size.width,
                height: size.height,
            })
        } else {
            Err("无法找到Live2D窗口".to_string())
        }
    }

    /// 计算窗口拖拽的安全边界
    pub fn calculate_drag_constraints(
        screen_bounds: &ScreenBounds,
        window_bounds: &WindowBounds,
        margin: i32, // 边缘缓冲距离
    ) -> DragConstraints {
        let min_x = screen_bounds.x + margin;
        let min_y = screen_bounds.y + margin;
        let max_x = screen_bounds.x + screen_bounds.width as i32 - window_bounds.width as i32 - margin;
        let max_y = screen_bounds.y + screen_bounds.height as i32 - window_bounds.height as i32 - margin;

        DragConstraints {
            min_x,
            min_y,
            max_x,
            max_y,
            screen_bounds: screen_bounds.clone(),
        }
    }

    /// 约束位置到安全区域内
    pub fn constrain_position(
        x: i32,
        y: i32,
        constraints: &DragConstraints,
    ) -> ConstrainedPosition {
        let mut constrained_x = x;
        let mut constrained_y = y;
        let mut constraint_edge = None;
        let mut is_constrained = false;

        // 约束X坐标
        if x < constraints.min_x {
            constrained_x = constraints.min_x;
            constraint_edge = Some("left".to_string());
            is_constrained = true;
        } else if x > constraints.max_x {
            constrained_x = constraints.max_x;
            constraint_edge = Some("right".to_string());
            is_constrained = true;
        }

        // 约束Y坐标
        if y < constraints.min_y {
            constrained_y = constraints.min_y;
            if constraint_edge.is_none() {
                constraint_edge = Some("top".to_string());
            } else {
                // 角落情况
                constraint_edge = Some(format!("{}-top", constraint_edge.unwrap()));
            }
            is_constrained = true;
        } else if y > constraints.max_y {
            constrained_y = constraints.max_y;
            if constraint_edge.is_none() {
                constraint_edge = Some("bottom".to_string());
            } else {
                // 角落情况
                constraint_edge = Some(format!("{}-bottom", constraint_edge.unwrap()));
            }
            is_constrained = true;
        }

        ConstrainedPosition {
            x: constrained_x,
            y: constrained_y,
            is_constrained,
            constraint_edge,
        }
    }

    /// 预测移动后是否会超出边界
    pub fn predict_boundary_collision(
        current_x: i32,
        current_y: i32,
        delta_x: i32,
        delta_y: i32,
        constraints: &DragConstraints,
    ) -> (bool, Option<String>) {
        let future_x = current_x + delta_x;
        let future_y = current_y + delta_y;

        let will_collide_x = future_x < constraints.min_x || future_x > constraints.max_x;
        let will_collide_y = future_y < constraints.min_y || future_y > constraints.max_y;

        if will_collide_x && will_collide_y {
            (true, Some("corner".to_string()))
        } else if will_collide_x {
            let edge = if future_x < constraints.min_x { "left" } else { "right" };
            (true, Some(edge.to_string()))
        } else if will_collide_y {
            let edge = if future_y < constraints.min_y { "top" } else { "bottom" };
            (true, Some(edge.to_string()))
        } else {
            (false, None)
        }
    }
}

// 导出屏幕边缘检测相关的Tauri命令

#[tauri::command]
async fn get_screen_bounds(app: AppHandle) -> Result<screen_edge_detection::ScreenBounds, String> {
    screen_edge_detection::get_screen_bounds(&app)
}

#[tauri::command]
async fn get_window_bounds(app: AppHandle) -> Result<screen_edge_detection::WindowBounds, String> {
    screen_edge_detection::get_window_bounds(&app)
}

#[tauri::command]
async fn calculate_drag_constraints(
    app: AppHandle,
    margin: Option<i32>,
) -> Result<screen_edge_detection::DragConstraints, String> {
    let screen_bounds = screen_edge_detection::get_screen_bounds(&app)?;
    let window_bounds = screen_edge_detection::get_window_bounds(&app)?;
    let margin = margin.unwrap_or(10); // 默认10像素边距
    Ok(screen_edge_detection::calculate_drag_constraints(
        &screen_bounds,
        &window_bounds,
        margin,
    ))
}

#[tauri::command]
async fn constrain_window_position(
    app: AppHandle,
    x: i32,
    y: i32,
    margin: Option<i32>,
) -> Result<screen_edge_detection::ConstrainedPosition, String> {
    let screen_bounds = screen_edge_detection::get_screen_bounds(&app)?;
    let window_bounds = screen_edge_detection::get_window_bounds(&app)?;
    let margin = margin.unwrap_or(10);
    let constraints = screen_edge_detection::calculate_drag_constraints(
        &screen_bounds,
        &window_bounds,
        margin,
    );
    Ok(screen_edge_detection::constrain_position(x, y, &constraints))
}

#[tauri::command]
async fn predict_boundary_collision(
    app: AppHandle,
    delta_x: i32,
    delta_y: i32,
    margin: Option<i32>,
) -> Result<(bool, Option<String>), String> {
    let screen_bounds = screen_edge_detection::get_screen_bounds(&app)?;
    let window_bounds = screen_edge_detection::get_window_bounds(&app)?;
    let margin = margin.unwrap_or(10);
    let constraints = screen_edge_detection::calculate_drag_constraints(
        &screen_bounds,
        &window_bounds,
        margin,
    );
    Ok(screen_edge_detection::predict_boundary_collision(
        window_bounds.x,
        window_bounds.y,
        delta_x,
        delta_y,
        &constraints,
    ))
}

#[tauri::command]
async fn set_constrained_window_position(
    app: AppHandle,
    x: i32,
    y: i32,
    margin: Option<i32>,
) -> Result<screen_edge_detection::ConstrainedPosition, String> {
    let app_clone = app.clone();
    let constrained_pos = constrain_window_position(app_clone, x, y, margin).await?;

    // 应用约束后的位置到窗口
    if let Some(window) = app.get_webview_window("live2d") {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: constrained_pos.x,
                y: constrained_pos.y,
            }))
            .map_err(|e| format!("设置窗口位置失败: {}", e))?;
    }

    Ok(constrained_pos)
}

#[tauri::command]
async fn trigger_show_animation(app: AppHandle) -> Result<(), String> {
    event_emitter::emit_show_animation(app).await
}

#[tauri::command]
async fn switch_persona(app: AppHandle, persona: String) -> Result<(), String> {
    // 使用新的模块化事件发送
    event_emitter::emit_model_switch(app, &persona).await
}

#[tauri::command]
async fn show_live2d_window(app: AppHandle) -> Result<(), String> {
    window_manager::show_live2d_window(app).await
}

#[tauri::command]
async fn show_live2d_window_with_animation(app: AppHandle) -> Result<(), String> {
    if let Err(e) = trigger_show_animation(app.clone()).await {
        app_error!("触发显示动画失败: {}", e);
    }

    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        if let Err(e) = tauri::async_runtime::block_on(async {
            window_manager::show_live2d_window(app_clone).await
        }) {
            app_error!("显示窗口失败: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
async fn hide_live2d_window(app: AppHandle) -> Result<(), String> {
    window_manager::hide_live2d_window(app).await
}

#[tauri::command]
async fn switch_live2d_model(app: AppHandle, model_name: String) -> Result<(), String> {
    event_emitter::emit_model_switch(app, &model_name).await
}

#[tauri::command]
async fn is_live2d_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("live2d") {
        window.is_visible().map_err(|e| e.to_string())
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn trigger_hide_animation(app: AppHandle) -> Result<(), String> {
    event_emitter::emit_hide_animation(app).await
}

#[tauri::command]
async fn position_live2d_window(app: AppHandle) -> Result<(), String> {
    window_manager::position_live2d_window(app).await
}

#[tauri::command]
async fn resize_live2d_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        window
            .set_size(tauri::Size::Logical(tauri::LogicalSize {
                width,
                height,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn get_window_position(app: AppHandle) -> Result<(f64, f64), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        Ok(window
            .outer_position()
            .map_err(|e| e.to_string())
            .map(|pos| (pos.x as f64, pos.y as f64))?)
    } else {
        Err("窗口不存在".to_string())
    }
}

#[tauri::command]
async fn set_window_position(app: AppHandle, x: f64, y: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        window
            .set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                x: x as i32,
                y: y as i32,
            }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn start_mouse_tracking(app: AppHandle) -> Result<(), String> {
    use tauri::Emitter;

    app_info!("🖱️ 开始全局鼠标跟踪");

    // 获取 live2d 窗口
    let window = match app.get_webview_window("live2d") {
        Some(w) => w,
        None => {
            app_info!("❌ 找不到 live2d 窗口");
            return Err("找不到 live2d 窗口".to_string());
        }
    };

    // 启动一个后台线程持续获取鼠标位置
    tauri::async_runtime::spawn(async move {
        loop {
            // 每 16ms (约 60fps) 获取一次鼠标位置
            tokio::time::sleep(tokio::time::Duration::from_millis(16)).await;

            // 使用 window.cursor_position() 获取相对于窗口的鼠标位置
            if let Ok(position) = window.cursor_position() {
                // 发送鼠标位置事件到前端
                let payload = serde_json::json!({
                    "x": position.x,
                    "y": position.y
                });
                let _ = window.emit("mouse_position", payload);
            }
        }
    });

    app_info!("✅ 全局鼠标跟踪已启动");
    Ok(())
}

#[tauri::command]
async fn start_manual_drag(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        window.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn end_manual_drag() -> Result<(), String> {
    // 拖拽由操作系统管理，鼠标释放时自动结束
    Ok(())
}

#[tauri::command]
async fn exit_app(app: AppHandle) -> Result<(), String> {
    app_info!("🚪 收到退出应用请求");
    app.exit(0);
    Ok(())
}

#[tauri::command]
async fn start_window_drag(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        window.start_dragging().map_err(|e| e.to_string())?;
    }
    Ok(())
}

// set_window_opacity 函数已移除，因为Tauri v2中没有相应的权限
// #[tauri::command]
// async fn set_window_opacity(app: AppHandle, _opacity: f64) -> Result<(), String> {
//     if let Some(window) = app.get_webview_window("live2d") {
//         window.set_decorations(false).map_err(|e| e.to_string())?;
//         // 注意：透明度设置可能需要特殊处理
//     }
//     Ok(())
// }

#[tauri::command]
async fn toggle_always_on_top(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("live2d") {
        let always_on_top = window.is_always_on_top().map_err(|e| e.to_string())?;
        window
            .set_always_on_top(!always_on_top)
            .map_err(|e| e.to_string())?;
        app_info!("窗口置顶状态切换为: {}", !always_on_top);
        Ok(!always_on_top)
    } else {
        Err("窗口不存在".to_string())
    }
}

#[tauri::command]
async fn reset_window_position(app: AppHandle) -> Result<(), String> {
    window_manager::position_live2d_window(app).await
}

/// 设置Live2D窗口为完全透明
#[tauri::command]
async fn set_window_transparent(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        app_info!("🔍 设置Live2D窗口为完全透明...");

        // 确保所有透明属性都正确设置
        window.set_decorations(false).map_err(|e| e.to_string())?;

        #[cfg(target_os = "macos")]
        {
            window.set_focusable(false).map_err(|e| e.to_string())?;
            window.set_content_protected(false).map_err(|e| e.to_string())?;
        }

        app_info!("✅ Live2D窗口透明属性已设置完成");

        // 发送透明化完成事件到前端
        let payload = serde_json::json!({
            "type": "window_transparent",
            "timestamp": chrono::Utc::now().timestamp()
        });

        window.emit("window_transparent", &payload)
            .map_err(|e| format!("发送透明化事件失败: {}", e))?;
    }
    Ok(())
}

/// 重新应用透明化设置（用于修复可能的覆盖）
#[tauri::command]
async fn reapply_transparency(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        app_info!("🔄 重新应用透明化设置...");

        // 重新设置所有透明属性
        window.set_decorations(false).map_err(|e| e.to_string())?;

        #[cfg(target_os = "macos")]
        {
            window.set_focusable(false).map_err(|e| e.to_string())?;
            window.set_content_protected(false).map_err(|e| e.to_string())?;
        }

        // 强制窗口重绘（逻辑像素）
        window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: 350.0,
            height: 500.0,
        })).map_err(|e| e.to_string())?;

        std::thread::sleep(Duration::from_millis(100));

        app_info!("✅ 透明化设置已重新应用");
    }
    Ok(())
}

#[tauri::command]
async fn debug_right_click_menu(model_name: String) -> Result<(), String> {
    app_info!("🖱️ 右键菜单被触发! 切换到模型: {}", model_name);
    Ok(())
}

// ========== 主应用入口 ==========

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            greet,
            trigger_show_animation,
            switch_persona,
            show_live2d_window,
            show_live2d_window_with_animation,
            hide_live2d_window,
            switch_live2d_model,
            is_live2d_visible,
            trigger_hide_animation,
            position_live2d_window,
            resize_live2d_window,
            get_window_position,
            set_window_position,
            start_mouse_tracking,
            start_manual_drag,
            end_manual_drag,
            exit_app,
            start_window_drag,
            toggle_always_on_top,
            reset_window_position,
            debug_right_click_menu,
            // 透明度控制命令
            set_window_transparent,
            reapply_transparency,
            // 新增的屏幕边缘检测命令
            get_screen_bounds,
            get_window_bounds,
            calculate_drag_constraints,
            constrain_window_position,
            predict_boundary_collision,
            set_constrained_window_position,
              // Live2D语音交互命令
            trigger_live2d_expression,
            trigger_live2d_lip_sync,
            trigger_live2d_motion,
            // 资源读取命令
            read_resource_file,
            read_binary_resource_file,
            // 语音交互命令
            tencent_asr,
            tencent_tts,
            recognize_audio_official,
            synthesize_voice_official,
            test_voice_recognition,
            test_voice_synthesis,
        ])
        .setup(|app| {
            app_info!("🚀 Tauri应用启动");
            app_debug!(
                "日志系统状态: verbose={}",
                crate::logger::is_verbose_logging()
            );
            app_trace!("日志系统已完成初始化");

            app.listen("frontend_log", |event: tauri::Event| {
                #[derive(Deserialize)]
                struct FrontendLog {
                    timestamp: String,
                    level: String,
                    scope: String,
                    message: String,
                    data: Option<serde_json::Value>,
                }

                let payload = event.payload();
                if let Ok(log) = serde_json::from_str::<FrontendLog>(payload) {
                    app_info!(
                        "[frontend] [{}] [{}] [{}] {} {}",
                        log.timestamp,
                        log.level.to_uppercase(),
                        log.scope,
                        log.message,
                        log.data
                            .as_ref()
                            .map(|value| value.to_string())
                            .unwrap_or_default()
                    );
                } else {
                    app_warn!("[frontend] failed to parse log payload: {}", payload);
                }
            });

    
            // 创建应用状态
            let app_state = AppState {
                tray_icon: Arc::new(Mutex::new(None)),
            };

            // 创建共享状态
            let menu_state = Arc::new(Mutex::new(window_state::WindowState::new()));

            // 初始化窗口
            if let Err(e) = initialize_windows(&app.handle(), &menu_state) {
                app_error!("❌ 窗口初始化失败: {}", e);
            }

            // 设置托盘并保存到状态中
            match setup_tray(&app.handle(), menu_state) {
                Ok(tray) => {
                    if let Ok(mut tray_state) = app_state.tray_icon.lock() {
                        *tray_state = Some(tray);
                        app_info!("✅ 托盘图标已保存到应用状态");
                    }
                }
                Err(e) => {
                    app_error!("❌ 托盘设置失败: {}", e);
                }
            }

            // 将应用状态添加到Tauri应用中
            app.manage(app_state);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// 初始化窗口
fn initialize_windows(
    app: &AppHandle,
    _menu_state: &Arc<Mutex<window_state::WindowState>>,
) -> Result<(), Box<dyn std::error::Error>> {
    app_info!("🏠 初始化窗口...");

    // 延迟显示和定位窗口
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(1));

        if let Err(e) = tauri::async_runtime::block_on(async {
            window_manager::position_live2d_window(app_clone.clone()).await
        }) {
            app_error!("窗口定位失败: {}", e);
        }
    });

    Ok(())
}

/// 设置托盘
fn setup_tray(
    app: &AppHandle,
    menu_state: Arc<Mutex<window_state::WindowState>>,
) -> Result<TrayIcon, Box<dyn std::error::Error>> {
    app_info!("🎯 设置系统托盘...");

    // 创建菜单
    let menu = tray_manager::create_tray_menu(app, menu_state.clone())?;

    // 创建托盘图标 - 使用内置图标或生成一个简单的图标
    let tray_menu_state = menu_state.clone();

    // 尝试创建一个简单的图标
    let icon_data = create_tray_icon_data()?;

    let tray = TrayIconBuilder::with_id("main") // 设置托盘图标ID，用于后续更新菜单
        .menu(&menu)
        .icon(icon_data)
        .show_menu_on_left_click(true)
        .tooltip("Live2D Assistant")
        .on_menu_event(move |app, event| {
            app_info!("🎯 托盘菜单事件: {:?}", event.id);
            match event.id.as_ref() {
                "show_pet" => {
                    app_info!("📺 显示宠物请求");
                    if let Err(e) = tauri::async_runtime::block_on(async {
                        window_manager::show_live2d_window(app.clone()).await
                    }) {
                        app_error!("❌ 显示宠物失败: {}", e);
                    }
                }
                "hide_pet" => {
                    app_info!("📺 隐藏宠物请求");
                    if let Err(e) = tauri::async_runtime::block_on(async {
                        window_manager::hide_live2d_window(app.clone()).await
                    }) {
                        app_error!("❌ 隐藏宠物失败: {}", e);
                    }
                }
                _ => {
                    // 处理角色切换事件
                    if let Err(e) =
                        tray_manager::handle_tray_event(app, &event.id, tray_menu_state.clone())
                    {
                        app_error!("托盘事件处理失败: {}", e);
                    }
                }
            }
        })
        .build(app)?;

    app_info!("✅ 系统托盘设置完成");
    Ok(tray)
}

/// 创建托盘图标数据
fn create_tray_icon_data() -> Result<Image<'static>, Box<dyn std::error::Error>> {
    app_info!("🔍 开始加载托盘图标...");

    // 1. 首先尝试从文件系统加载（开发环境）
    let possible_paths = vec![
        "icons/tray_white_32.png",
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/icon.png",
    ];

    for icon_path in possible_paths {
        app_info!("🔍 尝试加载托盘图标: {}", icon_path);

        match fs::read(&icon_path) {
            Ok(icon_data) => {
                app_info!("✅ 成功读取文件: {}, 大小: {} bytes", icon_path, icon_data.len());

                // 尝试解码图片
                match image::load_from_memory(&icon_data) {
                    Ok(img) => {
                        // 转换为RGBA格式
                        let rgba_img = img.to_rgba8();
                        let (width, height) = rgba_img.dimensions();
                        let rgba = rgba_img.into_raw();

                        app_info!("✅ 成功加载托盘图标: {}x{} 像素 (路径: {})", width, height, icon_path);
                        return Ok(Image::new_owned(rgba, width, height));
                    }
                    Err(e) => {
                        app_error!("❌ 图片解码失败: {} (路径: {}), 尝试下一个路径", e, icon_path);
                        continue;
                    }
                }
            }
            Err(e) => {
                app_error!("❌ 无法读取托盘图标文件: {} (路径: {}), 尝试下一个路径", e, icon_path);
                continue;
            }
        }
    }

    // 3. 如果文件系统加载失败，尝试使用嵌入的图标
    app_info!("⚠️ 文件系统加载失败，尝试使用嵌入的图标");
    if let Ok(icon_data) = get_embedded_icon() {
        app_info!("✅ 使用嵌入的托盘图标");
        return Ok(icon_data);
    }

    // 4. 如果所有方法都失败，使用内置的备用图标
    app_error!("❌ 所有托盘图标路径都失败，使用内置备用图标");
    create_fallback_tray_icon()
}

/// 获取嵌入的图标数据
fn get_embedded_icon() -> Result<Image<'static>, Box<dyn std::error::Error>> {
    // 尝试嵌入托盘图标文件
    let icon_paths: &[(&str, &[u8])] = &[
        ("icons/tray_white_32.png", include_bytes!("../icons/tray_white_32.png")),
        ("icons/32x32.png", include_bytes!("../icons/32x32.png")),
        ("icons/128x128.png", include_bytes!("../icons/128x128.png")),
        ("icons/icon.png", include_bytes!("../icons/icon.png")),
    ];

    for (path, data) in icon_paths.iter() {
        if data.len() > 0 {
            app_info!("✅ 使用嵌入的托盘图标: {}", path);

            // 尝试解码图片
            match image::load_from_memory(data) {
                Ok(img) => {
                    let rgba_img = img.to_rgba8();
                    let (width, height) = rgba_img.dimensions();
                    let rgba = rgba_img.into_raw();
                    return Ok(Image::new_owned(rgba, width, height));
                }
                Err(e) => {
                    app_error!("❌ 嵌入图标解码失败: {} (路径: {}), 尝试下一个", e, path);
                    continue;
                }
            }
        }
    }

    // 如果所有嵌入图标都失败，使用代码生成的备用图标
    app_info!("⚠️ 所有嵌入图标都失败，使用代码生成的备用图标");
    Err(From::from("无法加载嵌入图标"))
}

/// 创建备用托盘图标（简单的白色圆形）
fn create_fallback_tray_icon() -> Result<Image<'static>, Box<dyn std::error::Error>> {
    // 创建一个简单的16x16 RGBA图标
    let rgba = vec![
        // 简单的圆形图标数据 (半透明黑色背景，白色前景)
        0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255,
        255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255, 255, 255, 255, 255, 0,
        0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0,
        180, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255,
        255, 255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255, 255, 255, 255,
        255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 180, 0,
        0, 0, 180, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255,
        255, 255, 255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255, 255, 255,
        255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 180,
        0, 0, 0, 180, 255, 255, 255, 255, 255, 255, 255, 255, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0,
        180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0,
        0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180, 0, 0, 0, 180,
    ];

    app_info!("✅ 使用备用托盘图标");
    Ok(Image::new_owned(rgba, 16, 16))
}

// ========== Live2D语音交互命令 ==========

#[tauri::command]
async fn trigger_live2d_expression(app: AppHandle, expression: String) -> Result<(), String> {
    app_info!("🎭 触发Live2D表情: {}", expression);

    // 发送表情事件到Live2D窗口
    if let Some(window) = app.get_webview_window("live2d") {
        let payload = serde_json::json!({
            "type": "expression",
            "expression": expression,
            "timestamp": chrono::Utc::now().timestamp()
        });

        window.emit("live2d_expression", &payload)
            .map_err(|e| format!("发送表情事件失败: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn trigger_live2d_lip_sync(app: AppHandle, text: String, lip_sync_data: serde_json::Value) -> Result<(), String> {
    app_info!("🗣️ 触发Live2D口型同步: {}", text);

    // 发送口型同步数据到Live2D窗口
    if let Some(window) = app.get_webview_window("live2d") {
        let payload = serde_json::json!({
            "type": "lip_sync",
            "text": text,
            "data": lip_sync_data,
            "timestamp": chrono::Utc::now().timestamp()
        });

        window.emit("live2d_lip_sync", &payload)
            .map_err(|e| format!("发送口型同步事件失败: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
async fn trigger_live2d_motion(app: AppHandle, motion: String) -> Result<(), String> {
    app_info!("🎬 触发Live2D动作: {}", motion);

    // 发送动作事件到Live2D窗口
    if let Some(window) = app.get_webview_window("live2d") {
        let payload = serde_json::json!({
            "type": "motion",
            "motion": motion,
            "timestamp": chrono::Utc::now().timestamp()
        });

        window.emit("live2d_motion", &payload)
            .map_err(|e| format!("发送动作事件失败: {}", e))?;
    }

    Ok(())
}

/// 读取文本资源文件
#[tauri::command]
async fn read_resource_file(path: String) -> Result<String, String> {
    app_info!("📁 读取资源文件: {}", path);

    // 构建实际的文件路径
    let resource_path = if cfg!(debug_assertions) {
        // 开发环境
        format!("../dist/{}", path)
    } else {
        // 生产环境：尝试不同的路径
        let possible_paths = vec![
            format!("_up_/dist/{}", path),
            format!("Resources/_up_/dist/{}", path),
            format!("dist/{}", path),
        ];

        for p in &possible_paths {
            if std::path::Path::new(&p).exists() {
                app_info!("✅ 找到资源文件: {}", p);
                return Ok(std::fs::read_to_string(&p)
                    .map_err(|e| format!("读取文件失败: {}", e))?);
            }
        }

        return Err(format!("找不到资源文件: {} (尝试的路径: {:?})", path, possible_paths));
    };

    std::fs::read_to_string(&resource_path)
        .map_err(|e| format!("读取文件失败: {}", e))
}

/// 读取二进制资源文件
#[tauri::command]
async fn read_binary_resource_file(path: String) -> Result<Vec<u8>, String> {
    app_info!("📁 读取二进制资源文件: {}", path);

    // 构建实际的文件路径
    let resource_path = if cfg!(debug_assertions) {
        // 开发环境
        format!("../dist/{}", path)
    } else {
        // 生产环境：尝试不同的路径
        let possible_paths = vec![
            format!("_up_/dist/{}", path),
            format!("Resources/_up_/dist/{}", path),
            format!("dist/{}", path),
        ];

        for p in &possible_paths {
            if std::path::Path::new(&p).exists() {
                app_info!("✅ 找到二进制资源文件: {}", p);
                return Ok(std::fs::read(&p)
                    .map_err(|e| format!("读取二进制文件失败: {}", e))?);
            }
        }

        return Err(format!("找不到二进制资源文件: {} (尝试的路径: {:?})", path, possible_paths));
    };

    std::fs::read(&resource_path)
        .map_err(|e| format!("读取二进制文件失败: {}", e))
}

// ========== 语音交互命令 ==========

/// 腾讯云语音识别命令
#[tauri::command]
async fn tencent_asr(config: voice_service::TencentASRConfig, audio_data: Vec<u8>) -> Result<voice_service::ASRResult, String> {
    voice_service::tencent_asr(config, audio_data).await
}

/// 腾讯云语音合成命令
#[tauri::command]
async fn tencent_tts(config: voice_service::TencentTTSConfig, text: String) -> Result<voice_service::TTSResult, String> {
    voice_service::tencent_tts(config, text).await
}

/// 通用音频识别命令
#[tauri::command]
async fn recognize_audio_official(
    config: voice_service::TencentASRConfig,
    audio_data: Vec<u8>
) -> Result<voice_service::ASRResult, String> {
    app_info!("🔍 通用音频识别 - 使用腾讯云ASR");
    voice_service::tencent_asr(config, audio_data).await
}

/// 通用语音合成命令
#[tauri::command]
async fn synthesize_voice_official(
    config: voice_service::TencentTTSConfig,
    text: String
) -> Result<voice_service::TTSResult, String> {
    app_info!("🔊 通用语音合成 - 使用腾讯云TTS");
    voice_service::tencent_tts(config, text).await
}

/// 测试语音识别命令
#[tauri::command]
async fn test_voice_recognition() -> Result<String, String> {
    app_info!("🧪 测试语音识别功能");

    // 这里可以添加简单的测试逻辑
    Ok("语音识别测试完成".to_string())
}

/// 测试语音合成命令
#[tauri::command]
async fn test_voice_synthesis(text: String) -> Result<String, String> {
    app_info!("🧪 测试语音合成功能: {}", text);

    // 这里可以添加简单的测试逻辑
    Ok(format!("语音合成测试完成: {}", text))
}
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
