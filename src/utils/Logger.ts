// 前端日志系统
// 处理前端应用中的错误和日志记录

// 日志级别
export enum LogLevel {
  ERROR = 0,
  WARNING = 1,
  INFO = 2,
  DEBUG = 3,
}

// 日志条目接口
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  category: string;
  context?: any;
  stackTrace?: string;
  userAgent: string;
  url: string;
}

// 日志过滤器接口
export interface LogFilter {
  level?: LogLevel;
  category?: string;
  startTime?: Date;
  endTime?: Date;
  searchTerm?: string;
}

// 日志统计信息
export interface LogStats {
  totalEntries: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  debugCount: number;
  oldestEntry?: Date;
  newestEntry?: Date;
  categories: string[];
}

/**
 * 前端日志管理器
 */
class Logger {
  private static instance: Logger;
  private logs: LogEntry[] = [];
  private maxEntries: number = 1000;
  private maxConsoleLevel: LogLevel = LogLevel.INFO;

  private constructor() {
    // 监听全局错误
    this.setupGlobalErrorHandlers();

    // 监听未处理的Promise拒绝
    this.setupUnhandledRejectionHandler();
  }

  /**
   * 获取单例实例
   */
  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger();
    }
    return Logger.instance;
  }

  /**
   * 记录日志条目
   */
  private log(level: LogLevel, message: string, category: string, context?: any): void {
    const entry: LogEntry = {
      id: this.generateLogId(),
      timestamp: new Date(),
      level,
      message,
      category,
      context,
      stackTrace: level === LogLevel.ERROR ? new Error().stack : undefined,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    // 添加到内存日志
    this.logs.unshift(entry);

    // 限制日志数量
    if (this.logs.length > this.maxEntries) {
      this.logs = this.logs.slice(0, this.maxEntries);
    }

    // 输出到控制台
    this.outputToConsole(entry);

    // 如果是错误级别，尝试上报到后端
    if (level === LogLevel.ERROR) {
      this.reportErrorToBackend(entry);
    }
  }

  /**
   * 记录错误日志
   */
  error(message: string, category: string = 'app', context?: any): void {
    this.log(LogLevel.ERROR, message, category, context);
  }

  /**
   * 记录警告日志
   */
  warning(message: string, category: string = 'app', context?: any): void {
    this.log(LogLevel.WARNING, message, category, context);
  }

  /**
   * 记录信息日志
   */
  info(message: string, category: string = 'app', context?: any): void {
    this.log(LogLevel.INFO, message, category, context);
  }

  /**
   * 记录调试日志
   */
  debug(message: string, category: string = 'app', context?: any): void {
    this.log(LogLevel.DEBUG, message, category, context);
  }

  /**
   * 获取日志条目列表
   */
  getEntries(filter?: LogFilter, limit?: number): LogEntry[] {
    let filteredEntries = [...this.logs];

    // 应用过滤器
    if (filter) {
      filteredEntries = filteredEntries.filter(entry => {
        // 级别过滤
        if (filter.level !== undefined && entry.level < filter.level) {
          return false;
        }

        // 类别过滤
        if (filter.category && !entry.category.includes(filter.category)) {
          return false;
        }

        // 时间范围过滤
        if (filter.startTime && entry.timestamp < filter.startTime) {
          return false;
        }

        if (filter.endTime && entry.timestamp > filter.endTime) {
          return false;
        }

        // 搜索词过滤
        if (filter.searchTerm) {
          const searchTerm = filter.searchTerm.toLowerCase();
          if (!entry.message.toLowerCase().includes(searchTerm)) {
            return false;
          }
        }

        return true;
      });
    }

    // 应用限制
    if (limit && limit > 0) {
      filteredEntries = filteredEntries.slice(0, limit);
    }

    return filteredEntries;
  }

  /**
   * 获取日志统计信息
   */
  getStats(): LogStats {
    if (this.logs.length === 0) {
      return {
        totalEntries: 0,
        errorCount: 0,
        warningCount: 0,
        infoCount: 0,
        debugCount: 0,
        categories: [],
      };
    }

    const stats: LogStats = {
      totalEntries: this.logs.length,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      debugCount: 0,
      categories: [],
    };

    const categoriesSet = new Set<string>();

    this.logs.forEach(entry => {
      switch (entry.level) {
        case LogLevel.ERROR:
          stats.errorCount++;
          break;
        case LogLevel.WARNING:
          stats.warningCount++;
          break;
        case LogLevel.INFO:
          stats.infoCount++;
          break;
        case LogLevel.DEBUG:
          stats.debugCount++;
          break;
      }

      categoriesSet.add(entry.category);
    });

    stats.categories = Array.from(categoriesSet);
    stats.oldestEntry = this.logs[this.logs.length - 1]?.timestamp;
    stats.newestEntry = this.logs[0]?.timestamp;

    return stats;
  }

  /**
   * 清除日志
   */
  clearLogs(before?: Date): number {
    const initialCount = this.logs.length;

    if (before) {
      this.logs = this.logs.filter(entry => entry.timestamp >= before);
    } else {
      this.logs = [];
    }

    return initialCount - this.logs.length;
  }

  /**
   * 导出日志
   */
  exportLogs(format: 'json' | 'csv' | 'txt', filter?: LogFilter): string {
    const entries = this.getEntries(filter);

    switch (format) {
      case 'json':
        return JSON.stringify(entries, null, 2);

      case 'csv':
        return this.exportToCsv(entries);

      case 'txt':
        return this.exportToText(entries);

      default:
        throw new Error(`不支持的导出格式: ${format}`);
    }
  }

  /**
   * 设置最大控制台输出级别
   */
  setMaxConsoleLevel(level: LogLevel): void {
    this.maxConsoleLevel = level;
  }

  /**
   * 设置最大日志条目数量
   */
  setMaxEntries(maxEntries: number): void {
    this.maxEntries = maxEntries;
    this.logs = this.logs.slice(0, maxEntries);
  }

  /**
   * 生成日志ID
   */
  private generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 输出到控制台
   */
  private outputToConsole(entry: LogEntry): void {
    if (entry.level > this.maxConsoleLevel) {
      return;
    }

    const timestamp = entry.timestamp.toISOString();
    const prefix = `[${timestamp}] [${entry.category}]`;

    switch (entry.level) {
      case LogLevel.ERROR:
        console.error(prefix, entry.message, entry.context);
        break;

      case LogLevel.WARNING:
        console.warn(prefix, entry.message, entry.context);
        break;

      case LogLevel.INFO:
        console.info(prefix, entry.message, entry.context);
        break;

      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
          console.debug(prefix, entry.message, entry.context);
        }
        break;
    }
  }

  /**
   * 上报错误到后端
   */
  private async reportErrorToBackend(entry: LogEntry): Promise<void> {
    try {
      // 这里可以发送错误报告到后端API
      // 由于我们移除了复杂的后端日志系统，这里简化处理
      console.warn('前端错误上报:', entry);

      // 可以发送到监控服务
      if (process.env.NODE_ENV === 'production') {
        // 生产环境可以发送到错误监控服务
        // 例如 Sentry, LogRocket 等
      }
    } catch (error) {
      console.error('错误上报失败:', error);
    }
  }

  /**
   * 设置全局错误处理器
   */
  private setupGlobalErrorHandlers(): void {
    // 监听 JavaScript 错误
    window.addEventListener('error', (event) => {
      this.error(
        `JavaScript错误: ${event.message}`,
        'javascript',
        {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          error: event.error,
        }
      );
    });

    // 监听资源加载错误
    window.addEventListener('error', (event) => {
      if (event.target && (event.target as Element).tagName) {
        const element = event.target as Element;
        this.error(
          `资源加载失败: ${element.tagName}${element.getAttribute('src') ? ` (${element.getAttribute('src')})` : ''}`,
          'resource',
          {
            tagName: element.tagName,
            source: element.getAttribute('src') || element.getAttribute('href'),
          }
        );
      }
    }, true);
  }

  /**
   * 设置未处理的Promise拒绝处理器
   */
  private setupUnhandledRejectionHandler(): void {
    window.addEventListener('unhandledrejection', (event) => {
      this.error(
        `未处理的Promise拒绝: ${event.reason}`,
        'promise',
        {
          reason: event.reason,
          promise: event.promise,
        }
      );
    });
  }

  /**
   * 导出为CSV格式
   */
  private exportToCsv(entries: LogEntry[]): string {
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'Context', 'URL'];
    const rows = [headers.join(',')];

    entries.forEach(entry => {
      const row = [
        entry.timestamp.toISOString(),
        LogLevel[entry.level],
        entry.category,
        `"${entry.message.replace(/"/g, '""')}"`,
        `"${JSON.stringify(entry.context || {}).replace(/"/g, '""')}"`,
        entry.url,
      ];
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * 导出为文本格式
   */
  private exportToText(entries: LogEntry[]): string {
    return entries.map(entry => {
      const contextStr = entry.context
        ? `\n  Context: ${JSON.stringify(entry.context, null, 2)}`
        : '';

      const stackStr = entry.stackTrace
        ? `\n  Stack Trace:\n${entry.stackTrace}`
        : '';

      return `[${entry.timestamp.toISOString()}] [${LogLevel[entry.level]}] [${entry.category}] ${entry.message}${contextStr}${stackStr}`;
    }).join('\n\n');
  }
}

// 导出单例实例
export const logger = Logger.getInstance();

// 便捷的导出函数
export const logError = (message: string, category?: string, context?: any) =>
  logger.error(message, category || 'app', context);

export const logWarning = (message: string, category?: string, context?: any) =>
  logger.warning(message, category || 'app', context);

export const logInfo = (message: string, category?: string, context?: any) =>
  logger.info(message, category || 'app', context);

export const logDebug = (message: string, category?: string, context?: any) =>
  logger.debug(message, category || 'app', context);

// React Hook
export const useLogger = () => {
  return {
    error: logError,
    warning: logWarning,
    info: logInfo,
    debug: logDebug,
    getEntries: logger.getEntries.bind(logger),
    getStats: logger.getStats.bind(logger),
    clearLogs: logger.clearLogs.bind(logger),
    exportLogs: logger.exportLogs.bind(logger),
  };
};

export default logger;