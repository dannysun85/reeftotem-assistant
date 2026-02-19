type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  scope: string;
  message: string;
  data?: unknown[];
}

const appVersion = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'unknown';
const isPreRelease = appVersion.includes('-');
const isVerboseLogging = import.meta.env.DEV || isPreRelease;
const maxLogEntries = 2000;

let initialized = false;
let rawConsole: Pick<Console, 'log' | 'info' | 'debug' | 'warn' | 'error'> | null = null;
const logBuffer: LogEntry[] = [];
let tauriEventModule: Promise<typeof import('@tauri-apps/api/event')> | null = null;
const isTauri = typeof window !== 'undefined' && (
  '__TAURI__' in window ||
  '__TAURI_INTERNALS__' in window ||
  '__TAURI_METADATA__' in window
);
let fetchWrapped = false;

const getTimestamp = () => new Date().toISOString();

const shouldLog = (level: LogLevel) =>
  isVerboseLogging || level === 'warn' || level === 'error' || level === 'info';

const pushEntry = (entry: LogEntry) => {
  logBuffer.push(entry);
  if (logBuffer.length > maxLogEntries) {
    logBuffer.splice(0, logBuffer.length - maxLogEntries);
  }

  if (typeof window !== 'undefined') {
    (window as any).__APP_LOGS__ = logBuffer;
  }
};

const emitFrontendLog = (entry: LogEntry) => {
  if (!isVerboseLogging || !isTauri) return;
  if (!tauriEventModule) {
    tauriEventModule = import('@tauri-apps/api/event');
  }

  void tauriEventModule
    .then(({ emit }) => emit('frontend_log', entry))
    .catch(() => {
      // Ignore forwarding failures.
    });
};

const formatArgs = (args: unknown[]) =>
  args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

const writeLog = (
  level: LogLevel,
  scope: string,
  message: string,
  data?: unknown[],
  consoleArgs?: unknown[]
) => {
  const timestamp = getTimestamp();
  pushEntry({
    timestamp,
    level,
    scope,
    message,
    data
  });
  emitFrontendLog({
    timestamp,
    level,
    scope,
    message,
    data
  });

  if (!rawConsole || !shouldLog(level)) return;

  const prefix = `[${timestamp}] [${appVersion}] [${level.toUpperCase()}] [${scope}]`;
  const outputArgs = consoleArgs ?? (data && data.length > 0 ? [message, ...data] : [message]);
  const method = rawConsole[level] ?? rawConsole.log;
  method(prefix, ...outputArgs);
};

export const initializeLogger = (scope = 'app') => {
  if (initialized) return;
  initialized = true;

  rawConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    debug: console.debug.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console)
  };

  console.log = (...args: unknown[]) => {
    writeLog('info', 'console', formatArgs(args), args, args);
  };
  console.info = (...args: unknown[]) => {
    writeLog('info', 'console', formatArgs(args), args, args);
  };
  console.debug = (...args: unknown[]) => {
    writeLog('debug', 'console', formatArgs(args), args, args);
  };
  console.warn = (...args: unknown[]) => {
    writeLog('warn', 'console', formatArgs(args), args, args);
  };
  console.error = (...args: unknown[]) => {
    writeLog('error', 'console', formatArgs(args), args, args);
  };

  if (typeof window !== 'undefined' && typeof window.fetch === 'function' && !fetchWrapped) {
    fetchWrapped = true;
    const originalFetch = window.fetch.bind(window);

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
      const shouldTrace =
        isVerboseLogging &&
        (url.includes('/assets/live2d/') ||
          url.includes('live2dcubismcore') ||
          url.endsWith('.model3.json') ||
          url.endsWith('.moc3') ||
          url.endsWith('.physics3.json') ||
          url.endsWith('.pose3.json') ||
          url.endsWith('.motion3.json') ||
          url.endsWith('.exp3.json') ||
          url.endsWith('.png'));
      const start = performance.now();

      if (shouldTrace) {
        writeLog('debug', 'fetch', 'request', [{ url, method }]);
      }

      try {
        const response = await originalFetch(input, init);
        if (shouldTrace) {
          writeLog(response.ok ? 'debug' : 'warn', 'fetch', 'response', [
            {
              url,
              status: response.status,
              ok: response.ok,
              durationMs: Math.round(performance.now() - start)
            }
          ]);
        }
        return response;
      } catch (error) {
        if (shouldTrace) {
          writeLog('error', 'fetch', 'failed', [
            {
              url,
              method,
              durationMs: Math.round(performance.now() - start),
              error: error instanceof Error ? error.message : String(error)
            }
          ]);
        }
        throw error;
      }
    };
  }

  writeLog(
    'info',
    scope,
    'Logger initialized',
    [
      {
        appVersion,
        mode: import.meta.env.MODE,
        baseUrl: import.meta.env.BASE_URL || '/',
        verbose: isVerboseLogging,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
        href: typeof window !== 'undefined' ? window.location.href : 'unknown'
      }
    ]
  );

  if (typeof window !== 'undefined') {
    (window as any).__APP_LOG_CONFIG__ = {
      appVersion,
      mode: import.meta.env.MODE,
      baseUrl: import.meta.env.BASE_URL || '/',
      verbose: isVerboseLogging
    };

    window.addEventListener('error', (event) => {
      writeLog('error', 'window', 'error', [
        {
          message: event.message,
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error instanceof Error ? event.error.stack : undefined
        }
      ]);
    });

    window.addEventListener('unhandledrejection', (event) => {
      writeLog('error', 'window', 'unhandledrejection', [
        {
          reason: event.reason instanceof Error ? event.reason.stack : event.reason
        }
      ]);
    });
  }
};

export const createLogger = (scope: string) => ({
  trace: (message: string, ...data: unknown[]) => writeLog('trace', scope, message, data),
  debug: (message: string, ...data: unknown[]) => writeLog('debug', scope, message, data),
  info: (message: string, ...data: unknown[]) => writeLog('info', scope, message, data),
  warn: (message: string, ...data: unknown[]) => writeLog('warn', scope, message, data),
  error: (message: string, ...data: unknown[]) => writeLog('error', scope, message, data)
});

export const getLogSnapshot = () => [...logBuffer];

export const getLogMeta = () => ({
  appVersion,
  isPreRelease,
  verbose: isVerboseLogging,
  mode: import.meta.env.MODE,
  baseUrl: import.meta.env.BASE_URL || '/'
});
