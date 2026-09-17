import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, Lock } from "lucide-react";
import { useT } from "@/i18n";

interface NextPrayerCountdownProps {
  unlockHour: number; // e.g. 18 for 6 PM
  bgImage: string;
}

function getTimeUntilHour(hour: number): { h: number; m: number; s: number; passed: boolean } {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);

  if (now >= target) {
    return { h: 0, m: 0, s: 0, passed: true };
  }

  const diff = target.getTime() - now.getTime();
  const h = Math.floor(diff / (1000 * 60 * 60));
  const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const s = Math.floor((diff % (1000 * 60)) / 1000);
  return { h, m, s, passed: false };
}

function formatLabel(hour: number): string {
  if (hour === 18) return "6:00 PM";
  if (hour === 12) return "12:00 PM";
  if (hour > 12) return `${hour - 12}:00 PM`;
  return `${hour}:00 AM`;
}

export default function NextPrayerCountdown({ unlockHour, bgImage }: NextPrayerCountdownProps) {
  const { t } = useT();
  const [time, setTime] = useState(() => getTimeUntilHour(unlockHour));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeUntilHour(unlockHour));
    }, 1000);
    return () => clearInterval(interval);
  }, [unlockHour]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <div className="w-full h-full flex-shrink-0 relative overflow-hidden">
      {/* Background */}
      <img src={bgImage} alt="" className="absolute inset-0 w-full h-full object-cover" />

      {/* Dark overlay */}
      <div className="absolute inset-0" style={{
        background: "linear-gradient(180deg, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 40%, rgba(0,0,0,0.7) 100%)",
      }} />
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "radial-gradient(ellipse at center, transparent 30%, rgba(0,0,0,0.5) 100%)",
      }} />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col items-center justify-center px-6 gap-6">
        {/* Animated lock icon */}
        <motion.div
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, rgba(255,215,0,0.2) 0%, rgba(255,180,50,0.1) 100%)",
              border: "1px solid rgba(255,215,0,0.25)",
              boxShadow: "0 0 40px rgba(255,215,0,0.1)",
            }}
          >
            <Lock className="w-8 h-8 text-amber-300/80" />
          </div>
        </motion.div>

        {/* Glass card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-[320px] rounded-3xl px-6 py-8 text-center relative overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.07)",
            backdropFilter: "blur(24px) saturate(150%)",
            WebkitBackdropFilter: "blur(24px) saturate(150%)",
            border: "1px solid rgba(255,255,255,0.12)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.35)",
          }}
        >
          {/* Subtle glow */}
          <div className="absolute inset-0 pointer-events-none rounded-3xl" style={{
            background: "radial-gradient(ellipse at top center, rgba(255,215,0,0.05) 0%, transparent 60%)",
          }} />

          <p className="text-[13px] text-white/50 font-medium mb-3 relative z-10">
            {t("pr.countdown.unlocksAt")}
          </p>

          <p className="text-[15px] text-amber-300/90 font-bold mb-5 relative z-10">
            {formatLabel(unlockHour)}
          </p>

          {/* Countdown digits */}
          <div className="flex items-center justify-center gap-3 relative z-10 mb-4">
            {[
              { val: pad(time.h), label: t("pr.countdown.hours") },
              { val: pad(time.m), label: t("pr.countdown.min") },
              { val: pad(time.s), label: t("pr.countdown.sec") },
            ].map((item, i) => (
              <div key={i} className="flex flex-col items-center">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{
                    background: "rgba(255,255,255,0.08)",
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                >
                  <motion.span
                    key={item.val}
                    initial={{ y: -5, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.2 }}
                    className="text-[24px] font-black text-white/90 tabular-nums"
                  >
                    {item.val}
                  </motion.span>
                </div>
                <span className="text-[10px] text-white/35 mt-1.5 font-medium">
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          {/* Divider dots */}
          <div className="flex items-center justify-center gap-1 mb-3 relative z-10">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-1 h-1 rounded-full bg-white/15" />
            ))}
          </div>

          <div className="flex items-center justify-center gap-1.5 relative z-10">
            <Clock className="w-3.5 h-3.5 text-white/30" />
            <p className="text-[11px] text-white/35">
              {t("pr.countdown.preparing")}
            </p>
          </div>
        </motion.div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-[11px] text-white/25 text-center max-w-[260px]"
        >
          {t("pr.countdown.comeBack", { time: formatLabel(unlockHour) })}
        </motion.p>
      </div>
    </div>
  );
}
