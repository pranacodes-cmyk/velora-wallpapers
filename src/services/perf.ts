/**
 * Lightweight performance + error instrumentation for PostHog.
 *
 * Design rules (Android WebView / low-end devices):
 *  - No polling, no rAF loops. Only native browser APIs that are already
 *    collecting the data (PerformanceObserver, paint entries).
 *  - One event per session per metric — never per frame.
 *  - Every call is wrapped in try/catch: perf tracking must never break the app.
 */
import { track, setUserProps } from "./analytics";

export interface DeviceProfile {
  device_memory_gb: number | null;
  cpu_cores: number | null;
  dpr: number;
  screen_w: number;
  screen_h: number;
  low_end_device: boolean;
  /** True when the app is running its reduced-effects CSS mode (all Android). */
  perf_lite_mode: boolean;
  net_type: string | null;
  save_data: boolean | null;
}

export function getDeviceProfile(): DeviceProfile {
  const nav: any = typeof navigator !== "undefined" ? navigator : {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
  const mem = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
  const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;
  // Hardware-only classification. We deliberately do NOT read the
  // `.low-end-device` CSS class here: that class is applied to every Android
  // device as a blanket ANR-safety measure, which made 100% of reported
  // sessions look "low end" and destroyed the usefulness of this dimension.
  const lowEnd = (mem !== null && mem <= 3) || (cores !== null && cores <= 4);

  return {
    device_memory_gb: mem,
    cpu_cores: cores,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    screen_w: window.screen?.width ?? window.innerWidth,
    screen_h: window.screen?.height ?? window.innerHeight,
    low_end_device: !!lowEnd,
    perf_lite_mode:
      typeof document !== "undefined" &&
      document.documentElement.classList.contains("low-end-device"),
    net_type: conn?.effectiveType ?? null,
    save_data: typeof conn?.saveData === "boolean" ? conn.saveData : null,
  };
}

function paintTime(name: string): number | null {
  try {
    const entry = performance.getEntriesByName(name, "paint")[0] as PerformanceEntry | undefined;
    return entry ? Math.round(entry.startTime) : null;
  } catch {
    return null;
  }
}

let coldStartSent = false;
const PERF_STATE_KEY = "prayly_perf_pending_v2";
const SESSION_ID = `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
let previousSession: Record<string, unknown> | null = null;

function persistSession(extra?: Record<string, unknown>) {
  try {
    const current = {
      session_id: SESSION_ID,
      started_at: Date.now() - Math.round(performance.now()),
      updated_at: Date.now(),
      route: location.pathname,
      long_task_count: longTaskCount,
      long_task_total_ms: Math.round(longTaskTotal),
      long_task_max_ms: Math.round(longTaskMax),
      graceful: false,
      ...extra,
    };
    localStorage.setItem(PERF_STATE_KEY, JSON.stringify(current));
  } catch {}
}

/** Call from a screen when its real above-the-fold content is committed. */
export function markContentReady(screen: string, props?: Record<string, unknown>) {
  const ms = Math.round(performance.now());
  track("perf_content_ready", { screen, duration_ms: ms, ...props, ...getDeviceProfile() });
  persistSession({ content_ready_screen: screen, content_ready_ms: ms });
}

/** WebView boot → first paint. Fired once, right after analytics is ready. */
export function trackColdStart() {
  if (coldStartSent) return;
  coldStartSent = true;
  try {
    const navEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    track("perf_cold_start", {
      first_paint_ms: paintTime("first-paint"),
      first_contentful_paint_ms: paintTime("first-contentful-paint"),
      dom_content_loaded_ms: navEntry ? Math.round(navEntry.domContentLoadedEventEnd) : null,
      dom_interactive_ms: navEntry ? Math.round(navEntry.domInteractive) : null,
      load_event_ms: navEntry && navEntry.loadEventEnd ? Math.round(navEntry.loadEventEnd) : null,
      transfer_size: navEntry ? navEntry.transferSize ?? null : null,
      native_boot_to_webview_ms:
        typeof (window as any).__PRAYLY_NATIVE_BOOT_MS === "number"
          ? Math.round((window as any).__PRAYLY_NATIVE_BOOT_MS)
          : null,
      ...getDeviceProfile(),
    });
  } catch {}
}

/** Per-screen mount duration (first render of a route). */
export function trackRouteMount(route: string, ms: number) {
  if (!Number.isFinite(ms)) return;
  track("perf_route_mount", {
    route,
    duration_ms: Math.round(ms),
    slow: ms > 1200,
  });
}

/**
 * Long tasks = main-thread blocks > 50ms. These are the same stalls that turn
 * into ANRs on Android, so we aggregate them and flush a single summary when
 * the session ends / the app is backgrounded.
 */
let longTaskCount = 0;
let longTaskTotal = 0;
let longTaskMax = 0;
let longTaskDropped = 0;
let jankFlushed = false;
/** Worst stalls of the session, with the screen they happened on. */
let worstTasks: Array<{ ms: number; at: number; route: string }> = [];
/** Severe stalls (the ones users feel as a freeze) are reported immediately. */
const SEVERE_STALL_MS = 800;
let severeReported = 0;
const MAX_SEVERE_EVENTS = 5;

function stallContext(e: PerformanceEntry) {
  let lastAction: string | null = null;
  try { lastAction = localStorage.getItem("anr_last_action"); } catch {}
  return {
    stall_ms: Math.round(e.duration),
    since_load_ms: Math.round(e.startTime),
    route: location.pathname,
    last_action: lastAction,
    cold_start_phase: e.startTime < 5000,
  };
}


// Android WebView reports ONE giant "longtask" that spans the whole period the
// app spent backgrounded/frozen (we measured 676,889 ms). Those are not
// main-thread stalls a user ever felt, but they destroyed this metric: every
// session looked like an ANR risk. Anything longer than this ceiling is a
// freeze artifact, not jank.
const LONG_TASK_CEILING_MS = 5000;

function flushJank(reason: string) {
  if (jankFlushed || longTaskCount === 0) return;
  jankFlushed = true;
  const top = worstTasks.slice(0, 3);
  track("perf_main_thread_jank", {
    reason,
    long_task_count: longTaskCount,
    long_task_total_ms: Math.round(longTaskTotal),
    long_task_max_ms: Math.round(longTaskMax),
    // Freeze artifacts we intentionally discarded, kept as a sanity dimension.
    long_task_dropped: longTaskDropped,
    anr_risk: longTaskMax > 1000,
    // Attribution: WHERE the worst stalls happened. Without this the metric
    // only told us a session was slow, never which screen to fix.
    worst_route: top[0]?.route ?? null,
    worst_since_load_ms: top[0] ? Math.round(top[0].at) : null,
    worst_tasks: top.map((t) => `${t.route}:${Math.round(t.ms)}ms@${Math.round(t.at)}`).join(","),
    ...getDeviceProfile(),
  });
}

let started = false;

export function initPerf() {
  if (started) return;
  started = true;

  try {
    const raw = localStorage.getItem(PERF_STATE_KEY);
    previousSession = raw ? JSON.parse(raw) : null;
  } catch { previousSession = null; }
  if (previousSession && previousSession.graceful !== true) {
    track("perf_previous_abnormal_exit", {
      ...previousSession,
      last_route: localStorage.getItem("anr_last_route"),
      last_route_ts: Number(localStorage.getItem("anr_last_route_ts")) || null,
      last_action: localStorage.getItem("anr_last_action"),
      last_action_ts: Number(localStorage.getItem("anr_last_action_ts")) || null,
      ...getDeviceProfile(),
    });
  }
  persistSession();

  try {
    setUserProps(getDeviceProfile() as unknown as Record<string, any>);
  } catch {}

  trackColdStart();

  try {
    if ("PerformanceObserver" in window) {
      const supported = (PerformanceObserver as any).supportedEntryTypes || [];
      if (supported.includes("longtask")) {
        const po = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            // Discard background-freeze artifacts (see LONG_TASK_CEILING_MS)
            // and anything recorded while the app was not on screen.
            if (e.duration > LONG_TASK_CEILING_MS || document.visibilityState === "hidden") {
              longTaskDropped++;
              continue;
            }
            longTaskCount++;
            longTaskTotal += e.duration;
            if (e.duration > longTaskMax) longTaskMax = e.duration;
            if (e.duration >= 200) {
              worstTasks.push({ ms: e.duration, at: e.startTime, route: location.pathname });
              worstTasks.sort((a, b) => b.ms - a.ms);
              worstTasks = worstTasks.slice(0, 5);
              // Persist meaningful stalls; this survives an ANR/process kill
              // and is uploaded on the next successful launch.
              persistSession({ worst_route: worstTasks[0]?.route ?? null });
            }
            // A stall this long is a visible freeze and the direct precursor of
            // an ANR — report it right away with the screen + last user action,
            // instead of waiting for the app to be backgrounded (which never
            // happens if the process gets killed).
            if (e.duration >= SEVERE_STALL_MS && severeReported < MAX_SEVERE_EVENTS) {
              severeReported++;
              track("perf_severe_stall", { ...stallContext(e), ...getDeviceProfile() });
            }
          }
        });
        po.observe({ type: "longtask", buffered: true } as any);
      }
    }
  } catch {}

  // Blame-level attribution (LoAF + Event Timing + named work spans).
  // Dynamically imported so this module stays free of import cycles.
  import("./perf-attribution").then((m) => m.initPerfAttribution()).catch(() => {});

  const flush = () => {
    flushJank(document.visibilityState === "hidden" ? "hidden" : "pagehide");
    persistSession({ graceful: true, ended_at: Date.now() });
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
    else persistSession({ graceful: false, resumed_at: Date.now() });
  });
  window.addEventListener("pagehide", flush);
}
