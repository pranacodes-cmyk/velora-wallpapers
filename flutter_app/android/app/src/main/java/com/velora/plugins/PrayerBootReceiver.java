package com.velora.plugins;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** Re-schedules all prayer alarms + content pushes after reboot or app update. */
public class PrayerBootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        String a = intent.getAction();
        if (Intent.ACTION_BOOT_COMPLETED.equals(a)
                || Intent.ACTION_MY_PACKAGE_REPLACED.equals(a)
                || Intent.ACTION_TIME_CHANGED.equals(a)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(a)
                || "android.intent.action.LOCKED_BOOT_COMPLETED".equals(a)
                || "android.intent.action.QUICKBOOT_POWERON".equals(a)) {
            final BroadcastReceiver.PendingResult pending = goAsync();
            final Context appContext = context.getApplicationContext();
            new Thread(() -> {
                try {
                    PrayerAlarmScheduler.scheduleFromPrefs(appContext);
                    try {
                        DailyReminderScheduler.scheduleFromPrefs(appContext);
                    } catch (Throwable ignored) { /* best-effort */ }
                    try {
                        ContentPushScheduler.scheduleFromPrefs(appContext);
                    } catch (Throwable ignored) { /* pushes are best-effort */ }
                } finally {
                    pending.finish();
                }
            }, "prayer-boot-reschedule").start();
        }
    }
}
