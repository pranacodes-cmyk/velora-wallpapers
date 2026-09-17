/**
 * Blame-level performance attribution.
 *
 * The existing jank metrics only told us WHICH SCREEN stalled, never which
 * code did it. Three complementary sources are used here, all native browser
 * APIs (no polling, no rAF loops):
 *
 *  1. Long Animation Frames (LoAF, Chromium 123+/Android WebView) — gives the
 *     blocking duration of a frame PLUS the scripts that ran in it, with
 *     source URL, function name and the invoker (listener, timer, promise).
 *     This is the only API that names the culprit function.
 *  2. Event Timing — slow interactions with the actual DOM target, so we know
 *     which button/card the user tapped when the app froze.
 *  3. Explicit named work spans (`timeWork` / `useRenderCost`) placed around
 *     suspected-heavy sections, so even minified stacks map to a human label.
 *
 * Everything is capped per session so a bad device can never spam PostHog.
 */
import { useLayoutEffect } from "react";
import { track } from "./analytics";
import { getDeviceProfile } from "./perf";

const MAX_LOAF_EVENTS = 6;
const MAX_INTERACTION_EVENTS = 6;
const MAX_WORK_EVENTS = 10;
/** Only frames that block the main thread this long are worth a datapoint. */
const LOAF_BLOCKING_MS = 250;
/** Interactions slower than this are felt as a freeze. */
const SLOW_INTERACTION_MS = 300;
/** Named work spans slower than this get reported. */
const SLOW_WORK_MS = 120;

let loafSent = 0;
let interactionsSent = 0;
let workSent = 0;
let started = false;

/** Label of the work currently running, attached to any stall we observe. */
let currentWork: string | null = null;
let lastWork: string | null = null;

function baseName(url?: string | null) {
  if (!url) return null;
  try {
    const u = url.split("?")[0];
    return u.slice(u.lastIndexOf("/") + 1) || u;
  } catch {
    return url;
  }
}

function selectorFor(el: Element | null | undefined): string | null {
  if (!el) return null;
  try {
    const tag = el.tagName.toLowerCase();
    const label = el.getAttribute("aria-label") || el.getAttribute("data-perf") || null;
    const id = el.id ? `#${el.id}` : "";
    const cls = (el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 3).join(".")
      : "");
    const text = (el.textContent || "").trim().slice(0, 32);
    return `${tag}${id}${cls}${label ? `[${label}]` : ""}${text ? `{${text}}` : ""}`.slice(0, 160);
  } catch {
    return null;
  }
}

function context() {
  let lastAction: string | null = null;
  try { lastAction = localStorage.getItem("anr_last_action"); } catch {}
  return {
    route: location.pathname,
    last_action: lastAction,
    current_work: currentWork,
    last_work: lastWork,
    since_load_ms: Math.round(performance.now()),
  };
}

/**
 * Wrap a synchronous chunk of work with a human-readable label. The label is
 * attached to any stall observed while it runs, and the span itself is reported
 * when it is slow.
 */
export function timeWork<T>(label: string, fn: () => T): T {
  const prev = currentWork;
  currentWork = label;
  const t0 = performance.now();
  try {
    return fn();
  } finally {
    const ms = performance.now() - t0;
    currentWork = prev;
    lastWork = label;
    reportWork(label, ms);
  }
}

/** Async variant — spans a whole await chain (e.g. canvas encode). */
export async function timeWorkAsync<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const prev = currentWork;
  currentWork = label;
  const t0 = performance.now();
  try {
    return await fn();
  } finally {
    currentWork = prev;
    lastWork = label;
    reportWork(label, performance.now() - t0);
  }
}

export function reportWork(label: string, ms: number, extra?: Record<string, unknown>) {
  if (!Number.isFinite(ms) || ms < SLOW_WORK_MS) return;
  if (workSent >= MAX_WORK_EVENTS) return;
  workSent++;
  try {
    track("perf_slow_work", {
      work: label,
      duration_ms: Math.round(ms),
      ...extra,
      ...context(),
      ...getDeviceProfile(),
    });
  } catch {}
}

/**
 * React hook: measures the real cost of rendering a section (its own render +
 * all children, up to layout commit) and reports it when slow. Cheap enough to
 * leave in production — two performance.now() calls per render.
 */
export function useRenderCost(section: string) {
  const t0 = performance.now();
  useLayoutEffect(() => {
    reportWork(`render:${section}`, performance.now() - t0, { section });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

export function initPerfAttribution() {
  if (started) return;
  started = true;

  // 1. Long Animation Frames — the only source that names the blocking script.
  try {
    const supported: string[] = (PerformanceObserver as any).supportedEntryTypes || [];
    if (supported.includes("long-animation-frame")) {
      const po = new PerformanceObserver((list) => {
        for (const raw of list.getEntries()) {
          const e = raw as any;
          const blocking = Math.round(e.blockingDuration ?? 0);
          if (blocking < LOAF_BLOCKING_MS) continue;
          if (loafSent >= MAX_LOAF_EVENTS) return;
          loafSent++;
          const scripts = (e.scripts || [])
            .slice()
            .sort((a: any, b: any) => (b.duration ?? 0) - (a.duration ?? 0))
            .slice(0, 3);
          const top = scripts[0];
          track("perf_block_attribution", {
            blocking_ms: blocking,
            frame_duration_ms: Math.round(e.duration ?? 0),
            render_ms: e.renderStart ? Math.round(e.startTime + e.duration - e.renderStart) : null,
            style_layout_ms: e.styleAndLayoutStart
              ? Math.round(e.startTime + e.duration - e.styleAndLayoutStart)
              : null,
            // Named culprit
            top_source: baseName(top?.sourceURL),
            top_function: top?.sourceFunctionName || null,
            top_invoker: top?.invoker || null,
            top_invoker_type: top?.invokerType || null,
            top_script_ms: top ? Math.round(top.duration ?? 0) : null,
            top_forced_style_layout_ms: top ? Math.round(top.forcedStyleAndLayoutDuration ?? 0) : null,
            scripts: scripts
              .map(
                (s: any) =>
                  `${baseName(s.sourceURL)}:${s.sourceFunctionName || "?"}:${s.invokerType || "?"}:${Math.round(
                    s.duration ?? 0
                  )}ms`
              )
              .join(" | "),
            ...context(),
            ...getDeviceProfile(),
          });
        }
      });
      po.observe({ type: "long-animation-frame", buffered: true } as any);
    }

    // 2. Event Timing — which element the user touched when it froze.
    if (supported.includes("event")) {
      const po2 = new PerformanceObserver((list) => {
        for (const raw of list.getEntries()) {
          const e = raw as any;
          const dur = Math.round(e.duration ?? 0);
          if (dur < SLOW_INTERACTION_MS) continue;
          if (interactionsSent >= MAX_INTERACTION_EVENTS) return;
          interactionsSent++;
          track("perf_slow_interaction", {
            event_name: e.name,
            duration_ms: dur,
            input_delay_ms: Math.round((e.processingStart ?? e.startTime) - e.startTime),
            processing_ms: Math.round((e.processingEnd ?? 0) - (e.processingStart ?? 0)),
            presentation_ms: Math.round(
              e.startTime + e.duration - (e.processingEnd ?? e.startTime)
            ),
            target: selectorFor(e.target),
            ...context(),
            ...getDeviceProfile(),
          });
        }
      });
      po2.observe({ type: "event", buffered: true, durationThreshold: SLOW_INTERACTION_MS } as any);
    }
  } catch {}
}
