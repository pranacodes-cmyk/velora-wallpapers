/**
 * AdMob wrapper with background preloading for instant interstitials.
 *
 * Rewarded ads: prepare → show on demand (user expects a brief load).
 * Interstitials: kept WARM in the background so showing is instant —
 *   1. App init → preloadInterstitial() warms the first ad
 *   2. Caller invokes showInterstitialAd() → shows immediately if ready,
 *      otherwise prepares + shows
 *   3. After dismiss/fail → automatically warms the NEXT one
 *   4. primeInterstitial() can be called preemptively (e.g. swipe #5 of 7)
 *      to guarantee the next ad is ready before the user reaches the trigger
 *
 * Web fallback: simulated success after a tiny delay so dev/preview works.
 */
import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  RewardAdPluginEvents,
  InterstitialAdPluginEvents,
} from "@capacitor-community/admob";
import { adLog } from "./ad-logs";
import { markAdShown } from "./ad-cooldown";

// ---------------------------------------------------------------------------
// Central premium / ad-free gate. Every ad entry point checks this first so
// Pro users (and users on the 24h ad-free trial) NEVER see an ad, regardless
// of whether the individual call site remembered to gate. Reads localStorage
// directly to avoid pulling in React hooks here.
// ---------------------------------------------------------------------------
function isAdFreeUser(): boolean {
  try {
    if (localStorage.getItem("cw_premium_unlocked") === "true") return true;
    const until = parseInt(localStorage.getItem("cw_ad_free_until") || "0", 10);
    if (Number.isFinite(until) && until > Date.now()) return true;
  } catch { /* ignore */ }
  return false;
}

function trackAd(event: string, props?: Record<string, any>) {
  import("@/services/analytics").then((a) => a.track(event, props)).catch(() => {});
}



// Production AdMob IDs — Prayly
const AD_REWARDED = "ca-app-pub-2361456317095553/3292910180";
const AD_INTERSTITIAL = "ca-app-pub-2361456317095553/7308266108";
const PRODUCTION_AD_FLAGS = {
  initializeForTesting: false,
  isTesting: false,
  rewardedAdUnit: AD_REWARDED,
  interstitialAdUnit: AD_INTERSTITIAL,
};

let initialized = false;
let initPromise: Promise<void> | null = null;

/** Attach catch-all listeners that dump every event payload for diagnostics. */
async function attachDiagListeners() {
  const allEvents: Array<[string, any]> = [
    ["REW:Loaded", RewardAdPluginEvents.Loaded],
    ["REW:FailedToLoad", RewardAdPluginEvents.FailedToLoad],
    ["REW:Showed", RewardAdPluginEvents.Showed],
    ["REW:FailedToShow", RewardAdPluginEvents.FailedToShow],
    ["REW:Dismissed", RewardAdPluginEvents.Dismissed],
    ["REW:Rewarded", RewardAdPluginEvents.Rewarded],
    // Paid event — only one that exposes mediationAdapterClassName / adSourceName
    ["REW:Paid", "onRewardedVideoAdImpression"],
    ["INT:Loaded", InterstitialAdPluginEvents.Loaded],
    ["INT:FailedToLoad", InterstitialAdPluginEvents.FailedToLoad],
    ["INT:Showed", InterstitialAdPluginEvents.Showed],
    ["INT:FailedToShow", InterstitialAdPluginEvents.FailedToShow],
    ["INT:Dismissed", InterstitialAdPluginEvents.Dismissed],
    ["INT:Paid", "onInterstitialAdImpression"],
  ];
  for (const [name, ev] of allEvents) {
    try {
      await AdMob.addListener(ev as any, (info: any) => {
        adLog(name, "event", info);
      });
    } catch {}
  }
}

/**
 * Re-open the AdMob consent (UMP) form so the user can change their
 * personalized-ads preference. Required by Google for GDPR revocation.
 * Returns true if the form was shown, false otherwise.
 */
export async function showPrivacyOptionsForm(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  await ensureInit();
  try {
    // Force-show the consent form regardless of current status — this is the
    // user explicitly tapping "Manage Ad Preferences".
    await AdMob.showConsentForm();
    return true;
  } catch {
    return false;
  }
}

/**
 * Whether the consent form is available to show right now.
 * Used to hide the Settings row in regions where it isn't applicable.
 */
