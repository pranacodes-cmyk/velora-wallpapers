import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { getLang } from "@/i18n";
import { Button } from "@/components/ui/button";
import { loadEdition, loadBibleBook, readLocal, writeLocal, type BibleEdition, type VersePosition } from "@/services/bibleReader";

const POSITION_KEY = "ps_bible_chapter_v1";
type Chapter = { book: number; chapter: number; name: string; verses: string[] };

export function BlockerBible() {
  const { t } = useT();
  const lang = getLang();
  const [edition, setEdition] = useState<BibleEdition>();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const sentinel = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const generation = useRef(0);

  useEffect(() => {
    const current = ++generation.current;
    setChapters([]); setError(false); setEdition(undefined);
    loading.current = true;
    const pos = readLocal<VersePosition>(POSITION_KEY, { book: 0, chapter: 0, verse: 0 });
    loadEdition(lang).then(async (ed) => {
      const book = Math.min(Math.max(0, pos.book), ed.books.length - 1);
      const data = await loadBibleBook(lang, book);
      const chapter = Math.min(Math.max(0, pos.chapter), data.length - 1);
      if (current !== generation.current) return;
      setEdition(ed);
      setChapters([{ book, chapter, name: ed.books[book].name, verses: data[chapter] }]);
    }).catch(() => { if (current === generation.current) setError(true); })
      .finally(() => { if (current === generation.current) loading.current = false; });
    return () => { generation.current++; };
  }, [lang, retry]);

  useEffect(() => {
    const node = sentinel.current;
    const last = chapters[chapters.length - 1];
    if (!node || !edition || !last) return;
    const current = generation.current;
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || loading.current) return;
      loading.current = true; setError(false);
      let book = last.book, chapter = last.chapter + 1;
      if (chapter >= edition.books[book].chapters) { book = (book + 1) % edition.books.length; chapter = 0; }
      try {
        const data = await loadBibleBook(lang, book);
        if (current !== generation.current) return;
        setChapters((prev) => [...prev, { book, chapter, name: edition.books[book].name, verses: data[chapter] }]);
        writeLocal(POSITION_KEY, { book, chapter, verse: 0 });
      } catch { if (current === generation.current) setError(true); }
      finally { if (current === generation.current) loading.current = false; }
    }, { root: node.closest("[data-bible-scroll]"), threshold: 0.1 });
    observer.observe(node);
    return () => observer.disconnect();
  }, [chapters, edition, lang]);

  return <div data-bible-scroll className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
    {edition && <p className="mb-6 text-center text-xs text-muted-foreground">{edition.name}</p>}
    {chapters.map((ch) => <section key={`${ch.book}:${ch.chapter}`} className="pb-8">
      <h2 className="mb-5 text-center text-sm font-semibold text-primary">{ch.name} · {t("bible.chapter")} {ch.chapter + 1}</h2>
      {ch.verses.map((text, i) => <p key={i} className="bible-text mb-5 text-[22px] leading-relaxed text-foreground"><sup className="mr-2 text-xs font-semibold text-primary">{i + 1}</sup>{text}</p>)}
    </section>)}
    {error ? <div className="py-4 text-center"><p className="text-sm text-muted-foreground">{t("bible.error")}</p><Button variant="ghost" onClick={() => setRetry((n) => n + 1)}>{t("bible.retry")}</Button></div> : <div ref={sentinel} className="py-5 text-center text-xs text-muted-foreground">{t("bible.loading")}</div>}
  </div>;
}