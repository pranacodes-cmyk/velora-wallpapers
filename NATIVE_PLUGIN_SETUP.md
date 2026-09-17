# Native Plugin Setup Instructions

After running `npx cap add android`, follow these steps:

## 1. Register Plugins in MainActivity

Edit `android/app/src/main/java/<your-package>/MainActivity.java`:

```java
import com.velora.plugins.WallpaperSetterPlugin;
import com.velora.plugins.EdgeLightingPlugin;
import com.velora.plugins.LiveWallpaperPlugin;
import com.velora.plugins.DailyVerseWallpaperPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WallpaperSetterPlugin.class);
        registerPlugin(EdgeLightingPlugin.class);
        registerPlugin(LiveWallpaperPlugin.class);
        registerPlugin(DailyVerseWallpaperPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
```

## 2. Permissions in AndroidManifest.xml

```xml
<uses-permission android:name="android.permission.SET_WALLPAPER" />
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.SYSTEM_ALERT_WINDOW" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

## 3. Register Services

Inside `<application>` in AndroidManifest.xml:

```xml
<service
    android:name="com.velora.plugins.EdgeLightingService"
    android:exported="false"
    android:foregroundServiceType="specialUse" />

<service
    android:name="com.velora.plugins.VideoWallpaperService"
    android:label="Christian 4K Live Wallpaper"
    android:exported="true"
    android:permission="android.permission.BIND_WALLPAPER">
    <intent-filter>
        <action android:name="android.service.wallpaper.WallpaperService" />
    </intent-filter>
    <meta-data
        android:name="android.service.wallpaper"
        android:resource="@xml/video_wallpaper" />
</service>
```

## 4. Copy Plugin Files

Copy these files into your android project:
- `android/app/src/main/java/com/velora/plugins/WallpaperSetterPlugin.java`
- `android/app/src/main/java/com/velora/plugins/EdgeLightingPlugin.java`
- `android/app/src/main/java/com/velora/plugins/EdgeLightingService.java`
- `android/app/src/main/java/com/velora/plugins/EdgeLightingView.java`
- `android/app/src/main/java/com/velora/plugins/LiveWallpaperPlugin.java`
- `android/app/src/main/java/com/velora/plugins/VideoWallpaperService.java`
- `android/app/src/main/java/com/velora/plugins/DailyVerseWallpaperPlugin.java`
- `android/app/src/main/java/com/velora/plugins/DailyVerseWallpaperService.java`

## 5. Copy Resource Files

- `android/app/src/main/res/xml/video_wallpaper.xml`
- `android/app/src/main/res/xml/daily_verse_wallpaper.xml`

## 5b. Copy Daily Verse Assets

Copy the bundled verses + backgrounds into Android `assets/` so the
DailyVerseWallpaperService can render entirely offline:
- `android/app/src/main/assets/daily_verse/verses.json`
- `android/app/src/main/assets/daily_verse/backgrounds/bg-01.jpg` … `bg-10.jpg`

## 6. Bundle Video Assets

Copy live wallpaper videos to Android raw resources:
- `android/app/src/main/res/raw/live_wp_samurai_ronin.mp4`
- `android/app/src/main/res/raw/live_wp_nihilist_penguin.mp4`
- `android/app/src/main/res/raw/live_wp_golden_orb.mp4`
- `android/app/src/main/res/raw/live_wp_cosmic_nebula.mp4`
- `android/app/src/main/res/raw/live_wp_ocean_abyss.mp4`

## 7. Sync & Build

```bash
npx cap sync android
npx cap run android
```

## Wallpaper Setter Plugin
- **Home Screen** - FLAG_SYSTEM (Android 7.0+)
- **Lock Screen** - FLAG_LOCK (Android 7.0+)
- **Both** - FLAG_SYSTEM | FLAG_LOCK

## Edge Lighting Plugin
- Uses `SYSTEM_ALERT_WINDOW` to draw overlay borders
- Runs as a foreground service with persistent notification
- Supports 4 animation styles: gradient, pulse, wave, breathe
- Customizable colors, border width, speed, corner radius
- User must grant "Display over other apps" permission

## Live Wallpaper Plugin (Video Engine)
- **Pre-rendered video loops** — cinematic quality, no shader limitations
- **MediaPlayer** with hardware H.264/H.265 decoder — dedicated chip, minimal battery
- **SurfaceView rendering** — 30% more efficient than TextureView
- **Battery**: 2-4% daily (vs 8-15% for shader rendering)
- **Auto-pause** when screen off or app in foreground
- **Seamless looping** via MediaPlayer.setLooping(true)
- **Center-crop** scaling via VIDEO_SCALING_MODE_SCALE_TO_FIT_WITH_CROPPING
- Videos stored in `res/raw/` for optimal loading
- Shader selection stored in `SharedPreferences`
- Launches native Android live wallpaper picker via `WallpaperManager.ACTION_CHANGE_LIVE_WALLPAPER`
