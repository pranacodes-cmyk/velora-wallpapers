package com.velora.plugins;

import android.app.Activity;
import android.app.WallpaperInfo;
import android.app.WallpaperManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.util.Log;
import android.util.DisplayMetrics;
import android.graphics.Point;
import android.view.Display;
import android.view.WindowManager;
import android.os.Handler;
import android.os.Looper;

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
 * Production-grade Capacitor plugin for live wallpapers.
 *
 * Flow (matches how Zedge and top wallpaper apps work):
 *   1. JS calls setLiveWallpaper({ videoUrl, videoId })
 *   2. Plugin downloads the video from R2 cloud URL to internal storage
 *   3. Stores the local file path in SharedPreferences
 *   4. Launches the native Android live wallpaper picker
 *   5. VideoWallpaperService reads the cached file and plays it
 *
 * Download is done on a background thread with progress reporting.
 * Videos are cached so re-applying the same wallpaper is instant.
 */
@CapacitorPlugin(name = "LiveWallpaperPlugin")
public class LiveWallpaperPlugin extends Plugin {

    private static final String TAG = "LiveWallpaperPlugin";
    private static final String PREFS_NAME = "live_wallpaper_prefs";
    private static final String KEY_VIDEO_PATH = "active_video_path";
    private static final String KEY_VIDEO_ID = "active_video_id";
    private static final String KEY_PENDING_PATH = "pending_video_path";
    private static final String KEY_PENDING_ID = "pending_video_id";
    private static final int BUFFER_SIZE = 8192;
    private static final int CONNECT_TIMEOUT = 15000;
    private static final int READ_TIMEOUT = 60000;
    private static final int ACTIVATION_CHECK_MAX_ATTEMPTS = 10;
    private static final int ACTIVATION_CHECK_DELAY_MS = 250;
    // R2 direct base URL — bypasses edge function proxy that requires auth headers
    private static final String R2_BASE = "https://pub-de6e465d65ed4e5bbc4515e0da940246.r2.dev";
    private static final String PROXY_PREFIX = "/functions/v1/image-proxy/";

