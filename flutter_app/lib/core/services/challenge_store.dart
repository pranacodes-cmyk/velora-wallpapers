import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import 'challenge_data.dart';
import 'prefs.dart';

/// 75 Days of Light — local challenge state machine.
/// Web mirror: `src/services/challenge.ts` (same storage key + JSON shape).
///
/// • One day can be lit per calendar day; it lights when all four practices
///   are done (the chapter reading is compulsory).
/// • Progress counts completed days, never calendar days.
/// • Grace path (default): a missed day spends grace oil to keep the streak;
///   without oil the streak resets but progress stays.
/// • Covenant path: a missed day relights the challenge from Day 1.
/// • Every 7-day streak earns a jar of oil. Free keeps 1, Pro keeps 3.
const kChallengeKey = 'prayly_challenge_v1';
const kChallengeJournalKey = 'prayly_challenge_journal_v1';

class ChallengeNotice {
  const ChallengeNotice(this.type, this.value);

  /// grace_used | streak_reset | restarted
  final String type;
  final int value;

  Map<String, Object> toJson() => switch (type) {
        'grace_used' => {'type': type, 'days': value},
        'streak_reset' => {'type': type, 'missed': value},
        _ => {'type': type, 'reached': value},
      };

  static ChallengeNotice? fromJson(Object? raw) {
    if (raw is! Map) return null;
    final type = raw['type'];
    if (type is! String) return null;
    final v = raw['days'] ?? raw['missed'] ?? raw['reached'] ?? 0;
    return ChallengeNotice(type, v is num ? v.toInt() : 0);
  }
}

class ChallengeReminders {
  const ChallengeReminders({this.enabled = true, this.morning = '07:00', this.evening = true});
  final bool enabled;
  final String morning;
  final bool evening;

  ChallengeReminders copyWith({bool? enabled, String? morning, bool? evening}) => ChallengeReminders(
        enabled: enabled ?? this.enabled,
        morning: morning ?? this.morning,
        evening: evening ?? this.evening,
      );

  Map<String, Object> toJson() => {'enabled': enabled, 'morning': morning, 'evening': evening};
}

class ChallengeToday {
  const ChallengeToday(this.date, this.day, this.done);
  final String date;
  final int day;
  final List<String> done;
  Map<String, Object> toJson() => {'date': date, 'day': day, 'done': done};
}

class ChallengeState {
  const ChallengeState({
    this.status = 'idle',
    this.mode = 'grace',
    this.startedOn,
    this.attempts = 1,
    this.completed = const {},
    this.today,
    this.lastLitOn,
    this.coveredThrough,
    this.streak = 0,
    this.bestStreak = 0,
    this.graces = 1,
    this.lastCheckOn,
    this.finishedOn,
    this.notice,
    this.reminders = const ChallengeReminders(),
  });

  final String status; // idle | active | finished
  final String mode; // grace | covenant
  final String? startedOn;
  final int attempts;
  final Map<String, String> completed;
  final ChallengeToday? today;
  final String? lastLitOn;
  final String? coveredThrough;
  final int streak;
  final int bestStreak;
  final int graces;
  final String? lastCheckOn;
  final String? finishedOn;
  final ChallengeNotice? notice;
  final ChallengeReminders reminders;

  static const _unset = Object();

  ChallengeState copyWith({
    String? status,
    String? mode,
    Object? startedOn = _unset,
    int? attempts,
    Map<String, String>? completed,
    Object? today = _unset,
    Object? lastLitOn = _unset,
    Object? coveredThrough = _unset,
    int? streak,
    int? bestStreak,
    int? graces,
    Object? lastCheckOn = _unset,
    Object? finishedOn = _unset,
    Object? notice = _unset,
    ChallengeReminders? reminders,
  }) =>
      ChallengeState(
        status: status ?? this.status,
        mode: mode ?? this.mode,
        startedOn: identical(startedOn, _unset) ? this.startedOn : startedOn as String?,
        attempts: attempts ?? this.attempts,
        completed: completed ?? this.completed,
        today: identical(today, _unset) ? this.today : today as ChallengeToday?,
        lastLitOn: identical(lastLitOn, _unset) ? this.lastLitOn : lastLitOn as String?,
        coveredThrough: identical(coveredThrough, _unset) ? this.coveredThrough : coveredThrough as String?,
        streak: streak ?? this.streak,
        bestStreak: bestStreak ?? this.bestStreak,
        graces: graces ?? this.graces,
        lastCheckOn: identical(lastCheckOn, _unset) ? this.lastCheckOn : lastCheckOn as String?,
        finishedOn: identical(finishedOn, _unset) ? this.finishedOn : finishedOn as String?,
        notice: identical(notice, _unset) ? this.notice : notice as ChallengeNotice?,
        reminders: reminders ?? this.reminders,
      );

