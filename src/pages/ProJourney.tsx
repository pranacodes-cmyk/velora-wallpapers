// Pro Journey detail — cinematic cover, today's call to action, the tool that
// makes the journey unique, and the day-by-day path.
// Flutter mirror: `flutter_app/lib/screens/projourney/pro_journey_screen.dart`.
import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Crown, Lock, Pencil, RotateCcw, Share2, ShieldAlert, Wind } from "lucide-react";
import { useT } from "@/i18n";
import { usePremium } from "@/hooks/usePremium";
import { BATTLE_EMOJI, isProJourneyId, proJourneyById, proJourneyDay, type ProJourney as Def } from "@/data/proJourneys";
import { daysFree, doneCount, isDayDone, isDayOpen, journeyStatus, requiresPro, restartJourney, stepsFor } from "@/services/proJourneys";
import { msUntilMidnight } from "@/services/challenge";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { formatCountdown, useNow } from "@/components/challenge/useReading";
import { BottomSheet } from "@/components/challenge/BottomSheet";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { Button } from "@/components/ui/button";
import { useProJourneys } from "@/components/projourney/useProJourneys";
import { PrayerList } from "@/components/projourney/PrayerList";
import { BattleSetup } from "@/components/projourney/BattleSetup";
import { StandFirmSheet } from "@/components/projourney/StandFirmSheet";
import { BreathPrayer } from "@/components/projourney/BreathPrayer";

const goldCta =
  "pj-shine relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15.5px] font-extrabold text-[hsl(var(--paywall-cta-foreground))] active:scale-[0.985] transition-transform";
const primaryCta =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15.5px] font-bold text-primary-foreground active:scale-[0.985] transition-transform";

export default function ProJourney() {
  const { id } = useParams<{ id: string }>();
  if (!isProJourneyId(id)) return <Navigate to="/challenge" replace />;
  const journey = proJourneyById(id);
  return journey ? <JourneyView j={journey} /> : <Navigate to="/challenge" replace />;
}

