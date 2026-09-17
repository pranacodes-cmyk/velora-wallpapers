import { Capacitor } from "@capacitor/core";
import { FacebookAnalytics } from "@capgo/capacitor-facebook-analytics";

/**
 * Meta (Facebook) App Events wrapper.
 * Fires standard events used by Meta Ads campaigns:
 *   - App install / open (auto-logged by native SDK)
 *   - CompleteRegistration (onboarding done)
 *   - Subscribe / Purchase (RevenueCat success) → enables VO campaigns
 * All calls are no-ops on web.
 */

function isAvailable(): boolean {
  return Capacitor.isNativePlatform();
}

let initialized = false;

/** Call once at app start. Native SDK auto-activates app open/install. */
export async function initMetaEvents(): Promise<void> {
  if (!isAvailable() || initialized) return;
  try {
    await FacebookAnalytics.initAppEvents();
    // Enable advertiser tracking (Android IDFA / iOS pre-ATT).
    // On iOS 17+ ATT is the source of truth; this is a no-op there.
    try { await FacebookAnalytics.enableAdvertiserTracking(); } catch {}
    initialized = true;
  } catch {
    /* meta init failed - non-fatal */
  }
}

/** Generic event logger. */
export async function logMetaEvent(
  name: string,
  params?: Record<string, string | number>,
  value?: { amount: number; currency: string }
): Promise<void> {
  if (!isAvailable()) return;
  try {
    await FacebookAnalytics.logEvent({
      eventName: name,
      params,
      ...(value ? { value: value.amount, currency: value.currency } : {}),
    } as any);
  } catch {
    /* swallow */
  }
}

/** Fired when user finishes onboarding. */
export function logCompleteRegistration(): void {
  void logMetaEvent("fb_mobile_complete_registration", { fb_registration_method: "onboarding" });
}

/** Fired when user opens premium sheet (top-of-funnel for VO). */
export function logInitiatedCheckout(productId?: string): void {
  void logMetaEvent("fb_mobile_initiated_checkout", productId ? { fb_content_id: productId } : undefined);
}

/** Fired when user adds a favorite (lightweight engagement signal). */
export function logAddToWishlist(wallpaperId?: string): void {
  void logMetaEvent("fb_mobile_add_to_wishlist", wallpaperId ? { fb_content_id: wallpaperId } : undefined);
}

/** Fired when user views a wallpaper detail. */
export function logContentView(wallpaperId?: string): void {
  void logMetaEvent("fb_mobile_content_view", wallpaperId ? { fb_content_id: wallpaperId } : undefined);
}

/**
 * Fired on RevenueCat purchase success.
 * This is the MOST important event — it powers Meta Value Optimization (VO).
 */
export async function logPurchase(amount: number, currency: string, productId?: string): Promise<void> {
  if (!isAvailable()) return;
  try {
    await FacebookAnalytics.logPurchase({
      amount,
      currency,
      params: productId ? { fb_content_id: productId } : undefined,
    });
  } catch {
    /* swallow */
  }
}
