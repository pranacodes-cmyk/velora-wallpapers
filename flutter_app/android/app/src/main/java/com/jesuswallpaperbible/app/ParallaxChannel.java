package com.jesuswallpaperbible.app;

import android.app.Activity;
import android.app.WallpaperInfo;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;

import com.velora.plugins.ParallaxLiveWallpaperService;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;

import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * MethodChannel bridge for the 3D parallax live wallpaper. Ported 1:1 from
 * the old Capacitor {@code ParallaxWallpaperPlugin}: stages bg/fg assets into
 * internal storage, then opens Android's live wallpaper picker pre-targeted at
 * {@link ParallaxLiveWallpaperService}.
 */
public class ParallaxChannel implements MethodChannel.MethodCallHandler {

    public static final String CHANNEL = "com.jesuswallpaperbible.app/parallax_wallpaper";
    public static final int REQUEST_CODE = 9102;

    private static final String TAG = "ParallaxWP";
    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 60000;
    private static final int BUFFER_SIZE = 8192;

    private final Activity activity;

    private MethodChannel.Result pendingResult;
    private String pendingSceneId;

    public ParallaxChannel(Activity activity) {
        this.activity = activity;
    }

    private Context ctx() {
        return activity.getApplicationContext();
    }

    @Override
    public void onMethodCall(MethodCall call, MethodChannel.Result result) {
        switch (call.method) {
            case "setParallaxWallpaper":
                setParallaxWallpaper(call, result);
                break;
            case "isActive":
                result.success(isActive());
                break;
            case "isCached": {
                String sceneId = call.argument("sceneId");
                File dir = sceneDir(sceneId == null ? "" : sceneId);
                File bg = new File(dir, "bg.jpg");
                File fg = new File(dir, "fg.png");
                Map<String, Object> res = new HashMap<>();
                res.put("cached", bg.exists() && bg.length() > 0 && fg.exists() && fg.length() > 0);
                result.success(res);
                break;
            }
            case "clearIfActive":
                result.success(clearIfActive());
                break;
            default:
                result.notImplemented();
        }
    }

    private void setParallaxWallpaper(MethodCall call, MethodChannel.Result result) {
        String sceneId = call.argument("sceneId");
        String bgUrl = call.argument("bgUrl");
        String fgUrl = call.argument("fgUrl");
        Boolean forceArg = call.argument("forceRefresh");
        Boolean wholeMoveArg = call.argument("wholeMove");
        String personalName = call.argument("personalName");
        String verseText = call.argument("verseText");
        String verseReference = call.argument("verseReference");
        int tintColor = parseTint(call.argument("tintColor"));

        boolean forceRefresh = forceArg != null && forceArg;
        boolean wholeMove = wholeMoveArg != null && wholeMoveArg;

        if (sceneId == null || sceneId.isEmpty() || bgUrl == null || fgUrl == null) {
            result.error("bad_args", "sceneId, bgUrl, and fgUrl are required", null);
            return;
        }

        SharedPreferences movePrefs = ctx().getSharedPreferences(
                ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        movePrefs.edit()
                .putBoolean(ParallaxLiveWallpaperService.KEY_WHOLE_MOVE_PREFIX + sceneId, wholeMove)
                .putString(ParallaxLiveWallpaperService.KEY_PERSONAL_NAME, personalName == null ? "" : personalName)
                .putString(ParallaxLiveWallpaperService.KEY_VERSE_TEXT, verseText == null ? "" : verseText)
                .putString(ParallaxLiveWallpaperService.KEY_VERSE_REFERENCE, verseReference == null ? "" : verseReference)
                .putInt(ParallaxLiveWallpaperService.KEY_TINT_COLOR, tintColor)
                .apply();

        File sceneDir = sceneDir(sceneId);
        if (!sceneDir.exists()) sceneDir.mkdirs();
        final File bgFile = new File(sceneDir, "bg.jpg");
        final File fgFile = new File(sceneDir, "fg.png");

        boolean cached = bgFile.exists() && bgFile.length() > 0
                && fgFile.exists() && fgFile.length() > 0;

        if (cached && !forceRefresh) {
            openPicker(result, sceneId);
            return;
        }

        final String scene = sceneId;
        new Thread(() -> {
            try {
                downloadTo(bgUrl, bgFile);
                downloadTo(fgUrl, fgFile);
                activity.runOnUiThread(() -> openPicker(result, scene));
            } catch (Exception e) {
                Log.e(TAG, "Scene download failed", e);
                if (bgFile.exists()) bgFile.delete();
                if (fgFile.exists()) fgFile.delete();
                activity.runOnUiThread(() ->
                        result.error("download_failed", "Failed to download scene: " + e.getMessage(), null));
            }
        }, "parallax-download").start();
    }

    private int parseTint(Object raw) {
        if (!(raw instanceof String)) return ParallaxLiveWallpaperService.DEFAULT_TINT;
        try {
            String h = ((String) raw).trim();
            if (!h.startsWith("#")) h = "#" + h;
            return android.graphics.Color.parseColor(h);
        } catch (Exception e) {
            return ParallaxLiveWallpaperService.DEFAULT_TINT;
        }
    }

    private void openPicker(MethodChannel.Result result, String sceneId) {
        SharedPreferences prefs = ctx().getSharedPreferences(
                ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(ParallaxLiveWallpaperService.KEY_PENDING_SCENE_ID, sceneId).apply();

        pendingResult = result;
        pendingSceneId = sceneId;

        try {
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    new ComponentName(ctx(), ParallaxLiveWallpaperService.class));
            activity.startActivityForResult(intent, REQUEST_CODE);
        } catch (Exception e) {
            Log.w(TAG, "Primary picker intent failed, using chooser", e);
            try {
                activity.startActivityForResult(
                        new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER), REQUEST_CODE);
            } catch (Exception ex) {
                pendingResult = null;
                pendingSceneId = null;
                result.error("picker_failed", "Failed to open wallpaper picker: " + ex.getMessage(), null);
            }
        }
    }

