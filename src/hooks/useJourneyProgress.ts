import { useState, useEffect, useCallback } from "react";
import { bumpStreakIfNewDay } from "./useStreak";

const KEY = "cw_journey_progress";
const UNLOCK_KEY = "cw_journey_unlocks"; // rewarded-ad unlocks after the daily wait

// Hours a user must wait between completing a day and unlocking the next.
// 20h (not 24h) avoids the "I missed my window" guilt loop while still
// creating a strong daily-return habit.
export const DAY_LOCK_HOURS = 20;

// Free users get days 1–5 of every free journey. Days 6 & 7 (the last two,
// the "finish line" days) require Premium. With most journeys already gated
// to Pro, this loosens per-day so users get real value + a strong sunk-cost
// moment to convert right at the finish.
export const FREE_JOURNEY_DAYS = 5;

export function isPremiumJourneyDay(day: number, isPremium: boolean): boolean {
  if (isPremium) return false;
  return day > FREE_JOURNEY_DAYS;
}

interface JourneyState {
  completedDays: number[];
  startedAt: string;
  lastCompletedAt?: string;
}
type AllProgress = Record<string, JourneyState>;
type AllUnlocks = Record<string, number[]>; // journeyId -> day numbers user paid (ad) to unlock

function load(): AllProgress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore corrupt local progress and start fresh.
  }
  return {};
}

function save(data: AllProgress) {
  localStorage.setItem(KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("cw_journey_progress_changed"));
}

function loadUnlocks(): AllUnlocks {
  try {
    const raw = localStorage.getItem(UNLOCK_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore corrupt local unlock data and start fresh.
  }
  return {};
}

function saveUnlocks(data: AllUnlocks) {
  localStorage.setItem(UNLOCK_KEY, JSON.stringify(data));
  window.dispatchEvent(new CustomEvent("cw_journey_progress_changed"));
}

export function useJourneyProgress() {
  const [progress, setProgress] = useState<AllProgress>(load);
  const [unlocks, setUnlocks] = useState<AllUnlocks>(loadUnlocks);

  useEffect(() => {
    const refresh = () => {
      setProgress(load());
      setUnlocks(loadUnlocks());
    };
    window.addEventListener("cw_journey_progress_changed", refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.removeEventListener("cw_journey_progress_changed", refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  const completeDay = useCallback((journeyId: string, day: number) => {
    const current = load();
    const j = current[journeyId] || {
      completedDays: [],
      startedAt: new Date().toISOString(),
    };
    const wasNew = !j.completedDays.includes(day);
    if (wasNew) {
      j.completedDays = [...j.completedDays, day].sort((a, b) => a - b);
    }
    j.lastCompletedAt = new Date().toISOString();
    current[journeyId] = j;
    save(current);
    setProgress(current);
    // Unified streak — journey completion counts as a daily engagement.
    bumpStreakIfNewDay();
    if (wasNew) {
      import("@/services/analytics").then((a) => a.track("journey_day_completed", {
        journey_id: journeyId,
        day,
        total_completed: j.completedDays.length,
      })).catch(() => {});
      import("@/lib/paywallScheduler").then((m) => m.firePaywallTrigger("journey_day_finished")).catch(() => {});
      // Finishing a day is a genuine happy moment — ask for a rating (queued
      // behind the paywall by the rating service, never dropped).
      import("@/services/rating").then((m) => {
        setTimeout(() => m.maybeRequestRating(), 6000);
      }).catch(() => {});

    }
  }, []);


  /** Mark a future day as rewarded-ad unlocked. */
  const unlockDay = useCallback((journeyId: string, day: number) => {
    const current = loadUnlocks();
    const arr = current[journeyId] || [];
    if (!arr.includes(day)) {
      current[journeyId] = [...arr, day];
      saveUnlocks(current);
      setUnlocks(current);
    }
  }, []);

  const getJourneyState = useCallback(
    (journeyId: string): JourneyState | undefined => progress[journeyId],
    [progress]
  );

  const getCompletedDays = useCallback(
    (journeyId: string): number[] => progress[journeyId]?.completedDays || [],
    [progress]
  );

  const isDayCompleted = useCallback(
    (journeyId: string, day: number): boolean =>
      progress[journeyId]?.completedDays.includes(day) ?? false,
    [progress]
  );

  const getCurrentDay = useCallback(
    (journeyId: string, totalDays: number): number => {
      const completed = progress[journeyId]?.completedDays || [];
      if (completed.length === 0) return 1;
      if (completed.length >= totalDays) return totalDays;
      return Math.min(Math.max(...completed) + 1, totalDays);
    },
    [progress]
  );

  /**
   * When can `day` be opened?
   * - Already completed → null (always accessible)
   * - Day 1 → null
   * - Previous day not completed → null (the dot-gating handles that as "sequential lock", not "time lock")
   * - User used early-unlock (ad) → null
   * - Otherwise → timestamp (ms) when it unlocks (lastCompletedAt + DAY_LOCK_HOURS)
   */
  const getDayUnlockAt = useCallback(
    (journeyId: string, day: number): number | null => {
      if (day <= 1) return null;
      const j = progress[journeyId];
      if (!j) return null;
      if (j.completedDays.includes(day)) return null;
      if (!j.completedDays.includes(day - 1)) return null; // sequential lock, not time lock
      if (!j.lastCompletedAt) return null;
      const unlockAt = new Date(j.lastCompletedAt).getTime() + DAY_LOCK_HOURS * 3600_000;
      return unlockAt > Date.now() ? unlockAt : null;
    },
    [progress]
  );

  const isDayTimeLocked = useCallback(
    (journeyId: string, day: number): boolean => getDayUnlockAt(journeyId, day) !== null,
    [getDayUnlockAt]
  );

  /**
   * The daily rhythm is now absolute: no rewarded ad and no Premium purchase
   * can skip ahead. A day opens on its own when the wait is over, which keeps
   * journeys a real daily habit instead of a one-sitting binge.
   */
  const requiresAdUnlock = useCallback(
    (_journeyId: string, _day: number, _isPremium: boolean): boolean => false,
    []
  );

  return {
    progress,
    completeDay,
    unlockDay,
    getJourneyState,
    getCompletedDays,
    isDayCompleted,
    getCurrentDay,
    getDayUnlockAt,
    isDayTimeLocked,
    requiresAdUnlock,
  };
}

