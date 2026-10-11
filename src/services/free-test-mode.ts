/**
 * Free test mode (admin/QA only, this device only).
 *
 * A lifetime one-time purchase can't be "un-owned" on a device, so Google Play
 * keeps answering "this account owns Pro" on every silent restore. That makes
 * it impossible to walk the free-user journey (onboarding offer, paywalls, ads)
 * on a device that once bought Pro.
 *
 * When this flag is on, the app treats RevenueCat as "confirmed free": silent
 * ownership recovery is skipped and entitlement resolution answers free, so
 * every free-tier gate behaves exactly like a brand new install.
 *
 * It never grants anything — it can only take Pro away locally. Turning it off
 * restores the real Play/RevenueCat state on the next launch.
 */
const KEY = "cw_free_test_mode";

export function isFreeTestMode(): boolean {
  try {
    return localStorage.getItem(KEY) === "true";
  } catch {
    return false;
  }
}

export function setFreeTestMode(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, "true");
    else localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
