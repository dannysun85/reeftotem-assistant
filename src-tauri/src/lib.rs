// Tauri v2 模块化主文件
// 按照官方文档最佳实践组织代码

use std::fs;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIcon, TrayIconBuilder},
    AppHandle, Manager,
};

// 应用状态，用于保持托盘图标存活
pub struct AppState {
    pub tray_icon: Arc<Mutex<Option<TrayIcon>>>,
}

// ========== 模块化组织 ==========

/// 窗口管理模块
mod window_manager {
    use super::*;

    /// 显示Live2D窗口
    pub async fn show_live2d_window<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
        if let Some(webview_window) = app.get_webview_window("live2d") {
            webview_window.show().map_err(|e| e.to_string())?;
            webview_window.set_focus().map_err(|e| e.to_string())?;
            println!("✅ Live2D窗口已显示");
        }
        Ok(())
    }

    /// 隐藏Live2D窗口
    pub async fn hide_live2d_window<R: tauri::Runtime>(app: AppHandle<R>) -> Result<(), String> {
        if let Some(webview_window) = app.get_webview_window("live2d") {
            webview_window.hide().map_err(|e| e.to_string())?;
            println!("✅ Live2D窗口已隐藏");
        }
        Ok(())
    }

    /// 定位Live2D窗口 - 修复版本：先计算最终位置再显示
    pub async fn position_live2d_window<R: tauri::Runtime>(
        app: AppHandle<R>,
    ) -> Result<(), String> {
        println!("🎯 开始定位Live2D窗口...");

        if let Some(window) = app.get_webview_window("live2d") {
            println!("✅ 找到Live2D窗口");

            // 🚫 隐藏窗口，避免显示中间位置
            window.hide().map_err(|e| e.to_string())?;
            println!("🙈 窗口已隐藏，准备计算最终位置");

            // 等待窗口完全准备好
            std::thread::sleep(Duration::from_millis(300));

            // 📏 获取屏幕信息
            let monitor = window
                .current_monitor()
                .map_err(|e| e.to_string())?
                .ok_or("无法获取显示器信息")?;
            let screen_size = monitor.size();

            // 📐 设置更大的窗口尺寸 (800x1000 - 扩大一倍)
            let target_width = 800;
            let target_height = 1000;

            println!("📺 屏幕尺寸: {}x{}", screen_size.width, screen_size.height);
            println!("📐 目标窗口尺寸: {}x{}", target_width, target_height);

            // 🔧 先设置窗口尺寸
            window
                .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                    width: target_width,
                    height: target_height,
                }))
                .map_err(|e| e.to_string())?;

            // 等待尺寸设置生效
            std::thread::sleep(Duration::from_millis(200));

            // 📍 计算最终右下角位置
            let x = screen_size.width - target_width - 50;
            let y = screen_size.height - target_height - 50;

            println!("📍 计算最终位置: x={}, y={}", x, y);

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

            // ✅ 最后显示窗口在正确位置
            window.show().map_err(|e| e.to_string())?;
            window.set_focus().map_err(|e| e.to_string())?;

            println!(
                "✅ Live2D窗口已显示在最终位置: x={}, y={} (尺寸: {}x{})",
                x, y, target_width, target_height
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
        println!("🔥 开始发送模型切换事件: {}", model_name);

        if let Some(webview_window) = app.get_webview_window("live2d") {
            println!("✅ 找到live2d窗口，准备发送事件");

            let payload = serde_json::json!({
                "model_name": model_name,
                "timestamp": chrono::Utc::now().to_rfc3339()
            });

            println!("📦 事件payload: {}", payload);

            // 发送到switch_live2d_model事件
            webview_window
                .emit("switch_live2d_model", &payload)
                .map_err(|e| format!("事件发送失败: {}", e))?;

            println!("✅ switch_live2d_model事件发送成功");

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

            println!("✅ switch_persona兼容事件发送成功");
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
        pub is_pet_visible: bool,
        pub current_persona: String,
    }

    impl WindowState {
        pub fn new() -> Self {
            Self {
                is_pet_visible: false,
                current_persona: "HaruGreeter".to_string(),
            }
        }

        pub fn set_pet_visibility(&mut self, visible: bool) {
            self.is_pet_visible = visible;
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
        println!("🔄 重建托盘菜单...");

        // 创建新菜单
        let new_menu = create_tray_menu(app, menu_state.clone())?;

        // 更新托盘图标菜单
        if let Some(tray) = app.tray_by_id("main") {
            tray.set_menu(Some(new_menu))?;
            println!("✅ 托盘菜单更新成功");
        } else {
            println!("⚠️ 找不到托盘图标");
        }

        Ok(())
    }

    /// 创建托盘菜单
    pub fn create_tray_menu<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        menu_state: Arc<Mutex<window_state::WindowState>>,
    ) -> Result<tauri::menu::Menu<R>, Box<dyn std::error::Error>> {
        println!("🏗️ 开始创建托盘菜单...");

        // 获取当前状态
        let current_persona = {
            if let Ok(state) = menu_state.lock() {
                state.current_persona.clone()
            } else {
                "HaruGreeter".to_string()
            }
        };

        println!("📋 当前数字人: {}", current_persona);

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

        println!("✅ 托盘菜单创建完成");
        Ok(menu)
    }

    /// 处理托盘菜单事件（主要用于Live2D角色切换）
    pub fn handle_tray_event<R: tauri::Runtime>(
        app: &tauri::AppHandle<R>,
        event_id: &tauri::menu::MenuId,
        menu_state: Arc<Mutex<window_state::WindowState>>,
    ) -> Result<(), Box<dyn std::error::Error>> {
        println!("🔔 托盘事件触发: {:?}", event_id);

        let event_str: &str = event_id.as_ref();

        // 检查是否为角色切换事件（直接匹配角色名称）
        let is_persona_event = LIVE2D_PERSONAS.iter().any(|(id, _, _)| *id == event_str);

        if is_persona_event {
            println!("🔄 触发模型切换: {}", event_str);

            if let Err(e) = tauri::async_runtime::block_on(async {
                event_emitter::emit_model_switch(app.clone(), event_str).await
            }) {
                eprintln!("❌ 切换到{}失败: {}", event_str, e);
            } else {
                println!("✅ 切换到{}成功", event_str);
                if let Ok(mut state) = menu_state.lock() {
                    state.set_current_persona(event_str.to_string());
                    println!("✅ 状态已更新，当前选中: {}", event_str);
                }

                // 释放锁后再重建托盘菜单（避免死锁）
                if let Err(e) = rebuild_tray_menu::<R>(app, menu_state.clone()) {
                    eprintln!("⚠️ 重建托盘菜单失败: {}", e);
                } else {
                    println!("✅ 托盘菜单已更新选中标记");
                }
            }
        } else {
            println!("⚠️ 未知事件: {:?}", event_id);
        }

        Ok(())
    }
}

