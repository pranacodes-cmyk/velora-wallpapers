package com.velora.plugins;

import android.graphics.Bitmap;
import android.opengl.GLES20;
import android.opengl.GLUtils;
import android.opengl.Matrix;
import android.util.Log;

import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.nio.FloatBuffer;
import java.util.Random;

/**
 * GLES 2.0 renderer for the parallax live wallpaper.
 *
 * Instead of translating two flat bitmaps (the old Canvas approach), the scene
 * is built as a stack of textured quads placed at real Z depths and viewed
 * through a genuine perspective camera that ORBITS the scene as the phone
 * tilts. The projection matrix then produces the parallax for free — including
 * perspective skew and edge occlusion, which a 2D translate can never fake.
 *
 * Layer stack (far → near):
 *   z = -6.0  background plate (cover-cropped)
 *   z = -4.0  volumetric god-rays   (procedural, additive, slow rotation)
 *   z = -1.2  emissive glow bloom   (procedural, additive, breathing)
 *   z =  0.0  foreground subject    (alpha cutout)
 *   z = +1.6  dust motes            (GPU point sprites, additive)
 *   screen    vignette + grain + engraved verse/name
 *
 * Everything animated lives in shaders, so the CPU cost per frame is a handful
 * of uniform uploads — this runs at 60fps on entry-level hardware.
 */
class ParallaxSceneRenderer {

    private static final String TAG = "ParallaxGL";

    // ── scene depths (world units) ──
    static final float Z_BG    = -6.0f;
    static final float Z_RAYS  = -4.0f;
    static final float Z_GLOW  = -1.2f;
    static final float Z_FG    =  0.0f;
    static final float Z_DUST  =  1.6f;
    /** Near depth-layer (in FRONT of the orbit pivot) — this is what makes the
     *  parallax readable: layers ahead of the pivot slide OPPOSITE to the far
     *  plate, so the eye sees real depth separation instead of a flat pan. */
    static final float Z_NEAR  =  2.3f;

    /** Camera orbit radius. Cross sits at the origin, so the FG layer is
     *  CAM_RADIUS away and the BG is CAM_RADIUS - Z_BG away — the depth ratio
     *  is what creates the parallax strength. */
    static final float CAM_RADIUS = 6.0f;
    static final float FOV_BASE   = 46.0f;

    private static final int DUST_COUNT = 110;

    /** How much of the camera's lateral slide the BG plate follows (0..1).
     *  0 = plate is nailed to the world → FULL parallax slide (what looked good),
     *  1 = plate chases the camera → image looks locked to the screen (static).
     *  Keep this low; the leftover slide is covered by a FIXED slight zoom. */
    private static final float BG_FOLLOW = 0.35f;

    /** Worst-case tilt the camera can reach (must be >= MAX_YAW/MAX_PITCH in the
     *  wallpaper service). Overscan is computed once from THIS angle, not from the
     *  live angle, so the zoom is constant — a per-frame overscan breathes and is
     *  exactly what made the effect look weird. */
    private static final float WORST_TILT_DEG = 13.0f;

    // ── programs ──
    private int progTex, progRays, progGlow, progDust, progFlat;

    // textured
    private int tPos, tMvp, tUv, tTex, tColor;
    // rays
    private int rPos, rMvp, rTime, rTint, rIntensity;
    // glow
    private int gPos, gMvp, gTime, gTint, gIntensity;
    // dust
    private int dSeed, dMvp, dTime, dSize, dSpan, dTint;
    // flat (vignette / grain)
    private int fPos, fColor, fMode, fTime;

    private FloatBuffer quad;
    private FloatBuffer dustBuf;

    private int texBg = 0, texFg = 0, texText = 0, texNear = 0;
    private float bgAspect = 1f, fgAspect = 1f, textAspect = 1f, nearAspect = 1f;

    private final float[] proj = new float[16];
    private final float[] view = new float[16];
    private final float[] vp = new float[16];
    private final float[] model = new float[16];
    private final float[] mvp = new float[16];
    private final float[] identity = new float[16];

