use tauri::{menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, tray::TrayIconBuilder, Manager, Emitter, AppHandle};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

// 添加显示动画命令
#[tauri::command]
async fn trigger_show_animation(app: AppHandle) -> Result<(), String> {
    // 发送事件给Live2D窗口触发显示动画
    if let Some(webview_window) = app.get_webview_window("live2d") {
        webview_window.emit("show_animation", ()).map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn switch_persona(app: AppHandle, persona: String) -> Result<(), String> {
    // 发送事件给Live2D窗口切换数字人
    if let Some(webview_window) = app.get_webview_window("live2d") {
        webview_window.emit("switch_persona", serde_json::json!({ "persona": persona }))
            .map_err(|e: tauri::Error| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn show_live2d_window(app: AppHandle) -> Result<(), String> {
    if let Some(webview_window) = app.get_webview_window("live2d") {
        webview_window.show().map_err(|e| e.to_string())?;
        webview_window.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn show_live2d_window_with_animation(app: AppHandle) -> Result<(), String> {
    // 先触发显示动画
    if let Err(e) = trigger_show_animation(app.clone()).await {
        eprintln!("触发显示动画失败: {}", e);
    }

    // 延迟显示窗口（给动画时间执行）
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_millis(500));
        if let Some(window) = app_clone.get_webview_window("live2d") {
            let _ = window.show();
            let _ = window.set_focus();

            // 延迟定位到右下角
            let app_clone2 = app_clone.clone();
            std::thread::spawn(move || {
                std::thread::sleep(std::time::Duration::from_millis(100));
                if let Err(e) = tauri::async_runtime::block_on(async {
                    position_live2d_window(app_clone2).await
                }) {
                    eprintln!("定位Live2D窗口失败: {}", e);
                }
            });
        }

        // 向主窗口发送显示事件
        if let Some(main_window) = app_clone.get_webview_window("main") {
            let _ = main_window.emit("show-pet", ());
        }

        // 使用默认的模型名称，因为无法在这里访问menu_state
        let current_persona = "haru".to_string();
        if let Err(e) = update_menu_state_from_handle(&app_clone, true, &current_persona) {
            eprintln!("更新菜单状态失败: {}", e);
        }
    });

    Ok(())
}

#[tauri::command]
async fn hide_live2d_window(app: AppHandle) -> Result<(), String> {
    if let Some(webview_window) = app.get_webview_window("live2d") {
        webview_window.hide().map_err(|e| e.to_string())?;
    }
    Ok(())
}


#[tauri::command]
async fn is_live2d_visible(app: AppHandle) -> Result<bool, String> {
    if let Some(webview_window) = app.get_webview_window("live2d") {
        let is_visible = webview_window.is_visible().map_err(|e| e.to_string())?;
        Ok(is_visible)
    } else {
        Ok(false)
    }
}

#[tauri::command]
async fn trigger_hide_animation(app: AppHandle) -> Result<(), String> {
    // 发送事件给Live2D窗口触发隐藏动画
    if let Some(webview_window) = app.get_webview_window("live2d") {
        webview_window.emit("hide_animation", ()).map_err(|e: tauri::Error| e.to_string())?;

        // 延迟后隐藏窗口（给动画时间执行）
        let app_clone = app.clone();
        std::thread::spawn(move || {
            std::thread::sleep(std::time::Duration::from_millis(1000));
            if let Some(window) = app_clone.get_webview_window("live2d") {
                let _ = window.hide();
            }

            // 使用默认的模型名称，因为无法在这里访问menu_state
            let current_persona = "haru".to_string();
            if let Err(e) = update_menu_state_from_handle(&app_clone, false, &current_persona) {
                eprintln!("更新菜单状态失败: {}", e);
            }
        });
    }
    Ok(())
}

#[tauri::command]
async fn position_live2d_window(app: AppHandle) -> Result<(), String> {
    println!("开始定位Live2D窗口...");

    if let Some(window) = app.get_webview_window("live2d") {
        println!("找到Live2D窗口");

        // 等待窗口完全准备好
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;

        // 确保窗口可见
        window.show().map_err(|e| e.to_string())?;
        println!("窗口已设置为可见");

        // 获取屏幕尺寸
        if let Ok(monitor) = window.current_monitor() {
            if let Some(monitor) = monitor {
                let screen_size = monitor.size();
                let window_size = window.inner_size().map_err(|e| e.to_string())?;

                println!("屏幕尺寸: {}x{}", screen_size.width, screen_size.height);
                println!("窗口尺寸: {}x{}", window_size.width, window_size.height);

                // 计算右下角位置，留出边距避免遮挡
                let margin_x = 120;
                let margin_y = 120;
                let x = screen_size.width as i32 - window_size.width as i32 - margin_x;
                let y = screen_size.height as i32 - window_size.height as i32 - margin_y;

                println!("计算位置: x={}, y={}", x, y);

                // 确保窗口不会超出屏幕边界 - 使用更保守的边界检查
                let final_x = x.max(50).min(screen_size.width as i32 - window_size.width as i32 - 50);
                let final_y = y.max(50).min(screen_size.height as i32 - window_size.height as i32 - 50);

                println!("最终定位Live2D窗口到: x={}, y={} (屏幕: {}x{}, 窗口: {}x{})",
                    final_x, final_y,
                    screen_size.width, screen_size.height,
                    window_size.width, window_size.height);

                // 设置窗口位置
                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: final_x, y: final_y }))
                    .map_err(|e| e.to_string())?;

                // 确保窗口置顶
                let _ = window.set_always_on_top(true);

                // 再次确保窗口位置（防止被系统移动）
                tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                let _ = window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: final_x, y: final_y }));

                println!("窗口定位完成");
            } else {
                println!("无法获取显示器信息");
            }
        } else {
            println!("无法获取当前显示器");
        }
    } else {
        println!("无法找到Live2D窗口");
    }
    Ok(())
}

