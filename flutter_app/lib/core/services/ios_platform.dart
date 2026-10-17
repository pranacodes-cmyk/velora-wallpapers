import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/services.dart';

/// iOS-only native bridge (Swift `PraylyIosPlugin`): exact on-device wallpaper
/// preview, the Shortcuts automation, widgets, Photos, App Tracking
/// Transparency and Apple's own review sheet.
///
/// Every call is a no-op on Android and web, so shared screens can call these
/// unconditionally without changing Android behaviour.
class IosPlatform {
  IosPlatform._();

  static const _channel = MethodChannel('com.prayly/ios');

  /// Name the setup guide asks the user to give their shortcut, so the app can
  /// run it with one tap ("Apply now").
  static const shortcutName = 'Prayly Wallpaper';

  /// App Store listing (live app id).
  static const appStoreUrl = 'https://apps.apple.com/app/id6772946279';
  static const manageSubscriptionsUrl = 'https://apps.apple.com/account/subscriptions';
  static const appleEulaUrl = 'https://www.apple.com/legal/internet-services/itunes/dev/stdeula/';

  static bool get isIOS => !kIsWeb && Platform.isIOS;

  static Future<T?> _invoke<T>(String method, [Map<String, Object?>? args]) async {
    if (!isIOS) return null;
    try {
      return await _channel.invokeMethod<T>(method, args);
    } catch (_) {
      return null;
    }
  }

  /// Language + Pro flag → widgets, wallpaper renderer and local pushes.
  static Future<void> syncState({String? lang, bool? premium}) =>
      _invoke<bool>('syncState', {
        if (lang != null) 'lang': lang,
        if (premium != null) 'premium': premium,
      });

  /// JPEG of today's wallpaper rendered by the same native code the Shortcut
  /// uses. [display] = true shows exactly what the Lock Screen gets right now
  /// (including the "new verse waiting" badge for a locked free day).
  static Future<Uint8List?> renderPreview({double width = 720, bool display = false}) async {
    final data = await _invoke<Uint8List>('renderPreview', {
      'width': width,
      'display': display,
    });
    return data;
  }

  /// Returns `saved`, `denied` or `failed`.
  static Future<String> saveTodayToPhotos() async =>
      await _invoke<String>('saveTodayToPhotos') ?? 'failed';

  /// Saves arbitrary image bytes (wallpaper feed) to Photos.
  static Future<String> saveImageToPhotos(Uint8List bytes) async =>
      await _invoke<String>('saveImageToPhotos', {'bytes': bytes}) ?? 'failed';

  static Future<IosAutomationStatus> automationStatus() async {
    final raw = await _invoke<Map<Object?, Object?>>('automationStatus');
    return IosAutomationStatus.fromMap(raw ?? const {});
  }

  static Future<bool> openShortcutsApp() async => await _invoke<bool>('openShortcutsApp') ?? false;

  static Future<bool> runShortcut([String name = shortcutName]) async =>
      await _invoke<bool>('runShortcut', {'name': name}) ?? false;

  /// `authorized`, `denied`, `restricted` or `notDetermined`.
  static Future<String> trackingStatus() async =>
      await _invoke<String>('trackingStatus') ?? 'notDetermined';

  static Future<String> requestTracking() async =>
      await _invoke<String>('requestTracking') ?? 'notDetermined';

  static Future<void> requestReview() => _invoke<bool>('requestReview');

  static Future<void> openAppSettings() => _invoke<bool>('openAppSettings');

  static Future<void> reloadWidgets() => _invoke<bool>('reloadWidgets');
}

class IosAutomationStatus {
  const IosAutomationStatus({
    required this.supported,
    required this.active,
    required this.lastRun,
    required this.osMajor,
  });

  /// Shortcuts actions need iOS 16+.
  final bool supported;

  /// The automation produced a wallpaper within the last ~2 days.
  final bool active;
  final DateTime? lastRun;
  final int osMajor;

  static IosAutomationStatus fromMap(Map<Object?, Object?> m) {
    final last = (m['lastRun'] as num?)?.toDouble() ?? 0;
    return IosAutomationStatus(
      supported: m['supported'] == true,
      active: m['active'] == true,
      lastRun: last > 0 ? DateTime.fromMillisecondsSinceEpoch((last * 1000).round()) : null,
      osMajor: (m['osMajor'] as num?)?.toInt() ?? 0,
    );
  }
}
