package com.velora.plugins;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.res.AssetManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.LinearGradient;
import android.graphics.Paint;
import android.graphics.PorterDuff;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Shader;
import android.graphics.Typeface;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.service.wallpaper.WallpaperService;
import android.text.TextPaint;
import android.util.Log;
import android.view.SurfaceHolder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.List;

/**
 * DailyVerseWallpaperService
 * --------------------------
 * Renders a Bible verse over a curated background to the user's home/lock
 * wallpaper. Auto-refreshes at midnight using AlarmManager so the wallpaper
 * shows a NEW verse every single day with zero user interaction.
 *
 * Pro users: today's verse is shown immediately every midnight.
 * Free users: keeps showing the verse from the day they last unlocked,
 *             plus a gold "✦ NEW VERSE TODAY · Open Prayly to reveal"
 *             badge baked onto the lockscreen — a passive, polite nudge
 *             that lives where they already look 80+ times a day.
 *
 * Design:
 *   - 365+ verses bundled in assets/daily_verse/verses.json
 *   - 10 backgrounds loaded from R2 and cached by the OS
 *   - Verse + background picked deterministically via day-of-year
 *   - Canvas redraw scheduled for next midnight via ACTION_REDRAW broadcast
 *   - Battery: 0% — only redraws once per day
 */
public class DailyVerseWallpaperService extends WallpaperService {

    private static final String TAG = "DailyVerseWP";
    public static final String ACTION_REDRAW = "com.velora.plugins.ACTION_DAILY_VERSE_REDRAW";
    private static final String CACHE_DIR = "daily-verse";
    public static final String PREFS = "daily_verse_prefs";
    public static final String KEY_UNLOCKED_DAY = "unlocked_day";
    public static final String KEY_UNLOCKED_YEAR = "unlocked_year";
    public static final String KEY_IS_PREMIUM = "is_premium";
    public static final String KEY_PACK_VERSES = "pack_verses_json";
    public static final String KEY_PACK_MOOD = "pack_mood";
    // When a Pro user with an active mood pack loses premium (trial expired,
    // cancelled, refund), we freeze the lockscreen on the verse they were on
    // that day and overlay a "Renew Pro" pill instead of letting the 30-verse
    // rotation keep flowing for free. Cleared the moment Pro reactivates.
    public static final String KEY_PACK_FROZEN_DAY = "pack_frozen_day";
    public static final String KEY_PACK_FROZEN_YEAR = "pack_frozen_year";

    @Override
    public Engine onCreateEngine() {
        return new VerseEngine();
    }