    /**
     * Download video from URL, cache locally, then launch wallpaper picker.
     *
     * @param call expects:
     *   - videoUrl (String): Full R2 cloud URL to the MP4 file
     *   - videoId (String): Unique identifier for caching (e.g. "doom-sorcery-power")
     */
    @PluginMethod
    public void setLiveWallpaper(PluginCall call) {
        String videoUrl = call.getString("videoUrl");
        String videoId = call.getString("videoId", "default");
        boolean forceRefresh = call.getBoolean("forceRefresh", false);

        // Store expected video dimensions for manual crop override
        // when MediaPlayer reports incorrect dimensions (bad SAR metadata)
        Integer expectedVideoWidth = call.getInt("videoWidth");
        Integer expectedVideoHeight = call.getInt("videoHeight");
        SharedPreferences dimensionPrefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor dimEditor = dimensionPrefs.edit();
        if (expectedVideoWidth != null && expectedVideoHeight != null && expectedVideoWidth > 0 && expectedVideoHeight > 0) {
            dimEditor.putInt(VideoWallpaperService.KEY_EXPECTED_VIDEO_W, expectedVideoWidth);
            dimEditor.putInt(VideoWallpaperService.KEY_EXPECTED_VIDEO_H, expectedVideoHeight);
            Log.d(TAG, "Expected video dimensions stored: " + expectedVideoWidth + "x" + expectedVideoHeight);
        } else {
            dimEditor.remove(VideoWallpaperService.KEY_EXPECTED_VIDEO_W);
            dimEditor.remove(VideoWallpaperService.KEY_EXPECTED_VIDEO_H);
        }
        dimEditor.apply();

        if (videoUrl == null || videoUrl.isEmpty()) {
            emitWallpaperLog("request", "error", "Video URL missing", null);
            call.reject("Video URL is required");
            return;
        }

        // Use the URL as-is. The Supabase image-proxy is publicly accessible
        // (no JWT required) and serves the underlying R2 bytes with proper
        // Content-Type/CORS, so HttpURLConnection can fetch it directly.
        // Previous rewrite to a hardcoded R2 public domain caused HTTP 404s.
        String directUrl = videoUrl;
        Log.d(TAG, "Original URL: " + videoUrl);
        Log.d(TAG, "Direct URL: " + directUrl);

        JSObject requestDetails = new JSObject();
        requestDetails.put("videoId", videoId);
        requestDetails.put("forceRefresh", forceRefresh);
        requestDetails.put("originalUrl", videoUrl);
        requestDetails.put("directUrl", directUrl);
        emitWallpaperLog("request", "info", "Live wallpaper apply requested", requestDetails);

        File cacheDir = getLiveWallpaperDir();
        File cachedFile = new File(cacheDir, videoId + ".mp4");
        boolean cachedExists = cachedFile.exists() && cachedFile.length() > 0;

        if (cachedExists && !forceRefresh) {
            JSObject cacheHit = new JSObject();
            cacheHit.put("videoId", videoId);
            cacheHit.put("sizeBytes", cachedFile.length());
            emitWallpaperLog("cache", "info", "Using cached video", cacheHit);
            Log.d(TAG, "Video already cached: " + cachedFile.getAbsolutePath() + " (" + (cachedFile.length() / 1024) + " KB)");
            applyWallpaper(cachedFile, videoId, call);
            return;
        }

        if (cachedExists && forceRefresh) {
            boolean deleted = cachedFile.delete();
            JSObject cacheRefresh = new JSObject();
            cacheRefresh.put("videoId", videoId);
            cacheRefresh.put("oldSizeBytes", cachedFile.length());
            cacheRefresh.put("deleted", deleted);
            emitWallpaperLog("cache", deleted ? "info" : "warn", "Force refresh cache clear", cacheRefresh);
            Log.d(TAG, "forceRefresh=true, deleting old cache for " + videoId + ": " + deleted);
        }

        // Download on background thread
        new Thread(() -> {
            try {
                emitWallpaperLog("download", "info", "Download started", requestDetails);

                // Notify JS that download started
                JSObject progressEvent = new JSObject();
                progressEvent.put("phase", "downloading");
                progressEvent.put("progress", 0);
                notifyListeners("wallpaperProgress", progressEvent);

                File downloadedFile = downloadVideo(directUrl, cachedFile);

                if (downloadedFile != null && downloadedFile.exists() && downloadedFile.length() > 0) {
                    JSObject downloadDone = new JSObject();
                    downloadDone.put("videoId", videoId);
                    downloadDone.put("filePath", downloadedFile.getAbsolutePath());
                    downloadDone.put("sizeBytes", downloadedFile.length());
                    emitWallpaperLog("download", "info", "Download completed", downloadDone);

                    // Notify download complete
                    JSObject completeEvent = new JSObject();
                    completeEvent.put("phase", "applying");
                    completeEvent.put("progress", 100);
                    notifyListeners("wallpaperProgress", completeEvent);

                    Activity activity = getActivity();
                    if (activity == null) {
                        emitWallpaperLog("apply", "error", "Activity was null before opening picker", null);
                        call.reject("Activity unavailable");
                        return;
                    }
                    activity.runOnUiThread(() -> applyWallpaper(downloadedFile, videoId, call));
                } else {
                    emitWallpaperLog("download", "error", "Downloaded file missing or empty", null);
                    Activity activity = getActivity();
                    if (activity != null) {
                        activity.runOnUiThread(() -> call.reject("Failed to download video"));
                    } else {
                        call.reject("Failed to download video");
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Download failed", e);
                emitWallpaperLog("download", "error", "Download failed", toErrorDetails(e));
                // Clean up partial download
                if (cachedFile.exists()) {
                    cachedFile.delete();
                }
                Activity activity = getActivity();
                if (activity != null) {
                    activity.runOnUiThread(() -> call.reject("Download failed: " + e.getMessage()));
                } else {
                    call.reject("Download failed: " + e.getMessage());
                }
            }
        }).start();
    }

    /**
     * Check if a live wallpaper is currently active and which video.
     */
    @PluginMethod
    public void isActive(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String activeVideoId = prefs.getString(KEY_VIDEO_ID, null);
        String activeVideoPath = prefs.getString(KEY_VIDEO_PATH, null);

        boolean fileExists = false;
        if (activeVideoPath != null) {
            fileExists = new File(activeVideoPath).exists();
        }

        JSObject result = new JSObject();
        result.put("active", activeVideoId != null && fileExists);
        result.put("videoId", activeVideoId);
        call.resolve(result);
    }

    /**
     * Check if a specific video is already cached locally.
     */
    @PluginMethod
    public void isCached(PluginCall call) {
        String videoId = call.getString("videoId", "");
        File cacheDir = getLiveWallpaperDir();
        File cachedFile = new File(cacheDir, videoId + ".mp4");

        JSObject result = new JSObject();
        result.put("cached", cachedFile.exists() && cachedFile.length() > 0);
        result.put("sizeMB", cachedFile.exists() ? Math.round(cachedFile.length() / 1048576.0 * 10) / 10.0 : 0);
        call.resolve(result);
    }

    /**
     * Set runtime render tuning options so behavior can be adjusted from JS
     * without editing native code again.
     */
    @PluginMethod
    public void setRenderConfig(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();

        Boolean useSetDisplay = call.getBoolean("useSetDisplay");
        if (useSetDisplay != null) {
            editor.putBoolean(VideoWallpaperService.KEY_CFG_USE_SET_DISPLAY, useSetDisplay);
        }

        Boolean enableFixedSizeFallback = call.getBoolean("enableFixedSizeFallback");
        if (enableFixedSizeFallback != null) {
            editor.putBoolean(VideoWallpaperService.KEY_CFG_ENABLE_FIXED_SIZE_FALLBACK, enableFixedSizeFallback);
        }

        Boolean enableFixedSizeInPreview = call.getBoolean("enableFixedSizeInPreview");
        if (enableFixedSizeInPreview != null) {
            editor.putBoolean(VideoWallpaperService.KEY_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW, enableFixedSizeInPreview);
        }

        Boolean enableSizeFromLayout = call.getBoolean("enableSizeFromLayout");
        if (enableSizeFromLayout != null) {
            editor.putBoolean(VideoWallpaperService.KEY_CFG_ENABLE_SIZE_FROM_LAYOUT, enableSizeFromLayout);
        }

        Integer previewInitDelayMs = call.getInt("previewInitDelayMs");
        if (previewInitDelayMs != null) {
            int clamped = Math.max(0, Math.min(VideoWallpaperService.MAX_CFG_PREVIEW_INIT_DELAY_MS, previewInitDelayMs));
            editor.putInt(VideoWallpaperService.KEY_CFG_PREVIEW_INIT_DELAY_MS, clamped);
        }

        String scaleMode = call.getString("scaleMode");
        if (scaleMode != null) {
            editor.putString(VideoWallpaperService.KEY_CFG_SCALE_MODE, sanitizeScaleMode(scaleMode));
        }

        editor.apply();
        JSObject config = buildRenderConfigResult(prefs);
        emitWallpaperLog("config", "info", "Render config updated", config);
        call.resolve(config);
    }

    @PluginMethod
    public void getRenderConfig(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        call.resolve(buildRenderConfigResult(prefs));
    }

    @PluginMethod
    public void setScaleMode(PluginCall call) {
        String requested = call.getString("mode", VideoWallpaperService.DEFAULT_CFG_SCALE_MODE);
        String sanitized = sanitizeScaleMode(requested);

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit().putString(VideoWallpaperService.KEY_CFG_SCALE_MODE, sanitized).apply();

        JSObject result = new JSObject();
        result.put("scaleMode", sanitized);
        emitWallpaperLog("config", "info", "Scale mode updated", result);
        call.resolve(result);
    }

    @PluginMethod
    public void getScaleMode(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        JSObject result = new JSObject();
        result.put("scaleMode", sanitizeScaleMode(
            prefs.getString(VideoWallpaperService.KEY_CFG_SCALE_MODE, VideoWallpaperService.DEFAULT_CFG_SCALE_MODE)
        ));
        call.resolve(result);
    }

    /**
     * Snapshot internal native state to help diagnose stretching/cropping issues.
     */
    @PluginMethod
    public void getDebugState(PluginCall call) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);

        JSObject result = new JSObject();
        result.put("activeVideoId", prefs.getString(KEY_VIDEO_ID, null));
        result.put("activeVideoPath", prefs.getString(KEY_VIDEO_PATH, null));
        result.put("pendingVideoId", prefs.getString(KEY_PENDING_ID, null));
        result.put("pendingVideoPath", prefs.getString(KEY_PENDING_PATH, null));

        result.put("surfaceWidth", prefs.getInt(VideoWallpaperService.KEY_DEBUG_SURFACE_W, 0));
        result.put("surfaceHeight", prefs.getInt(VideoWallpaperService.KEY_DEBUG_SURFACE_H, 0));
        result.put("videoWidth", prefs.getInt(VideoWallpaperService.KEY_DEBUG_VIDEO_W, 0));
        result.put("videoHeight", prefs.getInt(VideoWallpaperService.KEY_DEBUG_VIDEO_H, 0));
        result.put("engineRealScreenWidth", prefs.getInt(VideoWallpaperService.KEY_DEBUG_REAL_SCREEN_W, 0));
        result.put("engineRealScreenHeight", prefs.getInt(VideoWallpaperService.KEY_DEBUG_REAL_SCREEN_H, 0));
        result.put("desiredMinWidth", prefs.getInt(VideoWallpaperService.KEY_DEBUG_DESIRED_W, 0));
        result.put("desiredMinHeight", prefs.getInt(VideoWallpaperService.KEY_DEBUG_DESIRED_H, 0));
        result.put("aspectNote", prefs.getString(VideoWallpaperService.KEY_DEBUG_ASPECT_NOTE, null));
        result.put("debugHistory", prefs.getString(VideoWallpaperService.KEY_DEBUG_HISTORY, ""));
        result.put("isPreview", prefs.getBoolean(VideoWallpaperService.KEY_DEBUG_IS_PREVIEW, false));
        result.put("scalingMode", prefs.getString(VideoWallpaperService.KEY_DEBUG_SCALING_MODE, null));
        result.put("requestedScaleMode", prefs.getString(VideoWallpaperService.KEY_DEBUG_REQUESTED_SCALE_MODE, VideoWallpaperService.DEFAULT_CFG_SCALE_MODE));
        result.put("effectiveScaleMode", prefs.getString(VideoWallpaperService.KEY_DEBUG_EFFECTIVE_SCALE_MODE, null));
        result.put("selectedPath", prefs.getString(VideoWallpaperService.KEY_DEBUG_SELECTED_PATH, null));
        result.put("lastEvent", prefs.getString(VideoWallpaperService.KEY_DEBUG_LAST_EVENT, null));
        result.put("lastError", prefs.getString(VideoWallpaperService.KEY_DEBUG_ERROR, null));
        result.put("useSetDisplay", prefs.getBoolean(VideoWallpaperService.KEY_CFG_USE_SET_DISPLAY, VideoWallpaperService.DEFAULT_CFG_USE_SET_DISPLAY));
        result.put("enableFixedSizeFallback", prefs.getBoolean(VideoWallpaperService.KEY_CFG_ENABLE_FIXED_SIZE_FALLBACK, VideoWallpaperService.DEFAULT_CFG_ENABLE_FIXED_SIZE_FALLBACK));
        result.put("enableFixedSizeInPreview", prefs.getBoolean(VideoWallpaperService.KEY_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW, VideoWallpaperService.DEFAULT_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW));
        result.put("enableSizeFromLayout", prefs.getBoolean(VideoWallpaperService.KEY_CFG_ENABLE_SIZE_FROM_LAYOUT, VideoWallpaperService.DEFAULT_CFG_ENABLE_SIZE_FROM_LAYOUT));
        result.put("previewInitDelayMs", prefs.getInt(VideoWallpaperService.KEY_CFG_PREVIEW_INIT_DELAY_MS, VideoWallpaperService.DEFAULT_CFG_PREVIEW_INIT_DELAY_MS));
        result.put("scaleMode", sanitizeScaleMode(prefs.getString(VideoWallpaperService.KEY_CFG_SCALE_MODE, VideoWallpaperService.DEFAULT_CFG_SCALE_MODE)));

        boolean serviceActiveByManager = isOurWallpaperServiceActive();
        boolean serviceActiveByEngine = prefs.getBoolean(VideoWallpaperService.KEY_DEBUG_SERVICE_ACTIVE, false);
        result.put("serviceActiveByManager", serviceActiveByManager);
        result.put("serviceActiveByEngine", serviceActiveByEngine);
        result.put("serviceActive", serviceActiveByManager || serviceActiveByEngine);

        try {
            WallpaperManager wallpaperManager = WallpaperManager.getInstance(getContext());
            result.put("desiredMinWidth", wallpaperManager.getDesiredMinimumWidth());
            result.put("desiredMinHeight", wallpaperManager.getDesiredMinimumHeight());

            WallpaperInfo info = wallpaperManager.getWallpaperInfo();
            result.put("activeComponent", info != null && info.getComponent() != null
                ? info.getComponent().flattenToShortString()
                : null);
        } catch (Exception e) {
            Log.w(TAG, "Failed to read WallpaperManager debug state", e);
        }

        Point realSize = getRealScreenSize();
        result.put("realScreenWidth", realSize.x);
        result.put("realScreenHeight", realSize.y);

        call.resolve(result);
    }

