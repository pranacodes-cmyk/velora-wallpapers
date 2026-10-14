import { useEffect, useState } from "react";
import { Award, Check, ChevronRight, HandHeart, Sparkles } from "lucide-react";
import { createPortal } from "react-dom";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { haptic } from "@/utils/haptics";
import { VoyagePoster } from "./VoyagePoster";

export const JOURNEY_TOUR_KEY = "prayly_journey_buddy_tour_v2";

type Props = { open: boolean; onClose: () => void };

/** Three-beat cinematic introduction to the Journey buddy loop. */
export function JourneyWalkthrough({ open, onClose }: Props) {
  const { t } = useT();
  const [page, setPage] = useState(0);

  useEffect(() => { if (open) setPage(0); }, [open]);
  if (!open) return null;

  const finish = () => {
    try { localStorage.setItem(JOURNEY_TOUR_KEY, "1"); } catch { /* blocked */ }
    haptic("light");
    onClose();
  };
  const next = () => {
    haptic("light");
    if (page === 2) finish();
    else setPage((value) => value + 1);
  };

  const buddies = page === 1 ? [
    { id: "tour-dove", days: 18, avatar: "🕊️", name: "" },
    { id: "tour-lion", days: 10, avatar: "🦁", name: "" },
  ] : [];

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-background/80 backdrop-blur-md sm:items-center" role="presentation">
      <section role="dialog" aria-modal="true" aria-labelledby="journey-tour-title"
        className="challenge-rise relative flex max-h-[100dvh] w-full max-w-[520px] flex-col overflow-y-auto rounded-t-[28px] border border-primary/25 bg-card pb-[max(22px,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[28px]">
        <div className="relative shrink-0 overflow-hidden">
          <VoyagePoster key={page} days={page === 0 ? 12 : page === 1 ? 22 : 60}
            fromDays={page === 0 ? 4 : page === 1 ? 14 : 52} buddies={buddies}
            sailDelay={180} sailMs={2200} priority label={t(`ch.tour.${page + 1}.title`)} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-card to-transparent" />
        </div>

        <div className="px-6 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("ch.tour.kicker")}</p>
          <h2 id="journey-tour-title" className="mt-2 text-[25px] font-bold leading-tight text-foreground">{t(`ch.tour.${page + 1}.title`)}</h2>
          <p className="mx-auto mt-2 min-h-[44px] max-w-[34ch] text-[14px] leading-relaxed text-muted-foreground">{t(`ch.tour.${page + 1}.sub`)}</p>
          {page === 2 && <>
            <div className="mt-4 grid grid-cols-5 gap-1" aria-label={t("ch.hub.badges")}>
              {["spark", "ember", "glow", "radiance", "beacon"].map((stage, index) => <div key={stage} className="flex min-w-0 flex-col items-center gap-1">
                <span className="grid h-10 w-10 place-items-center rounded-full border border-primary/50 bg-primary/10 text-primary"><Award className="h-5 w-5" /></span>
                <span className="text-[10px] font-semibold text-primary">{(index + 1) * 15}</span>
                <span className="w-full break-words text-[10px] leading-tight text-muted-foreground">{t(`ch.stage.${stage}`)}</span>
              </div>)}
            </div>
            <p className="mt-4 flex items-center justify-center gap-2 text-[13px] font-medium text-primary"><HandHeart className="h-5 w-5 shrink-0" />{t("ch.tour.prayer")}</p>
          </>}
          <div className="mt-5 flex justify-center gap-2" aria-hidden>
            {[0, 1, 2].map((index) => <span key={index} className={`h-1.5 rounded-full transition-all ${index === page ? "w-7 bg-primary" : "w-1.5 bg-muted"}`} />)}
          </div>
          <Button onClick={next} className="mt-5 h-12 w-full rounded-full bg-primary text-[15px] font-bold text-primary-foreground">
            {page === 2 ? <><Check className="h-4 w-4" />{t("ch.tour.done")}</> : <>{page === 0 && <Sparkles className="h-4 w-4" />}{t("ch.tour.next")}<ChevronRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </section>
    </div>, document.body,
  );
}