// Pro Journeys — local progress store (web).
//
// Each journey moves one day per calendar day: Day N opens on the calendar day
// after Day N−1 was completed. A day completes when its three beats (word,
// practice, mission) are done; beats persist so a user can do the mission
// later the same day. Day 1 is free; later days need Pro (gated in the UI —
// progress is never deleted when Pro lapses).
// Flutter mirror: `flutter_app/lib/core/services/pro_journeys.dart` (same key
// and JSON shape).
import { localDate } from "@/services/challenge";
import { resetStudyReading } from "@/services/proJourneyStudy";
import { BATTLES, FREE_DAYS, PRO_JOURNEYS, proJourneyById, type Battle, type ProJourneyId } from "@/data/proJourneys";

export const PRO_JOURNEYS_KEY = "prayly_pro_journeys_v1";
export const PRO_JOURNEYS_EVENT = "prayly:pro-journeys";
export const STEPS = ["word", "practice", "mission"] as const;
export type Step = (typeof STEPS)[number];
export const PRAYER_LIST_MAX = 20;

export interface JourneyProgress {
  started: string;
  /** day → local date it was completed on */
  done: Record<string, string>;
  /** day → beats done so far (only for unfinished days) */
  steps: Record<string, Step[]>;
}

export interface FreedomState {
  battle: Battle | null;
  when: string;
  then: string;
  /** local date → honest check-in for the previous 24 hours */
  checkins: Record<string, "free" | "slip">;
  sos: number;
}

export interface PrayerItem {
  id: string;
  name: string;
  need: string;
  added: string;
  answered: string | null;
}

export interface ProJourneyStore {
  journeys: Partial<Record<ProJourneyId, JourneyProgress>>;
  /** id → date first finished (badges survive a restart) */
  finished: Partial<Record<ProJourneyId, string>>;
  freedom: FreedomState;
  prayers: PrayerItem[];
}

const EMPTY_FREEDOM: FreedomState = { battle: null, when: "", then: "", checkins: {}, sos: 0 };
const EMPTY: ProJourneyStore = { journeys: {}, finished: {}, freedom: EMPTY_FREEDOM, prayers: [] };
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

function sanitize(j: unknown): ProJourneyStore {
  const raw = (j && typeof j === "object" ? j : {}) as Record<string, any>;
  const out: ProJourneyStore = { journeys: {}, finished: {}, freedom: { ...EMPTY_FREEDOM, checkins: {} }, prayers: [] };
  for (const def of PRO_JOURNEYS) {
    const src = raw.journeys?.[def.id];
    if (src && typeof src === "object" && DATE.test(src.started ?? "")) {
      const done: Record<string, string> = {};
      const steps: Record<string, Step[]> = {};
      for (let d = 1; d <= def.days; d++) {
        const v = src.done?.[String(d)];
        if (typeof v === "string" && DATE.test(v)) done[String(d)] = v;
        const s = src.steps?.[String(d)];
        if (Array.isArray(s) && !done[String(d)]) {
          const clean = STEPS.filter((x) => s.includes(x));
          if (clean.length) steps[String(d)] = clean;
        }
      }
      out.journeys[def.id] = { started: src.started, done, steps };
    }
    const f = raw.finished?.[def.id];
    if (typeof f === "string" && DATE.test(f)) out.finished[def.id] = f;
  }
  const fr = raw.freedom ?? {};
  out.freedom.battle = (BATTLES as readonly string[]).includes(fr.battle) ? fr.battle : null;
  out.freedom.when = str(fr.when, 120);
  out.freedom.then = str(fr.then, 120);
  out.freedom.sos = Number.isFinite(fr.sos) ? Math.max(0, Math.floor(fr.sos)) : 0;
  if (fr.checkins && typeof fr.checkins === "object") {
    const dates = Object.keys(fr.checkins).filter((d) => DATE.test(d)).sort().slice(-90);
    for (const d of dates) if (fr.checkins[d] === "free" || fr.checkins[d] === "slip") out.freedom.checkins[d] = fr.checkins[d];
  }
  if (Array.isArray(raw.prayers)) {
    for (const it of raw.prayers.slice(0, PRAYER_LIST_MAX)) {
      if (!it || typeof it.id !== "string" || !str(it.name, 40).trim()) continue;
      out.prayers.push({
        id: it.id.slice(0, 24),
        name: str(it.name, 40),
        need: str(it.need, 120),
        added: DATE.test(it.added ?? "") ? it.added : localDate(),
        answered: DATE.test(it.answered ?? "") ? it.answered : null,
      });
    }
  }
  return out;
}