    private int viewW = 1, viewH = 1;

    // ─────────────────────────── lifecycle ───────────────────────────

    void onGlCreated() {
        quad = floats(new float[]{ -1f, -1f,  1f, -1f, -1f, 1f,  1f, 1f });

        float[] seeds = new float[DUST_COUNT * 3];
        Random rnd = new Random(7);
        for (int i = 0; i < DUST_COUNT; i++) {
            seeds[i * 3]     = rnd.nextFloat() * 2f - 1f; // x
            seeds[i * 3 + 1] = rnd.nextFloat();           // y phase
            seeds[i * 3 + 2] = rnd.nextFloat();           // size / speed seed
        }
        dustBuf = floats(seeds);

        progTex  = build(VS_TEX,  FS_TEX);
        progRays = build(VS_TEX,  FS_RAYS);
        progGlow = build(VS_TEX,  FS_GLOW);
        progDust = build(VS_DUST, FS_DUST);
        progFlat = build(VS_FLAT, FS_FLAT);

        tPos = GLES20.glGetAttribLocation(progTex, "aPos");
        tMvp = GLES20.glGetUniformLocation(progTex, "uMVP");
        tUv  = GLES20.glGetUniformLocation(progTex, "uUv");
        tTex = GLES20.glGetUniformLocation(progTex, "uTex");
        tColor = GLES20.glGetUniformLocation(progTex, "uColor");

        rPos = GLES20.glGetAttribLocation(progRays, "aPos");
        rMvp = GLES20.glGetUniformLocation(progRays, "uMVP");
        rTime = GLES20.glGetUniformLocation(progRays, "uTime");
        rTint = GLES20.glGetUniformLocation(progRays, "uTint");
        rIntensity = GLES20.glGetUniformLocation(progRays, "uIntensity");

        gPos = GLES20.glGetAttribLocation(progGlow, "aPos");
        gMvp = GLES20.glGetUniformLocation(progGlow, "uMVP");
        gTime = GLES20.glGetUniformLocation(progGlow, "uTime");
        gTint = GLES20.glGetUniformLocation(progGlow, "uTint");
        gIntensity = GLES20.glGetUniformLocation(progGlow, "uIntensity");

        dSeed = GLES20.glGetAttribLocation(progDust, "aSeed");
        dMvp = GLES20.glGetUniformLocation(progDust, "uMVP");
        dTime = GLES20.glGetUniformLocation(progDust, "uTime");
        dSize = GLES20.glGetUniformLocation(progDust, "uSize");
        dSpan = GLES20.glGetUniformLocation(progDust, "uSpan");
        dTint = GLES20.glGetUniformLocation(progDust, "uTint");

        fPos = GLES20.glGetAttribLocation(progFlat, "aPos");
        fColor = GLES20.glGetUniformLocation(progFlat, "uColor");
        fMode = GLES20.glGetUniformLocation(progFlat, "uMode");
        fTime = GLES20.glGetUniformLocation(progFlat, "uTime");

        Matrix.setIdentityM(identity, 0);

        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDisable(GLES20.GL_CULL_FACE);
        GLES20.glEnable(GLES20.GL_BLEND);
        GLES20.glClearColor(0f, 0f, 0f, 1f);
    }

    void onGlDestroyed() {
        deleteTextures();
        int[] progs = { progTex, progRays, progGlow, progDust, progFlat };
        for (int p : progs) if (p != 0) GLES20.glDeleteProgram(p);
        progTex = progRays = progGlow = progDust = progFlat = 0;
    }

    void onResize(int w, int h) {
        viewW = Math.max(1, w);
        viewH = Math.max(1, h);
        GLES20.glViewport(0, 0, viewW, viewH);
    }

    // ─────────────────────────── textures ───────────────────────────

    void setBackground(Bitmap bmp) {
        if (texBg != 0) { GLES20.glDeleteTextures(1, new int[]{ texBg }, 0); texBg = 0; }
        if (bmp == null) return;
        texBg = upload(bmp, false); // no mipmaps — avoids softening at ~1:1 scale
        bgAspect = bmp.getWidth() / (float) bmp.getHeight();
    }

