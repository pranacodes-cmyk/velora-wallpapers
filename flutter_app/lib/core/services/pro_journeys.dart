import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../localization/app_localizations.dart';
import 'challenge_store.dart';
import 'prefs.dart';
import 'pro_journey_study.dart';

/// Pro Journeys — four guided premium journeys beside 75 Days of Light.
///
/// Every day has three beats: Word (a New Testament passage from the bundled
/// Bible of the active language + a short insight), Practice (an interaction
/// unique to the journey) and Mission (one practical real-life step). Each
/// journey moves one day per calendar day; every day (including Day 1) needs
/// days need Pro (gated in the UI — progress is never deleted if Pro lapses).
///
/// Web mirrors: `src/data/proJourneys.ts` + `src/services/proJourneys.ts`
/// (same storage key and JSON shape, so data is portable between builds).
const kProJourneysKey = 'prayly_pro_journeys_v1';
const kProJourneyFreeDays = 0;
const kPrayerListMax = 20;
const kJourneySteps = <String>['word', 'practice', 'mission'];

/// The interaction used in the Practice beat.
enum PracticeKind { declare, breathe, battle, intercede }

/// Canonical (0-based Protestant) book index, chapter, inclusive verse range.
class Passage {
  const Passage(this.book, this.chapter, this.from, [int? to]) : to = to ?? from;
  final int book;
  final int chapter;
  final int from;
  final int to;
}

class ProJourneyDef {
  const ProJourneyDef({
    required this.id,
    required this.days,
    required this.emoji,
    required this.practice,
    required this.passages,
    required this.missionEmoji,
  });
  final String id;
  final int days;
  final String emoji;
  final PracticeKind practice;
  final List<Passage> passages;
  final List<String> missionEmoji;

  String get cover => 'assets/images/projourney/$id.webp';
}

class _B {
  static const matt = 39, mark = 40, luke = 41, john = 42, rom = 44, cor1 = 45, cor2 = 46, gal = 47;
  static const eph = 48, phil = 49, col = 50, thes1 = 51, tim1 = 53, tim2 = 54, titus = 55, heb = 57;
  static const jas = 58, pet1 = 59, pet2 = 60, john1 = 61, john3 = 63;
}

/// Definition order = display order on the Journey tab.
const List<ProJourneyDef> kProJourneys = [
  ProJourneyDef(
    id: 'identity', days: 7, emoji: '👑', practice: PracticeKind.declare,
    passages: [
      Passage(_B.eph, 2, 10), Passage(_B.john1, 3, 1), Passage(_B.rom, 8, 1), Passage(_B.pet1, 2, 9),
      Passage(_B.cor2, 5, 17), Passage(_B.tim2, 1, 7), Passage(_B.matt, 5, 14, 16),
    ],
    missionEmoji: ['🪞', '🎨', '✍️', '🤝', '🧹', '🦁', '✨'],
  ),
  ProJourneyDef(
    id: 'peace', days: 14, emoji: '🕊️', practice: PracticeKind.breathe,
    passages: [
      Passage(_B.matt, 11, 28), Passage(_B.john, 14, 27), Passage(_B.pet1, 5, 7), Passage(_B.matt, 6, 34),
      Passage(_B.luke, 12, 24), Passage(_B.phil, 4, 6), Passage(_B.rom, 12, 2), Passage(_B.mark, 4, 39),
      Passage(_B.mark, 6, 31), Passage(_B.heb, 13, 5, 6), Passage(_B.john, 16, 33), Passage(_B.cor1, 6, 19, 20),
      Passage(_B.rom, 15, 13), Passage(_B.col, 3, 15),
    ],
    missionEmoji: ['📝', '🔕', '🎒', '📅', '🌿', '🙏', '🧠', '📞', '🌙', '💬', '🧾', '💧', '🎵', '🛡️'],
  ),
  ProJourneyDef(
    id: 'freedom', days: 21, emoji: '🔓', practice: PracticeKind.battle,
    passages: [
      Passage(_B.john, 8, 36), Passage(_B.cor1, 10, 13), Passage(_B.gal, 5, 1), Passage(_B.rom, 12, 2),
      Passage(_B.jas, 5, 16), Passage(_B.jas, 4, 7, 8), Passage(_B.titus, 2, 11, 12), Passage(_B.rom, 8, 14),
      Passage(_B.cor1, 6, 12), Passage(_B.matt, 26, 41), Passage(_B.cor2, 12, 9), Passage(_B.john1, 1, 9),
      Passage(_B.eph, 4, 22, 24), Passage(_B.heb, 12, 1), Passage(_B.rom, 13, 14), Passage(_B.phil, 3, 13, 14),
      Passage(_B.pet2, 1, 3), Passage(_B.jas, 1, 12), Passage(_B.gal, 6, 2), Passage(_B.thes1, 5, 23, 24),
      Passage(_B.rom, 6, 14),
    ],
    missionEmoji: [
      '🔍', '🚪', '🗓️', '📱', '🤝', '⏱️', '🏆', '🔄', '📊', '🌙', '💪',
      '🧭', '📝', '🧹', '🔐', '🎯', '🛠️', '📈', '🫶', '✉️', '🏁',
    ],
  ),
  ProJourneyDef(
    id: 'prayer', days: 14, emoji: '🛡️', practice: PracticeKind.intercede,
    passages: [
      Passage(_B.matt, 6, 6), Passage(_B.luke, 11, 2), Passage(_B.phil, 4, 19), Passage(_B.col, 3, 13),
      Passage(_B.luke, 18, 1), Passage(_B.eph, 3, 16, 19), Passage(_B.mark, 11, 24), Passage(_B.luke, 6, 27, 28),
      Passage(_B.rom, 8, 26), Passage(_B.thes1, 5, 16, 18), Passage(_B.matt, 18, 19, 20), Passage(_B.tim1, 2, 1, 2),
      Passage(_B.luke, 22, 42), Passage(_B.col, 4, 2),
    ],
    missionEmoji: ['🪑', '📋', '🍞', '🕊️', '📌', '💌', '✍️', '🤐', '🌄', '⏰', '👥', '🌍', '🤲', '📜'],
  ),
];

