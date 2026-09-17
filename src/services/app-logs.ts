export type AppLogLevel = "log" | "info" | "warn" | "error" | "debug";

export interface AppLogEntry {
  id: string;
  level: AppLogLevel;
  message: string;
  context?: string;
  timestamp: number;
}

const MAX_LOG_ENTRIES = 100;
const listeners = new Set<(entries: AppLogEntry[]) => void>();
let entries: AppLogEntry[] = [];
let globalCaptureInitialized = false;

function notify() {
  const snapshot = [...entries];
  listeners.forEach((listener) => listener(snapshot));
}

function toSafeContext(context?: unknown) {
  if (context === undefined) return undefined;
  if (typeof context === "string") return context;
  try {
    return JSON.stringify(context);
  } catch {
    return String(context);
  }
}

function pushLog(level: AppLogLevel, message: string, context?: unknown) {
  const entry: AppLogEntry = {
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    level,
    message,
    context: toSafeContext(context),
    timestamp: Date.now(),
  };

  entries = [...entries.slice(-(MAX_LOG_ENTRIES - 1)), entry];
  notify();
}

export function addAppLog(level: AppLogLevel, message: string, context?: unknown) {
  pushLog(level, message, context);
}

export function getAppLogs(): AppLogEntry[] {
  return [...entries];
}

export function clearAppLogs() {
  entries = [];
  notify();
}

export function subscribeAppLogs(listener: (entries: AppLogEntry[]) => void) {
  listeners.add(listener);
  listener([...entries]);
  return () => {
    listeners.delete(listener);
  };
}

export function initializeGlobalLogCapture() {
  if (globalCaptureInitialized || typeof window === "undefined") return;
  globalCaptureInitialized = true;

  const originalConsole = {
    log: console.log.bind(console),
    info: console.info.bind(console),
    warn: console.warn.bind(console),
    error: console.error.bind(console),
    debug: (console.debug || console.log).bind(console),
  };

  const patch = (level: AppLogLevel, original: (...args: unknown[]) => void) => {
    return (...args: unknown[]) => {
      original(...args);
      const [first, ...rest] = args;
      const message = typeof first === "string" ? first : "(non-string console message)";
      pushLog(level, message, rest.length ? rest : undefined);
    };
  };

  // Full console mirroring is useful in preview, but copying every production
  // log allocates arrays/strings during startup and interaction. Production
  // keeps only warnings/errors for the in-app diagnostics screen.
  if (import.meta.env.DEV) {
    console.log = patch("log", originalConsole.log);
    console.info = patch("info", originalConsole.info);
    console.debug = patch("debug", originalConsole.debug);
  }
  console.warn = patch("warn", originalConsole.warn);
  console.error = patch("error", originalConsole.error);
}
