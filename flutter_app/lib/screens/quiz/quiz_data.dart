import 'dart:convert';
import 'dart:math';

import '../../core/localization/app_localizations.dart';
import '../../core/services/content_data.dart';
import '../../core/services/prefs.dart';

/// 1:1 port of `src/data/quizQuestions.ts` (+ localization via `q.<id>.*`
/// content keys, same as `localizeQuizQuestion` on web).
class QuizQuestion {
  const QuizQuestion({
    required this.id,
    required this.type,
    required this.difficulty,
    required this.category,
    required this.question,
    required this.options,
    required this.correctIndex,
    required this.reference,
    required this.explanation,
  });

  final String id;
  final String type; // multiple_choice | true_false | fill_verse
  final int difficulty; // 1..3
  final String category;
  final String question;
  final List<String> options;
  final int correctIndex;
  final String reference;
  final String explanation;
}

class QuizBank {
  QuizBank._();

  static List<Map<String, dynamic>> get _raw => ContentData.quizBank;

  static QuizQuestion _localize(Map<String, dynamic> raw) {
    final base = 'q.${raw['id']}';
    final rawOptions = (raw['options'] as List).cast<dynamic>();
    final options = [
      for (var i = 0; i < rawOptions.length; i++)
        tc('$base.o$i') ?? rawOptions[i].toString(),
    ];
    return QuizQuestion(
      id: raw['id'] as String,
      type: raw['type'] as String,
      difficulty: (raw['difficulty'] as num).toInt(),
      category: tc('$base.category') ?? raw['category'] as String,
      question: tc('$base.question') ?? raw['question'] as String,
      options: options,
      correctIndex: (raw['correctIndex'] as num).toInt(),
      reference: tc('$base.reference') ?? raw['reference'] as String,
      explanation: tc('$base.explanation') ?? raw['explanation'] as String,
    );
  }

  // ---- Anti-repeat tracking (same key as web: `cw_quiz_recent_ids`) ----
  static const _recentKey = 'cw_quiz_recent_ids';
  static const _recentMax = 250;

  static List<String> _recentIds() {
    try {
      final raw = Prefs.getString(_recentKey);
      if (raw == null || raw.isEmpty) return const [];
      return (jsonDecode(raw) as List).cast<String>();
    } catch (_) {
      return const [];
    }
  }

  static Future<void> markSeen(List<String> ids) async {
    try {
      final recent = _recentIds();
      final merged = <String>{...ids, ...recent}.toList();
      final capped = merged.take(_recentMax).toList();
      await Prefs.setString(_recentKey, jsonEncode(capped));
    } catch (_) {}
  }

  static List<Map<String, dynamic>> _byDifficulty(int? difficulty) {
    if (difficulty == null) return List.of(_raw);
    return _raw
        .where((q) => (q['difficulty'] as num).toInt() == difficulty)
        .toList();
  }

  static List<Map<String, dynamic>> _pickFresh(
    List<Map<String, dynamic>> pool,
    int count,
  ) {
    final recent = _recentIds().toSet();
    final fresh = pool.where((q) => !recent.contains(q['id'])).toList();
    final source = fresh.length >= count ? fresh : pool;
    final shuffled = List.of(source)..shuffle();
    return shuffled.take(min(count, shuffled.length)).toList();
  }

  static List<QuizQuestion> getRandomQuestions(int count, [int? difficulty]) {
    final fullPool = _byDifficulty(difficulty);
    final recent = _recentIds().toSet();
    final fresh = fullPool.where((q) => !recent.contains(q['id'])).toList();
    final pool = fresh.length >= count ? fresh : fullPool;
    final shuffled = List.of(pool)..shuffle();
    return shuffled.take(min(count, shuffled.length)).map(_localize).toList();
  }

