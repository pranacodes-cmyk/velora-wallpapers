import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Clock, Crown, Play } from "lucide-react";
import { haptic } from "@/utils/haptics";
import { useT } from "@/i18n";


interface Props {
  open: boolean;
  onClose: () => void;
  journeyTitle: string;
  journeyEmoji: string;
  hue: number;
  day: number;
  /** ms timestamp — only used in "time" mode. */
  unlockAt?: number;
  /** "time" = countdown until tomorrow. "ad" = rewarded-ad gate (no wait). */
  mode?: "time" | "ad";
  onUnlockWithPremium: () => void; // open premium sheet
  onUnlockWithAd?: () => void; // watch rewarded ad to unlock today
}



function formatRemaining(
  ms: number,
  t: (k: string, v?: Record<string, string | number>) => string
): string {
  if (ms <= 0) return t("jn.lock.timer.ready");
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return t("jn.featured.meta.hm", { h, m });
  if (m > 0) return `${m}m ${s.toString().padStart(2, "0")}s`;
  return `${s}s`;
}

export default function LockedDaySheet({
  open,
  onClose,
  journeyTitle,
  journeyEmoji,
  hue,
  day,
  unlockAt = 0,
  mode = "time",
  onUnlockWithPremium,
  onUnlockWithAd,
}: Props) {
  const { t } = useT();
  const [remaining, setRemaining] = useState(() => unlockAt - Date.now());

  useEffect(() => {
    if (!open || mode !== "time") return;
    const tick = () => setRemaining(unlockAt - Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [open, unlockAt, mode]);


  const handlePremium = () => {
    haptic("medium");
    onUnlockWithPremium();
  };

  const handleAd = () => {
    if (!onUnlockWithAd) return;
    haptic("medium");
    onUnlockWithAd();
  };


  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-[101] rounded-t-[28px] overflow-hidden safe-bottom"
            style={{
              background: `linear-gradient(180deg, hsl(${hue} 50% 14%) 0%, hsl(${hue} 55% 9%) 100%)`,
              border: `1px solid hsl(${hue} 70% 55% / 0.3)`,
              boxShadow: `0 -20px 60px -10px hsl(${hue} 80% 30% / 0.5)`,
            }}
          >
            {/* Handle */}
            <div className="pt-3 pb-1 flex justify-center">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>

            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center bg-white/8 hover:bg-white/12"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-white/70" strokeWidth={2.4} />
            </button>

            <div className="px-6 pt-2 pb-7">
              <div className="flex flex-col items-center text-center">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                  style={{
                    background: `radial-gradient(circle, hsl(${hue} 80% 60% / 0.35), hsl(${hue} 70% 40% / 0.05) 70%)`,
                    border: `1px solid hsl(${hue} 80% 65% / 0.4)`,
                    boxShadow: `0 0 40px hsl(${hue} 80% 55% / 0.3)`,
                  }}
                >
                  <Clock className="w-7 h-7 text-white/85" strokeWidth={1.8} />
                </motion.div>

                <p
                  className="text-[10px] font-extrabold uppercase tracking-[0.28em] mb-2"
                  style={{ color: `hsl(${hue} 80% 75%)` }}
                >
                  {journeyEmoji} {journeyTitle}
                </p>
                <h2 className="text-[22px] font-black text-white tracking-tight leading-[1.2] mb-2">
                  {mode === "time" ? t("jn.lock.opensTomorrow", { day }) : t("jn.lock.ready", { day })}
                </h2>
                <p className="text-[14px] text-white/65 leading-snug max-w-[290px]">
                  {mode === "time"
                    ? t("jn.lock.timeDesc")
                    : t("jn.lock.adDesc")}
                </p>

                {mode === "time" && (
                  <div
                    className="mt-5 px-5 py-3 rounded-2xl flex items-center gap-2.5"
                    style={{
                      background: `hsl(${hue} 60% 20% / 0.6)`,
                      border: `1px solid hsl(${hue} 70% 55% / 0.28)`,
                    }}
                  >
                    <Clock className="w-4 h-4" style={{ color: `hsl(${hue} 80% 78%)` }} strokeWidth={2.4} />
                    <span
                      className="text-[16px] font-extrabold tabular-nums tracking-tight"
                      style={{ color: `hsl(${hue} 85% 82%)` }}
                    >
                      {formatRemaining(remaining, t)}
                    </span>
                  </div>
                )}
              </div>


              {/* Rewarded-ad: after tomorrow wait is over (free path) */}
              {onUnlockWithAd && (
                <button
                  onClick={handleAd}
                  className="w-full rounded-[20px] py-3.5 mt-6 text-[14.5px] font-extrabold tracking-tight"
                  style={{
                    background: `linear-gradient(135deg, hsl(${hue} 70% 55%), hsl(${hue} 75% 45%))`,
                    color: "white",
                    boxShadow: `0 10px 28px -10px hsl(${hue} 80% 40% / 0.65), inset 0 1px 0 hsl(0 0% 100% / 0.18)`,
                  }}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Play className="w-4 h-4" strokeWidth={2.8} fill="currentColor" />
                    {mode === "ad" ? t("jn.lock.readyBtn", { day }) : t("jn.lock.openNowBtn", { day })}
                  </span>
                </button>
              )}


              {/* Premium upsell — ad-free way to skip the wait */}
              <button
                onClick={handlePremium}
                className="w-full rounded-[20px] py-4 mt-3 text-[15px] font-extrabold tracking-tight relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, hsl(45 90% 58%), hsl(38 95% 50%))",
                  color: "hsl(30 60% 12%)",
                  boxShadow: "0 12px 32px -10px hsl(40 90% 45% / 0.7), inset 0 1px 0 hsl(48 100% 80% / 0.6)",
                }}
              >
                <span className="flex items-center justify-center gap-2">
                  <Crown className="w-4 h-4" strokeWidth={2.6} />
                  Unlock all journeys with Premium
                </span>
              </button>
              <p className="text-center text-[11px] text-white/55 mt-2.5">
                Every journey, every reflection · ad-free
              </p>


              <button
                onClick={onClose}
                className="w-full rounded-[18px] py-3 mt-3 text-[13px] font-bold text-white/55 hover:text-white/80"
              >
                {mode === "time" ? "I'll come back tomorrow" : "Maybe later"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