/// The 90-second rescue reads 1 Corinthians 10:13.
const kSosPassage = Passage(_B.cor1, 10, 13);

const kBattles = <String>['scroll', 'lust', 'anger', 'gaming', 'substance', 'delay', 'other'];
const kBattleEmoji = <String, String>{
  'scroll': '📱', 'lust': '🔒', 'anger': '🔥', 'gaming': '🎮', 'substance': '🚭', 'delay': '⏳', 'other': '✍️',
};

ProJourneyDef? proJourneyById(String id) {
  for (final j in kProJourneys) {
    if (j.id == id) return j;
  }
  return null;
}

/// Localized copy for one day of a journey.
class ProJourneyDayPlan {
  const ProJourneyDayPlan({
    required this.day,
    required this.title,
    required this.word,
    required this.context,
    required this.teaching,
    required this.reflect,
    required this.guide,
    required this.exercise,

    required this.practice,
    required this.breatheIn,
    required this.breatheOut,
    required this.mission,
    required this.why,
    required this.emoji,
    required this.passage,
  });
  final int day;
  final String title;
  final String word;
  final String context;
  final String teaching;
  final String reflect;
  final String guide;
  final String exercise;


  /// Declaration / battle prayer / prayer prompt.
  final String practice;
  final String breatheIn;
  final String breatheOut;
  final String mission;
  final String why;
  final String emoji;
  final Passage passage;
}

ProJourneyDayPlan proJourneyDay(ProJourneyDef j, int day) {
  final n = math.min(j.days, math.max(1, day));
  final k = 'pj.${j.id}.$n';
  final practiceKey = switch (j.practice) {
    PracticeKind.declare => 'dec',
    PracticeKind.battle => 'pr',
    PracticeKind.intercede => 'pp',
    PracticeKind.breathe => '',
  };
  final breathe = j.practice == PracticeKind.breathe;
  return ProJourneyDayPlan(
    day: n,
    title: t('$k.t'),
    word: t('$k.w'),
    context: t('$k.context'),
    teaching: t('$k.teaching'),
    reflect: t('$k.reflect'),
    guide: t('$k.guide'),
    exercise: t('$k.exercise'),

    practice: practiceKey.isEmpty ? '' : t('$k.$practiceKey'),
    breatheIn: breathe ? t('$k.in') : '',
    breatheOut: breathe ? t('$k.out') : '',
    mission: t('$k.m'),
    why: t('$k.y'),
    emoji: n - 1 < j.missionEmoji.length ? j.missionEmoji[n - 1] : j.emoji,
    passage: j.passages[n - 1],
  );
}

bool proJourneyRequiresPro(int day) => day > kProJourneyFreeDays;

/* ── state ─────────────────────────────────────────────────────────────── */

class JourneyProgress {
  const JourneyProgress({required this.started, this.done = const {}, this.steps = const {}});
  final String started;

  /// day → local date it was completed on.
  final Map<String, String> done;

