import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../localization/app_localizations.dart';
import 'analytics.dart';
import 'prefs.dart';
import 'bible_gate_service.dart';

class PrayScreenStatus {
  const PrayScreenStatus({
    required this.usageAllowed,
    required this.overlayAllowed,
    required this.running,
    this.serviceRunning = false,
    this.guardedCount = 0,
  });

  final bool usageAllowed;
  final bool overlayAllowed;
  final bool running;
  final bool serviceRunning;
  final int guardedCount;

  bool get ready => usageAllowed && overlayAllowed;

  factory PrayScreenStatus.fromMap(Map<Object?, Object?> value) =>
      PrayScreenStatus(
        usageAllowed: value['usageAllowed'] == true,
        overlayAllowed: value['overlayAllowed'] == true,
        running: value['running'] == true,
        serviceRunning: value['serviceRunning'] == true,
        guardedCount: (value['guardedCount'] as num?)?.toInt() ?? 0,
      );
}

class GuardedApp {
  const GuardedApp({
    required this.packageName,
    required this.name,
    required this.shortLabel,
    this.iconBase64,
    this.usageMs = 0,
  });

  final String packageName;
  final String name;
  final String shortLabel;
  final String? iconBase64;
  final int usageMs;

  factory GuardedApp.fromMap(Map<Object?, Object?> value) => GuardedApp(
    packageName: value['packageName']?.toString() ?? '',
    name: value['name']?.toString() ?? '',
    shortLabel: value['shortLabel']?.toString() ?? '',
    iconBase64: value['icon']?.toString(),
    usageMs: (value['usageMs'] as num?)?.toInt() ?? 0,
  );
}

class PrayScreenService {
  PrayScreenService._();

  static const _channel = MethodChannel(
    'com.jesuswallpaperbible.app/pray_screen',
  );

  static const supportedApps = <GuardedApp>[
    GuardedApp(
      packageName: 'com.instagram.android',
      name: 'Instagram',
      shortLabel: 'IG',
    ),
    GuardedApp(
      packageName: 'com.zhiliaoapp.musically',
      name: 'TikTok',
      shortLabel: 'TT',
    ),
    GuardedApp(
      packageName: 'com.google.android.youtube',
      name: 'YouTube',
      shortLabel: 'YT',
    ),
    GuardedApp(
      packageName: 'com.facebook.katana',
      name: 'Facebook',
      shortLabel: 'FB',
    ),
    GuardedApp(packageName: 'com.twitter.android', name: 'X', shortLabel: 'X'),
    GuardedApp(
      packageName: 'com.snapchat.android',
      name: 'Snapchat',
      shortLabel: 'SC',
    ),
  ];

  /// Deliberate social priority for the "Your top apps" row — the feature is
  /// meant to guard these, never random utilities that happen to rank high in
  /// 30-day usage. Mirrors `SOCIAL_PRIORITY` in `src/pages/PrayScreen.tsx`.
  static const socialPriority = <String>[
    'com.instagram.android',
    'com.zhiliaoapp.musically',
    'com.facebook.katana',
    'com.twitter.android',
    'com.snapchat.android',
    'com.google.android.youtube',
  ];

  /// Installed social apps first (in priority order), then the most-used rest.
  static List<GuardedApp> topApps(List<GuardedApp> apps, {int count = 4}) {
    final picked = <GuardedApp>[];
    for (final pkg in socialPriority) {
      final match = apps.where((a) => a.packageName == pkg);
      if (match.isNotEmpty) picked.add(match.first);
    }
    if (picked.length < count) {
      final rest =
          apps
              .where((a) => !picked.any((p) => p.packageName == a.packageName))
              .toList()
            ..sort((a, b) => b.usageMs.compareTo(a.usageMs));
      picked.addAll(rest.take(count - picked.length));
    }
    return picked.take(count).toList(growable: false);
  }

  static Future<List<GuardedApp>> loadInstalledApps() async {
    if (kIsWeb) return supportedApps;
    try {
      final raw =
          await _channel.invokeListMethod<Object?>('getApps') ?? const [];
      final apps = raw
          .whereType<Map<Object?, Object?>>()
          .map(GuardedApp.fromMap)
          .where((app) => app.packageName.isNotEmpty && app.name.isNotEmpty)
          .toList(growable: false);
      return apps.isEmpty ? supportedApps : apps;
    } catch (_) {
      return supportedApps;
    }
  }

  static List<String> get selectedPackages =>
      (Prefs.getString(StorageKeys.prayScreenApps) ?? '')
          .split(',')
          .where((value) => value.isNotEmpty)
          .toList(growable: false);

  static bool get enabled => Prefs.getBool(StorageKeys.prayScreenEnabled);

  static int get unblockUntil =>
      Prefs.getInt(StorageKeys.prayScreenUnblockUntil);

  static bool get isGuarding =>
      enabled && DateTime.now().millisecondsSinceEpoch >= unblockUntil;

  static Future<PrayScreenStatus> status() async {
    if (kIsWeb) {
      return PrayScreenStatus(
        usageAllowed: Prefs.getBool('ps_preview_usage'),
        overlayAllowed: Prefs.getBool('ps_preview_overlay'),
        running: enabled,
      );
    }
    try {
      final raw = await _channel.invokeMapMethod<Object?, Object?>('getStatus');
      return PrayScreenStatus.fromMap(raw ?? const {});
    } catch (_) {
      return const PrayScreenStatus(
        usageAllowed: false,
        overlayAllowed: false,
        running: false,
      );
    }
  }

  static Future<void> openUsageAccess() async {
    if (kIsWeb) {
      await Prefs.setBool('ps_preview_usage', true);
      return;
    }
    await _channel.invokeMethod<void>('openUsageAccess');
  }

