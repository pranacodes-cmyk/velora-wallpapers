package com.velora.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Quiet daily prayer reminder (on by default). Completely separate from the
 * user-set Prayer Alarm: own prefs, own request codes, no sound, no vibration.
 * Uses inexact wakeups when the exact-alarm grant is missing, so no extra
 * permission is ever asked for.
 */
public final class DailyReminderScheduler {

    private DailyReminderScheduler() {}

    static final String PREFS = "daily_reminder";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_TIMES = "times_json";
    static final String KEY_STREAK = "streak";
    static final String KEY_COPY = "localized_copy";
    static final int BASE_CODE = 9500;

    static final String KEY_STREAK_LAST = "streak_last_date";

    public static void save(Context ctx, boolean enabled, String timesJson, int streak, String copyJson) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putBoolean(KEY_ENABLED, enabled)
                .putString(KEY_TIMES, timesJson)
                .putInt(KEY_STREAK, streak)
                .putString(KEY_COPY, copyJson)
                .apply();
    }

    /** Streak snapshot from Dart (current + yyyy-MM-dd of last prayed day). */
    public static void saveStreak(Context ctx, int streak, String lastDate) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putInt(KEY_STREAK, streak)
                .putString(KEY_STREAK_LAST, lastDate == null ? "" : lastDate)
                .apply();
    }

    /**
     * Live streak at the moment the alarm fires: if the last prayed day is
     * today or yesterday the streak is still alive, otherwise it's broken → 0.
     */
    public static int streak(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        int s = sp.getInt(KEY_STREAK, 0);
        String last = sp.getString(KEY_STREAK_LAST, "");
        if (last == null || last.isEmpty()) return s;
        java.text.SimpleDateFormat f = new java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US);
        java.util.Calendar c = java.util.Calendar.getInstance();
        String today = f.format(c.getTime());
        c.add(java.util.Calendar.DAY_OF_YEAR, -1);
        String yesterday = f.format(c.getTime());
        return (last.equals(today) || last.equals(yesterday)) ? s : 0;
    }

    public static String copy(Context ctx, String key, String fallback) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY_COPY, "{}");
        try {
            String value = new JSONObject(raw == null ? "{}" : raw).optString(key, "").trim();
            return value.isEmpty() ? fallback : value;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    /** Lock-screen chip text in the language last synced by Flutter. */
    public static String streakLabel(Context ctx) {
        int s = streak(ctx);
        if (s <= 0) return "\uD83D\uDD25  " + copy(ctx, "streak.start", "Start your streak today");
        String pattern = copy(ctx, "streak.count", "{{count}} day streak");
        return "\uD83D\uDD25  " + pattern.replace("{{count}}", String.valueOf(s));
    }

    public static int scheduleFromPrefs(Context ctx) {
        cancelAll(ctx);
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!sp.getBoolean(KEY_ENABLED, false)) return 0;
        String json = sp.getString(KEY_TIMES, null);
        if (json == null) return 0;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;
        int count = 0;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length() && i < 6; i++) {
                JSONObject t = arr.getJSONObject(i);
                int h = t.optInt("hour", 7);
                int m = t.optInt("minute", 0);
                long at = PrayerAlarmScheduler.nextOccurrenceMillis(h, m);
                PendingIntent pi = pending(ctx, i, h, m, t.optString("slot", "morning"),
                        PendingIntent.FLAG_UPDATE_CURRENT);
                boolean done = false;
                try {
                    if (PrayerAlarmScheduler.canUseExactAlarms(am) && Build.VERSION.SDK_INT >= 23) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                        done = true;
                    }
                } catch (SecurityException ignored) { /* fall back */ }
                if (!done) {
                    if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                    else am.set(AlarmManager.RTC_WAKEUP, at, pi);
                }
                count++;
            }
        } catch (Exception ignored) { /* corrupt prefs */ }
        return count;
    }

    public static void cancelAll(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        for (int i = 0; i < 6; i++) {
            PendingIntent pi = pending(ctx, i, 0, 0, "", PendingIntent.FLAG_NO_CREATE);
            if (pi != null) am.cancel(pi);
        }
    }

    private static PendingIntent pending(Context ctx, int i, int h, int m, String slot, int baseFlags) {
        Intent intent = new Intent(ctx, DailyReminderReceiver.class);
        intent.setAction(DailyReminderReceiver.ACTION_FIRE);
        intent.putExtra("hour", h);
        intent.putExtra("minute", m);
        intent.putExtra("slot", slot);
        int flags = baseFlags | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, BASE_CODE + i, intent, flags);
    }
}