    /**
     * Clear all cached live wallpaper videos to free storage.
     */
    @PluginMethod
    public void clearCache(PluginCall call) {
        File cacheDir = getLiveWallpaperDir();
        long freed = 0;
        if (cacheDir.exists()) {
            File[] files = cacheDir.listFiles();
            if (files != null) {
                for (File f : files) {
                    freed += f.length();
                    f.delete();
                }
            }
        }
        JSObject result = new JSObject();
        result.put("freedMB", Math.round(freed / 1048576.0 * 10) / 10.0);
        call.resolve(result);
    }

    private JSObject buildRenderConfigResult(SharedPreferences prefs) {
        JSObject result = new JSObject();
        result.put("useSetDisplay", prefs.getBoolean(VideoWallpaperService.KEY_CFG_USE_SET_DISPLAY, VideoWallpaperService.DEFAULT_CFG_USE_SET_DISPLAY));
        result.put("enableFixedSizeFallback", prefs.getBoolean(VideoWallpaperService.KEY_CFG_ENABLE_FIXED_SIZE_FALLBACK, VideoWallpaperService.DEFAULT_CFG_ENABLE_FIXED_SIZE_FALLBACK));
        result.put("enableFixedSizeInPreview", prefs.getBoolean(VideoWallpaperService.KEY_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW, VideoWallpaperService.DEFAULT_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW));
        result.put("enableSizeFromLayout", prefs.getBoolean(VideoWallpaperService.KEY_CFG_ENABLE_SIZE_FROM_LAYOUT, VideoWallpaperService.DEFAULT_CFG_ENABLE_SIZE_FROM_LAYOUT));
        result.put("previewInitDelayMs", prefs.getInt(VideoWallpaperService.KEY_CFG_PREVIEW_INIT_DELAY_MS, VideoWallpaperService.DEFAULT_CFG_PREVIEW_INIT_DELAY_MS));
        result.put("scaleMode", sanitizeScaleMode(prefs.getString(VideoWallpaperService.KEY_CFG_SCALE_MODE, VideoWallpaperService.DEFAULT_CFG_SCALE_MODE)));
        return result;
    }

