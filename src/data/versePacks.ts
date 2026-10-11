// Unified verse-pack registry.
//
// Two groups, in this order (order matters for the UI):
//   1. "situation"  → Life-situation packs (Grief, Anxiety, Healing, …)
//   2. "mood"       → the original mood packs (Peace, Hope, …), kept but lower
//
// One active pack at a time; the id is persisted by verseMoodPacks' store
// (same localStorage key as before, so existing users keep their pack).

import type { DailyVerse } from "@/data/dailyVerses";
import { MOOD_META, MOOD_ORDER, type VerseMood } from "@/data/verseBackgrounds";
import { getMoodPackVerses } from "@/data/verseMoodPacks";
import { SITUATION_PACKS } from "@/data/versePacksData";

export type VersePackGroup = "situation" | "mood";

export interface VersePack {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  group: VersePackGroup;
  verses: DailyVerse[];
}

export const VERSE_PACK_GROUPS: Array<{
  id: VersePackGroup;
  title: string;
  subtitle: string;
}> = [
  {
    id: "situation",
    title: "What are you walking through?",
    subtitle: "Verses for real life — pick what fits today",
  },
  {
    id: "mood",
    title: "Or pick a feeling",
    subtitle: "Classic packs for everyday devotion",
  },
];

const situationPacks: VersePack[] = SITUATION_PACKS.map((p) => ({
  id: p.id,
  label: p.label,
  emoji: p.emoji,
  tagline: p.tagline,
  group: "situation" as const,
  verses: p.verses,
}));

const moodPacks: VersePack[] = MOOD_ORDER.map((m: VerseMood) => ({
  id: m,
  label: MOOD_META[m].label,
  emoji: MOOD_META[m].emoji,
  tagline: MOOD_META[m].tagline,
  group: "mood" as const,
  verses: getMoodPackVerses(m),
}));

/** Situation packs first — they're what people actually search for. */
export const VERSE_PACKS: VersePack[] = [...situationPacks, ...moodPacks];

export const VERSE_PACK_IDS: string[] = VERSE_PACKS.map((p) => p.id);

export const TOTAL_PACK_VERSES = VERSE_PACKS.reduce((n, p) => n + p.verses.length, 0);

export function getVersePack(id: string | null | undefined): VersePack | null {
  if (!id) return null;
  return VERSE_PACKS.find((p) => p.id === id) || null;
}

export function isValidVersePackId(id: string | null | undefined): boolean {
  return !!getVersePack(id);
}

export function getPacksByGroup(group: VersePackGroup): VersePack[] {
  return VERSE_PACKS.filter((p) => p.group === group);
}

/** Verse for a pack on a given date — rotates daily, loops at the end. */
export function getVersePackVerse(id: string, date?: Date): DailyVerse | null {
  const pack = getVersePack(id);
  if (!pack || pack.verses.length === 0) return null;
  const d = date || new Date();
  const epochDay = Math.floor(d.getTime() / 86400000);
  const len = pack.verses.length;
  const idx = ((epochDay % len) + len) % len;
  return pack.verses[idx];
}
