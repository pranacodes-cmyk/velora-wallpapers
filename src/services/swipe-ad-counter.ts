/**
 * Tracks horizontal swipes across feeds and triggers an interstitial ad
 * after every N swipes. Premium users bypass entirely.
 *
 * - Counter PERSISTS across cold starts (localStorage), so a quick
 *   close+reopen no longer resets the user to 0 swipes.
 * - Trigger lowered to 4 swipes per ad (was 7) for healthy PH/MX/BR density.
 * - Always routed through `tryShowInterstitial` so the global 45s cooldown
 *   prevents stacking with prayer/reflection/quiz/chat exit ads.
 */
import { primeInterstitial } from "@/services/ads";
import { tryShowInterstitial, isAdCooldownActive } from "@/services/ad-cooldown";

const SWIPES_PER_AD = 4;
const PRELOAD_AT = 3; // Warm 1 swipe before trigger
const COUNT_KEY = "cw_swipe_ad_count";

function read(): number {
  try { return Number(localStorage.getItem(COUNT_KEY) || 0); } catch { return 0; }
}
function write(n: number) {
  try { localStorage.setItem(COUNT_KEY, String(n)); } catch {}
}

let adInFlight = false;

export function recordSwipeAndMaybeShowAd(_isPremium: boolean) {
  // Swipe-based interstitials disabled — they hurt session length and
  // Day-1 return rate on wallpaper feeds. Keeping the function as a no-op
  // so all call sites keep working.
  return;
}

