// 75 Days of Light — reading plan and English source content.
//
// Every day: one compulsory New Testament chapter + three small practices
// (pray, live it, reflect). The plan is New Testament only so every bundled
// edition — including the Indonesian NT — can serve every day offline.
import en1 from "@/i18n/content/challenge/en";
import en2 from "@/i18n/content/challenge/en-p2";
import en3 from "@/i18n/content/challenge/en-p3";
import { tc } from "@/i18n";

export const CHALLENGE_DAYS = 75;
export const TASK_IDS = ["read", "pray", "live", "reflect"] as const;
export type TaskId = (typeof TASK_IDS)[number];

/** Canonical (Protestant, 0-based) book order used by the English edition. */
export const BOOK = {
  mark: 40, john: 42, romans: 44, cor1: 45, galatians: 47, ephesians: 48,
  philippians: 49, colossians: 50, hebrews: 57, james: 58, peter1: 59,
  john1: 61, revelation: 65,
} as const;

export type ReadingRef = { book: number; chapter: number; verse: number };

const range = (book: number, from: number, to: number, verses: number[]): ReadingRef[] =>
  verses.map((verse, i) => ({ book, chapter: from + i, verse })).slice(0, to - from + 1);

/** Day N (1-based) → chapter + key verse. */
export const READING_PLAN: ReadingRef[] = [
  ...range(BOOK.mark, 1, 16, [17, 17, 35, 39, 36, 31, 15, 34, 24, 45, 24, 30, 31, 36, 39, 6]),
  ...range(BOOK.john, 1, 21, [5, 5, 16, 14, 6, 35, 38, 12, 25, 11, 25, 46, 34, 27, 5, 33, 21, 37, 30, 29, 17]),
  ...range(BOOK.ephesians, 1, 6, [18, 8, 20, 32, 8, 10]),
  ...range(BOOK.philippians, 1, 4, [6, 15, 14, 6]),
  ...range(BOOK.colossians, 1, 4, [13, 7, 23, 6]),
  ...range(BOOK.james, 1, 5, [22, 17, 17, 8, 16]),
  ...range(BOOK.peter1, 1, 5, [3, 9, 15, 10, 7]),
  ...range(BOOK.john1, 1, 5, [7, 10, 18, 18, 14]),
  { book: BOOK.romans, chapter: 5, verse: 8 },
  { book: BOOK.romans, chapter: 8, verse: 28 },
  { book: BOOK.romans, chapter: 12, verse: 2 },
  { book: BOOK.cor1, chapter: 13, verse: 4 },
  { book: BOOK.galatians, chapter: 5, verse: 22 },
  { book: BOOK.hebrews, chapter: 11, verse: 1 },
  { book: BOOK.hebrews, chapter: 12, verse: 1 },
  { book: BOOK.revelation, chapter: 21, verse: 5 },
  { book: BOOK.revelation, chapter: 22, verse: 5 },
];

if (import.meta.env.DEV && READING_PLAN.length !== CHALLENGE_DAYS) {
  console.warn(`[challenge] reading plan has ${READING_PLAN.length} days`);
}

const EN: Record<string, string> = { ...en1, ...en2, ...en3 };

export type DayField = "title" | "insight" | "focus" | "prayer" | "action" | "how" | "question";

/** Localized day copy with the English original as the fallback. */
export function dayText(day: number, field: DayField): string {
  const key = `chd.${day}.${field}`;
  return tc(key) ?? EN[key] ?? "";
}

export type ChallengeDay = ReadingRef & {
  day: number;
  title: string;
  insight: string;
  focus: string;
  prayer: string;
  action: string;
  how: string;
  question: string;
};

export function challengeDay(day: number): ChallengeDay {
  const n = Math.min(CHALLENGE_DAYS, Math.max(1, Math.round(day)));
  const ref = READING_PLAN[n - 1];
  return {
    ...ref,
    day: n,
    title: dayText(n, "title"),
    insight: dayText(n, "insight"),
    focus: dayText(n, "focus"),
    prayer: dayText(n, "prayer"),
    action: dayText(n, "action"),
    how: dayText(n, "how"),
    question: dayText(n, "question"),
  };
}

/* ── Stages: five lamps, fifteen days each ───────────────────────────────── */

export type Stage = { index: number; key: string; from: number; to: number };

export const STAGES: Stage[] = [
  { index: 0, key: "spark", from: 1, to: 15 },
  { index: 1, key: "ember", from: 16, to: 30 },
  { index: 2, key: "glow", from: 31, to: 45 },
  { index: 3, key: "radiance", from: 46, to: 60 },
  { index: 4, key: "beacon", from: 61, to: 75 },
];

export function stageForDay(day: number): Stage {
  return STAGES.find((s) => day >= s.from && day <= s.to) ?? STAGES[STAGES.length - 1];
}

/** Lamp tier unlocked by the number of completed days (0–4). */
export function lampTierFor(completed: number): number {
  return Math.min(4, Math.floor(Math.max(0, completed) / 15));
}

export const MILESTONES = [1, 7, 15, 30, 45, 60, 75] as const;

/* ── Book resolution per bundled edition ─────────────────────────────────── */

/**
 * The Hindi edition ships its New Testament in a different file order (Acts,
 * 1 Peter and 3 John sit at the end). Map canonical → file index explicitly.
 */
const HI_NT: Record<number, number> = {
  43: 63, 44: 43, 45: 44, 46: 45, 47: 46, 48: 47, 49: 48, 50: 49, 51: 50, 52: 51,
  53: 52, 54: 53, 55: 54, 56: 55, 57: 56, 58: 57, 59: 64, 60: 58, 61: 59, 62: 60,
  63: 65, 64: 61, 65: 62,
};

/**
 * File index of a canonical book in a language edition. Indonesian ships the
 * New Testament only, so its files start at Matthew (canonical 39).
 */
export function bookFileIndex(lang: string, canonical: number, books?: { canonicalId: number }[]): number {
  if (lang === "hi") return HI_NT[canonical] ?? canonical;
  if (books && books.length !== 66) {
    const i = books.findIndex((b) => b.canonicalId === canonical);
    if (i >= 0) return i;
  }
  return canonical;
}