#[tauri::command]
async fn resize_live2d_window(app: AppHandle, width: f64, height: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        // 确保最小尺寸
        let final_width = width.max(120.0);
        let final_height = height.max(180.0);

        // 设置窗口大小
        window.set_size(tauri::Size::Physical(tauri::PhysicalSize {
            width: final_width as u32,
            height: final_height as u32,
        })).map_err(|e| e.to_string())?;

        // 短暂延迟后重新定位到右下角
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
        if let Err(e) = position_live2d_window(app).await {
            eprintln!("重新定位窗口失败: {}", e);
        }

        println!("调整Live2D窗口尺寸到: {}x{}", final_width, final_height);
    }
    Ok(())
}

#[tauri::command]
async fn get_window_position(app: AppHandle) -> Result<(i32, i32), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        let position = window.outer_position().map_err(|e| e.to_string())?;
        Ok((position.x, position.y))
    } else {
        Err("无法获取Live2D窗口".to_string())
    }
}

#[tauri::command]
async fn set_window_position(app: AppHandle, x: i32, y: i32) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x, y }))
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
async fn exit_app() -> Result<(), String> {
    // 给前端一点时间来显示成功消息
    std::thread::sleep(std::time::Duration::from_millis(100));
    std::process::exit(0);
}

// 窗口管理器结构 - 跨平台实现
#[derive(Clone)]
struct WindowManager {
    is_dragging: Arc<Mutex<bool>>,
    app_handle: AppHandle,
}

impl WindowManager {
    fn new(app_handle: AppHandle) -> Self {
        Self {
            is_dragging: Arc::new(Mutex::new(false)),
            app_handle,
        }
    }

    fn start_global_mouse_tracking(&self) {
        let is_dragging = self.is_dragging.clone();
        let _app_handle = self.app_handle.clone();

        thread::spawn(move || {
            // 跨平台鼠标跟踪实现
            println!("启动全局鼠标跟踪 (跨平台模式)");

            loop {
                // 检查是否处于拖拽状态
                let should_track = {
                    let is_dragging_guard = is_dragging.lock().unwrap();
                    !*is_dragging_guard
                };

                if should_track {
                    // 这里可以添加跨平台的鼠标位置获取逻辑
                    // 由于我们已经在Web端实现了鼠标跟随，Rust端主要负责窗口管理
                    // 所以我们可以简化这个实现，或者使用其他跨平台的方案

                    // 暂时使用占位符，实际上鼠标跟随已经在Web端通过Tauri事件处理了
                    // 我们可以在这里添加其他需要的功能，比如周期性状态检查
                }

                thread::sleep(Duration::from_millis(16)); // ~60fps
            }
        });
    }
}

