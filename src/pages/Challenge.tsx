import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Anchor, BookOpen, ChevronRight, Settings2, Share2 } from "lucide-react";
import { useT } from "@/i18n";
import { useChallenge } from "@/hooks/useChallenge";
import { usePremium } from "@/hooks/usePremium";
import { challengeDay, stageForDay, type TaskId } from "@/data/challenge75";
import { CHALLENGE_AD_FLAG, clearNotice, msUntilMidnight, resetChallenge, startChallenge, type ChallengeMode } from "@/services/challenge";
import { tryShowInterstitial } from "@/services/ad-cooldown";
import { buddiesOf, CIRCLE_EVENT, getCachedOverview, getIdentity, setPendingBuddy, takePendingBuddy } from "@/services/challengeCircle";
import { JourneyBuddies } from "@/components/challenge/JourneyBuddies";
import { ProJourneysSection } from "@/components/projourney/ProJourneysSection";
import { requestChallengeNotificationPermission, syncChallengeReminders } from "@/services/challengeReminders";
import { track } from "@/services/analytics";
import { haptic } from "@/utils/haptics";
import { nativeShare } from "@/utils/nativeShare";
import { ChallengeIntro } from "@/components/challenge/ChallengeIntro";
import { ChallengeSettingsSheet } from "@/components/challenge/ChallengeSettingsSheet";
import { CircleSheets, type CircleFlow } from "@/components/challenge/CircleSheets";
import { LogbookSheet } from "@/components/challenge/LogbookSheet";
import { JourneyInfo } from "@/components/challenge/JourneyInfo";
import { TodayPath } from "@/components/challenge/TodayPath";
import { MilestoneShelf } from "@/components/challenge/MilestoneShelf";
import { VoyagePoster } from "@/components/challenge/VoyagePoster";
import { JOURNEY_TOUR_KEY, JourneyWalkthrough } from "@/components/challenge/JourneyWalkthrough";
import { getVoyageSeen, setVoyageSeen } from "@/components/challenge/voyage";
import { formatCountdown, useNow, useReadingLabel } from "@/components/challenge/useReading";
import { Button } from "@/components/ui/button";

const goldCta =
  "flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3.5 text-[15.5px] font-bold text-primary-foreground active:scale-[0.985] transition-transform";

