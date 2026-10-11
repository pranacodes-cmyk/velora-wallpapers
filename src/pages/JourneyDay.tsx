import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Check, Smartphone, ArrowRight, Flame } from "lucide-react";
import { getJourney } from "@/data/journeys";
import { getJourneyDayGuide } from "@/data/journeyGuides";
import { getRichDay } from "@/data/journeyRichContent";
import { useJourneyProgress, isPremiumJourneyDay } from "@/hooks/useJourneyProgress";
import { useStreak } from "@/hooks/useStreak";
import { usePremium } from "@/hooks/usePremium";
import { showInterstitialAd, primeInterstitial } from "@/services/ads";
import { haptic } from "@/utils/haptics";
import { toast } from "sonner";
import RichDayExperience from "@/components/journey/RichDayExperience";
import { LazyPremiumSheet as PremiumSheet } from "@/components/LazyPremiumSheet";
import { isJourneyFreeForUser } from "@/lib/userProfile";
import { glass } from "@/lib/glass";
import { useT } from "@/i18n";

// Interstitial only after Day 1 of each journey. Day 2+ are gated by a
// rewarded ad at *unlock time* instead (handled by the Journeys list / lock
// sheet), so we don't double-ad the user on completion.
// Premium users never see ads.
function shouldShowJourneyAd(day: number, isPremium: boolean): boolean {
  if (isPremium) return false;
  return day === 1;
}


type Stage = "opening" | "verse" | "deeper" | "checkin";

// One-time reset so the user re-experiences rebuilt days fresh.
// Bump this key whenever a rich day's content meaningfully changes.
const RESET_KEY = "cw_journey_reset_v2_rich_anxiety_d1";
function runOneTimeResets() {
  try {
    if (localStorage.getItem(RESET_KEY)) return;
    const raw = localStorage.getItem("cw_journey_progress");
    if (raw) {
      const data = JSON.parse(raw);
      const a = data["anxiety-peace"];
      if (a?.completedDays?.includes(1)) {
        a.completedDays = a.completedDays.filter((d: number) => d !== 1);
        data["anxiety-peace"] = a;
        localStorage.setItem("cw_journey_progress", JSON.stringify(data));
        window.dispatchEvent(new CustomEvent("cw_journey_progress_changed"));
      }
    }
    localStorage.setItem(RESET_KEY, "1");
  } catch {
    // Ignore malformed legacy progress during the one-time reset.
  }
}
runOneTimeResets();

