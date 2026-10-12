import { Shield, ArrowRight, Lock, BookOpen } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";

export function PrayScreenFeatureCard() {
  const navigate = useNavigate();
  const { t } = useT();
  return (
    <div className="px-3 pb-4">
      <button
        type="button"
        onClick={() => { haptic("soft"); navigate("/prayscreen"); }}
        className="group relative w-full overflow-hidden rounded-[22px] border border-primary/25 bg-card p-5 text-left shadow-[0_12px_32px_-18px_hsl(var(--primary)/0.55)] transition-transform active:scale-[0.985]"
      >
        <span aria-hidden className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <span aria-hidden className="pointer-events-none absolute -bottom-16 -left-10 h-36 w-36 rounded-full bg-accent/15 blur-3xl" />
        <span className="relative flex items-start gap-4">
          <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-b from-primary/25 to-primary/5 ring-1 ring-primary/35">
            <Shield className="h-7 w-7 text-primary" strokeWidth={1.7} />
            <Lock className="absolute h-3 w-3 text-primary" strokeWidth={2.6} />
          </span>
          <span className="min-w-0 flex-1 pt-0.5">
            <span className="block font-serif text-[22px] font-semibold leading-tight text-foreground">{t("premium.benefit.shield.title")}</span>
            <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{t("ps.tagline")}</span>
          </span>
        </span>
        <span className="relative mt-4 flex items-center gap-2">
          <span className="flex h-8 items-center gap-1.5 rounded-full bg-muted/60 px-3 text-[11px] font-semibold text-foreground/80"><Lock className="h-3.5 w-3.5 text-primary" />{t("ps.mode.prayer")}</span>
          <span className="flex h-8 items-center gap-1.5 rounded-full bg-muted/60 px-3 text-[11px] font-semibold text-foreground/80"><BookOpen className="h-3.5 w-3.5 text-primary" />{t("bible.title")}</span>
          <span className="ml-auto flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-[12px] font-bold text-primary-foreground shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.7)]">
            {t("ps.btn.on")}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </span>
        </span>
      </button>
    </div>
  );
}
