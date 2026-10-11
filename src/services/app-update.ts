import { Capacitor } from "@capacitor/core";
import { AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus } from "@capawesome/capacitor-app-update";

// Show flexible (background download + snackbar-style) update on Android.
// Falls back to immediate update for builds that are very stale.
const STALENESS_IMMEDIATE_DAYS = 30; // force update prompt after this
const SNOOZE_KEY = "app_update_snoozed_until";
const SNOOZE_HOURS = 24;

export async function checkForAppUpdate() {
  try {
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

    const info = await AppUpdate.getAppUpdateInfo();
    if (info.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return;

    const daysStale = info.clientVersionStalenessDays ?? 0;
    const forceImmediate = daysStale >= STALENESS_IMMEDIATE_DAYS;

    if (forceImmediate && info.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate();
      return;
    }

    // Respect snooze for flexible flow
    const snoozedUntil = Number(localStorage.getItem(SNOOZE_KEY) || 0);
    if (Date.now() < snoozedUntil) return;

    if (info.flexibleUpdateAllowed) {
      await AppUpdate.startFlexibleUpdate();
      const sub = await AppUpdate.addListener("onFlexibleUpdateStateChange", async (state) => {
        if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
          try { await AppUpdate.completeFlexibleUpdate(); } catch {}
          sub.remove();
        } else if (
          state.installStatus === FlexibleUpdateInstallStatus.FAILED ||
          state.installStatus === FlexibleUpdateInstallStatus.CANCELED
        ) {
          localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_HOURS * 3600 * 1000));
          sub.remove();
        }
      });
    } else if (info.immediateUpdateAllowed) {
      await AppUpdate.performImmediateUpdate();
    }
  } catch (e) {
    // Plugin only works on Play Store builds — silently ignore elsewhere
  }
}
