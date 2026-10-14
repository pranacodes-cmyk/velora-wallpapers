import { useState, type ReactNode } from "react";
import { Check, Flame, Footprints, ListChecks, Sparkles, Sun } from "lucide-react";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import type { ChallengeMode } from "@/services/challenge";
import { HoldButton } from "./HoldButton";
import { VoyagePoster } from "./VoyagePoster";

type Props = {
  onStart: (mode: ChallengeMode) => void;
};

/** First visit to the Journey tab: the voyage, how it works, path and reminder. */
export function ChallengeIntro({ onStart }: Props) {
  const { t } = useT();
  const [mode, setMode] = useState<ChallengeMode>("grace");
  const [launching, setLaunching] = useState(false);
  const [startAttempt, setStartAttempt] = useState(0);

  const start = () => {
    setLaunching(true);
    haptic("heavy");
    setTimeout(() => { onStart(mode); setLaunching(false); setStartAttempt((n) => n + 1); }, 1100);
  };

  const steps = [
    { icon: ListChecks, t: "ch.intro.step1.t", s: "ch.intro.step1.s" },
    { icon: Footprints, t: "ch.intro.step2.t", s: "ch.intro.step2.s" },
    { icon: Sparkles, t: "ch.intro.step3.t", s: "ch.intro.step3.s" },
  ];

  const Ornament = ({ children }: { children: ReactNode }) => (
    <h2 className="gold-ornament mb-3 text-[11.5px] font-semibold uppercase tracking-[0.16em]">
      <span>{children}</span>
    </h2>
  );

  return (
    <div className="scroll-container h-[calc(100%-104px-env(safe-area-inset-bottom))] overflow-y-auto bg-background pb-6">
      <header className="px-5 pb-4 pt-[max(14px,env(safe-area-inset-top))] text-center">
        <p className="text-[11.5px] font-semibold uppercase tracking-[0.18em] text-primary">{t("ch.tab")}</p>
        <h1 className="mt-1 text-[27px] font-bold leading-tight text-foreground">{t("ch.name")}</h1>
      </header>

      <div className="mx-auto max-w-[540px] space-y-7 px-4">
        <section className="space-y-4">
          <div className="gold-frame">
            <div className="gold-frame-inner">
              <VoyagePoster
                days={launching ? 2.2 : 0}
                fromDays={launching ? 0 : null}
                priority sailDelay={0} sailMs={1000}
                label={t("ch.intro.kicker")}
              />
            </div>
          </div>
          <p className="px-3 text-center text-[14.5px] leading-relaxed text-muted-foreground [text-wrap:balance]">{t("ch.intro.sub")}</p>
        </section>

        <section>
          <Ornament>{t("ch.intro.how")}</Ornament>
          <ol className="relative space-y-2.5">
            <span aria-hidden className="absolute bottom-8 left-[37px] top-8 w-px bg-gradient-to-b from-primary/50 via-primary/20 to-primary/50" />
            {steps.map(({ icon: Icon, t: title, s }, i) => (
              <li key={title} className="gold-frame gold-frame--soft">
                <div className="gold-frame-inner flex gap-3.5 px-4 py-3.5">
                  <span className="icon-ring relative z-[1] mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-primary">
                    <Icon className="h-[18px] w-[18px]" strokeWidth={1.8} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline gap-2 text-[15px] font-semibold leading-snug text-foreground">
                      <span className="text-[11px] font-bold tabular-nums tracking-wider text-primary">0{i + 1}</span>
                      {t(title)}
                    </p>
                    <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground [text-wrap:pretty]">{t(s)}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <p className="mt-2.5 px-2 text-center text-[12.5px] leading-snug text-muted-foreground">{t("ch.intro.read.s")}</p>
        </section>

        <section>
          <Ornament>{t("ch.intro.path")}</Ornament>
          <div className="grid gap-2.5" role="radiogroup">
            {(["grace", "covenant"] as const).map((m) => {
              const active = mode === m;
              const MIcon = m === "grace" ? Sun : Flame;
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={active}
                  onClick={() => { haptic("light"); setMode(m); }}
                  className={`gold-frame block w-full text-left transition-all active:scale-[0.99] ${active ? "" : "gold-frame--soft opacity-90"}`}
                >
                  <span className={`gold-frame-inner flex items-start gap-3.5 px-4 py-3.5 ${active ? "bg-primary/[0.06]" : ""}`}>
                    <span className={`icon-ring mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full ${active ? "bg-primary text-primary-foreground" : "bg-card text-primary"}`}>
                      <MIcon className="h-[18px] w-[18px]" strokeWidth={1.9} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[15px] font-semibold text-foreground">{t(`ch.mode.${m}.t`)}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ring-1 ${m === "grace" ? "bg-primary/10 text-primary ring-primary/25" : "bg-destructive/10 text-destructive ring-destructive/25"}`}>{t(`ch.mode.${m}.badge`)}</span>
                      </span>
                      <span className="mt-1 block text-[13.5px] leading-snug text-muted-foreground [text-wrap:pretty]">{t(`ch.mode.${m}.s`)}</span>
                    </span>
                    <span className={`mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/35"}`}>
                      {active && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="space-y-5">
          <HoldButton
            key={startAttempt}
            label={<span className="flex items-center justify-center gap-2"><Footprints className="h-5 w-5" />{launching ? t("ch.intro.lit") : t("ch.intro.hold")}</span>}
            holdingLabel={t("ch.intro.holding")}
            onComplete={start}
            disabled={launching}
          />
          <figure className="corner-frame mx-2 px-5 py-4 text-center">
            <blockquote className="font-serif text-[14px] italic leading-snug text-foreground/85">“{t("ch.verse")}”</blockquote>
            <figcaption className="mt-1.5 text-[11.5px] font-semibold uppercase tracking-[0.14em] text-primary">{t("ch.verseRef")}</figcaption>
          </figure>
        </div>
      </div>
    </div>
  );
}
