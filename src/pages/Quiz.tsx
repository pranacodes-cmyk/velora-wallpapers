import { useIsLightTheme } from "@/hooks/useIsLightTheme";
import { useT } from "@/i18n";
import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Flame, Trophy, Zap, Calendar, Infinity as InfinityIcon, Swords,
  Crown, BookOpen, Sparkles, Skull, Rocket,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuiz, QuizMode } from "@/hooks/useQuiz";
import { QuizQuestionCard } from "@/components/quiz/QuizQuestionCard";
import { QuizResults } from "@/components/quiz/QuizResults";
import { QuizRevive } from "@/components/quiz/QuizRevive";
import { ProQuizPicker } from "@/components/quiz/ProQuizPicker";
import { Button } from "@/components/ui/button";
import { haptic } from "@/utils/haptics";
import { showRewardedAd } from "@/services/ads";
import { tryShowInterstitial } from "@/services/ad-cooldown";
import { usePremium } from "@/hooks/usePremium";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { glass } from "@/lib/glass";

export default function Quiz() {
  const { t } = useT();
  /* Pro section ink — navy on the cream light theme, gold in dark. */
  const proInk = useIsLightTheme() ? "222 60% 24%" : "42 85% 52%";
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const quiz = useQuiz();
  const { isPremium, unlock } = usePremium();
  const [endlessPaywallOpen, setEndlessPaywallOpen] = useState(false);
  const [proPickerKind, setProPickerKind] = useState<"book" | "pack" | null>(null);
  // Combo feedback — addictive juice (no cheap floating "+N" — handled in the chip itself)
  const prevScoreRef = useRef(0);
  const prevStreakRef = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [scoreBurst, setScoreBurst] = useState(0); // bumps key to retrigger glow
  const [hype, setHype] = useState<{ id: number; text: string; sub: string } | null>(null);

  // Smooth count-up for the score chip
  useEffect(() => {
    const target = quiz.stats.score;
    const start = displayScore;
    if (target === start) return;
    const delta = target - start;
    // Reset instantly when score drops to 0 (new run)
    if (target < start) {
      setDisplayScore(target);
      return;
    }
    const duration = Math.min(700, 220 + Math.abs(delta) * 4);
    const startTs = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - startTs) / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplayScore(Math.round(start + delta * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.stats.score]);

  useEffect(() => {
    const score = quiz.stats.score;
    const streak = quiz.stats.streak;
    if (quiz.state === "answered") {
      const delta = score - prevScoreRef.current;
      if (delta > 0) {
        setScoreBurst((b) => b + 1);
      }
      // Streak milestones — celebrate every 3, hype harder at 5/7/10/15
      if (streak > prevStreakRef.current && streak >= 3) {
        const tier =
          streak >= 15 ? { text: t("quiz.hype.unstoppable"), sub: t("quiz.hype.streakInfo", { count: streak }) }
          : streak >= 10 ? { text: t("quiz.hype.onFire"), sub: t("quiz.hype.streakKeep", { count: streak }) }
          : streak >= 7 ? { text: t("quiz.hype.heavenly"), sub: t("quiz.hype.straight", { count: streak }) }
          : streak >= 5 ? { text: t("quiz.hype.blessed"), sub: t("quiz.hype.streakInfo", { count: streak }) }
          : { text: t("quiz.hype.combo"), sub: t("quiz.hype.streakInfo", { count: streak }) };
        setHype({ id: Date.now(), ...tier });
        setTimeout(() => setHype(null), 1300);
      }
    }
    prevScoreRef.current = score;
    prevStreakRef.current = streak;
  }, [quiz.state, quiz.stats.score, quiz.stats.streak]);

  // Hide global bottom nav while a quiz is in progress so it doesn't overlap content
  useEffect(() => {
    const inProgress =
      quiz.state === "playing" ||
      quiz.state === "answered" ||
      quiz.state === "revive";
    if (inProgress) {
      document.body.dataset.hideNav = "true";
    } else {
      delete document.body.dataset.hideNav;
    }
    return () => {
      delete document.body.dataset.hideNav;
    };
  }, [quiz.state]);

  // Fire the armed rating prompt when the user LEAVES the Quiz page,
  // not the moment a quiz ends. Gives them their celebration first.
  useEffect(() => {
    return () => {
      try {
        if (sessionStorage.getItem("jw_rating_armed") === "1") {
          sessionStorage.removeItem("jw_rating_armed");
          // Small delay so the destination screen has time to settle
          setTimeout(() => {
            import("@/services/rating")
              .then((m) => m.maybeRequestRating())
              .catch(() => {});
          }, 600);
        }
      } catch {}
    };
  }, []);


  const handleStartQuiz = useCallback(async (
    mode: QuizMode,
    _skipEntryAd = false,
    opts: { book?: string; packId?: string } = {},
  ) => {
    // Pro-gated modes
    const proModes: QuizMode[] = ["book", "pack", "boss", "speedrun"];
    if (proModes.includes(mode) && !isPremium) {
      haptic("medium");
      setEndlessPaywallOpen(true);
      const trigger =
        mode === "streak" ? "endless_quiz"
        : mode === "book" ? "book_mastery"
        : mode === "pack" ? "themed_pack"
        : mode === "boss" ? "boss_round"
        : "speed_run";
      import("@/services/analytics").then((a) => a.track("paywall_shown", { trigger })).catch(() => {});
      return;
    }
    haptic("medium");
    import("@/services/analytics").then((a) => a.track("quiz_started", { mode, ...opts })).catch(() => {});
    quiz.startQuiz(mode, opts);
  }, [quiz, isPremium]);



  // Auto-start from Today's Verse handoff (?auto=daily) — the interstitial
  // already fired in VerseReflectionSheet, so skip the entry rewarded ad and
  // drop the user directly into the daily quiz running screen.
  const autoMode = searchParams.get("auto") as QuizMode | null;
  const autoStartedRef = useRef(false);
  useEffect(() => {
    if (autoStartedRef.current) return;
    if (!autoMode) return;
    if (quiz.state !== "idle") return;
    autoStartedRef.current = true;
    // Strip the param so reload/back doesn't auto-restart
    const next = new URLSearchParams(searchParams);
    next.delete("auto");
    setSearchParams(next, { replace: true });
    if (autoMode === "daily" && quiz.dailyCompleted) {
      // Already done today — just let them browse the hub instead of forcing
      return;
    }
    handleStartQuiz(autoMode, true);
  }, [autoMode, quiz.state, quiz.dailyCompleted, handleStartQuiz, searchParams, setSearchParams]);


  const handleRevive = useCallback(async () => {
    // Show rewarded ad; only revive if they earned the reward (premium skips).
    if (isPremium) {
      quiz.revive();
      return;
    }
    const earned = await showRewardedAd(t("quiz.revive.loading"));
    if (earned) {
      import("@/services/analytics").then((a) => a.track("quiz_revived", { mode: quiz.mode })).catch(() => {});
      quiz.revive();
    }
    // If they dismissed early / no fill, stay on the revive screen so they
    // can try again or tap "End run".
  }, [quiz, isPremium, t]);


  const navHidden =
    quiz.state === "playing" ||
    quiz.state === "answered" ||
    quiz.state === "revive";

  return (
    <div
      className="h-full flex flex-col"
      style={{ background: "hsl(var(--background))" }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-30 px-4 pb-3"
        style={{
          ...glass({ blur: 20, bg: "hsl(var(--nav-blur))", saturate: "saturate(1.5)" }),
          borderBottom: "1px solid hsl(var(--glass-border))",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={async () => {
              haptic("soft");
              if (quiz.state === "playing" || quiz.state === "answered") {
                quiz.finishQuiz();
                return;
              }
              // Interstitials removed from Today's Walk flow to protect Day-0
              // retention. Quiz completion should feel rewarding, not ad-gated.
              quiz.state === "idle" ? navigate(-1) : quiz.reset();
            }}
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--glass-border))" }}
          >
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-black text-foreground">
              {quiz.state === "idle" ? t("quiz.header.title") : quiz.mode === "daily" ? t("quiz.header.daily") : quiz.mode === "streak" ? t("quiz.header.streak") : t("quiz.header.challenge")}
            </h1>
          </div>
          {(quiz.state === "playing" || quiz.state === "answered") && (
            <div className="flex items-center gap-3">
              {quiz.stats.streak >= 3 && (
                <motion.div
                  className="flex items-center gap-1 px-2 py-1 rounded-lg"
                  style={{ background: "hsl(25 90% 50% / 0.15)" }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 0.3 }}
                  key={quiz.stats.streak}
                >
                  <Flame className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-xs font-black text-orange-400 tabular-nums">{quiz.stats.streak}</span>
                </motion.div>
              )}
              <motion.div
                key={`score-${quiz.stats.score}`}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 0.35 }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                style={{ background: "hsl(var(--primary) / 0.1)" }}
              >
                <Zap className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-black text-primary tabular-nums">{quiz.stats.score}</span>
              </motion.div>
            </div>
          )}
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto scroll-container px-4 pt-4"
        style={{
          // Ensure lengthy questions/results can scroll above the bottom nav + safe area
          paddingBottom: navHidden
            ? "calc(env(safe-area-inset-bottom, 0px) + 32px)"
            : "calc(env(safe-area-inset-bottom, 0px) + 140px)",
        }}
      >
        <AnimatePresence mode="wait">
          {/* === IDLE: Mode Selection === */}
          {quiz.state === "idle" && (
            <motion.div
              key="hub"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-4"
            >
              {/* Hero */}
              <div
                className="rounded-2xl p-5 text-center overflow-hidden relative"
                style={{
                  background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.08))",
                  border: "1px solid hsl(var(--primary) / 0.2)",
                }}
              >
                {/* Shimmer sweep — infinite loops kill Android battery, disable there. */}
                {!(typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent)) && (
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.05), transparent)",
                    }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 4, repeat: Infinity, repeatDelay: 2 }}
                  />
                )}
                <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}>
                  <BookOpen className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-black text-foreground mb-1">{t("quiz.hero.title")}</h2>
                <p className="text-xs text-muted-foreground">
                  {t("quiz.hero.subtitle")}
                </p>
                {quiz.highScore > 0 && (
                  <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold" style={{ color: "hsl(42 85% 52%)" }}>
                    <Crown className="w-3 h-3" />
                    {t("quiz.hero.highScore", { score: quiz.highScore })}
                  </div>
                )}
              </div>

              {/* Stats bar */}
              <div className="flex gap-2">
                <QuickStat icon="🔥" label={t("quiz.stats.dailyStreak")} value={String(quiz.dailyStreak.count)} />
                <QuickStat icon="🏆" label={t("quiz.stats.bestRun")} value={String(quiz.bestStreakEver)} />
                <QuickStat icon="🎮" label={t("quiz.stats.games")} value={String(quiz.gamesPlayed)} />
              </div>

              {/* Mode Cards */}
              <ModeCard
                icon={<Calendar className="w-5 h-5" />}
                title={t("quiz.mode.daily.title")}
                description={t("quiz.mode.daily.desc")}
                tag={quiz.dailyCompleted ? t("quiz.mode.daily.completed") : t("quiz.mode.daily.new")}
                tagColor={quiz.dailyCompleted ? "hsl(142 60% 40%)" : "hsl(var(--primary))"}
                disabled={quiz.dailyCompleted}
                onClick={() => handleStartQuiz("daily")}
              />
              <ModeCard
                icon={<InfinityIcon className="w-5 h-5" />}
                title={t("quiz.mode.streak.title")}
                description={t("quiz.mode.streak.desc")}
                tag={t("quiz.mode.streak.tag")}
                tagColor="hsl(var(--accent))"
                onClick={() => handleStartQuiz("streak")}
              />

              <ModeCard
                icon={<Swords className="w-5 h-5" />}
                title={t("quiz.mode.challenge.title")}
                description={t("quiz.mode.challenge.desc")}
                tag={t("quiz.mode.challenge.tag")}
                tagColor="hsl(var(--primary))"
                onClick={() => handleStartQuiz("challenge")}
              />

              {/* ╔══════════════════ PRO MODES ══════════════════╗ */}
              <div className="flex items-center gap-2 pt-3 pb-1">
                <Crown className="w-3.5 h-3.5" style={{ color: `hsl(${proInk})` }} />
                <span className="text-[11px] font-black tracking-wider uppercase"
                  style={{ color: `hsl(${proInk})` }}>
                  {t("quiz.pro.header")}
                </span>
                <div className="flex-1 h-px" style={{ background: `linear-gradient(90deg, hsl(${proInk} / 0.4), transparent)` }} />
              </div>

              <ProModeCard
                icon={<BookOpen className="w-5 h-5" />}
                title={t("quiz.mode.book.title")}
                description={t("quiz.mode.book.desc")}
                tag={t("quiz.mode.book.tag")}
                onClick={() => {
                  if (!isPremium) { handleStartQuiz("book"); return; }
                  haptic("soft");
                  setProPickerKind("book");
                }}
                locked={!isPremium}
              />

              <ProModeCard
                icon={<Sparkles className="w-5 h-5" />}
                title={t("quiz.mode.pack.title")}
                description={t("quiz.mode.pack.desc")}
                tag={t("quiz.mode.pack.tag")}
                onClick={() => {
                  if (!isPremium) { handleStartQuiz("pack"); return; }
                  haptic("soft");
                  setProPickerKind("pack");
                }}
                locked={!isPremium}
              />

              <ProModeCard
                icon={<Skull className="w-5 h-5" />}
                title={t("quiz.mode.boss.title")}
                description={t("quiz.mode.boss.desc")}
                tag={t("quiz.mode.boss.tag")}
                onClick={() => handleStartQuiz("boss")}
                locked={!isPremium}
              />

              <ProModeCard
                icon={<Rocket className="w-5 h-5" />}
                title={t("quiz.mode.speedrun.title")}
                description={t("quiz.mode.speedrun.desc")}
                tag={t("quiz.mode.speedrun.tag")}
                onClick={() => handleStartQuiz("speedrun")}
                locked={!isPremium}
              />
            </motion.div>
          )}

          {/* === PLAYING / ANSWERED === */}
          {(quiz.state === "playing" || quiz.state === "answered") && quiz.currentQuestion && (
            <motion.div key={`q-${quiz.currentIndex}`}>
              <QuizQuestionCard
                question={quiz.currentQuestion}
                selectedAnswer={quiz.selectedAnswer}
                timeLeft={quiz.timeLeft}
                maxTime={quiz.TIME_PER_QUESTION}
                onAnswer={quiz.answerQuestion}
                questionNumber={quiz.currentIndex + 1}
                totalQuestions={quiz.totalQuestions}
              />

              {/* Next button */}
              {quiz.state === "answered" && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  <Button
                    onClick={() => {
                      haptic("soft");
                      quiz.nextQuestion();
                    }}
                    className="w-full h-12 rounded-xl font-bold text-sm text-white"
                    style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))" }}
                  >
                    {quiz.isLastQuestion ? t("quiz.game.finish") : t("quiz.game.next")}
                  </Button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* === RESULTS === */}
          {quiz.state === "results" && (
            <motion.div key="results" className="pt-4">
              <QuizResults
                stats={quiz.stats}
                mode={quiz.mode}
                totalQuestions={quiz.totalQuestions}
                bestStreakEver={quiz.bestStreakEver}
                isNewHighScore={quiz.isNewHighScore}
                onPlayAgain={() => handleStartQuiz(quiz.mode)}
                onHome={() => {
                  quiz.reset();
                }}
                onDoubleScore={quiz.doubleScore}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Revive overlay */}
      <AnimatePresence>
        {quiz.state === "revive" && (
          <QuizRevive
            streak={quiz.stats.bestStreak}
            onRevive={handleRevive}
            onGiveUp={quiz.finishQuiz}
            mode={quiz.mode}
            reviveCount={quiz.reviveCount}
            maxRevives={quiz.maxRevives}
          />
        )}
      </AnimatePresence>



      {/* Streak hype banner — addictive milestone celebration */}
      <AnimatePresence>
        {hype && (
          <motion.div
            key={hype.id}
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -10 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="pointer-events-none fixed left-1/2 top-[28%] -translate-x-1/2 z-40 px-5 py-3 rounded-2xl text-center"
            style={{
              background: "linear-gradient(135deg, hsl(25 90% 50% / 0.95), hsl(42 95% 55% / 0.95))",
              boxShadow: "0 12px 40px hsl(25 90% 50% / 0.5)",
              // Blur dropped on Android — GPU killer; gradient already opaque.
              ...(typeof navigator !== "undefined" && !/Android/i.test(navigator.userAgent)
                ? { backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)" }
                : {}),
            }}
          >
            <div className="text-base font-black text-white whitespace-nowrap">{hype.text}</div>
            <div className="text-[10px] font-bold text-white/90 mt-0.5">{hype.sub}</div>
          </motion.div>
        )}
      </AnimatePresence>



      {/* Pro-mode paywall */}
      <PremiumSheet
        isOpen={endlessPaywallOpen}
        onClose={() => setEndlessPaywallOpen(false)}
        onUnlock={() => {
          unlock();
          setEndlessPaywallOpen(false);
          // After unlock, open the relevant picker so users land in the Pro mode they tapped
          setTimeout(() => {
            // Default: streak if they didn't go through a picker route
            quiz.startQuiz("streak");
          }, 300);
        }}
        trigger="endless_quiz"
      />

      {/* Pro Quiz Picker — Book / Pack selection */}
      <ProQuizPicker
        open={proPickerKind !== null}
        kind={proPickerKind}
        onClose={() => setProPickerKind(null)}
        onPickBook={(book) => { setProPickerKind(null); handleStartQuiz("book", false, { book }); }}
        onPickPack={(packId) => { setProPickerKind(null); handleStartQuiz("pack", false, { packId }); }}
      />

    </div>
  );
}


