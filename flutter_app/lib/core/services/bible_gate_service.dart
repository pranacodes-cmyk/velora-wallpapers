import 'dart:convert';

import 'package:http/http.dart' as http;

import '../env.dart';
import 'app_log.dart';
import 'prefs.dart';

/// One KJV verse. `id` is the canonical reading order (1..31100).
class BibleVerse {
  const BibleVerse({required this.id, required this.book, required this.chapter, required this.verse, required this.text});
  final int id;
  final String book;
  final int chapter;
  final int verse;
  final String text;

  String get reference => '$book $chapter:$verse';

  factory BibleVerse.fromJson(Map<String, dynamic> m) => BibleVerse(
    id: (m['id'] as num).toInt(),
    book: m['book']?.toString() ?? '',
    chapter: (m['chapter'] as num).toInt(),
    verse: (m['verse'] as num).toInt(),
    text: m['text']?.toString() ?? '',
  );

  Map<String, dynamic> toJson() => {'id': id, 'book': book, 'chapter': chapter, 'verse': verse, 'text': text};
}

/// Scripture Gate (Pro) — the full English KJV Bible from the backend
/// (`bible_kjv`), read in order a few verses per Sacred Pause, with the next
/// verses cached for offline. Mirrors `src/services/bibleGate.ts`; the storage
/// keys are identical.
class BibleGateService {
  BibleGateService._();

  static const versesPerPause = 3;
  static const lastVerseId = 31100;
  static const _posKey = 'ps_bible_pos';
  static const _cacheKey = 'ps_bible_cache';
  static const _readKey = 'ps_bible_read';

  static const _enabledKey = 'ps_bible_enabled';

  /// Pro choice: Bible (default) or the classic prayer on the blocker.
  static bool get enabled => Prefs.getBool(_enabledKey, fallback: true);
  static Future<void> setEnabled(bool v) => Prefs.setBool(_enabledKey, v);

  static int get position => Prefs.getInt(_posKey, fallback: 1);
  static int get versesRead => Prefs.getInt(_readKey);
  static double get percent => ((position - 1) / lastVerseId * 100).clamp(0, 100).toDouble();

  static List<BibleVerse> _cache() {
    try {
      final raw = Prefs.getString(_cacheKey);
      if (raw == null || raw.isEmpty) return const [];
      return (jsonDecode(raw) as List<dynamic>).whereType<Map<String, dynamic>>().map(BibleVerse.fromJson).toList();
    } catch (_) {
      return const [];
    }
  }

  static Future<List<BibleVerse>> loadPassage([int count = versesPerPause]) async {
    final pos = position;
    final cached = _cache().where((v) => v.id >= pos).toList();
    if (cached.length >= count && cached.first.id == pos) {
      if (cached.length < count * 3) _refill(pos);
      return cached.take(count).toList();
    }
    final fresh = await _refill(pos);
    return (fresh.isNotEmpty ? fresh : cached).take(count).toList();
  }

  static Future<List<BibleVerse>> _refill(int pos) async {
    try {
      final uri = Uri.parse('${Env.supabaseUrl}/rest/v1/bible_kjv?select=id,book,chapter,verse,text&id=gte.$pos&order=id.asc&limit=30');
      final res = await http.get(uri, headers: const {
        'apikey': Env.supabaseAnonKey,
        'Authorization': 'Bearer ${Env.supabaseAnonKey}',
      }).timeout(const Duration(seconds: 6));
      if (res.statusCode != 200) return const [];
      final body = utf8.decode(res.bodyBytes);
      final list = (jsonDecode(body) as List<dynamic>).whereType<Map<String, dynamic>>().map(BibleVerse.fromJson).toList();
      if (list.isNotEmpty) await Prefs.setString(_cacheKey, jsonEncode(list.map((v) => v.toJson()).toList()));
      return list;
    } catch (e) {
      AppLog.error('bible_gate.fetch', e);
      return const [];
    }
  }

  /// Moves the bookmark past what was read; wraps to Genesis after Revelation.
  static Future<void> markRead(int lastId, int count) async {
    await Prefs.setInt(_posKey, lastId >= lastVerseId ? 1 : lastId + 1);
    await Prefs.setInt(_readKey, versesRead + count);
  }
}
