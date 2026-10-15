// Pro Journeys — four guided premium journeys beside 75 Days of Light.
//
// Every day has three beats: Word (a New Testament passage loaded from the
// bundled Bible of the active language + a short insight), Practice (an
// interaction unique to the journey) and Mission (one practical real-life
// step). Copy lives in `src/i18n/screens/projourneys/*` under `pj.*`.
// Passages are New Testament only so every bundled edition — including the
// Indonesian NT — can serve them offline.
// Flutter mirror: `flutter_app/lib/core/services/pro_journeys.dart`.
import { t } from "@/i18n";
import identityCover from "@/assets/projourney/identity.webp";
import peaceCover from "@/assets/projourney/peace.webp";
import freedomCover from "@/assets/projourney/freedom.webp";
import prayerCover from "@/assets/projourney/prayer.webp";

export const PRO_JOURNEY_IDS = ["identity", "peace", "freedom", "prayer"] as const;
export type ProJourneyId = (typeof PRO_JOURNEY_IDS)[number];

/** The interaction used in the Practice beat. */
export type PracticeKind = "declare" | "breathe" | "battle" | "intercede";

/** Canonical (0-based Protestant) book index, chapter, inclusive verse range. */
export type Passage = { book: number; chapter: number; from: number; to: number };

export interface ProJourney {
  id: ProJourneyId;
  days: number;
  emoji: string;
  practice: PracticeKind;
  cover: string;
  /** One passage per day (index 0 = Day 1). */
  passages: Passage[];
  /** Mission emoji per day (index 0 = Day 1). */
  missionEmoji: string[];
}

const B = {
  matt: 39, mark: 40, luke: 41, john: 42, rom: 44, cor1: 45, cor2: 46, gal: 47,
  eph: 48, phil: 49, col: 50, thes1: 51, tim1: 53, tim2: 54, titus: 55, heb: 57,
  jas: 58, pet1: 59, pet2: 60, john1: 61, john3: 63,
} as const;

const p = (book: number, chapter: number, from: number, to = from): Passage => ({ book, chapter, from, to });

/** Definition order = display order on the Journey tab. */
export const PRO_JOURNEYS: ProJourney[] = [
  {
    id: "identity", days: 7, emoji: "👑", practice: "declare", cover: identityCover,
    passages: [
      p(B.eph, 2, 10), p(B.john1, 3, 1), p(B.rom, 8, 1), p(B.pet1, 2, 9),
      p(B.cor2, 5, 17), p(B.tim2, 1, 7), p(B.matt, 5, 14, 16),
    ],
    missionEmoji: ["🪞", "🎨", "✍️", "🤝", "🧹", "🦁", "✨"],
  },
  {
    id: "peace", days: 14, emoji: "🕊️", practice: "breathe", cover: peaceCover,
    passages: [
      p(B.matt, 11, 28), p(B.john, 14, 27), p(B.pet1, 5, 7), p(B.matt, 6, 34),
      p(B.luke, 12, 24), p(B.phil, 4, 6), p(B.rom, 12, 2), p(B.mark, 4, 39),
      p(B.mark, 6, 31), p(B.heb, 13, 5, 6), p(B.john, 16, 33), p(B.cor1, 6, 19, 20),
      p(B.rom, 15, 13), p(B.col, 3, 15),
    ],
    missionEmoji: ["📝", "🔕", "🎒", "📅", "🌿", "🙏", "🧠", "📞", "🌙", "💬", "🧾", "💧", "🎵", "🛡️"],
  },
  {
    id: "freedom", days: 21, emoji: "🔓", practice: "battle", cover: freedomCover,
    passages: [
      p(B.john, 8, 36), p(B.cor1, 10, 13), p(B.gal, 5, 1), p(B.rom, 12, 2),
      p(B.jas, 5, 16), p(B.jas, 4, 7, 8), p(B.titus, 2, 11, 12), p(B.rom, 8, 14),
      p(B.cor1, 6, 12), p(B.matt, 26, 41), p(B.cor2, 12, 9), p(B.john1, 1, 9),
      p(B.eph, 4, 22, 24), p(B.heb, 12, 1), p(B.rom, 13, 14), p(B.phil, 3, 13, 14),
      p(B.pet2, 1, 3), p(B.jas, 1, 12), p(B.gal, 6, 2), p(B.thes1, 5, 23, 24),
      p(B.rom, 6, 14),
    ],
    missionEmoji: [
      "🔍", "🚪", "🗓️", "📱", "🤝", "⏱️", "🏆", "🔄", "📊", "🌙", "💪",
      "🧭", "📝", "🧹", "🔐", "🎯", "🛠️", "📈", "🫶", "✉️", "🏁",
    ],
  },
  {
    id: "prayer", days: 14, emoji: "🛡️", practice: "intercede", cover: prayerCover,
    passages: [
      p(B.matt, 6, 6), p(B.luke, 11, 2), p(B.phil, 4, 19), p(B.col, 3, 13),
      p(B.luke, 18, 1), p(B.eph, 3, 16, 19), p(B.mark, 11, 24), p(B.luke, 6, 27, 28),
      p(B.rom, 8, 26), p(B.thes1, 5, 16, 18), p(B.matt, 18, 19, 20), p(B.tim1, 2, 1, 2),
      p(B.luke, 22, 42), p(B.col, 4, 2),
    ],
    missionEmoji: ["🪑", "📋", "🍞", "🕊️", "📌", "💌", "✍️", "🤐", "🌄", "⏰", "👥", "🌍", "🤲", "📜"],
  },
];