// ========== Tauri命令定义 ==========

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
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
        eprintln!("触发显示动画失败: {}", e);
    }

    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(500));
        if let Err(e) = tauri::async_runtime::block_on(async {
            window_manager::show_live2d_window(app_clone).await
        }) {
            eprintln!("显示窗口失败: {}", e);
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
            .set_size(tauri::Size::Physical(tauri::PhysicalSize {
                width: width as u32,
                height: height as u32,
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

    println!("🖱️ 开始全局鼠标跟踪");

    // 获取 live2d 窗口
    let window = match app.get_webview_window("live2d") {
        Some(w) => w,
        None => {
            println!("❌ 找不到 live2d 窗口");
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

    println!("✅ 全局鼠标跟踪已启动");
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
        println!("窗口置顶状态切换为: {}", !always_on_top);
        Ok(!always_on_top)
    } else {
        Err("窗口不存在".to_string())
    }
}

#[tauri::command]
async fn reset_window_position(app: AppHandle) -> Result<(), String> {
    window_manager::position_live2d_window(app).await
}

#[tauri::command]
async fn debug_right_click_menu(model_name: String) -> Result<(), String> {
    println!("🖱️ 右键菜单被触发! 切换到模型: {}", model_name);
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
            start_window_drag,
            toggle_always_on_top,
            reset_window_position,
            debug_right_click_menu,
        ])
        .setup(|app| {
            println!("🚀 Tauri应用启动");

            // 创建应用状态
            let app_state = AppState {
                tray_icon: Arc::new(Mutex::new(None)),
            };

            // 创建共享状态
            let menu_state = Arc::new(Mutex::new(window_state::WindowState::new()));

            // 初始化窗口
            if let Err(e) = initialize_windows(&app.handle(), &menu_state) {
                eprintln!("❌ 窗口初始化失败: {}", e);
            }

            // 设置托盘并保存到状态中
            match setup_tray(&app.handle(), menu_state) {
                Ok(tray) => {
                    if let Ok(mut tray_state) = app_state.tray_icon.lock() {
                        *tray_state = Some(tray);
                        println!("✅ 托盘图标已保存到应用状态");
                    }
                }
                Err(e) => {
                    eprintln!("❌ 托盘设置失败: {}", e);
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
    println!("🏠 初始化窗口...");

    // 延迟显示和定位窗口
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(Duration::from_secs(1));

        if let Err(e) = tauri::async_runtime::block_on(async {
            window_manager::position_live2d_window(app_clone.clone()).await
        }) {
            eprintln!("窗口定位失败: {}", e);
        }
    });

    Ok(())
}

/// 设置托盘
fn setup_tray(
    app: &AppHandle,
    menu_state: Arc<Mutex<window_state::WindowState>>,
) -> Result<TrayIcon, Box<dyn std::error::Error>> {
    println!("🎯 设置系统托盘...");

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
            println!("🎯 托盘菜单事件: {:?}", event.id);
            match event.id.as_ref() {
                "show_pet" => {
                    println!("📺 显示宠物请求");
                    if let Err(e) = tauri::async_runtime::block_on(async {
                        window_manager::show_live2d_window(app.clone()).await
                    }) {
                        eprintln!("❌ 显示宠物失败: {}", e);
                    }
                }
                "hide_pet" => {
                    println!("📺 隐藏宠物请求");
                    if let Err(e) = tauri::async_runtime::block_on(async {
                        window_manager::hide_live2d_window(app.clone()).await
                    }) {
                        eprintln!("❌ 隐藏宠物失败: {}", e);
                    }
                }
                _ => {
                    // 处理角色切换事件
                    if let Err(e) =
                        tray_manager::handle_tray_event(app, &event.id, tray_menu_state.clone())
                    {
                        eprintln!("托盘事件处理失败: {}", e);
                    }
                }
            }
        })
        .build(app)?;

    println!("✅ 系统托盘设置完成");
    Ok(tray)
}

/// 创建托盘图标数据
fn create_tray_icon_data() -> Result<Image<'static>, Box<dyn std::error::Error>> {
    // 尝试从文件加载白色logo作为托盘图标
    let icon_path = "./icons/tray_white_32.png";

    match fs::read(icon_path) {
        Ok(icon_data) => {
            // 尝试解码PNG图片
            match image::load_from_memory(&icon_data) {
                Ok(img) => {
                    // 转换为RGBA格式
                    let rgba_img = img.to_rgba8();
                    let (width, height) = rgba_img.dimensions();
                    let rgba = rgba_img.into_raw();

                    println!("✅ 成功加载托盘图标: {}x{} 像素", width, height);
                    Ok(Image::new_owned(rgba, width, height))
                }
                Err(e) => {
                    eprintln!("❌ 图片解码失败: {}, 使用备用图标", e);
                    create_fallback_tray_icon()
                }
            }
        }
        Err(e) => {
            eprintln!("❌ 无法读取托盘图标文件: {}, 使用备用图标", e);
            create_fallback_tray_icon()
        }
    }
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

    println!("✅ 使用备用托盘图标");
    Ok(Image::new_owned(rgba, 16, 16))
}

// 添加chrono依赖到Cargo.toml
#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        let result = 2 + 2;
        assert_eq!(result, 4);
    }
}
