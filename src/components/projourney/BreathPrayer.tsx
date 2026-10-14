// One-minute breath prayer: six slow breaths (4 s in, 6 s out ≈ 6 breaths a
// minute), praying one phrase on the in-breath and one on the out-breath.
// Reduced motion swaps the animated orb for a counted, self-paced version.
// Flutter mirror: `flutter_app/lib/screens/projourney/breath_prayer.dart`.
import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { Button } from "@/components/ui/button";

const IN_MS = 4000;
const OUT_MS = 6000;

const prefersReduced = () => {
  try { return window.matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
};

type Props = {
  inText?: string;
  outText?: string;
  cycles?: number;
  /** Already completed (e.g. resumed day) — start in the finished state. */
  initiallyDone?: boolean;
  /** False when the parent already shows the words inside its own card. */
  framed?: boolean;
  onComplete: () => void;
};

export function BreathPrayer({ inText, outText, cycles = 6, initiallyDone = false, framed = true, onComplete }: Props) {
  const { t } = useT();
  const [phase, setPhase] = useState<"idle" | "in" | "out" | "done">(initiallyDone ? "done" : "idle");
  const [breath, setBreath] = useState(0);
  const [reduced] = useState(prefersReduced);
  const timer = useRef<number | null>(null);
  const completeRef = useRef(onComplete);
  completeRef.current = onComplete;

  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const run = (n: number) => {
    setBreath(n);
    setPhase("in");
    haptic("soft");
    timer.current = window.setTimeout(() => {
      setPhase("out");
      haptic("soft");
      timer.current = window.setTimeout(() => {
        if (n >= cycles) {
          setPhase("done");
          haptic("medium");
          completeRef.current();
        } else run(n + 1);
      }, OUT_MS);
    }, IN_MS);
  };

  const start = () => { if (timer.current) window.clearTimeout(timer.current); run(1); };

  if (reduced && phase !== "done") {
    return (
      <div className={framed ? "rounded-[22px] bg-card p-5 text-center ring-1 ring-border/60" : "text-center"}>
        {framed && inText && <p className="font-serif text-[22px] leading-snug text-foreground">{inText}</p>}
        {framed && outText && <p className="mt-1 font-serif text-[22px] italic leading-snug text-primary">{outText}</p>}
        <p className={`mx-auto max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground ${framed ? "mt-3" : ""}`}>{t("pj.br.reduced")}</p>
        <Button onClick={() => { haptic("medium"); setPhase("done"); onComplete(); }} className="mt-4 w-full rounded-full py-3 text-[15px] font-bold">
          {t("pj.br.reducedDone")}
        </Button>
      </div>
    );
  }

  const running = phase === "in" || phase === "out";
  const scale = phase === "in" ? 1 : phase === "out" ? 0.58 : phase === "done" ? 0.86 : 0.7;
  const duration = phase === "in" ? IN_MS : phase === "out" ? OUT_MS : 600;
  const phrase = phase === "in" ? inText : phase === "out" ? outText : null;

  return (
    <div className="flex flex-col items-center text-center">
      <div className="relative grid h-[232px] w-[232px] place-items-center" aria-live="polite">
        <span aria-hidden className="pj-orb-ring absolute inset-0 rounded-full" />
        <span
          aria-hidden
          className={`pj-orb absolute inset-3 rounded-full ${phase === "idle" || phase === "done" ? "pj-glow" : ""}`}
          style={{ transform: `scale(${scale})`, transition: `transform ${duration}ms cubic-bezier(0.45, 0, 0.55, 1)` }}
        />
        <span className="relative z-10 px-6">
          {running ? (
            <>
              <span className="block text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--paywall-cta-foreground))]">
                {phase === "in" ? t("pj.br.in") : t("pj.br.out")}
              </span>
              {phrase && <span key={`${breath}-${phase}`} className="challenge-rise mt-1 block font-serif text-[20px] font-semibold leading-tight text-[hsl(var(--paywall-cta-foreground))]">{phrase}</span>}
            </>
          ) : phase === "done" ? (
            <span className="challenge-pop block font-serif text-[20px] font-semibold leading-tight text-[hsl(var(--paywall-cta-foreground))]">{t("pj.br.done")}</span>
          ) : (
            <span className="block font-serif text-[18px] font-semibold leading-tight text-[hsl(var(--paywall-cta-foreground))]">{inText ?? t("pj.br.in")}</span>
          )}
        </span>
      </div>
      <p className="mt-3 h-5 text-[12.5px] font-semibold tabular-nums text-muted-foreground">
        {running ? t("pj.br.count", { n: breath, total: cycles }) : ""}
      </p>
      {phase === "idle" && (
        <Button onClick={start} className="mt-2 w-full rounded-full py-3.5 text-[15px] font-bold">{t("pj.br.start")}</Button>
      )}
      {phase === "done" && (
        <Button variant="ghost" onClick={start} className="mt-1 text-[13.5px] font-bold text-primary">{t("pj.br.again")}</Button>
      )}
    </div>
  );
}
