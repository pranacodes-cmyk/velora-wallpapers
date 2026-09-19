import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'prefs.dart';

/// 1:1 port of `src/hooks/useTodayTasks.ts` — the 3-step daily checklist
/// (Prayer · Reflection · Quiz), reading the exact same per-feature keys.
class TodayTasks {
  const TodayTasks({
    required this.prayer,
    required this.reflection,
    required this.quiz,
  });
  final bool prayer;
  final bool reflection;
  final bool quiz;

  int get doneCount => [prayer, reflection, quiz].where((e) => e).length;
  int get total => 3;
  bool get allDone => doneCount == 3;
}

class TodayTasksStore {
  TodayTasksStore._();

  static const _prayerKey = 'cw_prayers_unlocked'; // { date: "YYYY-MM-DD" }
  static const _reflectionKey = 'cw_reflection_done'; // "YYYY-MM-DD"
  static const _quizKey = 'cw_quiz_daily'; // "YYYY-MM-DD"

  /// Stands in for the web `cw_today_tasks_changed` window event.
  static final revision = ValueNotifier<int>(0);

  static String todayKey() {
    // UTC to match web `useTodayTasks.ts` day boundary.
    final d = DateTime.now().toUtc();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  static bool _prayerDone() {
    try {
      final raw = Prefs.getString(_prayerKey);
      if (raw == null) return false;
      final map = jsonDecode(raw) as Map<String, dynamic>;
      return map['date'] == todayKey();
    } catch (_) {
      return false;
    }
  }

  static TodayTasks read() => TodayTasks(
    prayer: _prayerDone(),
    reflection: Prefs.getString(_reflectionKey) == todayKey(),
    quiz: Prefs.getString(_quizKey) == todayKey(),
  );

  static Future<void> markReflectionDone() async {
    await Prefs.setString(_reflectionKey, todayKey());
    revision.value++;
  }

  static Future<void> markQuizDone() async {
    await Prefs.setString(_quizKey, todayKey());
    revision.value++;
  }

  static void refresh() => revision.value++;
}