  Map<String, Object?> toJson() => {
        'v': 1,
        'status': status,
        'mode': mode,
        'startedOn': startedOn,
        'attempts': attempts,
        'completed': completed,
        'today': today?.toJson(),
        'lastLitOn': lastLitOn,
        'coveredThrough': coveredThrough,
        'streak': streak,
        'bestStreak': bestStreak,
        'graces': graces,
        'lastCheckOn': lastCheckOn,
        'finishedOn': finishedOn,
        'notice': notice?.toJson(),
        'reminders': reminders.toJson(),
      };

  static ChallengeState fromJson(Map<String, dynamic> j) {
    int i(Object? v, int f) => v is num ? v.toInt() : f;
    String? s(Object? v) => v is String && v.isNotEmpty ? v : null;
    final completed = <String, String>{};
    final rawC = j['completed'];
    if (rawC is Map) {
      rawC.forEach((k, v) {
        if (v is String) completed['$k'] = v;
      });
    }
    ChallengeToday? today;
    final rawT = j['today'];
    if (rawT is Map && rawT['date'] is String) {
      final done = (rawT['done'] is List)
          ? (rawT['done'] as List).whereType<String>().where(kTaskIds.contains).toList()
          : <String>[];
      today = ChallengeToday(rawT['date'] as String, i(rawT['day'], 1), done);
    }
    final rawR = j['reminders'];
    final reminders = rawR is Map
        ? ChallengeReminders(
            enabled: rawR['enabled'] is bool ? rawR['enabled'] as bool : true,
            morning: rawR['morning'] is String ? rawR['morning'] as String : '07:00',
            evening: rawR['evening'] is bool ? rawR['evening'] as bool : true,
          )
        : const ChallengeReminders();
    final status = j['status'];
    return ChallengeState(
      status: status == 'active' || status == 'finished' ? status as String : 'idle',
      mode: j['mode'] == 'covenant' ? 'covenant' : 'grace',
      startedOn: s(j['startedOn']),
      attempts: i(j['attempts'], 1),
      completed: completed,
      today: today,
      lastLitOn: s(j['lastLitOn']),
      coveredThrough: s(j['coveredThrough']),
      streak: i(j['streak'], 0),
      bestStreak: i(j['bestStreak'], 0),
      graces: i(j['graces'], 1),
      lastCheckOn: s(j['lastCheckOn']),
      finishedOn: s(j['finishedOn']),
      notice: ChallengeNotice.fromJson(j['notice']),
      reminders: reminders,
    );
  }
}

class CompletionResult {
  const CompletionResult({
    required this.lit,
    required this.day,
    required this.streak,
    this.graceEarned = false,
    this.islandReached = false,
    this.finished = false,
  });
  final bool lit;
  final int day;
  final int streak;
  final bool graceEarned;
  /// The ship reached a new island (every 15 days, before the cross).
  final bool islandReached;
  final bool finished;
}

/// Derived snapshot every screen renders from.
class ChallengeView {
  const ChallengeView({
    required this.state,
    required this.today,
    required this.day,
    required this.completed,
    required this.lit,
    required this.done,
    required this.streak,
  });
  final ChallengeState state;
  final String today;
  final int day;
  final int completed;
  final bool lit;
  final List<String> done;
  final int streak;

  bool get idle => state.status == 'idle';
  bool get finished => state.status == 'finished';
}

class ChallengeStore {
  ChallengeStore._();

  /// Bumps on every write so widgets can rebuild (ValueListenableBuilder).
  static final revision = ValueNotifier<int>(0);
  static ChallengeState? _cache;

  /* ── dates (user's local calendar) ──────────────────────────────────── */