    /** Called from MainActivity.onActivityResult. */
    public void onPickerResult(int resultCode) {
        MethodChannel.Result result = pendingResult;
        String requestedSceneId = pendingSceneId;
        pendingResult = null;
        pendingSceneId = null;
        if (result == null) return;

        SharedPreferences prefs = ctx().getSharedPreferences(
                ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        String pending = prefs.getString(ParallaxLiveWallpaperService.KEY_PENDING_SCENE_ID, null);
        boolean confirmed = resultCode == Activity.RESULT_OK;

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

        Map<String, Object> res = new HashMap<>();
        res.put("success", true);
        res.put("applied", applied);
        res.put("sceneId", requestedSceneId);
        result.success(res);
    }

    private Map<String, Object> isActive() {
        SharedPreferences prefs = ctx().getSharedPreferences(
                ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
        String sceneId = prefs.getString(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID, null);
        Map<String, Object> res = new HashMap<>();
        res.put("active", sceneId != null);
        res.put("sceneId", sceneId);
        return res;
    }

    private Map<String, Object> clearIfActive() {
        Map<String, Object> res = new HashMap<>();
        try {
            WallpaperManager wm = WallpaperManager.getInstance(ctx());
            WallpaperInfo info = wm.getWallpaperInfo();
            boolean ours = false;
            if (info != null && info.getComponent() != null) {
                String pkg = info.getComponent().getPackageName();
                String cls = info.getComponent().getClassName();
                ours = ctx().getPackageName().equals(pkg)
                        && ParallaxLiveWallpaperService.class.getName().equals(cls);
            }
            SharedPreferences prefs = ctx().getSharedPreferences(
                    ParallaxLiveWallpaperService.PREFS_NAME, Context.MODE_PRIVATE);
            if (!ours) {
                prefs.edit().remove(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID).apply();
                res.put("cleared", false);
                res.put("reason", "not_active");
                return res;
            }
            try {
                wm.clear(WallpaperManager.FLAG_SYSTEM | WallpaperManager.FLAG_LOCK);
            } catch (NoSuchMethodError | AbstractMethodError e) {
                wm.clear();
            }
            prefs.edit().remove(ParallaxLiveWallpaperService.KEY_ACTIVE_SCENE_ID).apply();
            res.put("cleared", true);
            return res;
        } catch (Exception e) {
            Log.w(TAG, "clearIfActive failed", e);
            res.put("cleared", false);
            res.put("reason", e.getMessage());
            return res;
        }
    }

    private File sceneDir(String sceneId) {
        return new File(new File(ctx().getFilesDir(), "parallax"), sceneId);
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