/** The 90-second rescue reads 1 Corinthians 10:13. */
export const SOS_PASSAGE: Passage = p(B.cor1, 10, 13);

export const BATTLES = ["scroll", "lust", "anger", "gaming", "substance", "delay", "other"] as const;
export type Battle = (typeof BATTLES)[number];
export const BATTLE_EMOJI: Record<Battle, string> = {
  scroll: "📱", lust: "🔒", anger: "🔥", gaming: "🎮", substance: "🚭", delay: "⏳", other: "✍️",
};

export const proJourneyById = (id: string): ProJourney | undefined => PRO_JOURNEYS.find((j) => j.id === id);
export const isProJourneyId = (id: string | undefined): id is ProJourneyId =>
  Boolean(id && (PRO_JOURNEY_IDS as readonly string[]).includes(id));

export type ProJourneyDay = {
  day: number;
  title: string;
  word: string;
  context: string;
  teaching: string;
  reflect: string;
  guide: string;
  exercise: string;
  /** Practice copy: declaration / battle prayer / prayer prompt. */
  practice: string;
  /** Breath prayer phrases (breathe journeys only). */
  breatheIn: string;
  breatheOut: string;
  mission: string;
  why: string;
  emoji: string;
  passage: Passage;
};

/** Localized copy for one day of a journey. */
export function proJourneyDay(j: ProJourney, day: number): ProJourneyDay {
  const n = Math.min(j.days, Math.max(1, Math.round(day)));
  const k = `pj.${j.id}.${n}`;
  const practiceKey = j.practice === "declare" ? "dec" : j.practice === "battle" ? "pr" : j.practice === "intercede" ? "pp" : "";
  return {
    day: n,
    title: t(`${k}.t`),
    word: t(`${k}.w`),
    context: t(`${k}.context`),
    teaching: t(`${k}.teaching`),
    reflect: t(`${k}.reflect`),
    guide: t(`${k}.guide`),
    exercise: t(`${k}.exercise`),

    practice: practiceKey ? t(`${k}.${practiceKey}`) : "",
    breatheIn: j.practice === "breathe" ? t(`${k}.in`) : "",
    breatheOut: j.practice === "breathe" ? t(`${k}.out`) : "",
    mission: t(`${k}.m`),
    why: t(`${k}.y`),
    emoji: j.missionEmoji[n - 1] ?? j.emoji,
    passage: j.passages[n - 1],
  };
}

/** Day 1 of every journey is a free sample; the rest needs Pro. */
export const FREE_DAYS = 1;
