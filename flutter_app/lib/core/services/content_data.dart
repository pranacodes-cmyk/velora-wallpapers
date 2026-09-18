import 'dart:convert';

import 'package:flutter/services.dart';

import '../localization/app_localizations.dart';

/// Runtime access to the app's content datasets.
///
/// The JSON files are generated from the web app's `src/data/*` modules by
/// `bun scripts/export-data-flutter.mjs`, and every localized string is looked
/// up through the exact same content keys the web app uses
/// (`v.<ref>`, `r.<ref>`, `rf.<ref>.m/.a`, `q.<id>.*`, `j.<id>.*`).
class DailyVerse {
  const DailyVerse({
    required this.text,
    required this.reference,
    required this.refKey,
  });
  final String text;
  final String reference;

  /// Original English reference — the stable lookup id (same as web `refKey`).
  final String refKey;
}

class VerseReflection {
  const VerseReflection({required this.meaning, required this.apply});
  final String meaning;
  final String apply;
}

class QuizQuestion {
  const QuizQuestion({
    required this.id,
    required this.category,
    required this.question,
    required this.options,
    required this.correctIndex,
    required this.reference,
    required this.explanation,
  });

  final String id;
  final String category;
  final String question;
  final List<String> options;
  final int correctIndex;
  final String reference;
  final String explanation;
}

class JourneyDay {
  const JourneyDay({
    required this.day,
    required this.title,
    required this.opening,
    required this.verse,
    required this.reference,
    required this.explanation,
    required this.prayer,
  });

  final int day;
  final String title;
  final String opening;
  final String verse;
  final String reference;
  final String explanation;
  final String prayer;
}

class Journey {
  const Journey({
    required this.id,
    required this.title,
    required this.subtitle,
    required this.hue,
    required this.emoji,
    required this.description,
    required this.isPremium,
    required this.days,
  });

  final String id;
  final String title;
  final String subtitle;
  final double hue;
  final String emoji;
  final String description;
  final bool isPremium;
  final List<JourneyDay> days;
}

class VerseBackground {
  const VerseBackground({
    required this.id,
    required this.url,
    required this.cardUrl,
  });
  final String id;
  final String url;
  final String cardUrl;
}

class ContentData {
  ContentData._();

  static List<Map<String, dynamic>> _verses = const [];
  static List<String> _prayers = const [];
  static List<Map<String, dynamic>> _quiz = const [];
  static List<Map<String, dynamic>> _journeys = const [];
  static Map<String, dynamic> _reflections = const {};
  static List<VerseBackground> _backgrounds = const [];
  static bool _loaded = false;

  static bool get isLoaded => _loaded;

  static Future<T> _json<T>(String file) async {
    final raw = await rootBundle.loadString('assets/data/$file');
    return jsonDecode(raw) as T;
  }

  static Future<void> load() async {
    if (_loaded) return;
    final results = await Future.wait([
      _json<List<dynamic>>('verses.json'),
      _json<List<dynamic>>('prayers.json'),
      _json<List<dynamic>>('verse_backgrounds.json'),
    ]);
    _verses = (results[0]).cast<Map<String, dynamic>>();
    _prayers = (results[1]).map((e) => e.toString()).toList();
    _backgrounds = (results[2])
        .cast<Map<String, dynamic>>()
        .map(
          (m) => VerseBackground(
            id: m['id'] as String,
            url: m['url'] as String,
            cardUrl: m['cardUrl'] as String,
          ),
        )
        .toList();
    _loaded = true;
  }

  /// Heavier datasets load after first paint (same deferred strategy the web
  /// app uses with dynamic `import()` for journeys and the quiz bank).
  static Future<void> loadDeferred() async {
    if (_quiz.isEmpty) {
      _quiz = (await _json<List<dynamic>>(
        'quiz_questions.json',
      )).cast<Map<String, dynamic>>();
    }
    if (_journeys.isEmpty) {
      _journeys = (await _json<List<dynamic>>(
        'journeys.json',
      )).cast<Map<String, dynamic>>();
    }
    if (_reflections.isEmpty) {
      _reflections = await _json<Map<String, dynamic>>(
        'verse_reflections.json',
      );
    }
  }

  // ---------------- dates ----------------
  /// Same arithmetic as the web app: days since Jan 0 of the given year.
  static int dayOfYear([DateTime? date]) {
    final d = date ?? DateTime.now();
    final start = DateTime(d.year, 1, 0);
    return DateTime(d.year, d.month, d.day).difference(start).inDays;
  }

  static int daysInYear([DateTime? date]) {
    final y = (date ?? DateTime.now()).year;
    final leap = (y % 4 == 0 && y % 100 != 0) || y % 400 == 0;
    return leap ? 366 : 365;
  }

