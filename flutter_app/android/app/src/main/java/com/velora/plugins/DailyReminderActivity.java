package com.velora.plugins;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import java.io.InputStream;
import java.text.SimpleDateFormat;
import java.util.Calendar;
import java.util.Date;
import java.util.Locale;

/**
 * Paper-art lock-screen reminder card. Silent: never plays sound, never vibrates.
 * Layout: time → streak chip → paper illustration → KJV line → "Pray now".
 */
public class DailyReminderActivity extends Activity {

    private static final String[][] VERSES = {
            {"Be still, and know that I am God.", "Psalm 46:10"},
            {"The LORD is my shepherd; I shall not want.", "Psalm 23:1"},
            {"This is the day which the LORD hath made.", "Psalm 118:24"},
            {"Cast thy burden upon the LORD, and he shall sustain thee.", "Psalm 55:22"},
            {"I can do all things through Christ which strengtheneth me.", "Philippians 4:13"},
            {"Pray without ceasing.", "1 Thessalonians 5:17"},
            {"Come unto me, all ye that labour and are heavy laden, and I will give you rest.", "Matthew 11:28"},
            {"Thy word is a lamp unto my feet, and a light unto my path.", "Psalm 119:105"},
            {"I will both lay me down in peace, and sleep: for thou, LORD, only makest me dwell in safety.", "Psalm 4:8"},
            {"His compassions fail not. They are new every morning.", "Lamentations 3:22-23"},
            {"The LORD is my light and my salvation; whom shall I fear?", "Psalm 27:1"},
            {"Draw nigh to God, and he will draw nigh to you.", "James 4:8"},
    };

