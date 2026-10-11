// Daily free-message quota for Bible Companion chat.
// First day: 3 free messages. Every day after: 2 messages. Resets at local midnight.
// After that, an interstitial fires on exit and Pro is required for more.
const KEY = "jw_companion_quota_daily_v1";
const FIRST_DAY_KEY = "jw_companion_first_day_v1";

export const FIRST_DAY_LIMIT = 5;
export const RETURNING_DAILY_LIMIT = 5;

// Back-compat aliases for screens still importing the old names.
export const FREE_DAILY_LIMIT = RETURNING_DAILY_LIMIT;
export const FREE_LIFETIME_LIMIT = RETURNING_DAILY_LIMIT;

type QuotaState = { date: string; used: number };

function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

function getFirstDay(): string {
  try {
    let d = localStorage.getItem(FIRST_DAY_KEY);
    if (!d) {
      d = todayKey();
      localStorage.setItem(FIRST_DAY_KEY, d);
    }
    return d;
  } catch {
    return todayKey();
  }
}

export function getDailyLimit(): number {
  return getFirstDay() === todayKey() ? FIRST_DAY_LIMIT : RETURNING_DAILY_LIMIT;
}

function read(): QuotaState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { date: todayKey(), used: 0 };
    const parsed = JSON.parse(raw) as QuotaState;
    if (parsed.date !== todayKey()) return { date: todayKey(), used: 0 };
    return { date: parsed.date, used: parsed.used ?? 0 };
  } catch {
    return { date: todayKey(), used: 0 };
  }
}

export function getRemaining(): number {
  return Math.max(0, getDailyLimit() - read().used);
}

export function consumeMessage(): number {
  const s = read();
  const next: QuotaState = { date: todayKey(), used: s.used + 1 };
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
  return Math.max(0, getDailyLimit() - next.used);
}
