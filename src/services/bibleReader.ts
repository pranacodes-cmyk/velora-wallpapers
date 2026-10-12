import { gunzipSync, strFromU8 } from "fflate";
import type { LangCode } from "@/i18n/config";

export type BibleBook = { name: string; canonicalId: number; chapters: number };
export type BibleEdition = { language: string; name: string; license: string; source: string; books: BibleBook[] };
export type VersePosition = { book: number; chapter: number; verse: number };
export type ReaderPrefs = VersePosition & { mode: "feed" | "normal"; font: "serif" | "sans"; size: number; theme: "night" | "paper" };
export const READER_KEY = "prayly_bible_reader_v1";
export const LIKES_KEY = "prayly_bible_likes_v1";
export const NOTES_KEY = "prayly_bible_notes_v1";
export const verseKey = (p: VersePosition) => `${p.book}:${p.chapter}:${p.verse}`;
export function readLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}
export function writeLocal(key: string, value: unknown) { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be blocked by the browser. */ } }
export const initialReader = (): ReaderPrefs => ({ book: 0, chapter: 0, verse: 0, mode: "feed", font: "serif", size: 26, theme: "night", ...readLocal<Partial<ReaderPrefs>>(READER_KEY, {}) });
const books = new Map<string, string[][]>();
export async function loadEdition(lang: LangCode): Promise<BibleEdition> {
  const res = await fetch(`/bible/${lang}/index.json`);
  if (!res.ok) throw new Error("Bible unavailable");
  return res.json();
}
export async function loadBibleBook(lang: LangCode, book: number): Promise<string[][]> {
  const key = `${lang}:${book}`;
  const cached = books.get(key);
  if (cached) return cached;
  const res = await fetch(`/bible/${lang}/${book}.json.gz`);
  if (!res.ok) throw new Error("Bible unavailable");
  const bytes = new Uint8Array(await res.arrayBuffer());
  const text = bytes[0] === 31 && bytes[1] === 139 ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes);
  const data: string[][] = JSON.parse(text);
  if (!Array.isArray(data) || !data.length) throw new Error("Invalid Bible");
  if (books.size > 3) books.delete(books.keys().next().value ?? "");
  books.set(key, data);
  return data;
}