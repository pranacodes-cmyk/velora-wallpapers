package com.jesuswallpaperbible.app;

import android.content.Intent;
import android.os.Bundle;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import io.flutter.embedding.android.FlutterActivity;
import io.flutter.embedding.engine.FlutterEngine;
import io.flutter.plugin.common.MethodChannel;

/**
 * Flutter host activity. Registers the three native bridges that replace the
 * old Capacitor plugins:
 *   • wallpaper          → static / video live / daily verse wallpapers
 *   • parallax_wallpaper → 3D parallax live wallpaper
 *   • prayer_alarm       → AlarmManager prayer bells
 */
public class MainActivity extends FlutterActivity {

    private WallpaperChannel wallpaperChannel;
    private ParallaxChannel parallaxChannel;

    /**
     * Route handed over by notification/alarm activities ("open_route" intent
     * extra). PrayScreenChannel replaces the old Capacitor
     * `window.__openPrayerRoute(...)` hand-off: Dart drains it through
     * PrayerAlarmChannel.consumeOpenRoute.
     */
    private static String pendingRoute = null;

    public static void stashRoute(@Nullable Intent intent) {
        if (intent == null) return;
        String route = intent.getStringExtra("open_route");
        if (route != null && !route.isEmpty()) pendingRoute = route;
    }

    /** Returns and clears the stashed route, or null when there is none. */
    public static synchronized String takePendingRoute() {
        String r = pendingRoute;
        pendingRoute = null;
        return r;
    }

    @Override
    public void configureFlutterEngine(@NonNull FlutterEngine flutterEngine) {
        super.configureFlutterEngine(flutterEngine);

        wallpaperChannel = new WallpaperChannel(this);
        parallaxChannel = new ParallaxChannel(this);

        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), WallpaperChannel.CHANNEL)
                .setMethodCallHandler(wallpaperChannel);
        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), ParallaxChannel.CHANNEL)
                .setMethodCallHandler(parallaxChannel);
        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), PrayerAlarmChannel.CHANNEL)
                .setMethodCallHandler(new PrayerAlarmChannel(this));
        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), PrayScreenChannel.CHANNEL)
                .setMethodCallHandler(new PrayScreenChannel(this));
        new MethodChannel(flutterEngine.getDartExecutor().getBinaryMessenger(), ContentPushChannel.CHANNEL)
                .setMethodCallHandler(new ContentPushChannel(this));
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == WallpaperChannel.REQUEST_CODE && wallpaperChannel != null) {
            wallpaperChannel.onPickerResult(resultCode);
        } else if (requestCode == ParallaxChannel.REQUEST_CODE && parallaxChannel != null) {
            parallaxChannel.onPickerResult(resultCode);
        }
    }

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            if (FacebookSdk.isInitialized()) AppEventsLogger.activateApp(getApplication());
        } catch (Throwable ignored) { /* non-fatal attribution */ }
        stashRoute(getIntent());
    }

    @Override
    protected void onNewIntent(@NonNull Intent intent) {
        super.onNewIntent(intent);
        stashRoute(intent);
    }

    @Override
    protected void onResume() {
        super.onResume();
        PrayScreenGuardService.confirmHandoff(this);
    }
}
