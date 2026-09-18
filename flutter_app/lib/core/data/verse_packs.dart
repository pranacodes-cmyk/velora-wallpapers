import 'dart:convert';

import 'package:flutter/services.dart';

import '../localization/app_localizations.dart';

/// 1:1 port of `src/data/versePacks.ts` (+ `versePacksData.ts` /
/// `verseMoodPacks.ts` for the raw pack contents, which are pre-merged into
/// `assets/data/verse_packs.json` by `scripts/export-data-flutter.mjs`).

class PackVerse {
  const PackVerse({required this.text, required this.reference});
  final String text;
  final String reference;
}

enum VersePackGroup { situation, mood }

VersePackGroup _groupFromString(String s) =>
    s == 'mood' ? VersePackGroup.mood : VersePackGroup.situation;

String groupId(VersePackGroup g) =>
    g == VersePackGroup.mood ? 'mood' : 'situation';

class VersePackGroupMeta {
  const VersePackGroupMeta(this.id, this.title, this.subtitle);
  final VersePackGroup id;
  final String title;
  final String subtitle;
}

/// Same order/text as `VERSE_PACK_GROUPS` in `versePacks.ts`.
const List<VersePackGroupMeta> versePackGroups = [
  VersePackGroupMeta(
    VersePackGroup.situation,
    'What are you walking through?',
    'Verses for real life — pick what fits today',
  ),
  VersePackGroupMeta(
    VersePackGroup.mood,
    'Or pick a feeling',
    'Classic packs for everyday devotion',
  ),
];

class VersePack {
  const VersePack({
    required this.id,
    required this.label,
    required this.emoji,
    required this.tagline,
    required this.group,
    required this.verses,
  });

  final String id;
  final String label;
  final String emoji;
  final String tagline;
  final VersePackGroup group;
  final List<PackVerse> verses;
}

/// Localized label/tagline/group strings — mirrors `src/i18n/packs.ts`
/// (`pk.<id>.label`, `pk.<id>.tagline`, `pk.group.<id>.title/subtitle`),
/// falling back to the English source string when untranslated.
String packLabel(String id, String fallback) => tc('pk.$id.label') ?? fallback;
String packTagline(String id, String fallback) =>
    tc('pk.$id.tagline') ?? fallback;
String packGroupTitle(String id, String fallback) =>
    tc('pk.group.$id.title') ?? fallback;
String packGroupSubtitle(String id, String fallback) =>
    tc('pk.group.$id.subtitle') ?? fallback;

class VersePacks {
  VersePacks._();

  static List<VersePack> _packs = const [];
  static bool _loaded = false;

  static bool get isLoaded => _loaded;

  static List<VersePack> get all => _packs;

  static Future<void> load() async {
    if (_loaded) return;
    final raw = await rootBundle.loadString('assets/data/verse_packs.json');
    final list = jsonDecode(raw) as List<dynamic>;
    _packs = list.map((e) {
      final m = e as Map<String, dynamic>;
      return VersePack(
        id: m['id'] as String,
        label: m['label'] as String,
        emoji: m['emoji'] as String,
        tagline: m['tagline'] as String,
        group: _groupFromString(m['group'] as String),
        verses: (m['verses'] as List<dynamic>)
            .cast<Map<String, dynamic>>()
            .map(
              (v) => PackVerse(
                text: v['text'] as String,
                reference: v['reference'] as String,
              ),
            )
            .toList(),
      );
    }).toList();
    _loaded = true;
  }

  static VersePack? getVersePack(String? id) {
    if (id == null) return null;
    for (final p in _packs) {
      if (p.id == id) return p;
    }
    return null;
  }

  static bool isValidVersePackId(String? id) => getVersePack(id) != null;

  static List<VersePack> getPacksByGroup(VersePackGroup group) =>
      _packs.where((p) => p.group == group).toList();

  /// Verse for a pack on a given date — rotates daily, loops at the end.
  /// Same `Math.floor(epoch/86400000)` arithmetic as the web app.
  static PackVerse? getVersePackVerse(String id, [DateTime? date]) {
    final pack = getVersePack(id);
    if (pack == null || pack.verses.isEmpty) return null;
    final d = date ?? DateTime.now();
    final epochDay = d.toUtc().millisecondsSinceEpoch ~/ 86400000;
    final len = pack.verses.length;
    final idx = ((epochDay % len) + len) % len;
    return pack.verses[idx];
  }
}
