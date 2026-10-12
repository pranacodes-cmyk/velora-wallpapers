import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/bible_reader_service.dart';
import '../../core/services/bible_gate_service.dart';
import '../../core/services/prefs.dart';
import '../../core/services/prayer_pause_store.dart';
import '../../core/services/pray_screen_service.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';

/// A single sacred-pause route: changing modes never dismisses the guard flow.
/// Bible here is Pro-only (the main Bible tab stays free); one chapter at a time.
class ScriptureGateScreen extends ConsumerStatefulWidget {
  const ScriptureGateScreen({super.key, this.showcase = false, this.initialBible = true, this.pause});
  final bool showcase, initialBible;
  final PrayerPause? pause;
  @override
  ConsumerState<ScriptureGateScreen> createState() => _ScriptureGateScreenState();
}

class _ScriptureGateScreenState extends ConsumerState<ScriptureGateScreen> {
  final _scroll = ScrollController();
  ReaderEdition? _edition;
  List<String>? _verses;
  int _book = 0, _chapter = 0;
  bool _error = false;
  late bool _bible;
  late final PrayerPause _pause;
  String get _lang => L10n.current.lang;
  static const _positionKey = 'ps_bible_chapter_v1';

  @override
  void initState() {
    super.initState();
    _bible = widget.initialBible && ref.read(premiumProvider);
    _pause = widget.pause ?? PrayerPauseStore.at(DateTime.now().day);
    try {
      final pos = jsonDecode(Prefs.getString(_positionKey) ?? '{}') as Map<String, dynamic>;
      _book = (pos['book'] as num?)?.toInt() ?? 0;
      _chapter = (pos['chapter'] as num?)?.toInt() ?? 0;
    } catch (_) {}
    if (_bible) _load();
  }

  @override
  void dispose() { _scroll.dispose(); super.dispose(); }

  Future<void> _load() async {
    setState(() { _error = false; _verses = null; });
    try {
      final edition = _edition ?? await BibleReaderService.edition(_lang);
      final book = _book.clamp(0, edition.books.length - 1).toInt();
      final data = await BibleReaderService.book(_lang, book);
      final chapter = _chapter.clamp(0, data.length - 1).toInt();
      if (!mounted) return;
      setState(() { _edition = edition; _book = book; _chapter = chapter; _verses = data[chapter]; });
      if (_scroll.hasClients) _scroll.jumpTo(0);
      await Prefs.setString(_positionKey, jsonEncode({'book': book, 'chapter': chapter, 'verse': 0}));
    } catch (_) { if (mounted) setState(() => _error = true); }
  }

  void _go(int delta) {
    final e = _edition;
    if (e == null) return;
    var book = _book, chapter = _chapter + delta;
    if (chapter >= e.books[book].chapters) { book = (book + 1) % e.books.length; chapter = 0; }
    if (chapter < 0) { book = (book - 1 + e.books.length) % e.books.length; chapter = e.books[book].chapters - 1; }
    _book = book; _chapter = chapter;
    _load();
  }

  void _openPremium() {
    showModalBottomSheet(context: context, isScrollControlled: true, backgroundColor: Colors.transparent,
      builder: (sheet) => PremiumSheet(trigger: 'scripture_gate_bible', onClose: () => Navigator.pop(sheet), onUnlock: () {
        ref.read(premiumProvider.notifier).setUnlocked();
        if (mounted) _select(true);
      }));
  }

  void _select(bool bible) {
    if (bible && !ref.read(premiumProvider)) { Analytics.capture('scripture_gate_bible_locked'); _openPremium(); return; }
    setState(() => _bible = bible);
    if (bible && _verses == null) _load();
    BibleGateService.setEnabled(bible).then((_) => PrayScreenService.pushBlockerCopy());
    Analytics.capture('scripture_gate_mode_changed', {'mode': bible ? 'bible' : 'prayer'});
  }