    /**
     * Convert edge function proxy URL to direct R2 URL.
     * Proxy URLs require auth headers that HttpURLConnection doesn't send,
     * causing silent download failures → empty files → black screen in picker.
     *
     * Example:
     *   IN:  https://xxx.supabase.co/functions/v1/image-proxy/live/video.mp4
     *   OUT: https://pub-xxx.r2.dev/live/video.mp4
     */
    private String convertToDirectUrl(String url) {
        int proxyIdx = url.indexOf(PROXY_PREFIX);
        if (proxyIdx >= 0) {
            String path = url.substring(proxyIdx + PROXY_PREFIX.length());
            return R2_BASE + "/" + path;
        }
        return url;
    }

    private String sanitizeScaleMode(String mode) {
        if (mode == null) return VideoWallpaperService.DEFAULT_CFG_SCALE_MODE;
        switch (mode) {
            case VideoWallpaperService.SCALE_MODE_CENTER_CROP:
            case VideoWallpaperService.SCALE_MODE_FIT_CENTER:
            case VideoWallpaperService.SCALE_MODE_FIT_WIDTH:
            case VideoWallpaperService.SCALE_MODE_FIT_HEIGHT:
            case VideoWallpaperService.SCALE_MODE_AUTO:
                return mode;
            default:
                return VideoWallpaperService.DEFAULT_CFG_SCALE_MODE;
        }
    }

