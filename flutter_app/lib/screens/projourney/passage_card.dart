import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'pj_ui.dart';

class PassageText {
  const PassageText(this.verses, this.label);
  final List<String> verses;
  final String label;
}

final Map<String, Future<PassageText>> _cache = {};

/// A short verse range (e.g. Matthew 11:28–30) from the offline Bible.
/// Web mirror: `usePassage()` in `src/components/challenge/useReading.ts`.
Future<PassageText> loadPassage(String lang, Passage p) {
  final key = '$lang:${p.book}:${p.chapter}:${p.from}-${p.to}';
  return _cache[key] ??= () async {
    final chapter = await loadChapter(lang, ReadingRef(p.book, p.chapter, p.from));
    final end = math.min(p.to, chapter.verses.length);
    final start = math.max(0, math.min(p.from - 1, end));
    final verses = chapter.verses.sublist(start, end).where((v) => v.trim().isNotEmpty).toList();
    if (verses.isEmpty) throw StateError('empty passage');
    final range = p.to > p.from ? '${p.from}–${p.to}' : '${p.from}';
    return PassageText(verses, '${chapter.bookName} ${p.chapter}:$range');
  }()
      .catchError((Object e) {
    _cache.remove(key);
    throw e;
  });
}

/// Scripture card in the active language.
/// Web mirror: `src/components/projourney/PassageCard.tsx`.
class PassageCard extends StatefulWidget {
  const PassageCard({super.key, required this.passage, this.small = false});
  final Passage passage;
  final bool small;

  @override
  State<PassageCard> createState() => _PassageCardState();
}

class _PassageCardState extends State<PassageCard> {
  late Future<PassageText> _f;
  String _lang = '';

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(covariant PassageCard old) {
    super.didUpdateWidget(old);
    if (old.passage != widget.passage || _lang != L10n.current.lang) _load();
  }

  void _load() {
    _lang = L10n.current.lang;
    _f = loadPassage(_lang, widget.passage);
  }

  @override
  Widget build(BuildContext context) {
    final pad = widget.small ? 16.0 : 20.0;
    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.06),
        borderRadius: BorderRadius.circular(22),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
      ),
      child: Stack(children: [
        Positioned(right: -48, top: -56, child: IgnorePointer(child: Container(width: 160, height: 160, decoration: PjInk.halo))),
        Padding(
          padding: EdgeInsets.all(pad),
          child: FutureBuilder<PassageText>(
            future: _f,
            builder: (context, snap) {
              if (snap.hasError) {
                return Row(children: [
                  Expanded(child: Text(t('pj.verse.error'), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground))),
                  TextButton(
                    onPressed: () => setState(_load),
                    child: Text(t('pj.verse.retry'), style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                  ),
                ]);
              }
              if (!snap.hasData) {
                return Text(t('pj.verse.loading'), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground));
              }
              final p = snap.data!;
              return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text('“${p.verses.join(' ')}”', style: ChInk.serif(widget.small ? 16.5 : 19, weight: FontWeight.w400, height: 1.6)),
                const SizedBox(height: 8),
                Text(p.label, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
              ]);
            },
          ),
        ),
      ]),
    );
  }
}
