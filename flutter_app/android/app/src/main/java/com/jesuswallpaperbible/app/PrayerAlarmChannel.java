package com.jesuswallpaperbible.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationManagerCompat;

import com.velora.plugins.PrayerAlarmActivity;
import com.velora.plugins.PrayerAlarmReceiver;
import com.velora.plugins.PrayerAlarmScheduler;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * MethodChannel bridge for the prayer reminder alarms. Same methods, payloads
 * and return shapes as the old Capacitor {@code PrayerAlarmPlugin}, so the
 * Dart side (`prayer_alarm_service.dart`) is a 1:1 replacement for the web
 * hook.
 */
public class PrayerAlarmChannel implements MethodChannel.MethodCallHandler {

    public static final String CHANNEL = "com.jesuswallpaperbible.app/prayer_alarm";

    private static final String PREFS = "prayer_alarms";
    private static final String KEY_TIMES_JSON = "times_json";
    private static final String KEY_SOUND = "sound_enabled";
    private static final int BASE_REQUEST_CODE = 9100;
    private static final int BASE_BACKUP_REQUEST_CODE = 9300;

    private final Activity activity;

    public PrayerAlarmChannel(Activity activity) {
        this.activity = activity;
    }

    private Context ctx() {
        return activity.getApplicationContext();
    }

    @Override
    public void onMethodCall(MethodCall call, MethodChannel.Result result) {
        switch (call.method) {
            case "getStatus":
                result.success(getStatus());
                break;
            case "scheduleAll":
                scheduleAll(call, result);
                break;
            case "cancelAll":
                cancelAll(result);
                break;
            case "preview":
                preview(call, result);
                break;
            case "openExactAlarmSettings":
                result.success(opened(openExactAlarmSettings()));
                break;
            case "openNotificationSettings":
                result.success(opened(openNotificationSettings()));
                break;
            case "openOverlaySettings":
                result.success(opened(openOverlaySettings()));
                break;
            case "openFullScreenIntentSettings":
                result.success(opened(openFullScreenIntentSettings()));
                break;
            case "consumeOpenRoute":
                // Route stashed by MainActivity from a notification/alarm
                // launch ("open_route"); drained once by the Dart shell.
                result.success(MainActivity.takePendingRoute());
                break;
            case "dailyReminderSync": {
                Boolean en = call.argument("enabled");
                String times = call.argument("times");
                Integer streak = call.argument("streak");
                String copy = call.argument("copy");
                com.velora.plugins.DailyReminderScheduler.save(ctx(), en != null && en,
                        times == null ? "[]" : times, streak == null ? 0 : streak,
                        copy == null ? "{}" : copy);
                result.success(com.velora.plugins.DailyReminderScheduler.scheduleFromPrefs(ctx()));
                break;
            }
            case "streakSync": {
                Integer s = call.argument("streak");
                String last = call.argument("lastDate");
                com.velora.plugins.DailyReminderScheduler.saveStreak(ctx(), s == null ? 0 : s, last);
                result.success(true);
                break;
            }
            case "dailyReminderPreview": {
                Intent i = new Intent(ctx(), com.velora.plugins.DailyReminderActivity.class);
                String slot = call.argument("slot");
                i.putExtra("slot", slot == null ? "morning" : slot);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                try { activity.startActivity(i); result.success(true); } catch (Exception e) { result.success(false); }
                break;
            }
            default:
                result.notImplemented();
        }
    }

    private Map<String, Object> opened(boolean ok) {
        Map<String, Object> res = new HashMap<>();
        res.put("opened", ok);
        return res;
    }

    // ── status ───────────────────────────────────────────────────────────────
    private Map<String, Object> getStatus() {
        Context ctx = ctx();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

        boolean exactOk = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            exactOk = am != null && am.canScheduleExactAlarms();
        }
        boolean notifOk = NotificationManagerCompat.from(ctx).areNotificationsEnabled();
        // Alarms use FULL_SCREEN_INTENT, not overlays — always allowed.
        boolean overlayOk = true;

