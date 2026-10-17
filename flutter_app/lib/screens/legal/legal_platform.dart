import '../../core/services/ios_platform.dart';

/// The legal texts were written for the Google Play build. On iPhone/iPad the
/// same documents are shown with Apple's billing, permissions and settings
/// paths so nothing on screen is wrong for an App Store user. Android and web
/// see the original text unchanged.
String legalForPlatform(String raw) {
  if (!IosPlatform.isIOS) return raw;
  final whole = _iosWhole[raw];
  if (whole != null) return whole;
  var s = raw;
  for (final r in _iosReplacements) {
    s = s.replaceAll(r.$1, r.$2);
  }
  return s;
}

const Map<String, String> _iosWhole = {
  '**INTERNET** — download wallpapers and updates.':
      '**Network access** — download wallpapers, verses and updates.',
  '**SET_WALLPAPER** — apply images and live wallpapers to your home/lock screen.':
      '**Photos (add only)** — save wallpapers to your photo library when you ask. We never read your photos.',
  '**FOREGROUND_SERVICE / BIND_WALLPAPER** — run live wallpaper engines.':
      '**Shortcuts & widgets** — create your daily verse wallpaper on your device for the Shortcuts automation and widgets you set up.',
  '**VIBRATE** — provide subtle haptic feedback on taps.':
      '**Haptics** — provide subtle haptic feedback on taps.',
  '**POST_NOTIFICATIONS** (Android 13+) — optional daily verse / prayer reminders. You can disable this at any time in system settings.':
      '**Notifications** — optional daily verse / prayer reminders. You can disable this at any time in Settings.',
  '**com.android.vending.BILLING** — process in-app purchases through Google Play.':
      '**App Tracking Transparency** — only if you allow it, used to measure which ads bring people to the App.',
};

const List<(String, String)> _iosReplacements = [
  ('Google Play Store → Profile → Payments & subscriptions → Subscriptions', 'Settings → Apple ID → Subscriptions'),
  ('Settings → Google → Ads* on your Android device', 'Settings → Privacy & Security → Tracking* on your iPhone'),
  ('the Android Advertising ID', 'the advertising identifier (only if you allow tracking)'),
  ('devotional content for Android devices', 'devotional content for iPhone and iPad'),
  ('Google Play Billing', 'Apple In-App Purchase'),
  ("Google Play's policies", "Apple's App Store policies"),
  ('Google handles the transaction', 'Apple handles the transaction'),
  ('Held by Google.', 'Held by Apple.'),
  ('Purchase token', 'Purchase receipt'),
  ('purchase token', 'purchase receipt'),
  ('package name', 'bundle ID'),
  ('on Google Play', 'on the App Store'),
  ('via Google Play', 'via the App Store'),
  ('through Google Play', 'through the App Store'),
  ('Google Play', 'the App Store'),
];