// 启动全局鼠标跟踪
#[tauri::command]
async fn start_mouse_tracking(app: AppHandle) -> Result<(), String> {
    let window_manager = WindowManager::new(app);
    window_manager.start_global_mouse_tracking();
    Ok(())
}

// 开始窗口拖拽 - 使用Tauri 2.x原生拖拽
#[tauri::command]
async fn start_manual_drag(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        // Tauri 2.x 使用 start_dragging() 方法启用系统级拖拽
        window.start_dragging().map_err(|e| {
            format!("启动拖拽失败: {}", e)
        })?;
    }
    Ok(())
}

// 设置窗口透明度
#[tauri::command]
async fn set_window_opacity(app: AppHandle, window_label: String, opacity: f64) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        // Tauri 2.x 设置透明度的方法 - 通过JS注入实现
        let opacity_js = format!("document.body.style.opacity = {}; document.documentElement.style.opacity = {}", opacity, opacity);
        window.eval(&opacity_js).map_err(|e| e.to_string())?;

        // 透明度已通过JavaScript设置完成

        Ok(())
    } else {
        Err(format!("找不到窗口: {}", window_label))
    }
}

// 切换窗口置顶状态
#[tauri::command]
async fn toggle_always_on_top(app: AppHandle) -> Result<bool, String> {
    if let Some(window) = app.get_webview_window("live2d") {
        // 获取当前置顶状态
        let current_topmost = window.is_always_on_top().map_err(|e| e.to_string())?;

        // 切换状态
        let new_topmost = !current_topmost;
        window.set_always_on_top(new_topmost).map_err(|e| e.to_string())?;

        Ok(new_topmost)
    } else {
        Err("找不到Live2D窗口".to_string())
    }
}

// 重置窗口位置到右下角
#[tauri::command]
async fn reset_window_position(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        // 获取屏幕尺寸
        if let Some(monitor) = window.current_monitor().map_err(|e| e.to_string())? {
            let screen_size = monitor.size();

            // 获取窗口尺寸
            if let Ok(window_size) = window.outer_size() {
                // 计算右下角位置（留出边距）
                let margin = 50;
                let x = screen_size.width as i32 - window_size.width as i32 - margin;
                let y = screen_size.height as i32 - window_size.height as i32 - margin;

                // 确保窗口不会超出屏幕边界
                let final_x = x.max(50).min(screen_size.width as i32 - window_size.width as i32 - 50);
                let final_y = y.max(50).min(screen_size.height as i32 - window_size.height as i32 - 50);

                window.set_position(tauri::Position::Physical(tauri::PhysicalPosition {
                    x: final_x,
                    y: final_y
                })).map_err(|e| e.to_string())?;

                Ok(())
            } else {
                Err("无法获取窗口尺寸".to_string())
            }
        } else {
            Err("无法获取屏幕信息".to_string())
        }
    } else {
        Err("找不到Live2D窗口".to_string())
    }
}

// 显示关于对话框
#[tauri::command]
async fn show_about_dialog() -> Result<String, String> {
    let about_text = "🐠 ReefTotem Assistant v0.1.2\n\n🎭 一个基于Live2D的智能数字人助手\n\n✨ 功能特性：\n• Live2D 实时渲染\n• 智能鼠标跟踪\n• 窗口透明度调节\n• 多窗口支持\n• 右键交互菜单\n\n🛠️ 技术栈：\n• Tauri 2.8.5\n• React 19 + TypeScript\n• Live2D Cubism SDK\n• Vite 7.x\n\n📝 开发进度：\n✅ v0.1.1 - 基础Live2D功能\n✅ v0.1.2 - 右键菜单系统\n✅ v0.1.3 - 性能优化 (当前)\n🚀 Phase 2 - AI语音对话 (即将推出)\n\n© 2025 ReefTotem Team".to_string();

    Ok(about_text)
}

// 手动窗口拖拽 - 处理透明窗口拖拽问题
#[tauri::command]
async fn start_window_drag(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("live2d") {
        // 首先尝试Tauri原生的拖拽方法
        let _ = window.start_dragging();
        Ok(())
    } else {
        Err("无法找到Live2D窗口".to_string())
    }
}