/** Journey tab — 75 Days of Light as a lamb-led path to the cross. */
export default function Challenge() {
  const navigate = useNavigate();
  const { t, lang } = useT();
  const view = useChallenge();
  const { state, day, completed, lit, done, streak } = view;
  const { isPremium } = usePremium();
  const now = useNow();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [circleRev, setCircleRev] = useState(0);
  useEffect(() => {
    const bump = () => setCircleRev((n) => n + 1);
    window.addEventListener(CIRCLE_EVENT, bump);
    return () => window.removeEventListener(CIRCLE_EVENT, bump);
  }, []);
  const posterBuddies = useMemo(
    () => buddiesOf(getCachedOverview()).map((b) => ({ id: b.id, days: b.completedDays, avatar: b.avatar, name: b.name })),
    [circleRev],
  );
  const [circleFlow, setCircleFlow] = useState<CircleFlow>(null);
  const [pendingMode, setPendingMode] = useState<ChallengeMode | null>(null);
  const [joinCode, setJoinCode] = useState("");
  const [tourOpen, setTourOpen] = useState(() => {
    try { return state.status !== "idle" && localStorage.getItem(JOURNEY_TOUR_KEY) !== "1"; } catch { return false; }
  });

  // Buddy links (?buddy=CODE) open the join sheet once the journey has started.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("buddy");
    if (code) setPendingBuddy(code);
  }, []);
  useEffect(() => {
    if (state.status === "idle") return;
    const code = takePendingBuddy();
    if (code) { setJoinCode(code); setCircleFlow("join"); }
  }, [state.status]);
  const plan = challengeDay(day);
  const refLabel = useReadingLabel(lang, plan);
  const finished = state.status === "finished";

  // The lamb walks forward from where the user last saw it.
  const [fromDays, setFromDays] = useState<number | null>(() => {
    const seen = getVoyageSeen();
    return seen != null && seen < completed ? seen : null;
  });
  useEffect(() => {
    const seen = getVoyageSeen();
    if (seen == null || seen > completed) setVoyageSeen(completed);
  }, [completed]);

  useEffect(() => { track("challenge_hub_viewed", { status: state.status, completed }); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (state.status === "idle") return;
    try { if (localStorage.getItem(JOURNEY_TOUR_KEY) !== "1") setTourOpen(true); } catch { /* blocked */ }
  }, [state.status]);
  useEffect(() => { void syncChallengeReminders(t, state); }, [state, t]);

  // A free user just completed a day: one warm interstitial, only while still here.
  useEffect(() => {
    let pending: string | null = null;
    try { pending = sessionStorage.getItem(CHALLENGE_AD_FLAG); sessionStorage.removeItem(CHALLENGE_AD_FLAG); } catch { /* storage blocked */ }
    if (!pending || isPremium || Date.now() - Number(pending) > 15_000) return;
    const timer = setTimeout(() => { tryShowInterstitial("challenge_day_lit", { onlyIfWarm: true }).catch(() => {}); }, 900);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stage = stageForDay(lit || finished ? Math.max(1, completed) : day);

  const subtitles = useMemo<Record<TaskId, string>>(() => ({
    read: refLabel || t("ch.task.read.sub"),
    pray: plan.focus || t("ch.task.pray.sub"),
    live: plan.action || t("ch.task.live.sub"),
    reflect: t("ch.task.reflect.sub"),
  }), [refLabel, plan, t]);

  const beginJourney = (mode: ChallengeMode) => {
    startChallenge(mode);
    setVoyageSeen(0);
    setPendingMode(null);
    setCircleFlow(null);
    track("challenge_started", { mode, morning: "07:00", night: "21:00" });
    void requestChallengeNotificationPermission().then(() => syncChallengeReminders(t));
  };

  if (state.status === "idle") {
    return (
      <>
      <ChallengeIntro
        onStart={(mode: ChallengeMode) => {
          if (getIdentity()) beginJourney(mode);
          else { setPendingMode(mode); setCircleFlow("profile"); }
        }}
      />
      <CircleSheets flow={circleFlow}
        onClose={() => { setCircleFlow(null); setPendingMode(null); }}
        onDone={() => { if (pendingMode) beginJourney(pendingMode); }} />
      </>
    );
  }

  const openTask = (id: TaskId) => {
    haptic("light");
    if (lit || finished) navigate(`/challenge/day/${Math.max(1, completed)}`);
    else navigate(`/challenge/day?task=${id}`);
  };

  const notice = state.notice;

  return (
    <div className="scroll-container h-[calc(100%-104px-env(safe-area-inset-bottom))] overflow-y-auto bg-background pb-10">
      <header className="flex items-start gap-2 px-5 pb-4 pt-[max(14px,env(safe-area-inset-top))]">
        <div className="min-w-0 flex-1">
          <h1 id="journey-title" className="truncate text-[26px] font-bold leading-tight tracking-normal text-foreground">{t("ch.name")}</h1>
          <p className="mt-1 text-[13px] font-medium text-primary">
            {finished ? t("ch.home.finished") : `${t("ch.day", { day: lit ? Math.max(1, completed) : plan.day })} · ${t(`ch.stage.${stage.key}`)}`}
          </p>
        </div>
        <Button onClick={() => { haptic("light"); setSettingsOpen(true); }} aria-label={t("ch.hub.settings")} variant="ghost" size="icon" className="h-10 w-10 rounded-full text-muted-foreground">
          <Settings2 className="h-[18px] w-[18px]" />
        </Button>
      </header>

      <main className="mx-auto max-w-[540px] space-y-5 px-4">
        <section aria-labelledby="journey-title" className="space-y-3">
          <VoyagePoster
            days={completed}
            fromDays={fromDays}
            buddies={posterBuddies}
            priority
            className="rounded-xl"
            label={t("ch.voyage.a11y", { n: completed })}
            onArrive={() => { setVoyageSeen(completed); setFromDays(null); haptic("medium"); }}
          />
          <div className="flex items-center gap-3 px-1">
            <span className="shrink-0 text-[12px] font-medium tabular-nums text-muted-foreground">{t("ch.hub.daysProgress", { n: completed })}</span>
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={t("ch.name")} aria-valuenow={completed} aria-valuemin={0} aria-valuemax={75}>
              <div className="h-full rounded-full bg-primary transition-[width] duration-700" style={{ width: `${(completed / 75) * 100}%` }} />
            </div>
            <JourneyInfo kind="lamb" />
          </div>
        </section>

        {/* Missed-day notice */}
        {notice && (
          <div className="challenge-rise flex items-start gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-3">
            <Anchor className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] leading-snug text-foreground">
                {notice.type === "grace_used" && t("ch.notice.grace", { n: notice.days })}
                {notice.type === "streak_reset" && t("ch.notice.reset", { done: completed })}
                {notice.type === "restarted" && t("ch.notice.restart", { n: notice.reached })}
              </p>
              <Button onClick={clearNotice} className="mt-2 text-[13px] font-bold text-primary">{t("ch.notice.ok")}</Button>
            </div>
          </div>
        )}

        {/* Today's steps */}
        {finished ? (
          <section className="rounded-[24px] border border-primary/30 bg-card p-5 text-center shadow-sm">
            <h2 className="font-serif text-[24px] font-semibold text-foreground">{t("ch.cele.finishedTitle")}</h2>
            <p className="mx-auto mt-1 max-w-[300px] text-[14px] leading-snug text-muted-foreground">{t("ch.cele.finishedSub")}</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                onClick={() => { haptic("medium"); track("challenge_new_round"); setVoyageSeen(0); resetChallenge(); }}
                className="rounded-full bg-primary px-4 py-3 text-[14.5px] font-bold text-primary-foreground active:scale-[0.98]"
              >
                {t("ch.finished.again")}
              </Button>
              <Button
                onClick={() => { haptic("light"); void nativeShare({ title: t("ch.name"), text: t("ch.share.finished"), includeAppLink: true }); }}
                className="flex items-center justify-center gap-2 rounded-full border border-border px-4 py-3 text-[14.5px] font-semibold text-foreground active:scale-[0.98]"
              >
                <Share2 className="h-4 w-4" />{t("ch.cele.share")}
              </Button>
            </div>
          </section>
        ) : (
          <section>
            <TodayPath done={done} allDone={lit} subtitles={subtitles} onOpen={openTask} />
            <Button variant="ghost" onClick={() => openTask("live")} className="mt-3 h-auto w-full justify-start gap-3 rounded-none border-y border-border px-1 py-4 text-left">
              <span aria-hidden className="shrink-0 text-[26px]">{plan.missionEmoji}</span>
              <span className="min-w-0 flex-1 whitespace-normal">
                <span className="block text-[10.5px] font-semibold uppercase text-primary">{t("ch.live.title", { day: String(plan.day).padStart(2, "0") })}</span>
                <span className="mt-1 block text-[17px] font-semibold text-foreground">{plan.missionTitle}</span>
                <span className="mt-1 block text-[13px] font-normal leading-relaxed text-muted-foreground">{plan.how}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
            </Button>

            <div className="mt-3">
              {lit ? (
                <div className="rounded-[22px] bg-primary/10 px-4 py-3.5 text-center ring-1 ring-primary/20">
                  <p className="text-[16px] font-semibold text-foreground">{t("ch.lit.title", { day: plan.day })}</p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">{t("ch.lit.next", { day: plan.day + 1, time: formatCountdown(msUntilMidnight(now), t) })}</p>
                  <Button onClick={() => navigate(`/challenge/day/${plan.day}`)} className="mt-2 text-[13.5px] font-bold text-primary">
                    {t("ch.cta.review", { day: plan.day })}
                  </Button>
                </div>
              ) : (
                <Button onClick={() => { haptic("medium"); navigate("/challenge/day"); }} className={goldCta}>
                  {done.length ? t("ch.cta.continue", { day: plan.day }) : t("ch.cta.begin", { day: plan.day })}
                  <ChevronRight className="h-5 w-5" />
                </Button>
              )}
            </div>
          </section>
        )}

        <MilestoneShelf completed={completed} streak={streak} />

        <ProJourneysSection isPremium={isPremium} />

        <JourneyBuddies isPremium={isPremium} onJoin={() => { setJoinCode(""); setCircleFlow("join"); }} onNeedProfile={() => setCircleFlow("profile")} />


        {/* Logbook */}
        <Button
          onClick={() => { haptic("light"); setLogOpen(true); }}
          variant="ghost" className="h-auto w-full justify-start gap-3 rounded-none px-1 py-3 text-left"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-foreground">{t("ch.logbook")}</span>
            <span className="block text-[12.5px] text-muted-foreground">{t(completed === 1 ? "ch.hub.completedOne" : "ch.hub.completed", { n: completed })}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>

      </main>

      <CircleSheets flow={circleFlow} initialCode={joinCode}
        onClose={() => setCircleFlow(null)}
        onDone={() => { setCircleFlow(null); track("challenge_buddy_joined"); }} />
      <ChallengeSettingsSheet open={settingsOpen} state={state} onClose={() => setSettingsOpen(false)} />
      <LogbookSheet open={logOpen} completed={completed} currentDay={day} lit={lit} onClose={() => setLogOpen(false)} />
      <JourneyWalkthrough open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
