import 'package:flutter/services.dart';

/// Bridge to the existing Android native plugins (`native-plugins/java/...`).
/// The Java/Kotlin side is reused as-is — only the JS bridge is replaced by a
/// MethodChannel, which removes the WebView round-trip that caused ANRs.
class WallpaperBridge {
  const WallpaperBridge._();

  static const _channel = MethodChannel(
    'com.jesuswallpaperbible.app/wallpaper',
  );

  /// target: 'home' | 'lock' | 'both'
  static Future<bool> setStaticWallpaper(
    String imageUrl, {
    String target = 'both',
  }) async {
    try {
      final ok = await _channel.invokeMethod<bool>('setStatic', {
        'url': imageUrl,
        'target': target,
      });
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> setLiveWallpaper(String videoUrl) async {
    try {
      final ok = await _channel.invokeMethod<bool>('setLive', {
        'url': videoUrl,
      });
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> setParallaxWallpaper(Map<String, Object?> scene) async {
    try {
      final ok = await _channel.invokeMethod<bool>('setParallax', scene);
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> setDailyVerseWallpaper(
    Map<String, Object?> config,
  ) async {
    try {
      final ok = await _channel.invokeMethod<bool>('setDailyVerse', config);
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Sets (or clears, with an empty `verses` list) the active mood/situation
  /// pack on the native daily-verse wallpaper service. Mirrors the old
  /// Capacitor `DailyVerseWallpaper.setMoodPackVerses({ mood, verses })`.
  static Future<void> dailyVerseSetMoodPack(
    String? mood,
    List<Map<String, String>> verses,
  ) async {
    try {
      await _channel.invokeMethod('dailyVerseSetMoodPack', {
        'mood': mood,
        'verses': verses,
      });
    } catch (_) {
      // no-op — mirrors the web app's best-effort native bridge calls
    }
  }

  /// Mirrors `DailyVerseWallpaper.setPremium({ premium })`.
  static Future<void> dailyVerseSetPremium(bool premium) async {
    try {
      await _channel.invokeMethod('dailyVerseSetPremium', {'premium': premium});
    } catch (_) {
      // no-op
    }
  }

  /// Mirrors `DailyVerseWallpaper.markVerseUnlocked()`.
  static Future<bool> dailyVerseMarkUnlocked() async {
    try {
      final ok = await _channel.invokeMethod<bool>('dailyVerseMarkUnlocked');
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Mirrors `DailyVerseWallpaper.prefetchAssets({ force, single })`.
  static Future<Map<Object?, Object?>?> dailyVersePrefetch({
    bool force = false,
    bool single = false,
  }) async {
    try {
      return await _channel.invokeMethod<Map<Object?, Object?>>(
        'dailyVersePrefetch',
        {'force': force, 'single': single},
      );
    } catch (_) {
      return null;
    }
  }

  /// Mirrors `DailyVerseWallpaper.getCacheStatus()`.
  static Future<Map<Object?, Object?>?> dailyVerseCacheStatus() async {
    try {
      return await _channel.invokeMethod<Map<Object?, Object?>>(
        'dailyVerseCacheStatus',
      );
    } catch (_) {
      return null;
    }
  }

  /// Mirrors `DailyVerseWallpaper.isActive()`.
  static Future<bool> dailyVerseIsActive() async {
    try {
      final r = await _channel.invokeMethod<Map<Object?, Object?>>(
        'dailyVerseIsActive',
      );
      return r?['active'] == true;
    } catch (_) {
      return false;
    }
  }
}
