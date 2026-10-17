import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useT } from "@/i18n";
import { useEffect } from "react";
import { haptic } from "@/utils/haptics";

interface TrialReadyTransitionProps {
  visible: boolean;
}

export function TrialReadyTransition({ visible }: TrialReadyTransitionProps) {
  const { t } = useT();
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!visible) return;
    const flip = window.setTimeout(() => haptic("light"), 500);
    const ready = window.setTimeout(() => haptic("medium"), 1020);
    return () => { clearTimeout(flip); clearTimeout(ready); };
  }, [visible]);

  if (!visible) return null;

  const instant = reduceMotion ? { duration: 0 } : undefined;

  return (
    <motion.div
      className="trial-transition-theme fixed inset-0 z-[10002] flex items-center justify-center bg-background px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={instant ?? { duration: 0.18, ease: "easeOut" }}
      role="status"
      aria-live="polite"
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <motion.div
          className="relative h-16 w-28 rounded-full border border-border bg-muted shadow-lg"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1, backgroundColor: "hsl(var(--premium-gold))" }}
          transition={instant ?? { duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          aria-hidden="true"
        >
          <motion.span
            className="absolute left-2 top-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary-foreground shadow-md"
            initial={{ x: 0 }}
            animate={{ x: 48 }}
            transition={instant ?? { delay: 0.5, duration: 0.62, ease: [0.34, 1.56, 0.64, 1] }}
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={instant ?? { delay: 1.02, duration: 0.3, ease: "easeOut" }}
            >
              <Check className="h-7 w-7 text-primary" strokeWidth={3} />
            </motion.span>
          </motion.span>
        </motion.div>

        <motion.h2
          className="mt-8 text-2xl font-semibold leading-tight text-foreground"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={instant ?? { delay: 1.12, duration: 0.42, ease: "easeOut" }}
        >

          {t("premium.trialTransition.generic")}
        </motion.h2>
      </div>
    </motion.div>
  );
}