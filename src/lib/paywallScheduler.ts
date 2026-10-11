/**
 * Recurring paywall scheduler.
 *
 * Goal: actually surface Pro to engaged free users at meaningful moments
 * without nagging. Pain-point events (wallpaper applied, quiz finished,
 * journey day finished, streak milestone) increment a counter. When the
 * counter hits a threshold AND the user hasn't seen the paywall recently
 * AND hasn't dismissed too many times today, we open it.
 *
 * Triggered by dispatching `window.dispatchEvent(new CustomEvent("paywall-trigger", { detail: { reason } }))`
 * — see `firePaywallTrigger()` helper.
 */

const COUNTS_KEY = "cw_paywall_counts_v1";
const STATE_KEY = "cw_paywall_state_v1";

// Min gap between auto-opens (ms). 90 min — long enough to feel intentional.
const MIN_GAP_MS = 90 * 60 * 1000;
// Max auto-opens per rolling 24h window.
const MAX_PER_DAY = 3;
// After this many dismissals in a row, back off for 24h.
const DISMISS_BACKOFF_COUNT = 3;
const DISMISS_BACKOFF_MS = 24 * 60 * 60 * 1000;

export type PaywallReason =
  | "wallpaper_applied"
  | "quiz_finished"
  | "journey_day_finished"
  | "streak_milestone"
  | "companion_message"
  | "favorite_added"
  | "app_session"
  | "prayer_audio_played"
  | "shield_unlocked"
  | "usage_day4"
  | "manual";

// Pain points → how many before we trigger
const THRESHOLDS: Partial<Record<PaywallReason, number>> = {
  wallpaper_applied: 2,      // every 2 wallpapers
  quiz_finished: 1,          // every quiz
  journey_day_finished: 1,   // every journey day
  streak_milestone: 1,
  companion_message: 4,      // every 4 companion msgs
  favorite_added: 3,
  app_session: 3,            // every 3rd cold session
  prayer_audio_played: 2,
  shield_unlocked: 2,        // every 2nd Sacred Pause unlock
};

/**
 * One-time "you've lived with Prayly for a few days" offer.
 *
 * Day 4 of real usage is the single best moment to ask: the habit is formed,
 * the free limits have been felt, and nothing has been asked of the user yet.
 * It fires once per install and ignores the normal counters/cooldowns.
 */
const USAGE_MILESTONE_DAYS = 3; // 3 full days since first open → day 4
const USAGE_MILESTONE_KEY = "cw_paywall_usage_day4_shown";
const FIRST_OPEN_KEY = "cw_first_open_at";

/** First-open timestamp, seeded from onboarding completion when available. */
function firstOpenAt(): number {
  try {
    const stored = Number(localStorage.getItem(FIRST_OPEN_KEY) || 0);
    if (stored > 0) return stored;
    const onboarded = Number(localStorage.getItem("cw_onboarded_v3_at") || 0);
    const seed = onboarded > 0 ? onboarded : Date.now();
    localStorage.setItem(FIRST_OPEN_KEY, String(seed));
    return seed;
  } catch { return Date.now(); }
}

export function daysSinceFirstOpen(): number {
  return Math.floor((Date.now() - firstOpenAt()) / (24 * 60 * 60 * 1000));
}

/** Fires the one-time day-4 offer if it's due. Safe to call on every launch. */
export function maybeFireUsageMilestonePaywall() {
  if (typeof window === "undefined" || isPremium()) return;
  try {
    if (localStorage.getItem(USAGE_MILESTONE_KEY) === "1") return;
    if (daysSinceFirstOpen() < USAGE_MILESTONE_DAYS) return;
    localStorage.setItem(USAGE_MILESTONE_KEY, "1");
    markShown();
    window.dispatchEvent(
      new CustomEvent("paywall-trigger", { detail: { reason: "usage_day4" } }),
    );
  } catch {}
}

type Counts = Record<string, number>;
type State = {
  lastShownAt: number;
  shownTimestamps: number[];   // for 24h rate limit
  dismissStreak: number;
  backoffUntil: number;
};