    private static final String[] MORNING_LINES = {
            "Start your day with Him", "Give Him your first minute", "A new morning, new mercies"};
    private static final String[] NIGHT_LINES = {
            "Relax, reflect and talk to God", "Rest your heart in Him", "End your day in His peace"};

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        if (Build.VERSION.SDK_INT >= 27) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
        } else {
            getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED
                    | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        }
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        String slot = getIntent().getStringExtra("slot");
        boolean night = "night".equals(slot);
        setContentView(build(night));
    }

    private int dp(float v) { return (int) (v * getResources().getDisplayMetrics().density); }

    private View build(boolean night) {
        int ink = night ? Color.parseColor("#F4E9D2") : Color.parseColor("#2B2418");
        int soft = night ? Color.parseColor("#B9AE95") : Color.parseColor("#6E5E43");
        int gold = Color.parseColor("#C9A24A");

        FrameLayout root = new FrameLayout(this);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.TOP_BOTTOM,
                night ? new int[]{Color.parseColor("#0E1830"), Color.parseColor("#070D1C")}
                      : new int[]{Color.parseColor("#F6EEDC"), Color.parseColor("#EADCBF")});
        root.setBackground(bg);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);
        col.setGravity(Gravity.CENTER_HORIZONTAL);
        col.setPadding(dp(28), dp(56), dp(28), dp(40));
        root.addView(col, new FrameLayout.LayoutParams(-1, -1));

        TextView time = text(new SimpleDateFormat("H:mm", Locale.getDefault()).format(new Date()), 64, ink, true);
        time.setTypeface(Typeface.create("sans-serif-light", Typeface.NORMAL));
        col.addView(time);

        String date = new SimpleDateFormat("EEEE, d MMMM", Locale.getDefault()).format(new Date());
        col.addView(text(date, 14, soft, false));

        TextView chip = text(DailyReminderScheduler.streakLabel(this), 13, ink, true);
        GradientDrawable cbg = new GradientDrawable();
        cbg.setCornerRadius(dp(20));
        cbg.setColor(night ? Color.parseColor("#1F2A45") : Color.parseColor("#FFF8E8"));
        cbg.setStroke(dp(1), gold);
        chip.setBackground(cbg);
        chip.setPadding(dp(14), dp(6), dp(14), dp(6));
        LinearLayout.LayoutParams clp = new LinearLayout.LayoutParams(-2, -2);
        clp.topMargin = dp(16);
        col.addView(chip, clp);

        int day = Calendar.getInstance().get(Calendar.DAY_OF_YEAR);
        int verseCount = VERSES.length;
        try {
            verseCount = Integer.parseInt(DailyReminderScheduler.copy(this, "verse.count",
                    String.valueOf(VERSES.length)));
        } catch (NumberFormatException ignored) {}
        if (verseCount <= 0 || verseCount > VERSES.length) verseCount = VERSES.length;
        int idx = (day * 2 + (night ? 1 : 0)) % verseCount;

        ImageView art = new ImageView(this);
        art.setScaleType(ImageView.ScaleType.CENTER_CROP);
        Bitmap bmp = loadArt(idx + 1);
        if (bmp != null) art.setImageBitmap(bmp);
        art.setClipToOutline(true);
        GradientDrawable abg = new GradientDrawable();
        abg.setCornerRadius(dp(28));
        art.setBackground(abg);
        LinearLayout.LayoutParams alp = new LinearLayout.LayoutParams(-1, 0, 1f);
        alp.topMargin = dp(22);
        alp.bottomMargin = dp(20);
        col.addView(art, alp);

        String[] lines = night ? NIGHT_LINES : MORNING_LINES;
        String phase = night ? "night." : "morning.";
        int lineIndex = day % lines.length;
        String headline = DailyReminderScheduler.copy(this, phase + (lineIndex + 1), lines[lineIndex]);
        TextView head = text(headline, 22, ink, true);
        head.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        col.addView(head);

        String[] v = VERSES[idx];
        String verseText = DailyReminderScheduler.copy(this, "verse." + idx + ".text", v[0]);
        String verseRef = DailyReminderScheduler.copy(this, "verse." + idx + ".ref", v[1]);
        TextView verse = text("\u201C" + verseText + "\u201D  \u2014 " + verseRef, 14, soft, false);
        verse.setTypeface(Typeface.create(Typeface.SERIF, Typeface.ITALIC));
        LinearLayout.LayoutParams vlp = new LinearLayout.LayoutParams(-2, -2);
        vlp.topMargin = dp(8);
        vlp.bottomMargin = dp(22);
        col.addView(verse, vlp);

        TextView pray = text("\u271D   " + DailyReminderScheduler.copy(this,
                "action.prayNow", "Pray now"), 17, Color.parseColor("#1A1408"), true);
        GradientDrawable pbg = new GradientDrawable(GradientDrawable.Orientation.LEFT_RIGHT,
                new int[]{Color.parseColor("#E8C56B"), Color.parseColor("#C9A24A")});
        pbg.setCornerRadius(dp(30));
        pray.setBackground(pbg);
        pray.setPadding(0, dp(16), 0, dp(16));
        pray.setOnClickListener(x -> openApp());
        col.addView(pray, new LinearLayout.LayoutParams(-1, -2));

        TextView close = text(DailyReminderScheduler.copy(this,
                "action.notNow", "Not now"), 14, soft, false);
        close.setPadding(dp(20), dp(14), dp(20), dp(4));
        close.setOnClickListener(x -> finishQuiet());
        col.addView(close);

        return root;
    }

    private TextView text(String s, float sp, int color, boolean bold) {
        TextView t = new TextView(this);
        t.setText(s);
        t.setTextSize(sp);
        t.setTextColor(color);
        t.setGravity(Gravity.CENTER);
        if (bold) t.setTypeface(Typeface.DEFAULT_BOLD);
        t.setLayoutParams(new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT,
                ViewGroup.LayoutParams.WRAP_CONTENT));
        return t;
    }

    private Bitmap loadArt(int n) {
        String name = String.format(Locale.US, "flutter_assets/assets/images/reminders/reminder_%02d.jpg", n);
        try (InputStream in = getAssets().open(name)) {
            BitmapFactory.Options o = new BitmapFactory.Options();
            o.inSampleSize = 2;
            return BitmapFactory.decodeStream(in, null, o);
        } catch (Exception e) {
            return null;
        }
    }

    private void cancelNotif() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) nm.cancel(DailyReminderReceiver.NOTIF_ID);
    }

    private void finishQuiet() {
        cancelNotif();
        finish();
    }

    private void openApp() {
        cancelNotif();
        Runnable go = () -> {
            try {
                Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
                if (i != null) {
                    i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP
                            | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                    i.putExtra("open_route", "/devotional?from=daily_reminder");
                    startActivity(i);
                }
            } catch (Exception ignored) {}
            finish();
        };
        KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && km != null && km.isKeyguardLocked()) {
            km.requestDismissKeyguard(this, new KeyguardManager.KeyguardDismissCallback() {
                @Override public void onDismissSucceeded() { go.run(); }
            });
        } else {
            go.run();
        }
    }
}