  // ---------------- verses ----------------
  static DailyVerse verseForDate([DateTime? date]) {
    if (_verses.isEmpty) {
      return const DailyVerse(text: '', reference: '', refKey: '');
    }
    final idx = (dayOfYear(date) - 1) % _verses.length;
    final raw = _verses[idx < 0 ? 0 : idx];
    final refKey = raw['reference'] as String;
    return DailyVerse(
      text: tc('v.$refKey') ?? raw['text'] as String,
      reference: tc('r.$refKey') ?? refKey,
      refKey: refKey,
    );
  }

  static VerseReflection reflectionFor(String refKey) {
    final hit = _reflections[refKey];
    final meaning =
        tc('rf.$refKey.m') ??
        (hit is Map ? hit['meaning'] as String? : null) ??
        '$refKey is short on length and long on weight. Read it slowly — let it '
            'land as something spoken to you today, not just something written '
            'long ago.';
    final apply =
        tc('rf.$refKey.a') ??
        (hit is Map ? hit['apply'] as String? : null) ??
        'Pick one phrase that hit hardest and carry it into the next hour. Let '
            'it interrupt the noise when the day gets loud.';
    return VerseReflection(meaning: meaning, apply: apply);
  }

  // ---------------- prayers ----------------
  static String prayerForDate([DateTime? date]) {
    if (_prayers.isEmpty) return '';
    return _prayers[prayerIndexForDate(date)];
  }

  /// Same index the narration audio files are keyed by (`getDailyPrayerIndex`).
  static int prayerIndexForDate([DateTime? date]) {
    if (_prayers.isEmpty) return 0;
    final idx = (dayOfYear(date) - 1) % _prayers.length;
    return idx < 0 ? 0 : idx;
  }

  // ---------------- backgrounds ----------------
  static VerseBackground? backgroundForDay([DateTime? date]) {
    if (_backgrounds.isEmpty) return null;
    return _backgrounds[dayOfYear(date) % _backgrounds.length];
  }

  static String? bgCardForDay([DateTime? date]) =>
      backgroundForDay(date)?.cardUrl;

  // ---------------- quiz ----------------
  /// Raw quiz bank (localized via `q.<id>.*` content keys by callers) —
  /// exposed so the Quiz tab can run its own selection/filtering logic
  /// (random/daily/book/pack pools) on top of the same dataset used here.
  static List<Map<String, dynamic>> get quizBank => _quiz;

  /// Deterministic question for a 3-hour window seed — same integer hash as
  /// `DailyQuestionCard` on web (`Math.imul(seed, 2654435761)`).
  static QuizQuestion? questionForSeed(int seed) {
    if (_quiz.isEmpty) return null;
    final mixed = (seed.toSigned(32) * 2654435761).toUnsigned(32);
    final raw = _quiz[mixed % _quiz.length];
    final base = 'q.${raw['id']}';
    final options = (raw['options'] as List)
        .asMap()
        .entries
        .map((e) => tc('$base.o${e.key}') ?? e.value.toString())
        .toList();
    return QuizQuestion(
      id: raw['id'] as String,
      category: tc('$base.category') ?? raw['category'] as String,
      question: tc('$base.question') ?? raw['question'] as String,
      options: options,
      correctIndex: raw['correctIndex'] as int,
      reference: tc('$base.reference') ?? raw['reference'] as String,
      explanation: tc('$base.explanation') ?? raw['explanation'] as String,
    );
  }

  // ---------------- journeys ----------------
  static List<Journey> allJourneys() =>
      _journeys.map((raw) => journeyById(raw['id'] as String)!).toList();

  static Journey? journeyById(String id) {
    final raw = _journeys.firstWhere(
      (j) => j['id'] == id,
      orElse: () => _journeys.isEmpty ? <String, dynamic>{} : _journeys.first,
    );
    if (raw.isEmpty) return null;
    final jid = raw['id'] as String;
    final days = (raw['days'] as List).cast<Map<String, dynamic>>().map((d) {
      final base = 'j.$jid.d${d['day']}';
      return JourneyDay(
        day: d['day'] as int,
        title: tc('$base.title') ?? d['title'] as String,
        opening: tc('$base.opening') ?? d['opening'] as String,
        verse: tc('$base.verse') ?? d['verse'] as String,
        reference: tc('$base.reference') ?? d['reference'] as String,
        explanation: tc('$base.explanation') ?? d['explanation'] as String,
        prayer: tc('$base.prayer') ?? d['prayer'] as String,
      );
    }).toList();
    return Journey(
      id: jid,
      title: tc('j.$jid.title') ?? raw['title'] as String,
      subtitle: tc('j.$jid.subtitle') ?? raw['subtitle'] as String,
      hue: (raw['hue'] as num).toDouble(),
      emoji: raw['emoji'] as String,
      description: tc('j.$jid.description') ?? raw['description'] as String,
      isPremium: raw['isPremium'] == true,
      days: days,
    );
  }
}
