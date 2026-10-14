// 75 Days of Light — local challenge state machine (web mirror of
// flutter_app/lib/core/services/challenge_store.dart).
//
// Rules
// • One day can be lit per calendar day; the day lights when all four
//   practices are done (the chapter reading is compulsory).
// • Progress is counted in completed days, never in calendar days, so a
//   missed day never skips content.
// • Grace path (default): a missed day spends one jar of grace oil to keep the
//   streak alive; without oil the streak resets but the progress stays.
// • Covenant path: a missed day relights the challenge from Day 1.
// • Every 7-day streak earns a jar of oil. Free keeps 1, Pro keeps 3.
import { CHALLENGE_DAYS, TASK_IDS, type TaskId } from "@/data/challenge75";

export const CHALLENGE_KEY = "prayly_challenge_v1";
export const JOURNAL_KEY = "prayly_challenge_journal_v1";
export const CHALLENGE_EVENT = "prayly:challenge-change";
/** Set when a free user lights a day; the hub shows a warm interstitial once. */
export const CHALLENGE_AD_FLAG = "prayly_challenge_ad_pending";

export type ChallengeMode = "grace" | "covenant";
export type ChallengeNotice =
  | { type: "grace_used"; days: number }
  | { type: "streak_reset"; missed: number }
  | { type: "restarted"; reached: number }
  | null;

export type ChallengeState = {
  v: 1;
  status: "idle" | "active" | "finished";
  mode: ChallengeMode;
  startedOn: string | null;
  attempts: number;
  /** day number → local date it was lit */
  completed: Record<string, string>;
  today: { date: string; day: number; done: TaskId[] } | null;
  lastLitOn: string | null;
  /** last date protected by grace oil (counts like a lit day for streaks) */
  coveredThrough: string | null;
  streak: number;
  bestStreak: number;
  graces: number;
  lastCheckOn: string | null;
  finishedOn: string | null;
  notice: ChallengeNotice;
  reminders: { enabled: boolean; morning: string; evening: boolean };
};

export const DEFAULT_STATE: ChallengeState = {
  v: 1,
  status: "idle",
  mode: "grace",
  startedOn: null,
  attempts: 1,
  completed: {},
  today: null,
  lastLitOn: null,
  coveredThrough: null,
  streak: 0,
  bestStreak: 0,
  graces: 1,
  lastCheckOn: null,
  finishedOn: null,
  notice: null,
  reminders: { enabled: true, morning: "07:00", evening: true },
};

/* ── dates (always the user's local calendar) ────────────────────────────── */

