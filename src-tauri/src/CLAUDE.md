

# Tauri 后端模块

## 模块职责

Tauri 后端模块负责桌面应用的核心功能，包括窗口管理、系统集成、托盘菜单、边缘检测等功能，为前端提供安全的系统级 API。

## 入口与启动

### 主要文件
- **main.rs**: 应用程序入口点
- **lib.rs**: 库主文件，包含所有模块和命令

### 启动流程
```rust
// main.rs
fn main() {
    reeftotem_assistant_lib::run()
}

// lib.rs
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // 注册所有 Tauri 命令
        ])
        .setup(|app| {
            // 初始化应用状态和窗口
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## 对外接口

### 窗口管理命令
```rust
// 显示/隐藏 Live2D 窗口
async fn show_live2d_window(app: AppHandle) -> Result<(), String>
async fn hide_live2d_window(app: AppHandle) -> Result<(), String>

// 窗口定位和调整
async fn position_live2d_window(app: AppHandle) -> Result<(), String>
async fn resize_live2d_window(app: AppHandle, width: f64, height: f64) -> Result<(), String>

// 窗口状态查询
async fn is_live2d_visible(app: AppHandle) -> Result<bool, String>
```

### 模型切换命令
```rust
// 切换 Live2D 模型
async fn switch_live2d_model(app: AppHandle, model_name: String) -> Result<(), String>
async fn switch_persona(app: AppHandle, persona: String) -> Result<(), String>

// 触发动画效果
async fn trigger_show_animation(app: AppHandle) -> Result<(), String>
async fn trigger_hide_animation(app: AppHandle) -> Result<(), String>
```

### 边缘检测命令
```rust
// 屏幕和窗口边界信息
async fn get_screen_bounds(app: AppHandle) -> Result<ScreenBounds, String>
async fn get_window_bounds(app: AppHandle) -> Result<WindowBounds, String>

// 拖拽约束计算
async fn calculate_drag_constraints(app: AppHandle, margin: Option<i32>) -> Result<DragConstraints, String>
async fn constrain_window_position(app: AppHandle, x: i32, y: i32, margin: Option<i32>) -> Result<ConstrainedPosition, String>

// 碰撞预测
async fn predict_boundary_collision(app: AppHandle, delta_x: i32, delta_y: i32, margin: Option<i32>) -> Result<(bool, Option<String>), String>
```

### Live2D 交互命令
```rust
// 表情、动作、唇形同步
async fn trigger_live2d_expression(app: AppHandle, expression: String) -> Result<(), String>
async fn trigger_live2d_motion(app: AppHandle, motion: String) -> Result<(), String>
async fn trigger_live2d_lip_sync(app: AppHandle, text: String, lip_sync_data: serde_json::Value) -> Result<(), String>
```

## 关键依赖与配置

### 主要依赖
```toml
[dependencies]
tauri = { version = "2.9.1", features = ["macos-private-api", "tray-icon"] }
tauri-plugin-opener = "2.5.0"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1.48.0", features = ["full"] }
chrono = { version = "0.4", features = ["serde"] }
image = "0.25.8"
```

### 配置文件
- **tauri.conf.json**: Tauri 应用配置
- **capabilities/default.json**: 权限配置
- **capabilities/live2d-window.json**: Live2D 窗口权限

### 权限配置
```json
{
  "identifier": "live2d-window",
  "windows": ["live2d"],
  "permissions": [
    "core:window:allow-show",
    "core:window:allow-hide",
    "core:window:allow-set-position",
    "core:window:allow-set-size",
    "core:window:allow-is-visible",
    "core:window:allow-start-dragging"
  ]
}
```

## 数据模型

### 屏幕边界信息
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}
```

### 窗口边界信息
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowBounds {
    pub x: i32,
    pub y: i32,
    pub width: u32,
    pub height: u32,
}
```

### 拖拽约束
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DragConstraints {
    pub min_x: i32,
    pub min_y: i32,
    pub max_x: i32,
    pub max_y: i32,
    pub screen_bounds: ScreenBounds,
}
```

