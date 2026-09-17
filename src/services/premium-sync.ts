// Central "premium changed" side-effect hub.
// -------------------------------------------
// One place that knows what to do when a user becomes Pro or loses Pro.
// Called from three sources, all funneled here:
//
//   1. RevenueCat CustomerInfoUpdateListener  (real-time, gold standard)
//   2. App foreground / resume                (catches missed pushes)
//   3. App cold start                          (initial reconcile)
//
// On downgrade (Pro → free) we:
//   - Flip the local `cw_premium_unlocked` flag + fire the in-app event
//     so every `usePremium()` subscriber updates instantly.
//   - Tell the Daily Verse live wallpaper service `setPremium(false)` →
//     mood-pack rotation freezes, default 365-verse rotation freezes on
//     the user's last unlocked day (already implemented in
//     DailyVerseWallpaperService.displayDay/verseForDay).
//   - Ask the Parallax live wallpaper plugin to `clearIfActive` → if our
//     parallax service is still the active wallpaper, remove it and let
//     Android fall back to the system default. Verified via
//     WallpaperManager.getWallpaperInfo() so we never touch a third-party
//     wallpaper the user chose after cancelling.
//
// Content push notifications already self-sync via a `cw:premium-change`
// listener in src/plugins/content-push.ts, so firing the event here is
// enough for that channel.

const PREMIUM_KEY = "cw_premium_unlocked";
const AD_FREE_UNTIL_KEY = "cw_ad_free_until";
const EVENT_NAME = "cw:premium-change";
const FREE_STRIKES_KEY = "cw_premium_free_strikes";
const GRACE_UNTIL_KEY = "cw_premium_grace_until";

// A Pro user must be reported free TWICE (across separate reconciles) before
// we strip entitlements — one bad answer from RevenueCat (stale cache, empty
// CustomerInfo pushed by the update listener right after init, partial sync on
// a fresh install) must never revoke a paying user. A hard grace ceiling makes
// sure a genuine cancellation always reverts within 24h even if the second
// strike never lands.
const REQUIRED_FREE_STRIKES = 2;
const GRACE_MS = 24 * 60 * 60 * 1000;

let lastAppliedIsPremium: boolean | null = null;

function readLocalPremium(): boolean {
  try {
    return localStorage.getItem(PREMIUM_KEY) === "true";
  } catch {
    return false;
  }
}

function readNum(key: string): number {
  try {
    return Number(localStorage.getItem(key) ?? 0) || 0;
  } catch {
    return 0;
  }
}

function writeNum(key: string, value: number) {
  try { localStorage.setItem(key, String(value)); } catch { /* ignore */ }
}

function clearDowngradeGuards() {
  try {
    localStorage.removeItem(FREE_STRIKES_KEY);
    localStorage.removeItem(GRACE_UNTIL_KEY);
  } catch { /* ignore */ }
}

/**
 * Should we act on a confirmed-free answer for a user who is locally Pro?
 * Returns false while the user is still inside the strike/grace window.
 */
function downgradeConfirmed(): boolean {
  const now = Date.now();
  const strikes = readNum(FREE_STRIKES_KEY) + 1;
  writeNum(FREE_STRIKES_KEY, strikes);

  let graceUntil = readNum(GRACE_UNTIL_KEY);
  if (!graceUntil) {
    graceUntil = now + GRACE_MS;
    writeNum(GRACE_UNTIL_KEY, graceUntil);
  }

  return strikes >= REQUIRED_FREE_STRIKES || now >= graceUntil;
}

/**
 * Apply an authoritative premium state coming from RevenueCat.
 * Idempotent — safe to call as often as you like.
 */
export async function syncPremiumState(isPremium: boolean): Promise<void> {
  const prev = readLocalPremium();

  if (isPremium) {
    clearDowngradeGuards();
  } else if (prev && !downgradeConfirmed()) {
    // Locally Pro + a single (possibly wrong) "free" answer → keep Pro,
    // keep the wallpaper, show no paywall. We'll re-check next reconcile.
    return;
  }


  try {
    if (isPremium) {
      localStorage.setItem(PREMIUM_KEY, "true");
    } else {
      localStorage.removeItem(PREMIUM_KEY);
      localStorage.removeItem(AD_FREE_UNTIL_KEY);
    }
  } catch {
    /* ignore */
  }

  const changed = prev !== isPremium || lastAppliedIsPremium !== isPremium;
  if (changed) {
    try {
      window.dispatchEvent(
        new StorageEvent("storage", { key: PREMIUM_KEY })
      );
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT_NAME));
  }

  // Notify the Daily Verse live wallpaper service on every call — cheap,
  // idempotent, and guarantees the native flag matches JS even if the JS
  // flag was already correct but the native prefs drifted (e.g. app was
  // killed before we last synced).
  try {
    const mod = await import("@/plugins/daily-verse-wallpaper");
    await mod.default.setPremium({ premium: isPremium });
  } catch {
    /* plugin unavailable — web preview */
  }

  // Downgrade path — always attempt on any reconcile that resolves to free.
  // Native `clearIfActive` is a no-op unless OUR ParallaxLiveWallpaperService
  // is currently the active system wallpaper, so it's safe (and cheap) to
  // call every time. This closes a real gap: a user who set the parallax
  // wallpaper while Pro and then let their trial lapse would otherwise only
  // ever get one chance to revert (the first reconcile of that session).
  // If that call raced with a stale RC cache, the wallpaper stayed live for
  // days. Calling it on every free reconcile means the next app foreground
  // reliably reverts them.
  if (!isPremium) {
    try {
      const { default: Parallax } = await import("@/lib/native/parallaxWallpaper");
      const p = Parallax as unknown as {
        clearIfActive?: () => Promise<{ cleared: boolean }>;
      };
      if (typeof p.clearIfActive === "function") {
        await p.clearIfActive();
      }
    } catch {
      /* plugin unavailable */
    }
  }

  lastAppliedIsPremium = isPremium;
}
