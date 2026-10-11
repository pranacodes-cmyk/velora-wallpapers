// Restore theme before render to avoid flash
(function() {
  const saved = localStorage.getItem("cw-theme"); // "light" | "dark" | "system" | null
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldBeLight = saved === "light" || ((!saved || saved === "system") && !prefersDark);
  if (shouldBeLight) {
    document.documentElement.classList.add("light");
  } else {
    document.documentElement.classList.remove("light");
  }
})();

// Detect low-end devices to throttle expensive infinite animations and
// reduce render-thread back-pressure (root cause of HardwareRenderer
// nSyncAndDrawFrame ANRs on Itel A90 / Redmi 13C / low-RAM phones).
(function tagLowEndDevice() {
  try {
    const nav: any = navigator;
    const mem = typeof nav.deviceMemory === "number" ? nav.deviceMemory : null;
    const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : null;
    const ua = nav.userAgent || "";
    const isAndroid = /Android/i.test(ua);
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (isAndroid) document.documentElement.classList.add("android-device");
    document.documentElement.classList.add("startup-safe-mode");
    window.setTimeout(() => {
      document.documentElement.classList.remove("startup-safe-mode");
    }, 10_000);
    if (mem !== null && mem <= 4 || cores !== null && cores <= 6 || isAndroid || reduced) {
      document.documentElement.classList.add("low-end-device");
    }
  } catch {}
})();



import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializeGlobalLogCapture } from "./services/app-logs";
import { initI18n } from "./i18n";
import { initPerf } from "./services/perf";

// Dev-only stale-cache cleanup. Do not clear WebView caches on every production
// Android launch; it adds avoidable IO during cold start and hurts vitals.
if (import.meta.env.DEV) {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((reg) => void reg.unregister());
    });
  }
  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))));
  }
}

initializeGlobalLogCapture();
// Start the browser observers before React and before analytics loads. Events
// are buffered by the lightweight analytics wrapper, so early stalls are no
// longer missing from the data.
initPerf();

// One-shot full reset (dev/preview only): wipe all local/session app data so
// the preview starts fresh from onboarding. Bump the flag version to trigger again.
(function fullResetOnce() {
  if (!import.meta.env.DEV) return;
  const FLAG = "cw_dev_full_reset_v3";
  try {
    if (localStorage.getItem(FLAG)) return;
    localStorage.clear();
    sessionStorage.clear();
    localStorage.setItem(FLAG, "1");
  } catch {}
})();


// NOTE: We intentionally do NOT preload an interstitial at app startup.
// Most sessions never reach the swipe-7 trigger, so startup preloads turned
// into ~99% wasted ad requests (1,137 requests → 7 impressions historically).
// Interstitials are now warmed only on swipe #6 (1 swipe before the trigger).

// Start analytics after first paint. Static-importing PostHog here pulls a
// large recorder/autocapture bundle into Android cold start.
const startAnalytics = () => {
  import("./services/analytics").then((m) => m.initAnalytics()).catch(() => {});
};
if ("requestIdleCallback" in window) {
  globalThis.setTimeout(() => (window as any).requestIdleCallback(startAnalytics, { timeout: 5000 }), 1800);
} else {
  globalThis.setTimeout(startAnalytics, 3000);
}

// OTA (live update): mark this bundle healthy so native never rolls it back,
// and let the plugin fetch any newer bundle in the background. Deferred so it
// never competes with first paint on low-end Android.
// Runs early enough that an URGENT bundle can still be applied while the splash
// screen is up, but after first paint so it never competes with it.
globalThis.setTimeout(() => {
  import("./services/ota").then((m) => m.initOta()).catch(() => {});
}, 300);

// Paint the bundled shell immediately. Locale chunks load in parallel and
// trigger one React update when ready instead of holding a blank WebView.
const mount = () => createRoot(document.getElementById("root")!).render(<App />);
mount();
void initI18n();

