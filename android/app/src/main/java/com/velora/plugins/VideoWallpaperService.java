package com.velora.plugins;

import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Point;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.util.Log;
import android.view.Display;
import android.view.SurfaceHolder;
import android.view.WindowManager;

import java.io.File;

/**
 * Production Video Live Wallpaper Service.
 *
 * Scaling strategy:
 *   - Default uses CENTER_CROP via SCALE_TO_FIT_WITH_CROPPING
 *   - When expected video dimensions are provided from JS and MediaPlayer reports
 *     different dimensions (bad SAR/metadata), uses manual crop:
 *     SCALE_TO_FIT + setFixedSize to achieve correct center crop without distortion
 *   - This matches Android's native wallpaper picker behavior
 */
public class VideoWallpaperService extends WallpaperService {

    private static final String TAG = "VideoWallpaperService";
    public static final String PREFS_NAME = "live_wallpaper_prefs";
    public static final String KEY_VIDEO_PATH = "active_video_path";
    public static final String KEY_VIDEO_ID = "active_video_id";
    public static final String KEY_PENDING_PATH = "pending_video_path";
    public static final String KEY_PENDING_ID = "pending_video_id";
    private static final int MAX_RETRIES = 3;
    private static final long RETRY_DELAY_MS = 800;

    // Expected video dimensions from JS (to override wrong MediaPlayer reports)
    public static final String KEY_EXPECTED_VIDEO_W = "expected_video_w";
    public static final String KEY_EXPECTED_VIDEO_H = "expected_video_h";

    // Debug keys readable from JS
    public static final String KEY_DEBUG_LAST_EVENT = "debug_last_event";
    public static final String KEY_DEBUG_SURFACE_W = "debug_surface_w";
    public static final String KEY_DEBUG_SURFACE_H = "debug_surface_h";
    public static final String KEY_DEBUG_VIDEO_W = "debug_video_w";
    public static final String KEY_DEBUG_VIDEO_H = "debug_video_h";
    public static final String KEY_DEBUG_REAL_SCREEN_W = "debug_real_screen_w";
    public static final String KEY_DEBUG_REAL_SCREEN_H = "debug_real_screen_h";
    public static final String KEY_DEBUG_IS_PREVIEW = "debug_is_preview";
    public static final String KEY_DEBUG_SCALING_MODE = "debug_scaling_mode";
    public static final String KEY_DEBUG_REQUESTED_SCALE_MODE = "debug_requested_scale_mode";
    public static final String KEY_DEBUG_EFFECTIVE_SCALE_MODE = "debug_effective_scale_mode";
    public static final String KEY_DEBUG_SELECTED_PATH = "debug_selected_path";
    public static final String KEY_DEBUG_DESIRED_W = "debug_desired_w";
    public static final String KEY_DEBUG_DESIRED_H = "debug_desired_h";
    public static final String KEY_DEBUG_ASPECT_NOTE = "debug_aspect_note";
    public static final String KEY_DEBUG_HISTORY = "debug_history";
    public static final String KEY_DEBUG_ERROR = "debug_error";
    public static final String KEY_DEBUG_SERVICE_ACTIVE = "debug_service_active";
    private static final int MAX_DEBUG_HISTORY_LINES = 40;

    // Runtime render config keys
    public static final String KEY_CFG_USE_SET_DISPLAY = "cfg_use_set_display";
    public static final String KEY_CFG_ENABLE_FIXED_SIZE_FALLBACK = "cfg_enable_fixed_size_fallback";
    public static final String KEY_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW = "cfg_enable_fixed_size_in_preview";
    public static final String KEY_CFG_ENABLE_SIZE_FROM_LAYOUT = "cfg_enable_size_from_layout";
    public static final String KEY_CFG_PREVIEW_INIT_DELAY_MS = "cfg_preview_init_delay_ms";
    public static final String KEY_CFG_SCALE_MODE = "cfg_scale_mode";