function readCounts(): Counts {
  try { return JSON.parse(localStorage.getItem(COUNTS_KEY) || "{}") || {}; }
  catch { return {}; }
}
function writeCounts(c: Counts) {
  try { localStorage.setItem(COUNTS_KEY, JSON.stringify(c)); } catch {}
}
function readState(): State {
  try {
    const raw = JSON.parse(localStorage.getItem(STATE_KEY) || "{}") || {};
    return {
      lastShownAt: raw.lastShownAt || 0,
      shownTimestamps: Array.isArray(raw.shownTimestamps) ? raw.shownTimestamps : [],
      dismissStreak: raw.dismissStreak || 0,
      backoffUntil: raw.backoffUntil || 0,
    };
  } catch {
    return { lastShownAt: 0, shownTimestamps: [], dismissStreak: 0, backoffUntil: 0 };
  }
}
function writeState(s: State) {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(s)); } catch {}
}

function isPremium(): boolean {
  try { return localStorage.getItem("cw_premium_unlocked") === "true"; } catch { return false; }
}

function canShowNow(): boolean {
  const now = Date.now();
  const s = readState();
  if (now < s.backoffUntil) return false;
  if (now - s.lastShownAt < MIN_GAP_MS) return false;
  const recent = s.shownTimestamps.filter((t) => now - t < 24 * 60 * 60 * 1000);
  if (recent.length >= MAX_PER_DAY) return false;
  return true;
}

/**
 * Record an event. Returns the reason to show the paywall (and immediately
 * marks it as shown to avoid double-fires) or null.
 */
export function recordPaywallEvent(reason: PaywallReason): PaywallReason | null {
  if (isPremium()) return null;
  const counts = readCounts();
  counts[reason] = (counts[reason] || 0) + 1;
  writeCounts(counts);

  const threshold = THRESHOLDS[reason];
  if (!threshold) return null;
  if (counts[reason] < threshold) return null;
  if (!canShowNow()) return null;

  // Reset counter for this reason, mark shown.
  counts[reason] = 0;
  writeCounts(counts);
  markShown();
  return reason;
}

export function markShown() {
  const now = Date.now();
  const s = readState();
  s.lastShownAt = now;
  s.shownTimestamps = [...s.shownTimestamps.filter((t) => now - t < 24 * 60 * 60 * 1000), now];
  writeState(s);
}

export function markDismissed() {
  const s = readState();
  s.dismissStreak = (s.dismissStreak || 0) + 1;
  if (s.dismissStreak >= DISMISS_BACKOFF_COUNT) {
    s.backoffUntil = Date.now() + DISMISS_BACKOFF_MS;
    s.dismissStreak = 0;
  }
  writeState(s);
}

export function markConverted() {
  // Reset everything on conversion or any positive action.
  writeState({ lastShownAt: 0, shownTimestamps: [], dismissStreak: 0, backoffUntil: 0 });
  writeCounts({});
}

/**
 * Convenience: fire a global event for the AutoPaywall mount to pick up.
 * If the threshold isn't met or we're in cooldown, nothing happens.
 */
// "Happy moment" reasons where the Rate-Us prompt must take priority over the
// paywall. If rating is eligible we skip the paywall for this trigger so the
// user actually gets asked to rate — reviews compound, a single paywall shown
// doesn't. The counter is NOT incremented so the paywall still fires next time.
const RATING_PRIORITY_REASONS: PaywallReason[] = [
  "wallpaper_applied",
  "quiz_finished",
  "journey_day_finished",
  "streak_milestone",
  "favorite_added",
  "prayer_audio_played",
  "shield_unlocked",
];

function fireNow(reason: PaywallReason) {
  const shouldShow = recordPaywallEvent(reason);
  if (shouldShow) {
    window.dispatchEvent(new CustomEvent("paywall-trigger", { detail: { reason: shouldShow } }));
  }
}

export function firePaywallTrigger(reason: PaywallReason) {
  if (typeof window === "undefined") return;

  // Let Rate-Us win on happy moments — then chain the paywall after the
  // rating flow finishes (any outcome: love, feedback, dismiss).
  if (RATING_PRIORITY_REASONS.includes(reason)) {
    import("@/services/rating").then((m) => {
      if (m.isEligibleForRating && m.isEligibleForRating()) {
        const onDone = () => {
          window.removeEventListener("jw:rating-flow-done", onDone);
          // Small breath so the rating sheet's exit animation finishes and
          // the overlay lock releases before the paywall grabs it.
          setTimeout(() => fireNow(reason), 600);
        };
        window.addEventListener("jw:rating-flow-done", onDone);
        return;
      }
      fireNow(reason);
    }).catch(() => fireNow(reason));
    return;
  }

  fireNow(reason);
}