  /// Deterministic per-day set — same seeded-random algorithm as web.
  static List<QuizQuestion> getDailyQuestions() {
    final today = DateTime.now();
    final key =
        '${today.year.toString().padLeft(4, '0')}-${today.month.toString().padLeft(2, '0')}-${today.day.toString().padLeft(2, '0')}';
    var seed = 0;
    for (var i = 0; i < key.length; i++) {
      seed = (((seed << 5) - seed) + key.codeUnitAt(i)) & 0xFFFFFFFF;
      if (seed > 0x7FFFFFFF) seed -= 0x100000000;
    }
    double seededRandom(int s) {
      final x = sin(s.toDouble()) * 10000;
      return x - x.floorToDouble();
    }

    final pool = List<Map<String, dynamic>>.of(_raw);
    for (var i = pool.length - 1; i > 0; i--) {
      final j = (seededRandom(seed + i) * (i + 1)).floor();
      final tmp = pool[i];
      pool[i] = pool[j];
      pool[j] = tmp;
    }
    final easy = pool
        .where((q) => (q['difficulty'] as num).toInt() == 1)
        .take(4);
    final medium = pool
        .where((q) => (q['difficulty'] as num).toInt() == 2)
        .take(4);
    final hard = pool
        .where((q) => (q['difficulty'] as num).toInt() == 3)
        .take(2);
    return [...easy, ...medium, ...hard].map(_localize).toList();
  }

  // ---------- Book / Pack support (port of `src/data/quizPacks.ts`) ----------

  static const _otBooks = {
    'Genesis',
    'Exodus',
    'Leviticus',
    'Numbers',
    'Deuteronomy',
    'Joshua',
    'Judges',
    'Ruth',
    '1 Samuel',
    '2 Samuel',
    '1 Kings',
    '2 Kings',
    '1 Chronicles',
    '2 Chronicles',
    'Ezra',
    'Nehemiah',
    'Esther',
    'Job',
    'Psalms',
    'Psalm',
    'Proverbs',
    'Ecclesiastes',
    'Song of Solomon',
    'Isaiah',
    'Jeremiah',
    'Lamentations',
    'Ezekiel',
    'Daniel',
    'Hosea',
    'Joel',
    'Amos',
    'Obadiah',
    'Jonah',
    'Micah',
    'Nahum',
    'Habakkuk',
    'Zephaniah',
    'Haggai',
    'Zechariah',
    'Malachi',
  };
  static const _ntBooks = {
    'Matthew',
    'Mark',
    'Luke',
    'John',
    'Acts',
    'Romans',
    '1 Corinthians',
    '2 Corinthians',
    'Galatians',
    'Ephesians',
    'Philippians',
    'Colossians',
    '1 Thessalonians',
    '2 Thessalonians',
    '1 Timothy',
    '2 Timothy',
    'Titus',
    'Philemon',
    'Hebrews',
    'James',
    '1 Peter',
    '2 Peter',
    '1 John',
    '2 John',
    '3 John',
    'Jude',
    'Revelation',
  };

  static String _bookOf(String reference) {
    final m = RegExp(
      r'^([1-3]?\s?[A-Za-z]+(?:\s[A-Za-z]+)?)\s+\d',
    ).firstMatch(reference);
    if (m != null) return m.group(1)!.trim();
    return reference.trim();
  }

  /// Memoised per (minCount, bank size) — the picker sheet used to redo this
  /// full scan + sort on every rebuild (theme change, keyboard, resize).
  static final Map<String, List<BookEntry>> _bookCountsCache = {};

  static List<BookEntry> listBooksWithCounts([int minCount = 4]) {
    final cacheKey = '$minCount:${_raw.length}';
    final cached = _bookCountsCache[cacheKey];
    if (cached != null) return cached;
    final counts = <String, int>{};
    for (final q in _raw) {
      var b = _bookOf(q['reference'] as String);
      if (b == 'Psalm') b = 'Psalms';
      counts[b] = (counts[b] ?? 0) + 1;
    }
    final entries = <BookEntry>[];
    counts.forEach((book, count) {
      if (count < minCount) return;
      final testament = _otBooks.contains(book)
          ? 'Old'
          : _ntBooks.contains(book)
          ? 'New'
          : 'Other';
      if (testament == 'Other') return;
      entries.add(BookEntry(book: book, count: count, testament: testament));
    });
    entries.sort((a, b) {
      if (a.testament != b.testament) return a.testament == 'Old' ? -1 : 1;
      return a.book.compareTo(b.book);
    });
    _bookCountsCache[cacheKey] = entries;
    return entries;
  }

