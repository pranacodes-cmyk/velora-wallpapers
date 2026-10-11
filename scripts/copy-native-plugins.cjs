/**
 * Auto-copy native plugin files to android project after cap sync.
 * Run via: node scripts/copy-native-plugins.js
 */
const fs = require('fs');
const path = require('path');

const copies = [
  // Java plugin files
  ['native-plugins/java/com/velora/plugins/EdgeLightingPlugin.java', 'android/app/src/main/java/com/velora/plugins/EdgeLightingPlugin.java'],
  ['native-plugins/java/com/velora/plugins/EdgeLightingService.java', 'android/app/src/main/java/com/velora/plugins/EdgeLightingService.java'],
  ['native-plugins/java/com/velora/plugins/EdgeLightingView.java', 'android/app/src/main/java/com/velora/plugins/EdgeLightingView.java'],
  ['native-plugins/java/com/velora/plugins/WallpaperSetterPlugin.java', 'android/app/src/main/java/com/velora/plugins/WallpaperSetterPlugin.java'],
  ['native-plugins/java/com/velora/plugins/LiveWallpaperPlugin.java', 'android/app/src/main/java/com/velora/plugins/LiveWallpaperPlugin.java'],
  ['native-plugins/java/com/velora/plugins/ParallaxWallpaperPlugin.java', 'android/app/src/main/java/com/velora/plugins/ParallaxWallpaperPlugin.java'],
  ['native-plugins/java/com/velora/plugins/ParallaxLiveWallpaperService.java', 'android/app/src/main/java/com/velora/plugins/ParallaxLiveWallpaperService.java'],
  ['native-plugins/java/com/velora/plugins/ParallaxSceneRenderer.java', 'android/app/src/main/java/com/velora/plugins/ParallaxSceneRenderer.java'],

  ['native-plugins/java/com/velora/plugins/DailyVerseWallpaperPlugin.java', 'android/app/src/main/java/com/velora/plugins/DailyVerseWallpaperPlugin.java'],
  ['native-plugins/java/com/velora/plugins/DailyVerseWallpaperService.java', 'android/app/src/main/java/com/velora/plugins/DailyVerseWallpaperService.java'],
  ['native-plugins/java/com/velora/plugins/VideoWallpaperService.java', 'android/app/src/main/java/com/velora/plugins/VideoWallpaperService.java'],
  ['native-plugins/java/com/velora/plugins/PrayerAlarmPlugin.java', 'android/app/src/main/java/com/velora/plugins/PrayerAlarmPlugin.java'],
  ['native-plugins/java/com/velora/plugins/PrayerAlarmReceiver.java', 'android/app/src/main/java/com/velora/plugins/PrayerAlarmReceiver.java'],
  ['native-plugins/java/com/velora/plugins/PrayerBootReceiver.java', 'android/app/src/main/java/com/velora/plugins/PrayerBootReceiver.java'],
  ['native-plugins/java/com/velora/plugins/PrayerAlarmActivity.java', 'android/app/src/main/java/com/velora/plugins/PrayerAlarmActivity.java'],
  ['native-plugins/java/com/velora/plugins/ContentPushPlugin.java', 'android/app/src/main/java/com/velora/plugins/ContentPushPlugin.java'],
  ['native-plugins/java/com/velora/plugins/ContentPushReceiver.java', 'android/app/src/main/java/com/velora/plugins/ContentPushReceiver.java'],
  // MainActivity
  ['native-plugins/java/com/aurawalls/app/MainActivity.java', 'android/app/src/main/java/com/jesuswallpaperbible/app/MainActivity.java'],
  ['native-plugins/java/com/aurawalls/app/NotificationPermissionPlugin.java', 'android/app/src/main/java/com/jesuswallpaperbible/app/NotificationPermissionPlugin.java'],
  ['native-plugins/java/com/aurawalls/app/GooglePlayPricesPlugin.java', 'android/app/src/main/java/com/jesuswallpaperbible/app/GooglePlayPricesPlugin.java'],
  // AndroidManifest
  ['native-plugins/AndroidManifest.xml', 'android/app/src/main/AndroidManifest.xml'],
  // Resources
  ['native-plugins/res/values/colors.xml', 'android/app/src/main/res/values/colors.xml'],
  ['native-plugins/res/values/styles.xml', 'android/app/src/main/res/values/styles.xml'],
  ['native-plugins/res/values/strings.xml', 'android/app/src/main/res/values/strings.xml'],
  ['native-plugins/res/xml/file_paths.xml', 'android/app/src/main/res/xml/file_paths.xml'],
  ['native-plugins/res/xml/network_security_config.xml', 'android/app/src/main/res/xml/network_security_config.xml'],
  ['native-plugins/res/xml/gl_wallpaper.xml', 'android/app/src/main/res/xml/gl_wallpaper.xml'],
  ['native-plugins/res/xml/video_wallpaper.xml', 'android/app/src/main/res/xml/video_wallpaper.xml'],
  ['native-plugins/res/xml/parallax_wallpaper.xml', 'android/app/src/main/res/xml/parallax_wallpaper.xml'],
  ['native-plugins/res/xml/daily_verse_wallpaper.xml', 'android/app/src/main/res/xml/daily_verse_wallpaper.xml'],
  // Notification assets
  ['native-plugins/res/raw/divine_bell.mp3', 'android/app/src/main/res/raw/divine_bell.mp3'],
  ['native-plugins/res/drawable/ic_stat_cross.png', 'android/app/src/main/res/drawable/ic_stat_cross.png'],
  // Prayer alarm custom notification layout + drawables
  ['native-plugins/res/layout/prayer_alarm_notification.xml', 'android/app/src/main/res/layout/prayer_alarm_notification.xml'],
  ['native-plugins/res/drawable/prayer_alarm_notification_card.xml', 'android/app/src/main/res/drawable/prayer_alarm_notification_card.xml'],
  ['native-plugins/res/drawable/prayer_alarm_notification_button_fill.xml', 'android/app/src/main/res/drawable/prayer_alarm_notification_button_fill.xml'],
  ['native-plugins/res/drawable/prayer_alarm_notification_button_outline.xml', 'android/app/src/main/res/drawable/prayer_alarm_notification_button_outline.xml'],
  // Content push notification layout + drawables
  ['native-plugins/res/layout/content_push_notification.xml', 'android/app/src/main/res/layout/content_push_notification.xml'],
  ['native-plugins/res/drawable/content_push_card.xml', 'android/app/src/main/res/drawable/content_push_card.xml'],
  ['native-plugins/res/drawable/content_push_cta.xml', 'android/app/src/main/res/drawable/content_push_cta.xml'],
  ['native-plugins/res/drawable/content_push_thumb_bg.xml', 'android/app/src/main/res/drawable/content_push_thumb_bg.xml'],
  // Push notification kind icons (referenced by content_push_notification.xml)
  ['native-plugins/res/drawable/ic_push_verse.xml', 'android/app/src/main/res/drawable/ic_push_verse.xml'],
  ['native-plugins/res/drawable/ic_push_companion.xml', 'android/app/src/main/res/drawable/ic_push_companion.xml'],
  ['native-plugins/res/drawable/ic_push_journey.xml', 'android/app/src/main/res/drawable/ic_push_journey.xml'],
  ['native-plugins/res/drawable/ic_push_quiz.xml', 'android/app/src/main/res/drawable/ic_push_quiz.xml'],
];

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
  return true;
}

let copied = 0;
let skipped = 0;

for (const [src, dest] of copies) {
  if (!fs.existsSync(src)) {
    console.log(`  SKIP (not found): ${src}`);
    skipped++;
    continue;
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copied++;
}

if (copyDir('native-plugins/assets', 'android/app/src/main/assets')) copied++;
if (copyDir('native-plugins/res/raw', 'android/app/src/main/res/raw')) copied++;

console.log(`\n✅ Native plugins copied: ${copied} files (${skipped} skipped)\n`);
