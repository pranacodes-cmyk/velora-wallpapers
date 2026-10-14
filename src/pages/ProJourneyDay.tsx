// One Pro Journey day as a three-beat session: Word → Practice → Mission.
// Beats persist, so a user can finish the real-life mission later today.
// Flutter mirror: `flutter_app/lib/screens/projourney/pro_journey_day_screen.dart`.
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronRight, HandHeart, Sparkles, X } from "lucide-react";
import { useT } from "@/i18n";
import { usePremium } from "@/hooks/usePremium";
import { isProJourneyId, proJourneyById, proJourneyDay, type ProJourney } from "@/data/proJourneys";
import {
  checkIn, checkinToday, completeDay, hasPlan, isDayDone, isDayOpen, markStep, nextDay, requiresPro,
  startJourney, stepsFor, STEPS, unmarkStep, type DayResult, type Step,
} from "@/services/proJourneys";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { maybeRequestRating } from "@/services/rating";
import { HoldButton } from "@/components/challenge/HoldButton";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { Button } from "@/components/ui/button";
import { useProJourneys } from "@/components/projourney/useProJourneys";
import { PassageCard } from "@/components/projourney/PassageCard";
import { BreathPrayer } from "@/components/projourney/BreathPrayer";
import { BattleSetup } from "@/components/projourney/BattleSetup";
import { PrayerList } from "@/components/projourney/PrayerList";
import { DayCompleteOverlay } from "@/components/projourney/DayCompleteOverlay";

const goldBtn =
  "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15.5px] font-extrabold text-[hsl(var(--paywall-cta-foreground))] active:scale-[0.985] transition-transform disabled:opacity-40";
const primaryBtn =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15.5px] font-bold text-primary-foreground active:scale-[0.985] transition-transform disabled:opacity-40";

export default function ProJourneyDay() {
  const { id } = useParams<{ id: string }>();
  if (!isProJourneyId(id)) return <Navigate to="/challenge" replace />;
  return <Session j={proJourneyById(id)!} />;
}

