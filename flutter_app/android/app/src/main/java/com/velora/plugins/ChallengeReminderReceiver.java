package com.velora.plugins;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;

import androidx.core.app.NotificationCompat;

import com.jesuswallpaperbible.app.MainActivity;
import com.jesuswallpaperbible.app.R;

/** Posts one 75 Days of Light reminder; a tap opens the challenge. */
public class ChallengeReminderReceiver extends BroadcastReceiver {

    public static final String ACTION_FIRE = "com.velora.challenge.FIRE";
    static final String CHANNEL = "challenge_reminder_v1";
    static final int NOTIF_ID = 9750;

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_FIRE.equals(intent.getAction())) return;
        Context app = context.getApplicationContext();
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");
        String route = intent.getStringExtra("route");
        if (title == null || title.isEmpty()) return;

        ensureChannel(app);

        Intent open = new Intent(app, MainActivity.class);
        open.putExtra("open_route", route == null || route.isEmpty() ? "/challenge" : route);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int f = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        PendingIntent tap = PendingIntent.getActivity(app, 9751, open, f);

        NotificationCompat.Builder b = new NotificationCompat.Builder(app, CHANNEL)
                .setSmallIcon(R.drawable.ic_stat_cross)
                .setColor(Color.parseColor("#E8C56B"))
                .setContentTitle(title)
                .setContentText(body)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
                .setCategory(NotificationCompat.CATEGORY_REMINDER)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setContentIntent(tap);
        NotificationManager nm = (NotificationManager) app.getSystemService(Context.NOTIFICATION_SERVICE);
        try { if (nm != null) nm.notify(NOTIF_ID, b.build()); } catch (Exception ignored) {}
    }

    static void ensureChannel(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL,
                ChallengeReminderScheduler.channelCopy(ctx, "name", "75 Days of Light"),
                NotificationManager.IMPORTANCE_DEFAULT);
        ch.setDescription(ChallengeReminderScheduler.channelCopy(ctx, "desc",
                "Morning and evening reminders for your daily challenge"));
        nm.createNotificationChannel(ch);
    }
}
