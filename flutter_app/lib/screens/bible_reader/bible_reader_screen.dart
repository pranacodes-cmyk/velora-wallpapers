import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/bible_reader_service.dart';
import '../../core/services/prefs.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';

class BibleReaderScreen extends StatefulWidget {
  const BibleReaderScreen({super.key, this.inTab = false});
  final bool inTab;
  @override
  State<BibleReaderScreen> createState() => _BibleReaderScreenState();
}

class _BibleReaderScreenState extends State<BibleReaderScreen> {
  static const _prefsKey = 'prayly_bible_reader_v1';
  static const _likesKey = 'prayly_bible_likes_v1';
  static const _notesKey = 'prayly_bible_notes_v1';
  late String _language;
  int _book = 0, _chapter = 0, _verse = 0, _loadToken = 0;
  double _size = 26;
  String _mode = 'feed', _font = 'serif', _theme = 'night';
  bool _loading = true, _error = false, _savedOnly = false;
  ReaderEdition? _edition;
  List<List<String>> _chapters = [];
  Set<String> _likes = {};
  Map<String, String> _notes = {};
  PageController? _pages;
  Color get _bg => _theme == 'night' ? AppColors.darkBackground : AppColors.lightBackground;
  Color get _fg => _theme == 'night' ? AppColors.darkForeground : AppColors.lightForeground;
  Color get _gold => _theme == 'night' ? AppColors.darkPrimary : AppColors.lightPrimary;
  Color get _surface => _theme == 'night' ? AppColors.darkCard : AppColors.lightCard;
  List<String> get _verses => _chapter < _chapters.length ? _chapters[_chapter] : const [];
  String _key(int i) => '${_edition?.books[_book].canonicalId ?? _book}:$_chapter:$i';
  String _reference(int i) => '${_edition?.books[_book].name ?? ''} ${_chapter + 1}:${i + 1}';

  @override
  void initState() {
    super.initState();
    Analytics.capture('bible_opened');
    final savedLanguage = Prefs.getString('prayly_bible_language_v1');
    _language = kLanguages.any((l) => l.code == savedLanguage) ? savedLanguage! : L10n.current.lang;
    try {
      final p = jsonDecode(Prefs.getString(_prefsKey) ?? '{}') as Map<String, dynamic>;
      _book = (p['book'] as num?)?.toInt() ?? 0;
      _chapter = (p['chapter'] as num?)?.toInt() ?? 0;
      _verse = (p['verse'] as num?)?.toInt() ?? 0;
      _size = ((p['size'] as num?)?.toDouble() ?? 26).clamp(18, 34);
      _mode = p['mode'] == 'normal' ? 'normal' : 'feed';
      _font = p['font'] == 'sans' ? 'sans' : 'serif';
      _theme = p['theme'] == 'paper' ? 'paper' : 'night';
      _likes = (jsonDecode(Prefs.getString(_likesKey) ?? '[]') as List<dynamic>).map((v) => v.toString()).toSet();
      _notes = (jsonDecode(Prefs.getString(_notesKey) ?? '{}') as Map<String, dynamic>).map((k, v) => MapEntry(k, v.toString()));
    } catch (_) {}
    _load();
  }
  void _persist() {
    Prefs.setString(_prefsKey, jsonEncode({'book': _book, 'chapter': _chapter, 'verse': _verse, 'size': _size.toInt(), 'mode': _mode, 'font': _font, 'theme': _theme}));
  }
  Future<void> _load() async {
    final token = ++_loadToken;
    setState(() { _loading = true; _error = false; });
    try {
      final e = await BibleReaderService.edition(_language);
      if (!mounted || token != _loadToken) return;
      _book = _book.clamp(0, e.books.length - 1);
      final c = await BibleReaderService.book(_language, _book);
      if (!mounted || token != _loadToken) return;
      setState(() { _edition = e; _chapters = c; _chapter = _chapter.clamp(0, c.length - 1); _verse = _verse.clamp(0, _verses.length - 1); _loading = false; });
      Analytics.capture('bible_chapter_viewed', {'lang': _language, 'book': _book, 'book_name': e.books[_book].name, 'chapter': _chapter + 1});
      _persist();
    } catch (_) { if (mounted && token == _loadToken) setState(() { _loading = false; _error = true; }); }
  }
  @override
  void dispose() { _pages?.dispose(); super.dispose(); }

