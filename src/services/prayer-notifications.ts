/**
 * Legacy LocalNotifications cleanup service
 *
 * Prayer bells now come from PrayerAlarmPlugin and rich Verse / Quiz /
 * Companion / Reflection banners now come from ContentPushPlugin.
 *
 * This file remains only to request/check notification permission and cancel
 * old normal verse-wallpaper notifications from previous builds.
 *
 * Native assets required:
 *  - android/app/src/main/res/raw/divine_bell.mp3
 *  - android/app/src/main/res/drawable/ic_stat_cross.png (24x24dp)
 */

import { Capacitor } from "@capacitor/core";
import { addAppLog } from "./app-logs";
import { NotificationPermission } from "@/lib/notificationPermissionPlugin";

// ID ranges: morning 8000+offset, evening 9000+offset (offset 0..13)
const MORNING_BASE_ID = 8000;
const EVENING_BASE_ID = 9000;
const DAYS_AHEAD = 14;

let notificationsModule: { plugin: any } | null = null;

async function loadModule() {
  if (notificationsModule) return notificationsModule;
  try {
    const mod = await import("@capacitor/local-notifications");
    notificationsModule = { plugin: mod.LocalNotifications };
    return notificationsModule;
  } catch (err) {
    addAppLog("error", "[Notifications] Plugin import failed", err);
    return null;
  }
}

const DENIED_KEY = "jw_notif_denied_at";
const PRIMER_SHOWN_KEY = "jw_notif_primer_shown";
const DENIAL_RETRY_MS = 4 * 24 * 60 * 60 * 1000;
const HOME_PROMPTED_KEY = "jw_notif_home_prompted";
const REPROMPT_DISMISSED_KEY = "jw_notif_reprompt_dismissed_at";

function markNotificationDeniedCooldown() {
  try {
    const now = String(Date.now());
    localStorage.setItem(DENIED_KEY, now);
    localStorage.setItem(HOME_PROMPTED_KEY, now);
    localStorage.setItem(REPROMPT_DISMISSED_KEY, now);
  } catch {}
}

function isNotificationDeniedCoolingDown() {
  try {
    const deniedAt = Number(localStorage.getItem(DENIED_KEY) || 0);
    const promptedAt = Number(localStorage.getItem(HOME_PROMPTED_KEY) || 0);
    const dismissedAt = Number(localStorage.getItem(REPROMPT_DISMISSED_KEY) || 0);
    const lastTouchAt = Math.max(deniedAt, promptedAt, dismissedAt);
    return Boolean(lastTouchAt && Date.now() - lastTouchAt < DENIAL_RETRY_MS);
  } catch {
    return false;
  }
}

export async function getNotificationPermissionStatus(): Promise<"granted" | "denied" | "prompt" | "unavailable"> {
  if (!Capacitor.isNativePlatform()) return "unavailable";

  if (Capacitor.getPlatform() === "android") {
    try {
      const r = await NotificationPermission.check();
      if (r.status === "granted") return "granted";
      if (r.status === "denied") return "denied";
      return "prompt";
    } catch {
      // fall through to LocalNotifications
    }
  }

  const LocalNotificationsModule = await loadModule();
  const LocalNotifications = LocalNotificationsModule?.plugin;
  if (!LocalNotifications) return "unavailable";
  try {
    const p = await LocalNotifications.checkPermissions();
    if (p.display === "granted") return "granted";
    if (p.display === "denied") return "denied";
    return "prompt";
  } catch {
    return "unavailable";
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    addAppLog("info", "[Notifications] Web platform, skipping permission request");
    return false;
  }

  // On Android, use the native plugin directly — this triggers the system dialog reliably on Android 13+.
  if (Capacitor.getPlatform() === "android") {
    try {
      const current = await NotificationPermission.check();
      if (current.status === "granted") return true;
      const result = await NotificationPermission.request();
      addAppLog("info", "[Notifications] Android permission result", result);
      const granted = result.status === "granted";
      if (!granted) {
        markNotificationDeniedCooldown();
      } else {
        try {
          localStorage.removeItem(DENIED_KEY);
          localStorage.removeItem(REPROMPT_DISMISSED_KEY);
        } catch {}
      }
      return granted;
    } catch (err) {
      addAppLog("error", "[Notifications] Android native permission failed", err);
      return false;
    }
  }

  const LocalNotificationsModule = await loadModule();
  const LocalNotifications = LocalNotificationsModule?.plugin;
  if (!LocalNotifications) return false;

  try {
    const permission = await LocalNotifications.checkPermissions();
    if (permission.display === "granted") return true;

    const result = await LocalNotifications.requestPermissions();
    addAppLog("info", "[Notifications] Permission result", result);
    const granted = result.display === "granted";
    if (!granted) {
      markNotificationDeniedCooldown();
    } else {
      try {
        localStorage.removeItem(DENIED_KEY);
        localStorage.removeItem(REPROMPT_DISMISSED_KEY);
      } catch {}
    }
    return granted;
  } catch (err) {
    addAppLog("error", "[Notifications] Permission request failed", err);
    return false;
  }
}

export async function shouldShowHomeNotificationPrimer(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const status = await getNotificationPermissionStatus();
  if (status === "granted" || status === "unavailable") return false;
  if (isNotificationDeniedCoolingDown()) return false;

  return true;
}

/**
 * Whether the in-app primer should be shown.
 * Show after denial, then wait 4 days before asking again.
 */
export async function shouldShowNotificationPrimer(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  const status = await getNotificationPermissionStatus();
  if (status !== "denied") return false;
  return !isNotificationDeniedCoolingDown();
}

/**
 * First app-home prompt: ask Android directly. If denied, UI should show the
 * beautiful primer and the CTA can trigger one more native permission request.
 */
