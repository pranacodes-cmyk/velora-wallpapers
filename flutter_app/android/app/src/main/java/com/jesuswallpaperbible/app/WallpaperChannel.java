package com.jesuswallpaperbible.app;

import android.app.Activity;
import android.app.WallpaperInfo;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Point;
import android.os.Build;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.WindowManager;

import com.velora.plugins.DailyVerseWallpaperService;
import com.velora.plugins.VideoWallpaperService;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Calendar;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import io.flutter.plugin.common.MethodCall;
import io.flutter.plugin.common.MethodChannel;

/**
 * MethodChannel bridge for static wallpapers, video live wallpapers and the
 * Daily Verse live wallpaper. Ported 1:1 from the Capacitor plugins
 * {@code WallpaperSetterPlugin}, {@code LiveWallpaperPlugin} and
 * {@code DailyVerseWallpaperPlugin} — same prefs, cache folders and picker
 * flow, so an existing install keeps its cached videos and active wallpaper.
 */
public class WallpaperChannel implements MethodChannel.MethodCallHandler {

    public static final String CHANNEL = "com.jesuswallpaperbible.app/wallpaper";
    public static final int REQUEST_CODE = 9101;

    private static final String TAG = "WallpaperChannel";
    private static final int MAX_DOWNLOAD_BYTES = 24 * 1024 * 1024;
    private static final ExecutorService IO_EXECUTOR = Executors.newFixedThreadPool(2);

    // live wallpaper prefs (identical to LiveWallpaperPlugin)
    private static final String LIVE_PREFS = "live_wallpaper_prefs";
    private static final String KEY_VIDEO_PATH = "active_video_path";
    private static final String KEY_VIDEO_ID = "active_video_id";
    private static final String KEY_PENDING_PATH = "pending_video_path";
    private static final String KEY_PENDING_ID = "pending_video_id";
    private static final int BUFFER_SIZE = 8192;
    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 60000;

    // daily verse background cache (identical to DailyVerseWallpaperPlugin)
    private static final String DV_R2_BASE =
            "https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/daily-verse/backgrounds";
    private static final int DV_BG_COUNT = 20;
    private static final String DV_CACHE_DIR = "daily-verse";
    private static final String DV_STAMP_FILE = "cache.stamp";

    private final Activity activity;
    private MethodChannel.Result pendingResult;
    private String pendingVideoId;

    public WallpaperChannel(Activity activity) {
        this.activity = activity;
    }

    private Context ctx() {
        return activity.getApplicationContext();
    }

    @Override
    public void onMethodCall(MethodCall call, MethodChannel.Result result) {
        switch (call.method) {
            case "setStatic":
                setStatic(call, result);
                break;
            case "setLive":
                setLive(call, result);
                break;
            case "isLiveCached": {
                String videoId = call.argument("videoId");
                File f = new File(liveDir(), (videoId == null ? "" : videoId) + ".mp4");
                result.success(f.exists() && f.length() > 0);
                break;
            }
            case "setDailyVerse":
                openDailyVersePicker(result);
                break;
            case "dailyVerseIsActive":
                result.success(isDailyVerseActive());
                break;
            case "dailyVersePrefetch":
                dailyVersePrefetch(call, result);
                break;
            case "dailyVerseCacheStatus":
                result.success(dailyVerseCacheStatus());
                break;
            case "dailyVerseMarkUnlocked":
                markVerseUnlocked();
                result.success(true);
                break;
            case "dailyVerseSetPremium":
                setDailyVersePremium(Boolean.TRUE.equals(call.argument("premium")));
                result.success(true);
                break;
            case "dailyVerseSetMoodPack":
                setMoodPackVerses(call);
                result.success(true);
                break;
            default:
                result.notImplemented();
        }
    }