  /// day → beats done so far (only for unfinished days).
  final Map<String, List<String>> steps;

  Map<String, dynamic> toJson() => {'started': started, 'done': done, 'steps': steps};
}

class FreedomState {
  const FreedomState({this.battle, this.when = '', this.then = '', this.checkins = const {}, this.sos = 0});
  final String? battle;
  final String when;
  final String then;

  /// local date → honest check-in ('free' | 'slip') for the previous 24 hours.
  final Map<String, String> checkins;
  final int sos;

  FreedomState copyWith({String? battle, String? when, String? then, Map<String, String>? checkins, int? sos}) =>
      FreedomState(
        battle: battle ?? this.battle,
        when: when ?? this.when,
        then: then ?? this.then,
        checkins: checkins ?? this.checkins,
        sos: sos ?? this.sos,
      );

  Map<String, dynamic> toJson() => {'battle': battle, 'when': when, 'then': then, 'checkins': checkins, 'sos': sos};
}

class PrayerItem {
  const PrayerItem({required this.id, required this.name, this.need = '', required this.added, this.answered});
  final String id;
  final String name;
  final String need;
  final String added;
  final String? answered;

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'need': need, 'added': added, 'answered': answered};
}

class ProJourneyState {
  const ProJourneyState({
    this.journeys = const {},
    this.finished = const {},
    this.freedom = const FreedomState(),
    this.prayers = const [],
  });
  final Map<String, JourneyProgress> journeys;

  /// id → date first finished (badges survive a restart).
  final Map<String, String> finished;
  final FreedomState freedom;
  final List<PrayerItem> prayers;

  ProJourneyState copyWith({
    Map<String, JourneyProgress>? journeys,
    Map<String, String>? finished,
    FreedomState? freedom,
    List<PrayerItem>? prayers,
  }) =>
      ProJourneyState(
        journeys: journeys ?? this.journeys,
        finished: finished ?? this.finished,
        freedom: freedom ?? this.freedom,
        prayers: prayers ?? this.prayers,
      );

  Map<String, dynamic> toJson() => {
        'journeys': {for (final e in journeys.entries) e.key: e.value.toJson()},
        'finished': finished,
        'freedom': freedom.toJson(),
        'prayers': [for (final p in prayers) p.toJson()],
      };
}

final _date = RegExp(r'^\d{4}-\d{2}-\d{2}$');
bool _isDate(Object? v) => v is String && _date.hasMatch(v);
String _str(Object? v, int max) => v is String ? (v.length > max ? v.substring(0, max) : v) : '';
String _clip(String v, int max) => v.length > max ? v.substring(0, max) : v;

/// Mirrors web `sanitize()` — tolerant of partial or foreign data.
ProJourneyState _sanitize(Object? json) {
  final raw = json is Map ? json : const {};
  final rawJourneys = raw['journeys'] is Map ? raw['journeys'] as Map : const {};
  final rawFinished = raw['finished'] is Map ? raw['finished'] as Map : const {};
  final journeys = <String, JourneyProgress>{};
  final finished = <String, String>{};
  for (final def in kProJourneys) {
    final src = rawJourneys[def.id];
    if (src is Map && _isDate(src['started'])) {
      final done = <String, String>{};
      final steps = <String, List<String>>{};
      final srcDone = src['done'] is Map ? src['done'] as Map : const {};
      final srcSteps = src['steps'] is Map ? src['steps'] as Map : const {};
      for (var d = 1; d <= def.days; d++) {
        final v = srcDone['$d'];
        if (_isDate(v)) done['$d'] = v as String;
        final s = srcSteps['$d'];
        if (s is List && !done.containsKey('$d')) {
          final clean = kJourneySteps.where(s.contains).toList();
          if (clean.isNotEmpty) steps['$d'] = clean;
        }
      }
      journeys[def.id] = JourneyProgress(started: src['started'] as String, done: done, steps: steps);
    }
    final f = rawFinished[def.id];
    if (_isDate(f)) finished[def.id] = f as String;
  }

  final fr = raw['freedom'] is Map ? raw['freedom'] as Map : const {};
  final checkins = <String, String>{};
  if (fr['checkins'] is Map) {
    final src = fr['checkins'] as Map;
    final dates = src.keys.whereType<String>().where(_date.hasMatch).toList()..sort();
    for (final d in dates.skip(math.max(0, dates.length - 90))) {
      final v = src[d];
      if (v == 'free' || v == 'slip') checkins[d] = v as String;
    }
  }
  final sosRaw = fr['sos'];
  final freedom = FreedomState(
    battle: kBattles.contains(fr['battle']) ? fr['battle'] as String : null,
    when: _str(fr['when'], 120),
    then: _str(fr['then'], 120),
    checkins: checkins,
    sos: sosRaw is num && sosRaw.isFinite ? math.max(0, sosRaw.floor()) : 0,
  );

  final prayers = <PrayerItem>[];
  if (raw['prayers'] is List) {
    for (final it in (raw['prayers'] as List).take(kPrayerListMax)) {
      if (it is! Map || it['id'] is! String || _str(it['name'], 40).trim().isEmpty) continue;
      prayers.add(PrayerItem(
        id: _clip(it['id'] as String, 24),
        name: _str(it['name'], 40),
        need: _str(it['need'], 120),
        added: _isDate(it['added']) ? it['added'] as String : ChallengeStore.localDate(),
        answered: _isDate(it['answered']) ? it['answered'] as String : null,
      ));
    }
  }
  return ProJourneyState(journeys: journeys, finished: finished, freedom: freedom, prayers: prayers);
}

