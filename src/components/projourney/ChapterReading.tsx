import { useT } from "@/i18n";
import type { Passage } from "@/data/proJourneys";
import { useChapter } from "@/components/challenge/useReading";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";

/** Full licensed chapter; a failed load cannot be acknowledged. */
export function ChapterReading({ passage, onRead }: { passage: Passage; onRead: () => void }) {
  const { t, lang } = useT();
  const chapter = useChapter(lang, { book: passage.book, chapter: passage.chapter, verse: passage.from });
  return <section className="space-y-5">
    {chapter.status === "loading" && <p role="status" className="text-muted-foreground">{t("pj.depth.chapterLoading")}</p>}
    {chapter.status === "error" && <div role="alert" className="space-y-3"><p className="text-muted-foreground">{t("pj.depth.chapterError")}</p><Button variant="outline" onClick={chapter.retry}>{t("pj.verse.retry")}</Button></div>}
    {chapter.status === "ready" && <>
      <h2 className="border-b border-border pb-3 font-serif text-[24px] text-foreground">{chapter.bookName} {passage.chapter}</h2>
      <div className="space-y-4">{chapter.verses.map((text, i) => <p key={i} className="font-serif text-[19px] leading-[1.8] text-foreground"><sup className="mr-2 font-sans text-[11px] font-semibold text-primary">{i + 1}</sup>{text}</p>)}</div>
      <Button onClick={onRead} className="h-auto min-h-12 w-full whitespace-normal py-3 text-[15px] font-bold">{t("pj.depth.readDone")}<ChevronRight /></Button>
    </>}
  </section>;
}