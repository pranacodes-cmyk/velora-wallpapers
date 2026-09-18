package com.velora.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;

import org.json.JSONObject;

import java.util.Calendar;

/**
 * Prayer alarm scheduling logic, extracted 1:1 from the old Capacitor
 * {@code PrayerAlarmPlugin} so the boot receiver and the Flutter
 * MethodChannel bridge share exactly the same behaviour, prefs keys and
 * request codes (existing installs keep their scheduled bells).
 */
public final class PrayerAlarmScheduler {

    private PrayerAlarmScheduler() {}

    static final String PREFS = "prayer_alarms";
    static final String KEY_TIMES_JSON = "times_json";
    static final String KEY_SOUND = "sound_enabled";
    static final int BASE_REQUEST_CODE = 9100;
    static final int BASE_BACKUP_REQUEST_CODE = 9300;

    public static int scheduleFromPrefs(Context ctx) {
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

    public static void cancelAllInternal(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        org.json.JSONArray saved = null;
        try {
            String json = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_TIMES_JSON, null);
            if (json != null) saved = new org.json.JSONArray(json);
        } catch (Exception ignored) { /* corrupt prefs */ }
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

    static boolean canUseExactAlarms(AlarmManager am) {
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
