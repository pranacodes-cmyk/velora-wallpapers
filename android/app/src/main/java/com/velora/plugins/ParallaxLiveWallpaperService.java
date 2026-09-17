package com.velora.plugins;

import android.app.ActivityManager;
import android.content.Context;
import android.content.SharedPreferences;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Typeface;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.opengl.EGL14;
import android.opengl.EGLConfig;
import android.opengl.EGLContext;
import android.opengl.EGLDisplay;
import android.opengl.EGLSurface;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.util.Log;
import android.view.SurfaceHolder;

import java.io.File;

/**
 * Parallax Live Wallpaper Service — GLES 2.0 edition.
 *
 * The scene is rendered by {@link ParallaxSceneRenderer} as layered quads at
 * real depths behind a perspective camera. Tilt does NOT translate layers; it
 * ORBITS the camera, so the projection produces true parallax (perspective
 * skew, edge occlusion, differential layer speed) instead of a 2D slide.
 *
 * Input path: TYPE_GAME_ROTATION_VECTOR (gyro-fused, no magnetometer drift)
 * → roll/pitch → subtract a slowly-adapting baseline (auto-recentre, so
 * whatever way you hold the phone becomes neutral) → single critically-damped
 * spring on the camera angles (one spring for the whole camera is what makes it
 * feel like one solid object rather than layers on strings).
 *
 * Assets staged by {@link ParallaxWallpaperPlugin} into
 *   filesDir/parallax/&lt;sceneId&gt;/bg.jpg and fg.png
 *
 * Battery: EGL surface + sensors are torn down whenever the wallpaper is
 * hidden; low-RAM devices are capped at 30fps with reduced atmosphere.
 */
public class ParallaxLiveWallpaperService extends WallpaperService {

    private static final String TAG = "ParallaxLWP";

    public static final String PREFS_NAME = "parallax_wallpaper_prefs";
    public static final String KEY_ACTIVE_SCENE_ID = "active_scene_id";
    public static final String KEY_PENDING_SCENE_ID = "pending_scene_id";
    /** Prefix for per-scene "move whole wallpaper together" flag (legacy; the GL
     *  camera always moves the whole scene, so this only damps layer separation). */
    public static final String KEY_WHOLE_MOVE_PREFIX = "whole_move_";
    /** Personalization — engraved on the wallpaper (bottom: verse + "Jesus loves NAME"). */
    public static final String KEY_PERSONAL_NAME = "personal_name";
    public static final String KEY_VERSE_TEXT = "verse_text";
    public static final String KEY_VERSE_REFERENCE = "verse_reference";
    /** Glow / god-ray / dust colour, stored as an ARGB int. Default royal gold. */
    public static final String KEY_TINT_COLOR = "tint_color";
    public static final int DEFAULT_TINT = Color.rgb(255, 183, 77);

    /** Maximum camera orbit, in degrees. Small angles — big perceived depth. */
    private static final float MAX_YAW_DEG = 10.8f;
    private static final float MAX_PITCH_DEG = 8.1f;

    /** Camera spring — one spring for the whole rig (see class doc). */
    private static final float CAM_STIFFNESS = 46f;
    private static final float CAM_DAMPING = 12.5f;

    /** Tilt (radians) that maps to full orbit. ~26°, matching iOS depth effect. */
    private static final float TILT_FULL_RAD = (float) (Math.PI / 7.0);

    private static final long IDLE_DRIFT_TIMEOUT_MS = 700L;

    @Override
    public Engine onCreateEngine() {
        return new ParallaxEngine();
    }

    private class ParallaxEngine extends Engine implements SensorEventListener {

        // ── sensors ──
        private SensorManager sensorManager;
        private Sensor gameRotation;
        private Sensor accelerometer;
        private final float[] rotMatrix = new float[9];
        private final float[] orientation = new float[3];
        private float baselineRoll = 0f, baselinePitch = 0f;
        private boolean baselineInit = false;
        private volatile float targetX = 0f, targetY = 0f;
        private volatile long lastSensorMs = 0L;