### 约束位置
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstrainedPosition {
    pub x: i32,
    pub y: i32,
    pub is_constrained: bool,
    pub constraint_edge: Option<String>,
}
```

## 模块架构

### 窗口管理模块 (`window_manager`)
- Live2D 窗口显示/隐藏
- 窗口定位和尺寸调整
- 窗口状态管理

### 事件发送模块 (`event_emitter`)
- 模型切换事件发送
- 动画事件触发
- 跨窗口通信

### 托盘管理模块 (`tray_manager`)
- 系统托盘图标管理
- 托盘菜单创建和更新
- 托盘事件处理

### 边缘检测模块 (`screen_edge_detection`)
- 屏幕边界计算
- 拖拽约束管理
- 碰撞检测和预测

### 窗口状态模块 (`window_state`)
- 窗口状态维护
- 状态同步机制
- 持久化存储

## 测试与质量

### 单元测试
- 窗口管理功能测试
- 边缘检测算法测试
- 事件发送测试
- 状态管理测试

### 集成测试
- 前后端通信测试
- 多窗口协调测试
- 托盘功能测试

### 性能指标
- 窗口操作响应时间 < 100ms
- 事件发送延迟 < 50ms
- 内存使用 < 100MB
- CPU 使用率 < 10%

## 常见问题 (FAQ)

### Q: 窗口定位不准确
**A**: 检查屏幕 DPI 缩放设置，使用 `current_monitor()` 获取准确的屏幕信息

### Q: 托盘菜单不显示
**A**: 确保图标文件存在且格式正确，检查系统托盘权限

### Q: 边缘检测失效
**A**: 验证窗口句柄有效性，检查屏幕分辨率变化处理

### Q: 事件发送失败
**A**: 确保目标窗口存在，检查事件监听器是否正确注册

## 安全考虑

### 权限最小化
- 只请求必要的系统权限
- 窗口操作限制在应用范围内
- 文件访问使用沙盒机制

### 输入验证
- 验证所有前端输入参数
- 防止坐标越界和无效值
- 限制窗口尺寸范围

### 错误处理
- 统一错误返回格式
- 避免敏感信息泄露
- 提供详细的错误日志

## 相关文件清单

### 核心文件
- `main.rs`: 应用入口
- `lib.rs`: 主库文件，包含所有模块和命令

### 模块文件 (位于 `lib.rs` 内部)
- `window_manager`: 窗口管理模块
- `event_emitter`: 事件发送模块
- `tray_manager`: 托盘管理模块
- `screen_edge_detection`: 边缘检测模块
- `window_state`: 窗口状态模块

### 配置文件
- `../tauri.conf.json`: 主配置文件
- `../capabilities/default.json`: 默认权限
- `../capabilities/live2d-window.json`: Live2D 窗口权限

### 构建文件
- `../build.rs`: 构建脚本
- `../Cargo.toml`: 项目依赖配置

## 开发指南

### 添加新命令
1. 在 `lib.rs` 中定义命令函数
2. 添加到 `invoke_handler!` 宏中
3. 更新权限配置文件
4. 编写测试用例

### 调试技巧
- 使用 `println!` 输出调试信息
- 启用 Tauri 开发者工具
- 检查前端控制台日志
- 使用 Rust 调试器

### 性能优化
- 使用异步函数处理耗时操作
- 避免阻塞 UI 线程
- 合理使用缓存机制
- 监控内存使用情况

## 变更记录 (Changelog)

- **2025-05-25 13:37:29** - 创建模块文档，整理 Tauri 后端架构和接口
- **近期更新** - 增加边缘检测、托盘管理、Live2D 交互等功能

---

*模块文档由 AI 自动生成，最后更新时间：2025-10-25 13:37:29*