export function localDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toUtc(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(toUtc(date) + days * 86_400_000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/** Milliseconds until the next local midnight (when the next day opens). */
export function msUntilMidnight(now = new Date()): number {
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - now.getTime();
}

/* ── storage ─────────────────────────────────────────────────────────────── */

function read(): ChallengeState {
  try {
    const raw = localStorage.getItem(CHALLENGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<ChallengeState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      completed: parsed.completed ?? {},
      reminders: { ...DEFAULT_STATE.reminders, ...(parsed.reminders ?? {}) },
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

let cache: ChallengeState | null = null;
const listeners = new Set<() => void>();

function write(next: ChallengeState) {
  cache = next;
  try { localStorage.setItem(CHALLENGE_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  listeners.forEach((l) => l());
  try { window.dispatchEvent(new CustomEvent(CHALLENGE_EVENT)); } catch { /* SSR */ }
}

export function getChallenge(): ChallengeState {
  if (!cache) cache = read();
  return cache;
}

export function subscribeChallenge(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key === CHALLENGE_KEY) { cache = read(); listener(); }
  };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}

/* ── derived values ──────────────────────────────────────────────────────── */

export function completedCount(s: ChallengeState): number {
  return Object.keys(s.completed).length;
}

export function litToday(s: ChallengeState, today = localDate()): boolean {
  return s.lastLitOn === today;
}

/** The day the user works on now (or the last one lit today). */
export function currentDay(s: ChallengeState, today = localDate()): number {
  const done = completedCount(s);
  if (s.status === "finished") return CHALLENGE_DAYS;
  if (litToday(s, today)) return Math.max(1, done);
  return Math.min(CHALLENGE_DAYS, done + 1);
}

export function tasksDoneToday(s: ChallengeState, today = localDate()): TaskId[] {
  if (litToday(s, today)) return [...TASK_IDS];
  return s.today && s.today.date === today ? s.today.done : [];
}

export function graceCap(isPremium: boolean) {
  return isPremium ? 3 : 1;
}

/** Streak as it stands right now (0 once a day is missed without oil). */
export function liveStreak(s: ChallengeState, today = localDate()): number {
  const anchor = latest(s.lastLitOn, s.coveredThrough);
  if (!anchor) return 0;
  return daysBetween(anchor, today) <= 1 ? s.streak : 0;
}

function latest(a: string | null, b: string | null) {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}

/* ── actions ─────────────────────────────────────────────────────────────── */

export function startChallenge(mode: ChallengeMode, morning: string, evening: boolean) {
  const today = localDate();
  const prev = getChallenge();
  write({
    ...DEFAULT_STATE,
    status: "active",
    mode,
    startedOn: today,
    attempts: prev.status === "idle" ? prev.attempts : prev.attempts + 1,
    bestStreak: prev.bestStreak,
    lastCheckOn: today,
    reminders: { enabled: true, morning, evening },
  });
}

export function setMode(mode: ChallengeMode) {
  write({ ...getChallenge(), mode });
}

export function setReminders(reminders: Partial<ChallengeState["reminders"]>) {
  const s = getChallenge();
  write({ ...s, reminders: { ...s.reminders, ...reminders } });
}

export function clearNotice() {
  const s = getChallenge();
  if (s.notice) write({ ...s, notice: null });
}

/**
 * Apply missed-day rules once per calendar day. Safe to call on every open.
 */
export function evaluateChallenge(today = localDate()) {
  const s = getChallenge();
  if (s.status !== "active" || s.lastCheckOn === today) return;
  const anchor = latest(s.lastLitOn, s.coveredThrough);
  const next: ChallengeState = { ...s, lastCheckOn: today };
  if (anchor) {
    const missed = daysBetween(anchor, today) - 1;
    if (missed > 0) {
      if (s.mode === "covenant") {
        write({
          ...DEFAULT_STATE,
          status: "active",
          mode: "covenant",
          startedOn: today,
          attempts: s.attempts + 1,
          bestStreak: s.bestStreak,
          graces: 0,
          lastCheckOn: today,
          reminders: s.reminders,
          notice: { type: "restarted", reached: completedCount(s) },
        });
        return;
      }
      if (s.graces >= missed && s.streak > 0) {
        next.graces = s.graces - missed;
        next.coveredThrough = addDays(today, -1);
        next.notice = { type: "grace_used", days: missed };
      } else if (s.streak > 0) {
        next.streak = 0;
        next.notice = { type: "streak_reset", missed };
      }
    }
  }
  if (next.today && next.today.date !== today) next.today = null;
  write(next);
}

export type CompletionResult = {
  lit: boolean;
  day: number;
  streak: number;
  graceEarned: boolean;
  lampUpgraded: boolean;
  finished: boolean;
};

/** Mark a practice done for today. Lights the day when all four are done. */
export function completeTask(task: TaskId, isPremium: boolean): CompletionResult {
  const today = localDate();
  const s = getChallenge();
  const day = currentDay(s, today);
  const empty: CompletionResult = { lit: false, day, streak: liveStreak(s, today), graceEarned: false, lampUpgraded: false, finished: false };
  if (s.status !== "active" || litToday(s, today)) return empty;

  const done = new Set(s.today && s.today.date === today ? s.today.done : []);
  done.add(task);
  const ordered = TASK_IDS.filter((t) => done.has(t));
  const nextToday = { date: today, day, done: ordered };

  if (ordered.length < TASK_IDS.length) {
    write({ ...s, today: nextToday });
    return { ...empty };
  }

  const anchor = latest(s.lastLitOn, s.coveredThrough);
  const streak = anchor && daysBetween(anchor, today) === 1 ? s.streak + 1 : 1;
  const before = completedCount(s);
  const completed = { ...s.completed, [String(day)]: today };
  const after = Object.keys(completed).length;
  const cap = graceCap(isPremium);
  const graceEarned = streak > 0 && streak % 7 === 0 && s.graces < cap;
  const finished = after >= CHALLENGE_DAYS;
  write({
    ...s,
    status: finished ? "finished" : "active",
    finishedOn: finished ? today : s.finishedOn,
    completed,
    today: nextToday,
    lastLitOn: today,
    streak,
    bestStreak: Math.max(s.bestStreak, streak),
    graces: graceEarned ? s.graces + 1 : s.graces,
    notice: null,
  });
  return {
    lit: true,
    day,
    streak,
    graceEarned,
    lampUpgraded: Math.floor(after / 15) > Math.floor(before / 15) && after < CHALLENGE_DAYS,
    finished,
  };
}

export function undoTask(task: TaskId) {
  const today = localDate();
  const s = getChallenge();
  if (litToday(s, today) || !s.today || s.today.date !== today) return;
  write({ ...s, today: { ...s.today, done: s.today.done.filter((t) => t !== task) } });
}

export function resetChallenge() {
  const s = getChallenge();
  write({ ...DEFAULT_STATE, attempts: s.attempts, bestStreak: s.bestStreak });
}

/* ── private journal (never leaves the device) ───────────────────────────── */

export function readJournal(): Record<string, string> {
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "{}") ?? {}; } catch { return {}; }
}

export function saveJournal(day: number, text: string) {
  const all = readJournal();
  all[String(day)] = text.slice(0, 600);
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(all)); } catch { /* storage blocked */ }
}