  void _like(int i) {
    Analytics.capture('bible_verse_liked', {'ref': _key(i), 'liked': !_likes.contains(_key(i))});
    HapticFeedback.lightImpact();
    setState(() { if (!_likes.add(_key(i))) _likes.remove(_key(i)); });
    Prefs.setString(_likesKey, jsonEncode(_likes.toList()));
  }
  Future<void> _note(int i) async {
    final key = _key(i);
    final controller = TextEditingController(text: _notes[key] ?? '');
    await showModalBottomSheet<void>(context: context, isScrollControlled: true, backgroundColor: _surface, builder: (ctx) => SafeArea(child: Padding(
      padding: EdgeInsets.fromLTRB(24, 24, 24, MediaQuery.viewInsetsOf(ctx).bottom + 24),
      child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, crossAxisAlignment: CrossAxisAlignment.start, children: [
        Text(t('bible.notes'), style: TextStyle(color: _fg, fontSize: 20, fontWeight: FontWeight.w700)),
        const SizedBox(height: 8), Text(_reference(i), style: TextStyle(color: _gold)),
        const SizedBox(height: 8), Text(t('bible.private'), style: TextStyle(color: _fg.withValues(alpha: .6), fontSize: 12)),
        const SizedBox(height: 16), TextField(controller: controller, minLines: 4, maxLines: 7, maxLength: 4000, style: TextStyle(color: _fg), decoration: InputDecoration(hintText: t('bible.placeholder'), hintStyle: TextStyle(color: _fg.withValues(alpha: .4)), filled: true, fillColor: _bg)),
        const SizedBox(height: 12), Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
          TextButton(onPressed: () { setState(() => _notes.remove(key)); Prefs.setString(_notesKey, jsonEncode(_notes)); Navigator.pop(ctx); }, child: Text(t('bible.delete'), style: TextStyle(color: _gold))),
          FilledButton(onPressed: () { setState(() { if (controller.text.trim().isEmpty) { _notes.remove(key); } else { _notes[key] = controller.text.trim(); } }); Prefs.setString(_notesKey, jsonEncode(_notes)); HapticFeedback.lightImpact(); Navigator.pop(ctx); }, style: FilledButton.styleFrom(backgroundColor: _gold, foregroundColor: _bg), child: Text(t('bible.save'))),
        ]),
      ])),
    )));
    controller.dispose();
  }
  Widget _actions(int i, {bool vertical = false}) {
    final controls = <Widget>[
      IconButton(tooltip: t('bible.like'), onPressed: () => _like(i), icon: Icon(_likes.contains(_key(i)) ? Icons.favorite : Icons.favorite_border, color: _likes.contains(_key(i)) ? _gold : _fg, size: 26)),
      IconButton(tooltip: t('bible.notes'), onPressed: () => _note(i), icon: Icon(_notes.containsKey(_key(i)) ? Icons.mode_comment : Icons.mode_comment_outlined, color: _notes.containsKey(_key(i)) ? _gold : _fg, size: 25)),
      IconButton(tooltip: t('bible.share'), onPressed: () { Analytics.capture('bible_verse_shared', {'book': _book, 'chapter': _chapter + 1, 'verse': i + 1}); ShareService.share(title: 'Prayly: Bible Prayer & Verse', text: '${_verses[i]}\n\n${_reference(i)} · ${_edition?.name}\nPrayly: Bible Prayer & Verse'); }, icon: Icon(Icons.share_outlined, color: _fg, size: 24)),
    ];
    return vertical ? Column(mainAxisSize: MainAxisSize.min, children: controls.expand((w) => [w, const SizedBox(height: 16)]).toList()) : Row(mainAxisSize: MainAxisSize.min, children: controls);
  }
  TextStyle get _textStyle => TextStyle(fontFamily: _font == 'serif' ? 'Cormorant Garamond' : 'Inter', fontSize: _size, height: 1.55, color: _fg, letterSpacing: 0);
  // Free users: one interstitial per 18 verses read or per finished chapter.
  // AdsService already skips Pro users and enforces the 45s global cooldown.
  static const _versesPerAd = 18;
  static const _adKey = 'prayly_bible_ad_count_v1';
  void _verseAd() {
    final n = (int.tryParse(Prefs.getString(_adKey) ?? '0') ?? 0) + 1;
    if (n >= _versesPerAd) {
      AdsService.tryShowInterstitial('bible_verses').then((shown) => Prefs.setString(_adKey, shown ? '0' : '$n'));
    } else {
      Prefs.setString(_adKey, '$n');
    }
  }
  void _chapterAd() {
    AdsService.tryShowInterstitial('bible_chapter').then((shown) { if (shown) Prefs.setString(_adKey, '0'); });
  }
  Future<void> _chapterMove(int direction) async {
    var b = _book, c = _chapter + direction;
    if (c >= _chapters.length) { b++; c = 0; }
    if (c < 0) { b--; c = b >= 0 ? (_edition?.books[b].chapters ?? 1) - 1 : 0; }
    if (b < 0 || b >= (_edition?.books.length ?? 66)) return;
    if (direction > 0) _chapterAd();
    final changedBook = b != _book;
    setState(() { _book = b; _chapter = c; _verse = 0; });
    if (changedBook) await _load();
    _persist();
  }
  void _books() {
    var query = '';
    showModalBottomSheet<void>(context: context, isScrollControlled: true, backgroundColor: _surface, builder: (ctx) => StatefulBuilder(builder: (ctx, refresh) => SafeArea(child: SizedBox(height: MediaQuery.sizeOf(ctx).height * .8, child: Padding(padding: const EdgeInsets.all(20), child: Column(children: [
      Row(children: [Expanded(child: Text(t('bible.books'), style: TextStyle(color: _fg, fontSize: 20, fontWeight: FontWeight.w700))), IconButton(tooltip: t('bible.close'), onPressed: () => Navigator.pop(ctx), icon: Icon(Icons.close, color: _fg))]),
      TextField(style: TextStyle(color: _fg), decoration: InputDecoration(hintText: t('bible.search'), hintStyle: TextStyle(color: _fg.withValues(alpha: .5))), onChanged: (v) => refresh(() => query = v)),
      Expanded(child: ListView(children: [for (var b = 0; b < (_edition?.books.length ?? 0); b++) if ((_edition?.books[b].name ?? '').toLowerCase().contains(query.toLowerCase())) ExpansionTile(key: ValueKey('$_language:$b'), textColor: _gold, collapsedTextColor: _fg, iconColor: _gold, collapsedIconColor: _fg, title: Text(_edition?.books[b].name ?? ''), children: [Wrap(spacing: 6, runSpacing: 6, children: [for (var c = 0; c < (_edition?.books[b].chapters ?? 0); c++) SizedBox(width: 46, child: OutlinedButton(style: OutlinedButton.styleFrom(foregroundColor: _gold, padding: EdgeInsets.zero), onPressed: () { final changedBook = b != _book; setState(() { _book = b; _chapter = c; _verse = 0; }); Navigator.pop(ctx); if (changedBook) _load(); _persist(); }, child: Text('${c + 1}')))]), const SizedBox(height: 14)])])),
    ]))))));
  }
  void _style() {
    showModalBottomSheet<void>(context: context, isScrollControlled: true, backgroundColor: _surface, builder: (ctx) => StatefulBuilder(builder: (ctx, refresh) {
      void change(VoidCallback cb) { setState(cb); refresh(() {}); _persist(); }
      return SafeArea(child: SingleChildScrollView(child: Padding(padding: const EdgeInsets.all(24), child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
        Row(children: [Expanded(child: Text(t('bible.appearance'), style: TextStyle(color: _fg, fontSize: 20, fontWeight: FontWeight.w700))), IconButton(onPressed: () => Navigator.pop(ctx), tooltip: t('bible.close'), icon: Icon(Icons.close, color: _fg))]),
        const SizedBox(height: 14), Text(t('bible.language'), style: TextStyle(color: _fg)),
        DropdownButton<String>(value: _language, isExpanded: true, dropdownColor: _surface, style: TextStyle(color: _fg), items: kLanguages.map((l) => DropdownMenuItem(value: l.code, child: Text(l.native))).toList(), onChanged: (v) { if (v == null) return; change(() { _language = v; _book = 0; _chapter = 0; _verse = 0; }); Prefs.setString('prayly_bible_language_v1', v); _load(); }),
        const SizedBox(height: 18), Text(t('bible.font'), style: TextStyle(color: _fg)),
        Wrap(spacing: 10, children: [for (final font in ['serif', 'sans']) ChoiceChip(label: Text(t('bible.$font')), selected: _font == font, onSelected: (_) => change(() => _font = font))]),
        const SizedBox(height: 18), Text('${t('bible.size')} · ${_size.toInt()}', style: TextStyle(color: _fg)), Slider(value: _size, min: 18, max: 34, divisions: 8, activeColor: _gold, onChanged: (v) => change(() => _size = v)),
        Text(t('bible.theme'), style: TextStyle(color: _fg)), Wrap(spacing: 10, children: [for (final theme in ['night', 'paper']) ChoiceChip(label: Text(t('bible.$theme')), selected: _theme == theme, onSelected: (_) { change(() => _theme = theme); Navigator.pop(ctx); })]),
        const SizedBox(height: 20), Text('${_edition?.name ?? ''} · ${_edition?.license ?? ''}', style: TextStyle(color: _fg.withValues(alpha: .6), fontSize: 12)),
        const SizedBox(height: 8), SelectableText(_edition?.source ?? '', style: TextStyle(color: _gold, fontSize: 12)),
      ]))));
    }));
  }

  @override
  Widget build(BuildContext context) {
    final indices = [for (var i = 0; i < _verses.length; i++) if (_verses[i].isNotEmpty && (!_savedOnly || _likes.contains(_key(i)))) i];
    return Scaffold(backgroundColor: _bg, body: SafeArea(child: Column(children: [
      Padding(padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8), child: Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [
        widget.inTab ? const SizedBox(width: 48) : IconButton(tooltip: t('bible.close'), onPressed: () => Navigator.maybePop(context), icon: Icon(Icons.arrow_back, color: _fg)),
        Row(children: [for (final mode in ['feed', 'normal']) TextButton(onPressed: () { setState(() => _mode = mode); _persist(); }, child: Text(t('bible.$mode'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: _mode == mode ? _gold : _fg.withValues(alpha: .5))))]),
        IconButton(tooltip: t('bible.appearance'), onPressed: _style, icon: Icon(Icons.tune, color: _fg)),
      ])),
      Row(children: [const SizedBox(width: 16), Expanded(child: TextButton(onPressed: _edition == null ? null : _books, child: Row(children: [Icon(Icons.menu_book, size: 18, color: _gold), const SizedBox(width: 8), Flexible(child: Text('${_edition?.books[_book].name ?? t('bible.title')} ${_chapter + 1}', overflow: TextOverflow.ellipsis, style: TextStyle(color: _fg))), Icon(Icons.expand_more, size: 18, color: _fg)]))), IconButton(tooltip: t('bible.saved'), onPressed: () => setState(() => _savedOnly = !_savedOnly), icon: Icon(_savedOnly ? Icons.bookmark : Icons.bookmark_border, color: _savedOnly ? _gold : _fg)), const SizedBox(width: 12)]),
      Expanded(child: _loading || _error ? Center(child: Column(mainAxisSize: MainAxisSize.min, children: [Icon(Icons.menu_book, color: _gold, size: 36), const SizedBox(height: 20), Padding(padding: const EdgeInsets.all(24), child: Text(t(_error ? 'bible.error' : 'bible.loading'), textAlign: TextAlign.center, style: TextStyle(color: _fg))), if (_error) TextButton(onPressed: _load, child: Text(t('bible.retry')))])) : indices.isEmpty ? Center(child: Text(t('bible.empty'), style: TextStyle(color: _fg))) : _mode == 'feed' ? _feed(indices) : ListView(key: ValueKey('normal:$_book:$_chapter:$_language:$_savedOnly'), padding: const EdgeInsets.fromLTRB(28, 28, 28, 40), children: [
        Text(_edition?.name ?? '', style: TextStyle(color: _gold, fontSize: 12)), const SizedBox(height: 8), Text('${_edition?.books[_book].name} ${_chapter + 1}', style: _textStyle.copyWith(fontSize: 32)), const SizedBox(height: 30),
        for (final i in indices) Padding(padding: const EdgeInsets.only(bottom: 28), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [Text.rich(TextSpan(children: [TextSpan(text: '${i + 1}  ', style: TextStyle(color: _gold, fontSize: 12)), TextSpan(text: _verses[i])]), style: _textStyle), Align(alignment: Alignment.centerRight, child: _actions(i))])),
      ])),
      Row(mainAxisAlignment: MainAxisAlignment.spaceBetween, children: [IconButton(tooltip: t('bible.previous'), onPressed: _book == 0 && _chapter == 0 ? null : () => _chapterMove(-1), icon: Icon(Icons.chevron_left, color: _gold)), Text(_mode == 'feed' ? '${_verse + 1} / ${_verses.length}' : '${t('bible.chapter')} ${_chapter + 1}', style: TextStyle(color: _fg.withValues(alpha: .6), fontSize: 12)), IconButton(tooltip: t('bible.next'), onPressed: _book == (_edition?.books.length ?? 66) - 1 && _chapter == _chapters.length - 1 ? null : () => _chapterMove(1), icon: Icon(Icons.chevron_right, color: _gold))]),
      if (widget.inTab) SizedBox(height: 84 + MediaQuery.paddingOf(context).bottom),
    ])));
  }
  Widget _feed(List<int> indices) {
    return _VerseFeed(key: ValueKey('$_book:$_chapter:$_language:$_savedOnly'), indices: indices, initialVerse: _verse, onChanged: (i) { if (i != _verse) _verseAd(); setState(() => _verse = i); _persist(); }, builder: (i) => Stack(fit: StackFit.expand, children: [
      if (_theme == 'night') Opacity(opacity: .18, child: Image.asset('assets/images/onboarding-bg-sunrise.webp', fit: BoxFit.cover)),
      Center(child: Padding(padding: const EdgeInsets.fromLTRB(28, 24, 80, 24), child: SingleChildScrollView(child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [Text(_reference(i), style: TextStyle(color: _gold, fontSize: 12, fontWeight: FontWeight.w700)), const SizedBox(height: 24), Text(_verses[i], style: _textStyle), const SizedBox(height: 28), Text(_edition?.name ?? '', style: TextStyle(color: _fg.withValues(alpha: .55), fontSize: 11))])))),
      Positioned(right: 12, bottom: 24, child: _actions(i, vertical: true)),
    ]));
  }
}

class _VerseFeed extends StatefulWidget {
  const _VerseFeed({super.key, required this.indices, required this.initialVerse, required this.onChanged, required this.builder});
  final List<int> indices;
  final int initialVerse;
  final ValueChanged<int> onChanged;
  final Widget Function(int) builder;
  @override
  State<_VerseFeed> createState() => _VerseFeedState();
}
class _VerseFeedState extends State<_VerseFeed> {
  late final PageController _controller = PageController(initialPage: widget.indices.indexOf(widget.initialVerse).clamp(0, widget.indices.length - 1));
  @override
  void dispose() { _controller.dispose(); super.dispose(); }
  @override
  Widget build(BuildContext context) => PageView.builder(controller: _controller, scrollDirection: Axis.vertical, itemCount: widget.indices.length, onPageChanged: (i) => widget.onChanged(widget.indices[i]), itemBuilder: (_, i) => widget.builder(widget.indices[i]));
}