function ProModeCard({
  icon, title, description, tag, locked, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  locked?: boolean;
  onClick: () => void;
}) {
  /* Gold reads cheap on the cream light theme, so light mode uses deep
     royal-blue ink and keeps gold only for the small PRO badge. */
  const isLight = useIsLightTheme();
  const ink = isLight ? "222 60% 24%" : "42 85% 52%";
  const iconGrad = isLight
    ? "linear-gradient(135deg, hsl(222 60% 24%), hsl(222 55% 38%))"
    : "linear-gradient(135deg, hsl(42 85% 52%), hsl(35 90% 55%))";

  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: `linear-gradient(135deg, hsl(${ink} / ${isLight ? 0.07 : 0.10}), hsl(var(--card)) 60%)`,
        border: `1px solid hsl(${ink} / ${isLight ? 0.28 : 0.35})`,
        boxShadow: `0 6px 24px hsl(${ink} / 0.14)`,
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white"
          style={{ background: iconGrad }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <span
              className="text-[9px] font-black px-2 py-0.5 rounded-full"
              style={{ background: `hsl(${ink} / 0.14)`, color: `hsl(${ink})` }}
            >
              {tag}
            </span>
            {locked && (
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1"
                style={{ background: "hsl(42 85% 52%)", color: "hsl(222 47% 11%)" }}
              >
                <Crown className="w-2.5 h-2.5" /> PRO
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}


function ModeCard({
  icon, title, description, tag, tagColor, disabled, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tag: string;
  tagColor: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={!disabled ? { scale: 0.98 } : undefined}
      onClick={disabled ? undefined : onClick}
      className="w-full text-left rounded-2xl p-4 relative overflow-hidden"
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--glass-border))",
        opacity: disabled ? 0.5 : 1,
        boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-primary"
          style={{ background: "hsl(var(--primary) / 0.1)" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            <span
              className="text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: `${tagColor}20`, color: tagColor }}
            >
              {tag}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-relaxed">{description}</p>
        </div>
      </div>
    </motion.button>
  );
}

function QuickStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div
      className="flex-1 rounded-xl p-3 text-center"
      style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--glass-border))" }}
    >
      <span className="text-base">{icon}</span>
      <p className="text-lg font-black text-foreground tabular-nums">{value}</p>
      <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
  );
}
