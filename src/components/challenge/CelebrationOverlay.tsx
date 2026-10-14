import { createPortal } from "react-dom";
import { Flame, Share2, Sparkles, Droplet } from "lucide-react";
import { useT } from "@/i18n";
import { ChallengeLamp } from "./ChallengeLamp";
import type { CompletionResult } from "@/services/challenge";

type Props = {
  result: CompletionResult;
  tier: number;
  intensity: number;
  onShare: () => void;
  onDone: () => void;
};

/** Full-screen moment when a day lights up. Always midnight for contrast. */
export function CelebrationOverlay({ result, tier, intensity, onShare, onDone }: Props) {
  const { t } = useT();
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={result.finished ? t("ch.cele.finishedTitle") : t("ch.cele.title", { day: result.day })}
      className="onboarding-theme fixed inset-0 z-[80] flex flex-col items-center justify-center overflow-hidden bg-background px-6 text-center text-foreground"
    >
      <span aria-hidden className="pointer-events-none absolute left-1/2 top-[34%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/20 blur-[90px]" />
      <div className="challenge-ignite relative">
        <ChallengeLamp tier={tier} intensity={Math.max(0.75, intensity)} state="lit" width={240} priority />
      </div>
      <h2 className="challenge-rise relative mt-6 font-serif text-[34px] font-semibold leading-tight" style={{ animationDelay: "0.25s" }}>
        {result.finished ? t("ch.cele.finishedTitle") : t("ch.cele.title", { day: result.day })}
      </h2>
      <p className="challenge-rise relative mt-2 max-w-xs text-[15px] text-muted-foreground" style={{ animationDelay: "0.35s" }}>
        {result.finished ? t("ch.cele.finishedSub") : t("ch.cele.sub")}
      </p>
      <div className="challenge-rise relative mt-5 flex flex-wrap items-center justify-center gap-2" style={{ animationDelay: "0.45s" }}>
        <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3.5 py-2 text-[13px] font-bold text-primary ring-1 ring-primary/30">
          <Flame className="h-4 w-4" />{t("ch.streak", { n: result.streak })}
        </span>
        {result.graceEarned && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-3.5 py-2 text-[13px] font-bold text-foreground ring-1 ring-accent/30">
            <Droplet className="h-4 w-4 text-accent" />{t("ch.cele.grace")}
          </span>
        )}
        {result.lampUpgraded && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary/15 px-3.5 py-2 text-[13px] font-bold text-foreground ring-1 ring-primary/30">
            <Sparkles className="h-4 w-4 text-primary" />{t("ch.cele.lamp", { lamp: t(`ch.lamp.${tier}`) })}
          </span>
        )}
      </div>
      {!result.finished && (
        <p className="challenge-rise relative mt-4 text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground" style={{ animationDelay: "0.55s" }}>
          {t("ch.cele.next", { day: result.day + 1 })}
        </p>
      )}
      <div className="challenge-rise relative mt-9 flex w-full max-w-sm gap-3" style={{ animationDelay: "0.6s" }}>
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
          className="flex flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15px] font-extrabold text-[hsl(var(--paywall-cta-foreground))] shadow-[0_12px_30px_-12px_hsl(var(--primary)/0.9)] active:scale-[0.98]"
        >
          {t("ch.cele.done")}
        </button>
      </div>
    </div>,
    document.body,
  );
}