  Widget _picker<T>({required T value, required List<DropdownMenuItem<T>> items, required ValueChanged<T> onChanged}) => Container(
    height: 40, padding: const EdgeInsets.symmetric(horizontal: 12),
    decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(20), border: Border.all(color: AppColors.border)),
    child: DropdownButtonHideUnderline(child: DropdownButton<T>(value: value, isExpanded: true, items: items, dropdownColor: AppColors.card,
      style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.foreground),
      onChanged: (v) { if (v != null) onChanged(v); })));

  Widget _bibleView(L10n l) {
    final e = _edition;
    final verses = _verses;
    return Column(children: [
      if (e != null) Padding(padding: const EdgeInsets.fromLTRB(24, 8, 24, 0), child: Row(children: [
        Expanded(child: _picker<int>(value: _book, items: [for (var i = 0; i < e.books.length; i++) DropdownMenuItem(value: i, child: Text(e.books[i].name, overflow: TextOverflow.ellipsis))],
          onChanged: (v) { _book = v; _chapter = 0; _load(); })),
        const SizedBox(width: 8),
        SizedBox(width: 132, child: _picker<int>(value: _chapter, items: [for (var i = 0; i < e.books[_book].chapters; i++) DropdownMenuItem(value: i, child: Text('${l.t('bible.chapter')} ${i + 1}', overflow: TextOverflow.ellipsis))],
          onChanged: (v) { _chapter = v; _load(); })),
      ])),
      Expanded(child: _error
        ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Text(l.t('bible.error'), textAlign: TextAlign.center, style: TextStyle(color: AppColors.mutedForeground)), TextButton(onPressed: _load, child: Text(l.t('bible.retry')))]))
        : verses == null || e == null
          ? Center(child: Text(l.t('bible.loading'), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)))
          : ListView(controller: _scroll, padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20), children: [
              Padding(padding: const EdgeInsets.only(bottom: 20), child: Text('${e.books[_book].name} · ${l.t('bible.chapter')} ${_chapter + 1}', textAlign: TextAlign.center, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: AppColors.primary))),
              for (var i = 0; i < verses.length; i++) Padding(padding: const EdgeInsets.only(bottom: 16), child: Text.rich(TextSpan(children: [
                TextSpan(text: '${i + 1}  ', style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
                TextSpan(text: verses[i]),
              ]), style: TextStyle(fontSize: 19, height: 1.6, color: AppColors.foreground))),
              const SizedBox(height: 12),
              Row(children: [
                Expanded(child: OutlinedButton.icon(onPressed: () => _go(-1), icon: const Icon(Icons.chevron_left, size: 18), label: Text(l.t('bible.previous'), overflow: TextOverflow.ellipsis), style: OutlinedButton.styleFrom(foregroundColor: AppColors.foreground, shape: const StadiumBorder()))),
                const SizedBox(width: 8),
                Expanded(child: OutlinedButton(onPressed: () => _go(1), style: OutlinedButton.styleFrom(foregroundColor: AppColors.foreground, shape: const StadiumBorder()), child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [Flexible(child: Text(l.t('bible.next'), overflow: TextOverflow.ellipsis)), const Icon(Icons.chevron_right, size: 18)]))),
              ]),
              Padding(padding: const EdgeInsets.only(top: 20), child: Text(e.name, textAlign: TextAlign.center, style: TextStyle(fontSize: 11, color: AppColors.mutedForeground))),
            ])),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final l = L10n.current;
    final premium = ref.watch(premiumProvider);
    return Scaffold(backgroundColor: AppColors.background, body: SafeArea(child: Column(children: [
      Padding(padding: const EdgeInsets.fromLTRB(24, 16, 24, 8),
        child: SegmentedButton<bool>(showSelectedIcon: false,
          segments: [ButtonSegment(value: true, icon: Icon(premium ? Icons.menu_book_outlined : Icons.workspace_premium_outlined), label: Text(l.t('bible.title'))),
            ButtonSegment(value: false, icon: const Icon(Icons.favorite_outline), label: Text(l.t('ps.mode.prayer')))],
          selected: {_bible}, onSelectionChanged: (v) => _select(v.first),
          style: SegmentedButton.styleFrom(selectedBackgroundColor: AppColors.secondary,
            selectedForegroundColor: AppColors.foreground, foregroundColor: AppColors.mutedForeground))),
      Expanded(child: _bible ? _bibleView(l) : SingleChildScrollView(padding: const EdgeInsets.symmetric(horizontal: 28, vertical: 32), child: Column(children: [
          Text(l.t('ps.prayer.kicker'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
          const SizedBox(height: 24), Text('“${_pause.verse}”', textAlign: TextAlign.center, style: TextStyle(fontSize: 26, height: 1.5, color: AppColors.foreground)),
          const SizedBox(height: 16), Text(_pause.reference, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primary)),
          const SizedBox(height: 32), Text(_pause.prayer, textAlign: TextAlign.center, style: TextStyle(fontSize: 16, height: 1.7, color: AppColors.mutedForeground)),
        ]))),
      Padding(padding: const EdgeInsets.fromLTRB(24, 12, 24, 16), child: SizedBox(width: double.infinity, child: FilledButton(
        onPressed: () { Analytics.capture('scripture_gate_completed', {'mode': _bible ? 'bible' : 'prayer'}); Navigator.of(context).maybePop(); },
        style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, minimumSize: const Size(double.infinity, 48), padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12), shape: const StadiumBorder()),
        child: Text(l.t(widget.showcase ? 'bible.close' : _bible ? 'ps.bible.done' : 'ps.prayer.done'), textAlign: TextAlign.center, style: const TextStyle(fontSize: 14))))),
    ])));
  }
}
