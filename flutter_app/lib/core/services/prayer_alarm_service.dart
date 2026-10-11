import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

import 'prefs.dart';

/// 1:1 port of `src/plugins/prayer-alarm.ts` + `src/hooks/usePrayerAlarms.ts`.
///
/// Storage key, default times, legacy 18:00 → 21:00 evening migration and the
/// self-heal reschedule all match the web app exactly, so an existing install
/// keeps its bells. The native side is the same Android AlarmManager plugin
/// (`native-plugins/java/...`), reached through a MethodChannel instead of the
/// Capacitor WebView bridge.
class PrayerTime {
  const PrayerTime({
    required this.hour,
    required this.minute,
    required this.label,
  });

  /// 0-23
  final int hour;

  /// 0-59
  final int minute;

  /// "Morning Prayer", "Evening Prayer", …
  final String label;

  PrayerTime copyWith({int? hour, int? minute, String? label}) => PrayerTime(
    hour: hour ?? this.hour,
    minute: minute ?? this.minute,
    label: label ?? this.label,
  );

  Map<String, Object?> toMap() => {
    'hour': hour,
    'minute': minute,
    'label': label,
  };

  static PrayerTime? fromMap(Object? raw) {
    if (raw is! Map) return null;
    final hour = (raw['hour'] as num?)?.toInt();
    final minute = (raw['minute'] as num?)?.toInt();
    if (hour == null || minute == null) return null;
    return PrayerTime(
      hour: hour,
      minute: minute,
      label: raw['label']?.toString() ?? '',
    );
  }
}

class PrayerAlarmStatus {
  const PrayerAlarmStatus({
    required this.exactAlarmAllowed,
    required this.notificationsAllowed,
    required this.overlayAllowed,
    required this.fullScreenIntentAllowed,
    required this.canScheduleFullScreen,
    required this.scheduledCount,
  });

  final bool exactAlarmAllowed;
  final bool notificationsAllowed;
  final bool overlayAllowed;
  final bool fullScreenIntentAllowed;
  final bool canScheduleFullScreen;
  final int scheduledCount;

  static PrayerAlarmStatus fromMap(Map<Object?, Object?> map) =>
      PrayerAlarmStatus(
        exactAlarmAllowed: map['exactAlarmAllowed'] == true,
        notificationsAllowed: map['notificationsAllowed'] == true,
        overlayAllowed: map['overlayAllowed'] == true,
        fullScreenIntentAllowed: map['fullScreenIntentAllowed'] == true,
        canScheduleFullScreen: map['canScheduleFullScreen'] == true,
        scheduledCount: (map['scheduledCount'] as num?)?.toInt() ?? 0,
      );
}

class PrayerAlarmsConfig {
  const PrayerAlarmsConfig({
    required this.enabled,
    required this.soundEnabled,
    required this.times,
  });

  final bool enabled;
  final bool soundEnabled;
  final List<PrayerTime> times;

  PrayerAlarmsConfig copyWith({
    bool? enabled,
    bool? soundEnabled,
    List<PrayerTime>? times,
  }) => PrayerAlarmsConfig(
    enabled: enabled ?? this.enabled,
    soundEnabled: soundEnabled ?? this.soundEnabled,
    times: times ?? this.times,
  );
}

const kDefaultPrayerTimes = <PrayerTime>[
  PrayerTime(hour: 7, minute: 0, label: 'Morning Prayer'),
  PrayerTime(hour: 21, minute: 0, label: 'Evening Prayer'),
];

const _defaultConfig = PrayerAlarmsConfig(
  enabled: false,
  soundEnabled: true,
  times: kDefaultPrayerTimes,
);

class PrayerAlarms {
  PrayerAlarms._();

  static const _storageKey = 'jwbp_prayer_alarms_v1';
  static const _migrationFlag = 'prayly:evening-bell-21h-migrated';

  static const _channel = MethodChannel(
    'com.jesuswallpaperbible.app/prayer_alarm',
  );

  /// Stands in for React state — widgets listen and rebuild.
  static final revision = ValueNotifier<int>(0);