    private JSObject toErrorDetails(Throwable error) {
        JSObject details = new JSObject();
        if (error == null) {
            details.put("message", "unknown");
            return details;
        }
        details.put("message", error.getMessage());
        details.put("type", error.getClass().getSimpleName());
        return details;
    }

    private void emitWallpaperLog(String stage, String level, String message, JSObject details) {
        JSObject payload = new JSObject();
        payload.put("stage", stage);
        payload.put("level", level);
        payload.put("message", message);
        payload.put("timestamp", System.currentTimeMillis());
        if (details != null) {
            payload.put("details", details);
        }

        String line = "[" + stage + "] " + message + (details != null ? " | " + details.toString() : "");
        if ("error".equals(level)) {
            Log.e(TAG, line);
        } else if ("warn".equals(level)) {
            Log.w(TAG, line);
        } else {
            Log.d(TAG, line);
        }

        notifyListeners("wallpaperLog", payload);
    }

    // ─── Internal helpers ───────────────────────────────────────

    private File getLiveWallpaperDir() {
        File dir = new File(getContext().getFilesDir(), "live_wallpapers");
        if (!dir.exists()) {
            dir.mkdirs();
        }
        return dir;
    }

    private Point getRealScreenSize() {
        try {
            WindowManager wm = (WindowManager) getContext().getSystemService(Context.WINDOW_SERVICE);
            if (wm == null) return new Point(0, 0);
            Display display = wm.getDefaultDisplay();
            Point size = new Point();
            display.getRealSize(size);
            return size;
        } catch (Exception e) {
            Log.w(TAG, "Failed to get real screen size", e);
            return new Point(0, 0);
        }
    }

