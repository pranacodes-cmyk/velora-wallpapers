import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Check, BookOpen, HandHeart, Brain, ChevronRight } from "lucide-react";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import { haptic } from "@/utils/haptics";
import { primeInterstitial } from "@/services/ads";
import { usePremium } from "@/hooks/usePremium";
import { OPEN_REFLECTION_EVENT } from "@/lib/dailyFunnel";
import { useT } from "@/i18n";

// Retry once, then reload once — a stale chunk after an app update/reload
// otherwise blanks the whole screen.
const VerseReflectionSheet = lazy(() =>
  import("./VerseReflectionSheet").catch(() =>
    new Promise<typeof import("./VerseReflectionSheet")>((resolve, reject) =>
      setTimeout(() => {
        import("./VerseReflectionSheet").then(resolve).catch((err) => {
          if (!sessionStorage.getItem("vrs-reloaded")) {
            sessionStorage.setItem("vrs-reloaded", "1");
            window.location.reload();
          } else reject(err);
        });
      }, 800),
    ),
  ),
);

interface Task {
  id: "prayer" | "reflection" | "quiz";
  title: string;
  hint: string;
  Icon: typeof BookOpen;
  done: boolean;
  onTap: () => void;
}

export default function TodayChecklist() {
  const { t } = useT();
  const navigate = useNavigate();
  const tasks = useTodayTasks();
  const { isPremium } = usePremium();
  const [reflectionOpen, setReflectionOpen] = useState(false);
  const [loadingReflection, setLoadingReflection] = useState(false);

  // Ad strategy: ONE interstitial per daily flow, fired when the user CLOSES
  // the reflection sheet (handled inside VerseReflectionSheet, gated by the
  // global 45s cooldown). Opening the sheet is intentionally ad-free —
  // reflection is only ~10s long, so an open-side ad felt punishing.
  // We still warm the next interstitial during prayer so it's ready instantly
  // for whichever exit (prayer-close, reflection-close, swipe trigger).
  const warmAd = () => {
    if (!isPremium) primeInterstitial().catch(() => {});
  };

  const openReflectionWithAd = async () => {
    if (loadingReflection) return; // tap-guard: no double-fire
    setLoadingReflection(true);
    setReflectionOpen(true);
    setLoadingReflection(false);
  };

  // Funnel handoff bridge — FunnelHandoff overlay dispatches this when the
  // user taps "Open today's verse" on the post-prayer handoff card.
  useEffect(() => {
    const onOpen = () => openReflectionWithAd();
    window.addEventListener(OPEN_REFLECTION_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_REFLECTION_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPremium]);

  // Direct-open bridge from prayer "Continue" — skip the overlay entirely.
  useEffect(() => {
    try {
      if (sessionStorage.getItem("cw_open_reflection_now") === "1") {
        sessionStorage.removeItem("cw_open_reflection_now");
        // small beat so the page is settled
        setTimeout(() => openReflectionWithAd(), 60);
      }
    } catch { /* noop */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const items: Task[] = useMemo(() => [
    {
      id: "prayer",
      title: t("today.checklist.prayerTitle"),
      hint: tasks.prayer ? t("today.checklist.prayerHintDone") : t("today.checklist.prayerHint"),
      Icon: HandHeart,
      done: tasks.prayer,
      onTap: () => {
        haptic("soft");
        warmAd();
        navigate("/devotional");
      },
    },
    {
      id: "reflection",
      title: t("today.checklist.reflectionTitle"),
      hint: tasks.reflection ? t("today.checklist.reflectionHintDone") : t("today.checklist.reflectionHint"),
      Icon: BookOpen,
      done: tasks.reflection,
      onTap: () => {
        haptic("soft");
        openReflectionWithAd();
      },
    },
    {
      id: "quiz",
      title: t("today.checklist.quizTitle"),
      hint: tasks.quiz ? t("today.checklist.quizHintDone") : t("today.checklist.quizHint"),
      Icon: Brain,
      done: tasks.quiz,
      onTap: () => {
        haptic("soft");
        // Daily checklist ka matlab hi daily quiz hai — user ko landing page
        // par chhodne ke bajaye seedha daily run shuru karo (jab tak aaj ka
        // quiz already complete na ho; Quiz.tsx khud us case ko handle karta hai).
        navigate(tasks.quiz ? "/quiz" : "/quiz?auto=daily");
      },
    },
  ], [tasks, navigate, isPremium, t]);

  const pct = (tasks.doneCount / tasks.total) * 100;
  const firstUndoneIdx = items.findIndex((t) => !t.done);

  // Ring math
  const RING_SIZE = 56;
  const RING_STROKE = 5;
  const RING_R = (RING_SIZE - RING_STROKE) / 2;
  const RING_C = 2 * Math.PI * RING_R;

  return (
    <div className="px-4 mt-6">
      {/* Section label — bigger, gold-glow, impossible to scroll past */}
      <div className="flex items-end justify-between mb-3 px-1">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="w-[4px] h-[18px] rounded-full"
            style={{
              background:
                "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.5))",
              boxShadow: "0 0 14px hsl(var(--primary) / 0.7)",
            }}
          />
          <div>
            <p className="text-[10px] font-extrabold tracking-[0.22em] uppercase text-primary/90 leading-none">
              {t("today.checklist.sectionLabel")}
            </p>
            <p className="text-[15px] font-extrabold tracking-tight text-foreground leading-tight mt-1">
              {tasks.allDone
                ? t("today.checklist.allDone")
                : tasks.doneCount === 0
                ? t("today.checklist.zeroDone")
                : t(
                    (tasks.total - tasks.doneCount) === 1
                      ? "today.checklist.stepsLeftOne"
                      : "today.checklist.stepsLeftOther",
                    { count: tasks.total - tasks.doneCount }
                  )}
            </p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: "easeOut" }}
        className="relative rounded-[26px] overflow-hidden"
        style={{
          background:
            "linear-gradient(170deg, hsl(var(--primary) / 0.10) 0%, hsl(var(--glass)) 35%, hsl(var(--glass)) 100%)",
          border: "1px solid hsl(var(--primary) / 0.22)",
          backdropFilter: "blur(22px) saturate(160%)",
          WebkitBackdropFilter: "blur(22px) saturate(160%)",
          boxShadow:
            "0 22px 50px -28px hsl(var(--primary) / 0.35), 0 8px 22px -16px hsl(0 0% 0% / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.06)",
        }}
      >
        {/* Soft gold aura — top-left */}
        <div
          aria-hidden
          className="absolute -top-12 -left-10 w-44 h-44 rounded-full pointer-events-none"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--primary) / 0.22) 0%, transparent 70%)",
            filter: "blur(8px)",
          }}
        />

        {/* HERO ROW — progress ring + headline */}
        <div className="relative px-5 pt-5 pb-4 flex items-center gap-4">
          {/* Animated progress ring */}
          <div className="relative flex-shrink-0" style={{ width: RING_SIZE, height: RING_SIZE }}>
            <svg width={RING_SIZE} height={RING_SIZE} className="rotate-[-90deg]">
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                fill="none"
                stroke="hsl(var(--foreground) / 0.08)"
                strokeWidth={RING_STROKE}
              />
              <motion.circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RING_R}
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth={RING_STROKE}
                strokeLinecap="round"
                strokeDasharray={RING_C}
                initial={{ strokeDashoffset: RING_C }}
                animate={{ strokeDashoffset: RING_C - (RING_C * pct) / 100 }}
                transition={{ duration: 0.9, ease: "easeOut" }}
                style={{
                  filter: "drop-shadow(0 0 6px hsl(var(--primary) / 0.7))",
                }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
              <span className="text-[14px] font-black tabular-nums text-foreground tracking-tight">
                {tasks.doneCount}
                <span className="text-foreground/40 font-bold">/{tasks.total}</span>
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-primary/85 leading-none">
              {tasks.allDone ? t("today.checklist.streakProtected") : t("today.checklist.dailyDevotion")}
            </p>
            <p className="text-[13px] text-foreground/70 font-semibold mt-1.5 leading-snug">
              {tasks.allDone
                ? t("today.checklist.allDoneSafe")
                : t("today.checklist.finishAll")}
            </p>
          </div>
        </div>

        {/* TASK ROWS — large, tappable, with featured "next" row */}
        {/* Royal Gold locked across themes for brand consistency */}
        {(() => null)()}
        <ul className="px-2.5 pb-2.5 space-y-1.5">
          {items.map((task, i) => {
            const isNext = i === firstUndoneIdx;
            const GOLD = "42 85% 52%";
            const INK = "222 60% 8%";
            return (
              <li key={task.id}>
                <motion.button
                  onClick={task.onTap}
                  whileTap={{ scale: 0.98 }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.08 + i * 0.06, duration: 0.32 }}
                  className="w-full text-left px-3 py-3 flex items-center gap-3.5 rounded-2xl transition-colors"
                  style={{
                    background: isNext
                      ? `linear-gradient(135deg, hsl(${GOLD} / 0.16), hsl(${GOLD} / 0.05))`
                      : task.done
                      ? "transparent"
                      : "hsl(var(--foreground) / 0.025)",
                    border: isNext
                      ? `1px solid hsl(${GOLD} / 0.45)`
                      : "1px solid transparent",
                    boxShadow: isNext
                      ? `0 8px 22px -10px hsl(${GOLD} / 0.55), inset 0 1px 0 hsl(0 0% 100% / 0.15)`
                      : "none",
                  }}
                >
                  {/* Gold-themed icon tile */}
                  <div
                    className="w-11 h-11 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-all"
                    style={{
                      background: task.done
                        ? `linear-gradient(135deg, hsl(${GOLD}), hsl(${GOLD} / 0.78))`
                        : isNext
                        ? `linear-gradient(135deg, hsl(${GOLD} / 0.28), hsl(${GOLD} / 0.10))`
                        : `linear-gradient(135deg, hsl(${GOLD} / 0.14), hsl(${GOLD} / 0.05))`,
                      border: task.done
                        ? `1px solid hsl(${GOLD} / 0.7)`
                        : isNext
                        ? `1px solid hsl(${GOLD} / 0.5)`
                        : `1px solid hsl(${GOLD} / 0.25)`,
                      boxShadow: task.done
                        ? `0 8px 18px -10px hsl(${GOLD} / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.35)`
                        : isNext
                        ? `0 0 14px hsl(${GOLD} / 0.3), inset 0 1px 0 hsl(0 0% 100% / 0.1)`
                        : "inset 0 1px 0 hsl(0 0% 100% / 0.06)",
                    }}
                  >
                    {task.done ? (
                      <Check
                        className="w-5 h-5"
                        strokeWidth={3.5}
                        style={{ color: `hsl(${INK})` }}
                      />
                    ) : (
                      <task.Icon
                        className="w-5 h-5"
                        strokeWidth={2.3}
                        style={{ color: `hsl(${GOLD})` }}
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`text-[14.5px] font-extrabold tracking-tight leading-tight ${
                          task.done ? "text-foreground/50" : "text-foreground"
                        }`}
                        style={
                          task.done
                            ? {
                                textDecoration: "line-through",
                                textDecorationColor: "hsl(var(--foreground) / 0.35)",
                              }
                            : undefined
                        }
                      >
                        {task.title}
                      </p>
                      {isNext && (
                        <span
                          className="text-[9px] font-black tracking-[0.14em] uppercase px-1.5 py-[2px] rounded-full"
                          style={{
                            background: `linear-gradient(135deg, hsl(${GOLD}), hsl(${GOLD} / 0.82))`,
                            color: `hsl(${INK})`,
                            border: `1px solid hsl(${GOLD} / 0.6)`,
                            boxShadow: `0 0 12px hsl(${GOLD} / 0.6), inset 0 1px 0 hsl(0 0% 100% / 0.35)`,
                          }}
                        >
                          {t("today.checklist.next")}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-[11.5px] mt-0.5 leading-snug ${
                        isNext ? "font-semibold" : "text-foreground/50"
                      }`}
                      style={isNext ? { color: `hsl(${GOLD} / 0.95)` } : undefined}
                    >
                      {task.hint}
                    </p>
                  </div>

                  {!task.done && (
                    <ChevronRight
                      className="w-4.5 h-4.5 flex-shrink-0"
                      strokeWidth={2.6}
                      style={{
                        color: isNext ? `hsl(${GOLD})` : "hsl(var(--foreground) / 0.35)",
                      }}
                    />
                  )}
                </motion.button>
              </li>
            );
          })}
        </ul>

        {tasks.allDone && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-5 pb-4 pt-1 flex items-center justify-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5 text-primary" strokeWidth={3} />
            <p className="text-[11.5px] font-extrabold text-primary tracking-tight">
              {t("today.checklist.allDoneFooter")}
            </p>
          </motion.div>
        )}
      </motion.div>

      {createPortal(
        <Suspense fallback={null}>
          <VerseReflectionSheet open={reflectionOpen} onClose={() => setReflectionOpen(false)} />
        </Suspense>,
        document.body
      )}
    </div>
  );
}