function JourneyView({ j }: { j: Def }) {
  const { t } = useT();
  const navigate = useNavigate();
  const { isPremium } = usePremium();
  const store = useProJourneys();
  const now = useNow();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [restartOpen, setRestartOpen] = useState(false);
  const [sosOpen, setSosOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [breathOpen, setBreathOpen] = useState(false);

  const status = journeyStatus(j.id, undefined, store);
  const done = doneCount(j.id, store);
  const name = t(`pj.${j.id}.name`);
  useEffect(() => { track("pro_journey_viewed", { id: j.id, status: status.kind, done, premium: isPremium }); }, [j.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const openDay = (day: number) => navigate(`/challenge/pro/${j.id}/day?d=${day}`);
  const unlock = (from: string) => { haptic("light"); track("pro_journey_paywall", { id: j.id, from }); setPremiumOpen(true); };

  const back = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/challenge", { replace: true });
  };

  /* ── primary call to action ── */
  let cta: React.ReactNode;
  if (status.kind === "done") {
    cta = (
      <section className="rounded-[24px] border border-primary/35 bg-card p-5 text-center">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] text-[30px]">{j.emoji}</span>
        <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">{t("pj.badge")} · {t(`pj.${j.id}.badge`)}</p>
        <h2 className="mt-1 font-serif text-[24px] font-semibold text-foreground">{t(`pj.${j.id}.doneTitle`)}</h2>
        <p className="mx-auto mt-1 max-w-[320px] text-[14px] leading-relaxed text-muted-foreground">{t(`pj.${j.id}.doneSub`)}</p>
        <div className="mt-4 flex gap-2">
          <Button variant="outline" onClick={() => { haptic("light"); void nativeShare({ title: name, text: t("pj.share.done", { name, days: j.days }), includeAppLink: true }); }} className="flex-1 gap-2 rounded-full py-3 text-[14.5px] font-semibold">
            <Share2 className="h-4 w-4" />{t("pj.cele.share")}
          </Button>
          <Button onClick={() => { haptic("light"); setRestartOpen(true); }} className="flex-1 gap-2 rounded-full py-3 text-[14.5px] font-bold">
            <RotateCcw className="h-4 w-4" />{t("pj.cta.again")}
          </Button>
        </div>
      </section>
    );
  } else if (status.kind === "wait") {
    const nextLocked = !isPremium && requiresPro(status.day);
    cta = (
      <section className="rounded-[24px] bg-primary/10 p-4 text-center ring-1 ring-primary/20">
        <p className="text-[16px] font-semibold text-foreground">{t("pj.wait.title", { n: status.doneDay })}</p>
        <p className="mt-0.5 text-[13px] text-muted-foreground">{t("pj.wait.sub", { next: status.day, time: formatCountdown(msUntilMidnight(now), t) })}</p>
        {nextLocked && (
          <button type="button" onClick={() => unlock("wait")} className={`${goldCta} mt-3`}>
            <Crown className="h-4 w-4" />{t("pj.cta.unlock", { n: status.day })}
          </button>
        )}
        <Button variant="ghost" onClick={() => openDay(status.doneDay)} className="mt-1.5 text-[13.5px] font-bold text-primary">{t("pj.cta.review")}</Button>
      </section>
    );
  } else {
    const day = status.kind === "today" ? status.day : 1;
    const locked = !isPremium && requiresPro(day);
    if (locked) {
      cta = (
        <section className="rounded-[24px] border border-primary/35 bg-card p-5">
          <p className="flex items-center gap-2 text-[16px] font-bold text-foreground"><Lock className="h-4 w-4 text-primary" />{t("pj.locked.title", { total: j.days })}</p>
          <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">{t("pj.locked.sub")}</p>
          <button type="button" onClick={() => unlock("cta")} className={`${goldCta} mt-4`}>
            <Crown className="h-4 w-4" />{t("pj.cta.unlock", { n: day })}
          </button>
        </section>
      );
    } else {
      const fresh = status.kind === "new" || (day === 1 && stepsFor(j.id, 1, store).length === 0);
      cta = (
        <button type="button" onClick={() => { haptic("medium"); openDay(day); }} className={fresh && !isPremium ? goldCta : primaryCta}>
          {fresh ? (isPremium ? t("pj.cta.start") : t("pj.cta.startFree")) : t("pj.cta.continue", { n: day })}
          <ChevronRight className="h-5 w-5" />
        </button>
      );
    }
  }

  return (
    <div className="scroll-container h-full overflow-y-auto bg-background pb-[calc(32px+env(safe-area-inset-bottom))]">
      {/* Hero */}
      <header className="relative h-[min(58vh,440px)] w-full overflow-hidden">
        <img src={j.cover} alt="" width={720} height={926} fetchPriority="high" className="absolute inset-0 h-full w-full object-cover" />
        <span aria-hidden className="pj-scrim-top absolute inset-x-0 top-0 h-28" />
        <span aria-hidden className="pj-hero-fade absolute inset-0" />
        <button type="button" onClick={back} aria-label={t("pj.back")} className="absolute left-4 top-[max(12px,env(safe-area-inset-top))] grid h-10 w-10 place-items-center rounded-full bg-[hsl(var(--poster-scrim)/0.45)] text-[hsl(var(--poster-ink))] backdrop-blur-md active:scale-95">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="absolute right-4 top-[max(16px,calc(env(safe-area-inset-top)+4px))] rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] px-2.5 py-1 text-[10px] font-black tracking-[0.1em] text-[hsl(var(--paywall-cta-foreground))]">{t("pj.pro")}</span>
        <div className="absolute inset-x-0 bottom-0 px-5 pb-4">
          <p className="inline-flex rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-primary shadow-sm backdrop-blur-md">{t("pj.days", { n: j.days })}{!isPremium && status.kind === "new" ? ` · ${t("pj.free1")}` : ""}</p>
          <h1 className="mt-1 font-serif text-[34px] font-semibold leading-[1.05] text-foreground [text-wrap:balance]"><span aria-hidden className="mr-1.5">{j.emoji}</span>{name}</h1>
          <p className="mt-1.5 max-w-[440px] text-[15px] leading-snug text-foreground/80 [text-wrap:pretty]">{t(`pj.${j.id}.tag`)}</p>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] space-y-6 px-4">
        {/* Progress + CTA */}
        <section className="space-y-3">
          {done > 0 && (
            <div className="flex items-center gap-3 px-1">
              <span className="shrink-0 text-[12px] font-semibold tabular-nums text-muted-foreground">{done}/{j.days}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={done} aria-valuemin={0} aria-valuemax={j.days} aria-label={name}>
                <div className="voyage-progress h-full rounded-full transition-[width] duration-700" style={{ width: `${(done / j.days) * 100}%` }} />
              </div>
            </div>
          )}
          {cta}
        </section>

        {/* Journey tool */}
        {status.kind !== "new" && <JourneyTool j={j} isPremium={isPremium} onSos={() => { haptic("medium"); track("pro_journey_sos_opened"); setSosOpen(true); }} onEditPlan={() => setPlanOpen(true)} onBreathe={() => { haptic("light"); setBreathOpen(true); }} />}

        {/* Promise + outcomes */}
        <section className="space-y-3">
          <p className="px-1 text-[15px] leading-relaxed text-foreground/85">{t(`pj.${j.id}.promise`)}</p>
          <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/60">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("pj.outcomes")}</p>
            <ul className="mt-2 space-y-2.5">
              {[1, 2, 3].map((n) => (
                <li key={n} className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"><Check className="h-3 w-3" strokeWidth={3} /></span>
                  <span className="text-[14.5px] leading-snug text-foreground">{t(`pj.${j.id}.out${n}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Path */}
        <section>
          <h2 className="px-1 text-[19px] font-bold text-foreground">{t("pj.path")}</h2>
          <ol className="mt-2">
            {Array.from({ length: j.days }, (_, i) => i + 1).map((d) => (
              <PathRow key={d} j={j} day={d} isPremium={isPremium} onOpen={openDay} onLocked={() => unlock("path")} />
            ))}
          </ol>
        </section>

        {(j.id === "peace" || j.id === "freedom") && (
          <p className="px-2 text-center text-[11.5px] leading-relaxed text-muted-foreground">{t(j.id === "peace" ? "pj.pe.care" : "pj.fr.help")}</p>
        )}

        {status.kind !== "new" && status.kind !== "done" && (
          <div className="text-center">
            <Button variant="ghost" onClick={() => { haptic("light"); setRestartOpen(true); }} className="gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <RotateCcw className="h-3.5 w-3.5" />{t("pj.restart")}
            </Button>
          </div>
        )}
      </main>

      <BottomSheet open={restartOpen} title={t("pj.restart")} onClose={() => setRestartOpen(false)} closeLabel={t("pj.close")}>
        <p className="text-[14.5px] leading-relaxed text-muted-foreground">{t("pj.restartConfirm")}</p>
        <div className="mt-5 flex gap-2">
          <Button variant="outline" onClick={() => setRestartOpen(false)} className="flex-1 rounded-full py-3 font-semibold">{t("pj.cancel")}</Button>
          <Button onClick={() => { haptic("medium"); restartJourney(j.id); track("pro_journey_restarted", { id: j.id }); setRestartOpen(false); }} className="flex-1 rounded-full py-3 font-bold">{t("pj.restartYes")}</Button>
        </div>
      </BottomSheet>
      <BottomSheet open={planOpen} title={t("pj.fr.planTitle")} onClose={() => setPlanOpen(false)} closeLabel={t("pj.close")}>
        <BattleSetup onSaved={() => setPlanOpen(false)} />
      </BottomSheet>
      <BottomSheet open={breathOpen} title={t("pj.pe.now")} onClose={() => setBreathOpen(false)} closeLabel={t("pj.close")}>
        <BreathNow j={j} />
      </BottomSheet>
      <StandFirmSheet open={sosOpen} onClose={() => setSosOpen(false)} />
      <PremiumSheet isOpen={premiumOpen} onClose={() => setPremiumOpen(false)} trigger={`pro_journey_${j.id}`} />
    </div>
  );
}

/** Breathe-now sheet uses the breath prayer of the latest unlocked day. */
function BreathNow({ j }: { j: Def }) {
  const day = Math.max(1, Math.min(j.days, doneCount(j.id) || 1));
  const plan = proJourneyDay(j, day);
  return (
    <div className="pb-2">
      <BreathPrayer inText={plan.breatheIn} outText={plan.breatheOut} onComplete={() => track("pro_journey_breathe_now", { day })} />
    </div>
  );
}

function PathRow({ j, day, isPremium, onOpen, onLocked }: { j: Def; day: number; isPremium: boolean; onOpen: (d: number) => void; onLocked: () => void }) {
  const { t } = useT();
  const isDone = isDayDone(j.id, day);
  const open = isDayOpen(j.id, day);
  const proLocked = !isPremium && requiresPro(day) && !isDone;
  const sub = isDone ? t("pj.day.done") : proLocked ? t("pj.day.pro") : open ? t("pj.day.today") : t("pj.day.locked", { n: day - 1 });
  const tappable = isDone || (open && !proLocked) || proLocked;

  return (
    <li>
      <button
        type="button"
        disabled={!tappable}
        onClick={() => { haptic("light"); if (proLocked) onLocked(); else onOpen(day); }}
        className="flex w-full items-center gap-3 border-b border-border/60 px-1 py-3 text-left disabled:cursor-default"
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12.5px] font-bold tabular-nums ${
          isDone ? "bg-primary text-primary-foreground" : open && !proLocked ? "bg-primary/10 text-primary ring-2 ring-primary" : "bg-muted text-muted-foreground"
        }`}>
          {isDone ? <Check className="h-4 w-4" strokeWidth={3} /> : proLocked ? <Lock className="h-3.5 w-3.5" /> : day}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[15px] font-semibold ${isDone || (open && !proLocked) ? "text-foreground" : "text-foreground/70"}`}>{t("pj.progress", { n: day, total: j.days })}</span>
          <span className={`block text-[12px] ${proLocked ? "font-bold text-primary" : "text-muted-foreground"}`}>{sub}</span>
        </span>
        {tappable && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
      </button>
    </li>
  );
}

function JourneyTool({ j, isPremium, onSos, onEditPlan, onBreathe }: { j: Def; isPremium: boolean; onSos: () => void; onEditPlan: () => void; onBreathe: () => void }) {
  const { t } = useT();
  const store = useProJourneys();
  const started = Boolean(store.journeys[j.id]);

  if (j.practice === "intercede") {
    return (
      <section className="rounded-[24px] bg-card p-4 ring-1 ring-border/60">
        <PrayerList />
      </section>
    );
  }

  if (j.practice === "breathe") {
    return (
      <button type="button" onClick={onBreathe} className="flex w-full items-center gap-3 rounded-[22px] bg-card p-4 text-left ring-1 ring-border/60 active:scale-[0.99]">
        <span className="pj-orb grid h-12 w-12 shrink-0 place-items-center rounded-full text-[hsl(var(--paywall-cta-foreground))]"><Wind className="h-5 w-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15.5px] font-semibold text-foreground">{t("pj.pe.now")}</span>
          <span className="block text-[12.5px] text-muted-foreground">{t("pj.pe.nowSub")}</span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>
    );
  }

  if (j.practice === "battle") {
    if (!started && !store.freedom.battle) return null;
    const battle = store.freedom.battle;
    const free = daysFree(undefined, store);
    return (
      <section className="space-y-3">
        <button type="button" onClick={onSos} className="flex w-full items-center gap-3 rounded-[22px] border border-primary/40 bg-primary/10 p-4 text-left active:scale-[0.99]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] text-[hsl(var(--paywall-cta-foreground))]"><ShieldAlert className="h-6 w-6" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15.5px] font-bold text-foreground">{t("pj.sos.btn")}</span>
            <span className="block text-[12.5px] text-muted-foreground">{t("pj.sos.btnSub")}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
        </button>
        {battle && (
          <div className="rounded-[22px] bg-card p-4 ring-1 ring-border/60">
            <div className="flex items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("pj.fr.yourBattle")}</p>
                <p className="mt-1 text-[16px] font-semibold text-foreground"><span aria-hidden className="mr-1.5">{BATTLE_EMOJI[battle]}</span>{t(`pj.fr.b.${battle}`)}</p>
                {store.freedom.sos > 0 && <p className="mt-0.5 text-[12px] text-muted-foreground">{t("pj.sos.count", { n: store.freedom.sos })}</p>}
              </div>
              <div className="shrink-0 rounded-2xl bg-primary/10 px-4 py-2 text-center ring-1 ring-primary/20">
                <p className="font-serif text-[30px] font-semibold leading-none tabular-nums text-foreground">{free}</p>
                <p className="mt-1 text-[10.5px] font-bold uppercase tracking-[0.12em] text-primary">{t("pj.fr.daysFree")}</p>
              </div>
            </div>
            {store.freedom.when && store.freedom.then && (
              <div className="mt-3 border-t border-border/60 pt-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{t("pj.fr.yourPlan")}</p>
                  <button type="button" onClick={() => { haptic("light"); onEditPlan(); }} className="flex items-center gap-1 text-[12.5px] font-bold text-primary"><Pencil className="h-3 w-3" />{t("pj.fr.edit")}</button>
                </div>
                <p className="mt-1 text-[14.5px] leading-snug text-foreground">{t("pj.fr.planLine", { when: store.freedom.when, then: store.freedom.then })}</p>
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  // declare → identity card
  const declared = Array.from({ length: j.days }, (_, i) => i + 1).filter((d) => isDayDone(j.id, d, store));
  if (!declared.length) return null;
  const lines = declared.map((d) => `✦ ${proJourneyDay(j, d).practice}`).join("\n");
  return (
    <section className="relative overflow-hidden rounded-[24px] border border-primary/30 bg-card p-5">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full pj-halo" />
      <p className="relative text-[11px] font-bold uppercase tracking-[0.16em] text-primary">{t("pj.id.card")}</p>
      <p className="relative mt-0.5 text-[12.5px] text-muted-foreground">{t("pj.id.cardSub")}</p>
      <ul className="relative mt-3 space-y-2">
        {Array.from({ length: j.days }, (_, i) => i + 1).map((d) => {
          const has = declared.includes(d);
          return (
            <li key={d} className={`flex items-start gap-2.5 ${has ? "" : "opacity-60"}`}>
              <span className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full ${has ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {has ? <Check className="h-2.5 w-2.5" strokeWidth={3.5} /> : <Lock className="h-2 w-2" />}
              </span>
              <span className={`text-[14px] leading-snug ${has ? "font-serif text-[15.5px] text-foreground" : "text-muted-foreground"}`}>
                {has ? proJourneyDay(j, d).practice : t("pj.id.locked", { n: d })}
              </span>
            </li>
          );
        })}
      </ul>
      <Button variant="outline" onClick={() => { haptic("light"); track("pro_journey_identity_shared", { n: declared.length }); void nativeShare({ title: t(`pj.${j.id}.name`), text: t("pj.share.card", { lines }), includeAppLink: true }); }} className="relative mt-4 w-full gap-2 rounded-full py-3 text-[14px] font-semibold">
        <Share2 className="h-4 w-4" />{t("pj.id.share")}
      </Button>
    </section>
  );
}