    public static final String SCALE_MODE_AUTO = "auto";
    public static final String SCALE_MODE_CENTER_CROP = "center_crop";
    public static final String SCALE_MODE_FIT_CENTER = "fit_center";
    public static final String SCALE_MODE_FIT_WIDTH = "fit_width";
    public static final String SCALE_MODE_FIT_HEIGHT = "fit_height";

    public static final boolean DEFAULT_CFG_USE_SET_DISPLAY = false;
    public static final boolean DEFAULT_CFG_ENABLE_FIXED_SIZE_FALLBACK = false;
    public static final boolean DEFAULT_CFG_ENABLE_FIXED_SIZE_IN_PREVIEW = false;
    public static final boolean DEFAULT_CFG_ENABLE_SIZE_FROM_LAYOUT = false;
    public static final int DEFAULT_CFG_PREVIEW_INIT_DELAY_MS = 0;
    public static final int MAX_CFG_PREVIEW_INIT_DELAY_MS = 1000;
    public static final String DEFAULT_CFG_SCALE_MODE = SCALE_MODE_CENTER_CROP;

    // Threshold for dimension mismatch detection (10% difference)
    private static final float DIMENSION_MISMATCH_THRESHOLD = 0.10f;

    @Override
    public Engine onCreateEngine() {
        return new VideoEngine();
    }

    private class VideoEngine extends Engine {
        private MediaPlayer mediaPlayer;
        private boolean surfaceReady = false;
        private int retryCount = 0;
        private final Handler handler = new Handler(Looper.getMainLooper());
        private String currentVideoPath = null;
        private int surfaceWidth = 0;
        private int surfaceHeight = 0;
        private boolean usedManualCrop = false;
        private SharedPreferences prefs;
        private SharedPreferences.OnSharedPreferenceChangeListener prefsListener;

        @Override
        public void onCreate(SurfaceHolder surfaceHolder) {
            super.onCreate(surfaceHolder);
            setTouchEventsEnabled(false);
            setOffsetNotificationsEnabled(false);

            prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefsListener = (sharedPreferences, key) -> {
                if (!KEY_VIDEO_PATH.equals(key) && !KEY_VIDEO_ID.equals(key)) return;
                if (isPreview() || !surfaceReady) return;

                String latestPath = getActiveVideoPath();
                if (latestPath != null && !latestPath.equals(currentVideoPath)) {
                    Log.d(TAG, "Active prefs changed — reloading: " + currentVideoPath + " → " + latestPath);
                    retryCount = 0;
                    handler.post(() -> initializePlayer(getSurfaceHolder()));
                }
            };
            prefs.registerOnSharedPreferenceChangeListener(prefsListener);
            markEvent("engine_created");
            debugPut(KEY_DEBUG_IS_PREVIEW, isPreview());
        }

        @Override
        public void onSurfaceCreated(SurfaceHolder holder) {
            super.onSurfaceCreated(holder);
            surfaceReady = true;
            retryCount = 0;
            currentVideoPath = null;
            usedManualCrop = false;

            debugPut(KEY_DEBUG_IS_PREVIEW, isPreview());
            markEvent(isPreview() ? "surface_created_preview" : "surface_created_active");

            if (!isPreview()) {
                debugPut(KEY_DEBUG_SERVICE_ACTIVE, true);
                promotePendingToActive();
                Log.d(TAG, "Non-preview engine — promoted pending to active");
            } else {
                Log.d(TAG, "Preview engine — will show pending video");
            }

            initializePlayer(holder);
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            super.onSurfaceChanged(holder, format, width, height);
            surfaceWidth = width;
            surfaceHeight = height;
            debugPutInt(KEY_DEBUG_SURFACE_W, width);
            debugPutInt(KEY_DEBUG_SURFACE_H, height);

            Point screenSize = getRealScreenSize();
            int screenW = screenSize.x;
            int screenH = screenSize.y;
            debugPutInt(KEY_DEBUG_REAL_SCREEN_W, screenW);
            debugPutInt(KEY_DEBUG_REAL_SCREEN_H, screenH);

            markEvent("surface_changed");
            appendDebugHistory("surface raw=" + width + "x" + height + " screen=" + screenW + "x" + screenH);
            Log.d(TAG, "Surface changed: raw=" + width + "x" + height + ", screen=" + screenW + "x" + screenH);
        }