function Session({ j }: { j: ProJourney }) {
  const { t } = useT();
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const { isPremium } = usePremium();
  const store = useProJourneys();

  const requested = Number(search.get("d"));
  const day = Number.isFinite(requested) && requested >= 1 && requested <= j.days ? requested : nextDay(j.id, store) ?? j.days;
  const plan = useMemo(() => proJourneyDay(j, day), [j, day, t]); // eslint-disable-line react-hooks/exhaustive-deps
  const review = isDayDone(j.id, day, store);
  const open = isDayOpen(j.id, day, undefined, store);
  const gated = !review && requiresPro(day) && !isPremium;
  const steps = review ? [...STEPS] : stepsFor(j.id, day, store);
  const has = (s: Step) => steps.includes(s);

  const rawOpen = STEPS.findIndex((s) => !steps.includes(s));
  const firstOpen = rawOpen === -1 ? 2 : rawOpen;
  const [step, setStep] = useState(review ? 0 : firstOpen);
  const [result, setResult] = useState<DayResult | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const top = useRef<HTMLDivElement>(null);
  const journeyPath = `/challenge/pro/${j.id}`;

  useEffect(() => {
    if (!review && open && !gated) startJourney(j.id);
    track("pro_journey_day_viewed", { id: j.id, day, review });
  }, [j.id, day]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!result && ((!review && !open) || gated)) return <Navigate to={journeyPath} replace />;

  const go = (i: number) => {
    setStep(i);
    requestAnimationFrame(() => top.current?.scrollTo({ top: 0, behavior: "smooth" }));
  };
  const mark = (s: Step) => { if (!review) markStep(j.id, day, s); };
  const reachable = (i: number) => review || i <= firstOpen || has(STEPS[i]);
  const allDone = STEPS.every((s) => has(s));
  const name = t(`pj.${j.id}.name`);

  const finish = () => {
    const r = completeDay(j.id, day);
    if (!r) return;
    haptic("heavy");
    track("pro_journey_day_done", { id: j.id, day, finished: r.finished, premium: isPremium });
    if (r.finished) track("pro_journey_finished", { id: j.id });
    setResult(r);
  };

  return (
    <div ref={top} className="scroll-container h-full overflow-y-auto bg-background pb-[calc(40px+env(safe-area-inset-bottom))]">
      <header className="sticky top-0 z-30 bg-background/95 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <img src={j.cover} alt="" aria-hidden className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-primary/30" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold text-foreground">{name}</p>
            <p className="text-[12px] text-muted-foreground">{t("pj.progress", { n: day, total: j.days })} · {t("pj.stepOf", { n: step + 1 })}</p>
          </div>
          <button type="button" onClick={() => navigate(journeyPath, { replace: true })} aria-label={t("pj.close")} className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card ring-1 ring-border/60 active:scale-95">
            <X className="h-5 w-5 text-foreground" />
          </button>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {STEPS.map((s, i) => (
            <button key={s} type="button" disabled={!reachable(i)} onClick={() => { haptic("light"); go(i); }} className="group text-left disabled:cursor-default">
              <span className={`block h-1.5 rounded-full transition-colors duration-500 ${has(s) ? "bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))]" : i === step ? "bg-primary/40" : "bg-muted"}`} />
              <span className={`mt-1 block text-[10.5px] font-bold uppercase tracking-[0.12em] ${i === step ? "text-primary" : "text-muted-foreground"}`}>{t(`pj.step.${s}`)}</span>
            </button>
          ))}
        </div>
      </header>

      <main key={step} className="challenge-rise mx-auto max-w-[560px] px-4 pt-3">
        {step === 0 && (
          <section className="space-y-4">
            <div className="px-1">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.2em] text-primary">{t("pj.progress", { n: day, total: j.days })}</p>
              <h1 className="mt-1 font-serif text-[30px] font-semibold leading-[1.1] text-foreground [text-wrap:balance]">{plan.title}</h1>
            </div>
            <PassageCard passage={plan.passage} />
            <p className="px-1 text-[16px] leading-relaxed text-foreground/90 [text-wrap:pretty]">{plan.word}</p>
            <button type="button" onClick={() => { haptic("light"); mark("word"); go(1); }} className={primaryBtn}>
              {t("pj.next")}<ChevronRight className="h-5 w-5" />
            </button>
          </section>
        )}

        {step === 1 && (
          <Practice j={j} day={day} plan={plan} review={review} done={has("practice")} onDone={() => mark("practice")} onNext={() => go(2)} />
        )}

        {step === 2 && (
          <section className="space-y-4">
            <div className="rounded-[24px] bg-card p-5 ring-1 ring-border/60">
              <p className="text-[10.5px] font-bold uppercase tracking-normal text-primary">{t("pj.mi.label", { n: String(day).padStart(2, "0") })}</p>
              <p className="mt-3 text-[40px] leading-none" aria-hidden>{plan.emoji}</p>
              <h2 className="mt-3 text-[20px] font-semibold leading-snug text-foreground [text-wrap:pretty]">{plan.mission}</h2>
              <div className="mt-4 border-l-2 border-primary/50 pl-3">
                <p className="text-[12px] font-semibold text-primary">{t("pj.mi.why")}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-muted-foreground">{plan.why}</p>
              </div>
              <button
                type="button"
                disabled={review}
                aria-pressed={has("mission")}
                onClick={() => {
                  haptic(has("mission") ? "light" : "medium");
                  if (has("mission")) unmarkStep(j.id, day, "mission");
                  else { mark("mission"); track("pro_journey_mission_done", { id: j.id, day }); }
                }}
                className={`mt-5 flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-[14.5px] font-semibold transition-colors ${has("mission") ? "border-primary bg-primary/10 text-foreground" : "border-primary/40 text-foreground"}`}
              >
                <span className={`grid h-5 w-5 shrink-0 place-items-center rounded ${has("mission") ? "bg-primary text-primary-foreground" : "border-2 border-primary"}`}>
                  {has("mission") && <Check className="h-3.5 w-3.5" strokeWidth={3.5} />}
                </span>
                {t("pj.mi.done")}
              </button>
              {!review && !has("mission") && <p className="mt-2 text-center text-[12.5px] leading-relaxed text-muted-foreground">{t("pj.mi.later")}</p>}
            </div>
            {review ? (
              <button type="button" onClick={() => navigate(journeyPath, { replace: true })} className={primaryBtn}>{t("pj.close")}</button>
            ) : (
              <button type="button" disabled={!allDone} onClick={finish} className={goldBtn}>
                <Sparkles className="h-[18px] w-[18px]" />{t("pj.complete", { n: day })}
              </button>
            )}
          </section>
        )}
      </main>

      {result && (
        <DayCompleteOverlay
          j={j}
          result={result}
          showPro={!isPremium && !result.finished && requiresPro(result.day + 1)}
          onShare={() => {
            track("pro_journey_shared", { id: j.id, day: result.day });
            void nativeShare({
              title: name,
              text: result.finished ? t("pj.share.done", { name, days: j.days }) : t("pj.share.day", { n: result.day, name }),
              includeAppLink: true,
            });
          }}
          onPro={() => { track("pro_journey_paywall", { id: j.id, from: "celebration" }); setPremiumOpen(true); }}
          onDone={() => {
            const teased = !isPremium && !result.finished && requiresPro(result.day + 1);
            navigate(journeyPath, { replace: true });
            // Never stack a rating ask on top of the Pro invitation.
            if (!teased) setTimeout(() => maybeRequestRating(), 1200);
          }}
        />
      )}
      <PremiumSheet isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} trigger={`pro_journey_${j.id}`} />
    </div>
  );
}

type PracticeProps = {
  j: ProJourney;
  day: number;
  plan: ReturnType<typeof proJourneyDay>;
  review: boolean;
  done: boolean;
  onDone: () => void;
  onNext: () => void;
};