  static List<QuizQuestion> getQuestionsByBook(String book, [int count = 15]) {
    final want = book == 'Psalms' ? {'Psalms', 'Psalm'} : {book};
    final pool = _raw
        .where((q) => want.contains(_bookOf(q['reference'] as String)))
        .toList();
    return _pickFresh(pool, count).map(_localize).toList();
  }

  static List<QuizQuestion> getQuestionsByPack(
    String packId, [
    int count = 10,
  ]) {
    final pack = getPackById(packId);
    if (pack == null) return const [];
    final kws = pack.keywords.map((k) => k.toLowerCase()).toList();
    final books = pack.books.toSet();
    final forced = pack.forceIds.toSet();
    final matched = _raw.where((q) {
      if (forced.contains(q['id'])) return true;
      final hay = '${q['question']} ${q['explanation']}'.toLowerCase();
      if (kws.any((k) => hay.contains(k))) return true;
      if (books.isNotEmpty && books.contains(_bookOf(q['reference'] as String)))
        return true;
      return false;
    }).toList();
    final seen = <String>{};
    final unique = matched.where((q) => seen.add(q['id'] as String)).toList();
    return _pickFresh(unique, count).map(_localize).toList();
  }

  static int getPackSize(String packId) {
    final pack = getPackById(packId);
    if (pack == null) return 0;
    final kws = pack.keywords.map((k) => k.toLowerCase()).toList();
    final books = pack.books.toSet();
    var n = 0;
    for (final q in _raw) {
      final hay = '${q['question']} ${q['explanation']}'.toLowerCase();
      if (kws.any((k) => hay.contains(k)) ||
          (books.isNotEmpty &&
              books.contains(_bookOf(q['reference'] as String)))) {
        n++;
      }
    }
    return n;
  }

  static QuizPack? getPackById(String id) {
    for (final p in quizPacks) {
      if (p.id == id) return p;
    }
    return null;
  }
}

class BookEntry {
  const BookEntry({
    required this.book,
    required this.count,
    required this.testament,
  });
  final String book;
  final int count;
  final String testament; // Old | New
}

class QuizPack {
  const QuizPack({
    required this.id,
    required this.title,
    required this.emoji,
    required this.description,
    required this.keywords,
    this.books = const [],
    this.forceIds = const [],
  });
  final String id;
  final String title;
  final String emoji;
  final String description;
  final List<String> keywords;
  final List<String> books;
  final List<String> forceIds;
}