    private File downloadVideo(String videoUrl, File targetFile) throws Exception {
        URL url = new URL(videoUrl);
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(CONNECT_TIMEOUT);
        conn.setReadTimeout(READ_TIMEOUT);
        conn.setRequestProperty("User-Agent", "ChristianWallpapers/1.0");
        conn.connect();

        int responseCode = conn.getResponseCode();
        if (responseCode != HttpURLConnection.HTTP_OK) {
            conn.disconnect();
            throw new Exception("Server returned HTTP " + responseCode);
        }

        long contentLength = conn.getContentLength();
        Log.d(TAG, "Downloading video: " + videoUrl + " (" + (contentLength / 1024) + " KB)");

        // Write to a temp file first, then rename (atomic operation)
        File tempFile = new File(targetFile.getParent(), targetFile.getName() + ".tmp");

        try (InputStream in = conn.getInputStream();
             FileOutputStream out = new FileOutputStream(tempFile)) {

            byte[] buffer = new byte[BUFFER_SIZE];
            long totalRead = 0;
            int bytesRead;
            int lastReportedProgress = 0;

            while ((bytesRead = in.read(buffer)) != -1) {
                out.write(buffer, 0, bytesRead);
                totalRead += bytesRead;

                // Report progress every 5%
                if (contentLength > 0) {
                    int progress = (int) (totalRead * 100 / contentLength);
                    if (progress - lastReportedProgress >= 5) {
                        lastReportedProgress = progress;
                        JSObject progressEvent = new JSObject();
                        progressEvent.put("phase", "downloading");
                        progressEvent.put("progress", progress);
                        notifyListeners("wallpaperProgress", progressEvent);
                    }
                }
            }

            out.flush();
        } finally {
            conn.disconnect();
        }

        // Atomic rename: temp → final (prevents corrupt files on interrupted downloads)
        if (tempFile.exists() && tempFile.length() > 0) {
            if (targetFile.exists()) targetFile.delete();
            tempFile.renameTo(targetFile);
            Log.d(TAG, "Video cached: " + targetFile.getAbsolutePath() + " (" + (targetFile.length() / 1024) + " KB)");
            return targetFile;
        } else {
            tempFile.delete();
            throw new Exception("Downloaded file is empty");
        }
    }

    private void applyWallpaper(File videoFile, String videoId, PluginCall call) {
        // Start each apply attempt with a fresh debug snapshot so diagnostics are not stale.
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        prefs.edit()
            .putString(KEY_PENDING_PATH, videoFile.getAbsolutePath())
            .putString(KEY_PENDING_ID, videoId)
            .putString(VideoWallpaperService.KEY_DEBUG_LAST_EVENT, "apply_requested")
            .remove(VideoWallpaperService.KEY_DEBUG_HISTORY)
            .remove(VideoWallpaperService.KEY_DEBUG_ERROR)
            .apply();

        JSObject applyDetails = new JSObject();
        applyDetails.put("videoId", videoId);
        applyDetails.put("path", videoFile.getAbsolutePath());
        applyDetails.put("sizeBytes", videoFile.length());
        applyDetails.put("scaleMode", sanitizeScaleMode(prefs.getString(VideoWallpaperService.KEY_CFG_SCALE_MODE, VideoWallpaperService.DEFAULT_CFG_SCALE_MODE)));
        emitWallpaperLog("apply", "info", "Opening wallpaper picker", applyDetails);

        // Hint desired wallpaper dimensions. Note: Android docs state this hint is
        // guaranteed mainly for the current home app; for other apps it may be ignored.
        try {
            WallpaperManager wallpaperManager = WallpaperManager.getInstance(getContext());
            Point realSize = getRealScreenSize();
            DisplayMetrics dm = getContext().getResources().getDisplayMetrics();
            int rawWidth = realSize.x > 0 ? realSize.x : dm.widthPixels;
            int rawHeight = realSize.y > 0 ? realSize.y : dm.heightPixels;

            boolean isPortraitUi = dm.heightPixels >= dm.widthPixels;
            int shortSide = Math.min(rawWidth, rawHeight);
            int longSide = Math.max(rawWidth, rawHeight);
            int targetWidth = isPortraitUi ? shortSide : longSide;
            int targetHeight = isPortraitUi ? longSide : shortSide;

            wallpaperManager.suggestDesiredDimensions(targetWidth, targetHeight);
            Log.d(TAG, "Suggested desired wallpaper size: " + targetWidth + "x" + targetHeight +
                " (raw=" + rawWidth + "x" + rawHeight + ")");

            JSObject desired = new JSObject();
            desired.put("targetWidth", targetWidth);
            desired.put("targetHeight", targetHeight);
            desired.put("rawWidth", rawWidth);
            desired.put("rawHeight", rawHeight);
            emitWallpaperLog("apply", "info", "Suggested desired wallpaper dimensions", desired);
        } catch (Exception e) {
            Log.w(TAG, "Failed to suggest desired wallpaper dimensions", e);
            emitWallpaperLog("apply", "warn", "Failed to suggest desired wallpaper dimensions", toErrorDetails(e));
        }

        // Launch Android's live wallpaper picker with startActivityForResult
        // so we can track if the user confirmed or rejected.
        try {
            Intent intent = new Intent(WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER);
            intent.putExtra(
                WallpaperManager.EXTRA_LIVE_WALLPAPER_COMPONENT,
                new ComponentName(getContext(), VideoWallpaperService.class)
            );
            startActivityForResult(call, intent, "wallpaperPickerResult");
        } catch (Exception e) {
            emitWallpaperLog("apply", "warn", "Primary picker intent failed, trying chooser fallback", toErrorDetails(e));
            // Fallback to generic live wallpaper chooser
            try {
                Intent fallback = new Intent(WallpaperManager.ACTION_LIVE_WALLPAPER_CHOOSER);
                startActivityForResult(call, fallback, "wallpaperPickerResult");
            } catch (Exception ex) {
                emitWallpaperLog("apply", "error", "Failed to open wallpaper picker", toErrorDetails(ex));
                call.reject("Failed to open wallpaper picker: " + ex.getMessage());
            }
        }
    }

