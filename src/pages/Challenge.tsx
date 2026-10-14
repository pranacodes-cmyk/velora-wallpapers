import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookOpen, Check, ChevronLeft, ChevronRight, Droplet, Flame, HandHeart, Lock, PenLine, Settings2, Sparkles, Trophy, Users,
} from "lucide-react";
import { useT } from "@/i18n";
import { useChallenge } from "@/hooks/useChallenge";
import { usePremium } from "@/hooks/usePremium";
import { useIsLightTheme } from "@/hooks/useIsLightTheme";
import { challengeDay, MILESTONES, stageForDay, TASK_IDS, type TaskId } from "@/data/challenge75";
import { CHALLENGE_AD_FLAG, clearNotice, graceCap, msUntilMidnight, resetChallenge, startChallenge, type ChallengeMode } from "@/services/challenge";
import { tryShowInterstitial } from "@/services/ad-cooldown";
import { markCheersSeen } from "@/services/challengeCircle";
import { requestChallengeNotificationPermission, syncChallengeReminders } from "@/services/challengeReminders";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { ChallengeLamp } from "@/components/challenge/ChallengeLamp";
import { ChallengeIntro } from "@/components/challenge/ChallengeIntro";
import { ChallengePath } from "@/components/challenge/ChallengePath";
import { ChallengeSettingsSheet } from "@/components/challenge/ChallengeSettingsSheet";
import { CircleSheets, type CircleFlow } from "@/components/challenge/CircleSheets";
import { useCircles } from "@/components/challenge/useCircles";
import { formatCountdown, useNow, useReadingLabel } from "@/components/challenge/useReading";
import { CIRCLE_ART, HERO, LAMPS, TASK_ART } from "@/components/challenge/challengeAssets";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";

const TASK_ICON: Record<TaskId, typeof BookOpen> = { read: BookOpen, pray: HandHeart, live: Sparkles, reflect: PenLine };