        @Override
        public void onVisibilityChanged(boolean visible) {
            super.onVisibilityChanged(visible);

            if (visible && surfaceReady) {
                String latestPath = isPreview() ? getPendingVideoPath() : getActiveVideoPath();
                if (latestPath == null) latestPath = getActiveVideoPath();

                if (latestPath != null && !latestPath.equals(currentVideoPath)) {
                    Log.d(TAG, "Video changed on visibility: " + currentVideoPath + " → " + latestPath);
                    retryCount = 0;
                    initializePlayer(getSurfaceHolder());
                    return;
                }

                if (mediaPlayer != null) {
                    try {
                        attachOutput(mediaPlayer, getSurfaceHolder());
                        if (!mediaPlayer.isPlaying()) {
                            mediaPlayer.seekTo(0);
                            mediaPlayer.start();
                        }
                    } catch (Exception e) {
                        Log.w(TAG, "Resume output attach failed, re-init", e);
                        retryCount = 0;
                        initializePlayer(getSurfaceHolder());
                    }
                } else {
                    retryCount = 0;
                    initializePlayer(getSurfaceHolder());
                }
            } else if (!visible && mediaPlayer != null) {
                try {
                    if (mediaPlayer.isPlaying()) mediaPlayer.pause();
                } catch (IllegalStateException ignored) {}
            }
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            super.onSurfaceDestroyed(holder);
            surfaceReady = false;
            usedManualCrop = false;
            handler.removeCallbacksAndMessages(null);
            releasePlayer();

            if (isPreview()) {
                clearPendingPrefs();
                Log.d(TAG, "Preview destroyed — cleared pending prefs");
            } else {
                debugPut(KEY_DEBUG_SERVICE_ACTIVE, false);
            }
        }

        @Override
        public void onDestroy() {
            super.onDestroy();
            surfaceReady = false;
            handler.removeCallbacksAndMessages(null);
            if (!isPreview()) {
                debugPut(KEY_DEBUG_SERVICE_ACTIVE, false);
            }
            if (prefs != null && prefsListener != null) {
                prefs.unregisterOnSharedPreferenceChangeListener(prefsListener);
            }
            releasePlayer();
        }