    void setForeground(Bitmap bmp) {
        if (texFg != 0) { GLES20.glDeleteTextures(1, new int[]{ texFg }, 0); texFg = 0; }
        if (bmp == null) return;
        texFg = upload(bmp, false);
        fgAspect = bmp.getWidth() / (float) bmp.getHeight();
    }

    void setEngraving(Bitmap bmp) {
        if (texText != 0) { GLES20.glDeleteTextures(1, new int[]{ texText }, 0); texText = 0; }
        if (bmp == null) return;
        texText = upload(bmp, false);
        textAspect = bmp.getWidth() / (float) bmp.getHeight();
    }

    /** Bottom near-layer (alpha-feathered slice of the scene) drawn at Z_NEAR. */
    void setNearLayer(Bitmap bmp) {
        if (texNear != 0) { GLES20.glDeleteTextures(1, new int[]{ texNear }, 0); texNear = 0; }
        if (bmp == null) return;
        texNear = upload(bmp, false);
        nearAspect = bmp.getWidth() / (float) bmp.getHeight();
    }

    boolean hasBackground() { return texBg != 0; }

    private void deleteTextures() {
        int[] all = { texBg, texFg, texText, texNear };
        for (int t : all) if (t != 0) GLES20.glDeleteTextures(1, new int[]{ t }, 0);
        texBg = texFg = texText = texNear = 0;
    }

    private int upload(Bitmap bmp, boolean mip) {
        int[] id = new int[1];
        GLES20.glGenTextures(1, id, 0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, id[0]);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(GLES20.GL_TEXTURE_2D, GLES20.GL_TEXTURE_MIN_FILTER,
                mip ? GLES20.GL_LINEAR_MIPMAP_LINEAR : GLES20.GL_LINEAR);
        GLUtils.texImage2D(GLES20.GL_TEXTURE_2D, 0, bmp, 0);
        if (mip) GLES20.glGenerateMipmap(GLES20.GL_TEXTURE_2D);
        return id[0];
    }

    // ─────────────────────────── frame ───────────────────────────

    /**
     * @param yawDeg     camera orbit yaw   (deg, from tilt X)
     * @param pitchDeg   camera orbit pitch (deg, from tilt Y)
     * @param fovDeg     breathing field of view
     * @param time       seconds since start
     * @param tint       glow / ray / dust colour (rgb 0..1)
     * @param atmosphere 0..1 master intensity for rays + dust + glow
     */
    void drawFrame(float yawDeg, float pitchDeg, float fovDeg, float time,
                   float[] tint, float atmosphere) {

        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT);
        if (texBg == 0 && texFg == 0 && texNear == 0) return;

        float aspect = viewW / (float) viewH;
        Matrix.perspectiveM(proj, 0, fovDeg, aspect, 0.1f, 100f);

        double yaw = Math.toRadians(yawDeg);
        double pitch = Math.toRadians(pitchDeg);
        float ex = (float) (Math.sin(yaw) * Math.cos(pitch) * CAM_RADIUS);
        float ey = (float) (Math.sin(pitch) * CAM_RADIUS);
        float ez = (float) (Math.cos(yaw) * Math.cos(pitch) * CAM_RADIUS);
        Matrix.setLookAtM(view, 0, ex, ey, ez, 0f, 0f, 0f, 0f, 1f, 0f);
        Matrix.multiplyMM(vp, 0, proj, 0, view, 0);

        float tanHalf = (float) Math.tan(Math.toRadians(fovDeg) * 0.5);

