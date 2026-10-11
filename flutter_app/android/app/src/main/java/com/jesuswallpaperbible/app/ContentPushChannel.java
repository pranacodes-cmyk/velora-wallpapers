package com.jesuswallpaperbible.app;

import android.app.Activity;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.PowerManager;

import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.velora.plugins.ContentPushReceiver;
import com.velora.plugins.ContentPushScheduler;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * MethodChannel bridge for the daily content pushes (verse / quiz / companion
 * / journey). Same methods and payload shapes as the old Capacitor
 * {@code ContentPushPlugin}, so the Dart service is a 1:1 replacement for the
 * web `content-push.ts`.
 */
public class ContentPushChannel implements MethodChannel.MethodCallHandler {

    public static final String CHANNEL = "com.jesuswallpaperbible.app/content_push";

    private final Activity activity;

    public ContentPushChannel(Activity activity) {
        this.activity = activity;
    }

    private Context ctx() {
        return activity.getApplicationContext();
    }

    @Override
    public void onMethodCall(MethodCall call, MethodChannel.Result result) {
        final Context ctx = ctx();
        switch (call.method) {
            case "enable": {
                new Thread(() -> {
                    int n = ContentPushScheduler.ensureEnabledAndScheduled(ctx);
                    activity.runOnUiThread(() -> result.success(n));
                }, "content-push-enable").start();
                return;
            }
            case "repair": {
                new Thread(() -> {
                    int n = ContentPushScheduler.repairScheduleIfNeeded(ctx);
                    activity.runOnUiThread(() -> result.success(n));
                }, "content-push-repair").start();
                return;
            }
            case "disable": {
                new Thread(() -> {
                    ContentPushScheduler.disable(ctx);
                    activity.runOnUiThread(() -> result.success(true));
                }, "content-push-disable").start();
                return;
            }
            case "getStatus": {
                result.success(ContentPushScheduler.isEnabled(ctx));
                return;
            }
            case "preview": {
                String kind = call.argument("kind");
                if (kind == null) kind = ContentPushReceiver.KIND_VERSE;
                Intent i = new Intent(ctx, ContentPushReceiver.class);
                i.setAction(ContentPushReceiver.ACTION_FIRE);
                i.putExtra("kind", kind);
                i.putExtra(ContentPushReceiver.EXTRA_BYPASS_GUARDS, true);
                ctx.sendBroadcast(i);
                result.success(true);
                return;
            }
            case "markAppOpen": {
                ctx.getSharedPreferences(ContentPushReceiver.GUARD_PREFS, Context.MODE_PRIVATE)
                        .edit().putLong(ContentPushReceiver.K_LAST_OPEN, System.currentTimeMillis()).apply();
                result.success(true);
                return;
            }
            case "setProMode": {
                Boolean pro = call.argument("pro");
                ctx.getSharedPreferences(ContentPushReceiver.PREFS_PRO, Context.MODE_PRIVATE)
                        .edit().putBoolean(ContentPushReceiver.K_PRO_MODE, Boolean.TRUE.equals(pro)).apply();
                result.success(true);
                return;
            }
            case "diagnostics": {
                result.success(diagnostics(ctx));
                return;
            }
            default:
                result.notImplemented();
        }
    }

    private Map<String, Object> diagnostics(Context ctx) {
        Map<String, Object> res = new HashMap<>();
        res.put("sdkInt", Build.VERSION.SDK_INT);
        res.put("manufacturer", Build.MANUFACTURER);
        res.put("model", Build.MODEL);
        res.put("notificationsEnabled", NotificationManagerCompat.from(ctx).areNotificationsEnabled());

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
        res.put("enabledPref", ContentPushScheduler.isEnabled(ctx));

        List<Map<String, Object>> channels = new ArrayList<>();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null && Build.VERSION.SDK_INT >= 26) {
            String[] expected = { "prayly_verse_v9", "prayly_quiz_v9", "prayly_companion_v9", "prayly_journey_v9" };
            for (String id : expected) {
                Map<String, Object> c = new HashMap<>();
                c.put("id", id);
                NotificationChannel ch = nm.getNotificationChannel(id);
                c.put("exists", ch != null);
                if (ch != null) {
                    c.put("importance", ch.getImportance());
                    c.put("blocked", ch.getImportance() == NotificationManager.IMPORTANCE_NONE);
                    c.put("hasSound", ch.getSound() != null);
                }
                channels.add(c);
            }
        }
        res.put("channels", channels);

        SharedPreferences sp = ctx.getSharedPreferences("prayly_content_push", Context.MODE_PRIVATE);
        String json = sp.getString("config_json", null);
        List<Map<String, Object>> slots = new ArrayList<>();
        SimpleDateFormat fmt = new SimpleDateFormat("EEE HH:mm", Locale.US);
        try {
            JSONArray arr = json != null ? new JSONArray(json) : new JSONArray();
            for (int i = 0; i < arr.length(); i++) {
                JSONObject t = arr.getJSONObject(i);
                int h = t.optInt("hour", 8);
                int m = t.optInt("minute", 0);
                long at = ContentPushScheduler.nextOccurrenceMillis(h, m);
                Map<String, Object> s = new HashMap<>();
                s.put("kind", t.optString("kind"));
                s.put("hour", h);
                s.put("minute", m);
                s.put("nextAt", at);
                s.put("nextHuman", fmt.format(new Date(at)));
                PendingIntent pi = ContentPushScheduler.armedPendingIntent(ctx, i, t);
                s.put("alarmArmed", pi != null);
                slots.add(s);
            }
        } catch (Exception ignored) { /* corrupt config */ }
        res.put("nextSlots", slots);

        SharedPreferences guard = ctx.getSharedPreferences(ContentPushReceiver.GUARD_PREFS, Context.MODE_PRIVATE);
        res.put("dailyCapCount", guard.getInt(ContentPushReceiver.K_CAP_DAY, -1) >= 0
                ? guard.getInt(ContentPushReceiver.K_CAP_COUNT, 0) : 0);
        res.put("lastAppOpenAt", guard.getLong(ContentPushReceiver.K_LAST_OPEN, 0L));
        return res;
    }
}
