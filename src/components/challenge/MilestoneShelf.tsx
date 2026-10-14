import { Flame, Lock } from "lucide-react";
import { useT } from "@/i18n";
import { STAGES } from "@/data/challenge75";
import { JourneyInfo } from "./JourneyInfo";

type Props = { completed: number; streak: number };

/** Five collectible medallions — one per 15-day stage — plus the live streak. */
export function MilestoneShelf({ completed, streak }: Props) {
  const { t } = useT();
  return (
    <section className="border-t border-border pt-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center"><h2 className="text-[16px] font-bold text-foreground">{t("ch.hub.badges")}</h2><JourneyInfo kind="badges" /></div>
        <span className="flex items-center gap-1 text-[12px] font-medium tabular-nums text-muted-foreground">
          <Flame className={`h-3.5 w-3.5 ${streak > 0 ? "streak-flame" : ""}`} />{t("ch.streak", { n: streak })}
        </span>
      </div>
      <ol className="grid grid-cols-5 gap-1.5">
        {STAGES.map((s) => {
          const span = s.to - s.from + 1;
          const p = Math.min(1, Math.max(0, (completed - s.from + 1) / span));
          const earned = completed >= s.to;
          const r = 22, c = 2 * Math.PI * r;
          return (
            <li key={s.key} className="flex flex-col items-center">
              <span className="relative grid h-[54px] w-[54px] place-items-center">
                <svg viewBox="0 0 50 50" className="absolute inset-0 -rotate-90" aria-hidden>
                  <circle cx="25" cy="25" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
                  <circle cx="25" cy="25" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
                    className="stroke-primary transition-[stroke-dashoffset] duration-700"
                    strokeDasharray={c} strokeDashoffset={c * (1 - p)} />
                </svg>
                <span className={`grid h-[40px] w-[40px] place-items-center rounded-full text-[15px] font-bold tabular-nums ${
                  earned ? "milestone-earned bg-primary text-primary-foreground" : p > 0 ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {earned || p > 0 ? s.to : <Lock className="h-3.5 w-3.5" />}
                </span>
              </span>
              <span className={`mt-1 max-w-full break-words text-center text-[11px] font-semibold ${earned ? "text-primary" : "text-muted-foreground"}`}>
                {t(`ch.stage.${s.key}`)}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
