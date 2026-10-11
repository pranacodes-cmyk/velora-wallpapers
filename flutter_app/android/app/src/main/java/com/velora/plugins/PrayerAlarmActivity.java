package com.velora.plugins;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.view.WindowManager;
import android.view.animation.AccelerateDecelerateInterpolator;
import android.view.animation.LinearInterpolator;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;

import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

/**
 * Sacred Cathedral lockscreen alarm.
 *
 * Edge-to-edge full-screen activity that shows over the lock screen. Layered
 * gold rays radiating from the top behind a slowly-pulsing golden halo, a
 * luminous cross at the centre, large clock + verse, and a primary gold CTA.
 * Pure code — no XML — and respects system insets so nothing hides behind
 * the status bar or navigation bar.
 */
public class PrayerAlarmActivity extends Activity {

    // Brand palette (locked: Deep Midnight Navy + Royal Gold)
    private static final int NAVY_TOP    = Color.parseColor("#05060F");
    private static final int NAVY_MID    = Color.parseColor("#0A0E22");
    private static final int NAVY_LOW    = Color.parseColor("#101739");
    private static final int NAVY_BOTTOM = Color.parseColor("#070914");
    private static final int GOLD_BRIGHT = Color.parseColor("#F6D27A");
    private static final int GOLD        = Color.parseColor("#E8C56B");
    private static final int GOLD_DEEP   = Color.parseColor("#C9A24A");
    private static final int GOLD_INK    = Color.parseColor("#1A1306");
    private static final int TEXT_HIGH   = Color.parseColor("#F2EEDF");
    private static final int TEXT_MID    = Color.parseColor("#C7CFE6");
    private static final int TEXT_LOW    = Color.parseColor("#8892B2");

    private MediaPlayer player;
    private Vibrator vibrator;
    private PowerManager.WakeLock wakeLock;