/// Result of completing a day.
class ProDayResult {
  const ProDayResult(this.day, this.finished, this.total);
  final int day;
  final bool finished;
  final int total;
}

enum JourneyStatusKind { fresh, today, wait, done }

class JourneyStatus {
  const JourneyStatus(this.kind, [this.day = 1]);
  final JourneyStatusKind kind;

  /// today: the open day · wait: the day that opens tomorrow.
  final int day;
  int get doneDay => day - 1;
}

class ProJourneyStore {
  ProJourneyStore._();

  /// Bumps on every write so widgets can rebuild (ListenableBuilder).
  static final revision = ValueNotifier<int>(0);
  static ProJourneyState? _cache;

  static ProJourneyState _read() {
    final raw = Prefs.getString(kProJourneysKey);
    if (raw == null || raw.isEmpty) return const ProJourneyState();
    try {
      return _sanitize(jsonDecode(raw));
    } catch (_) {
      return const ProJourneyState();
    }
  }

  static ProJourneyState get state => _cache ??= _read();

  /// Re-read from storage (after "Delete my data" or an external write).
  static void reload() {
    _cache = _read();
    revision.value++;
  }

  static void _write(ProJourneyState next) {
    _cache = next;
    Prefs.setString(kProJourneysKey, jsonEncode(next.toJson()));
    revision.value++;
  }

  static String get _today => ChallengeStore.localDate();

  /* ── journey queries ────────────────────────────────────────────────── */

  static bool isStarted(String id) => state.journeys.containsKey(id);
  static int doneCount(String id) => state.journeys[id]?.done.length ?? 0;
  static bool isDayDone(String id, int day) => state.journeys[id]?.done.containsKey('$day') ?? false;
  static String? dayDoneOn(String id, int day) => state.journeys[id]?.done['$day'];
  static List<String> stepsFor(String id, int day) => state.journeys[id]?.steps['$day'] ?? const [];
  static bool isFinishedEver(String id) => state.finished.containsKey(id);

  /// First unfinished day, or null when the journey is complete.
  static int? nextDay(String id) {
    final def = proJourneyById(id);
    if (def == null) return null;
    for (var d = 1; d <= def.days; d++) {
      if (!isDayDone(id, d)) return d;
    }
    return null;
  }

  /// Day N is open today when Day N−1 was completed on an earlier date.
  static bool isDayOpen(String id, int day, [String? today]) {
    final def = proJourneyById(id);
    if (def == null || day < 1 || day > def.days || isDayDone(id, day)) return false;
    if (day == 1) return true;
    final prev = dayDoneOn(id, day - 1);
    return prev != null && prev.compareTo(today ?? _today) < 0;
  }

  static JourneyStatus status(String id, [String? today]) {
    final next = nextDay(id);
    if (next == null) return const JourneyStatus(JourneyStatusKind.done);
    if (!isStarted(id)) return const JourneyStatus(JourneyStatusKind.fresh);
    if (isDayOpen(id, next, today)) return JourneyStatus(JourneyStatusKind.today, next);
    return JourneyStatus(JourneyStatusKind.wait, next);
  }

  /* ── journey mutations ──────────────────────────────────────────────── */

  static void _withJourney(String id, JourneyProgress Function(JourneyProgress p) fn) {
    final cur = state.journeys[id] ?? JourneyProgress(started: _today);
    final next = fn(JourneyProgress(
      started: cur.started,
      done: Map.of(cur.done),
      steps: {for (final e in cur.steps.entries) e.key: List.of(e.value)},
    ));
    _write(state.copyWith(journeys: {...state.journeys, id: next}));
  }

