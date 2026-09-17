/**
 * Personal Feed Shuffle
 * ---------------------
 * Client-side per-user feed rotation. The DB-side admin order is never touched.
 *
 * Rules:
 *  - First app visit ever (visits <= 1) → return feed AS-IS so brand new
 *    installs experience the admin-curated top picks.
 *  - Subsequent visits → unseen items float to the top (preserving admin
 *    order within the unseen group); previously-seen items go after,
 *    sorted oldest-seen-first, then lightly shuffled with a per-day seed
 *    so tomorrow's surface order is fresh again.
 *  - Order is locked per session (sessionStorage) so infinite scroll +
 *    re-renders don't jump around while the user browses.
 */

type Kind = "live" | "static";

const VISIT_KEY = (k: Kind) => `jw_feed_visits_${k}`;
const VISIT_TS_KEY = (k: Kind) => `jw_feed_visits_ts_${k}`;
const SEEN_KEY = (k: Kind) => `jw_feed_seen_${k}`;
const SESSION_KEY = (k: Kind) => `jw_feed_session_${k}`;
const SEEN_CAP = 800;
const VISIT_COOLDOWN_MS = 30 * 60 * 1000; // 30 min

export function getVisitCount(kind: Kind): number {
  try {
    return Number(localStorage.getItem(VISIT_KEY(kind)) || 0);
  } catch {
    return 0;
  }
}

/** Bump the visit counter at most once per 30 minutes per feed kind. */
export function bumpVisit(kind: Kind): void {
  try {
    const last = Number(localStorage.getItem(VISIT_TS_KEY(kind)) || 0);
    if (Date.now() - last < VISIT_COOLDOWN_MS) return;
    const next = getVisitCount(kind) + 1;
    localStorage.setItem(VISIT_KEY(kind), String(next));
    localStorage.setItem(VISIT_TS_KEY(kind), String(Date.now()));
    // A brand new visit also invalidates the previous session snapshot
    // so re-ordering picks up fresh data.
    sessionStorage.removeItem(SESSION_KEY(kind));
  } catch {
    // Ignore storage errors
  }
}

function getSeen(kind: Kind): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY(kind)) || "{}");
  } catch {
    return {};
  }
}

export function markSeen(kind: Kind, ids: string[]): void {
  if (!ids.length) return;
  try {
    const seen = getSeen(kind);
    const now = Date.now();
    for (const id of ids) seen[id] = now;
    // Cap memory: keep the most-recently-seen SEEN_CAP entries.
    const entries = Object.entries(seen).sort((a, b) => b[1] - a[1]).slice(0, SEEN_CAP);
    localStorage.setItem(SEEN_KEY(kind), JSON.stringify(Object.fromEntries(entries)));
  } catch {
    // Ignore storage errors
  }
}

/** Deterministic shuffle (Mulberry32-ish). Same seed ⇒ same order. */
function seededShuffle<T>(arr: T[], seed: number): T[] {
  const out = arr.slice();
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    const rand = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    const j = Math.floor(rand * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function dailySeed(): number {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/**
 * Reorder a feed array for the current user. Stable per session.
 * If items is empty or this is a first-time visit, returns input unchanged.
 */
export function personalizeFeed<T extends { id: string }>(items: T[], kind: Kind): T[] {
  if (!items.length) return items;
  const visits = getVisitCount(kind);
  if (visits <= 1) return items;

  const todaySeed = dailySeed();

  // Honor an existing session lock so order doesn't shift during scroll —
  // but only if the snapshot was taken on the same calendar day. If the
  // user crossed midnight with the app open, drop the snapshot so they
  // get a fresh rotation on the next feed render.
  try {
    const snapRaw = sessionStorage.getItem(SESSION_KEY(kind));
    if (snapRaw) {
      const snap = JSON.parse(snapRaw);
      if (snap && snap.seed === todaySeed && Array.isArray(snap.ids)) {
        const byId = new Map(items.map((it) => [it.id, it]));
        const ordered: T[] = [];
        const used = new Set<string>();
        for (const id of snap.ids) {
          const it = byId.get(id);
          if (it) {
            ordered.push(it);
            used.add(id);
          }
        }
        for (const it of items) if (!used.has(it.id)) ordered.push(it);
        return ordered;
      }
    }
  } catch {
    // Ignore storage errors
  }

  const seenMap = getSeen(kind);
  const unseen: T[] = [];
  const seen: T[] = [];
  for (const it of items) {
    if (seenMap[it.id]) seen.push(it);
    else unseen.push(it);
  }

  // Unseen: keep admin order — admin's ranking matters MOST for fresh content.
  // Seen: oldest-seen first (re-surface stale ones), then a tiny shuffle
  //       so it doesn't feel mechanical.
  const seenSorted = seen.sort((a, b) => (seenMap[a.id] || 0) - (seenMap[b.id] || 0));
  const seenShuffled = seededShuffle(seenSorted, todaySeed ^ 0x9e3779b9);

  const result = [...unseen, ...seenShuffled];

  try {
    sessionStorage.setItem(
      SESSION_KEY(kind),
      JSON.stringify({ seed: todaySeed, ids: result.map((it) => it.id) }),
    );
  } catch {
    // Ignore storage errors
  }

  return result;
}

/** Convenience: schedule a "mark feed as seen" pass after a delay. */
export function scheduleMarkSeen(kind: Kind, ids: string[], delayMs = 4000): () => void {
  const t = setTimeout(() => markSeen(kind, ids), delayMs);
  return () => clearTimeout(t);
}