export async function isPrivacyOptionsRequired(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    await ensureInit();
    const info = await AdMob.requestConsentInfo();
    return Boolean(info.isConsentFormAvailable);
  } catch {
    return false;
  }
}

// ─── Interstitial warm-cache state ────────────────────────────────────────
type InterstitialState = "cold" | "loading" | "ready" | "showing";
let interstitialState: InterstitialState = "cold";
let interstitialReadyAt = 0;
// Re-warm if older than 50 minutes (AdMob fill TTL is ~1h).
const INTERSTITIAL_TTL_MS = 50 * 60 * 1000;


async function ensureInit() {
  if (initialized || !Capacitor.isNativePlatform()) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
  try {
    adLog("INIT", "AdMob.initialize start — PRODUCTION MODE", PRODUCTION_AD_FLAGS);
    await AdMob.initialize({
      initializeForTesting: false,
    });
    adLog("INIT", "AdMob.initialize OK — initializeForTesting=false");
    await attachDiagListeners();
    initialized = true;
  } catch (e) {
    adLog("INIT", "AdMob.initialize FAILED", e);
  } finally {
    initPromise = null;
  }
  })();

  return initPromise;
}

/**
 * Background-prepare an interstitial so the next show() is instant.
 * Safe to call repeatedly — no-ops if one is already loading or ready.
 */
export async function primeInterstitial(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  await ensureInit();


  // Already warm and fresh — nothing to do.
  if (
    interstitialState === "ready" &&
    Date.now() - interstitialReadyAt < INTERSTITIAL_TTL_MS
  ) {
    return;
  }
  // Already in-flight, or currently being shown — let it finish.
  if (interstitialState === "loading" || interstitialState === "showing") {
    return;
  }

  interstitialState = "loading";
    adLog("INT", "prime: prepareInterstitial — isTesting=false", { adId: AD_INTERSTITIAL, isTesting: false });
  try {
    await AdMob.prepareInterstitial({
      adId: AD_INTERSTITIAL,
      isTesting: false,
    });
    interstitialState = "ready";
    interstitialReadyAt = Date.now();
    adLog("INT", "prime: ready");
  } catch (e) {
    adLog("INT", "prime: FAILED", e);
    interstitialState = "cold";
  }
}

/**
 * Show a rewarded video. Resolves `true` if the user earned the reward.
 * Important UX rule: if AdMob cannot load/show an ad, we fail open and let
 * the wallpaper flow continue. Users should never lose a wallpaper because
 * Google had no inventory, slow fill, or a transient SDK error.
 * Returns `false` only when an ad was actually shown and the user closed it
 * before the reward event.
 *
 * `loadingLabel` (optional): caption shown in the global loading overlay
 * while the ad is being fetched (e.g. "Preparing your quiz…"). The overlay
 * only appears if loading takes >250ms — so warm/instant ads stay snappy.
 */
export async function showRewardedAd(loadingLabel?: string): Promise<boolean> {
  const emitStart = () => {
    try {
      window.dispatchEvent(
        new CustomEvent("jw:ad-loading-start", {
          detail: { label: loadingLabel || "Loading ad…" },
        }),
      );
    } catch {}
  };
  const emitEnd = () => {
    try { window.dispatchEvent(new CustomEvent("jw:ad-loading-end")); } catch {}
  };

  trackAd("ad_rewarded_requested", { label: loadingLabel || null });

  // Pro / ad-free users instantly get the reward — no ad ever loads or shows.
  if (isAdFreeUser()) {
    trackAd("ad_rewarded_completed", { earned: true, reason: "ad_free_user", shown: false });
    return true;
  }

  if (!Capacitor.isNativePlatform()) {
    // Web/dev: simulate a quick reward so flows are testable.
    emitStart();
    await new Promise((r) => setTimeout(r, 400));
    emitEnd();
    trackAd("ad_rewarded_completed", { earned: true, platform: "web" });
    return true;
  }


  await ensureInit();

  return new Promise<boolean>(async (resolve) => {
    let earned = false;
    let settled = false;
    let shown = false;
    const done = (v: boolean, reason: string) => {
      if (settled) return;
      settled = true;
      if (!shown) emitEnd(); // safety if we never got to show
      try { (AdMob as any).removeAllListeners?.(); } catch {}
      trackAd("ad_rewarded_completed", { earned: v, reason, shown });
      resolve(v);
    };

    try {
      await AdMob.addListener(RewardAdPluginEvents.Rewarded, () => {
        earned = true;
      });
      await AdMob.addListener(RewardAdPluginEvents.Dismissed, () => {
        // Bump global ad cooldown so a swipe/exit interstitial can't fire
        // immediately on top of the rewarded video the user just watched.
        if (earned) markAdShown();
        done(earned, earned ? "earned" : "dismissed_early");
      });
      await AdMob.addListener(RewardAdPluginEvents.FailedToLoad, () => {
        emitEnd();
        done(true, "failed_to_load");
      });
      await AdMob.addListener(RewardAdPluginEvents.FailedToShow, () => {
        emitEnd();
        done(true, "failed_to_show");
      });

      emitStart();
      adLog("REW", "prepareRewardVideoAd — isTesting=false", { adId: AD_REWARDED, isTesting: false });
      await AdMob.prepareRewardVideoAd({
        adId: AD_REWARDED,
        isTesting: false,
      });
      adLog("REW", "prepared, showing");
      shown = true;
      emitEnd();
      await AdMob.showRewardVideoAd();
    } catch (e) {
      adLog("REW", "FAILED", e);
      emitEnd();
      done(true, "exception");
    }
  });
}


