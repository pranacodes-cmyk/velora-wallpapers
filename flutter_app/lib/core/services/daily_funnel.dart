import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'prefs.dart';

/// 1:1 port of `src/lib/dailyFunnel.ts`.
///
/// Web splits this between localStorage (perfect streak, complete-ack) and
/// sessionStorage (handoff, exit count, prayer-viewed). Session storage lives
/// only for one app run, so the session half is held in memory here.
class DailyFunnel {
  DailyFunnel._();

  static const _perfectStreakKey = 'cw_perfect_streak';
  static const _completeAckKey = 'cw_funnel_complete_ack';

  /// Stands in for the web `cw_funnel_changed` window event.
  static final revision = ValueNotifier<int>(0);

  // ---- session-scoped state (web sessionStorage) ----
  static String? _handoffStep;
  static String? _handoffDate;
  static String? _exitDate;
  static int _exitCount = 0;
  static int _prayerViewedMs = 0;

  static String _today() {
    final d = DateTime.now();
    return '${d.year.toString().padLeft(4, '0')}-${d.month.toString().padLeft(2, '0')}-${d.day.toString().padLeft(2, '0')}';
  }

  /* ---------- Complete acknowledgement ---------- */

  static bool isCompleteAcknowledgedToday() =>
      Prefs.getString(_completeAckKey) == _today();

  static Future<void> ackCompleteToday() async {
    await Prefs.setString(_completeAckKey, _today());
    revision.value++;
  }

  /* ---------- Handoff ---------- */

  static void setHandoff(HandoffStep step) {
    _handoffStep = step.name;
    _handoffDate = _today();
    revision.value++;
  }

  static HandoffStep? getHandoff() {
    if (_handoffStep == null || _handoffDate != _today()) return null;
    return HandoffStep.values.firstWhere(
      (s) => s.name == _handoffStep,
      orElse: () => HandoffStep.complete,
    );
  }

  static void clearHandoff() {
    _handoffStep = null;
    revision.value++;
  }

  /* ---------- Prayer engagement ---------- */

  static void markPrayerViewed() =>
      _prayerViewedMs = DateTime.now().millisecondsSinceEpoch;

  static int get prayerViewedMs => _prayerViewedMs;

  /* ---------- Exit rescue ---------- */

  static int readExitCount() => _exitDate == _today() ? _exitCount : 0;

  static int bumpExitCount() {
    final next = readExitCount() + 1;
    _exitDate = _today();
    _exitCount = next;
    return next;
  }

  /* ---------- Perfect streak (gated on all 3 done) ---------- */

  static PerfectStreak _loadPerfect() {
    try {
      final raw = Prefs.getString(_perfectStreakKey);
      if (raw != null) {
        final m = jsonDecode(raw) as Map<String, dynamic>;
        return PerfectStreak(
          current: (m['current'] as num?)?.toInt() ?? 0,
          longest: (m['longest'] as num?)?.toInt() ?? 0,
          lastDate: (m['lastDate'] as String?) ?? '',
        );
      }
    } catch (_) {}
    return const PerfectStreak(current: 0, longest: 0, lastDate: '');
  }

  static Future<PerfectStreak> bumpPerfectStreak() async {
    final data = _loadPerfect();
    final t = _today();
    if (data.lastDate == t) return data;
    final y = DateTime.now().subtract(const Duration(days: 1));
    final yStr =
        '${y.year.toString().padLeft(4, '0')}-${y.month.toString().padLeft(2, '0')}-${y.day.toString().padLeft(2, '0')}';
    final consecutive = data.lastDate == yStr;
    final nextCurrent = consecutive ? data.current + 1 : 1;
    final next = PerfectStreak(
      current: nextCurrent,
      longest: data.longest > nextCurrent ? data.longest : nextCurrent,
      lastDate: t,
    );
    await Prefs.setString(
      _perfectStreakKey,
      jsonEncode({
        'current': next.current,
        'longest': next.longest,
        'lastDate': next.lastDate,
      }),
    );
    revision.value++;
    return next;
  }

  static PerfectStreak getPerfectStreak() => _loadPerfect();

  static bool isPerfectToday() => _loadPerfect().lastDate == _today();

  /* ---------- Cross-component open-reflection bridge ---------- */

  /// Web dispatches `cw_funnel_open_reflection`; here Today listens on this
  /// notifier, and Devotional's "Continue" raises it (same as the web
  /// `cw_open_reflection_now` session flag + event pair).
  static final openReflection = ValueNotifier<int>(0);

  static void requestOpenReflection() => openReflection.value++;

  /// Direct-open bridge for prayer "Continue" -> quiz (web: `navigate("/quiz?auto=daily")`).
  static final autoStartQuiz = ValueNotifier<int>(0);

  static void requestAutoStartQuiz() => autoStartQuiz.value++;

  /* ---------- auto-open silencing (back-button loop guard) ---------- */

  static int _silenceUntilMs = 0;

  /// After a silent BACK exit out of a funnel screen, nothing may auto-open
  /// for a short beat. Without this the prayer screen's pop instantly
  /// re-triggered the reflection sheet, trapping the user in a
  /// prayer -> reflection -> prayer back loop on device.
  static void silenceAutoOpens([int ms = 2000]) {
    _silenceUntilMs = DateTime.now().millisecondsSinceEpoch + ms;
    _handoffStep = null;
    // Re-baseline the bridges so a stale bump cannot fire after the exit.
    openReflection.value = openReflection.value;
    revision.value++;
  }

  static bool get autoOpensSilenced =>
      DateTime.now().millisecondsSinceEpoch < _silenceUntilMs;
}

enum HandoffStep { reflection, quiz, complete }

class PerfectStreak {
  const PerfectStreak({
    required this.current,
    required this.longest,
    required this.lastDate,
  });
  final int current;
  final int longest;
  final String lastDate;
}