export default function Challenge() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const view = useChallenge();
  const { state, day, completed, lit, done, streak, tier, intensity } = view;
  const { isPremium, unlock } = usePremium();
  const light = useIsLightTheme();
  const now = useNow();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [circleFlow, setCircleFlow] = useState<CircleFlow>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const { identity, overview } = useCircles();
  const plan = challengeDay(day);
  const refLabel = useReadingLabel(lang, plan);
  const stage = stageForDay(lit ? Math.min(75, completed + 1) : day);

  useEffect(() => { track("challenge_hub_viewed", { status: state.status, completed }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { void syncChallengeReminders(t, state); }, [state, t]);

  // A free user just lit a day: show one warm interstitial on the hub, only
  // while the user is still here (cancelled if they leave within 900ms).
  useEffect(() => {
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(CHALLENGE_AD_FLAG); sessionStorage.removeItem(CHALLENGE_AD_FLAG); } catch { /* storage blocked */ }
    if (!pending || isPremium || Date.now() - Number(pending) > 15_000) return;
    const timer = setTimeout(() => { tryShowInterstitial("challenge_day_lit", { onlyIfWarm: true }).catch(() => {}); }, 900);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const cheers = overview?.cheers ?? [];
  const circles = overview?.circles ?? [];
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  if (state.status === "idle") {
    return (
      <ChallengeIntro
        onBack={goBack}
        onStart={(mode: ChallengeMode, morning: string, evening: boolean) => {
          startChallenge(mode, morning, evening);
          track("challenge_started", { mode, morning, evening });
          void requestChallengeNotificationPermission().then(() => syncChallengeReminders(t));
        }}
      />
    );
  }

  const finished = state.status === "finished";
  const cap = graceCap(isPremium);
  const nextIn = formatCountdown(msUntilMidnight(now), t);
  const notice = state.notice;

  return (
    <div className="scroll-container h-full overflow-y-auto bg-background pb-[calc(112px+env(safe-area-inset-bottom))]">
      {/* Header */}
      <header className="sticky top-0 z-30 flex items-center gap-2 bg-background/95 px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-xl">
        <button onClick={goBack} aria-label={t("ch.back")} className="grid h-10 w-10 place-items-center rounded-full bg-card text-foreground ring-1 ring-border/60 active:scale-95">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-serif text-[19px] font-semibold text-foreground">{t("ch.name")}</h1>
        <button onClick={() => { haptic("light"); setSettingsOpen(true); }} aria-label={t("ch.hub.settings")} className="grid h-10 w-10 place-items-center rounded-full bg-card text-foreground ring-1 ring-border/60 active:scale-95">
          <Settings2 className="h-[18px] w-[18px]" />
        </button>
      </header>

      <main className="mx-auto max-w-[540px] space-y-5 px-4 pt-2">
        {/* Hero lamp */}
        <section className="relative overflow-hidden rounded-[30px] border border-primary/25 shadow-[0_24px_60px_-34px_hsl(var(--primary)/0.8)]">
          <img src={light ? HERO.dawn : HERO.night} alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-black/25 to-black/75" />
          <div className="relative flex flex-col items-center px-5 pb-5 pt-4 text-center text-white">
            <span className="rounded-full bg-black/35 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.2em] text-amber-200 backdrop-blur-md">
              {t(`ch.stage.${stage.key}`)} · {t(`ch.lamp.${tier}`)}
            </span>
            <ChallengeLamp tier={tier} intensity={intensity} state={lit || finished ? "lit" : "waiting"} width={212} priority className="mt-1" />
            <div className="mt-3 flex items-baseline gap-2">
              <span className="font-serif text-[46px] font-semibold leading-none tabular-nums [text-shadow:0_2px_18px_rgba(0,0,0,0.5)]">{completed}</span>
              <span className="text-[15px] font-semibold text-white/75">{t("ch.of75")}</span>
            </div>
            <div className="mt-3 h-2 w-full max-w-[300px] overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-yellow-200 shadow-[0_0_12px_rgba(253,224,71,0.8)] transition-[width] duration-700" style={{ width: `${(completed / 75) * 100}%` }} />
            </div>
            <div className="mt-4 grid w-full grid-cols-2 gap-2">
              <div className="flex items-center gap-2.5 rounded-2xl bg-black/35 px-3 py-2.5 text-left backdrop-blur-md">
                <Flame className="h-5 w-5 shrink-0 text-orange-300" />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold leading-none tabular-nums">{streak}</p>
                  <p className="mt-1 truncate text-[11.5px] text-white/70">{t("ch.streak.label")}</p>
                </div>
              </div>
              <button
                onClick={() => { haptic("light"); if (!isPremium && state.mode === "grace") setPremiumOpen(true); }}
                className="flex items-center gap-2.5 rounded-2xl bg-black/35 px-3 py-2.5 text-left backdrop-blur-md"
              >
                <Droplet className="h-5 w-5 shrink-0 text-sky-300" />
                <div className="min-w-0">
                  <p className="text-[17px] font-bold leading-none tabular-nums">
                    {state.mode === "covenant" ? "—" : t("ch.grace.count", { n: state.graces, cap })}
                  </p>
                  <p className="mt-1 truncate text-[11.5px] text-white/70">{t("ch.grace")}</p>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Missed-day notice */}
        {notice && (
          <div className="challenge-rise flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-4">
            <Droplet className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug text-foreground">
                {notice.type === "grace_used" && t("ch.notice.grace", { n: notice.days })}
                {notice.type === "streak_reset" && t("ch.notice.reset", { done: completed })}
                {notice.type === "restarted" && t("ch.notice.restart", { n: notice.reached })}
              </p>
              <button onClick={clearNotice} className="mt-2 text-[13px] font-bold text-primary">{t("ch.notice.ok")}</button>
            </div>
          </div>
        )}

        {/* Cheers received */}
        {cheers.length > 0 && (
          <div className="challenge-rise rounded-2xl border border-border/60 bg-card p-3.5">
            <ul className="space-y-2">
              {cheers.slice(0, 3).map((c) => (
                <li key={c.id} className="flex items-center gap-2.5 text-[14px] text-foreground">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-muted text-[16px]">{c.fromAvatar}</span>
                  <span className="min-w-0 flex-1 leading-snug">{t(`ch.cheer.${c.kind}`, { name: c.fromName })}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => void markCheersSeen(cheers.map((c) => c.id)).catch(() => {})} className="mt-2.5 text-[13px] font-bold text-primary">
              {t("ch.notice.ok")}
            </button>
          </div>
        )}

        {/* Today */}
        {finished ? (
          <section className="rounded-[26px] border border-primary/30 bg-card p-5 text-center">
            <Trophy className="mx-auto h-9 w-9 text-primary" />
            <h2 className="mt-2 font-serif text-[24px] font-semibold text-foreground">{t("ch.cele.finishedTitle")}</h2>
            <p className="mt-1 text-[14px] text-muted-foreground">{t("ch.cele.finishedSub")}</p>
            <button
              onClick={() => { haptic("medium"); track("challenge_new_round"); resetChallenge(); }}
              className="mt-4 w-full rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15px] font-bold text-[hsl(var(--paywall-cta-foreground))]"
            >
              {t("ch.finished.again")}
            </button>
          </section>
        ) : (
          <section className="overflow-hidden rounded-[26px] border border-border/60 bg-card shadow-sm">
            <div className="p-4 pb-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[12px] font-bold uppercase tracking-[0.18em] text-primary">{t("ch.hub.today")} · {t("ch.day", { day: plan.day })}</p>
                <p className="text-[12.5px] font-semibold tabular-nums text-muted-foreground">{t("ch.tasksDone", { n: done.length })}</p>
              </div>
              <h2 className="mt-1.5 font-serif text-[23px] font-semibold leading-tight text-foreground [text-wrap:balance]">{plan.title}</h2>
              {refLabel && <p className="mt-1 flex items-center gap-1.5 text-[13.5px] text-muted-foreground"><BookOpen className="h-3.5 w-3.5" />{refLabel}</p>}
            </div>
            <ul className="grid grid-cols-4 gap-2 px-4">
              {TASK_IDS.map((id) => {
                const isDone = done.includes(id);
                const Icon = TASK_ICON[id];
                return (
                  <li key={id} className="relative">
                    <div className={`relative overflow-hidden rounded-2xl ring-1 ${isDone ? "ring-primary/60" : "ring-border/60"}`}>
                      <img src={TASK_ART[id]} alt="" className={`aspect-square w-full object-cover transition ${isDone ? "" : "opacity-80 saturate-[0.8]"}`} loading="lazy" />
                      <span className={`absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full ${isDone ? "bg-primary text-primary-foreground" : "bg-black/45 text-white"}`}>
                        {isDone ? <Check className="h-3 w-3" strokeWidth={3} /> : <Icon className="h-3 w-3" />}
                      </span>
                    </div>
                    <p className={`mt-1.5 truncate text-center text-[12px] font-semibold ${isDone ? "text-primary" : "text-foreground"}`}>{t(`ch.task.${id}`)}</p>
                  </li>
                );
              })}
            </ul>
            <div className="p-4">
              {lit ? (
                <div className="rounded-2xl bg-primary/10 p-3.5 text-center">
                  <p className="font-serif text-[18px] font-semibold text-foreground">{t("ch.lit.title", { day: plan.day })}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{t("ch.lit.next", { day: plan.day + 1, time: nextIn })}</p>
                  <button onClick={() => navigate(`/challenge/day/${plan.day}`)} className="mt-2.5 text-[13.5px] font-bold text-primary">
                    {t("ch.cta.review", { day: plan.day })}
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => { haptic("medium"); navigate("/challenge/day"); }}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[hsl(var(--premium-gold))] to-[hsl(var(--premium-gold-glow))] py-3.5 text-[15.5px] font-bold text-[hsl(var(--paywall-cta-foreground))] shadow-[0_12px_28px_-14px_hsl(var(--primary)/0.9)] active:scale-[0.985]"
                >
                  {done.length ? t("ch.cta.continue", { day: plan.day }) : t("ch.cta.begin", { day: plan.day })}
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </section>
        )}

        {/* Circle */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.hub.circle")}</h2>
            {circles.length > 0 && (
              <button onClick={() => navigate("/challenge/circle")} className="text-[13px] font-bold text-primary">{t("ch.circle.open")}</button>
            )}
          </div>
          {circles.length === 0 ? (
            <div className="overflow-hidden rounded-[26px] border border-border/60 bg-card">
              <img src={CIRCLE_ART} alt="" className="h-36 w-full object-cover" loading="lazy" />
              <div className="p-4">
                <p className="font-serif text-[20px] font-semibold text-foreground">{t("ch.circle.empty.t")}</p>
                <p className="mt-1 text-[13.5px] leading-snug text-muted-foreground">{t("ch.circle.empty.s")}</p>
                <div className="mt-3.5 grid grid-cols-2 gap-2">
                  <button onClick={() => { haptic("light"); setCircleFlow("create"); }} className="rounded-full bg-primary py-3 text-[14px] font-bold text-primary-foreground active:scale-[0.98]">{t("ch.circle.create")}</button>
                  <button onClick={() => { haptic("light"); setCircleFlow("join"); }} className="rounded-full border border-border py-3 text-[14px] font-bold text-foreground active:scale-[0.98]">{t("ch.circle.join")}</button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {circles.slice(0, 3).map((c) => (
                <button key={c.id} onClick={() => navigate(`/challenge/circle?id=${c.id}`)} className="flex w-full items-center gap-3 rounded-2xl border border-border/60 bg-card p-3.5 text-left active:scale-[0.99]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-[22px]">{c.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold text-foreground">{c.name}</p>
                    <p className="mt-0.5 text-[12.5px] text-muted-foreground">{t("ch.circle.litToday", { n: c.litToday, total: c.members.length })}</p>
                  </div>
                  <div className="flex -space-x-2">
                    {c.members.slice(0, 4).map((m) => (
                      <span key={m.id} className={`grid h-8 w-8 place-items-center rounded-full border-2 border-card text-[14px] ${m.litToday ? "bg-primary/25" : "bg-muted"}`}>{m.avatar}</span>
                    ))}
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
              <div className="grid grid-cols-2 gap-2">
                <button onClick={() => setCircleFlow("create")} className="rounded-full border border-border py-2.5 text-[13.5px] font-semibold text-foreground">{t("ch.circle.add")}</button>
                <button onClick={() => setCircleFlow("join")} className="rounded-full border border-border py-2.5 text-[13.5px] font-semibold text-foreground">{t("ch.circle.join")}</button>
              </div>
            </div>
          )}
          {!identity && circles.length === 0 && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-muted-foreground"><Users className="h-3.5 w-3.5" />{t("ch.circle.privacy")}</p>}
        </section>

        {/* Milestones */}
        <section>
          <h2 className="mb-2.5 text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.hub.milestones")}</h2>
          <div className="-mx-4 flex gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {MILESTONES.map((m) => {
              const got = completed >= m;
              const lampIndex = Math.min(4, Math.floor((m - 1) / 15));
              return (
                <div key={m} className={`flex w-[92px] shrink-0 flex-col items-center rounded-2xl border p-2.5 text-center ${got ? "border-primary/40 bg-primary/10" : "border-border/60 bg-card"}`}>
                  <div className="relative grid h-12 w-full place-items-center">
                    <img src={LAMPS[lampIndex].src} alt="" className={`h-10 w-full object-contain ${got ? "" : "opacity-35 grayscale"}`} loading="lazy" />
                    {!got && <Lock className="absolute h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                  <p className={`mt-1 line-clamp-2 text-[11.5px] font-semibold leading-tight ${got ? "text-foreground" : "text-muted-foreground"}`}>{t(`ch.ms.${m}`)}</p>
                  <p className="mt-0.5 text-[10.5px] tabular-nums text-muted-foreground">{t("ch.day", { day: m })}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Path */}
        <section>
          <div className="mb-2.5 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{t("ch.hub.path")}</h2>
            <span className="text-[12.5px] font-semibold text-muted-foreground">{t("ch.hub.completed", { n: completed })}</span>
          </div>
          <ChallengePath
            completed={completed}
            currentDay={day}
            lit={lit}
            onOpenDay={(d) => navigate(d <= completed ? `/challenge/day/${d}` : "/challenge/day")}
          />
        </section>

        <p className="px-4 pb-2 pt-2 text-center font-serif text-[14px] italic leading-relaxed text-muted-foreground">
          “{t("ch.verse")}”<span className="mt-1 block text-[12px] not-italic">{t("ch.verseRef")}</span>
        </p>
      </main>

      <ChallengeSettingsSheet open={settingsOpen} state={state} onClose={() => setSettingsOpen(false)} />
      <CircleSheets
        flow={circleFlow}
        onClose={() => setCircleFlow(null)}
        onDone={(id) => { setCircleFlow(null); navigate(`/challenge/circle?id=${id}`); }}
      />
      <PremiumSheet
        isOpen={premiumOpen}
        trigger="challenge_grace_oil"
        onClose={() => setPremiumOpen(false)}
        onUnlock={() => { unlock(); setPremiumOpen(false); }}
      />
    </div>
  );
}
