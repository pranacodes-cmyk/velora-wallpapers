import 'dart:math' as math;

import '../localization/app_localizations.dart';

/// 75 Days of Light — reading plan, stages and localized day copy.
/// Web mirror: `src/data/challenge75.ts`. Day copy lives in the exported
/// translation JSON (`chd.<day>.<field>`), English is the merged fallback.
const kChallengeDays = 75;
const kTaskIds = <String>['read', 'pray', 'live', 'reflect'];
const kMilestones = <int>[1, 7, 15, 30, 45, 60, 75];

class ReadingRef {
  const ReadingRef(this.book, this.chapter, this.verse);

  /// Canonical (Protestant, 0-based) book index.
  final int book;
  final int chapter;
  final int verse;
}

class _B {
  static const mark = 40, john = 42, romans = 44, cor1 = 45, galatians = 47;
  static const ephesians = 48, philippians = 49, colossians = 50, hebrews = 57;
  static const james = 58, peter1 = 59, john1 = 61, revelation = 65;
}

List<ReadingRef> _range(int book, List<int> verses) => [
      for (var i = 0; i < verses.length; i++) ReadingRef(book, i + 1, verses[i]),
    ];

final List<ReadingRef> kReadingPlan = [
  ..._range(_B.mark, [17, 17, 35, 39, 36, 31, 15, 34, 24, 45, 24, 30, 31, 36, 39, 6]),
  ..._range(_B.john, [5, 5, 16, 14, 6, 35, 38, 12, 25, 11, 25, 46, 34, 27, 5, 33, 21, 37, 30, 29, 17]),
  ..._range(_B.ephesians, [18, 8, 20, 32, 8, 10]),
  ..._range(_B.philippians, [6, 15, 14, 6]),
  ..._range(_B.colossians, [13, 7, 23, 6]),
  ..._range(_B.james, [22, 17, 17, 8, 16]),
  ..._range(_B.peter1, [3, 9, 15, 10, 7]),
  ..._range(_B.john1, [7, 10, 18, 18, 14]),
  const ReadingRef(_B.romans, 5, 8),
  const ReadingRef(_B.romans, 8, 28),
  const ReadingRef(_B.romans, 12, 2),
  const ReadingRef(_B.cor1, 13, 4),
  const ReadingRef(_B.galatians, 5, 22),
  const ReadingRef(_B.hebrews, 11, 1),
  const ReadingRef(_B.hebrews, 12, 1),
  const ReadingRef(_B.revelation, 21, 5),
  const ReadingRef(_B.revelation, 22, 5),
];

class ChallengeDayPlan {
  const ChallengeDayPlan({
    required this.day,
    required this.ref,
    required this.title,
    required this.insight,
    required this.focus,
    required this.prayer,
    required this.action,
    required this.how,
    required this.question,
  });

  final int day;
  final ReadingRef ref;
  final String title;
  final String insight;
  final String focus;
  final String prayer;
  final String action;
  final String how;
  final String question;
}

String dayText(int day, String field) => tc('chd.$day.$field') ?? '';

ChallengeDayPlan challengeDay(int day) {
  final n = math.min(kChallengeDays, math.max(1, day));
  return ChallengeDayPlan(
    day: n,
    ref: kReadingPlan[n - 1],
    title: dayText(n, 'title'),
    insight: dayText(n, 'insight'),
    focus: dayText(n, 'focus'),
    prayer: dayText(n, 'prayer'),
    action: dayText(n, 'action'),
    how: dayText(n, 'how'),
    question: dayText(n, 'question'),
  );
}

class ChallengeStage {
  const ChallengeStage(this.index, this.key, this.from, this.to);
  final int index;
  final String key;
  final int from;
  final int to;
}

const kStages = <ChallengeStage>[
  ChallengeStage(0, 'spark', 1, 15),
  ChallengeStage(1, 'ember', 16, 30),
  ChallengeStage(2, 'glow', 31, 45),
  ChallengeStage(3, 'radiance', 46, 60),
  ChallengeStage(4, 'beacon', 61, 75),
];

ChallengeStage stageForDay(int day) =>
    kStages.firstWhere((s) => day >= s.from && day <= s.to, orElse: () => kStages.last);

/// Lamp tier unlocked by the number of completed days (0–4).
int lampTierFor(int completed) => math.min(4, math.max(0, completed) ~/ 15);

/// The Hindi edition ships its New Testament in a different file order.
const Map<int, int> _hiNt = {
  43: 63, 44: 43, 45: 44, 46: 45, 47: 46, 48: 47, 49: 48, 50: 49, 51: 50, 52: 51,
  53: 52, 54: 53, 55: 54, 56: 55, 57: 56, 58: 57, 59: 64, 60: 58, 61: 59, 62: 60,
  63: 65, 64: 61, 65: 62,
};

/// File index of a canonical book in a language edition. Indonesian ships
/// the New Testament only, so its files start at Matthew.
int bookFileIndex(String lang, int canonical, [List<int>? canonicalIds]) {
  if (lang == 'hi') return _hiNt[canonical] ?? canonical;
  if (canonicalIds != null && canonicalIds.length != 66) {
    final i = canonicalIds.indexOf(canonical);
    if (i >= 0) return i;
  }
  return canonical;
}