// 辅助函数：更新菜单状态
fn update_menu_state_from_handle(_app: &AppHandle, is_pet_visible: bool, current_persona: &str) -> Result<(), String> {
    // 尝试获取托盘图标并更新菜单项状态
    // 注意：由于Tauri v2的限制，我们无法直接更新菜单项状态
    // 这里提供一个框架，实际实现可能需要使用其他方法
    if is_pet_visible {
        println!("宠物已显示 - 显示按钮应禁用，隐藏按钮应启用");
    } else {
        println!("宠物已隐藏 - 显示按钮应启用，隐藏按钮应禁用");
    }
    println!("当前数字人: {}", current_persona);
    Ok(())
}


// 菜单状态管理结构
#[derive(Clone)]
struct MenuState {
    is_pet_visible: bool,
    current_persona: String,
}

impl MenuState {
    fn new() -> Self {
        Self {
            is_pet_visible: false,
            current_persona: "haru".to_string(), // 默认使用Live2D角色
        }
    }

    fn set_pet_visibility(&mut self, visible: bool) {
        self.is_pet_visible = visible;
    }

    fn set_current_persona(&mut self, persona: String) {
        self.current_persona = persona;
    }

    #[allow(dead_code)]
    fn should_enable_show(&self) -> bool {
        !self.is_pet_visible
    }