    private View raysLayer;
    private View haloOuter;
    private View haloInner;
    private View crossGlow;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Edge-to-edge + show-over-lockscreen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (km != null) km.requestDismissKeyguard(this, null);
        } else {
            //noinspection deprecation
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
                    | WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        }
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            wakeLock = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK
                    | PowerManager.ACQUIRE_CAUSES_WAKEUP, "jwbp:prayer-alarm");
            wakeLock.acquire(60_000);
        }

        String label = getIntent().getStringExtra("label");
        if (label == null) label = "Prayer Time";
        String eyebrow = getIntent().getStringExtra("eyebrow");
        if (eyebrow == null) eyebrow = "PRAYER TIME";
        String body = getIntent().getStringExtra("body");
        if (body == null) body = "\u201CBe still, and know that I am God.\u201D\n— Psalm 46:10";
        String cta = getIntent().getStringExtra("cta");
        if (cta == null) cta = "✝   Open Prayer";
        String route = getIntent().getStringExtra("open_route");
        if (route == null || route.isEmpty()) route = "/devotional?from=alarm";
        boolean showSnooze = getIntent().getBooleanExtra("show_snooze", true);
        boolean sound = getIntent().getBooleanExtra("sound", true);

        setContentView(buildUi(label, eyebrow, body, cta, route, showSnooze));

        if (sound) startBell();
        startVibration();
        startHaloPulse();
        startRayRotation();
        startCrossGlow();

        // Auto-dismiss after 90s if the user walked away
        new Handler(Looper.getMainLooper()).postDelayed(this::safeFinish, 90_000);
    }

    private View buildUi(final String label, final String eyebrowText, final String bodyText, final String ctaText, final String route, final boolean showSnooze) {
        final float d = getResources().getDisplayMetrics().density;

        // ROOT — z-stacked frame layout
        FrameLayout root = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM,
                new int[]{ NAVY_TOP, NAVY_MID, NAVY_LOW, NAVY_BOTTOM });
        root.setBackground(bg);

        // ── Background gold rays radiating from top-center ──
        raysLayer = new RaysView(this, GOLD);
        FrameLayout.LayoutParams raysLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        root.addView(raysLayer, raysLp);

        // ── Soft top vignette glow ──
        View topGlow = new View(this);
        GradientDrawable topG = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM, new int[]{
                Color.parseColor("#33E8C56B"),
                Color.parseColor("#11E8C56B"),
                Color.parseColor("#00000000")
        });
        topGlow.setBackground(topG);
        FrameLayout.LayoutParams topGlowLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, (int) (320 * d));
        root.addView(topGlow, topGlowLp);

        // ── Bottom navy darkening so buttons read clean ──
        View bottomVignette = new View(this);
        GradientDrawable botG = new GradientDrawable(
                GradientDrawable.Orientation.TOP_BOTTOM, new int[]{
                Color.parseColor("#00000000"),
                Color.parseColor("#88000000"),
                Color.parseColor("#FF050714")
        });
        bottomVignette.setBackground(botG);
        FrameLayout.LayoutParams botLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, (int) (380 * d));
        botLp.gravity = Gravity.BOTTOM;
        root.addView(bottomVignette, botLp);

        // ── Content column — inset-padded ──
        final LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        content.setGravity(Gravity.CENTER_HORIZONTAL);
        int padH = (int) (28 * d);
        content.setPadding(padH, (int) (40 * d), padH, (int) (32 * d));
        FrameLayout.LayoutParams contentLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        root.addView(content, contentLp);

        // Apply system bar insets so nothing hides behind status/nav bars.
        ViewCompat.setOnApplyWindowInsetsListener(root, (v, insets) -> {
            Insets sys = insets.getInsets(WindowInsetsCompat.Type.systemBars()
                    | WindowInsetsCompat.Type.displayCutout());
            content.setPadding(padH, sys.top + (int) (24 * d), padH, sys.bottom + (int) (24 * d));
            return insets;
        });

        // ── Eyebrow (cross + brand) ──
        TextView eyebrow = new TextView(this);
        eyebrow.setText("✝   " + eyebrowText);
        eyebrow.setTextColor(GOLD);
        eyebrow.setTextSize(10.5f);
        eyebrow.setLetterSpacing(0.32f);
        eyebrow.setTypeface(Typeface.DEFAULT_BOLD);
        eyebrow.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams eyebrowLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        eyebrowLp.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(eyebrow, eyebrowLp);

        // Spacer to vertical-center the halo
        View spacerTop = new View(this);
        content.addView(spacerTop, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 0.9f));

        // ── Halo + cross ──
        int dialSize = (int) (300 * d);
        FrameLayout dial = new FrameLayout(this);
        LinearLayout.LayoutParams dialLp = new LinearLayout.LayoutParams(dialSize, dialSize);
        dialLp.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(dial, dialLp);

        // Outer soft glow
        haloOuter = new View(this);
        GradientDrawable glow = new GradientDrawable();
        glow.setShape(GradientDrawable.OVAL);
        glow.setColors(new int[]{
                Color.parseColor("#55F6D27A"),
                Color.parseColor("#1FE8C56B"),
                Color.parseColor("#00000000")
        });
        glow.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        glow.setGradientRadius(dialSize / 2f);
        haloOuter.setBackground(glow);
        dial.addView(haloOuter, new FrameLayout.LayoutParams(dialSize, dialSize));

        // Gold ring
        haloInner = new View(this);
        GradientDrawable ring = new GradientDrawable();
        ring.setShape(GradientDrawable.OVAL);
        ring.setColor(Color.parseColor("#0DE8C56B"));
        ring.setStroke((int) (1.5f * d), Color.parseColor("#88F6D27A"));
        haloInner.setBackground(ring);
        int ringSize = (int) (220 * d);
        FrameLayout.LayoutParams ringLp = new FrameLayout.LayoutParams(ringSize, ringSize);
        ringLp.gravity = Gravity.CENTER;
        dial.addView(haloInner, ringLp);

        // Inner navy disc
        View disc = new View(this);
        GradientDrawable inner = new GradientDrawable();
        inner.setShape(GradientDrawable.OVAL);
        inner.setColors(new int[]{
                Color.parseColor("#1B2247"),
                Color.parseColor("#08091B")
        });
        inner.setGradientType(GradientDrawable.RADIAL_GRADIENT);
        inner.setGradientRadius(ringSize / 1.6f);
        inner.setStroke((int) (1.2f * d), Color.parseColor("#66F6D27A"));
        disc.setBackground(inner);
        int discSize = (int) (180 * d);
        FrameLayout.LayoutParams discLp = new FrameLayout.LayoutParams(discSize, discSize);
        discLp.gravity = Gravity.CENTER;
        dial.addView(disc, discLp);

        // Cross glyph with glow
        crossGlow = new TextView(this);
        ((TextView) crossGlow).setText("✝");
        ((TextView) crossGlow).setTextColor(GOLD_BRIGHT);
        ((TextView) crossGlow).setTextSize(86);
        ((TextView) crossGlow).setTypeface(Typeface.create("serif", Typeface.NORMAL));
        ((TextView) crossGlow).setGravity(Gravity.CENTER);
        ((TextView) crossGlow).setShadowLayer(14f, 0f, 0f, Color.parseColor("#CCF6D27A"));
        FrameLayout.LayoutParams crossLp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        crossLp.gravity = Gravity.CENTER;
        dial.addView(crossGlow, crossLp);

        // ── Time & date below ──
        TextView time = new TextView(this);
        time.setText(new SimpleDateFormat("h:mm", Locale.getDefault()).format(new Date()));
        time.setTextColor(TEXT_HIGH);
        time.setTextSize(64);
        time.setTypeface(Typeface.create("sans-serif-thin", Typeface.NORMAL));
        time.setLetterSpacing(0.02f);
        time.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams timeLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        timeLp.topMargin = (int) (28 * d);
        timeLp.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(time, timeLp);

        TextView date = new TextView(this);
        date.setText(new SimpleDateFormat("EEEE · d MMMM", Locale.getDefault()).format(new Date()));
        date.setTextColor(TEXT_LOW);
        date.setTextSize(12);
        date.setLetterSpacing(0.18f);
        date.setTypeface(Typeface.DEFAULT_BOLD);
        date.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams dateLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        dateLp.topMargin = (int) (2 * d);
        dateLp.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(date, dateLp);

        // ── Streak chip (live count, same source as the daily reminder) ──
        TextView streakChip = new TextView(this);
        streakChip.setText(DailyReminderScheduler.streakLabel(this));
        streakChip.setTextColor(GOLD_BRIGHT);
        streakChip.setTextSize(13);
        streakChip.setTypeface(Typeface.DEFAULT_BOLD);
        streakChip.setGravity(Gravity.CENTER);
        streakChip.setPadding((int) (14 * d), (int) (6 * d), (int) (14 * d), (int) (6 * d));
        GradientDrawable chipBg = new GradientDrawable();
        chipBg.setCornerRadius(100 * d);
        chipBg.setColor(Color.parseColor("#26E8C56B"));
        chipBg.setStroke((int) (1 * d), Color.parseColor("#66E8C56B"));
        streakChip.setBackground(chipBg);
        LinearLayout.LayoutParams streakLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        streakLp.topMargin = (int) (10 * d);
        streakLp.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(streakChip, streakLp);

        // ── Label (Morning/Midday/Evening Prayer) ──
        TextView title = new TextView(this);
        title.setText(label);
        title.setTextColor(GOLD_BRIGHT);
        title.setTextSize(22);
        title.setTypeface(Typeface.create("serif", Typeface.NORMAL));
        title.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams titleLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        titleLp.topMargin = (int) (22 * d);
        titleLp.gravity = Gravity.CENTER_HORIZONTAL;
        content.addView(title, titleLp);

        // ── Verse ──
        TextView verse = new TextView(this);
        verse.setText(bodyText);
        verse.setTextColor(TEXT_MID);
        verse.setTextSize(14);
        verse.setLineSpacing((int) (3 * d), 1f);
        verse.setGravity(Gravity.CENTER);
        verse.setTypeface(Typeface.create("serif", Typeface.ITALIC));
        LinearLayout.LayoutParams verseLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        verseLp.topMargin = (int) (10 * d);
        content.addView(verse, verseLp);

        // Spacer pushes buttons toward bottom
        View spacerBottom = new View(this);
        content.addView(spacerBottom, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));

        // ── Primary CTA ──
        Button open = makeButton(ctaText, true, v -> {
            PrayerAlarmReceiver.cancelFollowUp(this);
            safeFinish();
            try {
                android.content.Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (i != null) {
                    i.addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK
                            | android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | android.content.Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    // MainActivity reads "open_route" and navigates the
                    // WebView via window.__openPrayerRoute(...).
                    i.putExtra("open_route", route);
                    startActivity(i);
                }
            } catch (Exception ignored) { /* ignore */ }
        });
        LinearLayout.LayoutParams openLp = new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        openLp.bottomMargin = (int) (10 * d);
        content.addView(open, openLp);

        // ── Outlined Dismiss ──
        Button close = makeButton("Dismiss", false, v -> {
            PrayerAlarmReceiver.cancelFollowUp(this);
            safeFinish();
        });
        content.addView(close, new LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        // ── Snooze text link ──
        if (showSnooze) {
            TextView snooze = new TextView(this);
            snooze.setText("Snooze 10 minutes");
            snooze.setTextColor(TEXT_LOW);
            snooze.setTextSize(13);
            snooze.setGravity(Gravity.CENTER);
            snooze.setPaintFlags(snooze.getPaintFlags() | Paint.UNDERLINE_TEXT_FLAG);
            int sp = (int) (12 * d);
            snooze.setPadding(sp, sp, sp, sp);
            snooze.setOnClickListener(v -> snooze10(label));
            LinearLayout.LayoutParams snoozeLp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            snoozeLp.gravity = Gravity.CENTER_HORIZONTAL;
            snoozeLp.topMargin = (int) (4 * d);
            content.addView(snooze, snoozeLp);
        }

        return root;
    }

    /* ─────────────── Animation ─────────────── */

    private void startHaloPulse() {
        if (haloOuter == null || haloInner == null) return;
        haloOuter.animate().scaleX(1.10f).scaleY(1.10f).alpha(0.55f)
                .setDuration(1800).setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(this::pulseBack).start();
        haloInner.animate().scaleX(1.05f).scaleY(1.05f)
                .setDuration(1800).setInterpolator(new AccelerateDecelerateInterpolator()).start();
    }

    private void pulseBack() {
        if (haloOuter == null || haloInner == null) return;
        haloOuter.animate().scaleX(1f).scaleY(1f).alpha(1f)
                .setDuration(1800).setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(this::startHaloPulse).start();
        haloInner.animate().scaleX(1f).scaleY(1f)
                .setDuration(1800).setInterpolator(new AccelerateDecelerateInterpolator()).start();
    }

    private void startCrossGlow() {
        if (crossGlow == null) return;
        crossGlow.animate().scaleX(1.06f).scaleY(1.06f).alpha(0.92f)
                .setDuration(2200).setInterpolator(new AccelerateDecelerateInterpolator())
                .withEndAction(() -> {
                    if (crossGlow == null) return;
                    crossGlow.animate().scaleX(1f).scaleY(1f).alpha(1f)
                            .setDuration(2200).setInterpolator(new AccelerateDecelerateInterpolator())
                            .withEndAction(this::startCrossGlow).start();
                }).start();
    }

    private void startRayRotation() {
        if (raysLayer == null) return;
        raysLayer.animate().rotationBy(360f).setDuration(120_000)
                .setInterpolator(new LinearInterpolator())
                .withEndAction(this::startRayRotation).start();
    }

    /* ─────────────── Buttons ─────────────── */

    private Button makeButton(String text, boolean primary, View.OnClickListener l) {
        float d = getResources().getDisplayMetrics().density;
        Button b = new Button(this);
        b.setText(text);
        b.setAllCaps(false);
        b.setTextSize(16);
        b.setOnClickListener(l);
        b.setTypeface(Typeface.create("sans-serif-medium", Typeface.NORMAL));
        GradientDrawable bgd = new GradientDrawable();
        bgd.setCornerRadius(34 * d);
        if (primary) {
            bgd.setOrientation(GradientDrawable.Orientation.LEFT_RIGHT);
            bgd.setColors(new int[]{ GOLD_BRIGHT, GOLD, GOLD_DEEP });
            b.setTextColor(GOLD_INK);
        } else {
            bgd.setColor(Color.parseColor("#22FFFFFF"));
            bgd.setStroke((int) (1.4f * d), Color.parseColor("#3D4670"));
            b.setTextColor(TEXT_HIGH);
        }
        b.setBackground(bgd);
        b.setPadding((int) (24 * d), (int) (18 * d), (int) (24 * d), (int) (18 * d));
        b.setStateListAnimator(null);
        return b;
    }

    private void snooze10(String label) {
        PrayerAlarmReceiver.cancelFollowUp(this);
        try {
            android.app.AlarmManager am = (android.app.AlarmManager) getSystemService(Context.ALARM_SERVICE);
            android.content.Intent intent = new android.content.Intent(this, PrayerAlarmReceiver.class);
            intent.setAction("com.velora.prayer.FIRE");
            intent.putExtra("label", label);
            intent.putExtra("sound", getIntent().getBooleanExtra("sound", false));
            intent.setData(android.net.Uri.parse("prayer://snooze"));
            int flags = android.app.PendingIntent.FLAG_UPDATE_CURRENT
                    | (Build.VERSION.SDK_INT >= 23 ? android.app.PendingIntent.FLAG_IMMUTABLE : 0);
            android.app.PendingIntent pi = android.app.PendingIntent.getBroadcast(this, 9777, intent, flags);
            long at = System.currentTimeMillis() + 10 * 60 * 1000L;
            if (am != null) {
                if (Build.VERSION.SDK_INT >= 23) am.setExactAndAllowWhileIdle(android.app.AlarmManager.RTC_WAKEUP, at, pi);
                else am.setExact(android.app.AlarmManager.RTC_WAKEUP, at, pi);
            }
        } catch (Throwable ignored) { /* ignore */ }
        safeFinish();
    }

    /* ─────────────── Audio / Vibration / Cleanup ─────────────── */

    private void startBell() {
        try {
            int resId = getResources().getIdentifier("divine_bell", "raw", getPackageName());
            if (resId == 0) return;
            player = MediaPlayer.create(this, resId);
            if (player == null) return;
            player.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            // Softer than a jarring full-volume alarm — this is a gentle
            // prayer reminder, not a fire drill. ~60% keeps it audible on
            // the lock screen without startling the user.
            player.setVolume(0.6f, 0.6f);
            player.setLooping(true);
            player.start();

        } catch (Exception ignored) { /* ignore */ }
    }

    private void startVibration() {
        try {
            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator == null) return;
            long[] pattern = { 0, 400, 800, 400, 800, 400, 1200 };
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                vibrator.vibrate(VibrationEffect.createWaveform(pattern, 0));
            } else {
                //noinspection deprecation
                vibrator.vibrate(pattern, 0);
            }
        } catch (Exception ignored) { /* ignore */ }
    }

    private void safeFinish() {
        try { if (player != null) { player.stop(); player.release(); player = null; } } catch (Exception ignored) {}
        try { if (vibrator != null) { vibrator.cancel(); } } catch (Exception ignored) {}
        try { if (wakeLock != null && wakeLock.isHeld()) wakeLock.release(); } catch (Exception ignored) {}
        // Also cancel the alarm notification so the heads-up + any lingering
        // channel sound disappear with the activity.
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(9710);
        } catch (Exception ignored) { /* ignore */ }
        finish();
    }

    @Override
    protected void onDestroy() {
        safeFinish();
        super.onDestroy();
    }

    /* ─────────────── Custom rays view ─────────────── */

    /**
     * Background ray-burst — 16 soft triangular wedges radiating from a
     * point above the halo. Painted with a translucent gold gradient so it
     * reads as cathedral light, not a starburst sticker.
     */
    static class RaysView extends View {
        private final Paint paint;
        private final android.graphics.Path path = new android.graphics.Path();

        RaysView(Context ctx, int color) {
            super(ctx);
            paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setStyle(Paint.Style.FILL);
            paint.setColor(color);
            paint.setAlpha(38);
        }

        @Override
        protected void onDraw(android.graphics.Canvas c) {
            super.onDraw(c);
            int w = getWidth();
            int h = getHeight();
            float cx = w / 2f;
            // Radiate from a point slightly above the visual halo center
            float cy = h * 0.36f;
            float reach = (float) Math.hypot(w, h) * 1.1f;

            int rays = 18;
            float wedge = 360f / rays;
            for (int i = 0; i < rays; i++) {
                float angle = i * wedge;
                float a1 = (float) Math.toRadians(angle - wedge * 0.18f);
                float a2 = (float) Math.toRadians(angle + wedge * 0.18f);
                path.reset();
                path.moveTo(cx, cy);
                path.lineTo(cx + (float) Math.cos(a1) * reach, cy + (float) Math.sin(a1) * reach);
                path.lineTo(cx + (float) Math.cos(a2) * reach, cy + (float) Math.sin(a2) * reach);
                path.close();
                c.drawPath(path, paint);
            }
        }
    }
}
