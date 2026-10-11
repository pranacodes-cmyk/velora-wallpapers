import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import '../localization/app_localizations.dart';
import 'prefs.dart';
import 'streak_store.dart';

/// Quiet daily prayer reminder — ON by default, separate from the user-set
/// Prayer Alarm. Silent paper-art card on the lock screen at 07:00 and 21:00.
/// Web mirror: `src/services/daily-reminder.ts`.
class DailyReminder {
  DailyReminder._();

  static const _key = 'prayly_daily_reminder_v1';
  static const _channel = MethodChannel(
    'com.jesuswallpaperbible.app/prayer_alarm',
  );
  static final revision = ValueNotifier<int>(0);

  static const _times = [
    {'hour': 7, 'minute': 0, 'slot': 'morning'},
    {'hour': 21, 'minute': 0, 'slot': 'night'},
  ];

  /// Onboarding "Daily Rhythm" choice: morning | evening | both.
  static const slotsKey = 'prayly_daily_reminder_slots_v1';
  static String get slots => Prefs.getString(slotsKey) ?? 'both';

  static Future<void> setSlots(String value) async {
    await Prefs.setString(slotsKey, value);
    await Prefs.setString('cw_user_time', value);
    await Prefs.setBool(_key, true);
    revision.value++;
    await sync();
  }

  static List<Map<String, Object>> get _activeTimes => switch (slots) {
        'morning' => [_times[0]],
        'evening' => [_times[1]],
        _ => _times,
      };

  static bool get enabled => Prefs.getBool(_key, fallback: true);

  static Future<void> setEnabled(bool on) async {
    await Prefs.setBool(_key, on);
    revision.value++;
    await sync();
  }

  /// Push current state + streak to native and re-arm the two reminders.
  static bool _streakListening = false;

  static const _verseKeys = [
    'ps.pause2',
    'ps.pause6',
    'ps.pause9',
    'reminder.verse.cast',
    'ps.pause35',
    'reminder.verse.ceasing',
    'ps.pause4',
    'ps.pause12',
    'ps.pause40',
    'ps.pause24',
    'ps.pause34',
    'ps.pause20',
  ];

  static Map<String, Object> _localizedCopy() => {
        'notification.morningTitle': t('reminder.notification.morningTitle'),
        'notification.nightTitle': t('reminder.notification.nightTitle'),
        'notification.body': t('reminder.notification.body'),
        'channel.name': t('reminder.channel.name'),
        'channel.desc': t('reminder.channel.desc'),
        for (var i = 1; i <= 3; i++)
          'morning.$i': t('reminder.morning.$i'),
        for (var i = 1; i <= 3; i++) 'night.$i': t('reminder.night.$i'),
        'action.prayNow': t('reminder.action.prayNow'),
        'action.notNow': t('reminder.action.notNow'),
        'streak.start': t('reminder.streak.start'),
        'streak.count': t('reminder.streak.count'),
        for (var i = 0; i < _verseKeys.length; i++) ...{
          'verse.$i.text': t('${_verseKeys[i]}.verse'),
          'verse.$i.ref': t('${_verseKeys[i]}.ref'),
        },
        'verse.count': _verseKeys.length,
      };

  static Future<void> sync() async {
    if (kIsWeb) return;
    if (!_streakListening) {
      _streakListening = true;
      StreakStore.revision.addListener(syncStreak);
    }
    try {
      await _channel.invokeMethod('dailyReminderSync', {
        'enabled': enabled,
        'times': jsonEncode(_activeTimes),
        'streak': StreakStore.load().current,
        'copy': jsonEncode(_localizedCopy()),
      });
    } catch (_) {
      /* older native build — ignore */
    }
    await syncStreak();
  }

  /// Streak + last prayed day → native, so both lock-screen alarms (daily
  /// reminder + prayer alarm) show the live count, 0 if the streak broke.
  static Future<void> syncStreak() async {
    if (kIsWeb) return;
    final s = StreakStore.load();
    try {
      await _channel.invokeMethod('streakSync', {
        'streak': s.current,
        'lastDate': s.lastDate,
      });
    } catch (_) {}
  }

  static Future<void> preview({bool night = false}) async {
    if (kIsWeb) return;
    try {
      await _channel.invokeMethod('dailyReminderPreview', {
        'slot': night ? 'night' : 'morning',
      });
    } catch (_) {}
  }

  /// Route handed over by the reminder/alarm "Pray now" tap ("open_route"
  /// intent extra, stashed by MainActivity). Returns null when nothing is
  /// pending. Same pattern as PrayScreenService.consumeSacredPauseLaunch.
  static Future<String?> consumeOpenRoute() async {
    if (kIsWeb) return null;
    try {
      final route = await _channel.invokeMethod<String>('consumeOpenRoute');
      return (route == null || route.isEmpty) ? null : route;
    } catch (_) {
      return null;
    }
  }
}
