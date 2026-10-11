import { supabase } from "@/integrations/supabase/client";

/**
 * Scripture Gate (Pro): the full English KJV Bible, read in order, a few
 * verses per Sacred Pause. The text lives on the server (`bible_kjv`, ids are
 * canonical reading order 1..31100); the next verses are cached so the gate
 * still opens offline. Mirrors flutter_app/lib/core/services/bible_gate_service.dart.
 */
export type BibleVerse = { id: number; book: string; chapter: number; verse: number; text: string };

export const VERSES_PER_PAUSE = 3;
export const LAST_VERSE_ID = 31100;
const POS_KEY = "ps_bible_pos";
const CACHE_KEY = "ps_bible_cache";
const READ_KEY = "ps_bible_read";

export const bibleProgress = () => {
  const pos = Number(localStorage.getItem(POS_KEY) || 1);
  return { pos, read: Number(localStorage.getItem(READ_KEY) || 0), percent: Math.min(100, ((pos - 1) / LAST_VERSE_ID) * 100) };
};

const readCache = (): BibleVerse[] => {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || "[]"); } catch { return []; }
};

/** Next passage from the saved position — server first, cache as fallback. */
export async function loadPassage(count = VERSES_PER_PAUSE): Promise<BibleVerse[]> {
  const { pos } = bibleProgress();
  const cached = readCache().filter((v) => v.id >= pos);
  if (cached.length >= count && cached[0].id === pos) {
    if (cached.length < count * 3) void refill(pos);
    return cached.slice(0, count);
  }
  const fresh = await refill(pos);
  return (fresh.length ? fresh : cached).slice(0, count);
}

async function refill(pos: number): Promise<BibleVerse[]> {
  const { data, error } = await supabase.from("bible_kjv")
    .select("id,book,chapter,verse,text").gte("id", pos).order("id").limit(30);
  if (error || !data) return [];
  localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  return data as BibleVerse[];
}

/** Moves the bookmark past what was read; wraps to Genesis after Revelation. */
export function markRead(lastId: number, versesRead: number) {
  const next = lastId >= LAST_VERSE_ID ? 1 : lastId + 1;
  localStorage.setItem(POS_KEY, String(next));
  localStorage.setItem(READ_KEY, String(bibleProgress().read + versesRead));
}

export const refOf = (v: BibleVerse) => `${v.book} ${v.chapter}:${v.verse}`;