        private void promotePendingToActive() {
            try {
                SharedPreferences p = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String pendingPath = p.getString(KEY_PENDING_PATH, null);
                String pendingId = p.getString(KEY_PENDING_ID, null);

                if (pendingPath != null && pendingId != null) {
                    File f = new File(pendingPath);
                    if (f.exists() && f.length() > 0) {
                        p.edit()
                            .putString(KEY_VIDEO_PATH, pendingPath)
                            .putString(KEY_VIDEO_ID, pendingId)
                            .remove(KEY_PENDING_PATH)
                            .remove(KEY_PENDING_ID)
                            .apply();
                        Log.d(TAG, "Promoted pending → active: " + pendingId);
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error promoting pending", e);
            }
        }

        private void clearPendingPrefs() {
            try {
                getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE).edit()
                    .remove(KEY_PENDING_PATH)
                    .remove(KEY_PENDING_ID)
                    .apply();
            } catch (Exception ignored) {}
        }

        private String getPendingVideoPath() {
            try {
                String path = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                    .getString(KEY_PENDING_PATH, null);
                if (path != null) {
                    File f = new File(path);
                    if (f.exists() && f.length() > 0) return path;
                }
            } catch (Exception ignored) {}
            return null;
        }

        private String getActiveVideoPath() {
            try {
                SharedPreferences p = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                String videoPath = p.getString(KEY_VIDEO_PATH, null);
                if (videoPath != null) {
                    File f = new File(videoPath);
                    if (f.exists() && f.length() > 0) return videoPath;
                }
                String videoId = p.getString(KEY_VIDEO_ID, null);
                if (videoId != null) {
                    File f = new File(getFilesDir(), "live_wallpapers/" + videoId + ".mp4");
                    if (f.exists() && f.length() > 0) return f.getAbsolutePath();
                }
            } catch (Exception ignored) {}
            return null;
        }

        /**
         * Read expected video dimensions from SharedPreferences (set by JS plugin).
         * Returns null if not set.
         */
        private int[] getExpectedVideoDimensions() {
            if (prefs == null) return null;
            int w = prefs.getInt(KEY_EXPECTED_VIDEO_W, 0);
            int h = prefs.getInt(KEY_EXPECTED_VIDEO_H, 0);
            if (w > 0 && h > 0) return new int[]{w, h};
            return null;
        }

        /**
         * Check if MediaPlayer-reported dimensions significantly differ from expected.
         */
        private boolean isDimensionMismatch(int reportedW, int reportedH, int expectedW, int expectedH) {
            if (reportedW <= 0 || reportedH <= 0 || expectedW <= 0 || expectedH <= 0) return false;
            float wDiff = Math.abs(reportedW - expectedW) / (float) expectedW;
            float hDiff = Math.abs(reportedH - expectedH) / (float) expectedH;
            return wDiff > DIMENSION_MISMATCH_THRESHOLD || hDiff > DIMENSION_MISMATCH_THRESHOLD;
        }

        /**
         * Calculate the surface size needed for center crop using known video dimensions.
         * Returns [width, height] for setFixedSize.
         */
        private int[] calculateManualCropSurface(int videoW, int videoH, int screenW, int screenH) {
            float videoAspect = videoW / (float) videoH;
            float screenAspect = screenW / (float) screenH;

            int surfW, surfH;
            if (videoAspect > screenAspect) {
                // Video is wider → scale to fill height, crop width
                surfH = screenH;
                surfW = Math.round(screenH * videoAspect);
            } else {
                // Video is taller → scale to fill width, crop height
                surfW = screenW;
                surfH = Math.round(screenW / videoAspect);
            }
            return new int[]{surfW, surfH};
        }

        private void initializePlayer(SurfaceHolder holder) {
            releasePlayer();

            if (holder == null || !surfaceReady) {
                Log.w(TAG, "Surface not ready, skipping init");
                return;
            }

            String videoPath = null;
            if (isPreview()) {
                videoPath = getPendingVideoPath();
                Log.d(TAG, "Preview mode — pending path: " + videoPath);
            }
            if (videoPath == null) {
                if (!isPreview()) promotePendingToActive();
                videoPath = getActiveVideoPath();
            }
            if (videoPath == null) {
                Log.e(TAG, "No video file found");
                markEvent("no_video_path");
                return;
            }

            final String finalPath = videoPath;
            currentVideoPath = finalPath;
            usedManualCrop = false;
            debugPutString(KEY_DEBUG_SELECTED_PATH, finalPath);
            markEvent(isPreview() ? "player_init_preview" : "player_init_active");
            Log.d(TAG, "Init player: " + finalPath);

            try {
                mediaPlayer = new MediaPlayer();
                mediaPlayer.setDataSource(VideoWallpaperService.this, Uri.fromFile(new File(finalPath)));

                attachOutput(mediaPlayer, holder);

                mediaPlayer.setVolume(0f, 0f);
                mediaPlayer.setLooping(true);

                // Apply initial scaling (center_crop) before prepare
                try {
                    ScaleDecision initialScale = resolveScaleDecision(getScaleModePreference(), 0, 0, 0, 0);
                    mpApplyScaling(mediaPlayer, initialScale, "pre_prepare");
                } catch (Exception e) {
                    Log.w(TAG, "Scaling mode not supported before prepare", e);
                    debugPutString(KEY_DEBUG_SCALING_MODE, "FAILED_PRE");
                }

                mediaPlayer.setOnVideoSizeChangedListener((mp, w, h) -> {
                    debugPutInt(KEY_DEBUG_VIDEO_W, w);
                    debugPutInt(KEY_DEBUG_VIDEO_H, h);
                    Log.d(TAG, "Video size reported: " + w + "x" + h);
                });

                mediaPlayer.setOnPreparedListener(mp -> {
                    try {
                        int reportedW = mp.getVideoWidth();
                        int reportedH = mp.getVideoHeight();
                        debugPutInt(KEY_DEBUG_VIDEO_W, reportedW);
                        debugPutInt(KEY_DEBUG_VIDEO_H, reportedH);
                        debugPutInt(KEY_DEBUG_DESIRED_W, getDesiredMinimumWidth());
                        debugPutInt(KEY_DEBUG_DESIRED_H, getDesiredMinimumHeight());

                        Point realScreen = getRealScreenSize();
                        int screenW = realScreen.x > 0 ? realScreen.x : surfaceWidth;
                        int screenH = realScreen.y > 0 ? realScreen.y : surfaceHeight;

                        // Check for dimension mismatch with expected dimensions
                        int[] expected = getExpectedVideoDimensions();
                        boolean mismatch = expected != null && isDimensionMismatch(reportedW, reportedH, expected[0], expected[1]);

                        if (mismatch) {
                            // MediaPlayer reports wrong dimensions — use manual crop
                            // Strategy: SCALE_TO_FIT (no distortion) + setFixedSize for crop
                            appendDebugHistory("MISMATCH detected: reported=" + reportedW + "x" + reportedH +
                                " expected=" + expected[0] + "x" + expected[1] +
                                " → using manual crop with SCALE_TO_FIT + setFixedSize");
                            markEvent("dimension_mismatch_detected");

                            int[] cropSurface = calculateManualCropSurface(expected[0], expected[1], screenW, screenH);

                            try {
                                holder.setFixedSize(cropSurface[0], cropSurface[1]);
                                mp.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT);
                                usedManualCrop = true;

                                debugPutString(KEY_DEBUG_SCALING_MODE, "MANUAL_CROP_SCALE_TO_FIT");
                                debugPutString(KEY_DEBUG_EFFECTIVE_SCALE_MODE, "manual_center_crop");
                                debugPutString(KEY_DEBUG_REQUESTED_SCALE_MODE, getScaleModePreference());
                                appendDebugHistory("manual_crop applied: fixedSize=" + cropSurface[0] + "x" + cropSurface[1] +
                                    " using expected=" + expected[0] + "x" + expected[1] +
                                    " screen=" + screenW + "x" + screenH);
                                Log.d(TAG, "Manual crop: setFixedSize(" + cropSurface[0] + "x" + cropSurface[1] +
                                    ") with SCALE_TO_FIT for video " + expected[0] + "x" + expected[1]);
                            } catch (Exception fixedSizeErr) {
                                // setFixedSize failed (some OEMs) — fall back to standard center_crop
                                Log.w(TAG, "setFixedSize failed, falling back to standard center_crop", fixedSizeErr);
                                appendDebugHistory("setFixedSize FAILED: " + fixedSizeErr.getClass().getSimpleName() +
                                    " — falling back to SCALE_TO_FIT_WITH_CROPPING");
                                markEvent("manual_crop_fallback");

                                mp.setVideoScalingMode(MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING);
                                debugPutString(KEY_DEBUG_SCALING_MODE, "SCALE_TO_FIT_WITH_CROPPING_FALLBACK");
                                debugPutString(KEY_DEBUG_EFFECTIVE_SCALE_MODE, SCALE_MODE_CENTER_CROP);
                            }
                        } else {
                            // Normal path — dimensions match or no expected dims
                            ScaleDecision scaleDecision = resolveScaleDecision(getScaleModePreference(), reportedW, reportedH, screenW, screenH);
                            mpApplyScaling(mp, scaleDecision, "on_prepared");

                            if (expected != null) {
                                appendDebugHistory("dimensions_match: reported=" + reportedW + "x" + reportedH +
                                    " expected=" + expected[0] + "x" + expected[1] + " — using standard scaling");
                            }
                        }

                        String aspectNote = (mismatch ? "manual_crop_override" : "standard") +
                            " | reported=" + reportedW + "x" + reportedH +
                            (expected != null ? " | expected=" + expected[0] + "x" + expected[1] : "") +
                            " | surface=" + surfaceWidth + "x" + surfaceHeight +
                            " | screen=" + screenW + "x" + screenH;

                        debugPutString(KEY_DEBUG_ASPECT_NOTE, aspectNote);

                        float reportedRatio = reportedW > 0 && reportedH > 0 ? reportedW / (float) reportedH : 0;
                        float screenRatio = screenW > 0 && screenH > 0 ? screenW / (float) screenH : 0;
                        float ratioDelta = Math.abs(reportedRatio - screenRatio);

                        if (ratioDelta > 0.02f) {
                            markEvent(mismatch ? "aspect_mismatch_manual_crop" : "aspect_mismatch_center_crop");
                        } else {
                            markEvent("aspect_close_match");
                        }

                        debugRemove(KEY_DEBUG_ERROR);
                        markEvent("prepared");
                        appendDebugHistory("scale mode=" + (mismatch ? "manual_crop" : getScaleModePreference()) +
                            " ratioDelta=" + String.format(java.util.Locale.US, "%.3f", ratioDelta) +
                            " mismatch=" + mismatch);

                        mp.start();
                        Log.d(TAG, "Playing: " + finalPath +
                            " (reported=" + reportedW + "x" + reportedH +
                            (expected != null ? ", expected=" + expected[0] + "x" + expected[1] : "") +
                            ", surface=" + surfaceWidth + "x" + surfaceHeight +
                            ", mismatch=" + mismatch + ")");
                    } catch (Exception e) {
                        Log.e(TAG, "Start failed in onPrepared", e);
                        debugPutString(KEY_DEBUG_ERROR, "start_failed: " + e.getMessage());
                        markEvent("prepared_error");
                        retryInit(holder);
                    }
                });

                mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                    Log.e(TAG, "MediaPlayer error: what=" + what + " extra=" + extra);
                    debugPutString(KEY_DEBUG_ERROR, "what=" + what + ",extra=" + extra);
                    markEvent("player_error");
                    releasePlayer();
                    retryInit(holder);
                    return true;
                });

