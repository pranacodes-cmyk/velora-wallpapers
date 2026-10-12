import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useT, getLang } from "@/i18n";
import { Button } from "@/components/ui/button";
import { loadEdition, loadBibleBook, readLocal, writeLocal, type BibleEdition, type VersePosition } from "@/services/bibleReader";

const POSITION_KEY = "ps_bible_chapter_v1";
const selectClass = "h-10 min-w-0 rounded-full border border-border bg-card px-3 text-sm font-semibold text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** One chapter at a time with a book/chapter picker — never an endless page. */
export function BlockerBible() {
  const { t } = useT();
  const lang = getLang();
  const [edition, setEdition] = useState<BibleEdition>();
  const [pos, setPos] = useState(() => readLocal<VersePosition>(POSITION_KEY, { book: 0, chapter: 0, verse: 0 }));
  const [verses, setVerses] = useState<string[]>();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let live = true;
    setError(false);
    loadEdition(lang).then((ed) => { if (live) setEdition(ed); }).catch(() => live && setError(true));
    return () => { live = false; };
  }, [lang, retry]);

  useEffect(() => {
    if (!edition) return;
    let live = true;
    const book = Math.min(Math.max(0, pos.book), edition.books.length - 1);
    setVerses(undefined);
    loadBibleBook(lang, book).then((data) => {
      if (!live) return;
      const chapter = Math.min(Math.max(0, pos.chapter), data.length - 1);
      setVerses(data[chapter]);
      writeLocal(POSITION_KEY, { book, chapter, verse: 0 });
      scroller.current?.scrollTo({ top: 0 });
    }).catch(() => live && setError(true));
    return () => { live = false; };
  }, [edition, lang, pos.book, pos.chapter, retry]);

  const go = (delta: number) => {
    if (!edition) return;
    let { book, chapter } = pos;
    chapter += delta;
    if (chapter >= edition.books[book].chapters) { book = (book + 1) % edition.books.length; chapter = 0; }
    if (chapter < 0) { book = (book - 1 + edition.books.length) % edition.books.length; chapter = edition.books[book].chapters - 1; }
    setPos({ book, chapter, verse: 0 });
  };

  const current = edition?.books[pos.book];
  return <div className="flex min-h-0 flex-1 flex-col">
    {edition && current && <div className="mx-6 mt-2 grid shrink-0 grid-cols-[1fr_auto] gap-2">
      <select aria-label={t("bible.books")} className={selectClass} value={pos.book} onChange={(e) => setPos({ book: Number(e.target.value), chapter: 0, verse: 0 })}>
        {edition.books.map((b, i) => <option key={b.canonicalId} value={i}>{b.name}</option>)}
      </select>
      <select aria-label={t("bible.chapter")} className={selectClass} value={pos.chapter} onChange={(e) => setPos({ ...pos, chapter: Number(e.target.value) })}>
        {Array.from({ length: current.chapters }, (_, i) => <option key={i} value={i}>{t("bible.chapter")} {i + 1}</option>)}
      </select>
    </div>}
    <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
      {error ? <div className="py-4 text-center"><p className="text-sm text-muted-foreground">{t("bible.error")}</p><Button variant="ghost" onClick={() => setRetry((n) => n + 1)}>{t("bible.retry")}</Button></div>
        : !verses || !current ? <p className="py-5 text-center text-xs text-muted-foreground">{t("bible.loading")}</p>
        : <section>
          <h2 className="mb-5 text-center text-sm font-semibold text-primary">{current.name} · {t("bible.chapter")} {pos.chapter + 1}</h2>
          {verses.map((text, i) => <p key={i} className="bible-text mb-4 text-[19px] leading-relaxed text-foreground"><sup className="mr-1.5 text-xs font-semibold text-primary">{i + 1}</sup>{text}</p>)}
          <div className="mt-6 grid grid-cols-2 gap-2">
            <Button variant="outline" className="rounded-full" onClick={() => go(-1)}><ChevronLeft className="h-4 w-4" />{t("bible.previous")}</Button>
            <Button variant="outline" className="rounded-full" onClick={() => go(1)}>{t("bible.next")}<ChevronRight className="h-4 w-4" /></Button>
          </div>
          <p className="mt-6 text-center text-[11px] text-muted-foreground">{edition?.name}</p>
        </section>}
    </div>
  </div>;
}
