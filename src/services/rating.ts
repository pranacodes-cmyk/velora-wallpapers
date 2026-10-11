/**
 * Daily-aggressive rating system for Prayly.
 *
 * Two-step gate: ask "Has this app blessed you?" → 🙌 opens Play Store rating;
 * 🤔 opens email feedback (1-stars stay private).
 *
 * Smart routing for the "Yes" path:
 *   - First MAX_NATIVE_ATTEMPTS times → use Google Play In-App Review API
 *     (zero friction, in-app sheet). Google silently rate-limits this so
 *     beyond a couple tries the call no-ops.
 *   - After that → redirect to the full Play Store listing URL so the user
 *     can still leave a rating there.
 *
 * Throttling:
 *   - 1 prompt per session
 *   - 24h cooldown between prompts (daily-aggressive, not spammy)
 *   - Stops forever once user actually rates or picks "Not yet" → feedback
 */

import { Capacitor } from "@capacitor/core";
import { InAppReview } from "@capacitor-community/in-app-review";
import { anyOverlayVisible, visibleOverlayLabel } from "@/lib/overlayQueue";

const KEY_LAST_PROMPT = "jw_rating_last_prompt";
const KEY_RATED = "jw_rating_done";
const KEY_OPT_OUT = "jw_rating_opt_out";
const KEY_NATIVE_ATTEMPTS = "jw_rating_native_attempts";
const KEY_DISMISS_COUNT = "jw_rating_dismiss_count";
const KEY_LAST_DISMISS = "jw_rating_last_dismiss";

const MIN_HOURS_BETWEEN_PROMPTS = 6;  // aggressive — up to ~4x/day
const MAX_PROMPTS_PER_SESSION = 2;    // allow a second ask later in same session
const MIN_MINUTES_BETWEEN_SESSION_PROMPTS = 8; // gap inside a session
const MAX_NATIVE_ATTEMPTS = 3;
const MAX_DISMISSALS = 6;             // "later" taps before we stop asking
const HOURS_AFTER_DISMISS = 12;       // breathing room after a "later" tap        // after this, fall back to Play Store URL
const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app";

const HOUR_MS = 60 * 60 * 1000;

let sessionPromptCount = 0;
let lastSessionPromptAt = 0;

function num(key: string): number {
  try { return parseInt(localStorage.getItem(key) || "0", 10) || 0; } catch { return 0; }
}
function set(key: string, val: string | number) {
  try { localStorage.setItem(key, String(val)); } catch {}
}

/**
 * One-time recovery: older builds set a permanent opt-out on ANY dismissal
 * (backdrop tap, X). Those installs are not unhappy users, so clear the flag
 * once and let them be asked again. Real feedback senders keep their opt-out.
 */
(function migrateOptOut() {
  try {
    if (localStorage.getItem("jw_rating_optout_migrated_v2") === "1") return;
    localStorage.setItem("jw_rating_optout_migrated_v2", "1");
    if (localStorage.getItem(KEY_OPT_OUT) === "1" &&
        localStorage.getItem("jw_rating_feedback_sent") !== "1") {
      localStorage.removeItem(KEY_OPT_OUT);
      set(KEY_LAST_DISMISS, Date.now());
    }
  } catch {}
})();

/** Kept for API compatibility — no-op. */
export function recordHappyMoment(_weight = 1) {}

/** Has this install ever been shown the prompt? */
function everPrompted(): boolean {
  return num(KEY_LAST_PROMPT) > 0;
}

/** Returns null when eligible, otherwise the reason it's blocked. */
export function ratingBlockReason(): string | null {
  // Hard stops — user already rated or asked to be left alone.
  if (localStorage.getItem(KEY_RATED) === "1") return "already_rated";
  if (localStorage.getItem(KEY_OPT_OUT) === "1") return "opted_out";

  // GUARANTEE: every new install sees the prompt at least once. The very
  // first happy moment always gets through — no session cap, no cooldown.
  if (!everPrompted()) return null;

  // A dismissal ("X", backdrop tap, "Maybe later") is NOT an opt-out — it just
  // buys the user quiet time. Only after several does it stop for good.
  if (num(KEY_DISMISS_COUNT) >= MAX_DISMISSALS) return "dismiss_cap";
  const sinceDismiss = Date.now() - num(KEY_LAST_DISMISS);
  if (num(KEY_LAST_DISMISS) > 0 && sinceDismiss < HOURS_AFTER_DISMISS * HOUR_MS) {
    return "dismiss_cooldown";
  }

  if (sessionPromptCount >= MAX_PROMPTS_PER_SESSION) return "session_cap";
  if (sessionPromptCount > 0 &&
      Date.now() - lastSessionPromptAt < MIN_MINUTES_BETWEEN_SESSION_PROMPTS * 60_000) {
    return "session_gap";
  }

  const sinceLast = Date.now() - num(KEY_LAST_PROMPT);
  if (sinceLast < MIN_HOURS_BETWEEN_PROMPTS * HOUR_MS) return "cooldown";
  return null;
}