        // ── render thread + EGL ──
        private HandlerThread renderThread;
        private Handler renderHandler;
        private EGLDisplay eglDisplay = EGL14.EGL_NO_DISPLAY;
        private EGLContext eglContext = EGL14.EGL_NO_CONTEXT;
        private EGLSurface eglSurface = EGL14.EGL_NO_SURFACE;
        private EGLConfig eglConfig;
        private volatile boolean glReady = false;
        private volatile boolean looping = false;

        private final ParallaxSceneRenderer renderer = new ParallaxSceneRenderer();

        private int surfaceW = 0, surfaceH = 0;
        private volatile boolean visible = false;

        private final Spring camSx = new Spring(CAM_STIFFNESS, CAM_DAMPING);
        private final Spring camSy = new Spring(CAM_STIFFNESS, CAM_DAMPING);

        private long startNs = 0L;
        private long lastFrameNs = 0L;
        private long frameIntervalMs = 16L;
        private float atmosphere = 1f;
        private final float[] tint = new float[]{ 1f, 0.72f, 0.30f };

        // ── scene state ──
        private String loadedSceneId = null;
        private boolean loading = false;
        private String loadingSceneId = null;
        private String engravedSignature = null;

        private SharedPreferences prefs;
        private SharedPreferences.OnSharedPreferenceChangeListener prefsListener;
        private final Handler mainHandler = new Handler(Looper.getMainLooper());

        // ─────────────────────── engine lifecycle ───────────────────────

        @Override
        public void onCreate(SurfaceHolder holder) {
            super.onCreate(holder);
            setTouchEventsEnabled(false);
            setOffsetNotificationsEnabled(false);

            sensorManager = (SensorManager) getSystemService(Context.SENSOR_SERVICE);
            if (sensorManager != null) {
                gameRotation = sensorManager.getDefaultSensor(Sensor.TYPE_GAME_ROTATION_VECTOR);
                if (gameRotation == null) {
                    gameRotation = sensorManager.getDefaultSensor(Sensor.TYPE_ROTATION_VECTOR);
                }
                if (gameRotation == null) {
                    accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER);
                }
            }

            ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
            boolean lowRam = am != null && am.isLowRamDevice();
            frameIntervalMs = lowRam ? 33L : 16L;
            atmosphere = 0f; // artificial rays/glow/dust removed — show the artwork as-is

            startNs = System.nanoTime();
            prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            readTint();

            prefsListener = (sp, key) -> {
                if (KEY_TINT_COLOR.equals(key)) { readTint(); return; }
                boolean sceneKey = KEY_ACTIVE_SCENE_ID.equals(key) || KEY_PENDING_SCENE_ID.equals(key);
                boolean textKey = KEY_PERSONAL_NAME.equals(key) || KEY_VERSE_TEXT.equals(key);
                if (!sceneKey && !textKey) return;
                if (textKey) engravedSignature = null;
                mainHandler.post(this::loadSceneIfNeeded);
            };
            prefs.registerOnSharedPreferenceChangeListener(prefsListener);

            renderThread = new HandlerThread("ParallaxGL");
            renderThread.start();
            renderHandler = new Handler(renderThread.getLooper());
        }

        @Override
        public void onSurfaceCreated(SurfaceHolder holder) {
            super.onSurfaceCreated(holder);
            if (!isPreview()) promotePendingToActive();
            post(() -> initEgl(holder));
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int width, int height) {
            super.onSurfaceChanged(holder, format, width, height);
            surfaceW = width;
            surfaceH = height;
            post(() -> { if (glReady) renderer.onResize(width, height); });
            loadSceneIfNeeded();
        }

        @Override
        public void onVisibilityChanged(boolean vis) {
            super.onVisibilityChanged(vis);
            visible = vis;
            if (vis) {
                registerSensors();
                lastSensorMs = System.currentTimeMillis();
                lastFrameNs = 0L;
                loadSceneIfNeeded();
                post(this::startLoop);
            } else {
                unregisterSensors();
                post(this::stopLoop);
            }
        }

