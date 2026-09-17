import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n";
import { Crown, Check, Flame, Star, BookOpen, HelpCircle, Heart, ArrowRight, X } from "lucide-react";
import { useAndroidBack } from "@/hooks/useAndroidBack";

import {
  getHandoff,
  clearHandoff,
  requestOpenReflection,
  getPerfectStreak,
  bumpPerfectStreak,
  isPerfectToday,
  isCompleteAcknowledgedToday,
  ackCompleteToday,
  FUNNEL_EVENT,
  type HandoffStep,
} from "@/lib/dailyFunnel";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import { haptic } from "@/utils/haptics";
import { useNavigate } from "react-router-dom";

/**
 * Beautiful step-to-step handoff overlay.
 *
 * Apple-grade transition: the just-completed task animates into a checkmark,
 * a soft beam sweeps across, then the next task slides up with its icon,
 * a one-line invitation, and a "Continue" button. Auto-advances at the end
 * if the user doesn't tap. No more raw toasts mid-flow.
 */

type StepMeta = {
  doneLabel: string;
  doneIcon: typeof Heart;
  doneTint: string;       // soft gradient for the "done" chip background
  next: HandoffStep;
  nextLabel: string;
  nextTitle: string;      // e.g. "Hear today's verse"
  nextSubtitle: string;   // e.g. "A short Word, just for today."
  nextIcon: typeof BookOpen;
  nextCta: string;
};

type ActiveStep = "reflection" | "quiz";

const STEP_META: Record<ActiveStep, StepMeta> = {
  reflection: {
    doneLabel: "funnel.handoff.prayerDone",
    doneIcon: Heart,
    doneTint: "linear-gradient(135deg, rgba(255,170,80,0.22), rgba(255,210,140,0.10))",
    next: "reflection",
    nextLabel: "funnel.handoff.reflectionLabel",
    nextTitle: "funnel.handoff.reflectionTitle",
    nextSubtitle: "funnel.handoff.reflectionSub",
    nextIcon: BookOpen,
    nextCta: "funnel.handoff.reflectionCta",
  },
  quiz: {
    doneLabel: "funnel.handoff.verseDone",
    doneIcon: BookOpen,
    doneTint: "linear-gradient(135deg, rgba(140,180,255,0.22), rgba(200,225,255,0.10))",
    next: "quiz",
    nextLabel: "funnel.handoff.quizLabel",
    nextTitle: "funnel.handoff.quizTitle",
    nextSubtitle: "funnel.handoff.quizSub",
    nextIcon: HelpCircle,
    nextCta: "funnel.handoff.quizCta",
  },
};

// Auto-advance removed — user must explicitly tap to proceed.

