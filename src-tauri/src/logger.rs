use chrono::{SecondsFormat, Utc};

#[derive(Copy, Clone, Debug)]
pub enum LogLevel {
    Trace,
    Debug,
    Info,
    Warn,
    Error,
}

impl LogLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            LogLevel::Trace => "TRACE",
            LogLevel::Debug => "DEBUG",
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }
}

pub fn is_verbose_logging() -> bool {
    cfg!(debug_assertions) || env!("CARGO_PKG_VERSION").contains('-')
}

pub fn log_message(level: LogLevel, message: String, file: &'static str, line: u32) {
    if !is_verbose_logging() && matches!(level, LogLevel::Trace | LogLevel::Debug) {
        return;
    }

    let timestamp = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    let location = format!("{}:{}", file, line);
    let version = env!("CARGO_PKG_VERSION");
    let current_thread = std::thread::current();
    let thread_name = current_thread.name().unwrap_or("unnamed");

    if matches!(level, LogLevel::Error) {
        eprintln!(
            "[{}] [{}] [v{}] [{}] [{}] {}",
            timestamp,
            level.as_str(),
            version,
            thread_name,
            location,
            message
        );
    } else {
        println!(
            "[{}] [{}] [v{}] [{}] [{}] {}",
            timestamp,
            level.as_str(),
            version,
            thread_name,
            location,
            message
        );
    }
}

#[macro_export]
macro_rules! app_log {
    ($level:expr, $($arg:tt)+) => {{
        $crate::logger::log_message($level, format!($($arg)+), file!(), line!());
    }};
}

#[macro_export]
macro_rules! app_trace {
    ($($arg:tt)+) => {{
        $crate::app_log!($crate::logger::LogLevel::Trace, $($arg)+);
    }};
}

#[macro_export]
macro_rules! app_debug {
    ($($arg:tt)+) => {{
        $crate::app_log!($crate::logger::LogLevel::Debug, $($arg)+);
    }};
}

#[macro_export]
macro_rules! app_info {
    ($($arg:tt)+) => {{
        $crate::app_log!($crate::logger::LogLevel::Info, $($arg)+);
    }};
}

#[macro_export]
macro_rules! app_warn {
    ($($arg:tt)+) => {{
        $crate::app_log!($crate::logger::LogLevel::Warn, $($arg)+);
    }};
}

#[macro_export]
macro_rules! app_error {
    ($($arg:tt)+) => {{
        $crate::app_log!($crate::logger::LogLevel::Error, $($arg)+);
    }};
}