        @Override
        public void onSurfaceDestroyed(SurfaceHolder holder) {
            super.onSurfaceDestroyed(holder);
            visible = false;
            unregisterSensors();
            post(() -> { stopLoop(); releaseEgl(); });
        }

        @Override
        public void onDestroy() {
            super.onDestroy();
            if (prefs != null && prefsListener != null) {
                prefs.unregisterOnSharedPreferenceChangeListener(prefsListener);
            }
            unregisterSensors();
            post(() -> { stopLoop(); releaseEgl(); });
            if (renderThread != null) {
                renderThread.quitSafely();
                renderThread = null;
            }
        }

        private void post(Runnable r) {
            Handler h = renderHandler;
            if (h != null) h.post(r);
        }

        private void registerSensors() {
            if (sensorManager == null) return;
            Sensor s = gameRotation != null ? gameRotation : accelerometer;
            if (s != null) sensorManager.registerListener(this, s, 5_000);
        }

        private void unregisterSensors() {
            if (sensorManager != null) sensorManager.unregisterListener(this);
        }

        private void readTint() {
            int c = DEFAULT_TINT;
            try { c = prefs.getInt(KEY_TINT_COLOR, DEFAULT_TINT); } catch (Exception ignored) {}
            tint[0] = Color.red(c) / 255f;
            tint[1] = Color.green(c) / 255f;
            tint[2] = Color.blue(c) / 255f;
        }

        // ─────────────────────── EGL ───────────────────────