    // ── static wallpaper ─────────────────────────────────────────────────────
    private void setStatic(MethodCall call, MethodChannel.Result result) {
        final String imageUrl = call.argument("url");
        final String targetArg = call.argument("target");
        final String target = targetArg == null ? "both" : targetArg;

        if (imageUrl == null || imageUrl.isEmpty()) {
            result.error("bad_args", "Image URL is required", null);
            return;
        }

        IO_EXECUTOR.execute(() -> {
            try {
                Bitmap bitmap = decodeBitmap(imageUrl);
                if (bitmap == null) {
                    activity.runOnUiThread(() -> result.error("decode_failed", "Failed to decode image", null));
                    return;
                }
                WallpaperManager wm = WallpaperManager.getInstance(ctx());
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                    switch (target) {
                        case "home":
                            wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM);
                            break;
                        case "lock":
                            wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
                            break;
                        default:
                            wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_SYSTEM);
                            wm.setBitmap(bitmap, null, true, WallpaperManager.FLAG_LOCK);
                            break;
                    }
                } else {
                    wm.setBitmap(bitmap);
                }
                bitmap.recycle();
                activity.runOnUiThread(() -> result.success(true));
            } catch (Exception e) {
                Log.e(TAG, "Error setting wallpaper: " + e.getMessage(), e);
                activity.runOnUiThread(() ->
                        result.error("set_failed", "Failed to set wallpaper: " + e.getMessage(), null));
            }
        });
    }

    private int targetDimension() {
        WindowManager wm = (WindowManager) ctx().getSystemService(Context.WINDOW_SERVICE);
        if (wm == null) return 2560;
        DisplayMetrics metrics = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(metrics);
        return Math.max(metrics.widthPixels, metrics.heightPixels) * 2;
    }

    private Bitmap decodeSized(byte[] bytes) {
        BitmapFactory.Options probe = new BitmapFactory.Options();
        probe.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(bytes, 0, bytes.length, probe);
        int target = targetDimension();
        int sample = 1;
        while (probe.outWidth / (sample * 2) >= target && probe.outHeight / (sample * 2) >= target) {
            sample *= 2;
        }
        BitmapFactory.Options options = new BitmapFactory.Options();
        options.inPreferredConfig = Bitmap.Config.ARGB_8888;
        options.inSampleSize = sample;
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
    }

    private Bitmap decodeBitmap(String imageUrl) throws Exception {
        if (imageUrl.startsWith("data:image")) {
            String base64 = imageUrl.substring(imageUrl.indexOf(',') + 1).replaceAll("\\s", "").trim();
            byte[] bytes = Base64.decode(base64.getBytes(StandardCharsets.UTF_8), Base64.NO_WRAP);
            if (bytes.length > MAX_DOWNLOAD_BYTES) throw new IllegalArgumentException("Image is too large");
            return decodeSized(bytes);
        }

        HttpURLConnection connection = (HttpURLConnection) new URL(imageUrl).openConnection();
        connection.setDoInput(true);
        connection.setConnectTimeout(15000);
        connection.setReadTimeout(15000);
        connection.connect();

        try (InputStream inputStream = connection.getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int read;
            while ((read = inputStream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_DOWNLOAD_BYTES) throw new IllegalArgumentException("Image is too large");
                output.write(buffer, 0, read);
            }
            return decodeSized(output.toByteArray());
        } finally {
            connection.disconnect();
        }
    }

    // ── video live wallpaper ─────────────────────────────────────────────────
    private void setLive(MethodCall call, MethodChannel.Result result) {
        final String videoUrl = call.argument("url");
        String idArg = call.argument("videoId");
        final String videoId = idArg == null || idArg.isEmpty() ? "default" : idArg;
        Boolean forceArg = call.argument("forceRefresh");
        final boolean forceRefresh = forceArg != null && forceArg;

        Object wArg = call.argument("videoWidth");
        Object hArg = call.argument("videoHeight");
        SharedPreferences prefs = ctx().getSharedPreferences(LIVE_PREFS, Context.MODE_PRIVATE);
        SharedPreferences.Editor dimEditor = prefs.edit();
        if (wArg instanceof Number && hArg instanceof Number
                && ((Number) wArg).intValue() > 0 && ((Number) hArg).intValue() > 0) {
            dimEditor.putInt(VideoWallpaperService.KEY_EXPECTED_VIDEO_W, ((Number) wArg).intValue());
            dimEditor.putInt(VideoWallpaperService.KEY_EXPECTED_VIDEO_H, ((Number) hArg).intValue());
        } else {
            dimEditor.remove(VideoWallpaperService.KEY_EXPECTED_VIDEO_W);
            dimEditor.remove(VideoWallpaperService.KEY_EXPECTED_VIDEO_H);
        }
        dimEditor.apply();

        if (videoUrl == null || videoUrl.isEmpty()) {
            result.error("bad_args", "Video URL is required", null);
            return;
        }

        final File cachedFile = new File(liveDir(), videoId + ".mp4");
        boolean cachedExists = cachedFile.exists() && cachedFile.length() > 0;

        if (cachedExists && !forceRefresh) {
            applyLiveWallpaper(cachedFile, videoId, result);
            return;
        }
        if (cachedExists) cachedFile.delete();

        new Thread(() -> {
            try {
                File downloaded = downloadVideo(videoUrl, cachedFile);
                if (downloaded != null && downloaded.exists() && downloaded.length() > 0) {
                    activity.runOnUiThread(() -> applyLiveWallpaper(downloaded, videoId, result));
                } else {
                    activity.runOnUiThread(() ->
                            result.error("download_failed", "Failed to download video", null));
                }
            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                if (cachedFile.exists()) cachedFile.delete();
                activity.runOnUiThread(() ->
                        result.error("download_failed", "Download failed: " + e.getMessage(), null));
            }
        }, "live-wallpaper-download").start();
    }

    private File liveDir() {
        File dir = new File(ctx().getFilesDir(), "live_wallpapers");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    private File downloadVideo(String videoUrl, File targetFile) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(videoUrl).openConnection();
        conn.setConnectTimeout(CONNECT_TIMEOUT);
        conn.setReadTimeout(READ_TIMEOUT);
        conn.setRequestProperty("User-Agent", "ChristianWallpapers/1.0");
        conn.connect();

        int responseCode = conn.getResponseCode();
        if (responseCode != HttpURLConnection.HTTP_OK) {
            conn.disconnect();
            throw new Exception("Server returned HTTP " + responseCode);
        }

        File tempFile = new File(targetFile.getParent(), targetFile.getName() + ".tmp");
        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(tempFile)) {
            byte[] buffer = new byte[BUFFER_SIZE];
            int bytesRead;
            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
            }
            out.flush();
        } finally {
            conn.disconnect();
        }

        if (tempFile.exists() && tempFile.length() > 0) {
            if (targetFile.exists()) targetFile.delete();
            tempFile.renameTo(targetFile);
            return targetFile;
        }
        tempFile.delete();
        throw new Exception("Downloaded file is empty");
    }

    private void applyLiveWallpaper(File videoFile, String videoId, MethodChannel.Result result) {
        SharedPreferences prefs = ctx().getSharedPreferences(LIVE_PREFS, Context.MODE_PRIVATE);
        prefs.edit()
                .putString(KEY_PENDING_PATH, videoFile.getAbsolutePath())
                .putString(KEY_PENDING_ID, videoId)
                .putString(VideoWallpaperService.KEY_DEBUG_LAST_EVENT, "apply_requested")
                .remove(VideoWallpaperService.KEY_DEBUG_HISTORY)
                .remove(VideoWallpaperService.KEY_DEBUG_ERROR)
                .apply();

        try {
            WallpaperManager wallpaperManager = WallpaperManager.getInstance(ctx());
            Point realSize = realScreenSize();
            DisplayMetrics dm = ctx().getResources().getDisplayMetrics();
            int rawWidth = realSize.x > 0 ? realSize.x : dm.widthPixels;
            int rawHeight = realSize.y > 0 ? realSize.y : dm.heightPixels;
            boolean isPortraitUi = dm.heightPixels >= dm.widthPixels;
            int shortSide = Math.min(rawWidth, rawHeight);
            int longSide = Math.max(rawWidth, rawHeight);
            wallpaperManager.suggestDesiredDimensions(
                    isPortraitUi ? shortSide : longSide,
                    isPortraitUi ? longSide : shortSide);
        } catch (Exception e) {
            Log.w(TAG, "Failed to suggest desired wallpaper dimensions", e);
        }

        pendingResult = result;
        pendingVideoId = videoId;

        try {
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    new ComponentName(ctx(), VideoWallpaperService.class));
            activity.startActivityForResult(intent, REQUEST_CODE);
        } catch (Exception e) {
            try {
                activity.startActivityForResult(
                        new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER), REQUEST_CODE);
            } catch (Exception ex) {
                pendingResult = null;
                pendingVideoId = null;
                result.error("picker_failed", "Failed to open wallpaper picker: " + ex.getMessage(), null);
            }
        }
    }

    /** Called from MainActivity.onActivityResult. */
    public void onPickerResult(int resultCode) {
        MethodChannel.Result result = pendingResult;
        String requestedVideoId = pendingVideoId;
        pendingResult = null;
        pendingVideoId = null;
        if (result == null) return;

        SharedPreferences prefs = ctx().getSharedPreferences(LIVE_PREFS, Context.MODE_PRIVATE);
        boolean confirmed = resultCode == Activity.RESULT_OK;

        if (!confirmed) {
            clearPendingPrefs(prefs);
            result.success(false);
            return;
        }

        boolean promoted = promotePendingToActive(prefs);
        if (!promoted && requestedVideoId != null && !requestedVideoId.isEmpty()) {
            promoted = promoteCachedVideoToActive(prefs, requestedVideoId);
        }

        String activeVideoId = prefs.getString(KEY_VIDEO_ID, null);
        boolean applied = (promoted || (requestedVideoId != null && requestedVideoId.equals(activeVideoId)))
                && requestedVideoId != null && requestedVideoId.equals(prefs.getString(KEY_VIDEO_ID, null));

        if (!applied) clearPendingPrefs(prefs);
        result.success(applied);
    }

    private boolean promotePendingToActive(SharedPreferences prefs) {
        try {
            String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
            String pendingId = prefs.getString(KEY_PENDING_ID, null);
            if (pendingPath == null || pendingId == null) return false;

            File videoFile = new File(pendingPath);
            if (!videoFile.exists() || videoFile.length() <= 0) {
                clearPendingPrefs(prefs);
                return false;
            }
            return prefs.edit()
                    .putString(KEY_VIDEO_PATH, pendingPath)
                    .putString(KEY_VIDEO_ID, pendingId)
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_ID)
                    .commit();
        } catch (Exception e) {
            Log.e(TAG, "Failed to promote pending wallpaper", e);
            return false;
        }
    }

    private boolean promoteCachedVideoToActive(SharedPreferences prefs, String videoId) {
        try {
            File cachedFile = new File(liveDir(), videoId + ".mp4");
            if (!cachedFile.exists() || cachedFile.length() <= 0) return false;
            return prefs.edit()
                    .putString(KEY_VIDEO_PATH, cachedFile.getAbsolutePath())
                    .putString(KEY_VIDEO_ID, videoId)
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_ID)
                    .commit();
        } catch (Exception e) {
            return false;
        }
    }

    private void clearPendingPrefs(SharedPreferences prefs) {
        prefs.edit().remove(KEY_PENDING_PATH).remove(KEY_PENDING_ID).apply();
    }

    private Point realScreenSize() {
        try {
            WindowManager wm = (WindowManager) ctx().getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return new Point(0, 0);
            Display display = wm.getDefaultDisplay();
            Point size = new Point();
            display.getRealSize(size);
            return size;
        } catch (Exception e) {
            return new Point(0, 0);
        }
    }

    // ── daily verse live wallpaper ───────────────────────────────────────────
    private void openDailyVersePicker(MethodChannel.Result result) {
        try {
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(
                    WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                    new ComponentName(ctx(), DailyVerseWallpaperService.class));
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(intent);
            result.success(true);
        } catch (Exception e) {
            try {
                Intent intent = new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER);
                intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
                result.success(true);
            } catch (Exception inner) {
                result.error("picker_failed", "Could not open wallpaper picker: " + inner.getMessage(), null);
            }
        }
    }

    private boolean isDailyVerseActive() {
        try {
            WallpaperManager wm = WallpaperManager.getInstance(ctx());
            WallpaperInfo info = wm.getWallpaperInfo();
            if (info != null && info.getComponent() != null) {
                String pkg = info.getComponent().getPackageName();
                String cls = info.getComponent().getClassName();
                return ctx().getPackageName().equals(pkg)
                        && DailyVerseWallpaperService.class.getName().equals(cls);
            }
        } catch (Exception ignored) {}
        return false;
    }

    private void dailyVersePrefetch(MethodCall call, MethodChannel.Result result) {
        final boolean force = Boolean.TRUE.equals(call.argument("force"));
        final boolean single = Boolean.TRUE.equals(call.argument("single"));
        new Thread(() -> {
            Map<String, Object> res = new HashMap<>();
            try {
                File dir = new File(ctx().getFilesDir(), DV_CACHE_DIR);
                if (!dir.exists() && !dir.mkdirs()) {
                    activity.runOnUiThread(() ->
                            result.error("cache_dir", "Could not create cache directory", null));
                    return;
                }

                int downloaded = 0;
                long totalBytes = 0;
                int[] targets;
                if (single) {
                    // Must match DailyVerseWallpaperService.loadBackgroundForDay().
                    int today = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
                    targets = new int[]{ (today % 20) + 1 };
                } else {
                    targets = new int[DV_BG_COUNT];
                    for (int i = 0; i < DV_BG_COUNT; i++) targets[i] = i + 1;
                }

                for (int value : targets) {
                    String name = String.format("bg-%02d.jpg", value);
                    File out = new File(dir, name);
                    if (!force && out.exists() && out.length() > 1024) {
                        totalBytes += out.length();
                        continue;
                    }
                    long bytes = downloadTo(DV_R2_BASE + "/" + name, out);
                    if (bytes <= 0) continue;
                    downloaded++;
                    totalBytes += bytes;
                }

                if (!single) {
                    try (FileOutputStream fos = new FileOutputStream(new File(dir, DV_STAMP_FILE))) {
                        fos.write(String.valueOf(System.currentTimeMillis()).getBytes(StandardCharsets.UTF_8));
                    } catch (Exception ignored) {}
                }

                res.put("success", true);
                res.put("downloaded", downloaded);
                res.put("total", targets.length);
                res.put("totalBytes", totalBytes);
                res.put("single", single);
                activity.runOnUiThread(() -> result.success(res));
            } catch (Exception e) {
                activity.runOnUiThread(() ->
                        result.error("prefetch_failed", "Prefetch failed: " + e.getMessage(), null));
            }
        }, "DailyVersePrefetch").start();
    }

    private Map<String, Object> dailyVerseCacheStatus() {
        Map<String, Object> res = new HashMap<>();
        try {
            File dir = new File(ctx().getFilesDir(), DV_CACHE_DIR);
            int present = 0;
            long bytes = 0;
            for (int i = 1; i <= DV_BG_COUNT; i++) {
                File f = new File(dir, String.format("bg-%02d.jpg", i));
                if (f.exists() && f.length() > 1024) {
                    present++;
                    bytes += f.length();
                }
            }
            long lastSync = 0;
            File stamp = new File(dir, DV_STAMP_FILE);
            if (stamp.exists()) {
                try (InputStream is = new java.io.FileInputStream(stamp)) {
                    byte[] buf = new byte[64];
                    int read = is.read(buf);
                    if (read > 0) lastSync = Long.parseLong(new String(buf, 0, read, StandardCharsets.UTF_8).trim());
                } catch (Exception ignored) {}
            }
            long ageMs = lastSync > 0 ? Math.max(0, System.currentTimeMillis() - lastSync) : -1;
            res.put("ready", present == DV_BG_COUNT);
            res.put("downloaded", present);
            res.put("total", DV_BG_COUNT);
            res.put("totalBytes", bytes);
            res.put("lastSyncMs", lastSync);
            res.put("ageDays", ageMs < 0 ? -1 : (int) (ageMs / (24L * 60 * 60 * 1000)));
        } catch (Exception e) {
            res.put("ready", false);
        }
        return res;
    }

    private void markVerseUnlocked() {
        try {
            Calendar c = Calendar.getInstance();
            ctx().getSharedPreferences(DailyVerseWallpaperService.PREFS, Context.MODE_PRIVATE)
                    .edit()
                    .putInt(DailyVerseWallpaperService.KEY_UNLOCKED_DAY, c.get(Calendar.DAY_OF_YEAR))
                    .putInt(DailyVerseWallpaperService.KEY_UNLOCKED_YEAR, c.get(Calendar.YEAR))
                    .apply();
            broadcastRedraw();
        } catch (Exception ignored) {}
    }

    private void setDailyVersePremium(boolean premium) {
        try {
            SharedPreferences sp = ctx().getSharedPreferences(
                    DailyVerseWallpaperService.PREFS, Context.MODE_PRIVATE);
            SharedPreferences.Editor ed = sp.edit();
            ed.putBoolean(DailyVerseWallpaperService.KEY_IS_PREMIUM, premium);
            if (premium) {
                ed.remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY);
                ed.remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR);
            } else {
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
        } catch (Exception ignored) {}
    }

    @SuppressWarnings("unchecked")
    private void setMoodPackVerses(MethodCall call) {
        try {
            String mood = call.argument("mood");
            Object versesArg = call.argument("verses");
            SharedPreferences sp = ctx().getSharedPreferences(
                    DailyVerseWallpaperService.PREFS, Context.MODE_PRIVATE);

            if (!(versesArg instanceof List) || ((List<Object>) versesArg).isEmpty()) {
                sp.edit()
                        .remove(DailyVerseWallpaperService.KEY_PACK_VERSES)
                        .remove(DailyVerseWallpaperService.KEY_PACK_MOOD)
                        .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY)
                        .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR)
                        .apply();
            } else {
                JSONArray clean = new JSONArray();
                for (Object row : (List<Object>) versesArg) {
                    Map<String, Object> src = (Map<String, Object>) row;
                    JSONObject out = new JSONObject();
                    Object text = src.get("text");
                    Object reference = src.get("reference");
                    out.put("text", text == null ? "" : String.valueOf(text));
                    out.put("reference", reference == null ? "" : String.valueOf(reference));
                    clean.put(out);
                }
                sp.edit()
                        .putString(DailyVerseWallpaperService.KEY_PACK_VERSES, clean.toString())
                        .putString(DailyVerseWallpaperService.KEY_PACK_MOOD, mood == null ? "" : mood)
                        .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_DAY)
                        .remove(DailyVerseWallpaperService.KEY_PACK_FROZEN_YEAR)
                        .apply();
            }
            broadcastRedraw();
        } catch (Exception ignored) {}
    }

    private void broadcastRedraw() {
        try {
            Intent intent = new Intent(DailyVerseWallpaperService.ACTION_REDRAW)
                    .setPackage(ctx().getPackageName());
            ctx().sendBroadcast(intent);
        } catch (Exception ignored) {}
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
                 FileOutputStream os = new FileOutputStream(tmp)) {
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
