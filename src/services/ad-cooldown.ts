/**
 * Global interstitial cooldown.
 *
 * One source of truth for *when* an interstitial may show. Every trigger
 * (prayer close, reflection close, quiz results exit, bible chat exit,
 * swipe counter) must go through `tryShowInterstitial` so we never stack
 * two ads in a few seconds — the #1 reason users 1-star faith apps.
 *
 * We intentionally have NO launch/startup guard: Prayly never shows an
 * app-open or cold-start interstitial, so the only thing protecting users
 * from back-to-back ads is the 45s cooldown below.
 */
import { showInterstitialAd } from "@/services/ads";

const COOLDOWN_MS = 45_000;

let lastShownAt = 0;
let inFlight = false;


export function adCooldownRemainingMs(): number {
  return Math.max(0, COOLDOWN_MS - (Date.now() - lastShownAt));
}

/**
 * Mark that an ad-shaped event just happened (e.g. rewarded video finished).
 * Prevents an interstitial from stacking on top of a rewarded ad — without
 * this, a swipe-counter interstitial could fire 1 second after the user
 * watched a reward video to unlock a wallpaper.
 */
export function markAdShown() {
  lastShownAt = Date.now();
}

export function isAdCooldownActive(): boolean {
  return adCooldownRemainingMs() > 0 || inFlight;
}

/**
 * Show an interstitial only if the global 45s cooldown allows it.
 * Returns true if an ad was actually attempted, false if suppressed.
 *
 * `force: true` bypasses the cooldown (use VERY sparingly — currently
 * unused; reserved for future critical funnel choke points).
 */
export async function tryShowInterstitial(
  label?: string,
  opts: { force?: boolean; onlyIfWarm?: boolean } = {},
): Promise<boolean> {
  if (!opts.force && isAdCooldownActive()) return false;

  inFlight = true;
  try {
    await showInterstitialAd(label, { onlyIfWarm: opts.onlyIfWarm });
    lastShownAt = Date.now();
    return true;
  } catch {
    return false;
  } finally {
    inFlight = false;
  }
}

/* ---------------- Cold-start interstitial ---------------- */

/**
 * Cold-start interstitials are intentionally disabled. Prayly should never
 * surprise a user with an ad just for opening the app; only explicit
 * engagement triggers such as prayer/verse completion, swipes, or exits may call tryShowInterstitial().
 */
export async function maybeShowColdStartInterstitial(): Promise<void> {
  return;
}