    @ActivityCallback
    private void wallpaperPickerResult(PluginCall call, ActivityResult result) {
        if (call == null) {
            Log.w(TAG, "wallpaperPickerResult: call was null (bridge lost)");
            emitWallpaperLog("picker", "warn", "Picker callback lost call reference", null);
            return;
        }

        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String pendingId = prefs.getString(KEY_PENDING_ID, null);
        String requestedVideoId = call.getString("videoId", pendingId);
        boolean pickerConfirmed = result.getResultCode() == Activity.RESULT_OK;

        JSObject pickerDetails = new JSObject();
        pickerDetails.put("resultCode", result.getResultCode());
        pickerDetails.put("requestedVideoId", requestedVideoId);

        if (!pickerConfirmed) {
            Log.d(TAG, "Wallpaper picker canceled/rejected (resultCode=" + result.getResultCode() + ")");
            emitWallpaperLog("picker", "warn", "User canceled or rejected wallpaper", pickerDetails);
            clearPendingPrefs(prefs);

            JSObject res = new JSObject();
            res.put("success", true);
            res.put("applied", false);
            res.put("videoId", requestedVideoId);
            call.resolve(res);
            return;
        }

        emitWallpaperLog("picker", "info", "Picker confirmed by user", pickerDetails);

        // Some OEM flows clear pending prefs before this callback.
        // Recover from cache to ensure confirmed picks still activate reliably.
        boolean promoted = promotePendingToActive(prefs);
        if (!promoted && requestedVideoId != null && !requestedVideoId.isEmpty()) {
            promoted = promoteCachedVideoToActive(prefs, requestedVideoId);
        }

        String activeVideoId = prefs.getString(KEY_VIDEO_ID, null);
        boolean applied = promoted || (requestedVideoId != null && requestedVideoId.equals(activeVideoId));

        if (!applied) {
            clearPendingPrefs(prefs);
        }

        Log.d(TAG, "Wallpaper picker confirmed: requested=" + requestedVideoId +
            ", promoted=" + promoted +
            ", activeId=" + activeVideoId +
            ", initialApplied=" + applied);

        JSObject applyResult = new JSObject();
        applyResult.put("requestedVideoId", requestedVideoId);
        applyResult.put("promoted", promoted);
        applyResult.put("activeVideoId", activeVideoId);
        applyResult.put("initialApplied", applied);
        emitWallpaperLog("apply", applied ? "info" : "warn", "Post-picker activation state", applyResult);

        resolveAfterActivationCheck(call, requestedVideoId, applied, 0);
    }

