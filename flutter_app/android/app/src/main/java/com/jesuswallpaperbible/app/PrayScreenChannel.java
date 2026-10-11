package com.jesuswallpaperbible.app;

import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.drawable.Drawable;
import android.net.Uri;
import android.os.Build;
import android.os.Process;
import android.provider.Settings;
import android.util.Base64;

import java.io.ByteArrayOutputStream;
import java.util.Collections;
import java.util.HashSet;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/** Native bridge for PrayScreen's Usage Access + overlay based app guard. */
public final class PrayScreenChannel implements MethodChannel.MethodCallHandler {
    public static final String CHANNEL = "com.jesuswallpaperbible.app/pray_screen";
    static final String PREFS = "pray_screen";
    static final String KEY_APPS = "apps";
    static final String KEY_ENABLED = "enabled";
    static final String KEY_UNBLOCK_UNTIL = "unblock_until";
    static final String KEY_OPEN_SACRED_PAUSE = "open_sacred_pause";
    static final String KEY_EVENTS = "pending_events";

    private final Activity activity;

    PrayScreenChannel(Activity activity) { this.activity = activity; }

    private Context context() { return activity.getApplicationContext(); }

    @Override public void onMethodCall(MethodCall call, MethodChannel.Result result) {
        switch (call.method) {
            case "getStatus":
                Map<String, Object> status = new HashMap<>();
                status.put("usageAllowed", hasUsageAccess());
                status.put("overlayAllowed", Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context()));
                status.put("running", prefs().getBoolean(KEY_ENABLED, false));
                status.put("serviceRunning", PrayScreenGuardService.running);
                status.put("guardedCount", prefs().getString(KEY_APPS, "").replace(",", " ").trim().isEmpty()
                        ? 0 : prefs().getString(KEY_APPS, "").split(",").length);
                result.success(status);
                break;
            case "getApps":
                loadApps(result);
                break;
            case "openUsageAccess":
                open(new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS));
                result.success(true);
                break;
            case "openOverlayAccess":
                Intent overlay = new Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + context().getPackageName()));
                open(overlay);
                result.success(true);
                break;
            case "setCopy": {
                // Blocker copy comes from the app's translations, so the
                // overlay speaks the user's language.
                Map<String, String> copy = call.argument("copy");
                if (copy != null) {
                    SharedPreferences.Editor copyEditor = prefs().edit();
                    for (Map.Entry<String, String> entry : copy.entrySet()) {
                        copyEditor.putString("copy_" + entry.getKey(), entry.getValue());
                    }
                    copyEditor.apply();
                }
                result.success(true);
                break;
            }
            case "setApps":
                List<String> packages = call.argument("packages");
                prefs().edit().putString(KEY_APPS, join(packages)).apply();
                result.success(true);
                break;
            case "unlockUntil":
                Number timestamp = call.argument("timestamp");
                prefs().edit().putLong(KEY_UNBLOCK_UNTIL,
                        timestamp == null ? 0 : timestamp.longValue()).apply();
                PrayScreenGuardService.dismissShield();
                result.success(true);
                break;
            case "forceGuard":
                prefs().edit().putLong(KEY_UNBLOCK_UNTIL, 0).apply();
                result.success(true);
                break;
            case "drainEvents": {
                String raw;
                synchronized (PrayScreenGuardService.class) {
                    raw = prefs().getString(KEY_EVENTS, "[]");
                    prefs().edit().putString(KEY_EVENTS, "[]").commit();
                }
                result.success(raw);
                break;
            }
            case "consumeSacredPauseLaunch":
                boolean pending = prefs().getBoolean(KEY_OPEN_SACRED_PAUSE, false);
                if (pending) prefs().edit().putBoolean(KEY_OPEN_SACRED_PAUSE, false).apply();
                result.success(pending);
                break;
            case "batteryUnrestricted": {
                boolean ok = true;
                if (Build.VERSION.SDK_INT >= 23) {
                    android.os.PowerManager power = (android.os.PowerManager)
                            context().getSystemService(Context.POWER_SERVICE);
                    ok = power == null || power.isIgnoringBatteryOptimizations(context().getPackageName());
                }
                result.success(ok);
                break;
            }
            case "openBatterySettings":
                if (Build.VERSION.SDK_INT >= 23) {
                    open(new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                            Uri.parse("package:" + context().getPackageName())));
                }
                result.success(true);
                break;
            case "testShield":
                if (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(context())) {
                    result.success(false);
                    return;
                }
                Intent test = new Intent(context(), PrayScreenGuardService.class)
                        .putExtra(PrayScreenGuardService.EXTRA_TEST, true);
                if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(test);
                else context().startService(test);
                result.success(true);
                break;
            case "start":
                if (!hasUsageAccess() || (Build.VERSION.SDK_INT >= 23 && !Settings.canDrawOverlays(context()))) {
                    result.success(false);
                    return;
                }
                List<String> startPackages = call.argument("packages");
                SharedPreferences.Editor editor = prefs().edit().putBoolean(KEY_ENABLED, true);
                if (startPackages != null && !startPackages.isEmpty()) {
                    editor.putString(KEY_APPS, join(startPackages));
                }
                editor.apply();
                Intent start = new Intent(context(), PrayScreenGuardService.class);
                if (Build.VERSION.SDK_INT >= 26) context().startForegroundService(start);
                else context().startService(start);
                result.success(true);
                break;
            case "stop":
                prefs().edit().putBoolean(KEY_ENABLED, false).apply();
                context().stopService(new Intent(context(), PrayScreenGuardService.class));
                PrayScreenGuardService.dismissShield();
                result.success(true);
                break;
            default: result.notImplemented();
        }
    }

    private SharedPreferences prefs() {
        return context().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private void open(Intent intent) {
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        context().startActivity(intent);
    }

    private boolean hasUsageAccess() {
        AppOpsManager ops = (AppOpsManager) context().getSystemService(Context.APP_OPS_SERVICE);
        if (ops == null) return false;
        int mode = ops.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(), context().getPackageName());
        return mode == AppOpsManager.MODE_ALLOWED;
    }

    private void loadApps(MethodChannel.Result result) {
        new Thread(() -> {
            final List<Map<String, Object>> apps = new ArrayList<>();
            try {
                PackageManager pm = context().getPackageManager();
                Map<String, Long> usageByPackage = usageByPackage();
                HashSet<String> seen = new HashSet<>();
                String ownPackage = context().getPackageName();

                // Primary source: everything with a launcher entry.
                Intent launcher = new Intent(Intent.ACTION_MAIN, null);
                launcher.addCategory(Intent.CATEGORY_LAUNCHER);
                List<ResolveInfo> resolved = pm.queryIntentActivities(launcher, 0);
                if (resolved != null) {
                    for (ResolveInfo info : resolved) {
                        if (info.activityInfo == null) continue;
                        String packageName = info.activityInfo.packageName;
                        if (packageName == null || packageName.equals(ownPackage) || !seen.add(packageName)) continue;
                        Map<String, Object> app = describe(pm, packageName, safeLabel(pm, info), usageByPackage);
                        if (app != null) apps.add(app);
                    }
                }

                // Fallback source: installed packages that expose a launch
                // intent. Some OEM launchers hide entries from the query above.
                try {
                    for (android.content.pm.ApplicationInfo info : pm.getInstalledApplications(0)) {
                        String packageName = info.packageName;
                        if (packageName == null || packageName.equals(ownPackage) || seen.contains(packageName)) continue;
                        if (pm.getLaunchIntentForPackage(packageName) == null) continue;
                        seen.add(packageName);
                        String label;
                        try { label = pm.getApplicationLabel(info).toString(); }
                        catch (Exception ignored) { label = packageName; }
                        Map<String, Object> app = describe(pm, packageName, label, usageByPackage);
                        if (app != null) apps.add(app);
                    }
                } catch (Exception ignored) { }

                Collections.sort(apps, (left, right) -> {
                    long a = ((Number) left.get("usageMs")).longValue();
                    long b = ((Number) right.get("usageMs")).longValue();
                    if (a != b) return Long.compare(b, a);
                    return left.get("name").toString().compareToIgnoreCase(right.get("name").toString());
                });
            } catch (Exception ignored) {
                // Partial lists are still far better than the bundled defaults.
            }
            activity.runOnUiThread(() -> result.success(apps));
        }).start();
    }

    private static String safeLabel(PackageManager pm, ResolveInfo info) {
        try {
            CharSequence label = info.loadLabel(pm);
            if (label != null && label.length() > 0) return label.toString();
        } catch (Exception ignored) { }
        return info.activityInfo.packageName;
    }

    private Map<String, Object> describe(PackageManager pm, String packageName, String label,
                                         Map<String, Long> usageByPackage) {
        try {
            Map<String, Object> app = new HashMap<>();
            app.put("packageName", packageName);
            app.put("name", label);
            app.put("shortLabel", shortLabel(label));
            Long usage = usageByPackage.get(packageName);
            app.put("usageMs", usage == null ? 0L : usage);
            String icon = "";
            try { icon = drawableToBase64(pm.getApplicationIcon(packageName)); }
            catch (Exception ignored) { }
            app.put("icon", icon);
            return app;
        } catch (Exception ignored) {
            return null;
        }
    }

    private Map<String, Long> usageByPackage() {
        Map<String, Long> out = new HashMap<>();
        if (!hasUsageAccess()) return out;
        UsageStatsManager manager = (UsageStatsManager) context().getSystemService(Context.USAGE_STATS_SERVICE);
        if (manager == null) return out;
        long end = System.currentTimeMillis();
        List<UsageStats> stats = manager.queryUsageStats(UsageStatsManager.INTERVAL_MONTHLY,
                end - 30L * 24L * 60L * 60L * 1000L, end);
        if (stats == null) return out;
        for (UsageStats stat : stats) out.put(stat.getPackageName(), stat.getTotalTimeInForeground());
        return out;
    }

    private static String shortLabel(String label) {
        String clean = label == null ? "?" : label.trim();
        if (clean.isEmpty()) return "?";
        String[] words = clean.split("\\s+");
        if (words.length > 1) return (words[0].substring(0, 1) + words[1].substring(0, 1)).toUpperCase();
        return clean.substring(0, Math.min(2, clean.length())).toUpperCase();
    }

    private static String drawableToBase64(Drawable drawable) {
        if (drawable == null) return "";
        int width = Math.max(1, drawable.getIntrinsicWidth());
        int height = Math.max(1, drawable.getIntrinsicHeight());
        int max = 96;
        float scale = Math.min(1f, Math.min((float) max / width, (float) max / height));
        Bitmap bitmap = Bitmap.createBitmap(Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale)), Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(bitmap);
        drawable.setBounds(0, 0, canvas.getWidth(), canvas.getHeight());
        drawable.draw(canvas);
        ByteArrayOutputStream stream = new ByteArrayOutputStream();
        bitmap.compress(Bitmap.CompressFormat.PNG, 88, stream);
        bitmap.recycle();
        return Base64.encodeToString(stream.toByteArray(), Base64.NO_WRAP);
    }

    private static String join(List<String> values) {
        if (values == null) return "";
        return android.text.TextUtils.join(",", new ArrayList<>(values));
    }
}