        // ── background plate ──
        // The camera ORBITS, so the view axis slides across the BG plane by
        // Z_BG*tan(angle). The plate stays mostly put (low BG_FOLLOW) so that slide
        // reads as real parallax motion, and a FIXED slight zoom — sized once from
        // the worst-case tilt — guarantees no black edge on any aspect/FOV without
        // the zoom breathing frame to frame.
        if (texBg != 0) {
            float visH = coverHeight(Z_BG, tanHalf);
            float halfW = visH * 0.5f * aspect;
            float halfH = visH * 0.5f;
            float axisX = Z_BG * (float) Math.tan(yaw);
            float axisY = Z_BG * (float) Math.tan(pitch);
            float cx = axisX * BG_FOLLOW;
            float cy = axisY * BG_FOLLOW;
            float worst = Math.abs(Z_BG) * (float) Math.tan(Math.toRadians(WORST_TILT_DEG))
                    * (1f - BG_FOLLOW);
            float over = 1.02f + Math.max(worst / halfW, worst / halfH);
            float h = visH * over;
            float w = h * aspect;
            drawTextured(texBg, Z_BG, cx, cy, w, h, coverUv(bgAspect, w / h), 1f, 1f,
                    GLES20.GL_ONE_MINUS_SRC_ALPHA);
        }


        // (near depth layer removed — single-plate image parallax only)

        // ── god rays ──
        if (atmosphere > 0.01f) {
            float h = coverHeight(Z_RAYS, tanHalf) * 1.15f;
            drawProcedural(progRays, rPos, rMvp, rTime, rTint, rIntensity,
                    Z_RAYS, h * aspect, h, time, tint, 0.55f * atmosphere);
        }

        // ── emissive glow behind the subject (breathing) ──
        if (atmosphere > 0.01f) {
            float breathe = 0.82f + 0.18f * (float) Math.sin(time * 0.55);
            float h = coverHeight(Z_GLOW, tanHalf) * 0.95f;
            drawProcedural(progGlow, gPos, gMvp, gTime, gTint, gIntensity,
                    Z_GLOW, h * aspect, h, time, tint, 0.75f * atmosphere * breathe);
        }

        // ── foreground subject ──
        if (texFg != 0) {
            float visH = coverHeight(Z_FG, tanHalf);
            float h = visH * 0.98f;
            float w = h * fgAspect;
            float maxW = visH * aspect * 1.0f;
            if (w > maxW) { w = maxW; h = w / fgAspect; }
            drawTextured(texFg, Z_FG, w, h, new float[]{ 1f, 1f, 0f, 0f }, 1f, 1f,
                    GLES20.GL_ONE_MINUS_SRC_ALPHA);
        }

        // ── dust motes ──
        if (atmosphere > 0.01f) {
            float h = coverHeight(Z_DUST, tanHalf);
            drawDust(Z_DUST, h * aspect, h, time, tint, atmosphere);
        }

        // ── screen-space finishing: vignette, grain ──
        drawFlat(0, new float[]{ 0f, 0f, 0f, 0.18f }, time,
                GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);

