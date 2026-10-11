// Tiny localStorage store for AI personal prayer history.
const PRAYER_KEY = "jw_personal_prayers_v1";

export type SavedPrayer = {
  id: string;
  ts: number;
  topic: string;     // user's prompt
  prayer: string;    // AI-generated prayer
};

const MAX = 200;

function readArr<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as T[]) : [];
  } catch {
    return [];
  }
}

function writeArr<T>(key: string, arr: T[]) {
  try {
    localStorage.setItem(key, JSON.stringify(arr.slice(0, MAX)));
  } catch {}
}

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function listPrayers(): SavedPrayer[] {
  return readArr<SavedPrayer>(PRAYER_KEY);
}

export function savePrayer(topic: string, prayer: string): SavedPrayer {
  const item: SavedPrayer = { id: uid(), ts: Date.now(), topic, prayer };
  writeArr(PRAYER_KEY, [item, ...listPrayers()]);
  return item;
}

// ── Lifetime free quota for personal prayers ──────────────────────────
// Free users get ONE personalized prayer in their lifetime. After that
// the PremiumSheet takes over. This is the highest-perceived-value AI
// feature, so a single taste is enough to drive conversion.
const QUOTA_KEY = "jw_ai_pastoral_quota_v2";
export const FREE_LIFETIME_LIMIT = 1;
// Back-compat export for any older imports.
export const FREE_DAILY_LIMIT = FREE_LIFETIME_LIMIT;

type Q = { used: number };

function readQ(): Q {
  try {
    const raw = localStorage.getItem(QUOTA_KEY);
    if (!raw) return { used: 0 };
    const p = JSON.parse(raw) as Q;
    return { used: Math.max(0, p.used | 0) };
  } catch {
    return { used: 0 };
  }
}

export function getPastoralRemaining(): number {
  return Math.max(0, FREE_LIFETIME_LIMIT - readQ().used);
}

export function consumePastoral(): number {
  const q = readQ();
  const next: Q = { used: q.used + 1 };
  try {
    localStorage.setItem(QUOTA_KEY, JSON.stringify(next));
  } catch {}
  return Math.max(0, FREE_LIFETIME_LIMIT - next.used);
}
