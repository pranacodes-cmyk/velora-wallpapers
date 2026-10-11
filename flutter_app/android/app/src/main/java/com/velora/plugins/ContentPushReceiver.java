package com.velora.plugins;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import android.widget.RemoteViews;

import androidx.core.app.NotificationCompat;

import com.jesuswallpaperbible.app.R;

import java.util.Calendar;
import java.util.Random;

/**
 * Daily content pushes: Morning Verse, Noon Quiz, Companion, Evening Journey.
 * Heads-up banners only — prayer bells keep the full-screen alarm path.
 * Ported unchanged from the Capacitor build so channels/ids/copy stay stable.
 */
public class ContentPushReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "com.velora.push.FIRE";
    public static final String ACTION_DISMISS = "com.velora.push.DISMISS";

    public static final String KIND_VERSE = "verse";
    public static final String KIND_QUIZ = "quiz";
    public static final String KIND_COMPANION = "companion";
    public static final String KIND_JOURNEY = "journey";
    public static final String EXTRA_BYPASS_GUARDS = "bypass_guards";

    private static final String CH_VERSE = "prayly_verse_v9";
    private static final String CH_QUIZ = "prayly_quiz_v9";
    private static final String CH_COMPANION = "prayly_companion_v9";
    private static final String CH_JOURNEY = "prayly_journey_v9";

    // ── anti-spam guardrails ────────────────────────────────────────────────
    public static final String GUARD_PREFS = "prayly_content_push_guard";
    public static final String K_LAST_OPEN = "last_app_open_at";
    public static final String K_CAP_DAY = "cap_day";
    public static final String K_CAP_COUNT = "cap_count";
    private static final int DAILY_CAP = 4;
    private static final int DAILY_CAP_PRO = 2;
    private static final int QUIET_START_HOUR = 22;
    private static final int QUIET_END_HOUR = 6;
    private static final int QUIET_END_MINUTE = 30;

    public static final String PREFS_PRO = "prayly_premium_state";
    public static final String K_PRO_MODE = "pro_mode";

    private boolean isProMode(Context ctx) {
        try {
            return ctx.getSharedPreferences(PREFS_PRO, Context.MODE_PRIVATE)
                    .getBoolean(K_PRO_MODE, false);
        } catch (Exception e) { return false; }
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        if (intent == null || intent.getAction() == null) return;
        final BroadcastReceiver.PendingResult pending = goAsync();
        final Context appContext = ctx.getApplicationContext();
        final Intent safeIntent = new Intent(intent);
        new Thread(() -> {
            try {
                handleReceive(appContext, safeIntent);
            } finally {
                pending.finish();
            }
        }, "content-push-receiver").start();
    }

    private void handleReceive(Context ctx, Intent intent) {
        String kind = intent.getStringExtra("kind");
        if (kind == null) kind = KIND_VERSE;

        if (ACTION_DISMISS.equals(intent.getAction())) {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancel(notificationIdFor(kind));
            return;
        }

        if (!ACTION_FIRE.equals(intent.getAction())) return;

        boolean bypassGuards = intent.getBooleanExtra(EXTRA_BYPASS_GUARDS, false);
        if (!bypassGuards) {
            try { ContentPushScheduler.scheduleFromPrefs(ctx); } catch (Exception ignored) {}
        }
        if (!bypassGuards && !shouldFire(ctx, kind)) return;

        ensureChannel(ctx, kind);
        post(ctx, kind);
        if (!bypassGuards) bumpDailyCount(ctx);
    }

    /** Quiet hours + hard daily cap + Pro suppression. */
    private boolean shouldFire(Context ctx, String kind) {
        boolean pro = isProMode(ctx);
        if (pro && KIND_VERSE.equals(kind)) return false;

        Calendar now = Calendar.getInstance();
        int h = now.get(Calendar.HOUR_OF_DAY);
        int m = now.get(Calendar.MINUTE);
        if (h >= QUIET_START_HOUR) return false;
        if (h < QUIET_END_HOUR) return false;
        if (h == QUIET_END_HOUR && m < QUIET_END_MINUTE) return false;

        SharedPreferences sp = ctx.getSharedPreferences(GUARD_PREFS, Context.MODE_PRIVATE);
        int today = now.get(Calendar.YEAR) * 1000 + now.get(Calendar.DAY_OF_YEAR);
        int capDay = sp.getInt(K_CAP_DAY, -1);
        int capCount = capDay == today ? sp.getInt(K_CAP_COUNT, 0) : 0;
        return capCount < (pro ? DAILY_CAP_PRO : DAILY_CAP);
    }

    private void bumpDailyCount(Context ctx) {
        Calendar now = Calendar.getInstance();
        int today = now.get(Calendar.YEAR) * 1000 + now.get(Calendar.DAY_OF_YEAR);
        SharedPreferences sp = ctx.getSharedPreferences(GUARD_PREFS, Context.MODE_PRIVATE);
        int capDay = sp.getInt(K_CAP_DAY, -1);
        int capCount = capDay == today ? sp.getInt(K_CAP_COUNT, 0) : 0;
        sp.edit().putInt(K_CAP_DAY, today).putInt(K_CAP_COUNT, capCount + 1).apply();
    }

    static void recordAppOpen(Context ctx) {
        ctx.getSharedPreferences(GUARD_PREFS, Context.MODE_PRIVATE)
                .edit().putLong(K_LAST_OPEN, System.currentTimeMillis()).apply();
    }

    static String channelNameFor(String kind) {
        if (KIND_QUIZ.equals(kind)) return "Daily Bible Quiz";
        if (KIND_COMPANION.equals(kind)) return "Bible Companion";
        if (KIND_JOURNEY.equals(kind)) return "Evening Journey";
        return "Morning Verse";
    }

    static String channelFor(String kind) {
        if (KIND_QUIZ.equals(kind)) return CH_QUIZ;
        if (KIND_COMPANION.equals(kind)) return CH_COMPANION;
        if (KIND_JOURNEY.equals(kind)) return CH_JOURNEY;
        return CH_VERSE;
    }

    private void ensureChannel(Context ctx, String kind) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        String id = channelFor(kind);
        if (nm.getNotificationChannel(id) != null) return;
        NotificationChannel ch = new NotificationChannel(id, channelNameFor(kind), NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Daily devotional invitations from Prayly.");
        ch.enableLights(true);
        ch.setLightColor(Color.parseColor("#E8C56B"));
        ch.enableVibration(true);
        ch.setVibrationPattern(new long[]{ 0, 180, 120, 180 });
        ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        ch.setShowBadge(true);
        try {
            Uri sound = Uri.parse("android.resource://" + ctx.getPackageName() + "/raw/cathedral_bell");
            AudioAttributes attrs = new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build();
            ch.setSound(sound, attrs);
        } catch (Exception ignored) { /* default sound */ }
        nm.createNotificationChannel(ch);
    }

    private void post(Context ctx, String kind) {
        String[] copy = pickCopy(kind);
        String title = copy[0];
        String body = copy[1];
        String cta = copy[2];
        String route = copy[3];
        int notifId = notificationIdFor(kind);

        int piFlags = PendingIntent.FLAG_UPDATE_CURRENT
                | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);

        Intent openIntent = ctx.getPackageManager().getLaunchIntentForPackage(ctx.getPackageName());
        if (openIntent == null) openIntent = new Intent();
        openIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
                | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        openIntent.putExtra("open_route", route);
        openIntent.setData(Uri.parse("prayly://push/" + kind + "/" + System.currentTimeMillis()));
        PendingIntent openPi = PendingIntent.getActivity(ctx, notifId, openIntent, piFlags);

        Intent closeIntent = new Intent(ctx, ContentPushReceiver.class);
        closeIntent.setAction(ACTION_DISMISS);
        closeIntent.putExtra("kind", kind);
        closeIntent.setData(Uri.parse("prayly://push/dismiss/" + kind));
        PendingIntent closePi = PendingIntent.getBroadcast(ctx, notifId + 200, closeIntent, piFlags);

        String ctaLabel = (cta == null || cta.isEmpty()) ? "Open" : cta;

        RemoteViews collapsed = new RemoteViews(ctx.getPackageName(), R.layout.content_push_notification);
        RemoteViews headsUp = new RemoteViews(ctx.getPackageName(), R.layout.content_push_notification);
        for (RemoteViews rv : new RemoteViews[]{ collapsed, headsUp }) {
            rv.setTextViewText(R.id.content_push_title, title);
            rv.setTextViewText(R.id.content_push_body, body);
            rv.setTextViewText(R.id.content_push_kind, channelNameFor(kind));
            rv.setTextViewText(R.id.content_push_cta, ctaLabel);
            rv.setImageViewResource(R.id.content_push_glyph, glyphFor(kind));
            rv.setOnClickPendingIntent(R.id.content_push_cta, openPi);
            rv.setOnClickPendingIntent(R.id.content_push_close, closePi);
        }

        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, channelFor(kind))
                .setSmallIcon(R.drawable.ic_stat_cross)
                .setColor(Color.parseColor("#E8C56B"))
                .setContentTitle(title)
                .setContentText(body)
                .setCustomContentView(collapsed)
                .setCustomHeadsUpContentView(headsUp)
                .setCustomBigContentView(headsUp)
                .setTicker(title)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setOnlyAlertOnce(false)
                .setDefaults(NotificationCompat.DEFAULT_LIGHTS | NotificationCompat.DEFAULT_VIBRATE)
                .setVibrate(new long[]{ 0, 180, 120, 180 })
                .setWhen(System.currentTimeMillis())
                .setShowWhen(true)
                .setContentIntent(openPi)
                .setTimeoutAfter(60_000L)
                .setDeleteIntent(closePi);

        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        try {
            nm.notify(notifId, b.build());
        } catch (Throwable ignored) { /* unrecoverable */ }
    }

    private int notificationIdFor(String kind) {
        if (KIND_QUIZ.equals(kind)) return 8222;
        if (KIND_COMPANION.equals(kind)) return 8223;
        if (KIND_JOURNEY.equals(kind)) return 8224;
        return 8221;
    }

    private int glyphFor(String kind) {
        if (KIND_QUIZ.equals(kind)) return R.drawable.ic_push_quiz;
        if (KIND_COMPANION.equals(kind)) return R.drawable.ic_push_companion;
        if (KIND_JOURNEY.equals(kind)) return R.drawable.ic_push_journey;
        return R.drawable.ic_push_verse;
    }

    /** Returns {title, body, cta, route}. Rotates once per day. */
    private String[] pickCopy(String kind) {
        Random r = new Random(System.currentTimeMillis() / (1000L * 60 * 60 * 24));
        if (KIND_QUIZ.equals(kind)) {
            String[][] pool = {
                {"Who walked on water? 🌊", "True or false — it was Peter. Tap to answer.", "Answer"},
                {"Quick: who built the ark?", "One tap. See if you're right.", "Guess"},
                {"How many days did Jesus fast?", "30, 40, or 50? Tap your answer.", "Play"},
                {"True or false ✦", "David was a king before he fought Goliath.", "Decide"},
                {"Name the first miracle of Jesus 🍷", "Most people get this wrong. Do you?", "Try"},
                {"Who betrayed Jesus for 30 silver coins?", "You know this one. Prove it.", "Answer"},
                {"How many disciples did Jesus have?", "Quick tap — no thinking needed.", "Play"},
                {"⚡ Which book comes first — Genesis or Exodus?", "Warm-up question. Tap fast.", "Go"},
                {"True or false: Jonah was swallowed by a shark.", "Read it again — tap your answer.", "Decide"},
                {"Who was thrown in the lions' den? 🦁", "Tap the name. One second.", "Answer"},
                {"How old was Noah when the flood came?", "Closer than you'd think. Guess.", "Play"},
                {"Where was Jesus born? 🌟", "Easy one — keep the streak alive.", "Tap"},
                {"Who turned into a pillar of salt?", "Old Testament classic. Remember?", "Try"},
                {"🔥 One question. Don't break the streak.", "Tap before midnight.", "Continue"},
            };
            String[] p = pool[r.nextInt(pool.length)];
            return new String[]{ p[0], p[1], p[2], "/quiz?from=push" };
        }
        if (KIND_COMPANION.equals(kind)) {
            String[][] pool = {
                {"Father is calling you 🤍", "Come, sit with Him for a moment.", "Open"},
                {"Feeling tired? Speak to Him.", "Lay it down here — He's listening.", "Talk"},
                {"Pray for someone today 🙏", "Bring one name before the Father.", "Pray"},
                {"Heavy heart?", "Cast it on Him — He cares for you.", "Open"},
                {"He hears every worry you carry", "Tell Him one thing right now.", "Speak"},
                {"You don't have to hold it alone", "Bring it to the Father. He's near.", "Open"},
                {"Someone you love needs prayer 🙏", "Lift their name to Him in 30 seconds.", "Pray"},
                {"Tired of the noise?", "One quiet word with Him. That's all.", "Open"},
                {"He's been waiting to hear from you", "Even one sentence is enough.", "Speak"},
                {"Anxious today? 🤍", "He says: do not be afraid. Come talk.", "Open"},
                {"What's weighing on you?", "Tell the Father — He's already listening.", "Talk"},
                {"Need clarity?", "Ask Him. He gives wisdom freely.", "Ask"},
                {"Pray for your family tonight 🕊️", "One short prayer. Big love.", "Pray"},
                {"He sees you — even today", "Come, rest in His presence for a moment.", "Open"},
            };
            String[] p = pool[r.nextInt(pool.length)];
            return new String[]{ p[0], p[1], p[2], "/companion?from=push" };
        }
        if (KIND_JOURNEY.equals(kind)) {
            String[][] pool = {
                {"Your journey is waiting for you 🌿", "Don't lose what you've built. 5 minutes tonight.", "Continue"},
                {"One day closer to peace ✨", "Pick up your journey where you left off.", "Open"},
                {"He has the next step ready for you", "Tonight's chapter was written for today.", "Read"},
                {"🔥 Don't break your journey streak", "One short reading keeps it alive.", "Continue"},
                {"You started this for a reason", "Take the next step before bed.", "Open"},
                {"🌙 End the day with Him", "Your next journey day is short and powerful.", "Read"},
                {"A breakthrough is one day away", "Keep walking — tonight's reading is ready.", "Continue"},
                {"Your soul has been waiting all day", "Five minutes in the Word before sleep.", "Open"},
                {"Pick up where He met you last", "Tonight's chapter is gentle and deep.", "Read"},
                {"📜 Don't quit on the verge", "One more day on the journey. You've got this.", "Continue"},
                {"He wants to speak to you tonight", "Open the next page of your journey.", "Open"},
                {"Close the day in His presence", "Short reading. Lasting peace.", "Read"},
                {"You're not walking alone 🤍", "Continue the journey — He's right beside you.", "Continue"},
                {"Tonight's reflection is waiting", "Five quiet minutes with the Father.", "Begin"},
            };
            String[] p = pool[r.nextInt(pool.length)];
            return new String[]{ p[0], p[1], p[2], "/journeys?from=push" };
        }
        String[][] pool = {
            {"He listens to every worry 🤍", "Today's verse is His answer for you.", "Open"},
            {"Tired? His Word is rest.", "One verse. One breath. Everything lighter.", "Read"},
            {"Set down today's weight", "He wrote this verse for a day like today.", "Open"},
            {"🌅 He's already thinking of you", "Open the verse He picked for this morning.", "Reveal"},
            {"Don't carry it alone today", "Today's Scripture is His promise to you.", "Read"},
            {"A word for the worried heart", "30 seconds. Real peace.", "Open"},
            {"He sees you this morning ✨", "Today's verse is just for you.", "Reveal"},
            {"Anxious? Open this first.", "Let His Word be the first voice today.", "Read"},
            {"📖 Get free from today's worry", "One verse can change the whole day.", "Open"},
            {"Before the noise — hear Him", "Today's verse is soft, short, true.", "Read"},
            {"He has something to say to you", "Open today's verse before anything else.", "Reveal"},
            {"A blessing is waiting in your phone", "Tap to receive today's verse.", "Open"},
            {"☀️ Start with peace, not panic", "His Word for today is ready.", "Read"},
            {"He kept this verse for you", "Open it before the day opens you.", "Reveal"},
        };
        String[] p = pool[r.nextInt(pool.length)];
        return new String[]{ p[0], p[1], p[2], "/?openReflection=1&from=push" };
    }
}
