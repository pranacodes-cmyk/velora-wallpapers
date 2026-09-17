import { useEffect, useState, useCallback } from "react";

/**
 * Today's 3-step daily checklist: Prayer · Reflection · Quiz.
 * Reads from existing per-feature keys so completion stays in sync no matter
 * where the user finishes a task.
 */
const PRAYER_KEY = "cw_prayers_unlocked";          // { date: "YYYY-MM-DD" }
const REFLECTION_KEY = "cw_reflection_done";       // "YYYY-MM-DD"
const QUIZ_KEY = "cw_quiz_daily";                  // "YYYY-MM-DD"

export const TODAY_TASKS_EVENT = "cw_today_tasks_changed";

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function readPrayer(): boolean {
  try {
    const raw = localStorage.getItem(PRAYER_KEY);
    if (!raw) return false;
    const { date } = JSON.parse(raw);
    return date === todayKey();
  } catch { return false; }
}
function readReflection(): boolean {
  try { return localStorage.getItem(REFLECTION_KEY) === todayKey(); } catch { return false; }
}
function readQuiz(): boolean {
  try { return localStorage.getItem(QUIZ_KEY) === todayKey(); } catch { return false; }
}

export interface TodayTasks {
  prayer: boolean;
  reflection: boolean;
  quiz: boolean;
  doneCount: number;
  total: number;
  allDone: boolean;
}

function compute(): TodayTasks {
  const p = readPrayer();
  const r = readReflection();
  const q = readQuiz();
  const doneCount = [p, r, q].filter(Boolean).length;
  return { prayer: p, reflection: r, quiz: q, doneCount, total: 3, allDone: doneCount === 3 };
}

export function markReflectionDone() {
  try {
    localStorage.setItem(REFLECTION_KEY, todayKey());
    window.dispatchEvent(new CustomEvent(TODAY_TASKS_EVENT));
  } catch {}
}

export function useTodayTasks(): TodayTasks {
  const [state, setState] = useState<TodayTasks>(compute);

  const refresh = useCallback(() => setState(compute()), []);

  useEffect(() => {
    refresh();
    const onVisibility = () => { if (!document.hidden) refresh(); };
    window.addEventListener(TODAY_TASKS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener(TODAY_TASKS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  return state;
}