    private void resolveAfterActivationCheck(PluginCall call, String requestedVideoId, boolean appliedByPrefs, int attempt) {
        SharedPreferences prefs = getContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String activeVideoId = prefs.getString(KEY_VIDEO_ID, null);
        boolean activeIdMatches = requestedVideoId != null && requestedVideoId.equals(activeVideoId);

        boolean serviceActiveByManager = isOurWallpaperServiceActive();
        boolean serviceActiveByEngine = prefs.getBoolean(VideoWallpaperService.KEY_DEBUG_SERVICE_ACTIVE, false);
        boolean serviceActive = serviceActiveByManager || serviceActiveByEngine;

        // NOTE: On modern Android builds, WallpaperManager.getWallpaperInfo() can return null
        // for third-party apps even when wallpaper is applied. So serviceActive is diagnostics-only.
        boolean applied = appliedByPrefs && activeIdMatches;

        if (applied) {
            prefs.edit().remove(VideoWallpaperService.KEY_DEBUG_ERROR).apply();
        }

        Log.d(TAG, "Wallpaper activation check: requested=" + requestedVideoId +
            ", activeId=" + activeVideoId +
            ", serviceActive=" + serviceActive +
            ", serviceActiveByManager=" + serviceActiveByManager +
            ", serviceActiveByEngine=" + serviceActiveByEngine +
            ", appliedByPrefs=" + appliedByPrefs +
            ", attempt=" + attempt +
            ", applied=" + applied);

        JSObject res = new JSObject();
        res.put("success", true);
        res.put("applied", applied);
        res.put("videoId", requestedVideoId);
        res.put("serviceActive", serviceActive);
        res.put("serviceActiveByManager", serviceActiveByManager);
        res.put("serviceActiveByEngine", serviceActiveByEngine);
        res.put("activeVideoId", activeVideoId);
        res.put("scaleMode", sanitizeScaleMode(prefs.getString(VideoWallpaperService.KEY_CFG_SCALE_MODE, VideoWallpaperService.DEFAULT_CFG_SCALE_MODE)));
        res.put("effectiveScaleMode", prefs.getString(VideoWallpaperService.KEY_DEBUG_EFFECTIVE_SCALE_MODE, null));
        res.put("lastEvent", prefs.getString(VideoWallpaperService.KEY_DEBUG_LAST_EVENT, null));
        res.put("lastError", prefs.getString(VideoWallpaperService.KEY_DEBUG_ERROR, null));

        emitWallpaperLog("verify", applied ? "info" : "warn", applied ? "Wallpaper activation verified" : "Wallpaper activation not verified", res);
        call.resolve(res);
    }

    private boolean isOurWallpaperServiceActive() {
        try {
            WallpaperManager wallpaperManager = WallpaperManager.getInstance(getContext());
            WallpaperInfo info = wallpaperManager.getWallpaperInfo();
            if (info == null) return false;

            ComponentName activeComponent = info.getComponent();
            ComponentName expectedComponent = new ComponentName(getContext(), VideoWallpaperService.class);
            return activeComponent != null && activeComponent.equals(expectedComponent);
        } catch (Exception e) {
            Log.w(TAG, "Unable to verify active wallpaper component", e);
            return false;
        }
    }

    private boolean promotePendingToActive(SharedPreferences prefs) {
        try {
            String pendingPath = prefs.getString(KEY_PENDING_PATH, null);
            String pendingId = prefs.getString(KEY_PENDING_ID, null);

            if (pendingPath == null || pendingId == null) {
                Log.w(TAG, "No pending wallpaper to promote");
                return false;
            }

            File videoFile = new File(pendingPath);
            if (!videoFile.exists() || videoFile.length() <= 0) {
                Log.e(TAG, "Pending wallpaper file missing/empty: " + pendingPath);
                clearPendingPrefs(prefs);
                return false;
            }

            boolean committed = prefs.edit()
                .putString(KEY_VIDEO_PATH, pendingPath)
                .putString(KEY_VIDEO_ID, pendingId)
                .remove(KEY_PENDING_PATH)
                .remove(KEY_PENDING_ID)
                .commit();

            Log.d(TAG, "Promoted pending → active in plugin callback: " + pendingId + " (committed=" + committed + ")");
            return committed;
        } catch (Exception e) {
            Log.e(TAG, "Failed to promote pending wallpaper", e);
            return false;
        }
    }

    private boolean promoteCachedVideoToActive(SharedPreferences prefs, String videoId) {
        try {
            if (videoId == null || videoId.isEmpty()) {
                return false;
            }

            File cachedFile = new File(getLiveWallpaperDir(), videoId + ".mp4");
            if (!cachedFile.exists() || cachedFile.length() <= 0) {
                Log.w(TAG, "Cached video missing/empty for recovery promote: " + videoId);
                return false;
            }

            boolean committed = prefs.edit()
                .putString(KEY_VIDEO_PATH, cachedFile.getAbsolutePath())
                .putString(KEY_VIDEO_ID, videoId)
                .remove(KEY_PENDING_PATH)
                .remove(KEY_PENDING_ID)
                .commit();

            Log.d(TAG, "Recovered cached wallpaper to active: " + videoId + " (committed=" + committed + ")");
            return committed;
        } catch (Exception e) {
            Log.e(TAG, "Failed recovery promote from cache", e);
            return false;
        }
    }

    private void clearPendingPrefs(SharedPreferences prefs) {
        prefs.edit()
            .remove(KEY_PENDING_PATH)
            .remove(KEY_PENDING_ID)
            .apply();
    }
}
