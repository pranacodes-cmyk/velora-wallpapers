package com.velora.plugins;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

import com.jesuswallpaperbible.app.R;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Locale;

/**
 * Fires when an AlarmManager prayer alarm goes off.
 *
 * Behaviour:
 *
 *  • Screen OFF / device locked → launch the full-screen majestic
 *    {@link PrayerAlarmActivity} directly. No notification is posted, so
 *    there is exactly one sound source (the activity's MediaPlayer).
 *
 *  • Screen ON / device unlocked & in active use → post a high-priority
 *    heads-up alarm using a custom Prayly dark/gold card. The bell sound is
 *    the channel sound.
 *
 *  • Always reschedules tomorrow's occurrence from stored prefs.
 *
 *  Action intents:
 *   - ACTION_SNOOZE  → cancel notification + reschedule +10 min
 *   - ACTION_DISMISS → just cancel the notification (silences sound)
 *   - ACTION_PRAY    → cancel + open MainActivity on /devotional?from=alarm
 */
public class PrayerAlarmReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "com.velora.prayer.FIRE";
    public static final String ACTION_SNOOZE = "com.velora.prayer.SNOOZE";
    public static final String ACTION_DISMISS = "com.velora.prayer.DISMISS";
    public static final String ACTION_PRAY = "com.velora.prayer.PRAY";

    /** Heads-up channel WITH bell sound (used when screen is on). */
    private static final String CHANNEL_SOUND = "prayer_alarm_sound_v2";
    /** Full-screen channel WITHOUT notification sound; the activity plays the bell. */
    private static final String CHANNEL_SILENT = "prayer_alarm_fullscreen_v2";
    private static final int NOTIF_ID = 9710;

    public static final String ACTION_NOOP_SHOW = "com.velora.prayer.NOOP_SHOW";

    /** Remembers the last FIRE timestamp to dedupe within a 90s window. */
    private static long lastFireAt = 0L;
    private static String lastFireLabel = "";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();

        if (ACTION_NOOP_SHOW.equals(action)) {
            // setAlarmClock show-intent stub — intentionally does nothing.
            return;
        }

        final BroadcastReceiver.PendingResult pending = goAsync();
        final Context appContext = context.getApplicationContext();
        final Intent safeIntent = new Intent(intent);
        new Thread(() -> {
            try {
                handleReceive(appContext, safeIntent);
            } finally {
                pending.finish();
            }
        }, "prayer-alarm-receiver").start();
    }

    private void handleReceive(Context context, Intent intent) {
        String action = intent.getAction();
        String label = intent.getStringExtra("label");
        if (label == null) label = "Prayer Time";
        boolean sound = intent.getBooleanExtra("sound", true);

        if (ACTION_DISMISS.equals(action)) {
            cancelNotification(context);
            return;
        }

        if (ACTION_PRAY.equals(action)) {
            cancelNotification(context);
            openAppToPrayer(context);
            return;
        }

        if (ACTION_SNOOZE.equals(action)) {
            cancelNotification(context);
            scheduleSnooze(context, label, sound);
            return;
        }

        // Default: ACTION_FIRE — dedupe against duplicate broadcasts that some
        // OEM ROMs deliver (one from setAlarmClock, one from the AlarmManager
        // stack). Without this, the bell can ring twice in quick succession.
        long now = System.currentTimeMillis();
        if (label.equals(lastFireLabel) && (now - lastFireAt) < 90_000L) {
            return;
        }
        lastFireAt = now;
        lastFireLabel = label;

        boolean locked = isDeviceLocked(context);

        if (locked) {
            // Android 14+ restricts USE_FULL_SCREEN_INTENT — relying on the FSI
            // alone leaves users with sound only and no visual. Alarm-category
            // apps (we declare CATEGORY_ALARM + SCHEDULE_EXACT_ALARM) are
            // allowed to start activities from the background when the keyguard
            // is showing, so we launch the takeover directly. The notification
            // is posted silently as a safety net for OEMs that block the start.
            ensureAlarmChannel(context, CHANNEL_SILENT, false);
            postFullScreenAlarm(context, label, false, false, formatAlarmTime(intent));
            try {
                Intent activity = new Intent(context, PrayerAlarmActivity.class);
                activity.putExtra("label", label);
                activity.putExtra("sound", sound);
                activity.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_CLEAR_TOP
                        | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
                context.startActivity(activity);
            } catch (Exception ignored) { /* FSI fallback handles it */ }
        } else {
            // When the phone is in use, the heads-up notification rings the
            // bell. If Android promotes it to full-screen, the activity opens
            // silently so the user never hears two bells.
            ensureAlarmChannel(context, CHANNEL_SOUND, sound);
            postFullScreenAlarm(context, label, sound, false, formatAlarmTime(intent));
        }

        // Reschedule tomorrow's occurrences from stored config off the receiver
        // main thread; AlarmManager/PendingIntent binder work must not delay
        // input dispatch while the lock-screen UI is being launched.
        final Context appContext = context.getApplicationContext();
        try { PrayerAlarmScheduler.scheduleFromPrefs(appContext); } catch (Exception ignored) {}
    }

    private boolean isDeviceLocked(Context ctx) {
        try {
            android.app.KeyguardManager km = (android.app.KeyguardManager)
                    ctx.getSystemService(Context.KEYGUARD_SERVICE);
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            boolean screenOff = pm != null && !pm.isInteractive();
            boolean keyguard = km != null && km.isKeyguardLocked();
            return screenOff || keyguard;
        } catch (Exception ignored) {
            return false;
        }
    }

    // --------- channel ---------

    private void ensureAlarmChannel(Context ctx, String channelId, boolean sound) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        if (nm.getNotificationChannel(channelId) != null) return;

        NotificationChannel ch = new NotificationChannel(
                channelId,
                CHANNEL_SILENT.equals(channelId) ? "Prayer Alarm" : "Prayer Bell",
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Daily prayer reminder bells.");
        ch.enableLights(true);
        ch.setLightColor(Color.parseColor("#E8C56B"));
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{ 0, 400, 800, 400, 800, 400, 1200 });
        ch.setBypassDnd(false);
        ch.setShowBadge(true);
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

        if (sound) {
            try {
                Uri bell = Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/divine_bell");
                AudioAttributes attrs = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                ch.setSound(bell, attrs);
            } catch (Exception ignored) {
                ch.setSound(null, null);
            }
        } else {
            ch.setSound(null, null);
        }
        nm.createNotificationChannel(ch);
    }

    private void postFullScreenAlarm(Context ctx, String label, boolean notificationSound, boolean activitySound, String displayTime) {
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);

        // Full-screen takeover activity (works while screen is on AND locked,
        // because it's launched through setFullScreenIntent rather than
        // directly from this background receiver).
        Intent alarmActivity = new Intent(ctx, PrayerAlarmActivity.class);
        alarmActivity.putExtra("label", label);
        alarmActivity.putExtra("sound", activitySound);
        alarmActivity.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_NO_USER_ACTION);
        PendingIntent fullScreenPi = PendingIntent.getActivity(
                ctx, 9715, alarmActivity, piFlags);

        // Tap-anywhere = "Pray" — opens devotional inside the app.
        Intent prayBroadcast = new Intent(ctx, PrayerAlarmReceiver.class);
        prayBroadcast.setAction(ACTION_PRAY);
        prayBroadcast.setData(Uri.parse("prayer://pray"));
        PendingIntent prayPi = PendingIntent.getBroadcast(ctx, 9714, prayBroadcast, piFlags);

        // Close action — just dismiss (stops channel sound).
        Intent closeIntent = new Intent(ctx, PrayerAlarmReceiver.class);
        closeIntent.setAction(ACTION_DISMISS);
        closeIntent.setData(Uri.parse("prayer://dismiss"));
        PendingIntent closePi = PendingIntent.getBroadcast(ctx, 9713, closeIntent, piFlags);

        RemoteViews alarmView = new RemoteViews(ctx.getPackageName(), R.layout.prayer_alarm_notification);
        alarmView.setTextViewText(R.id.prayer_alarm_time, displayTime);
        alarmView.setTextViewText(R.id.prayer_alarm_title, label);
        alarmView.setTextViewText(R.id.prayer_alarm_subtitle, "A quiet moment with Jesus is ready");
        alarmView.setOnClickPendingIntent(R.id.prayer_alarm_close, closePi);
        alarmView.setOnClickPendingIntent(R.id.prayer_alarm_pray, prayPi);

        NotificationCompat.Builder b = new NotificationCompat.Builder(
                ctx, notificationSound ? CHANNEL_SOUND : CHANNEL_SILENT)
                .setSmallIcon(R.drawable.ic_stat_cross)
                .setColor(Color.parseColor("#E8C56B"))
                .setContentTitle(label)
                .setContentText("A quiet moment with Jesus is ready")
                .setSubText("Prayly")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOngoing(false)
                .setContentIntent(prayPi)
                .setCustomContentView(alarmView)
                .setCustomHeadsUpContentView(alarmView)
                .setCustomBigContentView(alarmView)
                .setStyle(new NotificationCompat.DecoratedCustomViewStyle())
                // THE key bit: tells the OS to launch the alarm activity
                // immediately even if the user is mid-use of another app.
                .setFullScreenIntent(fullScreenPi, true);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.notify(NOTIF_ID, b.build());
    }

    private String formatAlarmTime(Intent intent) {
        int hour = intent.getIntExtra("hour", -1);
        int minute = intent.getIntExtra("minute", -1);
        Calendar c = Calendar.getInstance();
        if (hour >= 0 && minute >= 0) {
            c.set(Calendar.HOUR_OF_DAY, hour);
            c.set(Calendar.MINUTE, minute);
        }
        return new SimpleDateFormat("H:mm", Locale.getDefault()).format(c.getTime());
    }

    private void cancelNotification(Context ctx) {
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(NOTIF_ID);
    }

    private void openAppToPrayer(Context ctx) {
        try {
            Intent i = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
            if (i == null) return;
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                    | Intent.FLAG_ACTIVITY_CLEAR_TOP
                    | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            i.putExtra("open_route", "/devotional?from=alarm");
            ctx.startActivity(i);
        } catch (Exception ignored) { /* ignore */ }
    }

    private void scheduleSnooze(Context ctx, String label, boolean sound) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            Intent intent = new Intent(ctx, PrayerAlarmReceiver.class);
            intent.setAction(ACTION_FIRE);
            intent.putExtra("label", label);
            intent.putExtra("sound", sound);
            intent.setData(Uri.parse("prayer://snooze-fire"));
            int flags = PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pi = PendingIntent.getBroadcast(ctx, 9777, intent, flags);
            long at = System.currentTimeMillis() + 10 * 60 * 1000L;
            if (Build.VERSION.SDK_INT >= 23) {
                am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } else {
                am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Exception ignored) { /* ignore */ }
    }
}
