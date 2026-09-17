import { registerPlugin } from "@capacitor/core";

export type NotificationPermissionStatus = "granted" | "denied" | "prompt";

export interface NativeNotificationDiagnostics {
  ok?: boolean;
  error?: string;
  sdk?: number;
  packageName?: string;
  permission?: NotificationPermissionStatus;
  notificationsEnabled?: boolean;
  channelExists?: boolean;
  channelImportance?: number;
  channelBlocked?: boolean;
  exactAlarmPermissionInManifest?: boolean;
  canPost?: boolean;
  scheduledAt?: number;
  seconds?: number;
}

export interface NotificationPermissionPlugin {
  check(): Promise<{ status: NotificationPermissionStatus }>;
  request(): Promise<{ status: NotificationPermissionStatus }>;
  openSettings(): Promise<void>;
  diagnose(): Promise<NativeNotificationDiagnostics>;
  showTestNow(): Promise<NativeNotificationDiagnostics>;
  scheduleTestInSeconds(options: { seconds: number }): Promise<NativeNotificationDiagnostics>;
}

class NotificationPermissionWeb implements NotificationPermissionPlugin {
  async check() {
    return { status: "prompt" as const };
  }
  async request() {
    return { status: "prompt" as const };
  }
  async openSettings() {
    /* no-op on web */
  }
  async diagnose() {
    return { ok: false, error: "Native Android only", canPost: false };
  }
  async showTestNow() {
    return { ok: false, error: "Native Android only", canPost: false };
  }
  async scheduleTestInSeconds() {
    return { ok: false, error: "Native Android only", canPost: false };
  }
}

export const NotificationPermission = registerPlugin<NotificationPermissionPlugin>(
  "NotificationPermission",
  { web: () => Promise.resolve(new NotificationPermissionWeb()) }
);