function Practice({ j, day, plan, review, done, onDone, onNext }: PracticeProps) {
  const { t } = useT();
  const store = useProJourneys();
  const next = (
    <button type="button" onClick={() => { haptic("light"); onNext(); }} className={primaryBtn}>
      {t("pj.next")}<ChevronRight className="h-5 w-5" />
    </button>
  );

  if (j.practice === "declare") {
    return (
      <section className="space-y-4">
        <div className="relative overflow-hidden rounded-[26px] border border-primary/30 bg-card px-5 py-8 text-center">
          <span aria-hidden className={`pointer-events-none absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full pj-halo ${done ? "pj-glow" : "opacity-40"}`} />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{t("pj.dec.label")}</p>
          <p className="relative mx-auto mt-4 max-w-[340px] font-serif text-[27px] font-semibold leading-[1.22] text-foreground [text-wrap:balance]">{plan.practice}</p>
          {done ? (
            <span className="challenge-pop relative mt-5 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12.5px] font-bold text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3} />{t("pj.dec.done")}</span>
          ) : (
            <p className="relative mx-auto mt-4 max-w-[300px] text-[13.5px] leading-relaxed text-muted-foreground">{t("pj.dec.hint")}</p>
          )}
        </div>
        {!done && !review && (
          <HoldButton label={t("pj.dec.hold")} holdingLabel={t("pj.dec.holding")} durationMs={1800} onComplete={() => { onDone(); track("pro_journey_declared", { id: j.id, day }); }} />
        )}
        {(done || review) && next}
      </section>
    );
  }

  if (j.practice === "breathe") {
    return (
      <section className="space-y-4">
        <div className="px-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{t("pj.br.label")}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{t("pj.br.hint")}</p>
        </div>
        <div className="rounded-[26px] bg-card px-4 py-6 ring-1 ring-border/60">
          <div className="mb-4 text-center">
            <p className="font-serif text-[20px] leading-snug text-foreground">{plan.breatheIn}</p>
            <p className="font-serif text-[20px] italic leading-snug text-primary">{plan.breatheOut}</p>
          </div>
          <BreathPrayer inText={plan.breatheIn} outText={plan.breatheOut} framed={false} initiallyDone={done || review} onComplete={onDone} />
        </div>
        {(done || review) && next}
      </section>
    );
  }

  const amenCard = (title: string, text: string) => (
    <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/60">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-primary"><HandHeart className="h-3.5 w-3.5" />{title}</p>
      <p className="mt-2 font-serif text-[19px] italic leading-[1.5] text-foreground/90">{text}</p>
      {done && <span className="challenge-pop mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-[12.5px] font-bold text-primary-foreground"><Check className="h-3.5 w-3.5" strokeWidth={3} />{t("pj.amen")}</span>}
    </div>
  );
  const amen = !done && !review && (
    <HoldButton label={t("pj.holdAmen")} holdingLabel={t("pj.amen")} durationMs={1600} onComplete={() => { onDone(); track("pro_journey_prayed", { id: j.id, day }); }} />
  );

  if (j.practice === "battle") {
    const needsPlan = day === 1 && !hasPlan(store) && !review;
    const checked = checkinToday(undefined, store);
    const needsCheckin = day > 1 && !checked && !review;
    return (
      <section className="space-y-4">
        {needsPlan ? (
          <div className="rounded-[24px] bg-card p-4 ring-1 ring-border/60"><BattleSetup /></div>
        ) : needsCheckin ? (
          <div className="rounded-[24px] bg-card p-5 text-center ring-1 ring-border/60">
            <p className="font-serif text-[22px] font-semibold leading-snug text-foreground">{t("pj.fr.check")}</p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button onClick={() => { haptic("medium"); checkIn("free"); track("pro_journey_checkin", { result: "free", day }); }} className="rounded-full py-3 text-[14.5px] font-bold">{t("pj.fr.free")}</Button>
              <Button variant="outline" onClick={() => { haptic("light"); checkIn("slip"); track("pro_journey_checkin", { result: "slip", day }); }} className="rounded-full py-3 text-[14.5px] font-semibold">{t("pj.fr.slip")}</Button>
            </div>
          </div>
        ) : (
          <>
            {day > 1 && checked && !review && (
              <p className={`rounded-2xl px-4 py-3 text-[14px] leading-relaxed ring-1 ${checked === "free" ? "bg-primary/10 text-foreground ring-primary/25" : "bg-muted/60 text-foreground ring-border"}`}>
                {t(checked === "free" ? "pj.fr.freeMsg" : "pj.fr.slipMsg")}
              </p>
            )}
            {amenCard(t("pj.fr.prayer"), plan.practice)}
            {amen}
            {(done || review) && next}
          </>
        )}
      </section>
    );
  }

  // intercede
  return (
    <section className="space-y-4">
      {amenCard(t("pj.pl.prompt"), plan.practice)}
      <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/60"><PrayerList compact /></div>
      {amen}
      {(done || review) && next}
    </section>
  );
}