export default function FunnelHandoff() {
  const navigate = useNavigate();
  const tasks = useTodayTasks();
  const [transition, setTransition] = useState<ActiveStep | null>(null);
  const [showComplete, setShowComplete] = useState(false);
  const advancedRef = useRef(false);

  // --- Listen for handoff events and show the beautiful transition overlay ---
  useEffect(() => {
    const handle = () => {
      const step = getHandoff();
      if (!step) return;
      if (step === "reflection" && tasks.reflection) { clearHandoff(); return; }
      if (step === "quiz" && tasks.quiz) { clearHandoff(); return; }
      if (step !== "reflection" && step !== "quiz") { clearHandoff(); return; }
      clearHandoff();
      advancedRef.current = false;
      haptic("medium");
      setTransition(step);
    };
    handle();
    window.addEventListener(FUNNEL_EVENT, handle);
    window.addEventListener("focus", handle);
    return () => {
      window.removeEventListener(FUNNEL_EVENT, handle);
      window.removeEventListener("focus", handle);
    };
  }, [tasks.reflection, tasks.quiz]);

  // No auto-advance — the user explicitly taps the CTA (or the overlay)
  // to move forward. Keeps the moment intentional and prevents the
  // overlay from skipping past users who paused to read.


  const advance = () => {
    if (advancedRef.current || !transition) return;
    advancedRef.current = true;
    const step = transition;
    setTransition(null);
    // Tiny beat so the exit animation can breathe
    window.setTimeout(() => {
      if (step === "reflection") requestOpenReflection();
      else if (step === "quiz") navigate("/quiz?auto=daily");
    }, 220);
  };

  const dismiss = () => {
    if (!transition) return;
    haptic("soft");
    advancedRef.current = true;
    setTransition(null);
  };


  // --- All three done → celebration overlay (unchanged spirit, kept beautiful) ---
  useEffect(() => {
    if (!tasks.allDone) return;
    if (isCompleteAcknowledgedToday()) return;
    if (!isPerfectToday()) bumpPerfectStreak();
    haptic("heavy");
    setShowComplete(true);
    const t = setTimeout(() => {
      ackCompleteToday();
      setShowComplete(false);
    }, 2600);
    return () => clearTimeout(t);
  }, [tasks.allDone]);

  return (
    <>
      <AnimatePresence>
        {transition && (
          <HandoffOverlay
            key={`handoff-${transition}`}
            step={transition}
            onContinue={advance}
            onDismiss={dismiss}
          />
        )}
      </AnimatePresence>


      <AnimatePresence>
        {showComplete && (
          <DayCompleteOverlay
            key="day-complete"
            onDismiss={() => {
              ackCompleteToday();
              setShowComplete(false);
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ---------- Step → step handoff overlay ----------

function HandoffOverlay({
  step,
  onContinue,
  onDismiss,
}: {
  step: ActiveStep;
  onContinue: () => void;
  onDismiss: () => void;
}) {
  const { t } = useT();
  const meta = STEP_META[step];
  const DoneIcon = meta.doneIcon;
  const NextIcon = meta.nextIcon;

  // Hardware back closes the prompt (does NOT trigger exit dialog).
  useAndroidBack(onDismiss);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(120% 80% at 50% 25%, hsl(var(--primary) / 0.22) 0%, hsl(var(--background)) 55%, hsl(var(--background)) 100%)",
        backgroundColor: "hsl(var(--background))",
      }}
      onClick={onDismiss}
      role="dialog"
      aria-live="polite"
      data-back-consumer="funnel-handoff"
    >
      {/* Close button — top right */}
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        className="absolute top-[max(env(safe-area-inset-top),14px)] right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center bg-black/55 border border-white/15 active:scale-95"
        aria-label="Close"
      >
        <X className="w-[18px] h-[18px] text-white" strokeWidth={2.4} />
      </button>

      {/* Soft beam sweep */}
      <motion.div
        aria-hidden
        className="absolute inset-x-0 top-1/3 h-[2px] pointer-events-none"
        initial={{ opacity: 0, scaleX: 0.2 }}
        animate={{ opacity: [0, 0.9, 0], scaleX: [0.3, 1, 1.05] }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.25 }}
        style={{
          background:
            "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.55), transparent)",
          transformOrigin: "center",
        }}
      />


      {/* Star */}
      <Star className="absolute top-[22%] left-[18%] w-3.5 h-3.5 text-primary/60 animate-pulse" />
      <Star className="absolute top-[24%] right-[20%] w-3 h-3 text-amber-300/60 animate-pulse" style={{ animationDelay: "180ms" }} />

      <motion.div
        initial={{ y: 14, opacity: 0, scale: 0.96 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -10, opacity: 0, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 240, damping: 22 }}
        className="relative w-full max-w-[340px] text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Done chip */}
        <motion.div
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full mb-7"
          style={{
            background: meta.doneTint,
            border: "1px solid hsl(var(--primary) / 0.28)",
          }}
        >
          <span
            className="w-6 h-6 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)",
              boxShadow: "0 4px 12px -2px hsl(var(--primary) / 0.55)",
            }}
          >
            <Check className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={3.5} />
          </span>
          <span className="text-[11px] font-bold tracking-tight text-foreground/85 flex items-center gap-1.5">
            <DoneIcon className="w-3 h-3 opacity-70" strokeWidth={2.6} />
            {t(meta.doneLabel)}
          </span>
        </motion.div>

        {/* Connector */}
        <motion.div
          initial={{ scaleY: 0, opacity: 0 }}
          animate={{ scaleY: 1, opacity: 1 }}
          transition={{ delay: 0.18, duration: 0.45, ease: "easeOut" }}
          className="mx-auto mb-6 w-[2px] h-9 rounded-full origin-top"
          style={{
            background:
              "linear-gradient(180deg, hsl(var(--primary) / 0.55), hsl(var(--primary) / 0))",
          }}
        />

        {/* Next icon */}
        <motion.div
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.28, type: "spring", stiffness: 240, damping: 16 }}
          className="mx-auto mb-5 w-[76px] h-[76px] rounded-[24px] flex items-center justify-center relative"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.82) 100%)",
            boxShadow:
              "0 24px 60px -18px hsl(var(--primary) / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.45)",
          }}
        >
          <NextIcon className="w-9 h-9 text-primary-foreground relative" strokeWidth={2.4} />
        </motion.div>

        {/* Eyebrow */}
        <motion.p
          initial={{ y: 6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.34 }}
          className="text-[10px] font-extrabold tracking-[0.32em] uppercase text-primary mb-2"
        >
          {t(meta.nextLabel)}
        </motion.p>

        {/* Title + subtitle */}
        <motion.h2
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-[26px] font-black tracking-tight text-foreground leading-[1.12] mb-2"
        >
          {t(meta.nextTitle)}
        </motion.h2>
        <motion.p
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.46 }}
          className="text-[14px] text-muted-foreground leading-snug mb-7 px-2"
        >
          {t(meta.nextSubtitle)}
        </motion.p>

        {/* CTA */}
        <motion.button
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.54, type: "spring", stiffness: 260, damping: 22 }}
          whileTap={{ scale: 0.96 }}
          onClick={onContinue}
          className="inline-flex items-center gap-2 px-5 h-11 rounded-full text-[13px] font-bold tracking-tight"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.88) 100%)",
            color: "hsl(var(--primary-foreground))",
            boxShadow:
              "0 14px 32px -10px hsl(var(--primary) / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.4)",
          }}
        >
          {t(meta.nextCta)}
          <ArrowRight className="w-4 h-4" strokeWidth={3} />
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