  static PrayerAlarmStatus? status;
  static String? _repairKey;
  static bool _bootstrapped = false;

  // ── persistence ──────────────────────────────────────────────────────────
  static PrayerAlarmsConfig load() {
    try {
      final raw = Prefs.getString(_storageKey);
      if (raw == null) return _defaultConfig;
      final map = jsonDecode(raw) as Map<String, dynamic>;
      final times =
          (map['times'] as List?)
              ?.map(PrayerTime.fromMap)
              .whereType<PrayerTime>()
              .toList() ??
          List<PrayerTime>.from(kDefaultPrayerTimes);

      // One-time migration: legacy 18:00 Evening Prayer → 21:00.
      var migrated = false;
      final fixed = times.map((t) {
        if (t.hour == 18 &&
            t.minute == 0 &&
            RegExp('evening', caseSensitive: false).hasMatch(t.label)) {
          migrated = true;
          return t.copyWith(hour: 21);
        }
        return t;
      }).toList();

      final config = PrayerAlarmsConfig(
        enabled: map['enabled'] == true,
        soundEnabled: map['soundEnabled'] != false,
        times: fixed,
      );
      if (migrated) _save(config);
      return config;
    } catch (_) {
      return _defaultConfig;
    }
  }

  static Future<void> _save(PrayerAlarmsConfig c) async {
    await Prefs.setString(
      _storageKey,
      jsonEncode({
        'enabled': c.enabled,
        'soundEnabled': c.soundEnabled,
        'times': c.times.map((t) => t.toMap()).toList(),
      }),
    );
    revision.value++;
  }

  // ── native bridge ────────────────────────────────────────────────────────
  static Future<void> refreshStatus() async {
    try {
      final res = await _channel.invokeMethod<Map<Object?, Object?>>(
        'getStatus',
      );
      if (res != null) {
        status = PrayerAlarmStatus.fromMap(res);
        revision.value++;
      }
    } catch (_) {
      /* ignore — same as the web hook */
    }
  }

  static Future<int> _scheduleAll(PrayerAlarmsConfig c) async {
    try {
      final n = await _channel.invokeMethod<int>('scheduleAll', {
        'times': c.times.map((t) => t.toMap()).toList(),
        'soundEnabled': c.soundEnabled,
      });
      return n ?? c.times.length;
    } on PlatformException {
      return 0;
    } on MissingPluginException {
      return 0;
    }
  }

  static Future<void> _cancelAll() async {
    try {
      await _channel.invokeMethod('cancelAll');
    } catch (_) {
      /* ignore */
    }
  }

