import { useEffect, useMemo, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { useT, t as t_ } from "@/i18n";
import {
  getCurrentSlot,
  isOpened,
  PRAYER_SLOT_EVENT,
  type PrayerSlot,
} from "@/lib/prayerSlots";

/**
 * Small pieces shared by the Today screen and the cards that were split out of
 * it (greeting, the three countdown clocks, the prayer-slot watcher and the
 * gold section label). Extracted verbatim from `src/pages/Today.tsx`.
 */
export function monthLabel(i: number) { return t_(`today.month.${i}`); }
export function dayLabel(i: number) { return t_(`today.day.${i}`); }

export function useGreeting() {
  const { t } = useT();
  return useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return { text: t("today.greeting.morning"), Icon: Sun, isNight: false };
    if (h < 17) return { text: t("today.greeting.afternoon"), Icon: Sun, isNight: false };
    return { text: t("today.greeting.evening"), Icon: Moon, isNight: true };
  }, [t]);
}

/** Live "Xh Ym" until next midnight. Ticks once per minute. */
export function useMidnightCountdown(): string {
  const [label, setLabel] = useState(() => formatUntilMidnight());
  useEffect(() => {
    const t = setInterval(() => setLabel(formatUntilMidnight()), 60_000);
    return () => clearInterval(t);
  }, []);
  return label;
}
export function formatUntilMidnight(): string {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const totalMin = Math.max(1, Math.floor((next.getTime() - now.getTime()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return t_("today.countdown.hm", { h, m });
  return t_("today.countdown.m", { m });
}

// Countdown for the next 3-hour boundary (Bible Question refresh window).
export const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
export function getThreeHourSeed(): number {
  return Math.floor(Date.now() / THREE_HOURS_MS);
}
export function formatUntilNextThreeHour(): string {
  const nextBoundary = (getThreeHourSeed() + 1) * THREE_HOURS_MS;
  const totalMin = Math.max(1, Math.floor((nextBoundary - Date.now()) / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h >= 1) return t_("today.countdown.hm", { h, m });
  return t_("today.countdown.m", { m });
}
export function useThreeHourCountdown(): string {
  const [label, setLabel] = useState(() => formatUntilNextThreeHour());
  useEffect(() => {
    const t = setInterval(() => setLabel(formatUntilNextThreeHour()), 60_000);
    return () => clearInterval(t);
  }, []);
  return label;
}

// ----------------------------------------------------------------------------
// Next-prayer countdown — ticks every second (HH:MM:SS).
// Morning prayer is always available; evening unlocks at 18:00.
// After 18:00 the next "drop" is tomorrow 00:00 (next morning prayer).
// ----------------------------------------------------------------------------
const EVENING_UNLOCK_HOUR = 18;
export function getNextPrayerTarget(now: Date): { at: Date; label: string } {
  const h = now.getHours();
  if (h < EVENING_UNLOCK_HOUR) {
    const target = new Date(now);
    target.setHours(EVENING_UNLOCK_HOUR, 0, 0, 0);
    return { at: target, label: t_("today.label.eveningPrayer") };
  }
  const target = new Date(now);
  target.setHours(24, 0, 0, 0);
  return { at: target, label: t_("today.label.nextPrayer") };
}
export function useNextPrayerCountdown() {
  const [state, setState] = useState(() => computeNextPrayer());
  useEffect(() => {
    // Android / low-end: tick every 30s. Countdown label rounds to minutes
    // anyway, so 1s ticks were pure wasted re-renders (they triggered a full
    // TodayPrayerCard render every single second — battery + CPU killer).
    const isLowEnd =
      typeof document !== "undefined" &&
      (document.documentElement.classList.contains("low-end-device") ||
        document.documentElement.classList.contains("android-device"));
    const period = isLowEnd ? 30_000 : 1000;
    const id = setInterval(() => setState(computeNextPrayer()), period);
    return () => clearInterval(id);
  }, []);
  return state;
}

export function computeNextPrayer() {
  const now = new Date();
  const { at, label } = getNextPrayerTarget(now);
  const diff = Math.max(0, at.getTime() - now.getTime());
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const s = Math.floor((diff % 60_000) / 1000);
  return { h, m, s, label, totalMs: diff };
}



// ============================================================================
export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3 px-1">
      <span
        aria-hidden
        className="w-[3px] h-[14px] rounded-full"
        style={{
          background:
            "linear-gradient(180deg, hsl(var(--primary)), hsl(var(--primary) / 0.55))",
          boxShadow: "0 0 8px hsl(var(--primary) / 0.45)",
        }}
      />
      <p
        className="text-[11px] font-extrabold tracking-[0.16em] uppercase text-foreground/80"
      >
        {children}
      </p>
    </div>
  );
}

export function useCurrentSlotState() {
  const [slot, setSlot] = useState<PrayerSlot>(getCurrentSlot());
  const [opened, setOpened] = useState<boolean>(() => isOpened(slot));

  useEffect(() => {
    const refresh = () => {
      const s = getCurrentSlot();
      setSlot(s);
      setOpened(isOpened(s));
    };
    refresh();
    const id = setInterval(refresh, 60_000);
    window.addEventListener(PRAYER_SLOT_EVENT, refresh);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener(PRAYER_SLOT_EVENT, refresh);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  return { slot, opened };
}
