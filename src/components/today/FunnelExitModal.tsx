import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, HandHeart, BookOpen, Brain } from "lucide-react";
import { useTodayTasks } from "@/hooks/useTodayTasks";
import { useT } from "@/i18n";

interface Props {
  open: boolean;
  onContinue: () => void;
  onLeave: () => void;
  /** Kept for API compatibility — live state is read from useTodayTasks */
  doneCount?: number;
}

type StepKey = "prayer" | "reflection" | "quiz";

const STEPS: Array<{ key: StepKey; labelKey: string; subKey: string; Icon: typeof HandHeart }> = [
  { key: "prayer", labelKey: "funnel.step.prayer", subKey: "funnel.step.prayerSub", Icon: HandHeart },
  { key: "reflection", labelKey: "funnel.step.reflection", subKey: "funnel.step.reflectionSub", Icon: BookOpen },
  { key: "quiz", labelKey: "funnel.step.quiz", subKey: "funnel.step.quizSub", Icon: Brain },
];

/**
 * Apple-style exit-intent sheet. Shows the full 3-step plan with live status
 * so the user sees exactly what's done and what's left before bailing.
 * Fully themed via design tokens — works in light & dark.
 */
export default function FunnelExitModal({ open, onContinue, onLeave }: Props) {
  const { t } = useT();
  const tasks = useTodayTasks();
  const remaining = tasks.total - tasks.doneCount;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          className="fixed inset-0 z-[140] flex items-end sm:items-center justify-center px-4 pb-[max(env(safe-area-inset-bottom),16px)] pt-4 bg-foreground/40 dark:bg-black/70 backdrop-blur-xl"
          onClick={onContinue}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[400px] rounded-[28px] overflow-hidden border border-border bg-card shadow-2xl"
            style={{ boxShadow: "0 30px 80px -20px hsl(var(--foreground) / 0.35)" }}
          >
            {/* Header */}
            <div className="px-6 pt-7 pb-5 text-center">
              <p className="text-[10px] font-extrabold tracking-[0.3em] uppercase text-primary mb-2">
                {remaining === 0 ? t("funnel.exit.eyebrowDone") : t("funnel.exit.eyebrow")}
              </p>
              <h3 className="text-[22px] font-black tracking-[-0.01em] text-foreground leading-[1.2]">
                {remaining === 0
                  ? t("funnel.exit.titleDone")
                  : remaining === 3
                  ? t("funnel.exit.titleThree")
                  : remaining === 1
                  ? t("funnel.exit.titleOne")
                  : t("funnel.exit.titleN", { n: remaining })}
              </h3>
              <p className="mt-1.5 text-[13px] text-muted-foreground leading-[1.55]">
                {t("funnel.exit.sub")}
              </p>
            </div>

            {/* Steps list */}
            <div className="px-4 pb-4">
              <div className="rounded-2xl bg-secondary/60 border border-border divide-y divide-border overflow-hidden">
                {STEPS.map(({ key, labelKey, subKey, Icon }, i) => {
                  const done = tasks[key];
                  const isNext =
                    !done &&
                    STEPS.slice(0, i).every((s) => tasks[s.key]);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-3 px-4 py-3.5"
                    >
                      <div
                        className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
                          done
                            ? "bg-primary text-primary-foreground"
                            : isNext
                            ? "bg-primary/15 text-primary border border-primary/30"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {done ? (
                          <Check className="w-[18px] h-[18px]" strokeWidth={3} />
                        ) : (
                          <Icon className="w-[18px] h-[18px]" strokeWidth={2.4} />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div
                          className={`text-[14.5px] font-bold tracking-tight ${
                            done ? "text-muted-foreground line-through" : "text-foreground"
                          }`}
                        >
                          {t(labelKey)}
                        </div>
                        <div className="text-[11.5px] text-muted-foreground leading-tight">
                          {done ? t("funnel.exit.completed") : t(subKey)}
                        </div>
                      </div>
                      {isNext && (
                        <span className="text-[9.5px] font-extrabold tracking-[0.22em] uppercase text-primary px-2 py-1 rounded-full bg-primary/12 border border-primary/30">
                          {t("funnel.exit.next")}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 pt-1">
              <button
                onClick={onContinue}
                className="w-full rounded-2xl py-[15px] text-[15px] font-extrabold tracking-tight flex items-center justify-center gap-2 bg-primary text-primary-foreground active:scale-[0.98] transition-transform"
                style={{ boxShadow: "0 14px 32px -10px hsl(var(--primary) / 0.55)" }}
              >
                {remaining === 0 ? t("funnel.exit.close") : t("funnel.exit.cta")}
                {remaining > 0 && <ArrowRight className="w-[18px] h-[18px]" strokeWidth={2.8} />}
              </button>
              <button
                onClick={onLeave}
                className="mt-1 w-full py-3 text-[12.5px] font-bold text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("funnel.exit.later")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
