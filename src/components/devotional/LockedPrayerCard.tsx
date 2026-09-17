import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Lock, Sun, Clock } from "lucide-react";
import { useT, t as translate } from "@/i18n";

interface LockedPrayerCardProps {
  onUnlock: () => void;
  isLoading: boolean;
  title?: string;
  subtitle?: string;
  countdownLabel?: string; // label shown above the HH:MM:SS counter
}

const EVENING_UNLOCK_HOUR = 18;

function computeNextPrayer() {
  const now = new Date();
  const target = new Date(now);
  if (now.getHours() < EVENING_UNLOCK_HOUR) {
    target.setHours(EVENING_UNLOCK_HOUR, 0, 0, 0);
  } else {
    target.setHours(24, 0, 0, 0);
  }
  const label = now.getHours() < EVENING_UNLOCK_HOUR ? translate("dev.locked.eveningLabel") : translate("dev.locked.nextLabel");
  const diff = Math.max(0, target.getTime() - now.getTime());
  return {
    h: Math.floor(diff / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
    label,
  };
}

function useNextPrayer() {
  const [v, setV] = useState(computeNextPrayer);
  useEffect(() => {
    const id = setInterval(() => setV(computeNextPrayer()), 1000);
    return () => clearInterval(id);
  }, []);
  return v;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function LockedPrayerCard({
  onUnlock,
  isLoading,
  title,
  subtitle,
  countdownLabel,
}: LockedPrayerCardProps) {
  const { t } = useT();
  const next = useNextPrayer();
  
  const displayTitle = title || t("dev.locked.tomorrowTitle");
  const displaySubtitle = subtitle || t("dev.locked.tomorrowSubtitle");
  const cdLabel = countdownLabel ?? `${next.label} ${t("today.countdown.in", "in")}`;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center px-6 gap-5">
      {/* Locked glass card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="w-full max-w-[340px] rounded-3xl px-6 py-8 text-center relative overflow-hidden"
        style={{
          background: "rgba(255,255,255,0.06)",
          backdropFilter: "blur(20px) saturate(150%)",
          WebkitBackdropFilter: "blur(20px) saturate(150%)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
        }}
      >
        <motion.div
          animate={typeof document !== "undefined" && document.documentElement.classList.contains("android-device") ? undefined : { y: [0, -6, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="flex justify-center mb-4"
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.25) 0%, rgba(255,180,50,0.15) 100%)",
              border: "1px solid rgba(255,215,0,0.3)",
            }}
          >
            <Lock className="w-7 h-7 text-amber-300/90" />
          </div>
        </motion.div>

        <h3 className="text-[18px] font-bold text-white/90 mb-1.5">
          {displayTitle}
        </h3>
        <p className="text-[13px] text-white/50 leading-relaxed mb-5">
          {displaySubtitle}
        </p>

        {/* Live HH:MM:SS countdown */}
        <div className="relative">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-white/45 mb-2">
            {cdLabel}
          </p>
          <div className="flex items-center justify-center gap-2">
            {[
              { val: pad(next.h), label: t("dev.locked.h") },
              { val: pad(next.m), label: t("dev.locked.m") },
              { val: pad(next.s), label: t("dev.locked.s") },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,215,0,0.18)",
                  }}
                >
                  <motion.span
                    key={item.val}
                    initial={{ y: -3, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[18px] font-black text-amber-200/95 tabular-nums"
                  >
                    {item.val}
                  </motion.span>
                </div>
                <span className="text-[9px] text-white/35 mt-1 font-semibold tracking-wider uppercase">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Unlock button */}
      <motion.button
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        whileTap={{ scale: 0.95 }}
        onClick={onUnlock}
        disabled={isLoading}
        className="px-8 py-4 rounded-full relative overflow-hidden disabled:opacity-60"
        style={{
          background: "linear-gradient(135deg, rgba(255,215,0,0.92) 0%, rgba(255,180,50,0.92) 100%)",
          boxShadow: "0 4px 20px rgba(255,215,0,0.35), 0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        <span className="text-[15px] font-black tracking-wide inline-flex items-center gap-2" style={{ color: "#3a2000" }}>
          {isLoading ? t("dev.toast.unlocking") : (<><Sun className="w-4 h-4" strokeWidth={2.5} />{t("dev.locked.ctaReveal")}</>)}
        </span>
      </motion.button>

      <p className="text-[11px] text-white/35 text-center max-w-[260px] inline-flex items-center gap-1.5">
        <Clock className="w-3 h-3" /> {t("dev.locked.ctaWaitHint")}
      </p>
    </div>
  );
}
