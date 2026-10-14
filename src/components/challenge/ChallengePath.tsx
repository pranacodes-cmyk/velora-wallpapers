import { Check, Lock } from "lucide-react";
import { STAGES } from "@/data/challenge75";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { LAMPS } from "./challengeAssets";

type Props = {
  completed: number;
  currentDay: number;
  lit: boolean;
  onOpenDay: (day: number) => void;
};

const COLS = 5;
const ROW_H = 52; // 44px stone + 8px gap
const point = (i: number) => {
  const row = Math.floor(i / COLS);
  const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
  return `${(col + 0.5) * 20},${row * ROW_H + 22}`;
};
const ALL_POINTS = Array.from({ length: 15 }, (_, i) => point(i)).join(" ");

/**
 * The 75-day path: five stage cards (one lamp each), fifteen stepping stones
 * per stage laid out as a snake so the path visibly winds forward.
 */
export function ChallengePath({ completed, currentDay, lit, onOpenDay }: Props) {
  const { t } = useT();
  return (
    <div className="space-y-3">
      {STAGES.map((stage) => {
        const unlocked = completed >= stage.from - 1;
        const stageDone = Math.max(0, Math.min(15, completed - (stage.from - 1)));
        const lamp = LAMPS[stage.index];
        return (
          <section
            key={stage.key}
            className={`relative overflow-hidden rounded-[22px] border p-4 ${unlocked ? "border-primary/25 bg-card" : "border-border bg-card/60"}`}
          >
            {unlocked && <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />}
            <header className="relative mb-3 flex items-center gap-3">
              <img
                src={lamp.src}
                width={lamp.w}
                height={lamp.h}
                alt=""
                loading="lazy"
                className={`h-10 w-16 object-contain ${unlocked ? "" : "opacity-40 grayscale"}`}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary">
                  {t("ch.stage.range", { from: stage.from, to: stage.to })}
                </p>
                <h3 className="font-serif text-[19px] font-semibold leading-tight text-foreground">
                  {t(`ch.stage.${stage.key}`)} · <span className="text-muted-foreground">{t(`ch.lamp.${stage.index}`)}</span>
                </h3>
              </div>
              <span className="text-[12px] font-bold tabular-nums text-muted-foreground">{stageDone}/15</span>
            </header>
            <div className="relative">
            <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" viewBox={`0 0 100 ${ROW_H * 3 - 8}`} preserveAspectRatio="none">
              <polyline points={ALL_POINTS} fill="none" stroke="hsl(var(--border))" strokeWidth="2" strokeDasharray="2 5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              {stageDone > 0 && (
                <polyline
                  points={Array.from({ length: Math.min(15, stageDone + (stageDone < 15 && unlocked ? 1 : 0)) }, (_, i) => point(i)).join(" ")}
                  fill="none" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                />
              )}
            </svg>
            <ol className="relative grid grid-cols-5 gap-y-2" aria-label={t(`ch.stage.${stage.key}`)}>
              {Array.from({ length: 15 }, (_, i) => {
                const row = Math.floor(i / COLS);
                const col = row % 2 === 0 ? i % COLS : COLS - 1 - (i % COLS);
                const day = stage.from + i;
                const isDone = day <= completed;
                const isCurrent = !isDone && day === currentDay && !lit;
                const isNextTomorrow = !isDone && day === completed + 1 && lit;
                return (
                  <li key={day} style={{ gridRow: row + 1, gridColumn: col + 1 }} className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => { haptic("soft"); onOpenDay(day); }}
                      disabled={!isDone && !isCurrent}
                      aria-label={t("ch.day", { day })}
                      className={[
                        "relative flex h-11 w-11 items-center justify-center rounded-full text-[13px] font-bold tabular-nums transition-transform active:scale-90",
                        isDone
                          ? "bg-gradient-to-b from-[hsl(var(--premium-gold-glow))] to-[hsl(var(--premium-gold))] text-[hsl(var(--paywall-cta-foreground))] shadow-[0_6px_14px_-6px_hsl(var(--primary)/0.9)]"
                          : isCurrent
                            ? "challenge-node-current border-2 border-primary bg-primary/15 text-primary"
                            : "border border-border bg-muted/50 text-muted-foreground",
                      ].join(" ")}
                    >
                      {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : !isCurrent && !isNextTomorrow && day > currentDay ? <Lock className="h-3.5 w-3.5 opacity-60" /> : day}
                      {isDone && (day % 15 === 0 || day === 1 || day === 7) && (
                        <span className="absolute -right-1 -top-1 flex h-[18px] w-[18px] items-center justify-center rounded-full bg-card text-[10px] leading-none text-primary ring-2 ring-primary/70">★</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
            </div>
          </section>
        );
      })}
    </div>
  );
}
