package com.velora.plugins;

import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.capacitorjs.plugins.localnotifications.TimedNotificationPublisher;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;


/**
 * Schedules daily content pushes (Morning Verse, Noon Quiz, Companion,
 * Evening Priest) via AlarmManager. These are heads-up/banner reminders;
 * prayer bells alone use the full-screen alarm path.
 */
@CapacitorPlugin(name = "ContentPushPlugin")
public class ContentPushPlugin extends Plugin {

    private static final String PREFS = "prayly_content_push";
    static final String KEY_CONFIG = "config_json";
    static final String KEY_ENABLED = "enabled";
    private static final String KEY_LEGACY_CLEANUP_DONE = "legacy_cleanup_done_v2";
    private static final int BASE_RC = 8200;
    private static final int MAX_SLOTS = 8;

    /** Default schedule: 8:00 Verse · 12:30 Quiz · 15:00 Companion · 20:00 Priest.
     *  Morning Verse is spaced an hour after the 7:00 prayer bell so they don't stack. */
    private static JSONArray defaultConfig() {
        JSONArray a = new JSONArray();
        try {
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_VERSE).put("hour", 8).put("minute", 0));
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_QUIZ).put("hour", 12).put("minute", 30));
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_COMPANION).put("hour", 15).put("minute", 0));
            a.put(new JSONObject().put("kind", ContentPushReceiver.KIND_JOURNEY).put("hour", 20).put("minute", 0));
        } catch (Exception ignored) { /* default JSON build never fails */ }
        return a;
    }

    @PluginMethod
    public void enable(PluginCall call) {
        Context ctx = getContext();
        new Thread(() -> {
            int n = ensureEnabledAndScheduled(ctx.getApplicationContext());
            JSObject res = new JSObject(); res.put("scheduled", n); call.resolve(res);
        }, "content-push-enable").start();
    }

    @PluginMethod
    public void disable(PluginCall call) {
        Context ctx = getContext();
        new Thread(() -> {
            SharedPreferences sp = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            sp.edit().putBoolean(KEY_ENABLED, false).apply();
            cancelAllInternal(ctx.getApplicationContext());
            JSObject res = new JSObject(); res.put("ok", true); call.resolve(res);
        }, "content-push-disable").start();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSObject res = new JSObject();
        res.put("enabled", sp.getBoolean(KEY_ENABLED, false));
        call.resolve(res);
    }

    @PluginMethod
    public void preview(PluginCall call) {
        String kind = call.getString("kind", ContentPushReceiver.KIND_VERSE);
        Intent i = new Intent(getContext(), ContentPushReceiver.class);
        i.setAction(ContentPushReceiver.ACTION_FIRE);
        i.putExtra("kind", kind);
        i.putExtra(ContentPushReceiver.EXTRA_BYPASS_GUARDS, true);
        getContext().sendBroadcast(i);
        JSObject res = new JSObject(); res.put("ok", true); call.resolve(res);
    }

    /** JS calls this on app foreground so the receiver can suppress nudges
     *  while the user is actively in the app. */
    @PluginMethod
    public void markAppOpen(PluginCall call) {
        ContentPushReceiver.recordAppOpen(getContext());
        JSObject res = new JSObject(); res.put("ok", true); call.resolve(res);
    }

    /** Mirror the JS premium flag into a SharedPreference the receiver can read
     *  at fire-time. Pro users skip the morning verse push (they already have
     *  the auto-updating Daily Verse wallpaper) and get a tighter daily cap. */
    @PluginMethod
    public void setProMode(PluginCall call) {
        boolean pro = call.getBoolean("pro", false);
        getContext().getSharedPreferences(ContentPushReceiver.PREFS_PRO, Context.MODE_PRIVATE)
                .edit().putBoolean(ContentPushReceiver.K_PRO_MODE, pro).apply();
        JSObject res = new JSObject(); res.put("ok", true); res.put("pro", pro); call.resolve(res);
    }

    /** Build marker — bump whenever the native push code changes so the app
     *  can prove on-device that the latest Java actually shipped. */
    public static final String NATIVE_BUILD_TAG = "push-2026-06-15-headsup-card-v5-clean-fsi";

    /** One-shot diagnostic — returns hard facts about why notifications
     *  may or may not be appearing. Surface this in admin UI; do NOT guess. */
    @PluginMethod
    public void diagnostics(PluginCall call) {
        Context ctx = getContext();
        JSObject res = new JSObject();
        res.put("buildTag", NATIVE_BUILD_TAG);
        res.put("sdkInt", Build.VERSION.SDK_INT);
        res.put("manufacturer", Build.MANUFACTURER);
        res.put("model", Build.MODEL);

        NotificationManagerCompat nmc = NotificationManagerCompat.from(ctx);
        res.put("notificationsEnabled", nmc.areNotificationsEnabled());

        boolean postPerm = true;
        if (Build.VERSION.SDK_INT >= 33) {
            postPerm = ContextCompat.checkSelfPermission(ctx, "android.permission.POST_NOTIFICATIONS")
                    == android.content.pm.PackageManager.PERMISSION_GRANTED;
        }
        res.put("postNotificationsGranted", postPerm);

        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        boolean exact = true;
        if (Build.VERSION.SDK_INT >= 31 && am != null) {
            try { exact = am.canScheduleExactAlarms(); } catch (Throwable ignored) {}
        }
        res.put("canScheduleExactAlarms", exact);

        PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
        boolean ignoringBatt = false;
        if (pm != null && Build.VERSION.SDK_INT >= 23) {
            try { ignoringBatt = pm.isIgnoringBatteryOptimizations(ctx.getPackageName()); } catch (Throwable ignored) {}
        }
        res.put("ignoringBatteryOptimizations", ignoringBatt);

        // Channel inspection
        JSONArray channels = new JSONArray();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= 26) {
            String[] expected = new String[] {
                "prayly_verse_v9", "prayly_quiz_v9", "prayly_companion_v9", "prayly_journey_v9"
            };
            for (String id : expected) {
                JSONObject c = new JSONObject();
                try {
                    c.put("id", id);
                    NotificationChannel ch = nm.getNotificationChannel(id);
                    c.put("exists", ch != null);
                    if (ch != null) {
                        c.put("importance", ch.getImportance());
                        c.put("blocked", ch.getImportance() == NotificationManager.IMPORTANCE_NONE);
                        c.put("hasSound", ch.getSound() != null);
                        c.put("lockscreenVisibility", ch.getLockscreenVisibility());
                    }
                } catch (Exception ignored) {}
                channels.put(c);
            }
        }
        res.put("channels", channels);

        // Schedule snapshot
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        res.put("enabledPref", sp.getBoolean(KEY_ENABLED, false));
        String json = sp.getString(KEY_CONFIG, null);
        JSONArray nextSlots = new JSONArray();
        SimpleDateFormat fmt = new SimpleDateFormat("EEE HH:mm", Locale.US);
        try {
            JSONArray arr = json != null ? new JSONArray(json) : defaultConfig();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                int h = t.optInt("hour", 8);
                int m = t.optInt("minute", 0);
                long at = nextOccurrenceMillis(h, m);
                JSONObject s = new JSONObject();
                s.put("kind", t.optString("kind"));
                s.put("hour", h);
                s.put("minute", m);
                s.put("nextAt", at);
                s.put("nextHuman", fmt.format(new Date(at)));
                // probe for an existing pending intent
                int flags = PendingIntent.FLAG_NO_CREATE
                        | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
                Intent probe = new Intent(ctx, ContentPushReceiver.class);
                probe.setAction(ContentPushReceiver.ACTION_FIRE);
                probe.setData(Uri.parse("praylypush://" + t.optString("kind") + "/" + h + ":" + m));
                PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_RC + i, probe, flags);
                s.put("alarmArmed", pi != null);
                nextSlots.put(s);
            }
        } catch (Exception ignored) {}
        res.put("nextSlots", nextSlots);

        // Guard counters
        SharedPreferences guard = ctx.getSharedPreferences("prayly_content_push_guard", Context.MODE_PRIVATE);
        res.put("dailyCapCount", guard.getInt("cap_count", 0));
        res.put("dailyCapDay", guard.getInt("cap_day", -1));
        res.put("lastAppOpenAt", guard.getLong("last_app_open_at", 0L));

        call.resolve(res);
    }


    // ====== shared ======

    public static int ensureEnabledAndScheduled(Context ctx) {
        cleanupLegacyLocalNotifications(ctx);
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putBoolean(KEY_ENABLED, true)
                .putString(KEY_CONFIG, defaultConfig().toString()).apply();
        cancelAllInternal(ctx);
        return scheduleFromPrefs(ctx);
    }

    /**
     * Startup-safe repair path. Do NOT cancel/recreate alarms on every app
     * launch: that Binder/AlarmManager churn was happening during first user
     * interaction and matches Play Console nativePollOnce/input-dispatch ANRs.
     * Only arm defaults on first install or repair if all expected PendingIntents
     * are missing (for example after a force-stop/app-data restore edge case).
     */
    public static int repairScheduleIfNeeded(Context ctx) {
        cleanupLegacyLocalNotifications(ctx);
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_CONFIG, null);
        if (!sp.getBoolean(KEY_ENABLED, false) || json == null) {
            sp.edit().putBoolean(KEY_ENABLED, true)
                    .putString(KEY_CONFIG, defaultConfig().toString()).apply();
            return scheduleFromPrefs(ctx);
        }
        return hasAnyArmedAlarm(ctx, json) ? 0 : scheduleFromPrefs(ctx);
    }

    /**
     * Manual QA safety net: after the user changes device time near a content
     * slot, Android fires TIME_SET. Do not rely on waiting for AlarmManager in
     * manual clock tests: if the new clock is from 5 minutes before through 10
     * minutes after a configured slot, post immediately and bypass guardrails.
     */
    public static void fireCurrentSlotForTimeChange(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_CONFIG, defaultConfig().toString());
        Calendar now = Calendar.getInstance();
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                int h = t.optInt("hour", 8);
                int m = t.optInt("minute", 0);
                Calendar slot = Calendar.getInstance();
                slot.set(Calendar.HOUR_OF_DAY, h);
                slot.set(Calendar.MINUTE, m);
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
        } catch (Exception ignored) { /* corrupt config — ignore */ }
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

                // Content nudges are not user-visible alarm-clock events. Using
                // setAlarmClock() for four daily marketing pushes wakes the app
                // at foreground priority and can create input-dispatch ANRs on
                // low-end phones when several SDKs/WebView resume together.
                // Prayer bells keep setAlarmClock(); content pushes use the
                // lighter wakeup path.
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
            SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String json = sp.getString(KEY_CONFIG, null);
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
            } catch (Exception ignored) { /* keep cancelling remaining slots */ }
        }
    }

    private static boolean hasAnyArmedAlarm(Context ctx, String json) {
        try {
            JSONArray arr = new JSONArray(json);
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                String kind = t.optString("kind", ContentPushReceiver.KIND_VERSE);
                int h = t.optInt("hour", 8);
                int m = t.optInt("minute", 0);
                Intent probe = new Intent(ctx, ContentPushReceiver.class);
                probe.setAction(ContentPushReceiver.ACTION_FIRE);
                probe.setData(Uri.parse("praylypush://" + kind + "/" + h + ":" + m));
                int flags = PendingIntent.FLAG_NO_CREATE
                        | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_RC + i, probe, flags);
                if (pi != null) return true;
            }
        } catch (Exception ignored) { /* corrupt config: repair */ }
        return false;
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

    private static void cleanupLegacyLocalNotifications(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (sp.getBoolean(KEY_LEGACY_CLEANUP_DONE, false)) return;
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        int[] ids = new int[30];
        ids[0] = 7001;
        ids[1] = 7002;
        for (int i = 0; i < 14; i++) {
            ids[2 + i] = 8000 + i;
            ids[16 + i] = 9000 + i;
        }
        for (int id : ids) {
            try {
                Intent intent = new Intent(ctx, TimedNotificationPublisher.class);
                int flags = PendingIntent.FLAG_NO_CREATE
                        | (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0);
                PendingIntent pi = PendingIntent.getBroadcast(ctx, id, intent, flags);
                if (pi != null) {
                    if (am != null) am.cancel(pi);
                    pi.cancel();
                }
                if (nm != null) nm.cancel(id);
            } catch (Exception ignored) { /* best-effort legacy cleanup */ }
        }
        sp.edit().putBoolean(KEY_LEGACY_CLEANUP_DONE, true).apply();
    }

    private static long nextOccurrenceMillis(int hour, int minute) {
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