/// Exact port of `QUIZ_PACKS` in `src/data/quizPacks.ts`.
const quizPacks = <QuizPack>[
  QuizPack(
    id: 'parables',
    title: 'Parables of Jesus',
    emoji: '🌾',
    description: "Prodigal Son, Good Samaritan, the Sower & more.",
    keywords: [
      'parable',
      'prodigal',
      'sower',
      'samaritan',
      'mustard seed',
      'lost sheep',
      'talents',
      'vineyard',
      'ten virgins',
      'pharisee and the tax',
    ],
  ),
  QuizPack(
    id: 'miracles',
    title: 'Miracles of Jesus',
    emoji: '✨',
    description: 'Water to wine, walking on water, feeding the 5,000.',
    keywords: [
      'miracle',
      'walked on water',
      'water into wine',
      'fed 5,000',
      'fed 5000',
      'raised',
      'healed',
      'leper',
      'blind',
      'lazarus',
      'calmed the storm',
      'loaves',
    ],
  ),
  QuizPack(
    id: 'prophets',
    title: 'The Prophets',
    emoji: '🔥',
    description: 'Elijah, Isaiah, Jeremiah, Daniel — voices of God.',
    keywords: [
      'prophet',
      'elijah',
      'elisha',
      'isaiah',
      'jeremiah',
      'ezekiel',
      'daniel',
      'jonah',
      'hosea',
      'amos',
    ],
    books: [
      'Isaiah',
      'Jeremiah',
      'Ezekiel',
      'Daniel',
      'Hosea',
      'Joel',
      'Amos',
      'Obadiah',
      'Jonah',
      'Micah',
      'Nahum',
      'Habakkuk',
      'Zephaniah',
      'Haggai',
      'Zechariah',
      'Malachi',
      '1 Kings',
      '2 Kings',
    ],
  ),
  QuizPack(
    id: 'kings',
    title: 'Kings & Kingdoms',
    emoji: '👑',
    description: 'David, Solomon, Saul — the throne of Israel.',
    keywords: [
      'king',
      'kingdom',
      'throne',
      'david',
      'solomon',
      'saul',
      'hezekiah',
      'josiah',
      'goliath',
    ],
    books: [
      '1 Samuel',
      '2 Samuel',
      '1 Kings',
      '2 Kings',
      '1 Chronicles',
      '2 Chronicles',
    ],
  ),
  QuizPack(
    id: 'women',
    title: 'Women of the Bible',
    emoji: '🌷',
    description: 'Mary, Ruth, Esther, Hannah, Deborah.',
    keywords: [
      'mary',
      'ruth',
      'esther',
      'hannah',
      'deborah',
      'sarah',
      'rebekah',
      'rachel',
      'leah',
      'miriam',
      'elizabeth',
      'martha',
      'priscilla',
      'lydia',
      'eve',
      'first woman',
    ],
  ),
  QuizPack(
    id: 'endtimes',
    title: 'End Times & Revelation',
    emoji: '⚡',
    description: 'Prophecies, the return of Christ, new heaven.',
    keywords: [
      'revelation',
      'end times',
      'second coming',
      'return',
      'new jerusalem',
      'heaven',
      'hell',
      'judgment',
      'beast',
      'antichrist',
      'tribulation',
      'alpha',
      'omega',
    ],
    books: ['Revelation', 'Daniel', '2 Thessalonians'],
  ),
  QuizPack(
    id: 'holyspirit',
    title: 'The Holy Spirit',
    emoji: '🕊️',
    description: 'Pentecost, gifts, fruits, the Helper.',
    keywords: [
      'holy spirit',
      'pentecost',
      'tongues',
      'fruit of the spirit',
      'gifts',
      'comforter',
      'helper',
      'baptism',
      'dove',
    ],
  ),
  QuizPack(
    id: 'psalms',
    title: 'Psalms of David',
    emoji: '🎵',
    description: "Worship, lament, the shepherd's heart.",
    keywords: ['psalm', 'shepherd', 'praise', 'worship'],
    books: ['Psalms', 'Psalm'],
  ),
  QuizPack(
    id: 'creation',
    title: 'Creation & Beginnings',
    emoji: '🌍',
    description: 'Eden, the Fall, Noah, the Tower of Babel.',
    keywords: [
      'creation',
      'created',
      'beginning',
      'adam',
      'eve',
      'eden',
      'noah',
      'ark',
      'flood',
      'babel',
      'cain',
      'abel',
    ],
    books: ['Genesis'],
  ),
  QuizPack(
    id: 'moses',
    title: 'Moses & the Exodus',
    emoji: '🌊',
    description: 'Plagues, Red Sea, Ten Commandments, wilderness.',
    keywords: [
      'moses',
      'pharaoh',
      'plague',
      'exodus',
      'red sea',
      'commandment',
      'wilderness',
      'manna',
      'sinai',
      'aaron',
      'tabernacle',
      'passover',
    ],
    books: ['Exodus', 'Leviticus', 'Numbers', 'Deuteronomy'],
  ),
  QuizPack(
    id: 'easter',
    title: 'The Passion & Resurrection',
    emoji: '✝️',
    description: 'Last Supper, the cross, the empty tomb.',
    keywords: [
      'crucified',
      'crucifixion',
      'cross',
      'resurrection',
      'rose',
      'tomb',
      'last supper',
      'passover',
      'golgotha',
      'calvary',
      'pilate',
      'gethsemane',
      'third day',
    ],
  ),
  QuizPack(
    id: 'love',
    title: 'Love, Faith & Hope',
    emoji: '❤️',
    description: '1 Corinthians 13 and the heart of Scripture.',
    keywords: [
      'love',
      'faith',
      'hope',
      'grace',
      'mercy',
      'forgive',
      'forgiveness',
      'peace',
      'joy',
      'kindness',
    ],
  ),
];
