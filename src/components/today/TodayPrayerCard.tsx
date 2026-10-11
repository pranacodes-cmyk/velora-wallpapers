import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Headphones, Lock, Moon, Sun } from "lucide-react";

import { getDailyPrayer } from "@/data/dailyVerses";
import { haptic } from "@/utils/haptics";
import { track } from "@/services/analytics";
import { useRenderCost } from "@/services/perf-attribution";
import { useCurrentSlotState, useNextPrayerCountdown } from "./todayShared";

export default function TodayPrayerCard() {
  useRenderCost("today.prayer_card");
  const navigate = useNavigate();
  const prayer = useMemo(() => getDailyPrayer(), []);
  const { slot, opened } = useCurrentSlotState();
  const isEvening = slot === "evening";
  const label = isEvening ? "Evening Prayer" : "Morning Prayer";
  const next = useNextPrayerCountdown();

  const { dayOfYear } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 0);
    return { dayOfYear: Math.floor((now.getTime() - start.getTime()) / 86400000) };
  }, []);

  const hook = useMemo(() => {
    const m = prayer.trim().match(/^(.+?[.!?])\s/);
    return m ? m[1] : prayer.trim();
  }, [prayer]);

  // Only navigate — Devotional page is what truly marks the slot "opened"
  // (when the slide scrolls into view). This keeps the Today checklist honest.
  const handleOpen = () => {
    haptic("medium");
    track("today_prayer_tile_tapped", { slot: label, state: "new" });
    navigate("/devotional");
  };

  const pad = (n: number) => String(n).padStart(2, "0");
  const CountdownPill = (
    <div
      className="flex items-center gap-1.5 px-2 py-[3px] rounded-full shrink-0"
      style={{
        background: "hsl(var(--primary) / 0.10)",
        border: "1px solid hsl(var(--primary) / 0.28)",
      }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
      <span className="text-[9.5px] font-bold tracking-[0.06em] uppercase text-primary tabular-nums">
        {next.label} in {pad(next.h)}:{pad(next.m)}:{pad(next.s)}
      </span>
    </div>
  );

  // ===== ALREADY OPENED — show hook + continue praying + countdown =====
  if (opened) {
    return (
      <motion.button
        whileTap={{ scale: 0.985 }}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15 }}
        onClick={() => { haptic("soft"); track("today_prayer_tile_tapped", { slot: label, state: "opened" }); navigate("/devotional"); }}
        className="mx-3 w-[calc(100%-1.5rem)] block text-left rounded-[22px] relative overflow-hidden mb-5"
        style={{
          background: "var(--tile-grad)",
          border: "1px solid var(--tile-border)",
          boxShadow: "var(--tile-shadow)",
        }}
      >
        <div
          aria-hidden
          className="absolute -top-12 left-1/2 -translate-x-1/2 w-[85%] h-32 pointer-events-none opacity-40"
          style={{ background: "radial-gradient(ellipse at center, var(--tile-aurora) 0%, transparent 70%)" }}
        />
        <div className="relative z-10 px-3.5 pt-3 pb-2.5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              {isEvening ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-primary" />}
              <span className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-primary">
                Today's {label}
              </span>
            </div>
            <div
              className="px-2 py-[2px] rounded-full flex items-center gap-1"
              style={{ background: "hsl(var(--primary) / 0.14)", border: "1px solid hsl(var(--primary) / 0.35)" }}
            >
              <span className="text-[9px] font-bold tracking-[0.1em] text-primary">✓ OPENED</span>
            </div>
          </div>

          <div className="relative">
            <span
              aria-hidden
              className="absolute -left-0.5 -top-2 font-bold pointer-events-none select-none leading-none"
              style={{
                fontFamily: "'Georgia','Times New Roman',serif",
                fontSize: 44,
                color: "hsl(var(--primary) / 0.55)",
                textShadow: "0 2px 12px hsl(var(--primary) / 0.25)",
              }}
            >“</span>
            <p
              className="text-[14.5px] leading-[1.55] text-foreground/92 font-medium pl-5"
              style={{
                fontFamily: "'Georgia','Times New Roman',serif",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical" as const,
                overflow: "hidden",
              }}
            >
              {hook}
            </p>
          </div>

          <div
            className="flex items-center justify-between mt-2.5 pt-2.5 gap-2"
            style={{ borderTop: "1px solid var(--tile-divider)" }}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Headphones className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2.4} />
              <span className="text-[10px] font-bold tracking-[0.16em] uppercase text-primary truncate">
                Continue praying
              </span>
            </div>
            {CountdownPill}
          </div>
        </div>
      </motion.button>
    );
  }

  // ===== NEW PRAYER, NOT YET OPENED — clean reveal CTA, no fake blur =====
  return (
    <motion.button
      whileTap={{ scale: 0.985 }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.15 }}
      onClick={handleOpen}
      className="mx-3 w-[calc(100%-1.5rem)] block text-left rounded-[22px] relative overflow-hidden mb-5"
      style={{
        background: "var(--tile-grad)",
        border: "1px solid var(--tile-border)",
        boxShadow: "var(--tile-shadow)",
      }}
    >
      <div
        aria-hidden
        className="absolute -top-12 left-1/2 -translate-x-1/2 w-[85%] h-36 pointer-events-none opacity-40"
        style={{ background: "radial-gradient(ellipse at center, var(--tile-aurora) 0%, transparent 70%)" }}
      />

      <div className="relative z-10 px-3.5 pt-3 pb-3">
        {/* Eyebrow */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            {isEvening ? <Moon className="w-3 h-3 text-primary" /> : <Sun className="w-3 h-3 text-primary" />}
            <span className="text-[9.5px] font-bold tracking-[0.22em] uppercase text-primary">
              Today's {label}
            </span>
          </div>
          <div
            className="inline-flex items-center justify-center px-2.5 py-[3px] rounded-full leading-none"
            style={{ background: "hsl(var(--primary) / 0.12)", border: "1px solid hsl(var(--primary) / 0.3)" }}
          >
            <span className="text-[9px] font-bold tracking-normal text-primary tabular-nums whitespace-nowrap">
              Day {dayOfYear}/365
            </span>
          </div>
        </div>

        {/* Centerpiece — floating cross + "New prayer" headline */}
        <div className="flex flex-col items-center text-center py-4 gap-2.5">
          <motion.div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background:
                "linear-gradient(135deg, hsl(var(--primary) / 0.25) 0%, hsl(var(--primary) / 0.08) 100%)",
              border: "1px solid hsl(var(--primary) / 0.4)",
              boxShadow:
                "0 0 28px hsl(var(--primary) / 0.3), inset 0 1px 0 hsl(var(--primary) / 0.45)",
            }}
          >
            <Lock className="w-5 h-5 text-primary" strokeWidth={2.4} />
          </motion.div>
          <div>
            <p className="text-[14px] font-extrabold text-foreground tracking-tight">
              {isEvening ? "New evening prayer just dropped" : "A new prayer awaits you"}
            </p>
            <p className="text-[11.5px] text-foreground/55 mt-0.5">
              Ad-free · About 1 minute
            </p>
          </div>
        </div>

        {/* CTA pill */}
        <div
          className="flex items-center justify-between mt-1 pt-3 gap-2"
          style={{ borderTop: "1px solid var(--tile-divider)" }}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            <Headphones className="w-3.5 h-3.5 text-primary shrink-0" strokeWidth={2.4} />
            <span className="text-[10.5px] font-bold tracking-[0.16em] uppercase text-primary truncate">
              Tap to begin

            </span>
          </div>
          {CountdownPill}
        </div>
      </div>
    </motion.button>
  );
}
