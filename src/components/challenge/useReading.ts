import { useCallback, useEffect, useState } from "react";
import { loadBibleBook, loadEdition, type BibleEdition } from "@/services/bibleReader";
import { bookFileIndex, type ReadingRef } from "@/data/challenge75";
import type { LangCode } from "@/i18n/config";

const editions = new Map<string, Promise<BibleEdition>>();

function edition(lang: LangCode) {
  let p = editions.get(lang);
  if (!p) {
    p = loadEdition(lang).catch((err) => { editions.delete(lang); throw err; });
    editions.set(lang, p);
  }
  return p;
}

/** Localized "Mark 1" label for a reading, from the bundled edition. */
export function useReadingLabel(lang: LangCode, ref: ReadingRef | null): string {
  const [label, setLabel] = useState("");
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    edition(lang)
      .then((e) => {
        const book = e.books[bookFileIndex(lang, ref.book, e.books)];
        if (alive && book) setLabel(`${book.name} ${ref.chapter}`);
      })
      .catch(() => { /* label stays empty */ });
    return () => { alive = false; };
  }, [lang, ref?.book, ref?.chapter]); // eslint-disable-line react-hooks/exhaustive-deps
  return label;
}

export type ChapterState = { status: "loading" | "ready" | "error"; verses: string[]; bookName: string };

/** Chapter text (array of verses) for a reading, loaded from the offline Bible. */
export function useChapter(lang: LangCode, ref: ReadingRef) {
  const [state, setState] = useState<ChapterState>({ status: "loading", verses: [], bookName: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, status: "loading" }));
    (async () => {
      try {
        const e = await edition(lang);
        const index = bookFileIndex(lang, ref.book, e.books);
        const chapters = await loadBibleBook(lang, index);
        const verses = chapters[ref.chapter - 1] ?? [];
        if (!verses.length) throw new Error("empty chapter");
        if (alive) setState({ status: "ready", verses, bookName: e.books[index]?.name ?? "" });
      } catch {
        if (alive) setState({ status: "error", verses: [], bookName: "" });
      }
    })();
    return () => { alive = false; };
  }, [lang, ref.book, ref.chapter, attempt]);
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}

/** Re-render on an interval (for countdowns). */
export function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function formatCountdown(ms: number, t: (k: string, v?: Record<string, string | number>) => string) {
  const total = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0 ? t("ch.time.hm", { h, m }) : t("ch.time.m", { m });
}

export type PassageRef = { book: number; chapter: number; from: number; to: number };
export type PassageState = { status: "loading" | "ready" | "error"; verses: string[]; label: string };

/** A short verse range (e.g. Matthew 11:28–30) from the offline Bible. */
export function usePassage(lang: LangCode, ref: PassageRef | null) {
  const [state, setState] = useState<PassageState>({ status: "loading", verses: [], label: "" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!ref) return;
    let alive = true;
    setState((s) => ({ ...s, status: "loading" }));
    (async () => {
      try {
        const e = await edition(lang);
        const index = bookFileIndex(lang, ref.book, e.books);
        const chapters = await loadBibleBook(lang, index);
        const verses = (chapters[ref.chapter - 1] ?? []).slice(ref.from - 1, ref.to).filter(Boolean);
        if (!verses.length) throw new Error("empty passage");
        const name = e.books[index]?.name ?? "";
        const label = `${name} ${ref.chapter}:${ref.from}${ref.to > ref.from ? `–${ref.to}` : ""}`;
        if (alive) setState({ status: "ready", verses, label });
      } catch {
        if (alive) setState({ status: "error", verses: [], label: "" });
      }
    })();
    return () => { alive = false; };
  }, [lang, ref?.book, ref?.chapter, ref?.from, ref?.to, attempt]); // eslint-disable-line react-hooks/exhaustive-deps
  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  return { ...state, retry };
}
