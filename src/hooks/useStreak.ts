import { useState, useEffect, useCallback } from "react";

const STREAK_KEY = "cw_streak";

interface StreakData {
  current: number;
  longest: number;
  lastDate: string;
}

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { current: 0, longest: 0, lastDate: "" };
}

function saveStreak(data: StreakData) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  try {
    window.dispatchEvent(new CustomEvent("cw_streak_changed"));
  } catch {}
}

/**
 * Idempotent — call this on any meaningful daily engagement
 * (app open, journey day complete, devotional read).
 * Only bumps once per calendar day.
 */
export function bumpStreakIfNewDay(): StreakData {
  const data = loadStreak();
  const today = getToday();
  if (data.lastDate === today) return data;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const isConsecutive = data.lastDate === yesterdayStr;
  const newCurrent = isConsecutive ? data.current + 1 : 1;
  const next: StreakData = {
    current: newCurrent,
    longest: Math.max(data.longest, newCurrent),
    lastDate: today,
  };
  saveStreak(next);
  // Analytics — retention signal
  try {
    import("@/services/analytics").then((a) => a.track(
      isConsecutive ? "streak_extended" : (data.lastDate ? "streak_broken" : "streak_started"),
      { current: newCurrent, longest: next.longest, previous_last_date: data.lastDate }
    )).catch(() => {});
  } catch {}
  return next;
}


export function useStreak() {
  const [streak, setStreak] = useState<StreakData>(() => bumpStreakIfNewDay());

  useEffect(() => {
    const refresh = () => setStreak(loadStreak());
    window.addEventListener("cw_streak_changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("cw_streak_changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return {
    current: streak.current,
    longest: streak.longest,
    isNewDay: streak.lastDate === getToday(),
  };
}