function read(): ProJourneyStore {
  try {
    const raw = localStorage.getItem(PRO_JOURNEYS_KEY);
    return raw ? sanitize(JSON.parse(raw)) : EMPTY;
  } catch {
    return EMPTY;
  }
}

let cache: ProJourneyStore = read();

function write(next: ProJourneyStore) {
  cache = next;
  try { localStorage.setItem(PRO_JOURNEYS_KEY, JSON.stringify(next)); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(PRO_JOURNEYS_EVENT));
}

/* ── reactivity ──────────────────────────────────────────────────────── */

export function subscribeProJourneys(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === PRO_JOURNEYS_KEY) { cache = read(); cb(); } };
  window.addEventListener(PRO_JOURNEYS_EVENT, cb);
  window.addEventListener("storage", onStorage);
  return () => { window.removeEventListener(PRO_JOURNEYS_EVENT, cb); window.removeEventListener("storage", onStorage); };
}
export const getProJourneysSnapshot = () => cache;

/** Re-read from storage (after "Delete my data" or an external write). */
export function reloadProJourneys() {
  cache = read();
  window.dispatchEvent(new Event(PRO_JOURNEYS_EVENT));
}

/* ── dates ───────────────────────────────────────────────────────────── */

const utc = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd); };
export const daysBetween = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);

/* ── journey queries ─────────────────────────────────────────────────── */

const progress = (id: ProJourneyId, s = cache) => s.journeys[id];
export const isStarted = (id: ProJourneyId, s = cache) => Boolean(progress(id, s));
export const doneCount = (id: ProJourneyId, s = cache) => Object.keys(progress(id, s)?.done ?? {}).length;
export const isDayDone = (id: ProJourneyId, day: number, s = cache) => Boolean(progress(id, s)?.done[String(day)]);
export const dayDoneOn = (id: ProJourneyId, day: number, s = cache) => progress(id, s)?.done[String(day)] ?? null;
export const stepsFor = (id: ProJourneyId, day: number, s = cache): Step[] => progress(id, s)?.steps[String(day)] ?? [];
export const requiresPro = (day: number) => day > FREE_DAYS;

/** First unfinished day, or null when the journey is complete. */
export function nextDay(id: ProJourneyId, s = cache): number | null {
  const def = proJourneyById(id);
  if (!def) return null;
  for (let d = 1; d <= def.days; d++) if (!isDayDone(id, d, s)) return d;
  return null;
}

/** Day N is open today when Day N−1 was completed on an earlier date. */
export function isDayOpen(id: ProJourneyId, day: number, today = localDate(), s = cache) {
  const def = proJourneyById(id);
  if (!def || day < 1 || day > def.days || isDayDone(id, day, s)) return false;
  if (day === 1) return true;
  const prev = dayDoneOn(id, day - 1, s);
  return Boolean(prev && prev < today);
}

export type JourneyStatus =
  | { kind: "new" }
  | { kind: "today"; day: number }
  | { kind: "wait"; day: number; doneDay: number }
  | { kind: "done" };

export function journeyStatus(id: ProJourneyId, today = localDate(), s = cache): JourneyStatus {
  const next = nextDay(id, s);
  if (next === null) return { kind: "done" };
  if (!isStarted(id, s)) return { kind: "new" };
  if (isDayOpen(id, next, today, s)) return { kind: "today", day: next };
  return { kind: "wait", day: next, doneDay: next - 1 };
}

/* ── journey mutations ───────────────────────────────────────────────── */

function withJourney(id: ProJourneyId, fn: (p: JourneyProgress) => JourneyProgress) {
  const cur = cache.journeys[id] ?? { started: localDate(), done: {}, steps: {} };
  write({ ...cache, journeys: { ...cache.journeys, [id]: fn({ ...cur, done: { ...cur.done }, steps: { ...cur.steps } }) } });
}