  static Future<void> openOverlayAccess() async {
    if (kIsWeb) {
      await Prefs.setBool('ps_preview_overlay', true);
      return;
    }
    await _channel.invokeMethod<void>('openOverlayAccess');
  }

  static Future<void> saveApps(List<String> packages) async {
    await Prefs.setString(StorageKeys.prayScreenApps, packages.join(','));
    if (!kIsWeb) {
      await _channel.invokeMethod<void>('setApps', {'packages': packages});
    }
  }

  static Future<bool> setEnabled(bool value) async {
    await Prefs.setBool(StorageKeys.prayScreenEnabled, value);
    if (kIsWeb) return value;
    try {
      if (value) await pushBlockerCopy();
      final ok = value
          ? await _channel.invokeMethod<bool>('start', {
              'packages': selectedPackages,
            })
          : await _channel.invokeMethod<bool>('stop');
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  /// Pushes the blocker's verse, prayer and buttons in the app's language so
  /// the native overlay never falls back to English.
  static Future<void> pushBlockerCopy() async {
    if (kIsWeb) return;
    final l = L10n.current;
    // The blocker keeps only a title and one line; the verse and prayer are
    // shown full-screen inside Prayly, straight from the backend.
    try {
      await _channel.invokeMethod<bool>('setPauseMode', {'bible': BibleGateService.enabled});
      await _channel.invokeMethod<bool>('setCopy', {
        'copy': <String, String>{
          'kicker': l.t('ps.block.kicker'),
          'title': l.t('ps.block.title'),
          'sub': l.t('ps.block.sub'),
          'unlock': l.t('ps.block.unlock'),
          'note': l.t('ps.block.note'),
          'bible': l.t('bible.title'),
          'prayer': l.t('ps.mode.prayer'),
        },
      });
    } catch (_) {}
  }

  /// Re-starts the native watcher if the OS killed it while the Shield is on.
  static Future<void> ensureRunning() async {
    if (kIsWeb || !enabled) return;
    final current = await status();
    if (current.ready && !current.serviceRunning) await setEnabled(true);
  }

  /// True when Android will not kill the Shield to save battery.
  static Future<bool> batteryUnrestricted() async {
    if (kIsWeb) return Prefs.getBool('ps_preview_battery');
    try {
      return await _channel.invokeMethod<bool>('batteryUnrestricted') ?? true;
    } catch (_) {
      return true;
    }
  }

  static Future<void> openBatterySettings() async {
    if (kIsWeb) {
      await Prefs.setBool('ps_preview_battery', true);
      return;
    }
    await _channel.invokeMethod<void>('openBatterySettings');
  }

  /// Shows the real native Shield once so the user can confirm it works.
  static Future<bool> testShield() async {
    if (kIsWeb) return false;
    try {
      return await _channel.invokeMethod<bool>('testShield') ?? false;
    } catch (_) {
      return false;
    }
  }

  static DateTime nextReset([DateTime? from]) {
    final now = from ?? DateTime.now();
    const hours = [0, 5, 12, 18];
    for (final hour in hours) {
      final candidate = DateTime(now.year, now.month, now.day, hour);
      if (candidate.isAfter(now)) return candidate;
    }
    return DateTime(now.year, now.month, now.day + 1);
  }

  static Future<DateTime> unlock() async {
    final now = DateTime.now();
    final scheduled = nextReset(now);
    final minimum = now.add(const Duration(hours: 1));
    final until = scheduled.isAfter(minimum) ? scheduled : minimum;
    await Prefs.setInt(
      StorageKeys.prayScreenUnblockUntil,
      until.millisecondsSinceEpoch,
    );
    if (!kIsWeb) {
      await _channel.invokeMethod<void>('unlockUntil', {
        'timestamp': until.millisecondsSinceEpoch,
      });
    }
    await Analytics.capture('pray_screen_unlocked', {
      'until': until.toIso8601String(),
      'app_count': selectedPackages.length,
    });
    return until;
  }

  static Future<void> forceGuard() async {
    await Prefs.setInt(StorageKeys.prayScreenUnblockUntil, 0);
    if (!kIsWeb) await _channel.invokeMethod<void>('forceGuard');
    await Analytics.capture('pray_screen_force_guarded');
  }

  /// Consumes the one-shot request created when the user taps the native
  /// full-screen Shield. The shell uses it to open the exact Sacred Pause flow.
  static Future<bool> consumeSacredPauseLaunch() async {
    if (kIsWeb) return false;
    try {
      final pending = await _channel.invokeMethod<bool>('consumeSacredPauseLaunch') ?? false;
      if (pending) {
        final bible = await _channel.invokeMethod<bool>('getPauseMode');
        if (bible != null) await BibleGateService.setEnabled(bible);
      }
      return pending;
    } catch (_) {
      return false;
    }
  }

  /// Sends the blocker's queued native events (shield shown, CTA tapped,
  /// handoff direct/notification/blocked) to PostHog.
  static Future<void> drainNativeEvents() async {
    if (kIsWeb) return;
    try {
      final raw = await _channel.invokeMethod<String>('drainEvents');
      if (raw == null || raw.isEmpty || raw == '[]') return;
      final list = jsonDecode(raw) as List<dynamic>;
      for (final item in list) {
        if (item is! Map) continue;
        final event = item['event'];
        if (event is! String || event.isEmpty) continue;
        await Analytics.capture(event, {
          'detail': item['detail'],
          'guarded_app': item['app'],
          'native_ts': item['ts'],
        });
      }
    } catch (_) {}
  }
}
