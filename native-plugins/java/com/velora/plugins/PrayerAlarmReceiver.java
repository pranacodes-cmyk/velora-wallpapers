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
    // New channel ID repairs devices where Android permanently cached the old
    // channel without sound. Notification-channel audio cannot be changed in place.
    private static final String CHANNEL_SOUND = "prayer_alarm_sound_v3";
    /** Full-screen channel WITHOUT notification sound; the activity plays the bell. */
    private static final String CHANNEL_SILENT = "prayer_alarm_fullscreen_v2";
    private static final int NOTIF_ID = 9710;

    /** Card swiped away without Pray/Dismiss → re-show after the gentle follow-up delay. */
    public static final String ACTION_SWIPED = "com.velora.prayer.SWIPED";
    /** Ignored or swiped bells return every 20 minutes until Pray or Dismiss. */
    private static final long FOLLOW_UP_MS = 20 * 60 * 1000L;
    /** Safety cap: at most 6 returns (~2 hours) so a forgotten bell never nags all day. */
    private static final int MAX_FOLLOW_UPS = 6;
    private static final int FOLLOW_UP_REQUEST_CODE = 9778;

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
        if (label == null) label = DailyReminderScheduler.copy(context, "alarm.defaultLabel", "Prayer Time");
        boolean sound = intent.getBooleanExtra("sound", true);

        int followUp = intent.getIntExtra("follow_up", 0);

        if (ACTION_SWIPED.equals(action)) {
            // Swipe is not a decision — the bell comes back in 20 minutes
            // (full-screen if the phone is locked by then).
            scheduleFollowUp(context, label, sound, intent.getIntExtra("hour", -1),
                    intent.getIntExtra("minute", -1), followUp);
            return;
        }

        if (ACTION_DISMISS.equals(action)) {
            cancelFollowUp(context);
            cancelNotification(context);
            return;
        }

        if (ACTION_PRAY.equals(action)) {
            cancelFollowUp(context);
            cancelNotification(context);
            openAppToPrayer(context);
            return;
        }

        if (ACTION_SNOOZE.equals(action)) {
            cancelFollowUp(context);
            cancelNotification(context);
            scheduleSnooze(context, label, sound);
            return;
        }

        // Default: ACTION_FIRE — dedupe against duplicate broadcasts that some
        // OEM ROMs deliver (one from setAlarmClock, one from the AlarmManager
        // stack). Without this, the bell can ring twice in quick succession.
        long now = System.currentTimeMillis();
        if (followUp == 0 && label.equals(lastFireLabel) && (now - lastFireAt) < 90_000L) {
            return;
        }
        lastFireAt = now;
        lastFireLabel = label;

        boolean locked = isDeviceLocked(context);
        int hour = intent.getIntExtra("hour", -1);
        int minute = intent.getIntExtra("minute", -1);
        // Arm the return trip immediately: if the card is ignored, swiped,
        // or killed by the OEM, the bell still comes back. Pray/Dismiss cancel it.
        scheduleFollowUp(context, label, sound, hour, minute, followUp);

        if (locked) {
            // Android 14+ restricts USE_FULL_SCREEN_INTENT — relying on the FSI
            // alone leaves users with sound only and no visual. Alarm-category
            // apps (we declare CATEGORY_ALARM + SCHEDULE_EXACT_ALARM) are
            // allowed to start activities from the background when the keyguard
            // is showing, so we launch the takeover directly. The notification
            // is posted silently as a safety net for OEMs that block the start.
            ensureAlarmChannel(context, CHANNEL_SILENT, false);
            postFullScreenAlarm(context, label, sound, false, false, formatAlarmTime(intent), hour, minute, followUp);
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
            postFullScreenAlarm(context, label, sound, sound, false, formatAlarmTime(intent), hour, minute, followUp);
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
                DailyReminderScheduler.copy(ctx, "alarm.channelName", "Prayer Bell"),
                NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription(DailyReminderScheduler.copy(ctx, "alarm.channelDesc", "Daily prayer reminder bells"));
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

    private void postFullScreenAlarm(Context ctx, String label, boolean bellEnabled, boolean notificationSound, boolean activitySound, String displayTime, int hour, int minute, int followUp) {
        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);

        // Full-screen takeover activity (works while screen is on AND locked,
        // because it's launched through setFullScreenIntent rather than
        // directly from this background receiver).
        Intent alarmActivity = new Intent(ctx, PrayerAlarmActivity.class);
        alarmActivity.putExtra("label", label);
        alarmActivity.putExtra("sound", activitySound);
        alarmActivity.putExtra("hour", hour);
        alarmActivity.putExtra("minute", minute);
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

        // Swipe-away → soft snooze (card returns in 20 minutes).
        Intent swipedIntent = new Intent(ctx, PrayerAlarmReceiver.class);
        swipedIntent.setAction(ACTION_SWIPED);
        swipedIntent.setData(Uri.parse("prayer://swiped"));
        swipedIntent.putExtra("label", label);
        swipedIntent.putExtra("sound", bellEnabled);
        swipedIntent.putExtra("hour", hour);
        swipedIntent.putExtra("minute", minute);
        swipedIntent.putExtra("follow_up", followUp);
        PendingIntent swipedPi = PendingIntent.getBroadcast(ctx, 9716, swipedIntent, piFlags);

        RemoteViews alarmView = new RemoteViews(ctx.getPackageName(), R.layout.prayer_alarm_notification);
        alarmView.setTextViewText(R.id.prayer_alarm_time, displayTime);
        alarmView.setTextViewText(R.id.prayer_alarm_title, label);
        String subtitle = DailyReminderScheduler.copy(ctx, "alarm.subtitle", "A quiet moment with Jesus is ready");
        alarmView.setTextViewText(R.id.prayer_alarm_subtitle, subtitle);
        alarmView.setTextViewText(R.id.prayer_alarm_close, DailyReminderScheduler.copy(ctx, "alarm.dismiss", "Dismiss"));
        alarmView.setTextViewText(R.id.prayer_alarm_pray, DailyReminderScheduler.copy(ctx, "alarm.openPrayer", "Open Prayer"));
        alarmView.setOnClickPendingIntent(R.id.prayer_alarm_close, closePi);
        alarmView.setOnClickPendingIntent(R.id.prayer_alarm_pray, prayPi);

        NotificationCompat.Builder b = new NotificationCompat.Builder(
                ctx, notificationSound ? CHANNEL_SOUND : CHANNEL_SILENT)
                .setSmallIcon(R.drawable.ic_stat_cross)
                .setColor(Color.parseColor("#E8C56B"))
                .setContentTitle(label)
                .setContentText(subtitle)
                .setSubText("Prayly")
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                // Ongoing: cannot be swiped on Android ≤13 and stays on the
                // lock screen. On 14+ a swipe is possible, so deleteIntent
                // turns it into a 20-minute soft snooze instead of losing it.
                .setAutoCancel(false)
                .setOngoing(true)
                .setDeleteIntent(swipedPi)
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

    private static PendingIntent followUpIntent(Context ctx, String label, boolean sound, int hour, int minute, int count, int extraFlags) {
        Intent intent = new Intent(ctx, PrayerAlarmReceiver.class);
        intent.setAction(ACTION_FIRE);
        intent.setData(Uri.parse("prayer://follow-up"));
        if (label != null) intent.putExtra("label", label);
        intent.putExtra("sound", sound);
        intent.putExtra("hour", hour);
        intent.putExtra("minute", minute);
        intent.putExtra("follow_up", count);
        int flags = extraFlags | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, FOLLOW_UP_REQUEST_CODE, intent, flags);
    }

    private static void scheduleFollowUp(Context ctx, String label, boolean sound, int hour, int minute, int currentCount) {
        if (currentCount >= MAX_FOLLOW_UPS) return;
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return;
            PendingIntent pi = followUpIntent(ctx, label, sound, hour, minute, currentCount + 1,
                    PendingIntent.FLAG_UPDATE_CURRENT);
            long at = System.currentTimeMillis() + FOLLOW_UP_MS;
            boolean exact = false;
            try {
                if (PrayerAlarmScheduler.canUseExactAlarms(am)) {
                    if (Build.VERSION.SDK_INT >= 23) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    else am.setExact(AlarmManager.RTC_WAKEUP, at, pi);
                    exact = true;
                }
            } catch (SecurityException ignored) { /* fall back */ }
            if (!exact) {
                if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.set(AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Exception ignored) { /* ignore */ }
    }

    /** Pray / Dismiss / Snooze are real decisions — stop the 20-minute return. */
    public static void cancelFollowUp(Context ctx) {
        try {
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            PendingIntent pi = followUpIntent(ctx, null, true, -1, -1, 0, PendingIntent.FLAG_NO_CREATE);
            if (am != null && pi != null) { am.cancel(pi); pi.cancel(); }
        } catch (Exception ignored) { /* ignore */ }
    }
}
