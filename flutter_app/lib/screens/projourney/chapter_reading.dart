import 'package:flutter/material.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';

/// Full bundled chapter. A failed load can never be marked as read.
class ChapterReading extends StatefulWidget {
  const ChapterReading({super.key, required this.passage, required this.onRead});
  final Passage passage;
  final VoidCallback onRead;
  @override
  State<ChapterReading> createState() => _ChapterReadingState();
}
class _ChapterReadingState extends State<ChapterReading> {
  late Future<ChapterText> _chapter;
  String _lang = '';
  void _load() {
    _lang = L10n.current.lang;
    final p = widget.passage;
    _chapter = loadChapter(_lang, ReadingRef(p.book, p.chapter, p.from));
  }
  @override
  void initState() { super.initState(); _load(); }
  @override
  void didUpdateWidget(covariant ChapterReading oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_lang != L10n.current.lang || oldWidget.passage.book != widget.passage.book || oldWidget.passage.chapter != widget.passage.chapter) _load();
  }
  @override
  Widget build(BuildContext context) => FutureBuilder<ChapterText>(future: _chapter, builder: (context, snapshot) {
    if (snapshot.hasError) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t('pj.depth.chapterError'), style: TextStyle(color: AppColors.mutedForeground, height: 1.5)),
      const SizedBox(height: 12), OutlineButton(label: t('pj.verse.retry'), onTap: () => setState(_load)),
    ]);
    final chapter = snapshot.data;
    if (chapter == null) return Text(t('pj.depth.chapterLoading'), style: TextStyle(color: AppColors.mutedForeground));
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text('${chapter.bookName} ${widget.passage.chapter}', style: ChInk.serif(24)),
      const SizedBox(height: 12), Divider(color: AppColors.border), const SizedBox(height: 12),
      for (var i = 0; i < chapter.verses.length; i++) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text.rich(TextSpan(children: [
        TextSpan(text: '${i + 1}  ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
        TextSpan(text: chapter.verses[i]),
      ]), style: ChInk.serif(19, weight: FontWeight.w400, height: 1.8))),
      GoldButton(label: t('pj.depth.readDone'), trailing: 'chevron-right', onTap: widget.onRead),
    ]);
  });
}