  static void start(String id) {
    if (!isStarted(id)) _withJourney(id, (p) => p);
  }

  static void markStep(String id, int day, String step, [String? today]) {
    if (!isDayOpen(id, day, today)) return;
    final have = stepsFor(id, day);
    if (have.contains(step)) return;
    _withJourney(id, (p) {
      p.steps['$day'] = kJourneySteps.where((x) => x == step || have.contains(x)).toList();
      return p;
    });
  }

  static void unmarkStep(String id, int day, String step) {
    final have = stepsFor(id, day);
    if (!have.contains(step)) return;
    _withJourney(id, (p) {
      p.steps['$day'] = have.where((x) => x != step).toList();
      return p;
    });
  }

  /// Records the day when all three beats are done.
  static ProDayResult? completeDay(String id, int day, [String? today]) {
    final def = proJourneyById(id);
    final now = today ?? _today;
    if (def == null || !isDayOpen(id, day, now)) return null;
    final have = stepsFor(id, day);
    if (!kJourneySteps.every(have.contains)) return null;
    _withJourney(id, (p) {
      p.done['$day'] = now;
      p.steps.remove('$day');
      return p;
    });
    final finished = nextDay(id) == null;
    if (finished && !state.finished.containsKey(id)) {
      _write(state.copyWith(finished: {...state.finished, id: now}));
    }
    return ProDayResult(day, finished, def.days);
  }

  /// Back to Day 1. Badges, the prayer list and the freedom plan stay.
  static void restart(String id) {
    ProJourneyStudy.resetReading(id);
    final journeys = Map.of(state.journeys)..remove(id);
    final freedom = id == 'freedom' ? state.freedom.copyWith(checkins: const {}, sos: 0) : state.freedom;
    _write(state.copyWith(journeys: journeys, freedom: freedom));
  }

  /* ── Break Free ─────────────────────────────────────────────────────── */

  static void setBattle(String battle) {
    if (!kBattles.contains(battle)) return;
    _write(state.copyWith(freedom: state.freedom.copyWith(battle: battle)));
  }

  static void setPlan(String when, String then) {
    _write(state.copyWith(
      freedom: state.freedom.copyWith(when: _clip(when.trim(), 120), then: _clip(then.trim(), 120)),
    ));
  }

  static bool get hasPlan {
    final f = state.freedom;
    return f.battle != null && f.when.trim().isNotEmpty && f.then.trim().isNotEmpty;
  }

  static String? checkinToday([String? today]) => state.freedom.checkins[today ?? _today];

  static void checkIn(String result, [String? today]) {
    if (result != 'free' && result != 'slip') return;
    _write(state.copyWith(
      freedom: state.freedom.copyWith(checkins: {...state.freedom.checkins, today ?? _today: result}),
    ));
  }

  static void recordSos() => _write(state.copyWith(freedom: state.freedom.copyWith(sos: state.freedom.sos + 1)));

  /// Whole days since the last reported slip (or since the journey began).
  static int daysFree([String? today]) {
    final started = state.journeys['freedom']?.started;
    if (started == null) return 0;
    final slips = state.freedom.checkins.entries.where((e) => e.value == 'slip').map((e) => e.key).toList()..sort();
    final last = slips.isEmpty ? null : slips.last;
    final from = last != null && last.compareTo(started) >= 0 ? last : started;
    return math.max(0, ChallengeStore.daysBetween(from, today ?? _today));
  }

  /* ── Prayer list ────────────────────────────────────────────────────── */

  static bool addPrayer(String name, String need) {
    final n = _clip(name.trim(), 40);
    if (n.isEmpty || state.prayers.length >= kPrayerListMax) return false;
    final r = math.Random();
    final id = '${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}${r.nextInt(1 << 20).toRadixString(36)}';
    final item = PrayerItem(id: _clip(id, 24), name: n, need: _clip(need.trim(), 120), added: _today);
    _write(state.copyWith(prayers: [...state.prayers, item]));
    return true;
  }

  static void toggleAnswered(String itemId, [String? today]) {
    _write(state.copyWith(prayers: [
      for (final p in state.prayers)
        p.id == itemId
            ? PrayerItem(id: p.id, name: p.name, need: p.need, added: p.added, answered: p.answered != null ? null : (today ?? _today))
            : p,
    ]));
  }

  static void removePrayer(String itemId) =>
      _write(state.copyWith(prayers: state.prayers.where((p) => p.id != itemId).toList()));

  static int get answeredCount => state.prayers.where((p) => p.answered != null).length;
}
