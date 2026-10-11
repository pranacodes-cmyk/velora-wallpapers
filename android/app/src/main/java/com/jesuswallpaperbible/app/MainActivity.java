package com.jesuswallpaperbible.app;

import android.app.ActivityManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.capacitorjs.plugins.localnotifications.LocalNotificationsPlugin;
import com.velora.plugins.WallpaperSetterPlugin;
import com.velora.plugins.LiveWallpaperPlugin;
import com.velora.plugins.ParallaxWallpaperPlugin;
import com.velora.plugins.DailyVerseWallpaperPlugin;
import com.velora.plugins.PrayerAlarmPlugin;
import com.velora.plugins.ContentPushPlugin;
import com.facebook.FacebookSdk;
import com.facebook.appevents.AppEventsLogger;

public class MainActivity extends BridgeActivity {
    private final long nativeBootStartedAtMs = android.os.SystemClock.elapsedRealtime();
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // (WebView async startup config removed — requires androidx.webkit 1.15+)



        registerPlugin(LocalNotificationsPlugin.class);
        registerPlugin(NotificationPermissionPlugin.class);
        registerPlugin(WallpaperSetterPlugin.class);
        registerPlugin(LiveWallpaperPlugin.class);
        registerPlugin(ParallaxWallpaperPlugin.class);
        registerPlugin(DailyVerseWallpaperPlugin.class);
        registerPlugin(PrayerAlarmPlugin.class);
        registerPlugin(ContentPushPlugin.class);
        registerPlugin(GooglePlayPricesPlugin.class);
        super.onCreate(savedInstanceState);

        // Block screenshots & screen recording (sacred content protection)
        getWindow().setFlags(
            WindowManager.LayoutParams.FLAG_SECURE,
            WindowManager.LayoutParams.FLAG_SECURE
        );

        // Enable edge-to-edge display
        enableEdgeToEdge();

        // Reduce WebView render-thread pressure on low-end Android devices.
        // The Play Console ANRs show the main thread blocked in
        // HardwareRenderer.nSyncAndDrawFrame / nativePollOnce: the app is
        // waiting for GPU composition, not crashing in app code. Keep the root
        // window from producing extra transition frames during cold start.
        getWindow().setWindowAnimations(0);

        // Meta attribution uses the standard native SDK auto-init path so
        // install attribution stays reliable. This delayed activateApp is only
        // a guarded safety-net after first paint; it must not manually
        // initialize Meta or disable FacebookInitProvider again.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                if (FacebookSdk.isInitialized()) {
                    AppEventsLogger.activateApp(getApplication());
                }
            } catch (Throwable t) { /* non-fatal */ }
        }, 800);


        // Handle "open_route" extra from PrayerAlarmActivity / receiver — push
        // the WebView straight to /devotional?from=alarm instead of leaving
        // the user on the home screen.
        handleOpenRouteIntent(getIntent(), 1200);

        // Native safety net: repair content-push scheduling only after the
        // WebView is interactive. Do not rebuild AlarmManager entries during
        // first taps; that startup Binder churn matched nativePollOnce ANRs.
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            new Thread(() -> {
                try {
                    ContentPushPlugin.repairScheduleIfNeeded(getApplicationContext());
                }
                catch (Throwable t) { /* non-fatal */ }
            }, "content-push-repair").start();
        }, 15000);

        // ANR mitigation: disable WebView autofill so the system AutofillManager
        // does NOT synchronously query ClipboardManager.getPrimaryClipDescription
        // on every window focus change. This is the documented Chromium WebView
        // ANR (BinderProxy.transactNative → IClipboard.getPrimaryClipDescription)
        // reported on Redmi / Samsung OEM skins where the clipboard service is
        // slow to respond and blocks the main thread > 5s.
        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) return;
                // CRITICAL ANR FIX: do NOT force LAYER_TYPE_HARDWARE on the
                // WebView. WebView is already hardware-accelerated at the
                // Activity level; forcing a hardware layer on top allocates a
                // full-screen offscreen texture that the Vulkan compositor
                // must re-composite every frame. That extra work matches the
                // Play Console ANR traces where main thread waits inside
                // WebView JNI while RenderThread is stuck in drawVk (Vulkan).
                wv.setLayerType(View.LAYER_TYPE_NONE, null);
                wv.setOverScrollMode(View.OVER_SCROLL_NEVER);
                wv.setVerticalScrollBarEnabled(false);
                wv.setHorizontalScrollBarEnabled(false);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    wv.setImportantForAutofill(View.IMPORTANT_FOR_AUTOFILL_NO_EXCLUDE_DESCENDANTS);
                }
                try {
                    wv.getClass().getMethod("setRendererPriorityPolicy", int.class, boolean.class)
                        .invoke(wv, 2 /* RENDERER_PRIORITY_IMPORTANT */, false);
                } catch (Throwable ignore) {}
                try {
                    wv.getClass().getMethod("setOffscreenPreRaster", boolean.class).invoke(wv, false);
                } catch (Throwable ignore) {}
                WebSettings settings = wv.getSettings();
                settings.setTextZoom(100);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    settings.setForceDark(WebSettings.FORCE_DARK_OFF);
                }
                final long bootToWebViewMs = android.os.SystemClock.elapsedRealtime() - nativeBootStartedAtMs;
                wv.evaluateJavascript(
                    "window.__PRAYLY_NATIVE_BOOT_MS=" + bootToWebViewMs + ";" +
                    "window.dispatchEvent(new CustomEvent('prayly-native-ready'));",
                    null);
            } catch (Throwable t) { /* non-fatal */ }
        });
    }





    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleOpenRouteIntent(intent, 250);
    }

    private void handleOpenRouteIntent(Intent intent, long delayMs) {
        if (intent == null) return;
        final String route = intent.getStringExtra("open_route");
        if (route == null || route.isEmpty()) return;
        // Consume so a screen rotation / resume doesn't re-trigger.
        intent.removeExtra("open_route");
        final String safe = route.replace("\\", "\\\\").replace("'", "\\'");
        new Handler(Looper.getMainLooper()).postDelayed(() -> {
            try {
                WebView wv = getBridge() != null ? getBridge().getWebView() : null;
                if (wv == null) return;
                wv.evaluateJavascript(
                    "(function(){try{if(window.__openPrayerRoute)window.__openPrayerRoute('"
                        + safe + "');else window.location.assign('" + safe + "');}catch(e){}})();",
                    null);
            } catch (Throwable t) { /* ignore */ }
        }, delayMs);
    }

    private void enableEdgeToEdge() {
        Window window = getWindow();

        // Let app draw behind system bars
        WindowCompat.setDecorFitsSystemWindows(window, false);

        // Android 15 (SDK 35+) deprecates setStatusBarColor/setNavigationBarColor
        // and enforces edge-to-edge with transparent bars automatically. Only set
        // the legacy colors on older releases to avoid deprecated-API warnings.
        if (Build.VERSION.SDK_INT < 35) {
            window.setStatusBarColor(android.graphics.Color.TRANSPARENT);
            window.setNavigationBarColor(android.graphics.Color.TRANSPARENT);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                window.setNavigationBarContrastEnforced(false);
            }
        }
    }

}