  static Future<bool> preview({
    required String label,
    required bool soundEnabled,
  }) async {
    try {
      final ok = await _channel.invokeMethod<bool>('preview', {
        'label': label,
        'soundEnabled': soundEnabled,
      });
      return ok ?? false;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> openExactAlarmSettings() =>
      _open('openExactAlarmSettings');
  static Future<bool> openNotificationSettings() =>
      _open('openNotificationSettings');
  static Future<bool> openOverlaySettings() => _open('openOverlaySettings');
  static Future<bool> openFullScreenIntentSettings() =>
      _open('openFullScreenIntentSettings');

  static Future<bool> _open(String method) async {
    try {
      final res = await _channel.invokeMethod<Map<Object?, Object?>>(method);
      return res?['opened'] == true;
    } catch (_) {
      return false;
    }
  }

  // ── mutations (mirror the hook's enable / disable / update) ───────────────
  /// Android 13+ needs the runtime POST_NOTIFICATIONS grant before a bell can
  /// show anything; the Capacitor build asked for it, the Flutter port never
  /// did, so alarms fired silently on fresh installs.
  static Future<bool> ensureNotificationPermission() async {
    try {
      final status = await Permission.notification.status;
      if (status.isGranted) return true;
      if (status.isPermanentlyDenied) {
        await openNotificationSettings();
        return false;
      }
      final result = await Permission.notification.request();
      return result.isGranted;
    } catch (_) {
      return true;
    }
  }

  static Future<void> enable({
    List<PrayerTime>? times,
    bool? soundEnabled,
  }) async {
    await ensureNotificationPermission();
    final merged = load().copyWith(
      times: times,
      soundEnabled: soundEnabled,
      enabled: true,
    );
    await _save(merged);
    await _scheduleAll(merged);
    await refreshStatus();
  }

  static Future<void> disable() async {
    await _save(load().copyWith(enabled: false));
    await _cancelAll();
    await refreshStatus();
  }

  /// Retires the old ringing alarm: cancels any scheduled bells once.
  static Future<void> retire() async {
    if (_bootstrapped) return;
    _bootstrapped = true;
    if (Prefs.getString('prayer_alarm_retired_v1') == '1') return;
    try {
      await _save(load().copyWith(enabled: false));
      await _cancelAll();
    } catch (_) {}
    await Prefs.setString('prayer_alarm_retired_v1', '1');
  }

  static Future<void> update({
    List<PrayerTime>? times,
    bool? soundEnabled,
  }) async {
    final merged = load().copyWith(times: times, soundEnabled: soundEnabled);
    await _save(merged);
    if (merged.enabled) await _scheduleAll(merged);
    await refreshStatus();
  }

  /// Runs the web hook's two mount effects once per app session:
  /// status refresh, self-heal reschedule, and the one-shot 21:00 migration.
  static Future<void> bootstrap() async {
    if (_bootstrapped) return;
    _bootstrapped = true;
    final saved = load();
    if (!saved.soundEnabled) {
      final restored = saved.copyWith(soundEnabled: true);
      await _save(restored);
      if (restored.enabled) await _scheduleAll(restored);
    }
    await refreshStatus();

    final config = load();

    // One-shot native reschedule for the 18:00 → 21:00 evening bell.
    if (Prefs.getString(_migrationFlag) == null) {
      await Prefs.setString(_migrationFlag, '1');
      final hasEvening21 = config.times.any(
        (t) =>
            t.hour == 21 &&
            t.minute == 0 &&
            RegExp('evening', caseSensitive: false).hasMatch(t.label),
      );
      if (config.enabled && hasEvening21) await _scheduleAll(config);
    }

    await selfHeal();
  }

  /// JS config can say "enabled" while the native AlarmManager entries are gone
  /// (app update, force-stop recovery, failed schedule). Re-arm them silently.
  static Future<void> selfHeal() async {
    final config = load();
    final s = status;
    if (!config.enabled || s == null) return;
    final expected = config.times.length;
    if (expected == 0 || s.scheduledCount >= expected) return;
    final key = jsonEncode({
      'times': config.times.map((t) => t.toMap()).toList(),
      'sound': config.soundEnabled,
      'scheduled': s.scheduledCount,
    });
    if (_repairKey == key) return;
    _repairKey = key;
    await _scheduleAll(config);
    await refreshStatus();
  }
}

/// Port of `getNextPrayer()`.
({PrayerTime time, DateTime at})? getNextPrayer(
  List<PrayerTime> times, [
  DateTime? nowArg,
]) {
  if (times.isEmpty) return null;
  final now = nowArg ?? DateTime.now();
  final sorted = [...times]
    ..sort((a, b) => (a.hour * 60 + a.minute) - (b.hour * 60 + b.minute));
  for (final t in sorted) {
    final at = DateTime(now.year, now.month, now.day, t.hour, t.minute);
    if (at.isAfter(now)) return (time: t, at: at);
  }
  final first = sorted.first;
  final tomorrow = now.add(const Duration(days: 1));
  return (
    time: first,
    at: DateTime(
      tomorrow.year,
      tomorrow.month,
      tomorrow.day,
      first.hour,
      first.minute,
    ),
  );
}

/// Port of `formatCountdown()`.
String formatCountdown(DateTime at, [DateTime? nowArg]) {
  final now = nowArg ?? DateTime.now();
  final diff = at.difference(now);
  final ms = diff.inMilliseconds < 0 ? 0 : diff.inMilliseconds;
  final h = ms ~/ 3600000;
  final m = (ms % 3600000) ~/ 60000;
  if (h >= 1) return '${h}h ${m}m';
  return '${m}m';
}
