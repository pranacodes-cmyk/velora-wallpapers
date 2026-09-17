import { Capacitor, registerPlugin } from "@capacitor/core";

export interface PrayerTime {
  /** 0-23 */ hour: number;
  /** 0-59 */ minute: number;
  /** "Morning Prayer", "Midday Prayer", etc. */ label: string;
}

export interface PrayerAlarmStatus {
  exactAlarmAllowed: boolean;
  notificationsAllowed: boolean;
  /** SYSTEM_ALERT_WINDOW — true when full-screen alarm can pop over other apps. */
  overlayAllowed: boolean;
  /** Android 14+ USE_FULL_SCREEN_INTENT grant. False → lock-screen visual is suppressed. */
  fullScreenIntentAllowed: boolean;
  canScheduleFullScreen: boolean;
  scheduledCount: number;
}

export interface PrayerAlarmPluginInterface {
  getStatus(): Promise<PrayerAlarmStatus>;
  openExactAlarmSettings(): Promise<{ opened: boolean }>;
  openNotificationSettings(): Promise<{ opened: boolean }>;
  /** Opens "Display over other apps" / "Appear on top" page so users can make
   *  full-screen alarms bulletproof on aggressive OEMs (Xiaomi, Vivo, etc.). */
  openOverlaySettings(): Promise<{ opened: boolean }>;
  /** Opens Android 14+ "Full screen notifications" settings page. */
  openFullScreenIntentSettings(): Promise<{ opened: boolean }>;
  scheduleAll(options: { times: PrayerTime[]; soundEnabled: boolean }): Promise<{ scheduled: number }>;
  cancelAll(): Promise<{ ok: boolean }>;
  preview(options: { label: string; soundEnabled: boolean }): Promise<{ ok: boolean }>;
}

const isNative = Capacitor.isNativePlatform();

const webStub: PrayerAlarmPluginInterface = {
  async getStatus() {
    return {
      exactAlarmAllowed: true,
      notificationsAllowed: true,
      overlayAllowed: false,
      fullScreenIntentAllowed: true,
      canScheduleFullScreen: true,
      scheduledCount: 0,
    };
  },
  async openExactAlarmSettings() { return { opened: false }; },
  async openNotificationSettings() { return { opened: false }; },
  async openOverlaySettings() { return { opened: false }; },
  async openFullScreenIntentSettings() { return { opened: false }; },
  async scheduleAll({ times }) { return { scheduled: times.length }; },
  async cancelAll() { return { ok: true }; },
  async preview() {
    // eslint-disable-next-line no-console
    console.info("[PrayerAlarm web preview] would launch full-screen alarm now.");
    return { ok: true };
  },
};

const PrayerAlarm = isNative
  ? registerPlugin<PrayerAlarmPluginInterface>("PrayerAlarmPlugin", { web: () => Promise.resolve(webStub as any) })
  : webStub;

export default PrayerAlarm;