        private void initEgl(SurfaceHolder holder) {
            try {
                eglDisplay = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY);
                int[] version = new int[2];
                EGL14.eglInitialize(eglDisplay, version, 0, version, 1);

                int[] attribs = {
                        EGL14.EGL_RED_SIZE, 8,
                        EGL14.EGL_GREEN_SIZE, 8,
                        EGL14.EGL_BLUE_SIZE, 8,
                        EGL14.EGL_ALPHA_SIZE, 8,
                        EGL14.EGL_DEPTH_SIZE, 0,
                        EGL14.EGL_STENCIL_SIZE, 0,
                        EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
                        EGL14.EGL_NONE
                };
                EGLConfig[] configs = new EGLConfig[1];
                int[] num = new int[1];
                if (!EGL14.eglChooseConfig(eglDisplay, attribs, 0, configs, 0, 1, num, 0) || num[0] == 0) {
                    Log.e(TAG, "eglChooseConfig failed");
                    return;
                }
                eglConfig = configs[0];

                int[] ctxAttribs = { EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE };
                eglContext = EGL14.eglCreateContext(eglDisplay, eglConfig, EGL14.EGL_NO_CONTEXT, ctxAttribs, 0);
                eglSurface = EGL14.eglCreateWindowSurface(eglDisplay, eglConfig, holder.getSurface(),
                        new int[]{ EGL14.EGL_NONE }, 0);
                if (!EGL14.eglMakeCurrent(eglDisplay, eglSurface, eglSurface, eglContext)) {
                    Log.e(TAG, "eglMakeCurrent failed");
                    return;
                }

                renderer.onGlCreated();
                if (surfaceW > 0) renderer.onResize(surfaceW, surfaceH);
                glReady = true;
                mainHandler.post(this::loadSceneIfNeeded);
                if (visible) startLoop();
            } catch (Throwable t) {
                Log.e(TAG, "initEgl failed", t);
                glReady = false;
            }
        }

        private void releaseEgl() {
            try {
                if (glReady) renderer.onGlDestroyed();
                if (eglDisplay != EGL14.EGL_NO_DISPLAY) {
                    EGL14.eglMakeCurrent(eglDisplay, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_SURFACE, EGL14.EGL_NO_CONTEXT);
                    if (eglSurface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(eglDisplay, eglSurface);
                    if (eglContext != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(eglDisplay, eglContext);
                    EGL14.eglTerminate(eglDisplay);
                }
            } catch (Throwable t) {
                Log.w(TAG, "releaseEgl failed", t);
            } finally {
                eglDisplay = EGL14.EGL_NO_DISPLAY;
                eglContext = EGL14.EGL_NO_CONTEXT;
                eglSurface = EGL14.EGL_NO_SURFACE;
                glReady = false;
                loadedSceneId = null;
                engravedSignature = null;
            }
        }

        // ─────────────────────── render loop ───────────────────────

        private final Runnable frameRunnable = new Runnable() {
            @Override public void run() {
                if (!looping) return;
                long t0 = System.nanoTime();
                drawFrame();
                long spentMs = (System.nanoTime() - t0) / 1_000_000L;
                long delay = Math.max(2L, frameIntervalMs - spentMs);
                Handler h = renderHandler;
                if (h != null && looping) h.postDelayed(this, delay);
            }
        };

        private void startLoop() {
            if (looping || !glReady) return;
            looping = true;
            lastFrameNs = 0L;
            Handler h = renderHandler;
            if (h != null) h.post(frameRunnable);
        }

        private void stopLoop() {
            looping = false;
            Handler h = renderHandler;
            if (h != null) h.removeCallbacks(frameRunnable);
        }

        private void drawFrame() {
            if (!glReady) return;
            try {
                long now = System.nanoTime();
                float dt;
                if (lastFrameNs == 0L) dt = frameIntervalMs / 1000f;
                else dt = Math.max(1e-4f, (now - lastFrameNs) / 1_000_000_000f);
                lastFrameNs = now;
                float time = (now - startNs) / 1_000_000_000f;

                float tx = targetX, ty = targetY;
                boolean idle = System.currentTimeMillis() - lastSensorMs > IDLE_DRIFT_TIMEOUT_MS;
                if (idle) {
                    // OEMs throttle sensors on the lock screen — never look frozen.
                    tx = (float) Math.sin(time * 0.26) * 0.55f;
                    ty = (float) Math.sin(time * 0.19 + 1.3) * 0.38f;
                } else {
                    // Living-camera drift layered on top of real tilt.
                    tx = clamp(tx + (float) Math.sin(time * 0.23) * 0.09f, -1.15f, 1.15f);
                    ty = clamp(ty + (float) Math.sin(time * 0.17 + 1.1) * 0.07f, -1.15f, 1.15f);
                }

                float yaw = camSx.step(tx, dt) * MAX_YAW_DEG;
                float pitch = camSy.step(ty, dt) * MAX_PITCH_DEG;
                // Slow FOV breathe — a subtle dolly that reads as "alive".
                float fov = ParallaxSceneRenderer.FOV_BASE
                        + (float) Math.sin(time * 0.21) * 0.85f;

                renderer.drawFrame(yaw, pitch, fov, time, tint, atmosphere);
                EGL14.eglSwapBuffers(eglDisplay, eglSurface);
            } catch (Throwable t) {
                Log.e(TAG, "drawFrame failed", t);
                looping = false;
            }
        }

        // ─────────────────────── sensors ───────────────────────

        @Override
        public void onSensorChanged(SensorEvent event) {
            int type = event.sensor.getType();
            if (type == Sensor.TYPE_GAME_ROTATION_VECTOR || type == Sensor.TYPE_ROTATION_VECTOR) {
                SensorManager.getRotationMatrixFromVector(rotMatrix, event.values);
                SensorManager.getOrientation(rotMatrix, orientation);
                float pitch = orientation[1];
                float roll = orientation[2];
                if (!baselineInit) {
                    baselineInit = true;
                    baselineRoll = roll;
                    baselinePitch = pitch;
                }
                // Auto-recentre: the neutral attitude creeps toward however the
                // user actually holds the phone, so motion is always centred.
                baselineRoll += (roll - baselineRoll) * 0.0016f;
                baselinePitch += (pitch - baselinePitch) * 0.0016f;

                float k = 1f / TILT_FULL_RAD;
                targetX = clamp(-(roll - baselineRoll) * k, -1f, 1f);
                targetY = clamp(-(pitch - baselinePitch) * k, -1f, 1f);
                lastSensorMs = System.currentTimeMillis();
            } else if (type == Sensor.TYPE_ACCELEROMETER) {
                float roll = event.values[0] / 9.8f;
                float pitch = event.values[1] / 9.8f;
                if (!baselineInit) { baselineInit = true; baselineRoll = roll; baselinePitch = pitch; }
                baselineRoll += (roll - baselineRoll) * 0.0016f;
                baselinePitch += (pitch - baselinePitch) * 0.0016f;
                targetX = clamp(-(roll - baselineRoll) * 2.2f, -1f, 1f);
                targetY = clamp(-(pitch - baselinePitch) * 2.2f, -1f, 1f);
                lastSensorMs = System.currentTimeMillis();
            }
        }

        @Override
        public void onAccuracyChanged(Sensor sensor, int accuracy) { /* noop */ }

        // ─────────────────────── scene loading ───────────────────────

        private String getActiveSceneId() {
            try { return prefs.getString(KEY_ACTIVE_SCENE_ID, null); } catch (Exception e) { return null; }
        }

        private String getPendingSceneId() {
            try { return prefs.getString(KEY_PENDING_SCENE_ID, null); } catch (Exception e) { return null; }
        }

        private String currentSceneId() {
            String id = isPreview() ? getPendingSceneId() : getActiveSceneId();
            return id != null ? id : getActiveSceneId();
        }

        private void promotePendingToActive() {
            try {
                String pending = prefs.getString(KEY_PENDING_SCENE_ID, null);
                if (pending == null) return;
                File dir = new File(getFilesDir(), "parallax/" + pending);
                if (new File(dir, "bg.jpg").exists() && new File(dir, "fg.png").exists()) {
                    prefs.edit()
                        .putString(KEY_ACTIVE_SCENE_ID, pending)
                        .remove(KEY_PENDING_SCENE_ID)
                        .apply();
                }
            } catch (Exception e) {
                Log.w(TAG, "promotePendingToActive failed", e);
            }
        }

        private void loadSceneIfNeeded() {
            if (!glReady || surfaceW <= 0 || surfaceH <= 0) return;
            final String sceneId = currentSceneId();
            if (sceneId == null) return;

            String sig = engravingSignature();
            boolean needScene = !sceneId.equals(loadedSceneId);
            boolean needText = !java.util.Objects.equals(sig, engravedSignature);
            if (!needScene && !needText) return;
            if (loading && sceneId.equals(loadingSceneId)) return;

            File dir = new File(getFilesDir(), "parallax/" + sceneId);
            final File bgFile = new File(dir, "bg.jpg");
            final File fgFile = new File(dir, "fg.png");
            if (needScene && (!bgFile.exists() || !fgFile.exists())) {
                Log.w(TAG, "Scene assets missing: " + sceneId);
                return;
            }

            loading = true;
            loadingSceneId = sceneId;
            final boolean loadScene = needScene;
            final int sw = surfaceW, sh = surfaceH;

            new Thread(() -> {
                Bitmap bg = null, fg = null, text = null, near = null;
                try {
                    if (loadScene) {
                        bg = decodeScaled(bgFile, sw, sh);
                        fg = decodeScaled(fgFile, sw, sh);
                        near = null;
                    }
                    text = buildEngraving(sw, sh);
                } catch (Throwable t) {
                    Log.e(TAG, "scene load failed", t);
                }
                final Bitmap fBg = bg, fFg = fg, fText = text, fNear = near;
                post(() -> {
                    try {
                        if (!glReady) return;
                        if (loadScene) {
                            if (fBg != null) renderer.setBackground(fBg);
                            if (fFg != null) renderer.setForeground(fFg);
                            
                        }
                        renderer.setEngraving(fText);
                    } finally {
                        if (fBg != null) fBg.recycle();
                        if (fFg != null) fFg.recycle();
                        if (fText != null) fText.recycle();
                        if (fNear != null) fNear.recycle();
                        mainHandler.post(() -> {
                            loading = false;
                            loadingSceneId = null;
                            if (loadScene && renderer.hasBackground()) loadedSceneId = sceneId;
                            engravedSignature = sig;
                        });
                    }
                });
            }, "ParallaxSceneLoader").start();
        }

        /**
         * Builds the near depth-layer straight out of the scene plate: the bottom
         * slice of the artwork, with its top edge feathered to transparent. Drawn
         * in FRONT of the orbit pivot it slides opposite to the far plate, which is
         * what gives the wallpaper real, readable depth without needing hand-cut
         * cutouts per scene (and it always matches the artwork exactly).
         */
        private Bitmap buildNearLayer(Bitmap bg) {
            if (bg == null) return null;
            try {
                int h = bg.getHeight();
                int sliceH = Math.max(8, (int) (h * 0.34f));
                Bitmap slice = Bitmap.createBitmap(bg, 0, h - sliceH, bg.getWidth(), sliceH);
                Bitmap out = slice.copy(Bitmap.Config.ARGB_8888, true);
                if (out != slice) slice.recycle();
                if (out == null) return null;
                Canvas c = new Canvas(out);
                Paint p = new Paint();
                p.setXfermode(new android.graphics.PorterDuffXfermode(android.graphics.PorterDuff.Mode.DST_IN));
                p.setShader(new android.graphics.LinearGradient(
                        0f, 0f, 0f, sliceH * 0.55f,
                        Color.TRANSPARENT, Color.BLACK,
                        android.graphics.Shader.TileMode.CLAMP));
                c.drawRect(0f, 0f, out.getWidth(), sliceH * 0.55f, p);
                return out;
            } catch (Throwable t) {
                Log.w(TAG, "buildNearLayer failed", t);
                return null;
            }
        }

        /** Decode at most ~2x the screen size — plenty of sharpness, half the memory. */
        private Bitmap decodeScaled(File file, int sw, int sh) {
            BitmapFactory.Options probe = new BitmapFactory.Options();
            probe.inJustDecodeBounds = true;
            BitmapFactory.decodeFile(file.getAbsolutePath(), probe);
            int maxDim = Math.max(sw, sh) * 2;
            int sample = 1;
            while (probe.outHeight / (sample * 2) >= maxDim && probe.outWidth / (sample * 2) >= 1) {
                sample *= 2;
            }
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
            opts.inSampleSize = sample;
            opts.inScaled = false;
            return BitmapFactory.decodeFile(file.getAbsolutePath(), opts);
        }

        // ─────────────────────── engraving → texture ───────────────────────

        private String engravingSignature() {
            String name = prefs.getString(KEY_PERSONAL_NAME, "");
            String verse = prefs.getString(KEY_VERSE_TEXT, "");
            return surfaceW + "|" + name + "|" + verse;
        }

        /** Renders the verse + "JESUS LOVES <name>" once into a bottom band
         *  bitmap which becomes a screen-space texture. Zero per-frame text cost. */
        private Bitmap buildEngraving(int sw, int sh) {
            try {
                String name = prefs.getString(KEY_PERSONAL_NAME, "");
                String verseText = prefs.getString(KEY_VERSE_TEXT, "");
                boolean hasName = name != null && !name.trim().isEmpty();
                boolean hasVerse = verseText != null && !verseText.trim().isEmpty();
                if (!hasName && !hasVerse) return null;

                int bandH = Math.max(1, (int) (sh * 0.30f));
                Bitmap bmp = Bitmap.createBitmap(sw, bandH, Bitmap.Config.ARGB_8888);
                Canvas canvas = new Canvas(bmp);

                float density = sw / 400f;

                Paint versePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
                versePaint.setColor(Color.rgb(252, 246, 232));
                versePaint.setTextAlign(Paint.Align.CENTER);
                versePaint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.ITALIC));
                versePaint.setShadowLayer(6f, 0, 2f, Color.argb(235, 0, 0, 0));
                versePaint.setTextSize(10.5f * density);

                Paint captionPaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
                captionPaint.setColor(Color.rgb(250, 205, 110));
                captionPaint.setTextAlign(Paint.Align.CENTER);
                captionPaint.setLetterSpacing(0.22f);
                captionPaint.setFakeBoldText(true);
                captionPaint.setShadowLayer(5f, 0, 2f, Color.argb(220, 0, 0, 0));
                captionPaint.setTextSize(8.5f * density);

                float nameSize = hasName
                        ? (name.length() > 14 ? 20f : name.length() > 9 ? 23f : 26f) : 0f;
                Paint namePaint = new Paint(Paint.ANTI_ALIAS_FLAG | Paint.SUBPIXEL_TEXT_FLAG);
                namePaint.setColor(Color.rgb(252, 246, 232));
                namePaint.setTextAlign(Paint.Align.CENTER);
                namePaint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD_ITALIC));
                namePaint.setShadowLayer(9f, 0, 3f, Color.argb(235, 0, 0, 0));
                namePaint.setTextSize(nameSize * density);

                // Coordinates are relative to the band (band bottom == screen bottom).
                float bottomY = bandH - sh * 0.065f;
                float nameBaselineY = bottomY;

                float nameCaptionY = nameBaselineY - nameSize * density * 1.04f;
                float verseBottomY = nameCaptionY - 8.5f * density
                        - (hasName && hasVerse ? 12f * density : 0f);

                if (hasVerse) {
                    java.util.List<String> lines = wrap("\u201C" + verseText.trim() + "\u201D",
                            versePaint, sw * 0.82f);
                    float lineH = versePaint.getTextSize() * 1.32f;
                    float start = verseBottomY - lineH * (lines.size() - 1);
                    for (int i = 0; i < lines.size(); i++) {
                        canvas.drawText(lines.get(i), sw / 2f, start + i * lineH, versePaint);
                    }
                }
                if (hasName) {
                    canvas.drawText("JESUS LOVES", sw / 2f, nameCaptionY, captionPaint);
                    canvas.drawText(name.trim(), sw / 2f, nameBaselineY, namePaint);
                }
                return bmp;
            } catch (Throwable t) {
                Log.w(TAG, "buildEngraving failed", t);
                return null;
            }
        }

        private java.util.List<String> wrap(String text, Paint paint, float maxWidth) {
            java.util.List<String> lines = new java.util.ArrayList<>();
            String[] words = text.split(" ");
            StringBuilder cur = new StringBuilder();
            for (String w : words) {
                String trial = cur.length() == 0 ? w : cur + " " + w;
                if (paint.measureText(trial) <= maxWidth) {
                    cur.setLength(0);
                    cur.append(trial);
                } else {
                    if (cur.length() > 0) lines.add(cur.toString());
                    cur.setLength(0);
                    cur.append(w);
                }
            }
            if (cur.length() > 0) lines.add(cur.toString());
            return lines;
        }

        private float clamp(float v, float lo, float hi) {
            return v < lo ? lo : (v > hi ? hi : v);
        }
    }

    /**
     * Critically-damped-ish spring integrator (semi-implicit Euler) — the same
     * model as the JS preview so the applied wallpaper feels identical to the
     * in-app preview the user tuned.
     */
    static class Spring {
        float pos = 0f, vel = 0f;
        final float stiffness, damping;

        Spring(float stiffness, float damping) {
            this.stiffness = stiffness;
            this.damping = damping;
        }

        float step(float target, float dt) {
            float h = Math.min(dt, 1f / 30f);
            float accel = (target - pos) * stiffness - vel * damping;
            vel += accel * h;
            pos += vel * h;
            return pos;
        }
    }
}
