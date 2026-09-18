import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'prefs.dart';
import 'streak_store.dart';

/// Port of `src/hooks/useJourneyProgress.ts` (read + complete paths).
/// Same `cw_journey_progress` key and same `{ completedDays, startedAt,
/// lastCompletedAt }` shape per journey id.
class JourneyProgressStore {
  JourneyProgressStore._();

  static const _key = 'cw_journey_progress';
  static const dayLockHours = 20;
  static const freeJourneyDays = 5;

  static final revision = ValueNotifier<int>(0);

  static Map<String, dynamic> _load() {
    try {
      final raw = Prefs.getString(_key);
      if (raw == null) return {};
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  static List<int> completedDays(String journeyId) {
    final j = _load()[journeyId];
    if (j is! Map) return const [];
    final days = j['completedDays'];
    if (days is! List) return const [];
    return days.map((e) => (e as num).toInt()).toList()..sort();
  }

  static Future<void> completeDay(String journeyId, int day) async {
    final all = _load();
    final existing = all[journeyId] as Map<String, dynamic>?;
    final days = <int>{
      ...((existing?['completedDays'] as List?)?.map(
            (e) => (e as num).toInt(),
          ) ??
          const <int>[]),
      day,
    }.toList()..sort();
    all[journeyId] = {
      'completedDays': days,
      'startedAt': existing?['startedAt'] ?? DateTime.now().toIso8601String(),
      'lastCompletedAt': DateTime.now().toIso8601String(),
    };
    await Prefs.setString(_key, jsonEncode(all));
    revision.value++;
    await StreakStore.bumpIfNewDay();
  }

  static bool isPremiumJourneyDay(int day, bool isPremium) =>
      isPremium ? false : day > freeJourneyDays;

  /// When can [day] be opened? Mirrors `getDayUnlockAt` in
  /// `src/hooks/useJourneyProgress.ts`: null when already accessible,
  /// otherwise the ms timestamp when the day-lock timer ends.
  static int? getDayUnlockAt(String journeyId, int day) {
    if (day <= 1) return null;
    final j = _load()[journeyId];
    if (j is! Map) return null;
    final completed = completedDays(journeyId);
    if (completed.contains(day)) return null;
    if (!completed.contains(day - 1)) return null;
    final lastCompletedAt = j['lastCompletedAt'] as String?;
    if (lastCompletedAt == null) return null;
    final unlockAt =
        DateTime.parse(lastCompletedAt).millisecondsSinceEpoch +
        dayLockHours * 3600000;
    return unlockAt > DateTime.now().millisecondsSinceEpoch ? unlockAt : null;
  }

  /// Same permanent `false` as web: no rewarded ad can skip the daily wait.
  static bool requiresAdUnlock(String journeyId, int day, bool isPremium) =>
      false;

  /// Kept for parity with `unlockDay` in the web hook — unreachable in
  /// practice since [requiresAdUnlock] never returns true, but preserved so
  /// the ad-unlock code path still compiles and behaves the same.
  static Future<void> unlockDay(String journeyId, int day) async {}
}