export function isEligibleForRating(): boolean {
  return ratingBlockReason() === null;
}


function track(event: string, props?: Record<string, unknown>) {
  import("@/services/analytics").then((a) => a.track(event, props)).catch(() => {});
}

let deferTimer: ReturnType<typeof setInterval> | null = null;

export function maybeRequestRating(force = false): boolean {
  if (!force) {
    const blocked = ratingBlockReason();
    if (blocked) {
      track("rating_prompt_blocked", { reason: blocked });
      return false;
    }
  }

  // Race guard: if a paywall / permission nudge / notification primer is on
  // screen (serial lock OR a self-managed sheet like the page-level paywall),
  // QUEUE the prompt instead of dropping it. We poll until the screen clears
  // (up to ~5 min) so the prompt survives a long paywall session.
  if (!force && anyOverlayVisible()) {
    if (deferTimer) return false; // already queued
    track("rating_prompt_deferred", { holder: visibleOverlayLabel() });
    let tries = 0;
    deferTimer = setInterval(() => {
      tries += 1;
      if (!anyOverlayVisible()) {
        clearInterval(deferTimer!);
        deferTimer = null;
        maybeRequestRating(false);
      } else if (tries > 150) {
        // ~5 min ceiling — long enough for any sheet, short enough to not leak.
        clearInterval(deferTimer!);
        deferTimer = null;
        track("rating_prompt_dropped", { reason: "overlay_timeout" });
      }
    }, 2000);
    return false;
  }

  sessionPromptCount += 1;
  lastSessionPromptAt = Date.now();
  set(KEY_LAST_PROMPT, Date.now());
  window.dispatchEvent(new CustomEvent("jw:show-rating-prompt"));
  return true;
}


/**
 * "Yes" path. Tries the native In-App Review sheet first, but Google's API
 * silently no-ops in many cases (already rated, rate-limited, dev build,
 * Play Services issue) — returning success without ever showing UI. To
 * guarantee the user actually lands on a rating surface, we time the call:
 * if it resolves in under ~1.2s the sheet almost certainly never appeared,
 * so we fall back to opening the Play Store listing directly.
 */
export async function openNativeRating(): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    // Web fallback — open the Play Store listing in a new tab.
    try { window.open(PLAY_STORE_URL, "_blank"); } catch {}
    markRated();
    return;
  }

  const attempts = num(KEY_NATIVE_ATTEMPTS);
  let nativeShown = false;

  if (attempts < MAX_NATIVE_ATTEMPTS) {
    try {
      const start = Date.now();
      await InAppReview.requestReview();
      const elapsed = Date.now() - start;
      set(KEY_NATIVE_ATTEMPTS, attempts + 1);
      // Heuristic: a real in-app review sheet takes >1.2s of user attention.
      // Anything faster = Google silently no-op'd it. Fall back to Play Store.
      if (elapsed >= 1200) {
        nativeShown = true;
        markRated();
        return;
      }
    } catch (e) {
      /* native review unavailable — fall through */;
    }
  }

  if (nativeShown) return;

  // Fallback: open the actual Play Store listing so the user can rate.
  // market:// launches the Play Store app directly when installed; we
  // also queue the https URL as a safety net in case market:// fails.
  try {
    window.location.href = `market://details?id=com.jesuswallpaperbible.app`;
    setTimeout(() => {
      try { window.location.href = PLAY_STORE_URL; } catch {}
    }, 800);
  } catch {
    try { window.location.href = PLAY_STORE_URL; } catch {}
  }
  markRated();
}

export function openFeedback(reason?: string) {
  const subject = encodeURIComponent("Prayly: Bible Prayer & Verse — feedback");
  const body = encodeURIComponent(
    `Hi team,\n\n${reason ? `What I'd improve: ${reason}\n\n` : ""}—`
  );
  set("jw_rating_feedback_sent", "1");
  const url = `mailto:support@jesuswallpaperbible.app?subject=${subject}&body=${body}`;
  set(KEY_OPT_OUT, "1");
  try { window.location.href = url; } catch {}
}

export function markRated() { set(KEY_RATED, "1"); }

/** Soft "not now" — keeps the install eligible for a later ask. */
export function markLater() {
  set(KEY_DISMISS_COUNT, num(KEY_DISMISS_COUNT) + 1);
  set(KEY_LAST_DISMISS, Date.now());
}
export function markDeclined() { set(KEY_OPT_OUT, "1"); }

export function _resetRating() {
  [KEY_LAST_PROMPT, KEY_RATED, KEY_OPT_OUT, KEY_NATIVE_ATTEMPTS,
   KEY_DISMISS_COUNT, KEY_LAST_DISMISS].forEach((k) => {
    try { localStorage.removeItem(k); } catch {}
  });
  sessionPromptCount = 0;
  lastSessionPromptAt = 0;
}