// ---------- Day-complete celebration ----------

function DayCompleteOverlay({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useT();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      className="fixed inset-0 z-[120] flex items-center justify-center px-6"
      style={{
        background:
          "radial-gradient(ellipse at center, hsl(var(--primary) / 0.22) 0%, hsl(var(--background) / 0.92) 60%, hsl(var(--background) / 0.96) 100%)",
      }}
      onClick={onDismiss}
    >
      <Star className="absolute top-[30%] left-[18%] w-5 h-5 text-primary/70 animate-ping" />
      <Star className="absolute top-[26%] right-[20%] w-4 h-4 text-amber-300/70 animate-ping" style={{ animationDelay: "120ms" }} />
      <Star className="absolute bottom-[30%] left-[24%] w-4 h-4 text-amber-300/70 animate-ping" style={{ animationDelay: "240ms" }} />
      <Star className="absolute bottom-[28%] right-[22%] w-5 h-5 text-primary/70 animate-ping" style={{ animationDelay: "80ms" }} />

      <motion.div
        initial={{ scale: 0.7, y: 14, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 240, damping: 18 }}
        className="text-center max-w-[340px]"
      >
        <motion.div
          initial={{ scale: 0.5, rotate: -10 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.08, type: "spring", stiffness: 220, damping: 14 }}
          className="mx-auto mb-5 w-[84px] h-[84px] rounded-[26px] flex items-center justify-center"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.82) 100%)",
            boxShadow:
              "0 24px 60px -16px hsl(var(--primary) / 0.7), inset 0 1px 0 hsl(0 0% 100% / 0.45)",
          }}
        >
          <Crown className="w-10 h-10 text-primary-foreground" strokeWidth={2.4} />
        </motion.div>

        <p className="text-[10px] font-extrabold tracking-[0.32em] uppercase text-primary mb-2">
          {t("funnel.complete.eyebrow")}
        </p>
        <h2 className="text-[26px] font-black tracking-tight text-foreground leading-[1.15] mb-2">
          {t("funnel.complete.title")}
        </h2>
        <p className="text-[14px] text-muted-foreground leading-snug">
          {t("funnel.complete.sub")}
        </p>

        <PerfectStreakBadge />
      </motion.div>
    </motion.div>
  );
}

function PerfectStreakBadge() {
  const { t } = useT();
  const { current } = getPerfectStreak();
  if (!current) return null;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.35, type: "spring", stiffness: 220, damping: 16 }}
      className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-full"
      style={{
        background: "linear-gradient(135deg, rgba(255,90,30,0.18), rgba(245,204,110,0.12))",
        border: "1px solid rgba(245,204,110,0.45)",
        boxShadow: "0 0 24px rgba(245,204,110,0.35)",
      }}
    >
      <Flame className="w-4 h-4 text-orange-300" strokeWidth={2.6} />
      <span className="text-[13px] font-black text-foreground tracking-tight">
        {current === 1 ? t("funnel.complete.streakOne") : t("funnel.complete.streak", { n: current })}
      </span>
      <Check className="w-3.5 h-3.5 text-amber-300" strokeWidth={3} />
    </motion.div>
  );
}
