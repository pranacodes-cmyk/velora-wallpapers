import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'analytics.dart';
import 'prefs.dart';
import 'app_log.dart';

/// 1:1 port of `src/hooks/useStreak.ts`.
/// Same localStorage key (`cw_streak`) and same `{current, longest, lastDate}`
/// JSON shape, so an existing install keeps its streak.
class StreakData {
  const StreakData({
    required this.current,
    required this.longest,
    required this.lastDate,
  });
  final int current;
  final int longest;
  final String lastDate;

  static const empty = StreakData(current: 0, longest: 0, lastDate: '');
}

class StreakStore {
  StreakStore._();

  static const _key = 'cw_streak';

  /// Notifies listeners in place of the web `cw_streak_changed` window event.
  static final revision = ValueNotifier<int>(0);

  static String _today() => _dayKey(DateTime.now());

  static String _dayKey(DateTime d) =>
      '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';

  static StreakData load() {
    try {
      final raw = Prefs.getString(_key);
      if (raw == null) return StreakData.empty;
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return StreakData(
        current: (map['current'] as num?)?.toInt() ?? 0,
        longest: (map['longest'] as num?)?.toInt() ?? 0,
        lastDate: map['lastDate'] as String? ?? '',
      );
    } catch (e) {
      AppLog.error('streak_store.read', e);
      return StreakData.empty;
    }
  }

  static Future<void> _save(StreakData data) async {
    await Prefs.setString(
      _key,
      jsonEncode({
        'current': data.current,
        'longest': data.longest,
        'lastDate': data.lastDate,
      }),
    );
    revision.value++;
  }

  /// Idempotent — bumps at most once per calendar day.
  static Future<StreakData> bumpIfNewDay() async {
    final data = load();
    final today = _today();
    if (data.lastDate == today) return data;

    final yesterday = _dayKey(DateTime.now().subtract(const Duration(days: 1)));
    final isConsecutive = data.lastDate == yesterday;
    final next = StreakData(
      current: isConsecutive ? data.current + 1 : 1,
      longest: data.longest > (isConsecutive ? data.current + 1 : 1)
          ? data.longest
          : (isConsecutive ? data.current + 1 : 1),
      lastDate: today,
    );
    await _save(next);
    Analytics.capture(
      isConsecutive
          ? 'streak_extended'
          : (data.lastDate.isNotEmpty ? 'streak_broken' : 'streak_started'),
      {
        'current': next.current,
        'longest': next.longest,
        'previous_last_date': data.lastDate,
      },
    );
    return next;
  }
}
