import { useEffect, useSyncExternalStore } from "react";
import {
  completedCount, currentDay, evaluateChallenge, getChallenge, litToday, liveStreak,
  localDate, subscribeChallenge, tasksDoneToday, type ChallengeState,
} from "@/services/challenge";
import { lampTierFor } from "@/data/challenge75";
import { scheduleProgressSync } from "@/services/challengeCircle";
import type { TaskId } from "@/data/challenge75";

export type ChallengeView = {
  state: ChallengeState;
  today: string;
  day: number;
  completed: number;
  lit: boolean;
  done: TaskId[];
  streak: number;
  tier: number;
  /** 0–1 brightness of the flame across the whole journey */
  intensity: number;
};

export function viewOf(state: ChallengeState, today = localDate()): ChallengeView {
  const completed = completedCount(state);
  return {
    state,
    today,
    day: currentDay(state, today),
    completed,
    lit: litToday(state, today),
    done: tasksDoneToday(state, today),
    streak: liveStreak(state, today),
    tier: lampTierFor(completed),
    intensity: Math.min(1, 0.22 + (completed / 75) * 0.78),
  };
}

/** Reactive challenge state. Applies missed-day rules on open and on resume. */
export function useChallenge(): ChallengeView {
  const state = useSyncExternalStore(subscribeChallenge, getChallenge, getChallenge);

  useEffect(() => {
    evaluateChallenge();
    const onVisible = () => { if (!document.hidden) evaluateChallenge(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);

  useEffect(() => { scheduleProgressSync(); }, [state]);

  return viewOf(state);
}