        boolean fsiOk = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            try { fsiOk = nm != null && nm.canUseFullScreenIntent(); }
            catch (Throwable ignored) { fsiOk = true; }
        }

        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        JSONArray saved = null;
        try {
            String json = sp.getString(KEY_TIMES_JSON, null);
            if (json != null) saved = new JSONArray(json);
        } catch (Exception ignored) { /* corrupt prefs */ }

        int count = 0;
        try {
            for (int i = 0; i < 16; i++) {
                int flags = PendingIntent.FLAG_NO_CREATE;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;

                Intent intent = new Intent(ctx, PrayerAlarmReceiver.class);
                intent.setAction("com.velora.prayer.FIRE");
                PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_REQUEST_CODE + i, intent, flags);

                PendingIntent legacyPi = null;
                if (saved != null && i < saved.length()) {
                    try {
                        JSONObject t = saved.getJSONObject(i);
                        Intent legacyIntent = new Intent(ctx, PrayerAlarmReceiver.class);
                        legacyIntent.setAction("com.velora.prayer.FIRE");
                        legacyIntent.setData(Uri.parse("prayer://" + t.optInt("hour", 7) + ":" + t.optInt("minute", 0)));
                        legacyPi = PendingIntent.getBroadcast(ctx, BASE_REQUEST_CODE + i, legacyIntent, flags);
                    } catch (Exception ignored) { /* ignore one bad row */ }
                }

                Intent backupIntent = new Intent(ctx, PrayerAlarmReceiver.class);
                backupIntent.setAction("com.velora.prayer.FIRE");
                PendingIntent backupPi = PendingIntent.getBroadcast(ctx, BASE_BACKUP_REQUEST_CODE + i, backupIntent, flags);

                if (pi != null || legacyPi != null || backupPi != null) count++;
            }
        } catch (Exception ignored) { /* leave count = 0 */ }

        Map<String, Object> res = new HashMap<>();
        res.put("exactAlarmAllowed", exactOk);
        res.put("notificationsAllowed", notifOk);
        res.put("overlayAllowed", overlayOk);
        res.put("fullScreenIntentAllowed", fsiOk);
        res.put("canScheduleFullScreen", fsiOk);
        res.put("scheduledCount", count);
        return res;
    }

    // ── schedule / cancel ────────────────────────────────────────────────────
    @SuppressWarnings("unchecked")
    private void scheduleAll(MethodCall call, MethodChannel.Result result) {
        Object rawTimes = call.argument("times");
        Boolean soundArg = call.argument("soundEnabled");
        boolean sound = soundArg == null || soundArg;

        if (!(rawTimes instanceof List)) {
            result.error("bad_args", "times required", null);
            return;
        }

        JSONArray persist = new JSONArray();
        try {
            for (Object row : (List<Object>) rawTimes) {
                Map<String, Object> t = (Map<String, Object>) row;
                int h = t.get("hour") instanceof Number ? ((Number) t.get("hour")).intValue() : 7;
                int m = t.get("minute") instanceof Number ? ((Number) t.get("minute")).intValue() : 0;
                String label = t.get("label") instanceof String ? (String) t.get("label") : "Prayer";
                JSONObject o = new JSONObject();
                o.put("hour", h);
                o.put("minute", m);
                o.put("label", label);
                persist.put(o);
            }
        } catch (Exception e) {
            result.error("bad_args", "invalid times: " + e.getMessage(), null);
            return;
        }

        Context ctx = ctx();
        ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_TIMES_JSON, persist.toString())
                .putBoolean(KEY_SOUND, sound)
                .apply();

        new Thread(() -> {
            PrayerAlarmScheduler.cancelAllInternal(ctx);
            final int scheduled = PrayerAlarmScheduler.scheduleFromPrefs(ctx);
            activity.runOnUiThread(() -> result.success(scheduled));
        }, "prayer-alarm-schedule").start();
    }

    private void cancelAll(MethodChannel.Result result) {
        Context ctx = ctx();
        new Thread(() -> {
            PrayerAlarmScheduler.cancelAllInternal(ctx);
            ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().remove(KEY_TIMES_JSON).apply();
            activity.runOnUiThread(() -> result.success(true));
        }, "prayer-alarm-cancel").start();
    }

    private void preview(MethodCall call, MethodChannel.Result result) {
        String label = call.argument("label");
        Boolean soundArg = call.argument("soundEnabled");
        try {
            Intent i = new Intent(ctx(), PrayerAlarmActivity.class);
            i.putExtra("label", label == null ? "Prayer Time" : label);
            i.putExtra("sound", soundArg == null || soundArg);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            ctx().startActivity(i);
            result.success(true);
        } catch (Exception e) {
            result.success(false);
        }
    }

    // ── settings deep links ──────────────────────────────────────────────────
    private boolean openFullScreenIntentSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                i.setData(Uri.parse("package:" + ctx().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx().startActivity(i);
                return true;
            }
            return false;
        } catch (Exception e) {
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + ctx().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx().startActivity(i);
                return true;
            } catch (Exception ignored) {
                return false;
            }
        }
    }

    private boolean openOverlaySettings() {
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + ctx().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + ctx().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean openExactAlarmSettings() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                i.setData(Uri.parse("package:" + ctx().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                ctx().startActivity(i);
                return true;
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private boolean openNotificationSettings() {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, ctx().getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx().startActivity(i);
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
