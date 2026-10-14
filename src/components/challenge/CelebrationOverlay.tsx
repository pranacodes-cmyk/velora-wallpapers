import { forwardRef, useState } from "react";
import { createPortal } from "react-dom";
import { Anchor, Flame, MapPin, Share2 } from "lucide-react";
import { useT } from "@/i18n";
import { stageForDay } from "@/data/challenge75";
import { haptic } from "@/utils/haptics";
import type { CompletionResult } from "@/services/challenge";
import { VoyagePoster } from "./VoyagePoster";

type Props = {
  result: CompletionResult;
  onShare: () => void;
  onDone: () => void;
};

/** Full-screen moment when a day is complete: the lamb walks closer to the cross. */
export const CelebrationOverlay = forwardRef<HTMLDivElement, Props>(function CelebrationOverlay({ result, onShare, onDone }, ref) {
  const { t } = useT();
  const [arrived, setArrived] = useState(false);
  const island = result.islandReached;
  const stage = stageForDay(result.day);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={result.finished ? t("ch.cele.finishedTitle") : t("ch.cele.title", { day: result.day })}
      className="onboarding-theme fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-y-auto bg-background px-5 py-8 text-center text-foreground"
    >
      <div className="cele-rays pointer-events-none absolute left-1/2 top-[38%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2" aria-hidden />
      <div className="challenge-rise relative w-full max-w-[400px] overflow-hidden rounded-[20px] shadow-[0_16px_40px_-28px_hsl(var(--foreground)/0.3)]">
        <VoyagePoster
          days={result.day}
          fromDays={result.day - 1}
          labels
          priority
          sea="night"
          sailDelay={550}
          sailMs={2000}
          label={t("ch.voyage.a11y", { n: result.day })}
          onArrive={() => { setArrived(true); haptic(island || result.finished ? "heavy" : "medium"); }}
        />
      </div>

      <div className="relative mt-5 flex items-center gap-2" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="challenge-pop today-stone-lit h-3 w-3 rounded-full bg-primary" style={{ animationDelay: `${0.15 + i * 0.12}s` }} />
        ))}
      </div>
      <h2 className="challenge-rise relative mt-4 text-[30px] font-bold leading-tight" style={{ animationDelay: "0.2s" }}>
        {result.finished ? t("ch.cele.finishedTitle") : t("ch.cele.title", { day: result.day })}
      </h2>
      <p className="challenge-rise relative mt-1.5 max-w-xs text-[15px] text-muted-foreground" style={{ animationDelay: "0.3s" }}>
        {result.finished ? t("ch.cele.finishedSub") : t("ch.cele.sub")}
      </p>

      <div className="challenge-rise relative mt-5 flex min-h-[38px] flex-wrap items-center justify-center gap-2" style={{ animationDelay: "0.4s" }}>
        <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3.5 py-2 text-[13px] font-bold text-primary ring-1 ring-primary/30">
          <Flame className="h-4 w-4" />{t("ch.streak", { n: result.streak })}
        </span>
        {island && arrived && (
          <span className="challenge-pop flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-[13px] font-bold text-primary-foreground">
            <MapPin className="h-4 w-4" />{t("ch.cele.island", { island: t(`ch.stage.${stage.key}`) })}
          </span>
        )}
        {result.graceEarned && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3.5 py-2 text-[13px] font-bold text-foreground ring-1 ring-accent/30">
            <Anchor className="h-4 w-4 text-accent" />{t("ch.cele.grace")}
          </span>
        )}
      </div>

      {!result.finished && (
        <p className="challenge-rise relative mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground" style={{ animationDelay: "0.5s" }}>
          {t("ch.cele.next", { day: result.day + 1 })}
        </p>
      )}

      <div className="challenge-rise relative mt-8 flex w-full max-w-sm gap-3" style={{ animationDelay: "0.55s" }}>
        <button
          type="button"
          onClick={onShare}
          className="flex flex-1 items-center justify-center gap-2 rounded-full border border-primary/40 py-3.5 text-[15px] font-bold text-foreground active:scale-[0.98]"
        >
          <Share2 className="h-4 w-4" />{t("ch.cele.share")}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="flex flex-1 items-center justify-center rounded-full bg-primary py-3.5 text-[15px] font-bold text-primary-foreground active:scale-[0.98]"
        >
          {t("ch.cele.done")}
        </button>
      </div>
    </div>,
    document.body,
  );
});
