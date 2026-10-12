import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/bible_reader_service.dart';
import 'onboarding_motion.dart';
import 'onboarding_shared.dart';
import 'verse_slide.dart' show OnbHeadline;

/// 1:1 port of `BibleSlide` from `src/components/onboarding/BibleSlide.tsx`:
/// a mini vertical verse feed (John 3:16, 14:27, 8:12 in the app language)
/// with like/note/share rail, then three feature rows.
class BibleSlide extends StatefulWidget {
  const BibleSlide({super.key});
  @override
  State<BibleSlide> createState() => _BibleSlideState();
}

class _BibleSlideState extends State<BibleSlide> {
  static const _picks = [[2, 15], [13, 26], [7, 11]];
  static const _john = 42;
  final _cards = <(String, String)>[];
  int _idx = 0;
  bool _liked = false;
  Timer? _cycle;
  Timer? _like;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final lang = L10n.current.lang;
      final e = await BibleReaderService.edition(lang);
      final bi = e.books.indexWhere((b) => b.canonicalId == _john);
      if (bi < 0) return;
      final ch = await BibleReaderService.book(lang, bi);
      if (!mounted) return;
      setState(() {
        for (final p in _picks) {
          final text = p[0] < ch.length && p[1] < ch[p[0]].length ? ch[p[0]][p[1]].replaceFirst(RegExp(r'^[\s,;:.]+'), '') : '';
          if (text.isNotEmpty) _cards.add(('${e.books[bi].name} ${p[0] + 1}:${p[1] + 1}', text));
        }
      });
      _like = Timer(const Duration(milliseconds: 1300), () => mounted ? setState(() => _liked = true) : null);
      _cycle = Timer.periodic(const Duration(milliseconds: 2800), (_) {
        if (!mounted || _cards.length < 2) return;
        setState(() { _idx = (_idx + 1) % _cards.length; _liked = false; });
        _like?.cancel();
        _like = Timer(const Duration(milliseconds: 1300), () => mounted ? setState(() => _liked = true) : null);
      });
    } catch (_) {}
  }

  @override
  void dispose() {
    _cycle?.cancel();
    _like?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final gold = onbTone(42, 95, 64);
    final features = [
      (Icons.translate, t('onb.bible.f1')),
      (Icons.view_day_outlined, t('onb.bible.f2')),
      (Icons.lock_outline, t('onb.bible.f3')),
    ];
    return Stack(children: [
      const Positioned.fill(
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(center: Alignment(0, -0.3), radius: 0.9, colors: [Color(0xFF0F1A36), Color(0xFF050A19)], stops: [0, 0.7]),
          ),
        ),
      ),
      Positioned(
        top: MediaQuery.sizeOf(context).height * 0.14,
        left: (MediaQuery.sizeOf(context).width - 460) / 2,
        child: const OnbAmbientGlow(size: 460, color: Color(0xFFE5B44C), peak: 0.45, trough: 0.25),
      ),
      SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(28, 36, 28, 128),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 420),
            child: Column(children: onbStagger([
              SizedBox(height: MediaQuery.paddingOf(context).top),
              Opacity(opacity: 0.75, child: Text(t('onb.bible.kicker').toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700, letterSpacing: 4, color: Color(0xFFE5B44C)))),
              const SizedBox(height: 12),
              OnbHeadline(pre: t('onb.bible.headlinePre'), gold: t('onb.bible.headlineGold'), size: 25),
              const SizedBox(height: 20),
              Container(
                width: 230,
                height: 300,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: onbTone(42, 80, 60, 0.35)),
                  boxShadow: [
                    BoxShadow(color: onbTone(42, 90, 50, 0.35), blurRadius: 60, offset: const Offset(0, 24), spreadRadius: -18),
                    BoxShadow(color: onbTone(222, 50, 10, 0.8), spreadRadius: 6),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Stack(fit: StackFit.expand, children: [
                    Opacity(opacity: 0.4, child: Image.asset('assets/images/onboarding-bg-sunrise.webp', fit: BoxFit.cover)),
                    DecoratedBox(decoration: BoxDecoration(gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [onbTone(222, 60, 6, 0.55), onbTone(222, 60, 5, 0.92)]))),
                    Positioned(top: 12, left: 0, right: 0, child: Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                      Text(t('bible.feed'), style: TextStyle(color: gold, fontSize: 10, fontWeight: FontWeight.w700, decoration: TextDecoration.underline, decorationColor: gold)),
                      const SizedBox(width: 16),
                      Text(t('bible.normal'), style: TextStyle(color: Onb.ink(0.5), fontSize: 10, fontWeight: FontWeight.w700)),
                    ])),
                    if (_cards.isEmpty)
                      Center(child: Icon(Icons.menu_book, color: gold, size: 32))
                    else
                      AnimatedSwitcher(
                        duration: const Duration(milliseconds: 550),
                        switchInCurve: Onb.easeOutExpo,
                        switchOutCurve: Curves.easeIn,
                        transitionBuilder: (child, anim) {
                          final incoming = child.key == ValueKey(_idx);
                          final offset = Tween<Offset>(begin: Offset(0, incoming ? 1 : -1), end: Offset.zero).animate(anim);
                          return SlideTransition(position: offset, child: FadeTransition(opacity: anim, child: child));
                        },
                        child: Padding(
                          key: ValueKey(_idx),
                          padding: const EdgeInsets.fromLTRB(20, 40, 48, 40),
                          child: Column(mainAxisAlignment: MainAxisAlignment.center, crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Text(_cards[_idx].$1.toUpperCase(), style: TextStyle(color: gold, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1.6)),
                            const SizedBox(height: 12),
                            Text(_cards[_idx].$2, maxLines: 6, overflow: TextOverflow.ellipsis, style: TextStyle(fontFamily: 'Cormorant Garamond', fontSize: 16, height: 1.4, color: Onb.ink(0.95))),
                          ]),
                        ),
                      ),
                    Positioned(right: 12, bottom: 24, child: Column(children: [
                      AnimatedScale(scale: _liked ? 1.2 : 1, duration: const Duration(milliseconds: 250), child: Icon(_liked ? Icons.favorite : Icons.favorite_border, size: 20, color: _liked ? gold : Onb.ink(0.8))),
                      const SizedBox(height: 16),
                      Icon(Icons.chat_bubble_outline, size: 19, color: Onb.ink(0.8)),
                      const SizedBox(height: 16),
                      Icon(Icons.share_outlined, size: 18, color: Onb.ink(0.8)),
                    ])),
                  ]),
                ),
              ),
              const SizedBox(height: 20),
              ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 310),
                child: Opacity(opacity: 0.7, child: Text(t('onb.bible.subcopy'), textAlign: TextAlign.center, style: TextStyle(fontSize: 12.5, height: 1.5, color: onbTone(40, 22, 82)))),
              ),
              const SizedBox(height: 16),
              for (final f in features)
                Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 320),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(color: onbTone(222, 45, 12, 0.7), borderRadius: BorderRadius.circular(16), border: Border.all(color: onbTone(42, 70, 60, 0.18))),
                      child: Row(children: [
                        Container(width: 28, height: 28, decoration: BoxDecoration(color: onbTone(42, 90, 55, 0.16), borderRadius: BorderRadius.circular(10)), child: Icon(f.$1, size: 15, color: gold)),
                        const SizedBox(width: 12),
                        Expanded(child: Text(f.$2, style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w600, color: Onb.ink(0.9)))),
                      ]),
                    ),
                  ),
                ),
            ])),
          ),
        ),
      ),
    ]);
  }
}
