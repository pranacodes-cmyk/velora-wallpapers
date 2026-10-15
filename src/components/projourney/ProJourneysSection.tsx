// Journey tab — cinematic shelf of the four Pro Journeys.
// Flutter mirror: `flutter_app/lib/screens/projourney/pro_journeys_section.dart`.
import { useNavigate } from "react-router-dom";
import { Check, Lock } from "lucide-react";
import { useT } from "@/i18n";
import { PRO_JOURNEYS, type ProJourney } from "@/data/proJourneys";
import { doneCount, journeyStatus, requiresPro } from "@/services/proJourneys";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { useProJourneys } from "./useProJourneys";

export function ProJourneysSection({ isPremium }: { isPremium: boolean }) {
  const { t } = useT();
  useProJourneys();
  return (
    <section aria-labelledby="pj-shelf" className="-mx-4">
      <div className="flex items-end justify-between gap-3 px-5">
        <div className="min-w-0">
          <h2 id="pj-shelf" className="flex items-center gap-2 text-[19px] font-bold leading-tight text-foreground">
            {t("pj.section.title")}
            <span className="rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] px-1.5 py-[1px] text-[9px] font-black tracking-[0.08em] text-[hsl(var(--paywall-cta-foreground))]">{t("pj.pro")}</span>
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("pj.section.sub")}</p>
        </div>
      </div>
      <div className="mt-3 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-2">
        {PRO_JOURNEYS.map((j) => <ShelfCard key={j.id} j={j} isPremium={isPremium} />)}
      </div>
    </section>
  );
}

function ShelfCard({ j, isPremium }: { j: ProJourney; isPremium: boolean }) {
  const { t } = useT();
  const navigate = useNavigate();
  const status = journeyStatus(j.id);
  const done = doneCount(j.id);
  const locked = !isPremium && status.kind !== "done" && (status.kind === "new" || requiresPro(status.day));

  const line =
    status.kind === "done" ? t("pj.status.done")
      : locked ? t("pj.status.locked")
        : status.kind === "new" ? t("pj.status.new")
          : status.kind === "today" ? t("pj.status.next", { n: status.day })
            : t("pj.status.wait", { n: status.day });

  return (
    <button
      type="button"
      onClick={() => { haptic("light"); track("pro_journey_card_tapped", { id: j.id, status: status.kind, premium: isPremium }); navigate(`/challenge/pro/${j.id}`); }}
      className="relative isolate h-[238px] w-[172px] shrink-0 snap-start overflow-hidden rounded-[22px] text-left shadow-[0_14px_30px_-18px_hsl(var(--poster-scrim)/0.9)] ring-1 ring-border/40 transition-transform active:scale-[0.97]"
    >
      <img src={j.cover} alt="" width={720} height={926} loading="lazy" decoding="async" className="absolute inset-0 -z-10 h-full w-full object-cover" />
      <span aria-hidden className="pj-scrim absolute inset-0 -z-10" />
      <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[hsl(var(--poster-scrim)/0.5)] px-2 py-1 text-[10.5px] font-bold text-[hsl(var(--poster-ink))] backdrop-blur-md">
        {t("pj.days", { n: j.days })}
      </span>
      {status.kind === "done" ? (
        <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-[hsl(var(--voyage-gold))] text-[hsl(var(--paywall-cta-foreground))]"><Check className="h-4 w-4" strokeWidth={3} /></span>
      ) : !isPremium ? (
        <span className="absolute right-2.5 top-2.5 grid h-7 w-7 place-items-center rounded-full bg-[hsl(var(--poster-scrim)/0.55)] text-[hsl(var(--poster-ink))] backdrop-blur-md"><Lock className="h-3.5 w-3.5" /></span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 p-3">
        <span className="line-clamp-2 font-serif text-[19px] font-semibold leading-[1.12] text-[hsl(var(--poster-ink))] [text-wrap:balance]">
          <span aria-hidden className="mr-1">{j.emoji}</span>{t(`pj.${j.id}.name`)}
        </span>
        <span className="mt-2 block h-1 overflow-hidden rounded-full bg-[hsl(var(--poster-ink)/0.22)]">
          <span className="voyage-progress block h-full rounded-full" style={{ width: `${(done / j.days) * 100}%` }} />
        </span>
        <span className={`mt-1.5 block truncate text-[12px] font-bold ${locked ? "text-[hsl(var(--premium-gold-glow))]" : "text-[hsl(var(--poster-ink)/0.9)]"}`}>{line}</span>
      </span>
    </button>
  );
}