export async function requestHomeNotificationPermission(): Promise<"granted" | "denied" | "skipped"> {
  try { localStorage.setItem(HOME_PROMPTED_KEY, String(Date.now())); } catch {}

  const status = await getNotificationPermissionStatus();
  if (status === "granted") {
    await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
    return "granted";
  }
  if (status === "unavailable") return "skipped";

  if (status === "denied") {
    return (await shouldShowNotificationPrimer()) ? "denied" : "skipped";
  }

  const granted = await requestNotificationPermission();
  if (granted) {
    await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
    return "granted";
  }
  return "denied";
}

export function markNotificationPrimerShown() {
  try {
    localStorage.setItem(PRIMER_SHOWN_KEY, String(Date.now()));
    localStorage.setItem(HOME_PROMPTED_KEY, String(Date.now()));
  } catch {}
}

export async function scheduleDailyPrayerNotifications(options?: { skipPermissionRequest?: boolean }): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    addAppLog("info", "[Notifications] Web platform, skipping schedule");
    return;
  }

  const LocalNotificationsModule = await loadModule();
  const LocalNotifications = LocalNotificationsModule?.plugin;
  if (!LocalNotifications) return;

  if (options?.skipPermissionRequest) {
    const status = await getNotificationPermissionStatus();
    if (status !== "granted") {
      addAppLog("info", "[Notifications] Permission not granted yet — skipping legacy cleanup");
      return;
    }
  } else {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      addAppLog("warn", "[Notifications] No permission, cannot clean up legacy notifications");
      return;
    }
  }

  try {
    // Legacy cleanup only. Real prayer bells are now handled by PrayerAlarmPlugin
    // and rich content banners are handled by ContentPushPlugin. Do NOT schedule
    // the old normal verse-wallpaper notifications anymore.
    const pending = await LocalNotifications.getPending();
    const existingIds = pending.notifications
      .filter((n: any) => {
        const id = Number(n.id);
        return (
          id === 7001 ||
          id === 7002 ||
          (id >= MORNING_BASE_ID && id < MORNING_BASE_ID + DAYS_AHEAD) ||
          (id >= EVENING_BASE_ID && id < EVENING_BASE_ID + DAYS_AHEAD)
        );
      })
      .map((n: any) => ({ id: n.id }));

    if (existingIds.length > 0) {
      await LocalNotifications.cancel({ notifications: existingIds });
    }

    addAppLog("info", `[Notifications] Removed ${existingIds.length} legacy normal notifications; native prayer/content system remains active`);
  } catch (err) {
    addAppLog("error", "[Notifications] Legacy cleanup failed", err);
  }
}

/**
 * Register a tap handler that routes the user to the right screen
 * (e.g. /daily-verse) when they tap a scheduled prayer notification.
 * Safe to call multiple times — only the first registration sticks.
 */
let tapListenerRegistered = false;
export async function registerNotificationTapHandler(
  navigate: (path: string) => void,
): Promise<void> {
  if (tapListenerRegistered) return;
  if (!Capacitor.isNativePlatform()) return;

  const LocalNotificationsModule = await loadModule();
  const LocalNotifications = LocalNotificationsModule?.plugin;
  if (!LocalNotifications) return;

  try {
    await LocalNotifications.addListener(
      "localNotificationActionPerformed",
      (event: any) => {
        const route =
          event?.notification?.extra?.route ||
          event?.notification?.schedule?.extra?.route;
        if (typeof route === "string" && route.startsWith("/")) {
          // Defer to next tick so React Router is ready after cold-start.
          setTimeout(() => navigate(route), 0);
        }
      },
    );
    tapListenerRegistered = true;
    addAppLog("info", "[Notifications] Tap handler registered");
  } catch (err) {
    addAppLog("error", "[Notifications] Tap handler registration failed", err);
  }
}

/**
 * Create the notification channel on Android.
 * Must be called once during app init (before scheduling).
 */
export async function createPrayerChannel(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  // createChannel / getPending only exist on Android. Calling them on iOS threw
  // "LocalNotifications.then() is not implemented on ios" noise into analytics.
  if (Capacitor.getPlatform() !== "android") return;

  const LocalNotificationsModule = await loadModule();
  const LocalNotifications = LocalNotificationsModule?.plugin;
  if (!LocalNotifications) return;

  try {
    await LocalNotifications.createChannel({
      id: "prayer_reminders",
      name: "Daily Prayer Reminders",
      description: "Morning and evening prayer notifications",
      importance: 4, // HIGH
      visibility: 1, // PUBLIC
      sound: "divine_bell.mp3",
      vibration: true,
      lights: true,
      lightColor: "#FFD700",
    });
    addAppLog("info", "[Notifications] Prayer channel created");
  } catch (err) {
    addAppLog("error", "[Notifications] Channel creation failed", err);
  }
}

/**
  * Full init: create channel + clean up legacy normal notifications.
 * Call once on app startup.
 */
export async function initPrayerNotifications(): Promise<void> {
  await createPrayerChannel();
  // Don't trigger system permission dialog on launch — let the in-app primer ask.
  // Only re-schedule if permission was already granted in a previous session.
  await scheduleDailyPrayerNotifications({ skipPermissionRequest: true });
}

/**
 * One-time cleanup: if a prior version recorded a denial timestamp before the
 * primer ever had a chance to show, clear it so the primer can appear now.
 */
export function resetNotificationPrimerIfStale() {
  try {
    const primerShown = localStorage.getItem(PRIMER_SHOWN_KEY);
    if (!primerShown) {
      localStorage.removeItem(DENIED_KEY);
      localStorage.removeItem(HOME_PROMPTED_KEY);
    }
  } catch {}
}
