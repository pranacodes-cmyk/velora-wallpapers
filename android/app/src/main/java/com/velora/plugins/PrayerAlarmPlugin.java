package com.velora.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.app.NotificationManagerCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * Schedules daily prayer reminder alarms using AlarmManager.setAlarmClock —
 * the strongest tier that survives Doze and shows a clock icon in the status
 * bar. Each alarm fires PrayerAlarmReceiver which launches the full-screen
 * PrayerAlarmActivity over the lock screen.
 */
@CapacitorPlugin(name = "PrayerAlarmPlugin")
public class PrayerAlarmPlugin extends Plugin {

    private static final String PREFS = "prayer_alarms";
    static final String KEY_TIMES_JSON = "times_json";
    static final String KEY_SOUND = "sound_enabled";
    private static final int BASE_REQUEST_CODE = 9100;
    private static final int BASE_BACKUP_REQUEST_CODE = 9300;

    @PluginMethod
    public void getStatus(PluginCall call) {
        Context ctx = getContext();
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);

        boolean exactOk = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            exactOk = am != null && am.canScheduleExactAlarms();
        }
        boolean notifOk = NotificationManagerCompat.from(ctx).areNotificationsEnabled();

        // SYSTEM_ALERT_WINDOW removed — alarms use FULL_SCREEN_INTENT, not overlays.
        // Downstream JS keeps the field for API stability; always report allowed.
        boolean overlayOk = true;

        // Android 14 (API 34) restricts USE_FULL_SCREEN_INTENT — even with
        // CATEGORY_ALARM the system can refuse to launch the lock-screen
        // takeover unless the user explicitly grants it in Settings →
        // "Full screen notifications". This was the reason prayer bells
        // only made sound on the lock screen with no visual.
        boolean fsiOk = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            try { fsiOk = nm != null && nm.canUseFullScreenIntent(); }
            catch (Throwable ignored) { fsiOk = true; }
        }

        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        org.json.JSONArray saved = null;
        try {
            String json = sp.getString(KEY_TIMES_JSON, null);
            if (json != null) saved = new org.json.JSONArray(json);
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

        JSObject res = new JSObject();
        res.put("exactAlarmAllowed", exactOk);
        res.put("notificationsAllowed", notifOk);
        res.put("overlayAllowed", overlayOk);
        res.put("fullScreenIntentAllowed", fsiOk);
        res.put("canScheduleFullScreen", fsiOk);
        res.put("scheduledCount", count);
        call.resolve(res);
    }

    @PluginMethod
    public void openFullScreenIntentSettings(PluginCall call) {
        JSObject res = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                Intent i = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                res.put("opened", true);
            } else {
                res.put("opened", false);
            }
        } catch (Exception e) {
            // Fallback to app details if the dedicated screen is unavailable.
            try {
                Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                res.put("opened", true);
            } catch (Exception ignored) {
                res.put("opened", false);
            }
        }
        call.resolve(res);
    }

    @PluginMethod
    public void openOverlaySettings(PluginCall call) {
        JSObject res = new JSObject();
        try {
            Intent i;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                i = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getContext().getPackageName()));
            } else {
                i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        Uri.parse("package:" + getContext().getPackageName()));
            }
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            res.put("opened", true);
        } catch (Exception e) {
            res.put("opened", false);
        }
        call.resolve(res);
    }

    @PluginMethod
    public void openExactAlarmSettings(PluginCall call) {
        JSObject res = new JSObject();
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                Intent i = new Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM);
                i.setData(Uri.parse("package:" + getContext().getPackageName()));
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                res.put("opened", true);
            } else {
                res.put("opened", false);
            }
        } catch (Exception e) {
            res.put("opened", false);
        }
        call.resolve(res);
    }

    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        JSObject res = new JSObject();
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
            i.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            res.put("opened", true);
        } catch (Exception e) {
            res.put("opened", false);
        }
        call.resolve(res);
    }

    @PluginMethod
    public void scheduleAll(PluginCall call) {
        Context ctx = getContext();
        JSArray timesArr = call.getArray("times");
        boolean sound = call.getBoolean("soundEnabled", true);
        if (timesArr == null) { call.reject("times required"); return; }

        List<int[]> parsed = new ArrayList<>();
        org.json.JSONArray persist = new org.json.JSONArray();
        try {
            for (int i = 0; i < timesArr.length(); i++) {
                JSONObject t = timesArr.getJSONObject(i);
                int h = t.optInt("hour", 7);
                int m = t.optInt("minute", 0);
                String label = t.optString("label", "Prayer");
                parsed.add(new int[]{ h, m });
                JSONObject o = new JSONObject();
                o.put("hour", h); o.put("minute", m); o.put("label", label);
                persist.put(o);
            }
        } catch (Exception e) { call.reject("invalid times: " + e.getMessage()); return; }

        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        sp.edit().putString(KEY_TIMES_JSON, persist.toString()).putBoolean(KEY_SOUND, sound).apply();

        new Thread(() -> {
            cancelAllInternal(ctx.getApplicationContext());
            int scheduled = scheduleFromPrefs(ctx.getApplicationContext());

            JSObject res = new JSObject();
            res.put("scheduled", scheduled);
            call.resolve(res);
        }, "prayer-alarm-schedule").start();
    }

    @PluginMethod
    public void cancelAll(PluginCall call) {
        Context ctx = getContext();
        new Thread(() -> {
            cancelAllInternal(ctx.getApplicationContext());
            SharedPreferences sp = ctx.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            sp.edit().remove(KEY_TIMES_JSON).apply();
            JSObject res = new JSObject();
            res.put("ok", true);
            call.resolve(res);
        }, "prayer-alarm-cancel").start();
    }

    @PluginMethod
    public void preview(PluginCall call) {
        String label = call.getString("label", "Prayer Time");
        boolean sound = call.getBoolean("soundEnabled", true);
        Intent i = new Intent(getContext(), PrayerAlarmActivity.class);
        i.putExtra("label", label);
        i.putExtra("sound", sound);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        getContext().startActivity(i);
        JSObject res = new JSObject();
        res.put("ok", true);
        call.resolve(res);
    }

    // ====== shared helpers (also called from boot receiver) ======

    static int scheduleFromPrefs(Context ctx) {
        SharedPreferences sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String json = sp.getString(KEY_TIMES_JSON, null);
        boolean sound = sp.getBoolean(KEY_SOUND, true);
        if (json == null) return 0;
        int count = 0;
        try {
            org.json.JSONArray arr = new org.json.JSONArray(json);
            AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
            if (am == null) return 0;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                int h = t.optInt("hour", 7);
                int m = t.optInt("minute", 0);
                String label = t.optString("label", "Prayer");
                long triggerAt = nextOccurrenceMillis(h, m);

                Intent intent = new Intent(ctx, PrayerAlarmReceiver.class);
                intent.setAction("com.velora.prayer.FIRE");
                intent.putExtra("label", label);
                intent.putExtra("sound", sound);
                intent.putExtra("hour", h);
                intent.putExtra("minute", m);
                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
                PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_REQUEST_CODE + i, intent, flags);

                boolean scheduled = false;
                try {
                    if (canUseExactAlarms(am)) {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                        } else {
                            am.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pi);
                        }
                        scheduled = true;
                    }
                } catch (SecurityException ignored) { /* fall through */ }

                if (!scheduled) {
                    setBestEffortWakeup(am, triggerAt, pi);
                }
                count++;
            }
        } catch (Exception ignored) { /* ignore */ }
        return count;
    }

    static void cancelAllInternal(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        org.json.JSONArray saved = null;
        try {
            String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TIMES_JSON, null);
            if (json != null) saved = new org.json.JSONArray(json);
        } catch (Exception ignored) { /* corrupt prefs */ }
        // cancel up to 16 possible alarms
        for (int i = 0; i < 16; i++) {
            Intent intent = new Intent(ctx, PrayerAlarmReceiver.class);
            intent.setAction("com.velora.prayer.FIRE");
            int flags = PendingIntent.FLAG_NO_CREATE;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(ctx, BASE_REQUEST_CODE + i, intent, flags);
            if (pi != null) am.cancel(pi);

            if (saved != null && i < saved.length()) {
                try {
                    JSONObject t = saved.getJSONObject(i);
                    Intent legacyIntent = new Intent(ctx, PrayerAlarmReceiver.class);
                    legacyIntent.setAction("com.velora.prayer.FIRE");
                    legacyIntent.setData(Uri.parse("prayer://" + t.optInt("hour", 7) + ":" + t.optInt("minute", 0)));
                    PendingIntent legacyPi = PendingIntent.getBroadcast(ctx, BASE_REQUEST_CODE + i, legacyIntent, flags);
                    if (legacyPi != null) am.cancel(legacyPi);
                } catch (Exception ignored) { /* ignore one bad row */ }
            }

            Intent backupIntent = new Intent(ctx, PrayerAlarmReceiver.class);
            backupIntent.setAction("com.velora.prayer.FIRE");
            PendingIntent backupPi = PendingIntent.getBroadcast(ctx, BASE_BACKUP_REQUEST_CODE + i, backupIntent, flags);
            if (backupPi != null) am.cancel(backupPi);
        }
    }

    private static boolean canUseExactAlarms(AlarmManager am) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return true;
        try { return am.canScheduleExactAlarms(); }
        catch (Throwable ignored) { return true; }
    }

    private static void setBestEffortWakeup(AlarmManager am, long at, PendingIntent pi) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
        } else {
            am.set(AlarmManager.RTC_WAKEUP, at, pi);
        }
    }

    static long nextOccurrenceMillis(int hour, int minute) {
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
