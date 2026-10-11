package com.jesuswallpaperbible.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.AlarmManager;
import android.app.Service;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;

/** Lightweight foreground-app watcher. It never inspects app content. */
public final class PrayScreenGuardService extends Service {
    private static final String CHANNEL_ID = "pray_screen_guard";
    static final String EXTRA_TEST = "pray_screen_test_shield";
    private static final Handler MAIN = new Handler(Looper.getMainLooper());
    private static View shieldView;
    private static WindowManager shieldWindowManager;
    static volatile boolean running = false;
    private static volatile boolean handoffPending = false;
    private static volatile boolean handoffViaNotification = false;
    private static volatile String shieldApp = "";
    private final Handler handler = new Handler(Looper.getMainLooper());
    private UsageStatsManager usage;
    /** Last package the system reported in the foreground (sticky between polls). */
    private String currentPackage = "";
    private long eventCursor = 0;
    private long lastSafetyHomeAt = 0L;

    private final Runnable check = new Runnable() {
        @Override public void run() {
            try { inspectForegroundApp(); } catch (Exception ignored) { }
            handler.postDelayed(this, 550);
        }
    };

    @Override public void onCreate() {
        super.onCreate();
        running = true;
        usage = (UsageStatsManager) getSystemService(USAGE_STATS_SERVICE);
        eventCursor = System.currentTimeMillis() - 10_000L;
        createChannel();
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent tap = open == null ? null : PendingIntent.getActivity(
                this, 4607, open,
                PendingIntent.FLAG_UPDATE_CURRENT |
                        (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0));
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_cross)
                .setContentTitle("PrayScreen Shield is active")
                .setContentText("Guarding your chosen apps")
                .setOngoing(true)
                .setSilent(true);
        if (tap != null) builder.setContentIntent(tap);
        if (Build.VERSION.SDK_INT >= 29) {
            ServiceCompat.startForeground(this, 4607, builder.build(),
                    Build.VERSION.SDK_INT >= 34
                            ? ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                            : 0);
        } else {
            startForeground(4607, builder.build());
        }
        handler.post(check);
    }

    @Override public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.getBooleanExtra(EXTRA_TEST, false)) {
            currentPackage = "";
            showShield();
        }
        return START_STICKY;
    }

    @Override public void onDestroy() {
        running = false;
        handler.removeCallbacks(check);
        if (getSharedPreferences(PrayScreenChannel.PREFS, MODE_PRIVATE)
                .getBoolean(PrayScreenChannel.KEY_ENABLED, false)) {
            moveToHome();
        }
        dismissShield();
        scheduleRestartIfEnabled();
        super.onDestroy();
    }

    @Override public void onTaskRemoved(Intent rootIntent) {
        scheduleRestartIfEnabled();
        super.onTaskRemoved(rootIntent);
    }

    @Nullable @Override public IBinder onBind(Intent intent) { return null; }

    private void inspectForegroundApp() {
        SharedPreferences prefs = getSharedPreferences(PrayScreenChannel.PREFS, MODE_PRIVATE);
        if (!prefs.getBoolean(PrayScreenChannel.KEY_ENABLED, false)) {
            dismissShield();
            return;
        }
        if (System.currentTimeMillis() < prefs.getLong(PrayScreenChannel.KEY_UNBLOCK_UNTIL, 0)) {
            dismissShield();
            return;
        }
        String foreground = foregroundPackage();
        if (foreground.isEmpty()) return;
        if (foreground.equals(getPackageName())) {
            dismissShield();
            return;
        }
        Set<String> guarded = new HashSet<>(Arrays.asList(
                prefs.getString(PrayScreenChannel.KEY_APPS, "").split(",")));
        guarded.remove("");
        if (guarded.contains(foreground)) {
            shieldApp = foreground;
            showShield();
        } else {
            dismissShield();
        }
    }

    /**
     * Resolves the app currently in front. Events are consumed with a moving
     * cursor (so a package stays "current" between polls even when no new event
     * arrives) and a usage-stats sweep is used as a fallback for OEMs that
     * deliver foreground events late or not at all.
     */
    private String foregroundPackage() {
        if (usage == null) return currentPackage;
        long now = System.currentTimeMillis();
        try {
            UsageEvents events = usage.queryEvents(Math.max(0, eventCursor - 1500), now);
            UsageEvents.Event event = new UsageEvents.Event();
            String latest = "";
            long latestAt = 0;
            while (events != null && events.hasNextEvent()) {
                events.getNextEvent(event);
                int type = event.getEventType();
                boolean resumed = type == UsageEvents.Event.MOVE_TO_FOREGROUND
                        || (Build.VERSION.SDK_INT >= 29 && type == UsageEvents.Event.ACTIVITY_RESUMED);
                if (resumed && event.getTimeStamp() >= latestAt) {
                    latestAt = event.getTimeStamp();
                    latest = event.getPackageName();
                }
            }
            if (!latest.isEmpty()) currentPackage = latest;
        } catch (Exception ignored) { }
        eventCursor = now;
        if (currentPackage.isEmpty()) currentPackage = recentUsagePackage(now);
        return currentPackage;
    }

    private String recentUsagePackage(long now) {
        try {
            java.util.List<android.app.usage.UsageStats> stats = usage.queryUsageStats(
                    UsageStatsManager.INTERVAL_DAILY, now - 60_000L, now);
            if (stats == null) return "";
            String best = "";
            long bestAt = 0;
            for (android.app.usage.UsageStats stat : stats) {
                if (stat.getLastTimeUsed() > bestAt) {
                    bestAt = stat.getLastTimeUsed();
                    best = stat.getPackageName();
                }
            }
            return best == null ? "" : best;
        } catch (Exception ignored) {
            return "";
        }
    }

    /** Localized blocker copy pushed from Flutter, English until it arrives. */
    private String copy(String key, String fallback) {
        String value = getSharedPreferences(PrayScreenChannel.PREFS, MODE_PRIVATE)
                .getString("copy_" + key, null);
        return value == null || value.trim().isEmpty() ? fallback : value;
    }

    private void showShield() {
        if (shieldView != null || Build.VERSION.SDK_INT < 23) return;
        if (!Settings.canDrawOverlays(this)) {
            // Permission can be revoked by an OEM while Shield is active. Do not
            // knowingly leave a guarded app visible: move away to Home and keep
            // checking until the user restores permission.
            long now = System.currentTimeMillis();
            if (now - lastSafetyHomeAt > 2_000L) {
                lastSafetyHomeAt = now;
                moveToHome();
            }
            return;
        }
        MAIN.post(() -> {
            if (shieldView != null) return;
            WindowManager wm = (WindowManager) getSystemService(WINDOW_SERVICE);
            float d = getResources().getDisplayMetrics().density;
            LinearLayout root = new LinearLayout(this);
            root.setOrientation(LinearLayout.VERTICAL);
            root.setGravity(Gravity.CENTER);
            root.setPadding((int) (26 * d), (int) (36 * d), (int) (26 * d), (int) (36 * d));
            GradientDrawable sky = new GradientDrawable(
                    GradientDrawable.Orientation.TOP_BOTTOM,
                    new int[]{Color.rgb(12, 20, 44), Color.rgb(7, 11, 24), Color.rgb(4, 6, 14)});
            root.setBackground(sky);

            // A sacred covenant: His face first, then the promise, then one way in.
            // The verse and prayer live full-screen inside Prayly.
            FrameLayout portrait = new FrameLayout(this);
            ImageView face = new ImageView(this);
            face.setImageResource(R.drawable.blocker_jesus);
            face.setScaleType(ImageView.ScaleType.CENTER_CROP);
            GradientDrawable faceMask = new GradientDrawable();
            faceMask.setShape(GradientDrawable.OVAL);
            faceMask.setColor(Color.rgb(9, 14, 30));
            face.setBackground(faceMask);
            if (Build.VERSION.SDK_INT >= 21) {
                face.setClipToOutline(true);
                face.setOutlineProvider(android.view.ViewOutlineProvider.BACKGROUND);
            }
            portrait.addView(face, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT));
            View halo = new View(this);
            GradientDrawable ring = new GradientDrawable();
            ring.setShape(GradientDrawable.OVAL);
            ring.setColor(Color.TRANSPARENT);
            ring.setStroke((int) (1.6f * d), Color.argb(150, 233, 187, 62));
            halo.setBackground(ring);
            portrait.addView(halo, new FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.MATCH_PARENT));
            LinearLayout.LayoutParams portraitLp = new LinearLayout.LayoutParams(
                    (int) (128 * d), (int) (128 * d));
            portraitLp.gravity = Gravity.CENTER_HORIZONTAL;
            portraitLp.setMargins(0, 0, 0, (int) (22 * d));
            portrait.setLayoutParams(portraitLp);
            portrait.setElevation(8 * d);

            TextView cross = text("✦  " + copy("kicker", "SACRED COVENANT") + "  ✦",
                    11, Color.rgb(218, 171, 38), true);
            cross.setLetterSpacing(0.26f);
            TextView title = text(copy("title", "Remember your promise, my child."),
                    26, Color.WHITE, true);
            title.setLineSpacing(0, 1.14f);
            TextView sub = text(copy("sub",
                    "Before this moment is lost in the noise, come rest with Me for one minute."), 15,
                    Color.rgb(182, 189, 205), false);
            sub.setGravity(Gravity.CENTER);
            sub.setLineSpacing(0, 1.3f);

            View hairline = new View(this);
            hairline.setBackgroundColor(Color.argb(46, 233, 187, 62));
            LinearLayout.LayoutParams hairLp = new LinearLayout.LayoutParams((int) (54 * d), Math.max(1, (int) d));
            hairLp.gravity = Gravity.CENTER_HORIZONTAL;
            hairLp.setMargins(0, (int) (22 * d), 0, (int) (22 * d));
            hairline.setLayoutParams(hairLp);

            Button openPrayly = new Button(this);
            openPrayly.setText(copy("unlock", "KEEP MY PROMISE · PRAY FIRST"));
            openPrayly.setTextColor(Color.rgb(8, 10, 16));
            openPrayly.setTextSize(15);
            openPrayly.setAllCaps(true);
            openPrayly.setLetterSpacing(0.08f);
            openPrayly.setTypeface(Typeface.DEFAULT_BOLD);
            GradientDrawable gold = new GradientDrawable(
                    GradientDrawable.Orientation.LEFT_RIGHT,
                    new int[]{Color.rgb(238, 196, 72), Color.rgb(212, 161, 30)});
            gold.setCornerRadius(100 * d);
            openPrayly.setBackground(gold);
            openPrayly.setPadding(0, (int) (6 * d), 0, (int) (6 * d));
            openPrayly.setElevation(6 * d);
            openPrayly.setOnClickListener(v -> {
                getSharedPreferences(PrayScreenChannel.PREFS, MODE_PRIVATE)
                        .edit()
                        .putBoolean(PrayScreenChannel.KEY_OPEN_SACRED_PAUSE, true)
                        .apply();
                // Do not dismiss/unlock the guarded app yet. Some Android skins
                // silently drop background launches without throwing. MainActivity
                // confirms the handoff from onResume; only then is grace granted.
                handoffPending = true;
                handoffViaNotification = false;
                logEvent(this, "pray_screen_shield_cta_tapped", "shield");
                openPrayly();
            });

            // One way forward only — the pause always leads into Prayly.
            TextView note = text(copy("note", "Your apps will still be there after."), 12,
                    Color.argb(150, 255, 255, 255), false);

            root.addView(portrait);
            root.addView(cross, lp(0, (int) (14 * d)));
            root.addView(title, lp(0, (int) (12 * d)));
            root.addView(sub, lp(0, 0));
            root.addView(hairline);
            root.addView(openPrayly, lp(0, (int) (14 * d)));
            root.addView(note, lp(0, 0));

            WindowManager.LayoutParams params = new WindowManager.LayoutParams(
                    WindowManager.LayoutParams.MATCH_PARENT,
                    WindowManager.LayoutParams.MATCH_PARENT,
                    Build.VERSION.SDK_INT >= 26
                            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                            : WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN |
                            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON,
                    PixelFormat.TRANSLUCENT);
            params.gravity = Gravity.TOP | Gravity.START;
            try {
                wm.addView(root, params);
                shieldView = root;
                shieldWindowManager = wm;
                logEvent(this, "pray_screen_shield_shown", "shield");
            } catch (Exception ignored) { }
        });
    }

    /**
     * Brings Prayly forward from the overlay. One universal path for every
     * Android brand: a PendingIntent sent with an explicit background
     * activity-start grant (the documented route on Android 14+, and the only
     * one aggressive OEM skins honour). If the skin still refuses, a
     * high-priority full-screen notification carries the user across.
     */
    private void openPrayly() {
        Intent launch = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (launch == null) return;
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT |
                (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent pending = PendingIntent.getActivity(this, 4608, launch, flags);
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                android.app.ActivityOptions options = android.app.ActivityOptions.makeBasic();
                options.setPendingIntentBackgroundActivityStartMode(
                        android.app.ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
                pending.send(this, 0, null, null, null, null, options.toBundle());
            } else {
                pending.send();
            }
        } catch (Exception ignored) { }
        try { startActivity(launch); } catch (Exception ignored) { }

        // pending.send() can report success even when an OEM silently blocks the
        // activity. Check for a real MainActivity resume instead of trusting it.
        handler.postDelayed(() -> {
            if (!handoffPending) return;
            handoffViaNotification = true;
            logEvent(this, "pray_screen_handoff_blocked", "notification_fallback");
            fullScreenFallback(pending);

            // A few OEMs suppress both background launches and full-screen
            // notifications. Never leave the user trapped behind our overlay:
            // move to Home while keeping the guarded app LOCKED. Opening Prayly
            // manually then consumes the already-saved Sacred Pause request.
            handler.postDelayed(() -> {
                if (!handoffPending) return;
                logEvent(this, "pray_screen_handoff_blocked", "moved_home");
                try {
                    moveToHome();
                } catch (Exception ignored) { }
                // Keep the shield visible until foreground polling confirms that
                // Home (or Prayly) really replaced the guarded app. Some OEMs can
                // silently reject this launch too; removing the overlay here
                // would expose the guarded app despite no successful handoff.
            }, 1200L);
        }, 900L);
    }

    /** Called only by MainActivity.onResume after Prayly is genuinely visible. */
    static void confirmHandoff(Context context) {
        if (!handoffPending) return;
        handoffPending = false;
        logEvent(context, "pray_screen_handoff_success",
                handoffViaNotification ? "notification" : "direct");
        handoffViaNotification = false;
        dismissShield();
        try {
            NotificationManager manager = (NotificationManager)
                    context.getSystemService(NOTIFICATION_SERVICE);
            if (manager != null) manager.cancel(4608);
        } catch (Exception ignored) { }
    }

    private void moveToHome() {
        try {
            Intent home = new Intent(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(home);
        } catch (Exception ignored) { }
    }

    /** Best-effort resurrection after task removal/OEM process trimming. */
    private void scheduleRestartIfEnabled() {
        if (!getSharedPreferences(PrayScreenChannel.PREFS, MODE_PRIVATE)
                .getBoolean(PrayScreenChannel.KEY_ENABLED, false)) return;
        try {
            Intent restart = new Intent(this, PrayScreenBootReceiver.class)
                    .setAction("com.jesuswallpaperbible.app.RESTART_PRAY_SCREEN");
            int flags = PendingIntent.FLAG_UPDATE_CURRENT |
                    (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
            PendingIntent pending = PendingIntent.getBroadcast(this, 4610, restart, flags);
            AlarmManager alarms = (AlarmManager) getSystemService(ALARM_SERVICE);
            if (alarms == null) return;
            long when = SystemClock.elapsedRealtime() + 2_000L;
            if (Build.VERSION.SDK_INT >= 23) {
                alarms.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, when, pending);
            } else {
                alarms.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, when, pending);
            }
        } catch (Exception ignored) { }
    }

    /** Last resort for skins that drop background activity starts entirely. */
    private void fullScreenFallback(PendingIntent pending) {
        try {
            NotificationManager manager = (NotificationManager) getSystemService(NOTIFICATION_SERVICE);
            if (manager == null) return;
            if (Build.VERSION.SDK_INT >= 26) {
                NotificationChannel channel = new NotificationChannel(
                        "pray_screen_open", "Sacred Pause", NotificationManager.IMPORTANCE_HIGH);
                channel.setDescription("Opens Prayly when you keep your promise");
                manager.createNotificationChannel(channel);
            }
            NotificationCompat.Builder builder =
                    new NotificationCompat.Builder(this, "pray_screen_open")
                            .setSmallIcon(R.drawable.ic_stat_cross)
                            .setContentTitle(copy("title", "Remember your promise, my child."))
                            .setContentText("Tap here to open Prayly · Pray first")
                            .setPriority(NotificationCompat.PRIORITY_MAX)
                            .setCategory(NotificationCompat.CATEGORY_CALL)
                            .setAutoCancel(true)
                            .setContentIntent(pending)
                            .setFullScreenIntent(pending, true);
            manager.notify(4608, builder.build());
        } catch (Exception ignored) { }
    }

    /**
     * The overlay runs outside Flutter, so PostHog cannot be called here.
     * Events are queued in prefs and drained by Dart (drainEvents) on resume.
     */
    static synchronized void logEvent(Context context, String name, String detail) {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PrayScreenChannel.PREFS, MODE_PRIVATE);
            org.json.JSONArray queue = new org.json.JSONArray(prefs.getString(PrayScreenChannel.KEY_EVENTS, "[]"));
            org.json.JSONObject e = new org.json.JSONObject();
            e.put("event", name);
            e.put("detail", detail);
            e.put("app", shieldApp == null ? "" : shieldApp);
            e.put("ts", System.currentTimeMillis());
            queue.put(e);
            org.json.JSONArray capped = new org.json.JSONArray();
            for (int i = Math.max(0, queue.length() - 80); i < queue.length(); i++) capped.put(queue.get(i));
            prefs.edit().putString(PrayScreenChannel.KEY_EVENTS, capped.toString()).apply();
        } catch (Exception ignored) { }
    }

    static void dismissShield() {
        MAIN.post(() -> {
            if (shieldView == null || shieldWindowManager == null) return;
            try { shieldWindowManager.removeView(shieldView); } catch (Exception ignored) { }
            shieldView = null;
            shieldWindowManager = null;
        });
    }

    private TextView text(String value, int sp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sp);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT_BOLD);
        return view;
    }

    private LinearLayout.LayoutParams lp(int top, int bottom) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT);
        p.setMargins(0, top, 0, bottom);
        return p;
    }

    private void createChannel() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL_ID,
                "PrayScreen Shield", NotificationManager.IMPORTANCE_LOW);
        channel.setDescription("Keeps the PrayScreen app guard active");
        NotificationManager manager = getSystemService(NotificationManager.class);
        if (manager != null) manager.createNotificationChannel(channel);
    }
}