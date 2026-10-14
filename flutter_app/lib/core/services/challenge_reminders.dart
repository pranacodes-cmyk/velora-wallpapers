import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:permission_handler/permission_handler.dart';

import '../localization/app_localizations.dart';
import 'challenge_data.dart';
import 'challenge_store.dart';

/// 75 Days of Light reminders. Web mirror: `src/services/challengeReminders.ts`.
/// State-aware: evening (19:30) and night (21:30) reminders are only armed
/// for days that are not lit yet. Re-synced on every challenge change.
class ChallengeReminderService {
  ChallengeReminderService._();

  static const _channel = MethodChannel('com.jesuswallpaperbible.app/prayer_alarm');
  static const _daysAhead = 3;

  static Future<bool> requestPermission() async {
    if (kIsWeb) return false;
    try {
      final status = await Permission.notification.request();
      return status.isGranted;
    } catch (_) {
      return false;
    }
  }

  static DateTime _at(String date, int h, int m) {
    final p = date.split('-').map(int.parse).toList();
    return DateTime(p[0], p[1], p[2], h, m);
  }

  static Future<void> sync([ChallengeState? stateArg]) async {
    if (kIsWeb) return;
    final s = stateArg ?? ChallengeStore.state;
    final items = <Map<String, Object>>[];
    if (s.status == 'active' && s.reminders.enabled) {
      final today = ChallengeStore.localDate();
      final lit = ChallengeStore.litToday(s, today);
      final pending = lit ? ChallengeStore.currentDay(s, today) + 1 : ChallengeStore.currentDay(s, today);
      final left = 4 - ChallengeStore.tasksDoneToday(s, today).length;
      final parts = s.reminders.morning.split(':');
      final mh = int.tryParse(parts.first) ?? 7;
      final mm = parts.length > 1 ? int.tryParse(parts[1]) ?? 0 : 0;
      final now = DateTime.now();

      for (var i = 0; i < _daysAhead; i++) {
        final date = ChallengeStore.addDays(today, i);
        final day = i == 0 ? pending : pending + (lit ? i - 1 : 0);
        if (day > kChallengeDays) break;
        final morning = _at(date, mh, mm);
        if (morning.isAfter(now) && !(i == 0 && lit)) {
          items.add({
            'at': morning.millisecondsSinceEpoch,
            'title': t('ch.notif.morning.title', {'day': day}),
            'body': t('ch.notif.morning.body', {'title': challengeDay(day).title}),
            'route': '/challenge',
          });
        }
        if (!s.reminders.evening || (i == 0 && lit)) continue;
        final evening = _at(date, 19, 30);
        if (evening.isAfter(now)) {
          items.add({
            'at': evening.millisecondsSinceEpoch,
            'title': t('ch.notif.evening.title'),
            'body': t('ch.notif.evening.body', {'left': i == 0 ? left : 4, 'day': day}),
            'route': '/challenge/day',
          });
        }
        final night = _at(date, 21, 30);
        if (night.isAfter(now)) {
          items.add({
            'at': night.millisecondsSinceEpoch,
            'title': t('ch.notif.night.title'),
            'body': s.mode == 'covenant'
                ? t('ch.notif.night.covenant', {'day': day})
                : t('ch.notif.night.body', {'day': day}),
            'route': '/challenge/day',
          });
        }
      }
    }
    try {
      await _channel.invokeMethod('challengeReminderSync', {
        'items': jsonEncode(items),
        'channel': jsonEncode({'name': t('ch.name'), 'desc': t('ch.intro.reminderSub')}),
      });
    } catch (_) {
      /* older native build — ignore */
    }
  }
}
