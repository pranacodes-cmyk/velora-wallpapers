package com.jesuswallpaperbible.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

public final class PrayScreenBootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        boolean enabled = context.getSharedPreferences(PrayScreenChannel.PREFS, Context.MODE_PRIVATE)
                .getBoolean(PrayScreenChannel.KEY_ENABLED, false);
        if (!enabled) return;
        Intent service = new Intent(context, PrayScreenGuardService.class);
        try {
            if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(service);
            else context.startService(service);
        } catch (RuntimeException ignored) {
            // Android may defer background starts after an OEM fast boot. The
            // next app launch restores the enabled service through the channel.
        }
    }
}