export function startJourney(id: ProJourneyId) {
  if (!isStarted(id)) withJourney(id, (p) => p);
}

export function markStep(id: ProJourneyId, day: number, step: Step, today = localDate()) {
  if (!isDayOpen(id, day, today)) return;
  const have = stepsFor(id, day);
  if (have.includes(step)) return;
  withJourney(id, (p) => ({ ...p, steps: { ...p.steps, [String(day)]: STEPS.filter((x) => x === step || have.includes(x)) } }));
}

export function unmarkStep(id: ProJourneyId, day: number, step: Step) {
  const have = stepsFor(id, day);
  if (!have.includes(step)) return;
  withJourney(id, (p) => ({ ...p, steps: { ...p.steps, [String(day)]: have.filter((x) => x !== step) } }));
}

export type DayResult = { day: number; finished: boolean; total: number };

/** Records the day when all three beats are done. */
export function completeDay(id: ProJourneyId, day: number, today = localDate()): DayResult | null {
  const def = proJourneyById(id);
  if (!def || !isDayOpen(id, day, today)) return null;
  if (!STEPS.every((s) => stepsFor(id, day).includes(s))) return null;
  withJourney(id, (p) => {
    const steps = { ...p.steps };
    delete steps[String(day)];
    return { ...p, done: { ...p.done, [String(day)]: today }, steps };
  });
  const finished = nextDay(id) === null;
  if (finished && !cache.finished[id]) write({ ...cache, finished: { ...cache.finished, [id]: today } });
  return { day, finished, total: def.days };
}

/** Back to Day 1. Badges, the prayer list and the freedom plan stay. */
export function restartJourney(id: ProJourneyId) {
  resetStudyReading(id);
  const journeys = { ...cache.journeys };
  delete journeys[id];
  const freedom = id === "freedom" ? { ...cache.freedom, checkins: {}, sos: 0 } : cache.freedom;
  write({ ...cache, journeys, freedom });
}

/* ── Break Free ──────────────────────────────────────────────────────── */

export function setBattle(battle: Battle) {
  write({ ...cache, freedom: { ...cache.freedom, battle } });
}

export function setPlan(when: string, then: string) {
  write({ ...cache, freedom: { ...cache.freedom, when: when.trim().slice(0, 120), then: then.trim().slice(0, 120) } });
}

export const hasPlan = (s = cache) => Boolean(s.freedom.battle && s.freedom.when.trim() && s.freedom.then.trim());
export const checkinToday = (today = localDate(), s = cache) => s.freedom.checkins[today] ?? null;

export function checkIn(result: "free" | "slip", today = localDate()) {
  const checkins = { ...cache.freedom.checkins, [today]: result };
  write({ ...cache, freedom: { ...cache.freedom, checkins } });
}

export function recordSos() {
  write({ ...cache, freedom: { ...cache.freedom, sos: cache.freedom.sos + 1 } });
}

/** Whole days since the last reported slip (or since the journey began). */
export function daysFree(today = localDate(), s = cache): number {
  const started = s.journeys.freedom?.started;
  if (!started) return 0;
  const slips = Object.keys(s.freedom.checkins).filter((d) => s.freedom.checkins[d] === "slip").sort();
  const last = slips[slips.length - 1];
  const from = last && last >= started ? last : started;
  return Math.max(0, daysBetween(from, today));
}

/* ── Prayer list ─────────────────────────────────────────────────────── */

export function addPrayer(name: string, need: string): boolean {
  const n = name.trim().slice(0, 40);
  if (!n || cache.prayers.length >= PRAYER_LIST_MAX) return false;
  const item: PrayerItem = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: n, need: need.trim().slice(0, 120), added: localDate(), answered: null };
  write({ ...cache, prayers: [...cache.prayers, item] });
  return true;
}

export function toggleAnswered(itemId: string, today = localDate()) {
  write({ ...cache, prayers: cache.prayers.map((p) => (p.id === itemId ? { ...p, answered: p.answered ? null : today } : p)) });
}

export function removePrayer(itemId: string) {
  write({ ...cache, prayers: cache.prayers.filter((p) => p.id !== itemId) });
}

export const answeredCount = (s = cache) => s.prayers.filter((p) => p.answered).length;
