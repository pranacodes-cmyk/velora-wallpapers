package com.velora.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Calendar;

/**
 * Daily content push scheduling — 1:1 port of the old Capacitor
 * {@code ContentPushPlugin} statics (same prefs, request codes and slot URIs)
 * so existing installs keep their armed alarms. The Flutter side reaches this
 * through {@code ContentPushChannel}; the boot receiver calls it directly.
 */
public final class ContentPushScheduler {

    private ContentPushScheduler() {}

    static final String PREFS = "prayly_content_push";
    static final String KEY_CONFIG = "config_json";
    static final String KEY_ENABLED = "enabled";
    private static final int BASE_RC = 8200;
    private static final int MAX_SLOTS = 8;

    /** 11:00 Verse (only when no Journey is active) · 12:30 Quiz · 18:00 Quiz.
     *  With the 07:00 + 21:00 Journey reminders this caps a day at 4. */
    static JSONArray defaultConfig() {
        JSONArray a = new JSONArray();
        try {
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_VERSE).put("hour", 11).put("minute", 0));
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_QUIZ).put("hour", 12).put("minute", 30));
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_QUIZ).put("hour", 18).put("minute", 0));
        } catch (Exception ignored) { /* never fails */ }
        return a;
    }

    public static boolean isEnabled(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ENABLED, false);
    }

    public static int ensureEnabledAndScheduled(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putBoolean(KEY_ENABLED, true)
                .putString(KEY_CONFIG, defaultConfig().toString()).apply();
        cancelAllInternal(ctx);
        return scheduleFromPrefs(ctx);
    }

    public static void disable(Context ctx) {
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit().putBoolean(KEY_ENABLED, false).apply();
        cancelAllInternal(ctx);
    }

    /**
     * Startup-safe repair: never cancel/recreate on every launch (AlarmManager
     * churn during first interaction caused ANRs). Arm defaults on first
     * install, otherwise only re-arm when every PendingIntent is gone.
     */
    public static int repairScheduleIfNeeded(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_CONFIG, null);
        if (!sp.getBoolean(KEY_ENABLED, false) || json == null) {
            sp.edit().putBoolean(KEY_ENABLED, true)
                    .putString(KEY_CONFIG, defaultConfig().toString()).apply();
            return scheduleFromPrefs(ctx);
        }
        // Retired slots (Companion, old evening Journey): migrate once.
        String fresh = defaultConfig().toString();
        if (!fresh.equals(json)) {
            cancelAllInternal(ctx);
            sp.edit().putString(KEY_CONFIG, fresh).apply();
            return scheduleFromPrefs(ctx);
        }
        return hasAnyArmedAlarm(ctx, json) ? 0 : scheduleFromPrefs(ctx);
    }

    static int scheduleFromPrefs(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (!sp.getBoolean(KEY_ENABLED, false)) return 0;
        String json = sp.getString(KEY_CONFIG, null);
        if (json == null) return 0;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return 0;
        cancelAllInternal(ctx);
        int count = 0;
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                String kind = t.optString("kind", ContentPushReceiver.KIND_VERSE);
                int h = t.optInt("hour", 8);
                int m = t.optInt("minute", 0);
                long at = nextOccurrenceMillis(h, m);

                Intent intent = new Intent(ctx, ContentPushReceiver.class);
                intent.setAction(ContentPushReceiver.ACTION_FIRE);
                intent.putExtra("kind", kind);
                intent.setData(Uri.parse("praylypush://" + kind + "/" + h + ":" + m));

                int flags = PendingIntent.FLAG_UPDATE_CURRENT
                        | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_RC + i, intent, flags);

                // Content nudges are not alarm-clock events: use the lighter
                // wakeup path. Prayer bells keep the exact/alarm-clock path.
                setBestEffortWakeup(am, at, pi);
                count++;
            }
        } catch (Exception ignored) { /* corrupt config */ }
        return count;
    }

    static void cancelAllInternal(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        JSONArray arr;
        try {
            String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_CONFIG, null);
            arr = json != null ? new JSONArray(json) : defaultConfig();
        } catch (Exception e) {
            arr = defaultConfig();
        }
        for (int i = 0; i < MAX_SLOTS; i++) {
            cancelPending(ctx, am, i, null);
            try {
                if (i < arr.length()) {
                    JSONObject t = arr.getJSONObject(i);
                    String kind = t.optString("kind", ContentPushReceiver.KIND_VERSE);
                    int h = t.optInt("hour", 8);
                    int m = t.optInt("minute", 0);
                    cancelPending(ctx, am, i, Uri.parse("praylypush://" + kind + "/" + h + ":" + m));
                }
            } catch (Exception ignored) { /* keep cancelling */ }
        }
    }

    /** Manual QA safety net for device clock changes near a slot. */
    public static void fireCurrentSlotForTimeChange(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_CONFIG, defaultConfig().toString());
        Calendar now = Calendar.getInstance();
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                Calendar slot = Calendar.getInstance();
                slot.set(Calendar.HOUR_OF_DAY, t.optInt("hour", 8));
                slot.set(Calendar.MINUTE, t.optInt("minute", 0));
                slot.set(Calendar.SECOND, 0);
                slot.set(Calendar.MILLISECOND, 0);
                long delta = now.getTimeInMillis() - slot.getTimeInMillis();
                if (delta < -5 * 60 * 1000L || delta > 10 * 60 * 1000L) continue;

                Intent intent = new Intent(ctx, ContentPushReceiver.class);
                intent.setAction(ContentPushReceiver.ACTION_FIRE);
                intent.putExtra("kind", t.optString("kind", ContentPushReceiver.KIND_VERSE));
                intent.putExtra(ContentPushReceiver.EXTRA_BYPASS_GUARDS, true);
                ctx.sendBroadcast(intent);
                return;
            }
        } catch (Exception ignored) { /* corrupt config */ }
    }

    static boolean hasAnyArmedAlarm(Context ctx, String json) {
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                if (armedPendingIntent(ctx, i, t) != null) return true;
            }
        } catch (Exception ignored) { /* corrupt config */ }
        return false;
    }

    public static PendingIntent armedPendingIntent(Context ctx, int slot, JSONObject t) {
        String kind = t.optString("kind", ContentPushReceiver.KIND_VERSE);
        int h = t.optInt("hour", 8);
        int m = t.optInt("minute", 0);
        Intent probe = new Intent(ctx, ContentPushReceiver.class);
        probe.setAction(ContentPushReceiver.ACTION_FIRE);
        probe.setData(Uri.parse("praylypush://" + kind + "/" + h + ":" + m));
        int flags = PendingIntent.FLAG_NO_CREATE
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getBroadcast(ctx, BASE_RC + slot, probe, flags);
    }

    private static void cancelPending(Context ctx, AlarmManager am, int slot, Uri data) {
        Intent intent = new Intent(ctx, ContentPushReceiver.class);
        intent.setAction(ContentPushReceiver.ACTION_FIRE);
        if (data != null) intent.setData(data);
        int flags = PendingIntent.FLAG_NO_CREATE
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_RC + slot, intent, flags);
        if (pi != null) {
            am.cancel(pi);
            pi.cancel();
        }
    }

    private static void setBestEffortWakeup(AlarmManager am, long at, PendingIntent pi) {
        if (Build.VERSION.SDK_INT >= 23) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
            am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    public static long nextOccurrenceMillis(int hour, int minute) {
        Calendar c = Calendar.getInstance();
        c.set(Calendar.HOUR_OF_DAY, hour);
        c.set(Calendar.MINUTE, minute);
        c.set(Calendar.SECOND, 0);
        c.set(Calendar.MILLISECOND, 0);
        if (c.getTimeInMillis() <= System.currentTimeMillis()) {
            c.add(Calendar.DAY_OF_YEAR, 1);
        }
        return c.getTimeInMillis();
    }
}
