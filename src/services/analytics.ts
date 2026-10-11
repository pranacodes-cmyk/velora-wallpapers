/**
 * PostHog analytics wrapper for Prayly.
 *
 * Public project token — safe to commit (PostHog's `phc_...` keys are
 * write-only / public-app safe per their docs).
 *
 * Use `track("event_name", { ...props })` from anywhere in the app.
 */
// posthog-js is ~200 KB of JS. A static import here pulled it into the eager
// startup chunk (every screen imports `track`), so Android cold start had to
// download + parse it before first paint. Load it lazily instead: every public
// helper below already no-ops until `initialized`, so behaviour is unchanged.
type PostHog = typeof import("posthog-js")["default"];
let posthog: PostHog = null as unknown as PostHog;

const POSTHOG_KEY = "phc_pPcqndZ2eNEGuMjjCcrMoWtRjLufyyiphm5QEjn5HAiq";
const POSTHOG_HOST = "https://us.i.posthog.com";

let initialized = false;
let initStarted = false;
const pendingEvents: Array<{ event: string; props?: Record<string, any> }> = [];
const MAX_PENDING_EVENTS = 40;

function flushPendingEvents() {
  if (!initialized) return;
  for (const item of pendingEvents.splice(0)) {
    try { posthog.capture(item.event, item.props); } catch {}
  }
}

/**
 * Emulator / install-farm fingerprint detection.
 *
 * A US install farm running a spoofed "OnePlus8Pro" (Android 10 build
 * QKR1.191246.002, 435x725 viewport, 4 GB RAM) has been hammering the app
 * with fake installs. They never buy and never retain, so they poison every
 * funnel and retention number. We keep capturing their events — useful to see
 * the farm's activity — but tag every one with `is_bot: true` so dashboards
 * and insights can filter them out permanently.
 */
function detectBotFingerprint(): { is_bot: boolean; bot_reason?: string } {
  try {
    const ua = navigator.userAgent || "";
    const nav = navigator as any;
    const w = window.screen?.width ?? 0;
    const h = window.screen?.height ?? 0;

    // 1. The exact spoofed build string the farm ships.
    if (/QKR1\.191246/.test(ua)) return { is_bot: true, bot_reason: "spoofed_build" };

    // 2. A "OnePlus 8 Pro" that reports impossible specs (real one has 8-12 GB
    //    RAM and a 1440x3168 panel).
    if (/OnePlus8Pro/i.test(ua)) {
      const lowRam = typeof nav.deviceMemory === "number" && nav.deviceMemory <= 4;
      const smallPanel = Math.max(w, h) > 0 && Math.max(w, h) < 900;
      if (lowRam || smallPanel) return { is_bot: true, bot_reason: "impossible_specs" };
    }

    // 3. Generic headless / automation signals.
    if (nav.webdriver === true) return { is_bot: true, bot_reason: "webdriver" };
    if (/HeadlessChrome|PhantomJS|Puppeteer|sdk_gphone|Android SDK built for/i.test(ua)) {
      return { is_bot: true, bot_reason: "emulator_ua" };
    }
  } catch {}
  return { is_bot: false };
}

