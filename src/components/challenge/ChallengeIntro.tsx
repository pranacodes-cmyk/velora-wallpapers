import { useState } from "react";
import { BookOpen, Check, ChevronLeft, Flame, HeartHandshake, Sparkles, Sunrise, Users } from "lucide-react";
import { useT } from "@/i18n";
import { haptic } from "@/utils/haptics";
import { useIsLightTheme } from "@/hooks/useIsLightTheme";
import type { ChallengeMode } from "@/services/challenge";
import { ChallengeLamp } from "./ChallengeLamp";
import { HoldButton } from "./HoldButton";
import { HERO, LAMPS, TASK_ART } from "./challengeAssets";
import { TASK_IDS } from "@/data/challenge75";

type Props = {
  onBack: () => void;
  onStart: (mode: ChallengeMode, morning: string, evening: boolean) => void;
};

const MORNING_TIMES = ["06:00", "07:00", "08:00", "09:00"];

function timeLabel(hhmm: string, lang: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date(2024, 0, 1, h, m);
  try { return d.toLocaleTimeString(lang, { hour: "numeric", minute: "2-digit" }); } catch { return hhmm; }
}

export function ChallengeIntro({ onBack, onStart }: Props) {
  const { t, lang } = useT();
  const light = useIsLightTheme();
  const [mode, setMode] = useState<ChallengeMode>("grace");
  const [morning, setMorning] = useState("07:00");
  const [evening, setEvening] = useState(true);
  const [igniting, setIgniting] = useState(false);

  const start = () => {
    setIgniting(true);
    setTimeout(() => onStart(mode, morning, evening), 900);
  };

  const steps = [
    { icon: BookOpen, t: "ch.intro.step1.t", s: "ch.intro.step1.s" },
    { icon: Flame, t: "ch.intro.step2.t", s: "ch.intro.step2.s" },
    { icon: Users, t: "ch.intro.step3.t", s: "ch.intro.step3.s" },
  ];

  return (
    <div className="scroll-container h-full overflow-y-auto bg-background pb-[calc(124px+env(safe-area-inset-bottom))]">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <img src={light ? HERO.dawn : HERO.night} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/10 to-background" />
        <div className="relative px-5 pt-[max(14px,env(safe-area-inset-top))]">
          <button
            onClick={onBack}
            aria-label={t("ch.back")}
            className="grid h-10 w-10 place-items-center rounded-full bg-black/30 text-white backdrop-blur-md active:scale-95"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex flex-col items-center pb-6 pt-1 text-center">
            <ChallengeLamp tier={0} intensity={igniting ? 1 : 0.35} state={igniting ? "lit" : "ember"} width={196} priority className={igniting ? "challenge-ignite" : ""} />
            <p className="mt-1 rounded-full bg-black/35 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-200 backdrop-blur-sm">
              {t("ch.intro.kicker")}
            </p>
            <h1 className="mt-2 font-serif text-[34px] font-semibold leading-[1.05] text-foreground [text-wrap:balance]">
              {t("ch.name")}
            </h1>
            <p className="mt-3 max-w-[330px] text-[15px] leading-relaxed text-foreground/80 [text-wrap:pretty]">
              {t("ch.intro.sub")}
            </p>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[520px] space-y-7 px-5">
        {/* Daily practices strip */}
        <div className="grid grid-cols-4 gap-2">
          {TASK_IDS.map((id) => (
            <div key={id} className="flex flex-col items-center rounded-2xl border border-border/60 bg-card/80 px-1 pb-2.5 pt-2 text-center shadow-sm">
              <img src={TASK_ART[id]} alt="" className="h-14 w-14 rounded-xl object-cover" loading="lazy" />
              <p className="mt-1.5 w-full truncate text-[12px] font-semibold text-foreground">{t(`ch.task.${id}`)}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.intro.how")}</h2>
          <ol className="space-y-2.5">
            {steps.map(({ icon: Icon, t: title, s }, i) => (
              <li key={title} className="flex gap-3.5 rounded-2xl border border-border/60 bg-card/80 p-3.5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/15 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold text-foreground">
                    <span className="mr-1.5 text-primary">{i + 1}.</span>{t(title)}
                  </p>
                  <p className="mt-0.5 text-[13.5px] leading-snug text-muted-foreground">{t(s)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Lamps to unlock */}
        <section className="rounded-3xl border border-primary/25 bg-[radial-gradient(120%_100%_at_50%_0%,hsl(var(--primary)/0.14),transparent_70%)] p-4">
          <div className="flex items-end justify-between gap-1">
            {LAMPS.map((lamp, i) => (
              <div key={lamp.src} className="flex min-w-0 flex-1 flex-col items-center">
                <img src={lamp.src} alt="" className="w-full max-w-[64px] object-contain" style={{ opacity: 0.55 + i * 0.11 }} loading="lazy" />
                <p className="mt-1 w-full truncate text-center text-[10.5px] font-medium text-muted-foreground">{t(`ch.stage.${["spark", "ember", "glow", "radiance", "beacon"][i]}`)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2.5 border-t border-primary/15 pt-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-[14px] font-semibold text-foreground">{t("ch.intro.read.t")}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("ch.intro.read.s")}</p>
            </div>
          </div>
        </section>

        {/* Path */}
        <section>
          <h2 className="mb-3 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.intro.path")}</h2>
          <div className="space-y-2.5" role="radiogroup">
            {(["grace", "covenant"] as const).map((m) => {
              const active = mode === m;
              return (
                <button
                  key={m}
                  role="radio"
                  aria-checked={active}
                  onClick={() => { haptic("light"); setMode(m); }}
                  className={`flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all active:scale-[0.99] ${
                    active ? "border-primary/70 bg-primary/10 shadow-[0_10px_30px_-18px_hsl(var(--primary)/0.9)]" : "border-border/60 bg-card/80"
                  }`}
                >
                  <div className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${active ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}>
                    {active && <Check className="h-3 w-3" strokeWidth={3} />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[15.5px] font-semibold text-foreground">{t(`ch.mode.${m}.t`)}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${m === "grace" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"}`}>
                        {t(`ch.mode.${m}.badge`)}
                      </span>
                    </div>
                    <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{t(`ch.mode.${m}.s`)}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reminder */}
        <section className="rounded-3xl border border-border/60 bg-card/80 p-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
              <Sunrise className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-foreground">{t("ch.intro.reminder")}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{t("ch.intro.reminderSub")}</p>
            </div>
          </div>
          <div className="mt-3.5 grid grid-cols-4 gap-2">
            {MORNING_TIMES.map((time) => (
              <button
                key={time}
                onClick={() => { haptic("light"); setMorning(time); }}
                className={`rounded-xl border py-2.5 text-[13.5px] font-semibold tabular-nums transition-colors ${
                  morning === time ? "border-primary bg-primary text-primary-foreground" : "border-border/70 bg-background/60 text-foreground"
                }`}
              >
                {timeLabel(time, lang)}
              </button>
            ))}
          </div>
          <label className="mt-3.5 flex cursor-pointer items-center justify-between gap-3">
            <span className="text-[14px] text-foreground">{t("ch.intro.evening")}</span>
            <button
              role="switch"
              aria-checked={evening}
              onClick={() => { haptic("light"); setEvening((v) => !v); }}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${evening ? "bg-primary" : "bg-muted"}`}
            >
              <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${evening ? "translate-x-[22px]" : "translate-x-0.5"}`} />
            </button>
          </label>
        </section>

        <div className="pt-1">
          <HoldButton
            label={<span className="flex items-center justify-center gap-2"><HeartHandshake className="h-5 w-5" />{igniting ? t("ch.intro.lit") : t("ch.intro.hold")}</span>}
            holdingLabel={t("ch.intro.holding")}
            onComplete={start}
            disabled={igniting}
          />
          <p className="mt-4 text-center font-serif text-[14px] italic leading-relaxed text-muted-foreground">
            “{t("ch.verse")}”
            <span className="mt-1 block text-[12px] not-italic tracking-wide">{t("ch.verseRef")}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