export default function JourneyDay() {
  const { t } = useT();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const journey = id ? getJourney(id) : undefined;
  const { getCurrentDay, isDayCompleted, completeDay, getCompletedDays, getDayUnlockAt, requiresAdUnlock } =
    useJourneyProgress();


  const { current: streakDays } = useStreak();
  const { isPremium, unlock } = usePremium();
  const [premiumOpen, setPremiumOpen] = useState(false);

  const totalDays = journey?.days.length ?? 7;
  const [selectedDay, setSelectedDay] = useState<number>(() =>
    journey ? getCurrentDay(journey.id, totalDays) : 1
  );
  const [stage, setStage] = useState<Stage>("opening");
  const [feeling, setFeeling] = useState<"down" | "same" | "lifted" | null>(null);
  const [checkedTasks, setCheckedTasks] = useState<number[]>([]);

  // Reset to opening whenever selected day changes
  useEffect(() => {
    setStage("opening");
    setFeeling(null);
    setCheckedTasks([]);
  }, [selectedDay]);

  // Hide bottom nav while reading
  useEffect(() => {
    document.body.dataset.hideNav = "true";
    return () => {
      delete document.body.dataset.hideNav;
    };
  }, []);

  // Warm an interstitial in the background — completion is the trigger.
  useEffect(() => {
    if (!isPremium) primeInterstitial().catch(() => {});
  }, [isPremium]);

  // Analytics — fires once per day mount
  useEffect(() => {
    if (!journey) return;
    import("@/services/analytics").then((a) => a.track("journey_day_opened", {
      journey_id: journey.id,
      day: selectedDay,
      total_days: totalDays,
      already_completed: isDayCompleted(journey.id, selectedDay),
    })).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [journey?.id, selectedDay]);


  // Premium-only journeys: bounce non-premium users back to the list.
  useEffect(() => {
    if (journey && !isPremium && !isJourneyFreeForUser(journey)) {
      toast(t("jn.toast.premiumReq"));
      navigate("/journeys", { replace: true });
    }
  }, [journey, isPremium, navigate]);

  // If the auto-selected next day is waiting until tomorrow or needs a
  // rewarded-ad unlock, bounce back so the Journeys sheet can guide them.
  useEffect(() => {
    if (!journey) return;
    // Day 5+ is Premium-only — bounce free users back to the list so the
    // Premium sheet can handle the conversion moment.
    if (isPremiumJourneyDay(selectedDay, isPremium)) {
      toast(t("jn.toast.dayPremiumReq", { day: selectedDay }));
      navigate("/journeys", { replace: true });
      return;
    }
    const unlockAt = getDayUnlockAt(journey.id, selectedDay);
    if ((unlockAt && unlockAt > Date.now()) || requiresAdUnlock(journey.id, selectedDay, isPremium)) {
      navigate("/journeys", { replace: true });
    }
  }, [journey, isPremium, selectedDay, getDayUnlockAt, requiresAdUnlock, navigate]);



  const dayData = useMemo(
    () => journey?.days.find((d) => d.day === selectedDay),
    [journey, selectedDay]
  );
  const completedDays = journey ? getCompletedDays(journey.id) : [];
  const isCompleted = journey ? isDayCompleted(journey.id, selectedDay) : false;

  if (!journey || !dayData) {
    return (
      <div className="h-full flex items-center justify-center bg-background text-foreground">
        <button onClick={() => navigate("/journeys")} className="text-primary">
          {t("jn.day.notFound")}
        </button>
      </div>
    );
  }

  const isDayLocked = (d: number): boolean => {
    if (d === 1) return false;
    for (let i = 1; i < d; i++) {
      if (!completedDays.includes(i)) return true;
    }
    return false;
  };

  const handleComplete = () => {
    haptic("medium");
    const wasFirstCompletion = !isCompleted;
    if (wasFirstCompletion) {
      completeDay(journey.id, selectedDay);
      import("@/services/analytics").then((a) => a.track("journey_day_completed", {
        journey_id: journey.id,
        day: selectedDay,
        total_days: totalDays,
      })).catch(() => {});
    }
    setStage("checkin");

    // Fire interstitial AFTER the user lands on the celebration screen.
    // Slight delay lets the success haptic + check-in animation play first.
    if (wasFirstCompletion && shouldShowJourneyAd(selectedDay, isPremium)) {
      setTimeout(() => {
        showInterstitialAd().catch(() => {});
      }, 900);
    }

    // Premium paywall — every day completion is a high-intent value moment.
    // Fires after the check-in animation; skipped for Pro users.
    if (wasFirstCompletion && !isPremium) {
      setTimeout(() => setPremiumOpen(true), 1600);
    }
  };



  const hue = journey.hue;
  const guide = getJourneyDayGuide(journey.id, dayData);
  const richDay = getRichDay(journey.id, selectedDay);

  // If this day has a rich, paced, multi-slide experience, render that.
  // It runs through its own slides, then drops the user into the existing
  // check-in stage (feeling + wallpaper + continue).
  if (richDay && stage !== "checkin") {
    return (
      <RichDayExperience
        hue={hue}
        journeyId={journey.id}
        journeyTitle={journey.title}
        journeyEmoji={journey.emoji}
        day={selectedDay}
        rich={richDay}
        onExit={() => navigate("/journeys")}
        onComplete={handleComplete}
      />
    );
  }

  return (
    <div
      className="h-full flex flex-col relative overflow-hidden"
      style={{
        background: `radial-gradient(120% 80% at 0% 0%, hsl(${hue} 60% 22% / 0.55), transparent 55%), radial-gradient(100% 80% at 100% 100%, hsl(${hue} 50% 15% / 0.45), transparent 55%), hsl(var(--background))`,
      }}
    >
      {/* Ambient glow */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.4 }}
        style={{
          background: `radial-gradient(60% 40% at 50% 0%, hsl(${hue} 85% 65% / 0.18), transparent 70%)`,
        }}
      />

      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-3 pb-3 safe-top relative z-20">
        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              haptic("soft");
              navigate("/journeys");
            }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{
                  ...glass({ blur: 20, bg: "hsl(var(--glass))" }),
                  border: "1px solid hsl(var(--glass-border))",
                }}
          >
            <ChevronLeft className="w-5 h-5 text-foreground" strokeWidth={2.4} />
          </button>
          <div className="flex flex-col items-center">
            <span className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/50">
              {journey.emoji} {journey.title}
            </span>
          </div>
          <div className="w-10" />
        </div>

        {/* Day dots */}
        <div className="flex items-center justify-center gap-1.5 mt-3.5">
          {journey.days.map((d) => {
            const done = completedDays.includes(d.day);
            const active = d.day === selectedDay;
            const locked = isDayLocked(d.day);
            return (
              <button
                key={d.day}
                onClick={() => {
                  if (locked) {
                    haptic("light");
                    toast.error(t("jn.toast.completePrevious", { n: d.day - 1 }));
                    return;
                  }
                  haptic("soft");
                  setSelectedDay(d.day);
                }}
                className="flex items-center justify-center transition-all"
                style={{
                  width: active ? 28 : 8,
                  height: 8,
                  borderRadius: 999,
                  background: done
                    ? `hsl(${hue} 75% 60%)`
                    : active
                    ? `hsl(${hue} 70% 55% / 0.6)`
                    : locked
                    ? "hsl(0 0% 100% / 0.08)"
                    : "hsl(0 0% 100% / 0.18)",
                  boxShadow: active
                    ? `0 0 12px hsl(${hue} 80% 60% / 0.6)`
                    : "none",
                }}
                aria-label={`Day ${d.day}`}
              />
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto scroll-container px-5 pb-8 relative z-10">
        <AnimatePresence mode="wait">
          {/* ───────── STAGE 1: OPENING (hero hook) ───────── */}
          {stage === "opening" && (
            <motion.div
              key={`opening-${selectedDay}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="max-w-md mx-auto min-h-full flex flex-col justify-center py-10"
            >
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.6 }}
                className="text-[10px] font-extrabold uppercase tracking-[0.3em] text-center mb-3"
                style={{ color: `hsl(${hue} 75% 72%)` }}
              >
                {t("jn.day.badge", { day: selectedDay })}
              </motion.p>

              <motion.h1
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
                className="fluid-h1 tracking-[-0.02em] text-foreground text-center mb-7"
                style={{
                  textShadow: `0 2px 24px hsl(${hue} 80% 50% / 0.25)`,
                }}
              >
                {dayData.title}
              </motion.h1>

              {/* Hairline divider with glow */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ delay: 0.55, duration: 0.7 }}
                className="h-px mx-auto mb-7 w-20"
                style={{
                  background: `linear-gradient(90deg, transparent, hsl(${hue} 80% 65% / 0.7), transparent)`,
                }}
              />

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.8 }}
                className="fluid-lead text-foreground/90 font-medium text-center px-1 mb-10"
                style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
              >
                {dayData.opening}
              </motion.p>

              <motion.button
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0, duration: 0.5 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  haptic("medium");
                  setStage("verse");
                }}
                className="w-full rounded-[20px] py-4 text-[15px] font-extrabold tracking-tight relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue} 75% 45%))`,
                  color: "white",
                  boxShadow: `0 12px 32px -10px hsl(${hue} 70% 45% / 0.7), inset 0 1px 0 hsl(${hue} 95% 80% / 0.4)`,
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {t("jn.day.beginBtn", { day: selectedDay })}
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </span>
              </motion.button>
            </motion.div>
          )}

          {/* ───────── STAGE 2A: VERSE + MEANING ───────── */}
          {stage === "verse" && (
            <motion.div
              key={`verse-${selectedDay}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-md mx-auto pt-2 pb-6"
            >
              <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.28em] mb-4"
                 style={{ color: `hsl(${hue} 75% 72%)` }}>
                {t("jn.day.versePart")}
              </p>

              {/* Verse card — solid dark for readability */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="rounded-[24px] p-6 mb-6 relative overflow-hidden"
                style={{
                  background: `linear-gradient(160deg, hsl(${hue} 45% 12%) 0%, hsl(${hue} 55% 8%) 100%)`,
                  border: `1px solid hsl(${hue} 70% 55% / 0.35)`,
                  boxShadow: `inset 0 1px 0 hsl(${hue} 90% 80% / 0.12), 0 16px 40px -16px hsl(${hue} 70% 30% / 0.6)`,
                }}
              >
                <span
                  className="absolute -top-3 left-4 leading-none font-serif opacity-25"
                  style={{ color: `hsl(${hue} 85% 75%)`, fontSize: "clamp(64px, 22vw, 96px)" }}

                  aria-hidden
                >
                  &ldquo;
                </span>
                <p
                  className="relative fluid-lead text-white font-normal"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.7 }}

                >
                  {dayData.verse}
                </p>
                <p
                  className="relative text-[12.5px] font-extrabold mt-4 tracking-wide"
                  style={{ color: `hsl(${hue} 80% 75%)` }}
                >
                  — {dayData.reference}
                </p>
              </motion.div>

              {/* What it means */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="mb-7 space-y-4"
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-foreground/55">
                  {t("jn.day.meaningLabel")}
                </p>
                <p className="fluid-body text-foreground font-normal" style={{ lineHeight: 1.7 }}>
                  {dayData.explanation}
                </p>
                <p className="fluid-body text-foreground/85 font-normal" style={{ lineHeight: 1.75 }}>
                  {guide.meditation}
                </p>

              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  haptic("medium");
                  setStage("deeper");
                  // Scroll content area to top for the new screen
                  requestAnimationFrame(() => {
                    document
                      .querySelector(".scroll-container")
                      ?.scrollTo({ top: 0, behavior: "auto" });
                  });
                }}
                className="w-full rounded-[20px] py-4 text-[15px] font-extrabold tracking-tight"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue} 75% 45%))`,
                  color: "white",
                  boxShadow: `0 10px 28px -10px hsl(${hue} 70% 45% / 0.65), inset 0 1px 0 hsl(${hue} 95% 80% / 0.4)`,
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  {t("jn.day.continueBtn")}
                  <ArrowRight className="w-4 h-4" strokeWidth={3} />
                </span>
              </motion.button>
            </motion.div>
          )}

          {/* ───────── STAGE 2B: REFLECTION + PRAYER + DO TODAY ───────── */}
          {stage === "deeper" && (
            <motion.div
              key={`deeper-${selectedDay}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-md mx-auto pt-2 pb-6"
            >
              <p className="text-center text-[10px] font-extrabold uppercase tracking-[0.28em] mb-4"
                 style={{ color: `hsl(${hue} 75% 72%)` }}>
                {t("jn.day.part2")}
              </p>

              {/* Reflection */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05, duration: 0.5 }}
                className="rounded-[20px] p-5 mb-4"
                style={{
                  background: `hsl(${hue} 50% 14% / 0.55)`,
                  border: `1px solid hsl(${hue} 70% 58% / 0.28)`,
                }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-2.5" style={{ color: `hsl(${hue} 80% 75%)` }}>
                  {t("jn.day.pause")}
                </p>
                <p className="text-[15.5px] leading-[1.65] text-foreground">
                  {guide.reflection}
                </p>
                <p className="mt-4 text-[14.5px] leading-[1.6] text-foreground/80 italic">
                  {guide.breathPrayer}
                </p>
              </motion.div>

              {/* Prayer */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.5 }}
                className="rounded-[20px] p-5 mb-5"
                style={{
                  background: `linear-gradient(160deg, hsl(${hue} 45% 12%) 0%, hsl(${hue} 55% 8%) 100%)`,
                  border: `1px solid hsl(${hue} 70% 55% / 0.3)`,
                }}
              >
                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.2em] mb-2.5"
                  style={{ color: `hsl(${hue} 80% 75%)` }}
                >
                  {t("jn.day.prayer")}
                </p>
                <p
                  className="fluid-body text-white/95 italic"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", lineHeight: 1.65 }}
                >

                  {dayData.prayer}
                </p>
              </motion.div>

              {/* Do these things today — checklist */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.22, duration: 0.5 }}
                className="rounded-[20px] p-5 mb-6"
                style={{
                  ...glass({ blur: 20, bg: "hsl(var(--glass))" }),
                  border: "1px solid hsl(var(--glass-border))",
                }}
              >
                <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-foreground/55 mb-3">
                  {t("jn.day.doToday")}
                </p>
                <div className="space-y-2.5">
                  {[
                    guide.practice,
                    t("jn.day.breathTask", { prayer: guide.breathPrayer }),
                    t("jn.day.comeBackTask", { day: Math.min(selectedDay + 1, totalDays) }),
                  ].map((task, idx) => {
                    const done = checkedTasks.includes(idx);
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          haptic("soft");
                          setCheckedTasks((prev) =>
                            prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
                          );
                        }}
                        className="w-full flex items-start gap-3 text-left p-2.5 rounded-xl transition-colors"
                        style={{
                          background: done ? `hsl(${hue} 60% 45% / 0.15)` : "transparent",
                        }}
                      >
                        <span
                          className="flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center mt-0.5"
                          style={{
                            background: done
                              ? `hsl(${hue} 75% 55%)`
                              : "transparent",
                            border: done
                              ? `1px solid hsl(${hue} 75% 55%)`
                              : "1.5px solid hsl(0 0% 100% / 0.3)",
                          }}
                        >
                          {done && <Check className="w-3.5 h-3.5 text-white" strokeWidth={3.5} />}
                        </span>
                        <span
                          className="text-[14.5px] leading-[1.5] flex-1"
                          style={{
                            color: done ? "hsl(var(--foreground) / 0.55)" : "hsl(var(--foreground) / 0.92)",
                            textDecoration: done ? "line-through" : "none",
                          }}
                        >
                          {task}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.5 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleComplete}
                className="w-full rounded-[20px] py-4 text-[15px] font-extrabold tracking-tight relative overflow-hidden"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue} 75% 45%))`,
                  color: "white",
                  boxShadow: `0 10px 28px -8px hsl(${hue} 70% 45% / 0.65), inset 0 1px 0 hsl(${hue} 95% 80% / 0.4)`,
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <Check className="w-4 h-4" strokeWidth={3} />
                  {t("jn.day.completeBtn", { day: selectedDay })}
                </span>
              </motion.button>
            </motion.div>
          )}

          {/* ───────── STAGE 3: CHECK-IN + WALLPAPER + CONTINUE ───────── */}
          {stage === "checkin" && (
            <motion.div
              key={`checkin-${selectedDay}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="max-w-md mx-auto min-h-full flex flex-col justify-center py-8"
            >
              {/* Completion celebration */}
              <motion.div
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, duration: 0.5, type: "spring", stiffness: 200 }}
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-5"
                style={{
                  background: `linear-gradient(135deg, hsl(${hue} 75% 60%), hsl(${hue} 80% 50%))`,
                  boxShadow: `0 12px 40px -8px hsl(${hue} 80% 50% / 0.6)`,
                }}
              >
                <Check className="w-8 h-8 text-white" strokeWidth={3.5} />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="fluid-h2 text-foreground text-center mb-2"
              >
                {t("jn.day.dayComplete", { day: selectedDay })}
              </motion.h2>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.5 }}
                className="flex items-center justify-center gap-2 mb-8"
              >
                <span
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold tracking-tight"
                  style={{
                    background: `hsl(${hue} 70% 55% / 0.18)`,
                    color: `hsl(${hue} 85% 78%)`,
                    border: `1px solid hsl(${hue} 70% 55% / 0.35)`,
                  }}
                >
                  <Flame className="w-3 h-3" strokeWidth={3} />
                  {t("jn.day.streak", { n: streakDays })}
                </span>
                <span className="text-[12px] text-foreground/55">
                  {t("jn.day.progressComplete", { day: selectedDay, total: totalDays })}
                </span>
              </motion.div>


              {/* Feeling check-in */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.5 }}
                className="rounded-[20px] p-5 mb-5"
                style={{
                  ...glass({ blur: 20, bg: "hsl(var(--glass))" }),
                  border: "1px solid hsl(var(--glass-border))",
                }}
              >
                <p className="text-[11px] font-extrabold uppercase tracking-[0.18em] text-foreground/55 text-center mb-3">
                  {t("jn.day.feelNow")}
                </p>
                <div className="flex items-center justify-around">
                  {[
                    { key: "down" as const, emoji: "😟", label: t("jn.day.feel.down") },
                    { key: "same" as const, emoji: "😐", label: t("jn.day.feel.same") },
                    { key: "lifted" as const, emoji: "😌", label: t("jn.day.feel.lifted") },
                  ].map((f) => {
                    const active = feeling === f.key;
                    return (
                      <button
                        key={f.key}
                        onClick={() => {
                          haptic("soft");
                          setFeeling(f.key);
                        }}
                        className="flex flex-col items-center gap-1.5 px-2 py-2 rounded-2xl transition-all"
                        style={{
                          background: active
                            ? `hsl(${hue} 70% 55% / 0.2)`
                            : "transparent",
                          transform: active ? "scale(1.08)" : "scale(1)",
                        }}
                      >
                        <span className="text-[32px]">{f.emoji}</span>
                        <span
                          className="text-[9.5px] font-bold tracking-wide"
                          style={{
                            color: active
                              ? `hsl(${hue} 80% 75%)`
                              : "hsl(var(--foreground) / 0.5)",
                          }}
                        >
                          {f.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </motion.div>

              {/* Wallpaper CTA */}
              <motion.button
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6, duration: 0.5 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  haptic("medium");
                  navigate("/daily-verse");
                }}
                className="w-full rounded-[20px] py-3.5 text-[13.5px] font-bold mb-3"
                style={{
                  ...glass({ blur: 20, bg: "hsl(var(--glass))" }),
                  border: "1px solid hsl(var(--primary) / 0.4)",
                  color: "hsl(var(--primary))",
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <Smartphone className="w-4 h-4" strokeWidth={2.4} />
                  {t("jn.day.applyWallpaper")}
                </span>
              </motion.button>

              {/* Continue / Finish */}
              {selectedDay < totalDays ? (
                <motion.button
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    haptic("soft");
                    haptic("soft");
                    toast.success(t("jn.day.nextWaiting", { day: selectedDay + 1 }));
                    navigate("/journeys");
                  }}
                  className="w-full rounded-[20px] py-3.5 text-[13.5px] font-extrabold tracking-tight"
                  style={{
                    background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue} 75% 45%))`,
                    color: "white",
                    boxShadow: `0 8px 24px -8px hsl(${hue} 70% 45% / 0.6)`,
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    {t("jn.day.checkin.doneBtn")}
                    <ChevronRight className="w-4 h-4" strokeWidth={3} />
                  </span>
                </motion.button>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.7, duration: 0.5 }}
                  className="text-center pt-3"
                >
                  <p className="text-[14px] text-foreground/80 font-medium">
                    {t("jn.day.finished")}
                  </p>
                  <p className="text-[12px] text-foreground/55 mt-1">
                    {t("jn.day.carryIt")}
                  </p>
                  <button
                    onClick={() => navigate("/journeys")}
                    className="mt-5 text-[12px] font-bold text-primary"
                  >
                    {t("jn.day.backToJourneys")}
                  </button>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <PremiumSheet
        isOpen={premiumOpen}
        trigger={`journey_day_${selectedDay}_complete`}
        context={{ journeyTitle: journey.title, day: selectedDay, totalDays: totalDays }}
        onClose={() => setPremiumOpen(false)}
        onUnlock={() => { unlock(); setPremiumOpen(false); }}
      />
    </div>
  );
}
