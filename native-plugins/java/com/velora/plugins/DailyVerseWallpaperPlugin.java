package com.velora.plugins;

import android.app.Activity;
import android.app.WallpaperInfo;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.Calendar;

/**
 * Capacitor bridge for the Daily Verse live wallpaper.
 *
 *   openPicker()  → launches Android's native live wallpaper preview
 *                   pre-selected on DailyVerseWallpaperService
 *   isActive()    → returns whether our service is the current wallpaper
 */
@CapacitorPlugin(name = "DailyVerseWallpaperPlugin")
public class DailyVerseWallpaperPlugin extends Plugin {

    private static final String R2_BASE = "https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/daily-verse/backgrounds";
    private static final int BG_COUNT = 20;
    private static final String CACHE_DIR = "daily-verse";
    private static final String STAMP_FILE = "cache.stamp";

    @PluginMethod
    public void openPicker(PluginCall call) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        try {
            ComponentName cn = new ComponentName(
                getContext(), DailyVerseWallpaperService.class
            );
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT, cn);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);

            JSObject result = new JSObject();
            result.put("success", true);
            call.resolve(result);
        } catch (Exception e) {
            // Fallback to generic live wallpaper chooser
            try {
                Intent intent = new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                JSObject result = new JSObject();
                result.put("success", true);
                result.put("fallback", true);
                call.resolve(result);
            } catch (Exception inner) {
                call.reject("Could not open wallpaper picker: " + inner.getMessage());
            }
        }
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        JSObject result = new JSObject();
        boolean active = false;
        try {
            WallpaperManager wm = WallpaperManager.getInstance(getContext());
            WallpaperInfo info = wm.getWallpaperInfo();
            if (info != null && info.getComponent() != null) {
                String pkg = info.getComponent().getPackageName();
                String cls = info.getComponent().getClassName();
                active = getContext().getPackageName().equals(pkg)
                    && DailyVerseWallpaperService.class.getName().equals(cls);
            }
        } catch (Exception ignored) {}
        result.put("active", active);
        call.resolve(result);
    }

    /**
     * Download all R2 backgrounds to internal storage so the live wallpaper
     * service can render fully offline (battery saver / Doze proof).
     * Emits "progress" events with { current, total } and resolves with
     * { success, downloaded, totalBytes, ageDays }.
     */
    @PluginMethod
    public void prefetchAssets(final PluginCall call) {
        final boolean force = Boolean.TRUE.equals(call.getBoolean("force", false));
        // Free users only need today's background — the live wallpaper only
        // ever renders one image until they re-apply, so downloading all 20
        // is wasteful bandwidth and confuses the user with a long progress UI.
        final boolean single = Boolean.TRUE.equals(call.getBoolean("single", false));
        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), CACHE_DIR);
                if (!dir.exists() && !dir.mkdirs()) {
                    call.reject("Could not create cache directory");
                    return;
                }

                int downloaded = 0;
                long totalBytes = 0;

                int[] targets;
                if (single) {
                    // Service picks bg index as (dayOfYear % 20) + 1 — MUST match DailyVerseWallpaperService.loadBackgroundForDay() and the JS preview in useVerseWallpaper.ts, otherwise the in-app preview shows one image while the applied wallpaper shows the fallback (yesterday's bg).
                    int today = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
                    targets = new int[]{ (today % 20) + 1 };
                } else {
                    targets = new int[BG_COUNT];
                    for (int i = 0; i < BG_COUNT; i++) targets[i] = i + 1;
                }

                int totalSteps = targets.length;
                for (int step = 0; step < totalSteps; step++) {
                    int i = targets[step];
                    final String name = String.format("bg-%02d.jpg", i);
                    File out = new File(dir, name);
                    if (!force && out.exists() && out.length() > 1024) {
                        totalBytes += out.length();
                        emitProgress(step + 1, totalSteps, name, true);
                        continue;
                    }

                    String url = R2_BASE + "/" + name;
                    long bytes = downloadTo(url, out);
                    if (bytes <= 0) {
                        emitProgress(step + 1, totalSteps, name, false);
                        continue;
                    }
                    downloaded++;
                    totalBytes += bytes;
                    emitProgress(step + 1, totalSteps, name, true);
                }

                // Write stamp so we know when last refresh happened (only when
                // we downloaded the full pack — single-bg prefetch shouldn't
                // mark the cache as "fresh for 7 days").
                if (!single) {
                    try {
                        File stamp = new File(dir, STAMP_FILE);
                        try (FileOutputStream fos = new FileOutputStream(stamp)) {
                            fos.write(String.valueOf(System.currentTimeMillis()).getBytes("UTF-8"));
                        }
                    } catch (Exception ignored) {}
                }

                JSObject result = new JSObject();
                result.put("success", true);
                result.put("downloaded", downloaded);
                result.put("total", totalSteps);
                result.put("totalBytes", totalBytes);
                result.put("cacheDir", dir.getAbsolutePath());
                result.put("single", single);
                call.resolve(result);
            } catch (Exception e) {
                call.reject("Prefetch failed: " + e.getMessage(), e);
            }
        }, "DailyVersePrefetch").start();
    }

    /**
     * Returns local cache state so the JS layer can decide whether to refresh.
     * { ready, downloaded, total, ageDays, lastSyncMs }
     */
    @PluginMethod
    public void getCacheStatus(PluginCall call) {
        JSObject result = new JSObject();
        try {
            File dir = new File(getContext().getFilesDir(), CACHE_DIR);
            int present = 0;
            long bytes = 0;
            for (int i = 1; i <= BG_COUNT; i++) {
                File f = new File(dir, String.format("bg-%02d.jpg", i));
                if (f.exists() && f.length() > 1024) {
                    present++;
                    bytes += f.length();
                }
            }
            long lastSync = 0;
            File stamp = new File(dir, STAMP_FILE);
            if (stamp.exists()) {
                try (InputStream is = new java.io.FileInputStream(stamp)) {
                    byte[] buf = new byte[64];
                    int read = is.read(buf);
                    if (read > 0) lastSync = Long.parseLong(new String(buf, 0, read, "UTF-8").trim());
                } catch (Exception ignored) {}
            }
            long ageMs = lastSync > 0 ? Math.max(0, System.currentTimeMillis() - lastSync) : -1;
            result.put("ready", present == BG_COUNT);
            result.put("downloaded", present);
            result.put("total", BG_COUNT);
            result.put("totalBytes", bytes);
            result.put("lastSyncMs", lastSync);
            result.put("ageDays", ageMs < 0 ? -1 : (int) (ageMs / (24L * 60 * 60 * 1000)));
        } catch (Exception e) {
            result.put("ready", false);
        }
        call.resolve(result);
    }

    /**
     * Mark today's verse as "unlocked" so the live wallpaper stops showing
     * the gold "✦ NEW VERSE TODAY" badge and renders today's verse. Called
     * after a free user successfully applies the wallpaper, or whenever Pro
     * activates. Also broadcasts a redraw so the change is visible instantly.
     */
    @PluginMethod
    public void markVerseUnlocked(PluginCall call) {
        try {
            Calendar c = Calendar.getInstance();
            SharedPreferences sp = getContext().getSharedPreferences(
                DailyVerseWallpaperService.PREFS, Context.MODE_PRIVATE
            );
            sp.edit()
                .putInt(DailyVerseWallpaperService.KEY_UNLOCKED_DAY, c.get(Calendar.DAY_OF_YEAR))
                .putInt(DailyVerseWallpaperService.KEY_UNLOCKED_YEAR, c.get(Calendar.YEAR))
                .apply();
            broadcastRedraw();
            JSObject r = new JSObject();
            r.put("success", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("markVerseUnlocked failed: " + e.getMessage(), e);
        }
    }

    /**
     * Tells the live wallpaper service whether the user is Premium. Pro users
     * never see the stale badge; their verse auto-updates every midnight.
     */
    @PluginMethod
    public void setPremium(PluginCall call) {
        boolean premium = Boolean.TRUE.equals(call.getBoolean("premium", false));
        try {
            SharedPreferences sp = getContext().getSharedPreferences(
                DailyVerseWallpaperService.PREFS, Context.MODE_PRIVATE
            );
            SharedPreferences.Editor ed = sp.edit();
            ed.putBoolean(DailyVerseWallpaperService.KEY_IS_PREMIUM, premium);
            if (premium) {
                // Pro reactivated → unfreeze any paused mood pack.
                ed.remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY);
                ed.remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR);
            } else {
                // Pro lapsed → if a mood pack is active, freeze it on today's
                // verse so we don't keep serving fresh pack content for free.
                // Default 365 rotation is already handled by KEY_UNLOCKED_DAY.
                String pack = sp.getString(DailyVerseWallpaperService.KEY_PACK_VERSES, null);
                if (pack != null && pack.length() > 2
                    && sp.getInt(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY, -1) <= 0) {
                    Calendar c = Calendar.getInstance();
                    ed.putInt(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY, c.get(Calendar.DAY_OF_YEAR));
                    ed.putInt(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR, c.get(Calendar.YEAR));
                }
            }
            ed.apply();
            broadcastRedraw();
            JSObject r = new JSObject();
            r.put("success", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("setPremium failed: " + e.getMessage(), e);
        }
    }

    /**
     * Push a mood-pack verse list to the live wallpaper service so the
     * lockscreen actually cycles through the user's chosen 30 verses instead
     * of the default 365-day rotation. Pass verses=null (or empty) to clear.
     */
    @PluginMethod
    public void setMoodPackVerses(PluginCall call) {
        try {
            String mood = call.getString("mood", "");
            JSArray versesArr = call.getArray("verses");
            SharedPreferences sp = getContext().getSharedPreferences(
                DailyVerseWallpaperService.PREFS, Context.MODE_PRIVATE
            );
            if (versesArr == null || versesArr.length() == 0) {
                sp.edit()
                    .remove(DailyVerseWallpaperService.KEY_PACK_VERSES)
                    .remove(DailyVerseWallpaperService.KEY_PACK_MOOD)
                    .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY)
                    .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR)
                    .apply();
            } else {
                JSONArray clean = new JSONArray();
                for (int i = 0; i < versesArr.length(); i++) {
                    JSONObject src = versesArr.getJSONObject(i);
                    JSONObject out = new JSONObject();
                    out.put("text", src.optString("text", ""));
                    out.put("reference", src.optString("reference", ""));
                    clean.put(out);
                }
                // New pack installed → drop any prior frozen marker so the
                // fresh pack flows from day 1.
                sp.edit()
                    .putString(DailyVerseWallpaperService.KEY_PACK_VERSES, clean.toString())
                    .putString(DailyVerseWallpaperService.KEY_PACK_MOOD, mood)
                    .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY)
                    .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR)
                    .apply();
            }
            broadcastRedraw();
            JSObject r = new JSObject();
            r.put("success", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("setMoodPackVerses failed: " + e.getMessage(), e);
        }
    }

    private void broadcastRedraw() {
        try {
            Intent intent = new Intent(DailyVerseWallpaperService.ACTION_REDRAW)
                .setPackage(getContext().getPackageName());
            getContext().sendBroadcast(intent);
        } catch (Exception ignored) {}
    }

    private void emitProgress(int current, int total, String name, boolean ok) {
        JSObject ev = new JSObject();
        ev.put("current", current);
        ev.put("total", total);
        ev.put("file", name);
        ev.put("ok", ok);
        notifyListeners("progress", ev);
    }

    private long downloadTo(String url, File out) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(url).openConnection();
            conn.setConnectTimeout(15000);
            conn.setReadTimeout(30000);
            conn.setUseCaches(true);
            conn.connect();
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) return -1;
            File tmp = new File(out.getParentFile(), out.getName() + ".part");
            try (InputStream in = conn.getInputStream();
                 OutputStream os = new FileOutputStream(tmp)) {
                byte[] buf = new byte[16 * 1024];
                int n;
                long bytes = 0;
                while ((n = in.read(buf)) > 0) {
                    os.write(buf, 0, n);
                    bytes += n;
                }
                os.flush();
                if (out.exists()) out.delete();
                if (!tmp.renameTo(out)) return -1;
                return bytes;
            }
        } catch (Exception e) {
            return -1;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