                mediaPlayer.prepareAsync();

            } catch (Exception e) {
                Log.e(TAG, "Failed to init MediaPlayer", e);
                debugPutString(KEY_DEBUG_ERROR, "init_failed: " + e.getMessage());
                releasePlayer();
                retryInit(holder);
            }
        }

        private void retryInit(SurfaceHolder holder) {
            if (retryCount < MAX_RETRIES && surfaceReady) {
                retryCount++;
                long delay = RETRY_DELAY_MS * retryCount;
                markEvent("retry_" + retryCount);
                Log.w(TAG, "Retry " + retryCount + "/" + MAX_RETRIES + " in " + delay + "ms");
                handler.postDelayed(() -> {
                    if (surfaceReady) initializePlayer(holder);
                }, delay);
            } else {
                markEvent("retry_exhausted");
                Log.e(TAG, "Max retries reached");
            }
        }

        private void attachOutput(MediaPlayer player, SurfaceHolder holder) {
            boolean useSetDisplay = getConfigBoolean(KEY_CFG_USE_SET_DISPLAY, DEFAULT_CFG_USE_SET_DISPLAY);

            try {
                player.setScreenOnWhilePlaying(false);
            } catch (Exception ignored) {}

            if (useSetDisplay) {
                try {
                    if (holder == null) throw new IllegalStateException("holder_null");
                    holder.setKeepScreenOn(false);
                    player.setDisplay(holder);
                    markEvent("output_display");
                    return;
                } catch (Exception e) {
                    Log.w(TAG, "setDisplay failed, falling back to setSurface", e);
                    appendDebugHistory("setDisplay failed -> fallback setSurface: " + e.getClass().getSimpleName());
                    debugPutString(KEY_DEBUG_ERROR, "display_failed: " + e.getMessage());
                    try { player.setDisplay(null); } catch (Exception ignored) {}
                }
            }

            try {
                if (holder == null || holder.getSurface() == null || !holder.getSurface().isValid()) {
                    throw new IllegalStateException("surface_invalid");
                }
                player.setSurface(holder.getSurface());
                markEvent(useSetDisplay ? "output_surface_fallback" : "output_surface");
            } catch (Exception e) {
                Log.e(TAG, "setSurface failed", e);
                debugPutString(KEY_DEBUG_ERROR, "surface_failed: " + e.getMessage());
                throw (e instanceof RuntimeException) ? (RuntimeException) e : new RuntimeException(e);
            }
        }

        private void mpApplyScaling(MediaPlayer player, ScaleDecision decision, String stage) {
            player.setVideoScalingMode(decision.mediaPlayerMode);
            debugPutString(KEY_DEBUG_SCALING_MODE, decision.debugScalingMode);
            debugPutString(KEY_DEBUG_REQUESTED_SCALE_MODE, decision.requestedMode);
            debugPutString(KEY_DEBUG_EFFECTIVE_SCALE_MODE, decision.effectiveMode);
            appendDebugHistory("scaling stage=" + stage +
                " requested=" + decision.requestedMode +
                " effective=" + decision.effectiveMode +
                " mode=" + decision.debugScalingMode +
                " note=" + decision.aspectNote);
        }

        /**
         * Resolve scaling decision.
         * Both "auto" and "center_crop" always use SCALE_TO_FIT_WITH_CROPPING.
         * Manual crop override (when dimension mismatch is detected) is handled
         * separately in onPrepared, not here.
         */
        private ScaleDecision resolveScaleDecision(String requestedMode, int videoW, int videoH, int screenW, int screenH) {
            String normalizedRequested = normalizeScaleMode(requestedMode);
            float videoRatio = (videoW > 0 && videoH > 0) ? (videoW / (float) videoH) : 0f;
            float screenRatio = (screenW > 0 && screenH > 0) ? (screenW / (float) screenH) : 0f;
            float ratioDelta = (videoRatio > 0f && screenRatio > 0f) ? Math.abs(videoRatio - screenRatio) : 0f;

            String effectiveMode = normalizedRequested;
            String note = "configured";

            if (SCALE_MODE_AUTO.equals(normalizedRequested)) {
                effectiveMode = SCALE_MODE_CENTER_CROP;
                note = (videoRatio <= 0f || screenRatio <= 0f)
                    ? "auto_center_crop_no_dimensions"
                    : "auto_center_crop_forced (delta=" + String.format(java.util.Locale.US, "%.3f", ratioDelta) + ")";
            } else if (SCALE_MODE_FIT_WIDTH.equals(normalizedRequested) || SCALE_MODE_FIT_HEIGHT.equals(normalizedRequested)) {
                effectiveMode = SCALE_MODE_FIT_CENTER;
                note = normalizedRequested + "_approximated_with_fit_center";
            }

            int mediaPlayerMode = SCALE_MODE_CENTER_CROP.equals(effectiveMode)
                ? MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
                : MediaPlayer.VIDEO_SCALING_MODE_SCALE_TO_FIT;
            String debugScalingMode = SCALE_MODE_CENTER_CROP.equals(effectiveMode)
                ? "SCALE_TO_FIT_WITH_CROPPING"
                : "SCALE_TO_FIT";

            return new ScaleDecision(normalizedRequested, effectiveMode, mediaPlayerMode, debugScalingMode, note, ratioDelta);
        }

        private String getScaleModePreference() {
            if (prefs == null) return DEFAULT_CFG_SCALE_MODE;
            try {
                return normalizeScaleMode(prefs.getString(KEY_CFG_SCALE_MODE, DEFAULT_CFG_SCALE_MODE));
            } catch (Exception ignored) {
                return DEFAULT_CFG_SCALE_MODE;
            }
        }

        private String normalizeScaleMode(String mode) {
            if (mode == null) return DEFAULT_CFG_SCALE_MODE;
            switch (mode) {
                case SCALE_MODE_CENTER_CROP:
                case SCALE_MODE_FIT_CENTER:
                case SCALE_MODE_FIT_WIDTH:
                case SCALE_MODE_FIT_HEIGHT:
                case SCALE_MODE_AUTO:
                    return mode;
                default:
                    return DEFAULT_CFG_SCALE_MODE;
            }
        }

        private final class ScaleDecision {
            final String requestedMode;
            final String effectiveMode;
            final int mediaPlayerMode;
            final String debugScalingMode;
            final String aspectNote;
            final float ratioDelta;

            ScaleDecision(String requestedMode, String effectiveMode, int mediaPlayerMode,
                          String debugScalingMode, String aspectNote, float ratioDelta) {
                this.requestedMode = requestedMode;
                this.effectiveMode = effectiveMode;
                this.mediaPlayerMode = mediaPlayerMode;
                this.debugScalingMode = debugScalingMode;
                this.aspectNote = aspectNote;
                this.ratioDelta = ratioDelta;
            }
        }

        // ── Debug helpers ──

        private void debugPutString(String key, String value) {
            if (prefs == null) return;
            try { prefs.edit().putString(key, value).apply(); } catch (Exception ignored) {}
        }

        private void debugPutInt(String key, int value) {
            if (prefs == null) return;
            try { prefs.edit().putInt(key, value).apply(); } catch (Exception ignored) {}
        }

        private void debugRemove(String key) {
            if (prefs == null) return;
            try { prefs.edit().remove(key).apply(); } catch (Exception ignored) {}
        }

        private boolean getConfigBoolean(String key, boolean defaultValue) {
            if (prefs == null) return defaultValue;
            try {
                return prefs.getBoolean(key, defaultValue);
            } catch (Exception ignored) {
                return defaultValue;
            }
        }

        private void debugPut(String key, boolean value) {
            if (prefs == null) return;
            try { prefs.edit().putBoolean(key, value).apply(); } catch (Exception ignored) {}
        }

        private void markEvent(String event) {
            debugPutString(KEY_DEBUG_LAST_EVENT, event);
            appendDebugHistory((isPreview() ? "preview" : "active") + " | event=" + event +
                " | surface=" + surfaceWidth + "x" + surfaceHeight);
            Log.d(TAG, "EVENT: " + event);
        }

        private void appendDebugHistory(String line) {
            if (prefs == null) return;
            try {
                String current = prefs.getString(KEY_DEBUG_HISTORY, "");
                String[] lines = current == null || current.isEmpty() ? new String[0] : current.split("\\n");
                StringBuilder sb = new StringBuilder();
                int start = Math.max(0, lines.length - (MAX_DEBUG_HISTORY_LINES - 1));
                for (int i = start; i < lines.length; i++) {
                    if (lines[i] != null && !lines[i].isEmpty()) {
                        sb.append(lines[i]).append("\\n");
                    }
                }
                sb.append(System.currentTimeMillis())
                  .append(" | ")
                  .append(line);
                prefs.edit().putString(KEY_DEBUG_HISTORY, sb.toString()).apply();
            } catch (Exception ignored) {}
        }

        private Point getRealScreenSize() {
            try {
                WindowManager wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
                if (wm == null) return new Point(0, 0);
                Display display = wm.getDefaultDisplay();
                Point size = new Point();
                display.getRealSize(size);
                return size;
            } catch (Exception e) {
                Log.w(TAG, "Failed to get real screen size in engine", e);
                return new Point(0, 0);
            }
        }

        private void releasePlayer() {
            if (mediaPlayer != null) {
                try { if (mediaPlayer.isPlaying()) mediaPlayer.stop(); } catch (Exception ignored) {}
                try { mediaPlayer.reset(); } catch (Exception ignored) {}
                try { mediaPlayer.release(); } catch (Exception ignored) {}
                mediaPlayer = null;
            }
        }
    }
}