  static String localDate([DateTime? d]) {
    final x = d ?? DateTime.now();
    return '${x.year.toString().padLeft(4, '0')}-${x.month.toString().padLeft(2, '0')}-${x.day.toString().padLeft(2, '0')}';
  }

  static DateTime _utc(String date) {
    final p = date.split('-').map(int.parse).toList();
    return DateTime.utc(p[0], p[1], p[2]);
  }

  static int daysBetween(String from, String to) =>
      (_utc(to).difference(_utc(from)).inHours / 24).round();

  static String addDays(String date, int days) =>
      localDate(_utc(date).add(Duration(days: days)));

  static Duration untilMidnight([DateTime? now]) {
    final n = now ?? DateTime.now();
    return DateTime(n.year, n.month, n.day + 1).difference(n);
  }

  /* ── storage ─────────────────────────────────────────────────────────── */

  static ChallengeState _read() {
    final raw = Prefs.getString(kChallengeKey);
    if (raw == null || raw.isEmpty) return const ChallengeState();
    try {
      return ChallengeState.fromJson(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return const ChallengeState();
    }
  }

  static ChallengeState get state => _cache ??= _read();

  /// Re-read from storage (after "Delete my data" or an external write).
  static void reload() {
    _cache = _read();
    revision.value++;
  }

  static void _write(ChallengeState next) {
    _cache = next;
    Prefs.setString(kChallengeKey, jsonEncode(next.toJson()));
    revision.value++;
  }

  /* ── derived values ──────────────────────────────────────────────────── */

  static int completedCount(ChallengeState s) => s.completed.length;

  static bool litToday(ChallengeState s, [String? today]) =>
      s.lastLitOn == (today ?? localDate());

  static int currentDay(ChallengeState s, [String? today]) {
    final t = today ?? localDate();
    final done = completedCount(s);
    if (s.status == 'finished') return kChallengeDays;
    if (litToday(s, t)) return math.max(1, done);
    return math.min(kChallengeDays, done + 1);
  }

  static List<String> tasksDoneToday(ChallengeState s, [String? today]) {
    final t = today ?? localDate();
    if (litToday(s, t)) {
      // Reflection is optional — only show what was actually completed.
      final td = s.today;
      return td != null && td.date == t ? List.of(td.done) : List.of(kRequiredTasks);
    }
    final td = s.today;
    return td != null && td.date == t ? td.done : const [];
  }

  static int graceCap(bool isPremium) => isPremium ? 3 : 1;

  static String? _latest(String? a, String? b) {
    if (a == null) return b;
    if (b == null) return a;
    return a.compareTo(b) > 0 ? a : b;
  }

  static int liveStreak(ChallengeState s, [String? today]) {
    final anchor = _latest(s.lastLitOn, s.coveredThrough);
    if (anchor == null) return 0;
    return daysBetween(anchor, today ?? localDate()) <= 1 ? s.streak : 0;
  }

  static ChallengeView view([ChallengeState? s]) {
    final st = s ?? state;
    final today = localDate();
    final completed = completedCount(st);
    return ChallengeView(
      state: st,
      today: today,
      day: currentDay(st, today),
      completed: completed,
      lit: litToday(st, today),
      done: tasksDoneToday(st, today),
      streak: liveStreak(st, today),
    );
  }

  /* ── actions ─────────────────────────────────────────────────────────── */

  static void start(String mode) {
    final today = localDate();
    final prev = state;
    _write(ChallengeState(
      status: 'active',
      mode: mode,
      startedOn: today,
      attempts: prev.status == 'idle' ? prev.attempts : prev.attempts + 1,
      bestStreak: prev.bestStreak,
      lastCheckOn: today,
      reminders: const ChallengeReminders(enabled: true, morning: '07:00', evening: true),
    ));
  }

  static void setMode(String mode) => _write(state.copyWith(mode: mode));

  static void setReminders({bool? enabled, String? morning, bool? evening}) =>
      _write(state.copyWith(reminders: state.reminders.copyWith(enabled: enabled, morning: morning, evening: evening)));

  static void clearNotice() {
    if (state.notice != null) _write(state.copyWith(notice: null));
  }

  /// Apply missed-day rules once per calendar day. Safe on every open/resume.
  static void evaluate([String? todayArg]) {
    final today = todayArg ?? localDate();
    final s = state;
    if (s.status != 'active' || s.lastCheckOn == today) return;
    final anchor = _latest(s.lastLitOn, s.coveredThrough);
    var next = s.copyWith(lastCheckOn: today);
    if (anchor != null) {
      final missed = daysBetween(anchor, today) - 1;
      if (missed > 0) {
        if (s.mode == 'covenant') {
          _write(ChallengeState(
            status: 'active',
            mode: 'covenant',
            startedOn: today,
            attempts: s.attempts + 1,
            bestStreak: s.bestStreak,
            graces: 0,
            lastCheckOn: today,
            reminders: s.reminders,
            notice: ChallengeNotice('restarted', completedCount(s)),
          ));
          return;
        }
        if (s.graces >= missed && s.streak > 0) {
          next = next.copyWith(
            graces: s.graces - missed,
            coveredThrough: addDays(today, -1),
            notice: ChallengeNotice('grace_used', missed),
          );
        } else if (s.streak > 0) {
          next = next.copyWith(streak: 0, notice: ChallengeNotice('streak_reset', missed));
        }
      }
    }
    if (next.today != null && next.today!.date != today) next = next.copyWith(today: null);
    _write(next);
  }

  /// Mark a practice done for today. Lights the day when read, pray and live
  /// it are done — reflection is optional and can also be recorded after the
  /// day lit.
  static CompletionResult completeTask(String task, bool isPremium) {
    final today = localDate();
    final s = state;
    final day = currentDay(s, today);
    final empty = CompletionResult(lit: false, day: day, streak: liveStreak(s, today));
    if (s.status != 'active') return empty;
    if (litToday(s, today)) {
      if (task != 'reflect') return empty;
      final td = s.today;
      if (td == null || td.date != today || td.done.contains(task)) return empty;
      _write(s.copyWith(today: ChallengeToday(td.date, td.day, [...td.done, task])));
      return empty;
    }

    final done = <String>{...(s.today != null && s.today!.date == today ? s.today!.done : const <String>[]), task};
    final ordered = kTaskIds.where(done.contains).toList();
    final nextToday = ChallengeToday(today, day, ordered);

    if (!kRequiredTasks.every(done.contains)) {
      _write(s.copyWith(today: nextToday));
      return empty;
    }

    final anchor = _latest(s.lastLitOn, s.coveredThrough);
    final streak = anchor != null && daysBetween(anchor, today) == 1 ? s.streak + 1 : 1;
    final before = completedCount(s);
    final completed = {...s.completed, '$day': today};
    final after = completed.length;
    final graceEarned = streak > 0 && streak % 7 == 0 && s.graces < graceCap(isPremium);
    final finished = after >= kChallengeDays;
    _write(s.copyWith(
      status: finished ? 'finished' : 'active',
      finishedOn: finished ? today : s.finishedOn,
      completed: completed,
      today: nextToday,
      lastLitOn: today,
      streak: streak,
      bestStreak: math.max(s.bestStreak, streak),
      graces: graceEarned ? s.graces + 1 : s.graces,
      notice: null,
    ));
    return CompletionResult(
      lit: true,
      day: day,
      streak: streak,
      graceEarned: graceEarned,
      islandReached: after ~/ 15 > before ~/ 15 && after < kChallengeDays,
      finished: finished,
    );
  }

  static void undoTask(String task) {
    final today = localDate();
    final s = state;
    final td = s.today;
    if (litToday(s, today) || td == null || td.date != today) return;
    _write(s.copyWith(today: ChallengeToday(td.date, td.day, td.done.where((t) => t != task).toList())));
  }

  static void reset() {
    final s = state;
    _write(ChallengeState(attempts: s.attempts, bestStreak: s.bestStreak));
  }

  /* ── private journal (never leaves the device) ──────────────────────── */

  static Map<String, String> readJournal() {
    try {
      final raw = Prefs.getString(kChallengeJournalKey);
      if (raw == null) return {};
      final m = jsonDecode(raw);
      if (m is! Map) return {};
      return m.map((k, v) => MapEntry('$k', '$v'));
    } catch (_) {
      return {};
    }
  }

  static void saveJournal(int day, String text) {
    final all = readJournal();
    all['$day'] = text.length > 600 ? text.substring(0, 600) : text;
    Prefs.setString(kChallengeJournalKey, jsonEncode(all));
  }
}
