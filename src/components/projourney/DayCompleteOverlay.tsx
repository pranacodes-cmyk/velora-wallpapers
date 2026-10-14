// Full-screen moment when a Pro Journey day is complete.
// Free users who finish their free Day 1 see an invitation to continue with Pro.
// Flutter mirror: `flutter_app/lib/screens/projourney/day_complete_overlay.dart`.
import { createPortal } from "react-dom";
import { Crown, Share2 } from "lucide-react";
import { useT } from "@/i18n";
import type { ProJourney } from "@/data/proJourneys";
import type { DayResult } from "@/services/proJourneys";

type Props = {
  j: ProJourney;
  result: DayResult;
  showPro: boolean;
  onShare: () => void;
  onPro: () => void;
  onDone: () => void;
};

export function DayCompleteOverlay({ j, result, showPro, onShare, onPro, onDone }: Props) {
  const { t } = useT();
  const pct = result.day / result.total;
  const r = 52;
  const c = 2 * Math.PI * r;
  const title = result.finished ? t(`pj.${j.id}.doneTitle`) : t("pj.cele.title", { n: result.day });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={title} className="onboarding-theme fixed inset-0 z-[80] overflow-y-auto bg-background text-foreground">
      <img src={j.cover} alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl" />
      <div className="cele-rays pointer-events-none absolute left-1/2 top-[30%] h-[160vmax] w-[160vmax] -translate-x-1/2 -translate-y-1/2" aria-hidden />
      <div className="relative flex min-h-full flex-col items-center justify-center px-6 py-10 text-center">
        <div className="challenge-pop relative grid h-[136px] w-[136px] place-items-center">
          <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--foreground) / 0.12)" strokeWidth="7" />
            <circle
              cx="60" cy="60" r={r} fill="none" stroke="hsl(var(--premium-gold))" strokeWidth="7" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
              style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.2, 0.8, 0.2, 1) 0.3s", filter: "drop-shadow(0 0 6px hsl(var(--premium-gold) / 0.7))" }}
            />
          </svg>
          <span className="text-[44px]" aria-hidden>{result.finished ? j.emoji : "✨"}</span>
        </div>
        <p className="challenge-rise mt-5 text-[11.5px] font-bold uppercase tracking-[0.2em] text-primary" style={{ animationDelay: "0.15s" }}>
          {t(`pj.${j.id}.name`)} · {t("pj.progressShort", { n: result.day, total: result.total })}
        </p>
        <h2 className="challenge-rise mt-2 max-w-[320px] font-serif text-[32px] font-semibold leading-[1.1] [text-wrap:balance]" style={{ animationDelay: "0.22s" }}>{title}</h2>
        <p className="challenge-rise mt-2 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground" style={{ animationDelay: "0.3s" }}>
          {result.finished ? t(`pj.${j.id}.doneSub`) : t("pj.cele.next", { n: result.day + 1 })}
        </p>
        {result.finished && (
          <span className="challenge-pop mt-4 rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] px-4 py-2 text-[13px] font-extrabold text-[hsl(var(--paywall-cta-foreground))]" style={{ animationDelay: "0.5s" }}>
            {t("pj.cele.badge", { badge: t(`pj.${j.id}.badge`) })}
          </span>
        )}

        {showPro && (
          <div className="challenge-rise mt-7 w-full max-w-sm rounded-[24px] border border-primary/35 bg-card/80 p-5 text-left backdrop-blur-md" style={{ animationDelay: "0.45s" }}>
            <p className="flex items-center gap-2 text-[16px] font-bold text-foreground"><Crown className="h-4 w-4 text-primary" />{t("pj.cele.proTitle")}</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{t("pj.cele.proSub")}</p>
            <button
              type="button"
              onClick={onPro}
              className="pj-shine relative mt-4 flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15px] font-extrabold text-[hsl(var(--paywall-cta-foreground))] active:scale-[0.98]"
            >
              <Crown className="h-4 w-4" />{t("pj.cele.proCta")}
            </button>
          </div>
        )}

        <div className="challenge-rise mt-6 flex w-full max-w-sm gap-3" style={{ animationDelay: "0.55s" }}>
          <button type="button" onClick={onShare} className="flex flex-1 items-center justify-center gap-2 rounded-full border border-primary/40 py-3.5 text-[15px] font-bold text-foreground active:scale-[0.98]">
            <Share2 className="h-4 w-4" />{t("pj.cele.share")}
          </button>
          <button type="button" onClick={onDone} className="flex flex-1 items-center justify-center rounded-full bg-primary py-3.5 text-[15px] font-bold text-primary-foreground active:scale-[0.98]">
            {t("pj.cele.done")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
