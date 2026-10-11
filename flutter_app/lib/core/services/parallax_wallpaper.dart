import 'dart:io';

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';

import 'parallax_scenes.dart';
import 'personal_cross.dart';

/// 1:1 port of `src/lib/native/parallaxWallpaper.ts`. The same Android plugin
/// (`ParallaxLiveWallpaperService` + `ParallaxWallpaperPlugin`) is reused; only
/// the Capacitor bridge is swapped for a MethodChannel.
class ParallaxWallpaperResult {
  const ParallaxWallpaperResult({
    required this.success,
    required this.applied,
    required this.sceneId,
  });

  final bool success;
  final bool applied;
  final String sceneId;
}

class ParallaxWallpaper {
  const ParallaxWallpaper._();

  static const _channel = MethodChannel(
    'com.jesuswallpaperbible.app/parallax_wallpaper',
  );

  /// `isNativeParallaxWallpaperSupported()` — Android app only.
  static bool get isSupported => !kIsWeb && Platform.isAndroid;

  /// `applyParallaxWallpaper(scene)` — same payload keys as the web bridge.
  static Future<ParallaxWallpaperResult> apply(ParallaxScene scene) async {
    if (!isSupported) {
      throw PlatformException(
        code: 'unsupported',
        message: 'Parallax live wallpaper requires the Android app.',
      );
    }
    final name = PersonalCross.name();
    final verse = PersonalCross.verse();
    final res = await _channel.invokeMapMethod<String, Object?>(
      'setParallaxWallpaper',
      {
        'sceneId': scene.id,
        'bgUrl': scene.bg,
        'fgUrl': scene.fgFor(),
        'wholeMove': scene.wholeMove,
        // Always re-download so an updated cross asset replaces any cached copy.
        'forceRefresh': true,
        'personalName': name,
        'verseText': verse.text,
        'verseReference': verse.reference,
        'tintColor': PersonalCross.glow().hex,
      },
    );
    return ParallaxWallpaperResult(
      success: res?['success'] == true,
      applied: res?['applied'] == true,
      sceneId: res?['sceneId'] as String? ?? scene.id,
    );
  }

  static Future<({bool active, String? sceneId})> isActive() async {
    if (!isSupported) return (active: false, sceneId: null);
    try {
      final res = await _channel.invokeMapMethod<String, Object?>('isActive');
      return (
        active: res?['active'] == true,
        sceneId: res?['sceneId'] as String?,
      );
    } on PlatformException {
      return (active: false, sceneId: null);
    }
  }

  static Future<bool> isCached(String sceneId) async {
    if (!isSupported) return false;
    try {
      final res = await _channel.invokeMapMethod<String, Object?>('isCached', {
        'sceneId': sceneId,
      });
      return res?['cached'] == true;
    } on PlatformException {
      return false;
    }
  }

  /// Removes our live wallpaper when the user loses Pro (no-op when a
  /// third-party wallpaper is active — verified natively).
  static Future<bool> clearIfActive() async {
    if (!isSupported) return false;
    try {
      final res = await _channel.invokeMapMethod<String, Object?>(
        'clearIfActive',
      );
      return res?['cleared'] == true;
    } on PlatformException {
      return false;
    }
  }
}