        // ── engraved verse / name (screen space, whisper of parallax) ──
        if (texText != 0) {
            drawEngravingQuad(yawDeg, pitchDeg);
        }
    }

    /** Half-height of the frustum at a given layer depth. */
    private float coverHeight(float z, float tanHalf) {
        return tanHalf * (CAM_RADIUS - z) * 2f;
    }

    /** UV scale/offset that cover-crops a texture of `texAspect` into a quad of `quadAspect`. */
    private float[] coverUv(float texAspect, float quadAspect) {
        float su = 1f, sv = 1f;
        if (texAspect > quadAspect) {
            su = quadAspect / texAspect;         // texture wider → crop sides
        } else {
            sv = texAspect / quadAspect;         // texture taller → crop top/bottom
        }
        return new float[]{ su, sv, (1f - su) * 0.5f, (1f - sv) * 0.5f };
    }

    private void drawTextured(int tex, float z, float w, float h, float[] uv,
                              float alpha, float brightness, int dstFactor) {
        drawTextured(tex, z, 0f, 0f, w, h, uv, alpha, brightness, dstFactor);
    }

    private void drawTextured(int tex, float z, float ox, float oy, float w, float h, float[] uv,
                              float alpha, float brightness, int dstFactor) {
        GLES20.glUseProgram(progTex);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, dstFactor);

        Matrix.setIdentityM(model, 0);
        Matrix.translateM(model, 0, ox, oy, z);
        Matrix.scaleM(model, 0, w * 0.5f, h * 0.5f, 1f);
        Matrix.multiplyMM(mvp, 0, vp, 0, model, 0);

        GLES20.glUniformMatrix4fv(tMvp, 1, false, mvp, 0);
        GLES20.glUniform4f(tUv, uv[0], uv[1], uv[2], uv[3]);
        GLES20.glUniform4f(tColor, brightness, brightness, brightness, alpha);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, tex);
        GLES20.glUniform1i(tTex, 0);

        bindQuad(tPos);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(tPos);
    }

    private void drawProcedural(int prog, int aPos, int uMvp, int uTime, int uTint,
                                int uIntensity, float z, float w, float h,
                                float time, float[] tint, float intensity) {
        GLES20.glUseProgram(prog);
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE); // additive light

        Matrix.setIdentityM(model, 0);
        Matrix.translateM(model, 0, 0f, 0f, z);
        Matrix.scaleM(model, 0, w * 0.5f, h * 0.5f, 1f);
        Matrix.multiplyMM(mvp, 0, vp, 0, model, 0);

        GLES20.glUniformMatrix4fv(uMvp, 1, false, mvp, 0);
        GLES20.glUniform1f(uTime, time);
        GLES20.glUniform3f(uTint, tint[0], tint[1], tint[2]);
        GLES20.glUniform1f(uIntensity, intensity);

        bindQuad(aPos);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(aPos);
    }

    private void drawDust(float z, float w, float h, float time, float[] tint, float intensity) {
        GLES20.glUseProgram(progDust);
        GLES20.glBlendFunc(GLES20.GL_ONE, GLES20.GL_ONE);

        Matrix.setIdentityM(model, 0);
        Matrix.translateM(model, 0, 0f, 0f, z);
        Matrix.multiplyMM(mvp, 0, vp, 0, model, 0);

        GLES20.glUniformMatrix4fv(dMvp, 1, false, mvp, 0);
        GLES20.glUniform1f(dTime, time);
        GLES20.glUniform1f(dSize, Math.max(2.5f, viewW / 240f));
        GLES20.glUniform2f(dSpan, w * 0.5f, h * 0.5f);
        GLES20.glUniform4f(dTint, tint[0], tint[1], tint[2], 0.5f * intensity);

        dustBuf.position(0);
        GLES20.glEnableVertexAttribArray(dSeed);
        GLES20.glVertexAttribPointer(dSeed, 3, GLES20.GL_FLOAT, false, 12, dustBuf);
        GLES20.glDrawArrays(GLES20.GL_POINTS, 0, DUST_COUNT);
        GLES20.glDisableVertexAttribArray(dSeed);
    }

    private void drawFlat(int mode, float[] color, float time, int src, int dst) {
        GLES20.glUseProgram(progFlat);
        GLES20.glBlendFunc(src, dst);
        GLES20.glUniform4f(fColor, color[0], color[1], color[2], color[3]);
        GLES20.glUniform1i(fMode, mode);
        GLES20.glUniform1f(fTime, time);
        bindQuad(fPos);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(fPos);
    }

    /** Engraving is drawn in clip space so text stays crisp and readable,
     *  with only a hair of counter-parallax so it feels bonded to the glass. */
    private void drawEngravingQuad(float yawDeg, float pitchDeg) {
        GLES20.glUseProgram(progTex);
        GLES20.glBlendFunc(GLES20.GL_SRC_ALPHA, GLES20.GL_ONE_MINUS_SRC_ALPHA);

        float bandH = (viewW / textAspect) / viewH * 2f; // clip-space height of the band
        float cy = -1f + bandH * 0.5f;
        Matrix.setIdentityM(model, 0);
        Matrix.translateM(model, 0,
                yawDeg * 0.0016f,
                cy - pitchDeg * 0.0016f,
                0f);
        Matrix.scaleM(model, 0, 1f, bandH * 0.5f, 1f);

        GLES20.glUniformMatrix4fv(tMvp, 1, false, model, 0);
        GLES20.glUniform4f(tUv, 1f, 1f, 0f, 0f);
        GLES20.glUniform4f(tColor, 1f, 1f, 1f, 1f);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, texText);
        GLES20.glUniform1i(tTex, 0);

        bindQuad(tPos);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(tPos);
    }

    private void bindQuad(int attrib) {
        quad.position(0);
        GLES20.glEnableVertexAttribArray(attrib);
        GLES20.glVertexAttribPointer(attrib, 2, GLES20.GL_FLOAT, false, 8, quad);
    }

    // ─────────────────────────── gl helpers ───────────────────────────

    private static FloatBuffer floats(float[] data) {
        FloatBuffer fb = ByteBuffer.allocateDirect(data.length * 4)
                .order(ByteOrder.nativeOrder()).asFloatBuffer();
        fb.put(data).position(0);
        return fb;
    }

    private static int build(String vs, String fs) {
        int v = compile(GLES20.GL_VERTEX_SHADER, vs);
        int f = compile(GLES20.GL_FRAGMENT_SHADER, fs);
        int p = GLES20.glCreateProgram();
        GLES20.glAttachShader(p, v);
        GLES20.glAttachShader(p, f);
        GLES20.glLinkProgram(p);
        int[] ok = new int[1];
        GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0);
        if (ok[0] == 0) {
            Log.e(TAG, "link failed: " + GLES20.glGetProgramInfoLog(p));
            GLES20.glDeleteProgram(p);
            p = 0;
        }
        GLES20.glDeleteShader(v);
        GLES20.glDeleteShader(f);
        return p;
    }

    private static int compile(int type, String src) {
        int s = GLES20.glCreateShader(type);
        GLES20.glShaderSource(s, src);
        GLES20.glCompileShader(s);
        int[] ok = new int[1];
        GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0);
        if (ok[0] == 0) Log.e(TAG, "compile failed: " + GLES20.glGetShaderInfoLog(s));
        return s;
    }

    // ─────────────────────────── shaders ───────────────────────────

    private static final String VS_TEX =
        "attribute vec2 aPos;\n" +
        "uniform mat4 uMVP;\n" +
        "uniform vec4 uUv;\n" +
        "varying vec2 vUv;\n" +
        "varying vec2 vP;\n" +
        "void main(){\n" +
        "  vP = aPos;\n" +
        "  vec2 t = aPos * 0.5 + 0.5;\n" +
        "  t.y = 1.0 - t.y;\n" +
        "  vUv = t * uUv.xy + uUv.zw;\n" +
        "  gl_Position = uMVP * vec4(aPos, 0.0, 1.0);\n" +
        "}";

    private static final String FS_TEX =
        "precision mediump float;\n" +
        "uniform sampler2D uTex;\n" +
        "uniform vec4 uColor;\n" +
        "varying vec2 vUv;\n" +
        "varying vec2 vP;\n" +
        "void main(){\n" +
        "  vec4 c = texture2D(uTex, vUv);\n" +
        "  gl_FragColor = vec4(c.rgb * uColor.rgb, c.a * uColor.a);\n" +
        "}";

    /** Volumetric shafts of light radiating from just above centre, rotating
     *  imperceptibly slowly — the single biggest "expensive render" cue. */
    private static final String FS_RAYS =
        "precision mediump float;\n" +
        "uniform float uTime;\n" +
        "uniform vec3 uTint;\n" +
        "uniform float uIntensity;\n" +
        "varying vec2 vP;\n" +
        "void main(){\n" +
        "  vec2 p = vec2(vP.x, vP.y - 0.18);\n" +
        "  float r = length(p);\n" +
        "  float a = atan(p.y, p.x);\n" +
        "  float rot = uTime * 0.035;\n" +
        "  float s1 = pow(max(0.0, sin(a * 7.0 + rot)), 8.0);\n" +
        "  float s2 = pow(max(0.0, sin(a * 11.0 - rot * 1.6 + 1.7)), 12.0);\n" +
        "  float s3 = pow(max(0.0, sin(a * 4.0 + rot * 0.6 + 3.1)), 5.0);\n" +
        "  float shafts = s1 * 0.55 + s2 * 0.3 + s3 * 0.4;\n" +
        "  float falloff = exp(-r * 1.35) * smoothstep(0.02, 0.35, r);\n" +
        "  float core = exp(-r * r * 7.0) * 0.5;\n" +
        "  float v = (shafts * falloff + core) * uIntensity;\n" +
        "  gl_FragColor = vec4(uTint * v, v);\n" +
        "}";

    /** Soft emissive bloom sitting behind the subject. */
    private static final String FS_GLOW =
        "precision mediump float;\n" +
        "uniform float uTime;\n" +
        "uniform vec3 uTint;\n" +
        "uniform float uIntensity;\n" +
        "varying vec2 vP;\n" +
        "void main(){\n" +
        "  vec2 p = vec2(vP.x * 1.25, (vP.y - 0.12) * 0.9);\n" +
        "  float r = length(p);\n" +
        "  float halo = exp(-r * r * 2.6);\n" +
        "  float core = exp(-r * r * 16.0) * 0.6;\n" +
        "  float v = (halo * 0.75 + core) * uIntensity;\n" +
        "  gl_FragColor = vec4(uTint * v, v);\n" +
        "}";

    private static final String VS_DUST =
        "attribute vec3 aSeed;\n" +
        "uniform mat4 uMVP;\n" +
        "uniform float uTime;\n" +
        "uniform float uSize;\n" +
        "uniform vec2 uSpan;\n" +
        "varying float vFade;\n" +
        "void main(){\n" +
        "  float speed = 0.012 + aSeed.z * 0.022;\n" +
        "  float y = fract(aSeed.y + uTime * speed) * 2.0 - 1.0;\n" +
        "  float x = aSeed.x + sin(uTime * (0.18 + aSeed.z * 0.25) + aSeed.z * 6.2831) * 0.07;\n" +
        "  vFade = 0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 0.8 + aSeed.z * 12.0));\n" +
        "  gl_Position = uMVP * vec4(x * uSpan.x, y * uSpan.y, 0.0, 1.0);\n" +
        "  gl_PointSize = uSize * (0.45 + aSeed.z * 1.15);\n" +
        "}";

    private static final String FS_DUST =
        "precision mediump float;\n" +
        "uniform vec4 uTint;\n" +
        "varying float vFade;\n" +
        "void main(){\n" +
        "  vec2 c = gl_PointCoord - vec2(0.5);\n" +
        "  float d = length(c);\n" +
        "  float a = smoothstep(0.5, 0.0, d);\n" +
        "  a = a * a * uTint.a * vFade;\n" +
        "  gl_FragColor = vec4(uTint.rgb * a, a);\n" +
        "}";

    private static final String VS_FLAT =
        "attribute vec2 aPos;\n" +
        "varying vec2 vP;\n" +
        "void main(){ vP = aPos; gl_Position = vec4(aPos, 0.0, 1.0); }";

    /** mode 0 = vignette (multiplied darkness at edges), mode 1 = film grain. */
    private static final String FS_FLAT =
        "precision mediump float;\n" +
        "uniform vec4 uColor;\n" +
        "uniform int uMode;\n" +
        "uniform float uTime;\n" +
        "varying vec2 vP;\n" +
        "float hash(vec2 p){ return fract(sin(dot(p, vec2(41.31, 289.7))) * 43758.5453); }\n" +
        "void main(){\n" +
        "  if (uMode == 0) {\n" +
        "    float r = length(vec2(vP.x * 0.82, vP.y * 0.62));\n" +
        "    float v = smoothstep(0.55, 1.35, r) * uColor.a;\n" +
        "    gl_FragColor = vec4(0.0, 0.0, 0.0, v);\n" +
        "  } else {\n" +
        "    float g = hash(vP * 512.0 + fract(uTime) * 37.0) - 0.5;\n" +
        "    float a = max(0.0, g) * uColor.a;\n" +
        "    gl_FragColor = vec4(uColor.rgb * a, a);\n" +
        "  }\n" +
        "}";
}
