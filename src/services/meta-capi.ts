/**
 * Client → server Meta Conversions API helper.
 * Fires fire-and-forget POST to the `meta-capi` edge function with stable
 * device_id, fbc/fbp click IDs, and event_id so events can be deduplicated
 * against the client-side native SDK events.
 */
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";

const DEVICE_KEY = "cw_device_id";
const INSTALL_FIRED_KEY = "cw_meta_install_fired";
const FBC_KEY = "cw_fbc";
const FBP_KEY = "cw_fbp";
const APP_USER_ID_KEY = "cw_app_user_id";
const EMAIL_KEY = "cw_user_email";

function getDeviceId(): string {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return "anon";
  }
}

function uuid(): string {
  try { return crypto.randomUUID(); } catch { return String(Date.now()) + Math.random(); }
}

/**
 * Capture Meta click ID (`fbclid`) from URL and persist in Meta's `_fbc`
 * format: `fb.{subdomain}.{timestamp}.{fbclid}`. Also generates an `_fbp`
 * browser ID if none exists. Call once on app boot.
 */
export function captureMetaClickId(): void {
  try {
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get("fbclid");
    if (fbclid) {
      const fbc = `fb.1.${Date.now()}.${fbclid}`;
      localStorage.setItem(FBC_KEY, fbc);
    }
    if (!localStorage.getItem(FBP_KEY)) {
      const rand = Math.floor(Math.random() * 1e10);
      localStorage.setItem(FBP_KEY, `fb.1.${Date.now()}.${rand}`);
    }
  } catch { /* ignore */ }
}

/** Advanced matching identifiers — set when known for higher match rates. */
export function setMetaUserIdentity(opts: { appUserId?: string; email?: string }): void {
  try {
    if (opts.appUserId) localStorage.setItem(APP_USER_ID_KEY, opts.appUserId);
    if (opts.email) localStorage.setItem(EMAIL_KEY, opts.email.trim().toLowerCase());
  } catch { /* ignore */ }
}

function getStored(k: string): string | undefined {
  try { return localStorage.getItem(k) ?? undefined; } catch { return undefined; }
}

/** Best-effort device info used to build Meta's required `extinfo` array. */
function getAppData() {
  const platformRaw = (Capacitor.getPlatform?.() ?? "web") as "ios" | "android" | "web";
  const platform = platformRaw === "ios" || platformRaw === "android" ? platformRaw : "web";
  let locale = "en_US";
  let timezone = "GMT+0";
  let screen_width = 0;
  let screen_height = 0;
  try { locale = (navigator.language || "en-US").replace("-", "_"); } catch {}
  try {
    const offMin = -new Date().getTimezoneOffset();
    const sign = offMin >= 0 ? "+" : "-";
    const h = String(Math.floor(Math.abs(offMin) / 60));
    timezone = `GMT${sign}${h}`;
  } catch {}
  try {
    screen_width = window.screen?.width ?? 0;
    screen_height = window.screen?.height ?? 0;
  } catch {}
  return {
    platform,
    bundle_id: "com.jesuswallpaperbible.app",
    app_version: "1.0.0",
    os_version: platform === "ios" ? "17.0" : platform === "android" ? "13" : "0",
    locale,
    timezone,
    screen_width,
    screen_height,
    advertiser_tracking_enabled: 1 as const,
  };
}

export async function trackMetaCapi(
  event_name: string,
  opts: { value?: number; currency?: string; custom_data?: Record<string, unknown>; event_id?: string } = {}
): Promise<void> {
  try {
    await supabase.functions.invoke("meta-capi", {
      body: {
        event_name,
        event_id: opts.event_id ?? uuid(),
        value: opts.value,
        currency: opts.currency,
        custom_data: opts.custom_data,
        device_id: getDeviceId(),
        app_user_id: getStored(APP_USER_ID_KEY),
        email: getStored(EMAIL_KEY),
        fbc: getStored(FBC_KEY),
        fbp: getStored(FBP_KEY),
        action_source: "app",
        app_data: getAppData(),
      },
    });
  } catch {
    /* fire-and-forget */
  }
}

export function metaTrackAppOpen(): void {
  void trackMetaCapi("fb_mobile_activate_app");
}

/** Fires Install (`fb_mobile_first_app_launch`) exactly once per device. */
export function metaTrackInstallOnce(): void {
  try {
    if (localStorage.getItem(INSTALL_FIRED_KEY) === "1") return;
    localStorage.setItem(INSTALL_FIRED_KEY, "1");
  } catch { /* ignore */ }
  void trackMetaCapi("fb_mobile_first_app_launch");
}

export function metaTrackViewContent(contentId?: string, contentName?: string): void {
  void trackMetaCapi("ViewContent", {
    custom_data: {
      ...(contentId ? { content_ids: [contentId] } : {}),
      ...(contentName ? { content_name: contentName } : {}),
    },
  });
}

export function metaTrackInitiateCheckout(value: number, currency: string, productId?: string): void {
  void trackMetaCapi("InitiateCheckout", {
    value,
    currency,
    custom_data: productId ? { content_ids: [productId] } : undefined,
  });
}

// Purchase is intentionally NOT sent from the app — the RevenueCat webhook
// is the single Purchase sender to Meta (avoids duplicate/trial Purchases).


export function metaTrackSubscribe(value: number, currency: string, productId?: string): string {
  const event_id = uuid();
  void trackMetaCapi("Subscribe", {
    value,
    currency,
    event_id,
    custom_data: productId ? { content_ids: [productId] } : undefined,
  });
  return event_id;
}
