import { useT } from "@/i18n";
import type { Passage } from "@/data/proJourneys";
import { usePassage } from "@/components/challenge/useReading";

/** A short scripture passage from the bundled Bible of the active language. */
export function PassageCard({ passage, size = "lg" }: { passage: Passage; size?: "lg" | "sm" }) {
  const { t, lang } = useT();
  const p = usePassage(lang, passage);
  return (
    <figure className={`relative overflow-hidden rounded-[22px] border border-primary/25 bg-primary/[0.06] ${size === "lg" ? "p-5" : "p-4"}`}>
      <span aria-hidden className="pointer-events-none absolute -right-12 -top-14 h-40 w-40 rounded-full pj-halo" />
      {p.status === "loading" && <p className="text-[14px] text-muted-foreground">{t("pj.verse.loading")}</p>}
      {p.status === "error" && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-[14px] text-muted-foreground">{t("pj.verse.error")}</p>
          <button type="button" onClick={p.retry} className="text-[13.5px] font-bold text-primary">{t("pj.verse.retry")}</button>
        </div>
      )}
      {p.status === "ready" && (
        <>
          <blockquote className={`relative font-serif leading-relaxed text-foreground ${size === "lg" ? "text-[19px]" : "text-[16.5px]"}`}>
            “{p.verses.join(" ")}”
          </blockquote>
          <figcaption className="relative mt-2 text-[12.5px] font-bold text-primary">{p.label}</figcaption>
        </>
      )}
    </figure>
  );
}
