import { useCallback, useSyncExternalStore } from "react";

const PREMIUM_KEY = "cw_premium_unlocked";
const AD_FREE_UNTIL_KEY = "cw_ad_free_until";
const EVENT_NAME = "cw:premium-change";

const AD_FREE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

// Premium is granted ONLY through a verified RevenueCat entitlement on the
// native app. No auto-unlock on web previews — that would mask real
// subscription/trial-cancel behavior during QA. Also clear any stale flag
// left over from the previous preview auto-unlock so locked UI is honest.
try {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    const isWebPreview =
      host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com");
    if (isWebPreview && localStorage.getItem(PREMIUM_KEY) === "true") {
      localStorage.removeItem(PREMIUM_KEY);
    }
  }
} catch {
  // ignore
}




function readPremium(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === "true";
  } catch {
    return false;
  }
}

function readAdFreeUntil(): number {
  try {
    const raw = localStorage.getItem(AD_FREE_UNTIL_KEY);
    if (!raw) return 0;
    const ts = parseInt(raw, 10);
    return Number.isFinite(ts) ? ts : 0;
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Single shared snapshot so every `usePremium()` subscriber across the app
// updates the moment unlock()/lock()/grantAdFreeTrial() is called — not just
// the component that triggered the change. This previously caused the carousel
// mockups (VTA / "Unlock with Pro" CTA) to remain locked after the user
// purchased Premium from the Premium sheet, because each component held its
// own private `useState` copy of the flag.
// ---------------------------------------------------------------------------
type Snapshot = { isPremium: boolean; adFreeUntil: number };
let snapshot: Snapshot = { isPremium: readPremium(), adFreeUntil: readAdFreeUntil() };

function refreshSnapshot() {
  const next = { isPremium: readPremium(), adFreeUntil: readAdFreeUntil() };
  if (next.isPremium !== snapshot.isPremium || next.adFreeUntil !== snapshot.adFreeUntil) {
    snapshot = next;
    window.dispatchEvent(new Event(EVENT_NAME));
  }
}

function subscribe(cb: () => void): () => void {
  const onEvent = () => cb();
  const onStorage = (e: StorageEvent) => {
    if (e.key === PREMIUM_KEY || e.key === AD_FREE_UNTIL_KEY) {
      snapshot = { isPremium: readPremium(), adFreeUntil: readAdFreeUntil() };
      cb();
    }
  };
  window.addEventListener(EVENT_NAME, onEvent);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT_NAME, onEvent);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): Snapshot {
  return snapshot;
}

export function usePremium() {
  const { isPremium, adFreeUntil } = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const unlock = useCallback(() => {
    try { localStorage.setItem(PREMIUM_KEY, "true"); } catch {}
    refreshSnapshot();
  }, []);

  const lock = useCallback(() => {
    try {
      localStorage.removeItem(PREMIUM_KEY);
      localStorage.removeItem(AD_FREE_UNTIL_KEY);
    } catch {}
    refreshSnapshot();
  }, []);

  /** Grant a 24h ad-free window. */
  const grantAdFreeTrial = useCallback((durationMs = AD_FREE_DURATION_MS) => {
    const until = Date.now() + durationMs;
    try { localStorage.setItem(AD_FREE_UNTIL_KEY, String(until)); } catch {}
    refreshSnapshot();
    return until;
  }, []);

  const isAdFree = isPremium || adFreeUntil > Date.now();
  const adFreeRemainingMs = Math.max(0, adFreeUntil - Date.now());

  return { isPremium, isAdFree, adFreeUntil, adFreeRemainingMs, unlock, lock, grantAdFreeTrial };
}