    private class VerseEngine extends Engine {
        private final Handler handler = new Handler(Looper.getMainLooper());
        private final HandlerThread renderThread = new HandlerThread("DailyVerseRenderer");
        private final Runnable drawRunnable = this::drawNow;
        private final Object drawLock = new Object();
        private Handler renderHandler;
        private volatile boolean destroyed = false;
        private final BroadcastReceiver midnightReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                Log.d(TAG, "Midnight tick → redraw verse");
                requestDraw();
                scheduleNextMidnight();
            }
        };

        private List<Verse> verses;
        private int width = 1080;
        private int height = 1920;
        private boolean visible = true;
        private Bitmap cachedBackground = null;
        private int cachedBackgroundDay = -1;
        private boolean backgroundLoading = false;

        @Override
        public void onCreate(SurfaceHolder surfaceHolder) {
            super.onCreate(surfaceHolder);
            renderThread.start();
            renderHandler = new Handler(renderThread.getLooper());
            loadVerses();
            IntentFilter filter = new IntentFilter(ACTION_REDRAW);
            // Also redraw on date/time change (timezone, manual clock change)
            filter.addAction(Intent.ACTION_DATE_CHANGED);
            filter.addAction(Intent.ACTION_TIME_CHANGED);
            filter.addAction(Intent.ACTION_TIMEZONE_CHANGED);
            try {
                if (android.os.Build.VERSION.SDK_INT >= 33) {
                    registerReceiver(midnightReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
                } else {
                    registerReceiver(midnightReceiver, filter);
                }
            } catch (Exception e) {
                Log.w(TAG, "Receiver register failed", e);
            }
            scheduleNextMidnight();
        }

        @Override
        public void onSurfaceChanged(SurfaceHolder holder, int format, int w, int h) {
            super.onSurfaceChanged(holder, format, w, h);
            this.width = w;
            this.height = h;
            requestDraw();
        }

        @Override
        public void onVisibilityChanged(boolean v) {
            this.visible = v;
            if (v) requestDraw();
        }

        @Override
        public void onDestroy() {
            destroyed = true;
            try { unregisterReceiver(midnightReceiver); } catch (Exception ignored) {}
            handler.removeCallbacksAndMessages(null);
            if (renderHandler != null) renderHandler.removeCallbacksAndMessages(null);
            renderThread.quitSafely();
            synchronized (drawLock) {
                synchronized (this) {
                    if (cachedBackground != null) cachedBackground.recycle();
                    cachedBackground = null;
                    cachedBackgroundDay = -1;
                    backgroundLoading = false;
                }
            }
            super.onDestroy();
        }

        private void requestDraw() {
            if (destroyed) return;
            Handler rh = renderHandler;
            if (rh == null) return;
            rh.removeCallbacks(drawRunnable);
            rh.post(drawRunnable);
        }

        private void ensureBackgroundLoaded() {
            final int day = displayDay();
            synchronized (this) {
                if (cachedBackgroundDay == day && cachedBackground != null) return;
                if (backgroundLoading) return;
                backgroundLoading = true;
            }

            // Local file decode is fast (<50ms) but Android wants no work on
            // the wallpaper thread, so we still hop to a worker.
            new Thread(() -> {
                Bitmap loaded = loadBackgroundForDay(day);
                synchronized (drawLock) {
                    synchronized (VerseEngine.this) {
                        if (loaded != null) {
                            // Only replace + recycle if we actually got a new bitmap.
                            // CRITICAL: if loaded==null we KEEP yesterday's bitmap
                            // so the wallpaper never goes black on a missing file.
                            if (cachedBackground != null && cachedBackground != loaded) {
                                cachedBackground.recycle();
                            }
                            cachedBackground = loaded;
                            cachedBackgroundDay = day;
                        }
                        backgroundLoading = false;
                    }
                }
                handler.post(() -> {
                    if (visible) requestDraw();
                });
            }, "DailyVerseBgLoader").start();
        }

        private void scheduleNextMidnight() {
            Calendar c = Calendar.getInstance();
            c.add(Calendar.DAY_OF_YEAR, 1);
            c.set(Calendar.HOUR_OF_DAY, 0);
            c.set(Calendar.MINUTE, 0);
            c.set(Calendar.SECOND, 5); // 5s after midnight to avoid clock skew
            c.set(Calendar.MILLISECOND, 0);

            Intent intent = new Intent(ACTION_REDRAW).setPackage(getPackageName());
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (android.os.Build.VERSION.SDK_INT >= 23) flags |= PendingIntent.FLAG_IMMUTABLE;
            PendingIntent pi = PendingIntent.getBroadcast(
                DailyVerseWallpaperService.this, 7421, intent, flags
            );

            AlarmManager am = (AlarmManager) getSystemService(Context.ALARM_SERVICE);
            if (am != null) {
                am.cancel(pi);
                // setAndAllowWhileIdle survives Doze; exact enough for "midnight"
                am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, c.getTimeInMillis(), pi);
                Log.d(TAG, "Next redraw scheduled at " + c.getTime());
            }
        }

        private void loadVerses() {
            verses = new ArrayList<>();
            AssetManager am = getAssets();
            // Flutter's displayed Daily Verse is the source of truth. Older
            // builds bundled a separate 354-row native file while Flutter had
            // 366 rows, so matching indices still rendered different verses.
            try {
                InputStream verseStream;
                try {
                    verseStream = am.open("flutter_assets/assets/data/verses.json");
                } catch (IOException ignored) {
                    verseStream = am.open("daily_verse/verses.json");
                }
                try (InputStream is = verseStream) {
                byte[] buf = new byte[is.available()];
                int read = is.read(buf);
                if (read <= 0) throw new IOException("Empty verses.json");
                JSONArray arr = new JSONArray(new String(buf, "UTF-8"));
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject o = arr.getJSONObject(i);
                    verses.add(new Verse(o.getString("text"), o.getString("reference")));
                }
                }
                Log.d(TAG, "Loaded " + verses.size() + " verses");
            } catch (Exception e) {
                Log.e(TAG, "Failed to load verses.json", e);
                verses.add(new Verse(
                    "The Lord is my shepherd; I shall not want.", "Psalm 23:1"
                ));
            }
        }

        private int dayOfYear() {
            return Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
        }

        private int yearNow() {
            return Calendar.getInstance().get(Calendar.YEAR);
        }

        /**
         * Day-of-year that drives which verse + background is rendered.
         * Pro users → always today. Free users who already unlocked today → today.
         * Otherwise → the last day they unlocked (so they keep seeing the verse
         * they applied), falling back to yesterday on first install.
         */
        private int displayDay() {
            SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            boolean premium = sp.getBoolean(KEY_IS_PREMIUM, false);
            int today = dayOfYear();
            int year = yearNow();
            int unlockedDay = sp.getInt(KEY_UNLOCKED_DAY, -1);
            int unlockedYear = sp.getInt(KEY_UNLOCKED_YEAR, -1);
            if (premium) return today;
            if (unlockedDay == today && unlockedYear == year) return today;
            if (unlockedDay > 0 && unlockedYear == year) return unlockedDay;
            // First install or year rolled over: render yesterday's verse so the
            // "new verse today" badge has something different to compare against.
            return Math.max(1, today - 1);
        }

        private boolean isStaleForFree() {
            SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            boolean premium = sp.getBoolean(KEY_IS_PREMIUM, false);
            if (premium) return false;
            int today = dayOfYear();
            int year = yearNow();
            int unlockedDay = sp.getInt(KEY_UNLOCKED_DAY, -1);
            int unlockedYear = sp.getInt(KEY_UNLOCKED_YEAR, -1);
            return !(unlockedDay == today && unlockedYear == year);
        }

        private Verse verseForDay(int day) {
            // Mood-pack override: if the user activated a pack, cycle through
            // its verses (typically 30) by day instead of the bundled 365-day
            // rotation. Read fresh each time so activation takes effect on
            // the very next redraw — no service restart needed.
            try {
                SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
                String json = sp.getString(KEY_PACK_VERSES, null);
                if (json != null && json.length() > 2) {
                    JSONArray arr = new JSONArray(json);
                    if (arr.length() > 0) {
                        // If Pro lapsed while a pack was active, freeze on the
                        // verse the user was seeing that day so we don't keep
                        // serving fresh pack content for free.
                        boolean premium = sp.getBoolean(KEY_IS_PREMIUM, false);
                        int frozenDay = sp.getInt(KEY_PACK_FROZEN_DAY, -1);
                        int idx = (!premium && frozenDay > 0)
                            ? (frozenDay % arr.length())
                            : (day % arr.length());
                        JSONObject o = arr.getJSONObject(idx);
                        return new Verse(o.optString("text", ""), o.optString("reference", ""));
                    }
                }
            } catch (Exception ignored) {}
            if (verses == null || verses.isEmpty()) return new Verse("", "");
            // DAY_OF_YEAR is 1-based while the bundled list is 0-based.
            // Flutter's ContentData uses (dayOfYear - 1), so native must do the
            // same or every applied wallpaper shows a different day's verse.
            return verses.get(Math.floorMod(day - 1, verses.size()));
        }

        private boolean isPackFrozen() {
            SharedPreferences sp = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            if (sp.getBoolean(KEY_IS_PREMIUM, false)) return false;
            String json = sp.getString(KEY_PACK_VERSES, null);
            if (json == null || json.length() < 3) return false;
            return sp.getInt(KEY_PACK_FROZEN_DAY, -1) > 0;
        }

        private Bitmap loadBackgroundForDay(int day) {
            // Must mirror the JS preview in src/hooks/useVerseWallpaper.ts so
            // what users see in the in-app mockup is exactly what gets applied.
            // JS: BG_IMAGES[dayOfYear % 20] (Jan 1 day=1 → bg-02).
            // Java Calendar.DAY_OF_YEAR is also 1-indexed, so (day % 20) + 1
            // produces the IDENTICAL index.
            int idx = (day % 20) + 1;
            File dir = new File(getFilesDir(), CACHE_DIR);
            if (!dir.exists()) dir.mkdirs();

            // 1) Try the canonical file for today.
            File todayFile = new File(dir, String.format("bg-%02d.jpg", idx));
            Bitmap bmp = decodeBgFile(todayFile);
            if (bmp != null) return bmp;

            // 2) Today's file is missing — most common after a midnight rollover
            //    when only a single previous-day bg was cached (free users).
            //    Attempt a synchronous download FIRST (we're already on a worker
            //    thread). This is critical: without this step, the service would
            //    happily render YESTERDAY'S background under TODAY'S verse, which
            //    is exactly what users were reporting.
            if (downloadBg(idx, todayFile) > 0) {
                Bitmap fresh = decodeBgFile(todayFile);
                if (fresh != null) return fresh;
            }

            // 3) Network failed → fall back to ANY other bg-XX.jpg on disk so
            //    the wallpaper never goes black. Kick off a self-heal so the
            //    next redraw shows the correct one.
            for (int i = 1; i <= 20; i++) {
                if (i == idx) continue;
                Bitmap b = decodeBgFile(new File(dir, String.format("bg-%02d.jpg", i)));
                if (b != null) {
                    Log.w(TAG, "bg-" + idx + " missing & download failed, using bg-" + i + " as fallback");
                    repairMissingBg(dir, idx);
                    return b;
                }
            }

            Log.w(TAG, "No bg available on disk and download failed for idx=" + idx);
            return null;
        }

        private Bitmap decodeBgFile(File f) {
            if (f == null || !f.exists() || f.length() < 1024) return null;
            try {
                BitmapFactory.Options opts = new BitmapFactory.Options();
                opts.inPreferredConfig = Bitmap.Config.ARGB_8888;
                return BitmapFactory.decodeFile(f.getAbsolutePath(), opts);
            } catch (Exception e) {
                Log.w(TAG, "Decode failed: " + f.getAbsolutePath(), e);
                return null;
            }
        }

        private void repairMissingBg(File dir, int idx) {
            new Thread(() -> {
                File out = new File(dir, String.format("bg-%02d.jpg", idx));
                long n = downloadBg(idx, out);
                if (n > 0) {
                    Log.d(TAG, "Self-healed bg-" + idx + " (" + n + " bytes)");
                    if (visible) requestDraw();
                }
            }, "DailyVerseBgRepair").start();
        }

        private long downloadBg(int idx, File out) {
            final String R2 = "https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev/daily-verse/backgrounds";
            String url = R2 + "/" + String.format("bg-%02d.jpg", idx);
            HttpURLConnection conn = null;
            try {
                conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(8000);
                conn.connect();
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) return -1;
                File tmp = new File(out.getParentFile(), out.getName() + ".part");
                try (InputStream in = conn.getInputStream();
                     OutputStream os = new FileOutputStream(tmp)) {
                    byte[] buf = new byte[16 * 1024];
                    int n; long bytes = 0;
                    while ((n = in.read(buf)) > 0) { os.write(buf, 0, n); bytes += n; }
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

        private void drawNow() {
            if (destroyed) return;
            synchronized (drawLock) {
                if (destroyed) return;
                SurfaceHolder holder = getSurfaceHolder();
                if (holder == null) return;
                ensureBackgroundLoaded();
                Canvas canvas = null;
                try {
                    canvas = holder.lockCanvas();
                    if (canvas == null) return;

                int W = width;
                int H = height;
                int targetDay = displayDay();
                drawFallbackBackground(canvas, W, H);

                // === Background — center-crop ===
                Bitmap bg;
                synchronized (this) {
                    bg = cachedBackgroundDay == targetDay ? cachedBackground : null;
                }
                if (bg != null) {
                    float scale = Math.max((float) W / bg.getWidth(), (float) H / bg.getHeight());
                    float bw = bg.getWidth() * scale;
                    float bh = bg.getHeight() * scale;
                    RectF dst = new RectF((W - bw) / 2, (H - bh) / 2, (W + bw) / 2, (H + bh) / 2);
                    canvas.drawBitmap(bg, null, dst, null);
                }

                // === Dark gradient overlay ===
                Paint gradPaint = new Paint();
                gradPaint.setShader(new LinearGradient(0, 0, 0, H,
                    new int[]{
                        Color.argb(38, 0, 0, 0),
                        Color.argb(64, 0, 0, 0),
                        Color.argb(115, 0, 0, 0),
                        Color.argb(166, 0, 0, 0),
                        Color.argb(217, 0, 0, 0)
                    },
                    new float[]{0f, 0.35f, 0.55f, 0.75f, 1f},
                    Shader.TileMode.CLAMP));
                canvas.drawRect(0, 0, W, H, gradPaint);

                // === Layout math — mirrors the static canvas (1170x2532) ===
                // Static reference: blockCenterY = H*0.42, crossY = blockCenterY - H*0.087
                final int GOLD = Color.rgb(245, 204, 110);
                final int GOLD_DEEP = Color.rgb(212, 168, 69);

                float blockCenterY = H * 0.42f;
                float crossY = blockCenterY - H * 0.087f;

                // === Top cross (verse mark) ===
                Paint topCross = new Paint(Paint.ANTI_ALIAS_FLAG);
                topCross.setColor(GOLD);
                topCross.setStyle(Paint.Style.STROKE);
                topCross.setStrokeCap(Paint.Cap.ROUND);
                topCross.setStrokeWidth(W * 0.006f);
                topCross.setShadowLayer(W * 0.008f, 0, 0, Color.argb(242, 245, 204, 110));
                float topCrossH = W * 0.0615f;       // 72 / 1170
                float topCrossArm = W * 0.0239f;     // 28 / 1170
                float topCrossArmY = crossY - topCrossH / 2f + W * 0.0188f; // +22/1170
                canvas.drawLine(W / 2f, crossY - topCrossH / 2f, W / 2f, crossY + topCrossH / 2f, topCross);
                canvas.drawLine(W / 2f - topCrossArm, topCrossArmY, W / 2f + topCrossArm, topCrossArmY, topCross);

                // === Date row ===
                TextPaint datePaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                datePaint.setColor(GOLD);
                datePaint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
                datePaint.setTextSize(W * 0.0205f);  // 24 / 1170
                datePaint.setTextAlign(Paint.Align.CENTER);
                datePaint.setLetterSpacing(0.33f);   // 8/24 em
                datePaint.setShadowLayer(W * 0.007f, 0, 0, Color.argb(217, 0, 0, 0));
                Calendar cal = Calendar.getInstance();
                String[] months = {"JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"};
                String dayLabel = months[cal.get(Calendar.MONTH)] + " " + cal.get(Calendar.DAY_OF_MONTH) + " · " + cal.get(Calendar.YEAR);
                float dateY = crossY + H * 0.0308f;  // crossY + 78/2532
                canvas.drawText(dayLabel, W / 2f, dateY, datePaint);

                // Hairline accents flanking the date
                float dateTextW = datePaint.measureText(dayLabel);
                Paint hair = new Paint(Paint.ANTI_ALIAS_FLAG);
                hair.setColor(Color.argb(217, 232, 188, 89));
                hair.setStrokeWidth(Math.max(1f, W * 0.0009f));
                float halfText = dateTextW / 2f + W * 0.0205f;
                float lineLen = W * 0.0513f;
                float hairY = dateY - W * 0.0068f;
                canvas.drawLine(W / 2f - halfText - lineLen, hairY, W / 2f - halfText, hairY, hair);
                canvas.drawLine(W / 2f + halfText, hairY, W / 2f + halfText + lineLen, hairY, hair);

                // === Verse text ===
                Verse v = verseForDay(targetDay);
                String quote = "\u201C" + v.text + "\u201D";

                TextPaint versePaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                versePaint.setColor(Color.WHITE);
                versePaint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.ITALIC));
                versePaint.setTextSize(W * 0.0547f); // 64 / 1170
                versePaint.setTextAlign(Paint.Align.CENTER);
                versePaint.setShadowLayer(W * 0.011f, 0, W * 0.003f, Color.argb(230, 0, 0, 0));

                float maxTextWidth = W - W * 0.12f;  // 140/1170 each side
                List<String> lines = wrap(quote, versePaint, maxTextWidth);
                float lineHeight = versePaint.getTextSize() * 1.45f;
                float textStartY = dateY + H * 0.0395f; // +100/2532
                for (int i = 0; i < lines.size(); i++) {
                    canvas.drawText(lines.get(i), W / 2f, textStartY + i * lineHeight, versePaint);
                }

                // === Reference ===
                TextPaint refPaint = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                refPaint.setColor(GOLD);
                refPaint.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
                refPaint.setTextSize(W * 0.0239f); // 28 / 1170
                refPaint.setTextAlign(Paint.Align.CENTER);
                refPaint.setLetterSpacing(0.178f); // 5/28 em
                refPaint.setShadowLayer(W * 0.006f, 0, 0, Color.argb(166, 0, 0, 0));
                String ref = "— " + v.reference.toUpperCase();
                canvas.drawText(ref, W / 2f, textStartY + lines.size() * lineHeight + W * 0.0376f, refPaint);

                // === Bottom branding — matches static canvas exactly ===
                float brandY = H - H * 0.0711f; // H - 180/2532

                // Gold divider
                Paint div = new Paint(Paint.ANTI_ALIAS_FLAG);
                LinearGradient divGrad = new LinearGradient(
                    W / 2f - W * 0.12f, 0, W / 2f + W * 0.12f, 0,
                    new int[]{ Color.argb(0, 245, 204, 110), Color.argb(217, 245, 204, 110), Color.argb(0, 245, 204, 110) },
                    new float[]{0f, 0.5f, 1f}, Shader.TileMode.CLAMP);
                div.setShader(divGrad);
                float divY = brandY - H * 0.0182f; // -46/2532
                canvas.drawRect(W / 2f - W * 0.12f, divY, W / 2f + W * 0.12f, divY + Math.max(1f, W * 0.0013f), div);

                // Small bottom cross glyph
                Paint botCross = new Paint(Paint.ANTI_ALIAS_FLAG);
                botCross.setColor(GOLD);
                botCross.setStyle(Paint.Style.STROKE);
                botCross.setStrokeCap(Paint.Cap.ROUND);
                botCross.setStrokeWidth(W * 0.003f);
                botCross.setShadowLayer(W * 0.005f, 0, 0, Color.argb(217, 245, 204, 110));
                float bcx = W / 2f, bcy = brandY;
                canvas.drawLine(bcx, bcy - W * 0.0154f, bcx, bcy + W * 0.0103f, botCross);
                canvas.drawLine(bcx - W * 0.0077f, bcy - W * 0.0077f, bcx + W * 0.0077f, bcy - W * 0.0077f, botCross);

                // PRAYLY wordmark
                TextPaint wordmark = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                wordmark.setColor(GOLD);
                wordmark.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
                wordmark.setTextSize(W * 0.0308f); // 36 / 1170
                wordmark.setTextAlign(Paint.Align.CENTER);
                wordmark.setLetterSpacing(0.167f); // 6/36 em
                wordmark.setShadowLayer(W * 0.007f, 0, 0, Color.argb(217, 0, 0, 0));
                canvas.drawText("PRAYLY", W / 2f, brandY + H * 0.0205f, wordmark);

                // Tagline
                TextPaint tagline = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                tagline.setColor(Color.argb(199, 255, 255, 255));
                tagline.setTypeface(Typeface.create(Typeface.SERIF, Typeface.NORMAL));
                tagline.setTextSize(W * 0.0171f); // 20 / 1170
                tagline.setTextAlign(Paint.Align.CENTER);
                tagline.setLetterSpacing(0.2f); // 4/20 em
                tagline.setShadowLayer(W * 0.005f, 0, 0, Color.argb(179, 0, 0, 0));
                canvas.drawText("BIBLE PRAYER & VERSE", W / 2f, brandY + H * 0.034f, tagline);

                // === Stale / Renew badge ===
                // Two states:
                //   1. Free user on default 365 rotation who hasn't unlocked
                //      today → "A NEW DAILY VERSE IS AVAILABLE"
                //   2. Lapsed Pro user whose mood pack is now frozen →
                //      "RENEW PRO TO KEEP YOUR VERSES FLOWING"
                boolean packFrozen = isPackFrozen();
                boolean stale = isStaleForFree();
                if (packFrozen || stale) {
                    float badgeCenterY = brandY - H * 0.078f;
                    float pillH = W * 0.135f;
                    float pillW = Math.min(W * 0.84f, W - W * 0.08f);
                    float pillLeft = (W - pillW) / 2f;
                    float pillTop = badgeCenterY - pillH / 2f;
                    RectF pillRect = new RectF(pillLeft, pillTop, pillLeft + pillW, pillTop + pillH);
                    float pillRadius = pillH / 2f;

                    // ANR fix: a BlurMaskFilter on a full-width rounded rect is a
                    // CPU mask blur (SkMaskBlurFilter::blur) on the software
                    // wallpaper canvas. On low-end chips it held lockCanvas for
                    // seconds, so WallpaperService.Engine.updateSurface on the
                    // main thread blocked -> "Input dispatching timed out" ANR.
                    // Same gold halo, painted as a few cheap translucent rings.
                    Paint glow = new Paint(Paint.ANTI_ALIAS_FLAG);
                    for (int gi = 3; gi >= 1; gi--) {
                        float grow = W * 0.012f * gi;
                        glow.setColor(Color.argb(30 - gi * 6, 245, 204, 110));
                        canvas.drawRoundRect(
                            pillLeft - grow, pillTop - grow,
                            pillLeft + pillW + grow, pillTop + pillH + grow,
                            pillRadius + grow, pillRadius + grow, glow);
                    }

                    Paint pillFill = new Paint(Paint.ANTI_ALIAS_FLAG);
                    pillFill.setShader(new LinearGradient(
                        pillLeft, pillTop, pillLeft + pillW, pillTop + pillH,
                        new int[]{ Color.argb(238, 28, 22, 10), Color.argb(238, 52, 38, 14) },
                        null, Shader.TileMode.CLAMP));
                    canvas.drawRoundRect(pillRect, pillRadius, pillRadius, pillFill);

                    Paint pillStroke = new Paint(Paint.ANTI_ALIAS_FLAG);
                    pillStroke.setStyle(Paint.Style.STROKE);
                    pillStroke.setStrokeWidth(W * 0.004f);
                    pillStroke.setColor(Color.argb(235, 245, 204, 110));
                    canvas.drawRoundRect(pillRect, pillRadius, pillRadius, pillStroke);

                    String headline = packFrozen
                        ? "•  RENEW PRO TO KEEP YOUR VERSES"
                        : "•  A NEW DAILY VERSE IS AVAILABLE";
                    String sub = packFrozen
                        ? "Your mood pack is paused — tap to renew"
                        : "Open Prayly to update your wallpaper";

                    TextPaint badgeTop = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                    badgeTop.setColor(GOLD);
                    badgeTop.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
                    badgeTop.setTextSize(W * 0.0235f);
                    badgeTop.setTextAlign(Paint.Align.CENTER);
                    badgeTop.setLetterSpacing(0.22f);
                    canvas.drawText(headline, W / 2f, pillTop + pillH * 0.40f, badgeTop);

                    TextPaint badgeSub = new TextPaint(Paint.ANTI_ALIAS_FLAG);
                    badgeSub.setColor(Color.argb(245, 255, 240, 210));
                    badgeSub.setTypeface(Typeface.create(Typeface.SANS_SERIF, Typeface.BOLD));
                    badgeSub.setTextSize(W * 0.020f);
                    badgeSub.setTextAlign(Paint.Align.CENTER);
                    badgeSub.setLetterSpacing(0.04f);
                    canvas.drawText(sub, W / 2f, pillTop + pillH * 0.78f, badgeSub);
                }

                } catch (Exception e) {
                    Log.e(TAG, "Draw failed", e);
                } finally {
                    if (canvas != null) {
                        try { holder.unlockCanvasAndPost(canvas); } catch (Exception ignored) {}
                    }
                }
            }
        }

        private void drawFallbackBackground(Canvas canvas, int W, int H) {
            Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
            p.setShader(new LinearGradient(0, 0, 0, H,
                new int[]{
                    Color.rgb(7, 11, 24),
                    Color.rgb(20, 33, 63),
                    Color.rgb(9, 6, 17)
                },
                new float[]{0f, 0.48f, 1f},
                Shader.TileMode.CLAMP));
            canvas.drawRect(0, 0, W, H, p);
        }

        private List<String> wrap(String text, TextPaint paint, float maxWidth) {
            List<String> out = new ArrayList<>();
            String[] words = text.split(" ");
            StringBuilder cur = new StringBuilder();
            for (String w : words) {
                String test = cur.length() == 0 ? w : cur + " " + w;
                if (paint.measureText(test) > maxWidth && cur.length() > 0) {
                    out.add(cur.toString());
                    cur = new StringBuilder(w);
                } else {
                    cur = new StringBuilder(test);
                }
            }
            if (cur.length() > 0) out.add(cur.toString());
            return out;
        }
    }

    private static class Verse {
        final String text, reference;
        Verse(String t, String r) { this.text = t; this.reference = r; }
    }
}
