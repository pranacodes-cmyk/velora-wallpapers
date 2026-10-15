import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronDown, ChevronLeft, ChevronRight, Heart, MessageCircle, Share2, SlidersHorizontal, X, Bookmark, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { LANGUAGES, type LangCode } from "@/i18n/config";
import { nativeShare } from "@/utils/nativeShare";
import { haptic } from "@/utils/haptics";
import { initialReader, loadEdition, loadBibleBook, readLocal, writeLocal, verseKey, READER_KEY, LIKES_KEY, NOTES_KEY, type BibleEdition, type ReaderPrefs } from "@/services/bibleReader";
import { usePremium } from "@/hooks/usePremium";
import { recordBibleVerseView, recordBibleChapterDone } from "@/services/bibleAds";
import { track } from "@/services/analytics";
import scenery from "@/assets/onboarding-bg-sunrise.webp";

export default function BibleReader() {
  const { t, lang } = useT();
  const navigate = useNavigate();
  const [language, setLanguage] = useState<LangCode>(() => {
    const saved = readLocal<string>("prayly_bible_language_v1", lang);
    return LANGUAGES.some(l => l.code === saved) ? saved as LangCode : lang;
  });
  const [prefs, setPrefs] = useState(initialReader);
  const [edition, setEdition] = useState<BibleEdition>();
  const [chapters, setChapters] = useState<string[][]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [panel, setPanel] = useState<"books" | "style" | "notes" | null>(null);
  const [query, setQuery] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [likes, setLikes] = useState<string[]>(() => readLocal(LIKES_KEY, []));
  const [notes, setNotes] = useState<Record<string, string>>(() => readLocal(NOTES_KEY, {}));
  const [draft, setDraft] = useState("");
  const feed = useRef<HTMLDivElement>(null);
  const { isPremium } = usePremium();
  const lastVerse = useRef(-1);
  const position = { book: prefs.book, chapter: prefs.chapter, verse: prefs.verse };
  const readerKey = (i: number) => verseKey({ ...position, book: edition?.books[prefs.book]?.canonicalId ?? prefs.book, verse: i });
  const key = readerKey(prefs.verse);
  const verses = chapters[prefs.chapter] ?? [];
  const reference = `${edition?.books[prefs.book]?.name ?? ""} ${prefs.chapter + 1}:${prefs.verse + 1}`;
  const update = (value: Partial<ReaderPrefs>) => setPrefs(p => ({ ...p, ...value }));

  useEffect(() => { writeLocal(READER_KEY, prefs); }, [prefs]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(false); setChapters([]);
    loadEdition(language).then(async e => {
      const book = Math.min(prefs.book, e.books.length - 1);
      const c = await loadBibleBook(language, book);
      return { e, c, book };
    }).then(({e, c, book}) => {
      if (!active) return;
      setEdition(e); setChapters(c); setLoading(false);
      setPrefs(p => ({ ...p, book, chapter: Math.min(p.chapter, c.length - 1), verse: Math.min(p.verse, (c[Math.min(p.chapter, c.length - 1)]?.length ?? 1) - 1) }));
    }).catch(() => { if (active) { setError(true); setLoading(false); } });
    return () => { active = false; };
  }, [language, prefs.book, retry]);
  useEffect(() => {
    if (loading) return;
    const el = feed.current;
    const target = el?.querySelector<HTMLElement>(`[data-verse="${prefs.verse}"]`);
    if (el && target) el.scrollTop = target.offsetTop - el.offsetTop;
  }, [loading, prefs.chapter, prefs.mode, savedOnly]);

  useEffect(() => { track("bible_opened", { lang: language }); }, []);
  useEffect(() => { if (!loading && !error && edition) track("bible_chapter_viewed", { lang: language, book: prefs.book, book_name: edition.books[prefs.book]?.name, chapter: prefs.chapter + 1, mode: prefs.mode }); }, [loading, error, edition, prefs.book, prefs.chapter]);
  const like = (id: string) => {
    track("bible_verse_liked", { ref: id, liked: !likes.includes(id) });
    haptic("light");
    const next = likes.includes(id) ? likes.filter(k => k !== id) : [...likes, id];
    setLikes(next); writeLocal(LIKES_KEY, next);
  };
  const openNotes = (index: number) => {
    const id = readerKey(index);
    update({ verse: index }); setDraft(notes[id] ?? ""); setPanel("notes");
  };
  const saveNote = () => {
    const next = { ...notes };
    if (draft.trim()) next[key] = draft.trim(); else delete next[key];
    writeLocal(NOTES_KEY, next); setNotes(next); setPanel(null); haptic("light");
    track("bible_note_saved", { has_text: !!draft.trim() });
  };
  const share = (index: number) => { track("bible_verse_shared", { book: prefs.book, chapter: prefs.chapter + 1, verse: index + 1 }); return nativeShare({ title: "Prayly: Bible Prayer & Verse", text: `${verses[index]}\n\n${edition?.books[prefs.book]?.name} ${prefs.chapter + 1}:${index + 1} · ${edition?.name}\nPrayly: Bible Prayer & Verse` }); };
  const moveChapter = (direction: number) => {
    let book = prefs.book; let chapter = prefs.chapter + direction;
    if (chapter >= chapters.length) { book++; chapter = 0; }
    if (chapter < 0) { book--; chapter = (edition?.books[book]?.chapters ?? 1) - 1; }
    if (book < 0 || book >= (edition?.books.length ?? 66)) return;
    if (direction > 0) { recordBibleChapterDone(!!isPremium); track("bible_chapter_completed", { book: prefs.book, chapter: prefs.chapter + 1 }); }
    lastVerse.current = -1;
    update({ book, chapter, verse: 0 });
  };
  const actions = (i: number, vertical = false) => {
    const id = readerKey(i);
    return <div className={vertical ? "flex flex-col gap-5" : "flex gap-1"}>
      <Button variant="ghost" size="icon" aria-label={t("bible.like")} aria-pressed={likes.includes(id)} onClick={() => like(id)} className={likes.includes(id) ? "text-primary" : "text-foreground/70"}><Heart className="h-6 w-6" fill={likes.includes(id) ? "currentColor" : "none"} /></Button>
      <Button variant="ghost" size="icon" aria-label={t("bible.notes")} onClick={() => openNotes(i)} className={notes[id] ? "text-primary" : "text-foreground/70"}><MessageCircle className="h-6 w-6" />{notes[id] && <span className="sr-only">1</span>}</Button>
      <Button variant="ghost" size="icon" aria-label={t("bible.share")} onClick={() => void share(i)}><Share2 className="h-5 w-5" /></Button>
    </div>;
  };

  return <main className={`bible-reader bible-${prefs.theme} fixed inset-0 z-40 flex flex-col pb-[calc(88px+env(safe-area-inset-bottom))] bg-background text-foreground`}>
    <header className="relative z-10 border-b border-border bg-background px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-2">
        <span className="h-10 w-10" aria-hidden />
        <div className="flex gap-1" role="tablist" aria-label={t("bible.title")}>
          {(["feed", "normal"] as const).map(mode => <Button key={mode} role="tab" aria-selected={prefs.mode === mode} variant="ghost" onClick={() => update({ mode })} className={`rounded-none border-b-2 px-4 text-base ${prefs.mode === mode ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}>{t(`bible.${mode}`)}</Button>)}
        </div>
        <Button variant="ghost" size="icon" aria-label={t("bible.appearance")} onClick={() => setPanel("style")}><SlidersHorizontal className="h-5 w-5" /></Button>
      </div>
      <div className="mx-auto mt-2 flex max-w-3xl items-center justify-between gap-2">
        <Button variant="ghost" className="h-9 min-w-0 gap-2 px-2 text-sm" onClick={() => { setQuery(""); setPanel("books"); }}><BookOpen className="h-4 w-4 shrink-0 text-primary" /><span className="truncate">{edition?.books[prefs.book]?.name ?? t("bible.title")} {prefs.chapter + 1}</span><ChevronDown className="h-3 w-3 shrink-0" /></Button>
        <Button variant="ghost" size="icon" aria-label={t("bible.saved")} aria-pressed={savedOnly} onClick={() => setSavedOnly(!savedOnly)} className={savedOnly ? "text-primary" : "text-muted-foreground"}><Bookmark className="h-4 w-4" fill={savedOnly ? "currentColor" : "none"} /></Button>
      </div>
    </header>
    {loading || error ? <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 text-center"><BookOpen className="h-9 w-9 text-primary" /><p>{t(error ? "bible.error" : "bible.loading")}</p>{error && <Button onClick={() => setRetry(r => r + 1)}>{t("bible.retry")}</Button>}</div> : <>
      <div ref={feed} className={`relative min-h-0 flex-1 overflow-y-auto ${prefs.mode === "feed" ? "snap-y snap-mandatory" : ""}`} onScroll={e => {
        if (prefs.mode !== "feed") return;
        const el = e.currentTarget;
        const items = Array.from(el.querySelectorAll<HTMLElement>("[data-verse]"));
        const nearest = items.find(item => item.offsetTop - el.offsetTop >= el.scrollTop - el.clientHeight / 2);
        if (nearest) {
          const v = Number(nearest.dataset.verse);
          if (v !== lastVerse.current) { if (lastVerse.current >= 0) recordBibleVerseView(!!isPremium); lastVerse.current = v; }
          update({ verse: v });
        }
      }}>
        {savedOnly && !verses.some((_, i) => likes.includes(readerKey(i))) && <p className="p-12 text-center text-muted-foreground">{t("bible.empty")}</p>}
        {prefs.mode === "normal" && <div className="mx-auto max-w-2xl px-7 pb-8 pt-10"><p className="text-xs text-primary">{edition?.name}</p><h1 className="mt-2 font-serif text-3xl">{edition?.books[prefs.book]?.name} {prefs.chapter + 1}</h1></div>}
        {verses.map((text, i) => {
          const id = readerKey(i);
          if (!text) return null;
          if (savedOnly && !likes.includes(id)) return null;
          return prefs.mode === "feed" ? <article key={id} data-verse={i} className="relative flex h-full min-h-full snap-start snap-always items-center justify-center overflow-hidden">
            {prefs.theme === "night" && <><img src={scenery} alt="" className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-20" /><div className="bible-image-shade pointer-events-none absolute inset-0" /></>}
            <div className="relative z-10 max-h-full w-full max-w-2xl overflow-y-auto py-10 pl-7 pr-20">
              <p className="mb-6 text-xs font-semibold text-primary">{edition?.books[prefs.book]?.name} {prefs.chapter + 1}:{i + 1}</p>
              <p className={`bible-text bible-size-${prefs.size} ${prefs.font === "serif" ? "font-serif" : "font-sans"} leading-relaxed`}>{text}</p>
              <p className="mt-7 text-[11px] text-muted-foreground">{edition?.name}</p>
            </div>
            <div className="absolute bottom-10 right-4 z-20">{actions(i, true)}</div>
          </article> : <article key={id} data-verse={i} className="mx-auto max-w-2xl px-7 pb-7" onClick={() => update({ verse: i })}>
            <p className={`bible-text bible-size-${prefs.size} ${prefs.font === "serif" ? "font-serif" : "font-sans"} leading-relaxed`}><sup className="mr-2 font-sans text-xs text-primary">{i + 1}</sup>{text}</p>
            <div className="mt-2 flex justify-end">{actions(i)}</div>
          </article>;
        })}
      </div>
      <footer className="flex items-center justify-between border-t border-border bg-background px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
        <Button variant="ghost" size="icon" aria-label={t("bible.previous")} disabled={prefs.book === 0 && prefs.chapter === 0} onClick={() => moveChapter(-1)}><ChevronLeft className="h-5 w-5" /></Button>
        <span className="text-xs text-muted-foreground">{prefs.mode === "feed" ? `${prefs.verse + 1} / ${verses.length}` : `${t("bible.chapter")} ${prefs.chapter + 1}`}</span>
        <Button variant="ghost" size="icon" aria-label={t("bible.next")} disabled={prefs.book === (edition?.books.length ?? 66) - 1 && prefs.chapter === chapters.length - 1} onClick={() => moveChapter(1)}><ChevronRight className="h-5 w-5" /></Button>
      </footer>
    </>}
    {panel && <div className="fixed inset-0 z-30 flex items-end justify-center bg-background/80" onClick={() => setPanel(null)}><section role="dialog" aria-modal="true" aria-label={t(`bible.${panel === "style" ? "appearance" : panel}`)} className="max-h-[85dvh] w-full max-w-xl overflow-y-auto rounded-t-lg border border-border bg-card p-6 pb-[max(24px,env(safe-area-inset-bottom))] shadow-xl" onClick={e => e.stopPropagation()}>
      <div className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{t(`bible.${panel === "style" ? "appearance" : panel}`)}</h2><Button variant="ghost" size="icon" aria-label={t("bible.close")} onClick={() => setPanel(null)}><X className="h-5 w-5" /></Button></div>
      {panel === "style" && <div className="space-y-6">
        <label className="block text-sm">{t("bible.language")}<select value={language} onChange={e => { track("bible_language_changed", { lang: e.target.value }); setLanguage(e.target.value as LangCode); update({book: 0, chapter: 0, verse: 0}); writeLocal("prayly_bible_language_v1", e.target.value); }} className="mt-2 w-full rounded-md border border-border bg-background p-3">{LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.native}</option>)}</select></label>
        <div><p className="mb-2 text-sm">{t("bible.font")}</p><div className="flex gap-2">{(["serif", "sans"] as const).map(font => <Button key={font} variant={prefs.font === font ? "default" : "outline"} onClick={() => update({ font })}>{t(`bible.${font}`)}</Button>)}</div></div>
        <label className="block text-sm">{t("bible.size")} · {prefs.size}<input className="mt-4 w-full accent-primary" aria-label={t("bible.size")} type="range" min="18" max="34" step="2" value={prefs.size} onChange={e => update({ size: Number(e.target.value) })} /></label>
        <div><p className="mb-2 text-sm">{t("bible.theme")}</p><div className="flex gap-2">{(["night", "paper"] as const).map(theme => <Button key={theme} variant={prefs.theme === theme ? "default" : "outline"} onClick={() => update({ theme })}>{t(`bible.${theme}`)}</Button>)}</div></div>
        <p className="text-xs text-muted-foreground">{edition?.name} · {edition?.license}</p>
        <a href={edition?.source} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-primary underline">{edition?.source}</a>
      </div>}
      {panel === "books" && <div className="space-y-3"><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t("bible.search")} aria-label={t("bible.search")} className="w-full rounded-md border border-border bg-background p-3" />{edition?.books.map((book, b) => (!query || book.name.toLowerCase().includes(query.toLowerCase())) && <div key={b}><Button variant="ghost" className="w-full justify-between" onClick={() => update({ book: b, chapter: 0, verse: 0 })}>{book.name}{prefs.book === b && <Check className="h-4 w-4 text-primary" />}</Button>{prefs.book === b && <div className="grid grid-cols-6 gap-2 py-3">{Array.from({ length: book.chapters }, (_, c) => <Button key={c} variant={prefs.chapter === c ? "default" : "outline"} onClick={() => { update({ chapter: c, verse: 0 }); setPanel(null); }}>{c + 1}</Button>)}</div>}</div>)}</div>}
      {panel === "notes" && <div><p className="mb-2 text-xs text-primary">{reference}</p><p className="mb-4 text-sm text-muted-foreground">{t("bible.private")}</p><textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder={t("bible.placeholder")} aria-label={t("bible.notes")} maxLength={4000} rows={6} className="w-full resize-none rounded-md border border-border bg-background p-4 text-foreground" /><div className="mt-4 flex justify-between gap-2"><Button variant="ghost" onClick={() => { setDraft(""); const next = { ...notes }; delete next[key]; writeLocal(NOTES_KEY, next); setNotes(next); setPanel(null); }}>{t("bible.delete")}</Button><Button onClick={saveNote}>{t("bible.save")}</Button></div></div>}
    </section></div>}
  </main>;
}