/**
 * Show an interstitial. If a warm ad is ready, it appears INSTANTLY.
 * Otherwise it prepares + shows, then warms the next one in the background.
 *
 * `opts.onlyIfWarm`: show ONLY if a warm ad is already ready — never
 * cold-prepare. Use this for moment-based triggers (journey completion,
 * reflection close) where a late-loading ad would pop up seconds later in
 * the middle of a completely different screen.
 */
export async function showInterstitialAd(
  loadingLabel?: string,
  opts: { onlyIfWarm?: boolean } = {},
): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // Pro / ad-free users: silently no-op.
  if (isAdFreeUser()) return;



  // Emit loading events so the global AdLoadingOverlay shows feedback
  // during a cold prepare (>250ms). Warm ads stay invisible — no flash.
  const emitStart = () => {
    try {
      window.dispatchEvent(
        new CustomEvent("jw:ad-loading-start", {
          detail: { label: loadingLabel || "Loading ad…" },
        }),
      );
    } catch {}
  };
  const emitEnd = () => {
    try { window.dispatchEvent(new CustomEvent("jw:ad-loading-end")); } catch {}
  };

  await ensureInit();

  // If we don't have a warm ad, prepare one inline (slower path) — unless
  // the caller asked for warm-only, in which case we silently skip so the
  // ad can never land late on an unrelated screen.
  if (
    interstitialState !== "ready" ||
    Date.now() - interstitialReadyAt > INTERSTITIAL_TTL_MS
  ) {
    if (opts.onlyIfWarm) {
      adLog("INT", "show: skipped — no warm ad (onlyIfWarm)");
      return;
    }
    interstitialState = "loading";
    adLog("INT", "show: preparing cold path — isTesting=false", { adId: AD_INTERSTITIAL, isTesting: false });
    emitStart();
    try {
      await AdMob.prepareInterstitial({
        adId: AD_INTERSTITIAL,
        isTesting: false,
      });
      interstitialState = "ready";
      interstitialReadyAt = Date.now();
      adLog("INT", "show: prepared");
    } catch (e) {
      adLog("INT", "show: prepare FAILED", e);
      interstitialState = "cold";
      emitEnd();
      // Don't auto-warm here — request inflation under no-fill regions.
      return;
    }
  } else {
    adLog("INT", "show: using warm ad");
  }
  // Always end the overlay once we're about to show — the ad itself takes over.
  emitEnd();

  interstitialState = "showing";
  trackAd("ad_interstitial_shown", { label: loadingLabel || null });

  return new Promise<void>(async (resolve) => {
    let settled = false;
    const done = (reason: string) => {
      if (settled) return;
      settled = true;
      try { (AdMob as any).removeAllListeners?.(); } catch {}
      interstitialState = "cold";
      trackAd("ad_interstitial_dismissed", { reason });
      // NOTE: Do NOT auto-warm next interstitial here. The next swipe #6 will
      // do it. Auto-warming caused ~99% wasted requests historically because
      // many users close the app or never reach the next trigger.
      resolve();
    };


    try {
      await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => done("dismissed"));
      await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => done("failed_to_load"));
      await AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, () => done("failed_to_show"));

      await AdMob.showInterstitial();
    } catch (e) {
      /* show failed */;
      done("exception");
    }
  });
}

