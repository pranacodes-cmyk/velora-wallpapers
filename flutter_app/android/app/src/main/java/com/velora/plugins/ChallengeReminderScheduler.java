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
 * 75 Days of Light reminders (morning "today's day is ready", evening and
 * night nudges only while the day is not lit). Dart computes the next few
 * days of reminders with localized copy; this class just arms them.
 * Own prefs + request codes, separate from the daily reminder and the alarm.
 */
public final class ChallengeReminderScheduler {

    private ChallengeReminderScheduler() {}

    static final String PREFS = "challenge_reminder";
    static final String KEY_ITEMS = "items_json";
    static final String KEY_CHANNEL = "channel_json";
    static final int BASE_CODE = 9700;
    static final int MAX = 12;

    public static void save(Context ctx, String itemsJson, String channelJson) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString(KEY_ITEMS, itemsJson == null ? "[]" : itemsJson)
                .putString(KEY_CHANNEL, channelJson == null ? "{}" : channelJson)
                .apply();
    }

    static String channelCopy(Context ctx, String key, String fallback) {
        String raw = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CHANNEL, "{}");
        try {
            String v = new JSONObject(raw == null ? "{}" : raw).optString(key, "").trim();
            return v.isEmpty() ? fallback : v;
        } catch (Exception ignored) {
            return fallback;
        }
    }

    public static int scheduleFromPrefs(Context ctx) {
        cancelAll(ctx);
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_ITEMS, null);
        if (json == null) return 0;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;
        long now = System.currentTimeMillis();
        int count = 0;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length() && i < MAX; i++) {
                JSONObject o = arr.getJSONObject(i);
                long at = o.optLong("at", 0);
                if (at <= now) continue;
                PendingIntent pi = pending(ctx, i, o.optString("title", ""), o.optString("body", ""),
                        o.optString("route", "/challenge"), PendingIntent.FLAG_UPDATE_CURRENT);
                boolean done = false;
                try {
                    if (PrayerAlarmScheduler.canUseExactAlarms(am) && Build.VERSION.SDK_INT >= 23) {
                        am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                        done = true;
                    }
                } catch (SecurityException ignored) { /* fall back to inexact */ }
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
        for (int i = 0; i < MAX; i++) {
            PendingIntent pi = pending(ctx, i, "", "", "", PendingIntent.FLAG_NO_CREATE);
            if (pi != null) am.cancel(pi);
        }
    }

    private static PendingIntent pending(Context ctx, int i, String title, String body, String route, int baseFlags) {
        Intent intent = new Intent(ctx, ChallengeReminderReceiver.class);
        intent.setAction(ChallengeReminderReceiver.ACTION_FIRE);
        intent.putExtra("title", title);
        intent.putExtra("body", body);
        intent.putExtra("route", route);
        int flags = baseFlags | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, BASE_CODE + i, intent, flags);
    }
}
