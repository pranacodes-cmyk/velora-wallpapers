import 'dart:convert';
import 'package:flutter/material.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/bible_reader_service.dart';
import '../../core/services/bible_gate_service.dart';
import '../../core/services/prefs.dart';
import '../../core/services/prayer_pause_store.dart';
import '../../core/services/pray_screen_service.dart';
import '../../core/theme/app_colors.dart';

class _Chapter {
  const _Chapter(this.book, this.chapter, this.name, this.verses);
  final int book, chapter;
  final String name;
  final List<String> verses;
}

/// A single sacred-pause route: changing modes never dismisses the guard flow.
class ScriptureGateScreen extends StatefulWidget {
  const ScriptureGateScreen({super.key, this.showcase = false, this.initialBible = true, this.pause});
  final bool showcase, initialBible;
  final PrayerPause? pause;
  @override
  State<ScriptureGateScreen> createState() => _ScriptureGateScreenState();
}

class _ScriptureGateScreenState extends State<ScriptureGateScreen> {
  final _scroll = ScrollController();
  final _chapters = <_Chapter>[];
  ReaderEdition? _edition;
  bool _loading = false, _error = false;
  late bool _bible;
  late final PrayerPause _pause;
  String get _lang => L10n.current.lang;
  static const _positionKey = 'ps_bible_chapter_v1';

  @override
  void initState() {
    super.initState();
    _bible = widget.initialBible;
    _pause = widget.pause ?? PrayerPauseStore.at(DateTime.now().day);
    _scroll.addListener(_onScroll);
    _loadInitial();
  }
  @override
  void dispose() { _scroll.dispose(); super.dispose(); }

  void _onScroll() {
    if (_bible && _scroll.hasClients && _scroll.position.extentAfter < 120) _next();
  }

  Future<void> _loadInitial() async {
    if (_loading) return;
    setState(() { _loading = true; _error = false; });
    try {
      final edition = await BibleReaderService.edition(_lang);
      Map<String, dynamic> pos = {};
      try { pos = jsonDecode(Prefs.getString(_positionKey) ?? '{}') as Map<String, dynamic>; } catch (_) {}
      final book = ((pos['book'] as num?)?.toInt() ?? 0).clamp(0, edition.books.length - 1).toInt();
      final data = await BibleReaderService.book(_lang, book);
      final chapter = ((pos['chapter'] as num?)?.toInt() ?? 0).clamp(0, data.length - 1).toInt();
      if (!mounted) return;
      setState(() { _edition = edition; _chapters.add(_Chapter(book, chapter, edition.books[book].name, data[chapter])); });
    } catch (_) { if (mounted) setState(() => _error = true); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  Future<void> _next() async {
    final edition = _edition;
    if (_loading || _error || edition == null || _chapters.isEmpty) return;
    setState(() => _loading = true);
    final last = _chapters.last;
    var book = last.book, chapter = last.chapter + 1;
    if (chapter >= edition.books[book].chapters) { book = (book + 1) % edition.books.length; chapter = 0; }
    try {
      final data = await BibleReaderService.book(_lang, book);
      if (!mounted) return;
      setState(() => _chapters.add(_Chapter(book, chapter, edition.books[book].name, data[chapter])));
      await Prefs.setString(_positionKey, jsonEncode({'book': book, 'chapter': chapter, 'verse': 0}));
    } catch (_) { if (mounted) setState(() => _error = true); }
    finally { if (mounted) setState(() => _loading = false); }
  }

  void _select(bool bible) {
    setState(() => _bible = bible);
    BibleGateService.setEnabled(bible).then((_) => PrayScreenService.pushBlockerCopy());
    Analytics.capture('scripture_gate_mode_changed', {'mode': bible ? 'bible' : 'prayer'});
  }

  @override
  Widget build(BuildContext context) {
    final l = L10n.current;
    return Scaffold(backgroundColor: AppColors.background, body: SafeArea(child: Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
        child: SegmentedButton<bool>(showSelectedIcon: false,
          segments: [ButtonSegment(value: true, icon: const Icon(Icons.menu_book_outlined), label: Text(l.t('bible.title'))),
            ButtonSegment(value: false, icon: const Icon(Icons.favorite_outline), label: Text(l.t('ps.mode.prayer')))],
          selected: {_bible}, onSelectionChanged: (v) => _select(v.first),
          style: SegmentedButton.styleFrom(selectedBackgroundColor: AppColors.secondary,
            selectedForegroundColor: AppColors.foreground, foregroundColor: AppColors.mutedForeground))),
      Expanded(child: IndexedStack(index: _bible ? 0 : 1, children: [
        ListView(controller: _scroll, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20), children: [
          if (_edition != null) Padding(padding: const EdgeInsets.only(bottom: 24), child: Text(_edition?.name ?? '', textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))),
          for (final ch in _chapters) ...[
            Padding(padding: const EdgeInsets.only(bottom: 20), child: Text('${ch.name} · ${l.t('bible.chapter')} ${ch.chapter + 1}', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary))),
            for (var i = 0; i < ch.verses.length; i++) Padding(padding: const EdgeInsets.only(bottom: 20), child: Text.rich(TextSpan(children: [
              TextSpan(text: '${i + 1}  ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
              TextSpan(text: ch.verses[i]),
            ]), style: TextStyle(fontSize: 22, height: 1.65, color: AppColors.foreground))),
            const SizedBox(height: 12),
          ],
          if (_error) ...[Text(l.t('bible.error'), textAlign: TextAlign.center, style: TextStyle(color: AppColors.mutedForeground)),
            TextButton(onPressed: () { setState(() => _error = false); if (_chapters.isEmpty) { _loadInitial(); } else { _next(); } }, child: Text(l.t('bible.retry')))]
          else Padding(padding: const EdgeInsets.all(20), child: Text(l.t('bible.loading'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))),
        ]),
        SingleChildScrollView(padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32), child: Column(children: [
          Text(l.t('ps.prayer.kicker'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
          const SizedBox(height: 24), Text('“${_pause.verse}”', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, height: 1.5, color: AppColors.foreground)),
          const SizedBox(height: 16), Text(_pause.reference, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
          const SizedBox(height: 32), Text(_pause.prayer, textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.7, color: AppColors.mutedForeground)),
        ])),
      ])),
      Padding(padding: const EdgeInsets.fromLTRB(24, 12, 24, 16), child: SizedBox(width: double.infinity, child: FilledButton(
        onPressed: () { Analytics.capture('scripture_gate_completed', {'mode': _bible ? 'bible' : 'prayer'}); Navigator.of(context).maybePop(); },
        style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, minimumSize: const Size(double.infinity, 48), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), shape: const StadiumBorder()),
        child: Text(l.t(widget.showcase ? 'bible.close' : _bible ? 'ps.bible.done' : 'ps.prayer.done'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 14))))),
    ])));
  }
}