export async function initAnalytics() {
  if (initialized || initStarted) return;
  if (typeof window === "undefined") return;
  initStarted = true;
  try {
    posthog = (await import("posthog-js")).default;

    const isNative =
      typeof (window as any).Capacitor !== "undefined" &&
      (window as any).Capacitor?.isNativePlatform?.();
    const lowEnd = document.documentElement.classList.contains("low-end-device");
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      person_profiles: "identified_only",
      capture_pageview: true,
      capture_pageleave: true,
      // Android WebView ANRs spiked after analytics work. Keep explicit events,
      // but avoid DOM autocapture/replay recorder overhead on native/low-end.
      autocapture: !isNative && !lowEnd,
      session_recording: {
        maskAllInputs: false,
      },
      disable_session_recording: isNative || lowEnd,
      // Error tracking: unhandled errors + promise rejections land in PostHog
      // as $exception events (was previously off, so we had zero visibility).
      capture_exceptions: true,
      // Core Web Vitals (LCP/CLS/INP/FCP) — skipped on low-end devices where
      // the observer overhead is not worth it.
      capture_performance: lowEnd ? false : { web_vitals: true, network_timing: false },
      // PostHog lazily downloads + evaluates extra remote scripts. Startup
      // profiling on a 6x-throttled device measured surveys.js at ~550 ms of
      // main-thread work — and we do not use PostHog surveys at all.
      disable_surveys: true,

      loaded: (ph) => {
        // Tag the install with a stable anonymous device id so we can
        // group sessions per device even before login.
        try {
          const KEY = "cw_device_id";
          let id = localStorage.getItem(KEY);
          let isFirstOpen = false;
          if (!id) {
            id = crypto.randomUUID();
            localStorage.setItem(KEY, id);
            isFirstOpen = true;
          }
          const platform = isNative ? "android-native" : "web";
          const bot = detectBotFingerprint();
          ph.register({
            device_id: id,
            app: "Prayly",
            platform,
            is_bot: bot.is_bot,
            ...(bot.bot_reason ? { bot_reason: bot.bot_reason } : {}),
          });
          ph.identify(id);

          if (isFirstOpen) {
            ph.capture("app_first_open", { platform });
          }
          ph.capture("session_start", {
            platform,
            onboarded: localStorage.getItem("cw_onboarded_v3") === "true",
            is_premium: localStorage.getItem("cw_premium_unlocked") === "true",
          });
        } catch {}
      },
    });
    initialized = true;
    flushPendingEvents();
    // Version context may have been resolved before PostHog finished loading.
    flushVersionContext();
    flushLangContext();
    // Performance instrumentation (cold start, route mounts, main-thread jank).
    // Dynamic import keeps this out of the analytics chunk's critical path and
    // avoids a circular module init.
    import("./perf").then((m) => m.initPerf()).catch(() => {});
  } catch (e) {
    // never let analytics break the app
  }
}

/** Report a handled error to PostHog error tracking. */
export function captureError(error: unknown, props?: Record<string, any>) {
  try {
    if (!initialized) return;
    const err = error instanceof Error ? error : new Error(String(error));
    (posthog as any).captureException?.(err, props);
  } catch {}
}



/**
 * Release-health context: which native build and which JS bundle are actually
 * running on this device, plus a status flag so a version mismatch is visible
 * in PostHog instead of only in crash reports.
 *
 * Statuses:
 *   builtin   – running the JS shipped inside the store build (expected)
 *   ota       – running a newer OTA bundle on top of it (expected)
 *   mismatch  – running a bundle that is NOT newer than the native build
 *               (should be impossible; means the OTA guard was bypassed)
 *   unknown   – native version could not be read
 */
export interface VersionContext {
  native_version: string | null;
  native_build: string | null;
  ota_version: string | null;
  version_status: "builtin" | "ota" | "mismatch" | "unknown";
}

let pendingVersionContext: VersionContext | null = null;
let versionContextSent = false;

function flushVersionContext() {
  if (!initialized || versionContextSent || !pendingVersionContext) return;
  try {
    posthog.register({ ...pendingVersionContext });
    posthog.capture("app_version_status", { ...pendingVersionContext });
    versionContextSent = true;
  } catch {}
}

export function setVersionContext(ctx: VersionContext) {
  pendingVersionContext = ctx;
  flushVersionContext();
}

/**
 * Registers the active UI language as a PostHog super property so every event
 * (paywalls, journeys, quiz, purchases…) can be segmented per language.
 * Safe to call before init — the value is re-applied once PostHog loads.
 */
let pendingLang: string | null = null;
export function setLangContext(lang: string) {
  pendingLang = lang;
  try {
    if (!initialized) return;
    posthog.register({ app_lang: lang });
  } catch {}
}

function flushLangContext() {
  if (pendingLang) setLangContext(pendingLang);
}

export function track(event: string, props?: Record<string, any>) {
  try {
    if (!initialized) {
      // Preserve startup/content-ready/previous-exit diagnostics while the
      // heavy analytics SDK is intentionally loading after first paint.
      if (pendingEvents.length >= MAX_PENDING_EVENTS) pendingEvents.shift();
      pendingEvents.push({ event, props });
      return;
    }
    posthog.capture(event, props);
  } catch {}
}

export function identify(userId: string, props?: Record<string, any>) {
  try {
    if (!initialized) return;
    posthog.identify(userId, props);
  } catch {}
}

export function setUserProps(props: Record<string, any>) {
  try {
    if (!initialized) return;
    posthog.people?.set(props);
  } catch {}
}

export function resetAnalytics() {
  try {
    if (!initialized) return;
    posthog.reset();
  } catch {}
}
