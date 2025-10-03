use tauri::{menu::{Menu, MenuItem, PredefinedMenuItem, Submenu}, tray::TrayIconBuilder, Manager, Emitter, AppHandle};
use std::sync::{Arc, Mutex};

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
        }

        // 向主窗口发送显示事件
        if let Some(main_window) = app_clone.get_webview_window("main") {
            let _ = main_window.emit("show-pet", ());
        }

        // 更新菜单状态
        if let Err(e) = update_menu_state_from_handle(&app_clone, true, "cat") {
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

            // 更新菜单状态
            if let Err(e) = update_menu_state_from_handle(&app_clone, false, "cat") {
                eprintln!("更新菜单状态失败: {}", e);
            }
        });
    }
    Ok(())
}

#[tauri::command]
async fn exit_app() -> Result<(), String> {
    std::process::exit(0);
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
            exit_app
        ])
        .setup(|app| {
            use tauri::Manager;

            // 获取窗口引用
            let main_window = app.get_webview_window("main").unwrap();
            let live2d_window = app.get_webview_window("live2d").unwrap();

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