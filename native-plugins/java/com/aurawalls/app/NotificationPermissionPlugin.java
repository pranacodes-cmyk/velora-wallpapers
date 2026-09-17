package com.jesuswallpaperbible.app;

import android.Manifest;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "NotificationPermission",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class NotificationPermissionPlugin extends Plugin {
    private static final String CHANNEL_ID = "prayer_reminders";
    private static final int NOW_ID = 9901;
    private static final int DELAYED_ID = 9902;

    @PluginMethod
    public void check(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < 33) {
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        PermissionState state = getPermissionState("notifications");
        ret.put("status", state == PermissionState.GRANTED ? "granted" : "prompt");
        call.resolve(ret);
    }

    @PluginMethod
    public void request(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        requestPermissionForAlias("notifications", call, "permissionsCallback");
    }

    @PermissionCallback
    private void permissionsCallback(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT < 33) {
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        PermissionState state = getPermissionState("notifications");
        ret.put("status", state == PermissionState.GRANTED ? "granted" : "denied");
        call.resolve(ret);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent intent;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                intent = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName());
            } else {
                intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                intent.setData(Uri.fromParts("package", getContext().getPackageName(), null));
            }
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Unable to open settings", e);
        }
    }

    @PluginMethod
    public void diagnose(PluginCall call) {
        call.resolve(buildDiagnostics(null));
    }

    @PluginMethod
    public void showTestNow(PluginCall call) {
        try {
            JSObject before = buildDiagnostics(null);
            if (!canPostNow()) {
                before.put("ok", false);
                before.put("error", "Notifications are blocked by Android permission, app settings, or the notification channel");
                call.resolve(before);
                return;
            }

            ensurePrayerChannel();
            NotificationManagerCompat.from(getContext()).notify(
                NOW_ID,
                buildNotification(
                    "🔔 Test Notification",
                    "This was sent instantly by the native Android notification system."
                ).build()
            );

            call.resolve(buildDiagnostics("Instant notification sent"));
        } catch (Exception e) {
            call.reject("Native instant notification failed: " + e.getMessage(), e);
        }
    }

    @PluginMethod
    public void scheduleTestInSeconds(PluginCall call) {
        int seconds = call.getInt("seconds", 10);
        if (seconds < 1) seconds = 1;
        if (seconds > 60) seconds = 60;

        try {
            JSObject before = buildDiagnostics(null);
            if (!canPostNow()) {
                before.put("ok", false);
                before.put("error", "Notifications are blocked by Android permission, app settings, or the notification channel");
                call.resolve(before);
                return;
            }

            ensurePrayerChannel();
            final int delaySeconds = seconds;
            final Context appContext = getContext().getApplicationContext();
            new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> {
                try {
                    NotificationManagerCompat.from(appContext).notify(
                        DELAYED_ID,
                        buildNotification(
                            "⏰ 10 Second Test",
                            "This notification fired after a short test delay."
                        ).build()
                    );
                } catch (Exception ignored) {}
            }, delaySeconds * 1000L);

            JSObject ret = buildDiagnostics("Delayed test queued");
            ret.put("seconds", delaySeconds);
            ret.put("scheduledAt", System.currentTimeMillis() + delaySeconds * 1000L);
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Native delayed notification failed: " + e.getMessage(), e);
        }
    }

    private String getPermissionStatus() {
        if (Build.VERSION.SDK_INT < 33) return "granted";
        return ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
            ? "granted"
            : "denied";
    }

    private boolean canPostNow() {
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        if (!notificationsEnabled || !"granted".equals(getPermissionStatus())) return false;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return true;

        ensurePrayerChannel();
        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
        return channel != null && channel.getImportance() != NotificationManager.IMPORTANCE_NONE;
    }

    private void ensurePrayerChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

        NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
        NotificationChannel existing = manager.getNotificationChannel(CHANNEL_ID);
        if (existing != null) return;

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID,
            "Daily Prayer Reminders",
            NotificationManager.IMPORTANCE_HIGH
        );
        channel.setDescription("Morning and evening prayer notifications");
        channel.enableVibration(true);
        channel.enableLights(true);
        channel.setLightColor(Color.rgb(255, 215, 0));
        Uri soundUri = Uri.parse("android.resource://" + getContext().getPackageName() + "/raw/divine_bell");
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        channel.setSound(soundUri, attrs);
        manager.createNotificationChannel(channel);
    }

    private NotificationCompat.Builder buildNotification(String title, String body) {
        Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
        PendingIntent pendingIntent = null;
        if (intent != null) {
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            pendingIntent = PendingIntent.getActivity(
                getContext(),
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        int smallIcon = getContext().getResources().getIdentifier("ic_stat_cross", "drawable", getContext().getPackageName());
        if (smallIcon == 0) smallIcon = android.R.drawable.ic_dialog_info;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(getContext(), CHANNEL_ID)
            .setSmallIcon(smallIcon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setDefaults(NotificationCompat.DEFAULT_VIBRATE | NotificationCompat.DEFAULT_LIGHTS);

        if (pendingIntent != null) builder.setContentIntent(pendingIntent);
        return builder;
    }

    private JSObject buildDiagnostics(String note) {
        JSObject ret = new JSObject();
        boolean notificationsEnabled = NotificationManagerCompat.from(getContext()).areNotificationsEnabled();
        String permission = getPermissionStatus();
        int channelImportance = -1;
        boolean channelExists = false;

        ensurePrayerChannel();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = (NotificationManager) getContext().getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = manager.getNotificationChannel(CHANNEL_ID);
            channelExists = channel != null;
            if (channel != null) channelImportance = channel.getImportance();
        }

        ret.put("ok", true);
        ret.put("sdk", Build.VERSION.SDK_INT);
        ret.put("packageName", getContext().getPackageName());
        ret.put("permission", permission);
        ret.put("notificationsEnabled", notificationsEnabled);
        ret.put("channelExists", channelExists);
        ret.put("channelImportance", channelImportance);
        ret.put("channelBlocked", Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && channelImportance == NotificationManager.IMPORTANCE_NONE);
        ret.put("exactAlarmPermissionInManifest", false);
        ret.put("canPost", notificationsEnabled && "granted".equals(permission) && !(Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && channelImportance == NotificationManager.IMPORTANCE_NONE));
        if (note != null) ret.put("note", note);
        return ret;
    }
}