    #[allow(dead_code)]
    fn should_enable_hide(&self) -> bool {
        self.is_pet_visible
    }
}

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
            is_live2d_visible,
            trigger_hide_animation,
            position_live2d_window,
            resize_live2d_window,
            get_window_position,
            set_window_position,
            start_mouse_tracking,
            start_manual_drag,
            start_window_drag,
            set_window_opacity,
            toggle_always_on_top,
            reset_window_position,
            show_about_dialog,
            exit_app
        ])
        .setup(|app| {
            use tauri::Manager;

            // 获取窗口引用
            let main_window = app.get_webview_window("main").unwrap();
            let live2d_window = app.get_webview_window("live2d").unwrap();

            // 立即设置Live2D窗口位置到右下角
            if let Err(e) = tauri::async_runtime::block_on(async {
                position_live2d_window(app.handle().clone()).await
            }) {
                eprintln!("初始定位Live2D窗口失败: {}", e);
            }

            // 启动全局鼠标跟踪
            if let Err(e) = tauri::async_runtime::block_on(async {
                start_mouse_tracking(app.handle().clone()).await
            }) {
                eprintln!("启动全局鼠标跟踪失败: {}", e);
            }

            // 创建菜单状态管理
            let menu_state = Arc::new(Mutex::new(MenuState::new()));

            // 初始化宠物状态
            if let Ok(is_visible) = live2d_window.is_visible() {
                if let Ok(mut state) = menu_state.lock() {
                    state.set_pet_visibility(is_visible);
                }
            }

            // 获取当前数字人状态
            let current_persona = {
                if let Ok(state) = menu_state.lock() {
                    state.current_persona.clone()
                } else {
                    "haru".to_string() // 默认使用Live2D角色
                }
            };

            // 创建菜单项 - 使用自定义ID以便后续管理
            let show_live2d_i = MenuItem::with_id(app, "show_pet", "显示宠物", true, None::<&str>)?;
            let hide_live2d_i = MenuItem::with_id(app, "hide_pet", "隐藏宠物", true, None::<&str>)?;
            let separator1 = PredefinedMenuItem::separator(app)?;

            // 创建数字人子菜单
            let persona_submenu = Submenu::with_id(app, "persona_submenu", "切换数字人", true)?;

            // Live2D角色列表
            let live2d_personas = vec![
                ("haru", "Haru", "🌸"),
                ("hiyori", "Hiyori", "🌺"),
                ("mark", "Mark", "🌟"),
                ("tsumiki", "Tsumiki", "🎀"),
                ("mao", "Mao", "🔥"),
                ("hibiki", "Hibiki", "🎸"),
                ("haru_greeter", "Haru Greeter", "👋"),
                ("izumi", "Izumi", "💎"),
                ("epsilon", "Epsilon", "🚀"),
                ("chitose", "Chitose", "🌸"),
                ("shizuku", "Shizuku", "🍃"),
            ];

            // 直接添加Live2D角色（移除Canvas角色）
            for (id, name, emoji) in live2d_personas {
                let display_name = if current_persona == id {
                    format!("{} {} ✓", emoji, name)
                } else {
                    format!("{} {}", emoji, name)
                };

                let persona_item = MenuItem::with_id(
                    app,
                    format!("{}_persona", id),
                    display_name,
                    true,
                    None::<&str>
                )?;
                persona_submenu.append(&persona_item)?;
            }

            let separator2 = PredefinedMenuItem::separator(app)?;
            let quit_i = MenuItem::with_id(app, "quit_app", "退出应用", true, None::<&str>)?;

            // 创建主菜单
            let menu = Menu::with_items(app, &[
                &show_live2d_i,
                &hide_live2d_i,
                &separator1,
                &persona_submenu,
                &separator2,
                &quit_i,
            ])?;

            // 创建托盘图标 - 完整版本
            let tray = TrayIconBuilder::new()
                .menu(&menu)
                .show_menu_on_left_click(true)  // 左键点击显示菜单
                .tooltip("Reeftotem Assistant")
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;

            // 存储托盘引用以便后续使用
            app.manage(tray);

            // 处理菜单事件 - 使用Tauri 2.x的正确API
            let app_handle = app.handle().clone();
            let menu_state_clone = menu_state.clone();

            app.on_menu_event(move |_window, event| {
                match event.id.as_ref() {
                    "show_pet" => {
                        // 显示宠物窗口并触发显示动画
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            show_live2d_window_with_animation(app_handle.clone()).await
                        }) {
                            eprintln!("显示宠物失败: {}", e);
                        } else {
                            // 更新状态
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_pet_visibility(true);
                            }
                        }
                    }
                    "hide_pet" => {
                        // 触发隐藏动画
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            trigger_hide_animation(app_handle.clone()).await
                        }) {
                            eprintln!("隐藏宠物失败: {}", e);
                        } else {
                            // 更新状态
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_pet_visibility(false);
                            }
                        }
                    }
                      // Live2D角色事件处理
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("haru") => {
                        let persona_name = if persona_id == "haru_greeter_persona" {
                            "haru_greeter"
                        } else {
                            "haru"
                        };
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), persona_name.to_string()).await
                        }) {
                            eprintln!("切换到{}失败: {}", persona_name, e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona(persona_name.to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("hiyori") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "hiyori".to_string()).await
                        }) {
                            eprintln!("切换到Hiyori失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("hiyori".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("mark") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "mark".to_string()).await
                        }) {
                            eprintln!("切换到Mark失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("mark".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("tsumiki") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "tsumiki".to_string()).await
                        }) {
                            eprintln!("切换到Tsumiki失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("tsumiki".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("mao") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "mao".to_string()).await
                        }) {
                            eprintln!("切换到Mao失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("mao".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("hibiki") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "hibiki".to_string()).await
                        }) {
                            eprintln!("切换到Hibiki失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("hibiki".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("izumi") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "izumi".to_string()).await
                        }) {
                            eprintln!("切换到Izumi失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("izumi".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("epsilon") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "epsilon".to_string()).await
                        }) {
                            eprintln!("切换到Epsilon失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("epsilon".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("chitose") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "chitose".to_string()).await
                        }) {
                            eprintln!("切换到Chitose失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("chitose".to_string());
                            }
                        }
                    }
                    persona_id if persona_id.ends_with("_persona") && persona_id.starts_with("shizuku") => {
                        if let Err(e) = tauri::async_runtime::block_on(async {
                            switch_persona(app_handle.clone(), "shizuku".to_string()).await
                        }) {
                            eprintln!("切换到Shizuku失败: {}", e);
                        } else {
                            if let Ok(mut state) = menu_state_clone.lock() {
                                state.set_current_persona("shizuku".to_string());
                            }
                        }
                    }
                    "quit_app" => {
                        // 优雅退出应用
                        let _ = main_window.emit("app-exit", ());
                        std::thread::sleep(std::time::Duration::from_millis(300));
                        std::process::exit(0);
                    }
                    _ => {}
                }
            });

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}