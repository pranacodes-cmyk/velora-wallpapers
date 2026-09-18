import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import 'onboarding_shared.dart';
import 'verse_slide.dart' show OnbHeadline;

/// 1:1 port of `src/components/onboarding/OnboardingLateSlides.tsx`
/// — the three slides the live flow actually uses:
///   slide 2 PrayerSlide, slide 3 BibleChatSlide, slide 4 FocusSlide.
/// (The Time and Name slides in that file are dead code on web: the flow has
/// only 5 steps and Focus is the last one.)

/// Exact HSL → Color conversion so every value matches the web CSS literally.
Color h(double hue, double s, double l, [double a = 1]) =>
    HSLColor.fromAHSL(a, hue, s / 100, l / 100).toColor();

const _devotionalBg = 'assets/images/divine-bg-dark.webp';

// =============================================================================
// SLIDE 2 — Daily Bible Prayer
// =============================================================================
class PrayerSlide extends StatelessWidget {
  const PrayerSlide({super.key});

  static const _waveHeights = [
    8.0,
    14.0,
    10.0,
    18.0,
    12.0,
    16.0,
    9.0,
    20.0,
    11.0,
    15.0,
    8.0,
    13.0,
    17.0,
    10.0,
    14.0,
  ];

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        // Warm prayer background at the Android peak opacity (0.65)
        Positioned.fill(
          child: Opacity(
            opacity: Onb.bgPeak(0.45),
            child: Image.asset(_devotionalBg, fit: BoxFit.cover),
          ),
        ),
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  h(220, 50, 6, 0.55),
                  h(220, 55, 6, 0.78),
                  h(220, 65, 4),
                ],
                stops: const [0, 0.55, 1],
              ),
            ),
          ),
        ),
        // Golden halo
        Positioned(
          top: MediaQuery.of(context).size.height * 0.30,
          left: (MediaQuery.of(context).size.width - 380) / 2,
          child: IgnorePointer(
            child: Opacity(
              opacity: 0.35,
              child: SizedBox(
                width: 380,
                height: 380,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [h(42, 85, 55, 0.28), Colors.transparent],
                      stops: const [0, 0.65],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(32, 0, 32, 112),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top + 56),
                  Opacity(
                    opacity: 0.85,
                    child: Text(
                      t('onb.prayer.kicker').toUpperCase(),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 4,
                        color: h(42, 75, 60),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OnbHeadline(
                    pre: t('onb.prayer.headlinePre'),
                    gold: t('onb.prayer.headlineGold'),
                  ),
                  const SizedBox(height: 12),
                  Opacity(
                    opacity: 0.75,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 320),
                      child: Text(
                        t('onb.prayer.subcopy'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.55,
                          color: h(40, 22, 80),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  // Prayer card with narration row
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomRight,
                        colors: [h(220, 45, 14, 0.85), h(220, 55, 8, 0.95)],
                      ),
                      border: Border.all(color: h(42, 60, 50, 0.22)),
                      boxShadow: [
                        BoxShadow(
                          color: h(0, 0, 0, 0.8),
                          blurRadius: 60,
                          spreadRadius: -20,
                          offset: const Offset(0, 30),
                        ),
                        BoxShadow(
                          color: h(42, 85, 55, 0.18),
                          blurRadius: 50,
                          spreadRadius: -10,
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 38,
                              height: 38,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(12),
                                gradient: LinearGradient(
                                  begin: Alignment.topLeft,
                                  end: Alignment.bottomRight,
                                  colors: [
                                    h(42, 85, 55, 0.22),
                                    h(42, 85, 45, 0.05),
                                  ],
                                ),
                                border: Border.all(color: h(42, 70, 55, 0.3)),
                              ),
                              child: Center(
                                child: CrossGlyph(color: h(42, 85, 62)),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    t('onb.prayer.cardKicker').toUpperCase(),
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w700,
                                      letterSpacing: 2.09,
                                      color: h(42, 75, 62),
                                    ),
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    t('onb.prayer.cardTitle'),
                                    style: TextStyle(
                                      fontSize: 14,
                                      fontWeight: FontWeight.w700,
                                      color: h(40, 25, 95),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 4,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                color: h(42, 70, 55, 0.12),
                                border: Border.all(color: h(42, 60, 50, 0.3)),
                              ),
                              child: Text(
                                t('onb.prayer.badgeNew'),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w700,
                                  color: h(42, 85, 70),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          t('onb.prayer.quote'),
                          style: TextStyle(
                            fontSize: 13.5,
                            height: 1.6,
                            fontStyle: FontStyle.italic,
                            fontFamily:
                                'serif', // Georgia on web; Android resolves 'serif' the same way
                            color: h(40, 22, 88),
                          ),
                        ),
                        const SizedBox(height: 16),
                        Container(
                          padding: const EdgeInsets.only(top: 12),
                          decoration: BoxDecoration(
                            border: Border(
                              top: BorderSide(color: h(42, 60, 50, 0.15)),
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                width: 32,
                                height: 32,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [h(42, 90, 60), h(38, 100, 70)],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: h(42, 85, 50, 0.5),
                                      blurRadius: 16,
                                      spreadRadius: -4,
                                      offset: const Offset(0, 6),
                                    ),
                                  ],
                                ),
                                child: Center(
                                  child: Icon(
                                    Icons.play_arrow_rounded,
                                    size: 16,
                                    color: h(220, 65, 8),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Row(
                                  children: [
                                    for (final bar in _waveHeights)
                                      Padding(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 1.5,
                                        ),
                                        child: Opacity(
                                          opacity: 0.65,
                                          child: Container(
                                            width: 2.5,
                                            height: bar,
                                            decoration: BoxDecoration(
                                              color: h(42, 85, 60),
                                              borderRadius:
                                                  BorderRadius.circular(999),
                                            ),
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                '2:14',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                  fontFeatures: const [
                                    FontFeature.tabularFigures(),
                                  ],
                                  color: h(40, 20, 70),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 20),
                  // Feature pills
                  Wrap(
                    alignment: WrapAlignment.center,
                    spacing: 6,
                    runSpacing: 6,
                    children: [
                      for (final f in [
                        ('☀️', t('onb.prayer.pillMorningNight')),
                        ('🎧', t('onb.prayer.pillVoice')),
                        ('📖', t('onb.prayer.pillScripture')),
                      ])
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 4,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: h(220, 40, 18, 0.55),
                            border: Border.all(color: h(42, 50, 50, 0.18)),
                          ),
                          child: Text(
                            '${f.$1} ${f.$2}',
                            style: TextStyle(
                              fontSize: 10.5,
                              fontWeight: FontWeight.w600,
                              color: h(40, 22, 86),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 13x18 cross glyph (same inline SVG used on several slides).
class CrossGlyph extends StatelessWidget {
  const CrossGlyph({super.key, required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 13,
      height: 18,
      child: Stack(
        alignment: Alignment.topCenter,
        children: [
          Container(
            width: 3.7,
            height: 18,
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(1),
            ),
          ),
          Positioned(
            top: 4.5,
            child: Container(
              width: 13,
              height: 3.7,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// =============================================================================
// SLIDE 3 — Bible Chat (animated 3-turn conversation loop)
// =============================================================================
class BibleChatSlide extends StatefulWidget {
  const BibleChatSlide({super.key});

  @override
  State<BibleChatSlide> createState() => _BibleChatSlideState();
}

enum _ChatPhase { asking, typing, answered }

class _BibleChatSlideState extends State<BibleChatSlide> {
  late final List<(String, String, String)> _conversations = [
    (t('onb.chat.q1'), t('onb.chat.reply1'), t('onb.chat.ref1')),
    (t('onb.chat.q2'), t('onb.chat.reply2'), t('onb.chat.ref2')),
    (t('onb.chat.q3'), t('onb.chat.reply3'), t('onb.chat.ref3')),
  ];

  int _index = 0;
  _ChatPhase _phase = _ChatPhase.asking;
  final List<Timer> _timers = [];

  @override
  void initState() {
    super.initState();
    _runCycle();
  }

  void _runCycle() {
    _phase = _ChatPhase.asking;
    _timers
      ..add(
        Timer(
          const Duration(milliseconds: 1200),
          () => mounted ? setState(() => _phase = _ChatPhase.typing) : null,
        ),
      )
      ..add(
        Timer(
          const Duration(milliseconds: 2400),
          () => mounted ? setState(() => _phase = _ChatPhase.answered) : null,
        ),
      )
      ..add(
        Timer(const Duration(milliseconds: 5400), () {
          if (!mounted) return;
          setState(() => _index = (_index + 1) % _conversations.length);
          _clearTimers();
          _runCycle();
        }),
      );
  }

  void _clearTimers() {
    for (final t in _timers) {
      t.cancel();
    }
    _timers.clear();
  }

  @override
  void dispose() {
    _clearTimers();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = _conversations[_index];

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, -0.24),
                radius: 1,
                colors: [h(220, 60, 14), h(220, 65, 5)],
                stops: const [0, 0.75],
              ),
            ),
          ),
        ),
        Positioned(
          top: MediaQuery.of(context).size.height * 0.22,
          left: (MediaQuery.of(context).size.width - 420) / 2,
          child: IgnorePointer(
            child: Opacity(
              opacity: 0.38,
              child: SizedBox(
                width: 420,
                height: 420,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [h(42, 85, 55, 0.28), Colors.transparent],
                      stops: const [0, 0.65],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(
            28,
            MediaQuery.of(context).padding.top + 16 + 48,
            28,
            160,
          ),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                children: [
                  Opacity(
                    opacity: 0.85,
                    child: Text(
                      t('onb.chat.kicker').toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 4,
                        color: h(42, 75, 60),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OnbHeadline(
                    pre: t('onb.chat.headlinePre'),
                    gold: t('onb.chat.headlineGold'),
                  ),
                  const SizedBox(height: 12),
                  Opacity(
                    opacity: 0.75,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 310),
                      child: Text(
                        t('onb.chat.subcopy'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          height: 1.55,
                          color: h(40, 22, 80),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 24),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomRight,
                        colors: [h(220, 45, 14, 0.92), h(220, 55, 8, 0.96)],
                      ),
                      border: Border.all(color: h(42, 60, 50, 0.22)),
                      boxShadow: [
                        BoxShadow(
                          color: h(0, 0, 0, 0.8),
                          blurRadius: 60,
                          spreadRadius: -20,
                          offset: const Offset(0, 30),
                        ),
                        BoxShadow(
                          color: h(42, 85, 55, 0.18),
                          blurRadius: 50,
                          spreadRadius: -10,
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Chip + private badge
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                Container(
                                  width: 20,
                                  height: 20,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    gradient: LinearGradient(
                                      begin: Alignment.topLeft,
                                      end: Alignment.bottomRight,
                                      colors: [h(42, 90, 60), h(38, 100, 70)],
                                    ),
                                  ),
                                  child: Text(
                                    '✝',
                                    style: TextStyle(
                                      fontSize: 10,
                                      color: h(220, 65, 8),
                                    ),
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  t('onb.chat.chip').toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 9.5,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 2.09,
                                    color: h(42, 75, 62),
                                  ),
                                ),
                              ],
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 8,
                                vertical: 3,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                color: h(42, 70, 55, 0.14),
                                border: Border.all(color: h(42, 60, 50, 0.3)),
                              ),
                              child: Text(
                                '🔒 ${t('onb.chat.private')}',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: h(42, 90, 75),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        // Thread
                        ConstrainedBox(
                          constraints: const BoxConstraints(minHeight: 232),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              // User bubble
                              Align(
                                alignment: Alignment.centerRight,
                                child: ConstrainedBox(
                                  constraints: BoxConstraints(
                                    maxWidth:
                                        MediaQuery.of(context).size.width *
                                        0.62,
                                  ),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 14,
                                      vertical: 10,
                                    ),
                                    decoration: BoxDecoration(
                                      borderRadius: const BorderRadius.only(
                                        topLeft: Radius.circular(16),
                                        topRight: Radius.circular(6),
                                        bottomLeft: Radius.circular(16),
                                        bottomRight: Radius.circular(16),
                                      ),
                                      gradient: LinearGradient(
                                        begin: Alignment.topLeft,
                                        end: Alignment.bottomRight,
                                        colors: [
                                          h(220, 45, 26),
                                          h(220, 50, 20),
                                        ],
                                      ),
                                      border: Border.all(
                                        color: h(220, 35, 35, 0.45),
                                      ),
                                    ),
                                    child: Text(
                                      current.$1,
                                      style: TextStyle(
                                        fontSize: 13,
                                        height: 1.45,
                                        fontWeight: FontWeight.w500,
                                        color: h(40, 22, 92),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                              const SizedBox(height: 12),
                              if (_phase == _ChatPhase.typing) _TypingBubble(),
                              if (_phase == _ChatPhase.answered)
                                Align(
                                  alignment: Alignment.centerLeft,
                                  child: ConstrainedBox(
                                    constraints: BoxConstraints(
                                      maxWidth:
                                          MediaQuery.of(context).size.width *
                                          0.68,
                                    ),
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 14,
                                        vertical: 12,
                                      ),
                                      decoration: BoxDecoration(
                                        borderRadius: const BorderRadius.only(
                                          topLeft: Radius.circular(6),
                                          topRight: Radius.circular(16),
                                          bottomLeft: Radius.circular(16),
                                          bottomRight: Radius.circular(16),
                                        ),
                                        gradient: LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            h(42, 60, 24, 0.55),
                                            h(42, 50, 16, 0.45),
                                          ],
                                        ),
                                        border: Border.all(
                                          color: h(42, 85, 60, 0.42),
                                        ),
                                        boxShadow: [
                                          BoxShadow(
                                            color: h(42, 85, 50, 0.4),
                                            blurRadius: 24,
                                            spreadRadius: -10,
                                            offset: const Offset(0, 10),
                                          ),
                                        ],
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(
                                            current.$2,
                                            style: TextStyle(
                                              fontSize: 13,
                                              height: 1.5,
                                              fontWeight: FontWeight.w500,
                                              color: h(42, 30, 95),
                                            ),
                                          ),
                                          const SizedBox(height: 8),
                                          Text(
                                            current.$3.toUpperCase(),
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 1.2,
                                              color: h(42, 85, 72),
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 16),
                        // Composer hint
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 12,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            color: h(220, 40, 16, 0.55),
                            border: Border.all(color: h(220, 30, 28, 0.5)),
                          ),
                          child: Row(
                            children: [
                              Expanded(
                                child: Text(
                                  t('onb.chat.composer'),
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    color: h(40, 18, 65),
                                  ),
                                ),
                              ),
                              Container(
                                width: 28,
                                height: 28,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [h(42, 90, 60), h(38, 100, 70)],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: h(42, 85, 50, 0.5),
                                      blurRadius: 12,
                                      spreadRadius: -2,
                                      offset: const Offset(0, 4),
                                    ),
                                  ],
                                ),
                                child: Center(
                                  child: Icon(
                                    Icons.arrow_forward_rounded,
                                    size: 14,
                                    color: h(220, 65, 8),
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Three gold dots pulsing 1.1s with a 0.15s stagger.
class _TypingBubble extends StatefulWidget {
  @override
  State<_TypingBubble> createState() => _TypingBubbleState();
}

class _TypingBubbleState extends State<_TypingBubble>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: const BorderRadius.only(
            topLeft: Radius.circular(6),
            topRight: Radius.circular(16),
            bottomLeft: Radius.circular(16),
            bottomRight: Radius.circular(16),
          ),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [h(42, 60, 22, 0.5), h(42, 50, 16, 0.45)],
          ),
          border: Border.all(color: h(42, 60, 50, 0.28)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            for (var i = 0; i < 3; i++)
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 3),
                child: AnimatedBuilder(
                  animation: _c,
                  builder: (context, _) {
                    final phase = (_c.value + i * 0.15) % 1.0;
                    final wave = 1 - (phase * 2 - 1).abs();
                    return Transform.translate(
                      offset: Offset(0, -2 * wave),
                      child: Opacity(
                        opacity: 0.3 + 0.7 * wave,
                        child: Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: h(42, 85, 70),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// SLIDE 4 — Focus: what brought you here? (one tap ends onboarding)
// =============================================================================
class FocusSlide extends StatelessWidget {
  const FocusSlide({super.key, required this.picked, required this.onPick});

  final String? picked;
  final ValueChanged<String> onPick;

  @override
  Widget build(BuildContext context) {
    final options = <(String, String, String, String)>[
      ('anxiety', '🌊', t('onb.focus.anxietyTitle'), t('onb.focus.anxietySub')),
      (
        'strength',
        '🛡️',
        t('onb.focus.strengthTitle'),
        t('onb.focus.strengthSub'),
      ),
      ('healing', '🌿', t('onb.focus.healingTitle'), t('onb.focus.healingSub')),
      (
        'gratitude',
        '🌅',
        t('onb.focus.gratitudeTitle'),
        t('onb.focus.gratitudeSub'),
      ),
      ('doubt', '🕊️', t('onb.focus.doubtTitle'), t('onb.focus.doubtSub')),
      ('closer', '✝️', t('onb.focus.closerTitle'), t('onb.focus.closerSub')),
    ];

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, -0.4),
                radius: 1,
                colors: [h(220, 60, 14), h(220, 65, 5)],
                stops: const [0, 0.75],
              ),
            ),
          ),
        ),
        Positioned(
          top: MediaQuery.of(context).size.height * 0.18,
          left: (MediaQuery.of(context).size.width - 420) / 2,
          child: IgnorePointer(
            child: Opacity(
              opacity: 0.3,
              child: SizedBox(
                width: 420,
                height: 420,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: RadialGradient(
                      colors: [h(42, 85, 55, 0.25), Colors.transparent],
                      stops: const [0, 0.65],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 56, 24, 128),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                children: [
                  SizedBox(height: MediaQuery.of(context).padding.top),
                  Opacity(
                    opacity: 0.85,
                    child: Text(
                      t('onb.focus.kicker').toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 4,
                        color: h(42, 75, 60),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OnbHeadline(
                    pre: t('onb.focus.headlinePre'),
                    gold: t('onb.focus.headlineGold'),
                  ),
                  const SizedBox(height: 8),
                  Opacity(
                    opacity: 0.7,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 300),
                      child: Text(
                        t('onb.focus.subcopy'),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 12.5,
                          height: 1.5,
                          color: h(40, 22, 80),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  GridView.count(
                    crossAxisCount: 2,
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    mainAxisSpacing: 8,
                    crossAxisSpacing: 8,
                    childAspectRatio: 1.42,
                    children: [
                      for (final opt in options)
                        _FocusCard(
                          emoji: opt.$2,
                          title: opt.$3,
                          sub: opt.$4,
                          isPicked: picked == opt.$1,
                          onTap: () {
                            haptic(HapticStyle.soft);
                            onPick(opt.$1);
                          },
                        ),
                    ],
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _FocusCard extends StatelessWidget {
  const _FocusCard({
    required this.emoji,
    required this.title,
    required this.sub,
    required this.isPicked,
    required this.onTap,
  });

  final String emoji;
  final String title;
  final String sub;
  final bool isPicked;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          gradient: isPicked
              ? LinearGradient(
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                  colors: [h(42, 85, 50, 0.28), h(42, 85, 60, 0.10)],
                )
              : LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomRight,
                  colors: [h(220, 45, 14, 0.92), h(220, 55, 8, 0.96)],
                ),
          border: Border.all(
            color: isPicked ? h(42, 85, 60, 0.65) : h(42, 60, 50, 0.18),
          ),
          boxShadow: [
            BoxShadow(
              color: isPicked ? h(42, 85, 50, 0.45) : h(0, 0, 0, 0.5),
              blurRadius: isPicked ? 28 : 22,
              spreadRadius: -10,
              offset: Offset(0, isPicked ? 12 : 10),
            ),
          ],
        ),
        child: Stack(
          children: [
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(emoji, style: const TextStyle(fontSize: 22, height: 1)),
                const SizedBox(height: 6),
                Text(
                  title,
                  style: TextStyle(
                    fontSize: 12.5,
                    fontWeight: FontWeight.w800,
                    height: 1.15,
                    color: isPicked ? h(42, 90, 82) : h(40, 25, 95),
                  ),
                ),
                const SizedBox(height: 2),
                Expanded(
                  child: Text(
                    sub,
                    style: TextStyle(
                      fontSize: 10,
                      height: 1.35,
                      color: h(40, 18, 65),
                    ),
                  ),
                ),
              ],
            ),
            if (isPicked)
              Positioned(
                top: 0,
                right: 0,
                child: Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [h(42, 90, 60), h(38, 100, 70)],
                    ),
                  ),
                  child: Center(
                    child: Icon(
                      Icons.check_rounded,
                      size: 13,
                      color: h(220, 65, 8),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
