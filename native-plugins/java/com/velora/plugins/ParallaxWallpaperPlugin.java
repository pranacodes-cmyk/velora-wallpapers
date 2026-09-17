package com.velora.plugins;

import android.app.Activity;
import android.app.WallpaperInfo;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Capacitor plugin that stages parallax scene assets (bg + fg) into
 * internal storage and launches the native Android live wallpaper picker
 * pre-targeted at {@link ParallaxLiveWallpaperService}.
 *
 * JS API:
 *   setParallaxWallpaper({ sceneId, bgUrl, fgUrl, forceRefresh? })
 *   isActive()
 *   isCached({ sceneId })
 */
@CapacitorPlugin(name = "ParallaxWallpaperPlugin")
public class ParallaxWallpaperPlugin extends Plugin {

    private static final String TAG = "ParallaxWP";
    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 60000;
    private static final int BUFFER_SIZE = 8192;

    @PluginMethod
    public void setParallaxWallpaper(PluginCall call) {
        String sceneId = call.getString("sceneId");
        String bgUrl = call.getString("bgUrl");
        String fgUrl = call.getString("fgUrl");
        boolean forceRefresh = call.getBoolean("forceRefresh", false);
        boolean wholeMove = call.getBoolean("wholeMove", false);
        String personalName = call.getString("personalName", "");
        String verseText = call.getString("verseText", "");
        String verseReference = call.getString("verseReference", "");
        // Glow / god-ray / dust colour chosen by the user (hex "#RRGGBB").
        int tintColor = parseTint(call.getString("tintColor", null));

        if (sceneId == null || sceneId.isEmpty() || bgUrl == null || fgUrl == null) {
            call.reject("sceneId, bgUrl, and fgUrl are required");
            return;
        }

        // Persist per-scene whole-move flag + personalization so the wallpaper
        // service can render them (name + verse engraving on the lockscreen).
        SharedPreferences movePrefs = getContext().getSharedPreferences(
            ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        movePrefs.edit()
            .putBoolean(ParallaxLiveWallpaperService.KEY_WHOLE_MOVE_PREFIX + sceneId, wholeMove)
            .putString(ParallaxLiveWallpaperService.KEY_PERSONAL_NAME, personalName == null ? "" : personalName)
            .putString(ParallaxLiveWallpaperService.KEY_VERSE_TEXT, verseText == null ? "" : verseText)
            .putString(ParallaxLiveWallpaperService.KEY_VERSE_REFERENCE, verseReference == null ? "" : verseReference)
            .putInt(ParallaxLiveWallpaperService.KEY_TINT_COLOR, tintColor)
            .apply();

        File sceneDir = getSceneDir(sceneId);
        if (!sceneDir.exists()) sceneDir.mkdirs();
        File bgFile = new File(sceneDir, "bg.jpg");
        File fgFile = new File(sceneDir, "fg.png");

        boolean cached = bgFile.exists() && bgFile.length() > 0
                       && fgFile.exists() && fgFile.length() > 0;

        if (cached && !forceRefresh) {
            Log.d(TAG, "Scene cached: " + sceneId);
            openPickerOnUi(call, sceneId);
            return;
        }

        new Thread(() -> {
            try {
                downloadTo(bgUrl, bgFile);
                downloadTo(fgUrl, fgFile);
                openPickerOnUi(call, sceneId);
            } catch (Exception e) {
                Log.e(TAG, "Scene download failed", e);
                if (bgFile.exists()) bgFile.delete();
                if (fgFile.exists()) fgFile.delete();
                Activity activity = getActivity();
                if (activity != null) {
                    activity.runOnUiThread(() -> call.reject("Failed to download scene: " + e.getMessage()));
                } else {
                    call.reject("Failed to download scene: " + e.getMessage());
                }
            }
        }, "parallax-download").start();
    }

    /** Parses "#RRGGBB" / "RRGGBB" into an ARGB int, falling back to royal gold. */
    private int parseTint(String hex) {
        if (hex == null) return ParallaxLiveWallpaperService.DEFAULT_TINT;
        try {
            String h = hex.trim();
            if (!h.startsWith("#")) h = "#" + h;
            return android.graphics.Color.parseColor(h);
        } catch (Exception e) {
            return ParallaxLiveWallpaperService.DEFAULT_TINT;
        }
    }

    private void openPickerOnUi(PluginCall call, String sceneId) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("Activity unavailable");
            return;
        }
        activity.runOnUiThread(() -> openPicker(call, sceneId));
    }

    private void openPicker(PluginCall call, String sceneId) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(ParallaxLiveWallpaperService.KEY_PENDING_SCENE_ID, sceneId)
            .apply();

        try {
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(
                WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                new ComponentName(getContext(), ParallaxLiveWallpaperService.class)
            );
            startActivityForResult(call, intent, "parallaxPickerResult");
        } catch (Exception e) {
            Log.w(TAG, "Primary picker intent failed, using chooser", e);
            try {
                Intent fallback = new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER);
                startActivityForResult(call, fallback, "parallaxPickerResult");
            } catch (Exception ex) {
                call.reject("Failed to open wallpaper picker: " + ex.getMessage());
            }
        }
    }

    @ActivityCallback
    private void parallaxPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) return;

        SharedPreferences prefs = getContext().getSharedPreferences(
            ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        String pending = prefs.getString(ParallaxLiveWallpaperService.KEY_PENDING_SCENE_ID, null);
        String requestedSceneId = call.getString("sceneId", pending);
        boolean confirmed = result.getResultCode() == Activity.RESULT_OK;

        if (confirmed && pending != null) {
            prefs.edit()
                .putString(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID, pending)
                .remove(ParallaxLiveWallpaperService.KEY_PENDING_SCENE_ID)
                .apply();
        } else if (!confirmed) {
            prefs.edit().remove(ParallaxLiveWallpaperService.KEY_PENDING_SCENE_ID).apply();
        }

        String activeSceneId = prefs.getString(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID, null);
        boolean applied = confirmed && requestedSceneId != null && requestedSceneId.equals(activeSceneId);

        JSObject res = new JSObject();
        res.put("success", true);
        res.put("applied", applied);
        res.put("sceneId", requestedSceneId);
        call.resolve(res);
    }

    @PluginMethod
    public void isActive(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(
            ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        String sceneId = prefs.getString(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID, null);

        JSObject res = new JSObject();
        res.put("active", sceneId != null);
        res.put("sceneId", sceneId);
        call.resolve(res);
    }

    @PluginMethod
    public void isCached(PluginCall call) {
        String sceneId = call.getString("sceneId", "");
        File dir = getSceneDir(sceneId);
        File bg = new File(dir, "bg.jpg");
        File fg = new File(dir, "fg.png");

        JSObject res = new JSObject();
        res.put("cached", bg.exists() && bg.length() > 0 && fg.exists() && fg.length() > 0);
        call.resolve(res);
    }

    /**
     * If our parallax service is the currently active system live
     * wallpaper, remove it and let Android fall back to the default.
     * Used when the user loses Pro so we don't keep serving a paid
     * wallpaper. No-op if a different (third-party) wallpaper is
     * active, so we never overwrite the user's choice.
     */
    @PluginMethod
    public void clearIfActive(PluginCall call) {
        JSObject res = new JSObject();
        try {
            WallpaperManager wm = WallpaperManager.getInstance(getContext());
            WallpaperInfo info = wm.getWallpaperInfo();
            boolean ours = false;
            if (info != null && info.getComponent() != null) {
                String pkg = info.getComponent().getPackageName();
                String cls = info.getComponent().getClassName();
                ours = getContext().getPackageName().equals(pkg)
                    && ParallaxLiveWallpaperService.class.getName().equals(cls);
            }
            if (!ours) {
                // Also clear our own bookkeeping so isActive() returns
                // false — otherwise the JS layer will keep thinking the
                // parallax scene is still live.
                try {
                    SharedPreferences prefs = getContext().getSharedPreferences(
                        ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
                    prefs.edit()
                        .remove(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID)
                        .apply();
                } catch (Exception ignored) {}
                res.put("cleared", false);
                res.put("reason", "not_active");
                call.resolve(res);
                return;
            }
            try {
                wm.clear(WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK);
            } catch (NoSuchMethodError | AbstractMethodError e) {
                // Very old devices lacking the flags overload — fall back
                // to the classic single-target clear (removes home; some
                // OEMs also drop the lockscreen wallpaper).
                wm.clear();
            }
            try {
                SharedPreferences prefs = getContext().getSharedPreferences(
                    ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit()
                    .remove(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID)
                    .apply();
            } catch (Exception ignored) {}
            res.put("cleared", true);
            call.resolve(res);
        } catch (Exception e) {
            Log.w(TAG, "clearIfActive failed", e);
            res.put("cleared", false);
            res.put("reason", e.getMessage());
            call.resolve(res);
        }
    }

    private File getSceneDir(String sceneId) {
        return new File(new File(getContext().getFilesDir(), "parallax"), sceneId);
    }

    private void downloadTo(String url, File target) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(CONNECT_TIMEOUT);
        conn.setReadTimeout(READ_TIMEOUT);
        conn.setRequestProperty("User-Agent", "PraylyParallax/1.0");
        conn.connect();

        int code = conn.getResponseCode();
        if (code != HttpURLConnection.HTTP_OK) {
            conn.disconnect();
            throw new Exception("HTTP " + code + " for " + url);
        }

        File tmp = new File(target.getParentFile(), target.getName() + ".tmp");
        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(tmp)) {
            byte[] buf = new byte[BUFFER_SIZE];
            int n;
            while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
            out.flush();
        } finally {
            conn.disconnect();
        }

        if (tmp.exists() && tmp.length() > 0) {
            if (target.exists()) target.delete();
            tmp.renameTo(target);
        } else {
            tmp.delete();
            throw new Exception("Downloaded file empty: " + url);
        }
    }
}
