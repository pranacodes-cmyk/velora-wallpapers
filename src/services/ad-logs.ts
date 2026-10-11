/**
 * In-app log buffer for diagnosing AdMob ↔ Vungle (Liftoff) mediation.
 * Persists to localStorage so logs survive ad fullscreen / app resume.
 */
const KEY = "jw_ad_logs_v1";
const MAX = 300;

export type AdLog = {
  t: number; // timestamp
  tag: string; // category, e.g. "INIT", "INT", "REW"
  msg: string;
  data?: any;
};

function load(): AdLog[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(logs: AdLog[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(logs.slice(-MAX)));
  } catch {}
}

export function adLog(tag: string, msg: string, data?: any) {
  const entry: AdLog = { t: Date.now(), tag, msg, data: safeData(data) };
  const logs = load();
  logs.push(entry);
  save(logs);
  try {
    // eslint-disable-next-line no-console
    console.log(`[AD:${tag}] ${msg}`, data ?? "");
  } catch {}
  try {
    window.dispatchEvent(new CustomEvent("jw:ad-log", { detail: entry }));
  } catch {}
}

function safeData(d: any) {
  if (d === undefined || d === null) return undefined;
  try {
    if (d instanceof Error) return { name: d.name, message: d.message, stack: d.stack };
    // strip non-serializable
    return JSON.parse(JSON.stringify(d));
  } catch {
    try { return String(d); } catch { return undefined; }
  }
}

export function getAdLogs(): AdLog[] {
  return load();
}

export function clearAdLogs() {
  try { localStorage.removeItem(KEY); } catch {}
  try { window.dispatchEvent(new CustomEvent("jw:ad-log-cleared")); } catch {}
}
