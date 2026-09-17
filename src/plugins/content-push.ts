import { Capacitor, registerPlugin } from "@capacitor/core";

/**
 * Daily content pushes: Morning Verse (7:30), Noon Quiz (12:30),
 * Evening AI Priest (20:00). Heads-up notifications with custom Prayly card.
 */
export type ContentPushKind = "verse" | "quiz" | "companion" | "journey";

export interface PushDiagnostics {
  buildTag: string;
  sdkInt: number;
  manufacturer: string;
  model: string;
  notificationsEnabled: boolean;
  postNotificationsGranted: boolean;
  canScheduleExactAlarms: boolean;
  ignoringBatteryOptimizations: boolean;
  enabledPref: boolean;
  channels: Array<{ id: string; exists: boolean; importance?: number; blocked?: boolean; hasSound?: boolean; lockscreenVisibility?: number }>;
  nextSlots: Array<{ kind: string; hour: number; minute: number; nextAt: number; nextHuman: string; alarmArmed: boolean }>;
  dailyCapCount: number;
  dailyCapDay: number;
  lastAppOpenAt: number;
}

export interface ContentPushInterface {
  enable(): Promise<{ scheduled: number }>;
  disable(): Promise<{ ok: boolean }>;
  getStatus(): Promise<{ enabled: boolean }>;
  preview(opts: { kind: ContentPushKind }): Promise<{ ok: boolean }>;
  markAppOpen(): Promise<{ ok: boolean }>;
  setProMode(opts: { pro: boolean }): Promise<{ ok: boolean; pro: boolean }>;
  diagnostics(): Promise<PushDiagnostics>;
}

const webStub: ContentPushInterface = {
  async enable() { return { scheduled: 0 }; },
  async disable() { return { ok: true }; },
  async getStatus() { return { enabled: false }; },
  async preview() { return { ok: true }; },
  async markAppOpen() { return { ok: true }; },
  async setProMode({ pro }) { return { ok: true, pro }; },
  async diagnostics() {
    return {
      buildTag: "web-stub", sdkInt: 0, manufacturer: "web", model: "web",
      notificationsEnabled: false, postNotificationsGranted: false,
      canScheduleExactAlarms: false, ignoringBatteryOptimizations: false,
      enabledPref: false, channels: [], nextSlots: [],
      dailyCapCount: 0, dailyCapDay: -1, lastAppOpenAt: 0,
    };
  },
};


const ContentPush = Capacitor.isNativePlatform()
  ? registerPlugin<ContentPushInterface>("ContentPushPlugin", { web: () => Promise.resolve(webStub as any) })
  : webStub;

/** Auto-enable on app launch unless the user has explicitly opted out. */
const OPT_OUT_KEY = "prayly:contentPush:optOut:v1";
const FIRST_ENABLED_KEY = "prayly:contentPush:enabledOnce:v1";
const PREMIUM_KEY = "cw_premium_unlocked";

/** Mirror the JS premium flag into the native plugin so the push receiver
 *  can suppress redundant pushes (e.g. the morning verse push for Pro users
 *  who already have the auto-updating Daily Verse wallpaper). Safe to call
 *  on every premium change or app foreground. */
export async function syncProModeForPushes(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  let pro = false;
  try { pro = localStorage.getItem(PREMIUM_KEY) === "true"; } catch {}
  try { await ContentPush.setProMode({ pro }); } catch { /* noop */ }
}

export async function ensureContentPushesScheduled(): Promise<void> {
  const log = (...args: unknown[]) => { if (import.meta.env.DEV) console.log(...args); };
  if (!Capacitor.isNativePlatform()) {
    log("[ContentPush] skip: not native platform");
    return;
  }
  try {
    if (localStorage.getItem(OPT_OUT_KEY) === "1") {
      log("[ContentPush] skip: user opted out");
      return;
    }

    // Native MainActivity / boot receivers own AlarmManager scheduling now.
    // Do not call enable() from JS startup; it cancels/recreates alarms over the
    // Capacitor bridge while the WebView is still becoming interactive, which is
    // exactly the pattern behind MessageQueue.nativePollOnce input ANRs.
    localStorage.setItem(FIRST_ENABLED_KEY, "1");
    try { await syncProModeForPushes(); } catch { /* noop */ }
    try { await ContentPush.markAppOpen(); } catch { /* noop */ }

    // Also mark on every foreground + re-sync Pro state (purchases that happened
    // outside the app, restored RC entitlements, etc. should immediately quiet pushes).
    try {
      const { App } = await import("@capacitor/app");
      App.addListener("appStateChange", (s) => {
        if (s.isActive) {
          ContentPush.markAppOpen().catch(() => {});
          syncProModeForPushes().catch(() => {});
        }
      });
    } catch { /* @capacitor/app not installed — fine */ }
    // Re-sync immediately whenever usePremium fires a change in this session.
    try {
      window.addEventListener("cw:premium-change", () => {
        syncProModeForPushes().catch(() => {});
      });
    } catch { /* noop */ }
    // Expose a manual probe for QA — open devtools and run:
    //   window.__praylyTestPush('verse')   // fires immediately
    (window as any).__praylyTestPush = async (kind: ContentPushKind = "verse") => {
      log("[ContentPush] preview", kind);
      const out = await ContentPush.preview({ kind });
      log("[ContentPush] preview ->", out);
      return out;
    };
    (window as any).__praylyPushStatus = async () => {
      const s = await ContentPush.getStatus();
      log("[ContentPush] status", s);
      return s;
    };
  } catch (e) {
    if (import.meta.env.DEV) console.error("[ContentPush] schedule FAILED", e);
  }
}


export async function disableContentPushes(): Promise<void> {
  localStorage.setItem(OPT_OUT_KEY, "1");
  try { await ContentPush.disable(); } catch { /* noop */ }
}

export async function reenableContentPushes(): Promise<void> {
  localStorage.removeItem(OPT_OUT_KEY);
  try { await ContentPush.enable(); } catch { /* noop */ }
}

export default ContentPush;
