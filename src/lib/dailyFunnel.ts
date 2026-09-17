/**
 * Daily Funnel — the glue that drives users through:
 *   Prayer → Verse + Reflection → Daily Quiz → Day Complete
 *
 * Lives entirely in localStorage / sessionStorage. No backend.
 *
 * Two surfaces:
 *  1. Handoff overlay: shown on Today when the user just finished a step and
 *     the next step is one tap away.
 *  2. Exit-intent rescue: when the user tries to bail mid-funnel, we toast,
 *     then modal, then schedule a push so we don't lose them.
 */

const HANDOFF_KEY = "cw_funnel_handoff";              // "reflection" | "quiz" | "complete"
const EXIT_COUNT_KEY = "cw_funnel_exit_count";        // per-day soft counter
const PERFECT_STREAK_KEY = "cw_perfect_streak";       // only bumps when all 3 done
const PRAYER_VIEWED_KEY = "cw_prayer_viewed_at";      // ms timestamp this session
const COMPLETE_ACK_KEY = "cw_funnel_complete_ack";    // YYYY-MM-DD once dismissed

export function isCompleteAcknowledgedToday(): boolean {
  try { return localStorage.getItem(COMPLETE_ACK_KEY) === new Date().toISOString().split("T")[0]; } catch { return false; }
}

export function ackCompleteToday() {
  try {
    localStorage.setItem(COMPLETE_ACK_KEY, new Date().toISOString().split("T")[0]);
    window.dispatchEvent(new Event("cw_funnel_changed"));
  } catch {}
}

export const FUNNEL_EVENT = "cw_funnel_changed";

export type HandoffStep = "reflection" | "quiz" | "complete";

function today(): string {
  return new Date().toISOString().split("T")[0];
}

/* ---------- Handoff ---------- */

export function setHandoff(step: HandoffStep) {
  try {
    sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ step, date: today() }));
    window.dispatchEvent(new Event(FUNNEL_EVENT));
  } catch {}
}

export function getHandoff(): HandoffStep | null {
  try {
    const raw = sessionStorage.getItem(HANDOFF_KEY);
    if (!raw) return null;
    const { step, date } = JSON.parse(raw);
    if (date !== today()) return null;
    return step as HandoffStep;
  } catch { return null; }
}

export function clearHandoff() {
  try {
    sessionStorage.removeItem(HANDOFF_KEY);
    window.dispatchEvent(new Event(FUNNEL_EVENT));
  } catch {}
}

/* ---------- Prayer engagement ---------- */

/** Called on Devotional mount/scroll — marks the user as having actually engaged. */
export function markPrayerViewed() {
  try { sessionStorage.setItem(PRAYER_VIEWED_KEY, String(Date.now())); } catch {}
}

export function getPrayerViewedMs(): number {
  try { return Number(sessionStorage.getItem(PRAYER_VIEWED_KEY) || 0); } catch { return 0; }
}

/* ---------- Exit rescue ---------- */

interface ExitState { date: string; count: number; }

export function readExitCount(): number {
  try {
    const raw = sessionStorage.getItem(EXIT_COUNT_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw) as ExitState;
    if (s.date !== today()) return 0;
    return s.count;
  } catch { return 0; }
}

export function bumpExitCount(): number {
  const next = readExitCount() + 1;
  try {
    sessionStorage.setItem(EXIT_COUNT_KEY, JSON.stringify({ date: today(), count: next }));
  } catch {}
  return next;
}

/* ---------- Perfect streak (gated on all 3 done) ---------- */

interface PerfectStreak { current: number; longest: number; lastDate: string; }

function loadPerfect(): PerfectStreak {
  try {
    const raw = localStorage.getItem(PERFECT_STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { current: 0, longest: 0, lastDate: "" };
}

export function bumpPerfectStreak(): PerfectStreak {
  const data = loadPerfect();
  const t = today();
  if (data.lastDate === t) return data;
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yStr = y.toISOString().split("T")[0];
  const consecutive = data.lastDate === yStr;
  const next: PerfectStreak = {
    current: consecutive ? data.current + 1 : 1,
    longest: Math.max(data.longest, consecutive ? data.current + 1 : 1),
    lastDate: t,
  };
  try {
    localStorage.setItem(PERFECT_STREAK_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(FUNNEL_EVENT));
  } catch {}
  return next;
}

export function getPerfectStreak(): PerfectStreak {
  return loadPerfect();
}

export function isPerfectToday(): boolean {
  return loadPerfect().lastDate === today();
}

/* ---------- Cross-component open-reflection bridge ---------- */

export const OPEN_REFLECTION_EVENT = "cw_funnel_open_reflection";

export function requestOpenReflection() {
  try { window.dispatchEvent(new Event(OPEN_REFLECTION_EVENT)); } catch {}
}
