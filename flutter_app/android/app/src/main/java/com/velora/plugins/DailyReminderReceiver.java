package com.velora.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.jesuswallpaperbible.app.R;

/** Fires the quiet daily reminder: silent full-screen card, no sound, no vibration. */
public class DailyReminderReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "com.velora.reminder.FIRE";
    static final String CHANNEL = "daily_reminder_quiet_v1";
    static final int NOTIF_ID = 9810;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_FIRE.equals(intent.getAction())) return;
        Context app = context.getApplicationContext();
        String slot = intent.getStringExtra("slot");
        if (slot == null) slot = "morning";

        ensureChannel(app);

        Intent act = new Intent(app, DailyReminderActivity.class);
        act.putExtra("slot", slot);
        act.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent full = PendingIntent.getActivity(app, 9811, act, f);

        String title = "night".equals(slot)
                ? DailyReminderScheduler.copy(app, "notification.nightTitle", "Night Prayer")
                : DailyReminderScheduler.copy(app, "notification.morningTitle", "Morning Prayer");
        NotificationCompat.Builder b = new NotificationCompat.Builder(app, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_cross)
                .setColor(Color.parseColor("#E8C56B"))
                .setContentTitle(title)
                .setContentText(DailyReminderScheduler.copy(app, "notification.body",
                        "Relax, reflect and talk to God"))
                .setSubText("Prayly")
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setSilent(true)
                .setVibrate(null)
                .setAutoCancel(true)
                .setContentIntent(full)
                .setFullScreenIntent(full, true);
        NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        try { if (nm != null) nm.notify(NOTIF_ID, b.build()); } catch (Exception ignored) {}

        try {
            android.app.KeyguardManager km = (android.app.KeyguardManager) app.getSystemService(Context.KEYGUARD_SERVICE);
            android.os.PowerManager pm = (android.os.PowerManager) app.getSystemService(Context.POWER_SERVICE);
            boolean locked = (km != null && km.isKeyguardLocked()) || (pm != null && !pm.isInteractive());
            if (locked) app.startActivity(act);
        } catch (Exception ignored) { /* full-screen intent covers it */ }

        // Re-arm tomorrow's reminders.
        try { DailyReminderScheduler.scheduleFromPrefs(app); } catch (Exception ignored) {}
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL,
                DailyReminderScheduler.copy(ctx, "channel.name", "Daily Prayer Reminder"),
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(DailyReminderScheduler.copy(ctx, "channel.desc",
                "A quiet morning and night prayer card. No sound, no vibration."));
        ch.setSound(null, null);
        ch.enableVibration(false);
        ch.setVibrationPattern(new long[]{0});
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(ch);
    }
}
