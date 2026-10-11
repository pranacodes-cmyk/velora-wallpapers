import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';
import '../../widgets/lucide.dart';

import '../../core/localization/app_localizations.dart';
import 'onboarding_motion.dart';
import 'onboarding_shared.dart';
import 'verse_slide.dart' show OnbHeadline;

/// 1:1 port of `src/components/onboarding/OnboardingLateSlides.tsx`
/// — the Prayer and Focus slides used after the PrayScreen story.

/// Exact HSL → Color conversion so every value matches the web CSS literally.
Color h(double hue, double s, double l, [double a = 1]) =>
    onbTone(hue, s, l, a);

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
            opacity: Onb.isLight ? 0.12 : Onb.bgPeak(0.45),
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
          top: MediaQuery.sizeOf(context).height * 0.30,
          left: (MediaQuery.sizeOf(context).width - 380) / 2,
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
          padding: const EdgeInsets.fromLTRB(32, 0, 32, 144),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                children: onbStagger([
                  SizedBox(height: MediaQuery.paddingOf(context).top + 56),
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
                  const SizedBox(height: 14),
                  // Narrative bridge: the same Shield from the PrayScreen
                  // slides now opens into the daily prayer.
                  const _ShieldThread(),
                  const SizedBox(height: 14),

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
                                  child: LucideIcon(
                                    'play',
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
                ]),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Gold thread + shield ring that visually carries the PrayScreen story into
/// the daily prayer card (web twin: `ShieldThread` in OnboardingLateSlides.tsx).
class _ShieldThread extends StatelessWidget {
  const _ShieldThread();

  @override
  Widget build(BuildContext context) {
    final gold = h(42, 85, 58);
    return Column(
      children: [
        Container(
          width: 1,
          height: 18,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [gold.withValues(alpha: 0), gold.withValues(alpha: .55)],
            ),
          ),
        ),
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: gold.withValues(alpha: .1),
            border: Border.all(color: gold.withValues(alpha: .42)),
            boxShadow: [
              BoxShadow(
                color: gold.withValues(alpha: .16),
                blurRadius: 22,
                spreadRadius: 4,
              ),
            ],
          ),
          child: Center(child: LucideIcon('shield', color: gold, size: 15)),
        ),
        Container(
          width: 1,
          height: 18,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [gold.withValues(alpha: .55), gold.withValues(alpha: 0)],
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
// SLIDE 4 — Social proof: real reviews from real believers
// =============================================================================
class SocialProofSlide extends StatefulWidget {
  const SocialProofSlide({super.key});

  @override
  State<SocialProofSlide> createState() => _SocialProofSlideState();
}

class _SocialProofSlideState extends State<SocialProofSlide> {
  @override
  Widget build(BuildContext context) {
    final reviews = <_Review>[
      for (var i = 1; i <= 8; i++)
        _Review(
          name: t('onb.proof.r${i}Name'),
          place: t('onb.proof.r${i}Place'),
          time: t('onb.proof.r${i}Time'),
          title: t('onb.proof.r${i}Title'),
          body: t('onb.proof.r${i}Body'),
        ),
    ];
    final top = MediaQuery.paddingOf(context).top;

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
        Padding(
          padding: EdgeInsets.fromLTRB(22, top + 34, 22, 122),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 440),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  ...onbStagger([
                    const _LaurelBadge(),
                    const SizedBox(height: 10),
                    OnbHeadline(
                      pre: t('onb.proof.headlinePre'),
                      gold: t('onb.proof.headlineGold'),
                    ),
                    const SizedBox(height: 10),
                  ]),
                  // Expanded must remain a direct child of Column. Wrapping it
                  // in OnbReveal removes its Flex parent data and blanks the
                  // entire slide at runtime.
                  Expanded(
                    child: OnbReveal(
                      index: 2,
                      child: _ReviewFeed(reviews: reviews),
                    ),
                  ),
                  const SizedBox(height: 8),
                  OnbReveal(
                    index: 3,
                    child: Opacity(
                      opacity: 0.66,
                      child: Text(
                        t('onb.proof.footer'),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: h(40, 20, 78),
                        ),
                      ),
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

/// Laurel wreath award badge — the single strongest trust mark on the slide, so
/// it leads instead of hiding under the headline.
class _LaurelBadge extends StatelessWidget {
  const _LaurelBadge();

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      final narrow = constraints.maxWidth < 300;
      return Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          if (!narrow)
            Transform.scale(
              scaleX: -1,
              child: LucideIcon('wheat', size: 34, color: h(42, 88, 58)),
            ),
          Flexible(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 4),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 180),
                    child: Text(
                      t('onb.proof.badge'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 10,
                        height: 1.25,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 0.6,
                        color: h(42, 90, 74),
                      ),
                    ),
                  ),
                  const SizedBox(height: 5),
                  const _Stars(size: 9),
                  const SizedBox(height: 4),
                  Text(
                    t('onb.proof.reviews'),
                    textAlign: TextAlign.center,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 0.3,
                      color: h(40, 25, 90),
                    ),
                  ),
                ],
              ),
            ),
          ),
          if (!narrow) LucideIcon('wheat', size: 34, color: h(42, 88, 58)),
        ],
      );
    },
  );
}

/// Endless vertical review feed with soft fades at both edges.
/// Auto-drifting review feed the user can also scroll by hand. The drift is a
/// slow, continuous crawl through two stacked copies so the wrap is invisible;
/// touching the list pauses it and it resumes a few seconds after release.
class _ReviewFeed extends StatefulWidget {
  const _ReviewFeed({required this.reviews});
  final List<_Review> reviews;

  @override
  State<_ReviewFeed> createState() => _ReviewFeedState();
}

class _ReviewFeedState extends State<_ReviewFeed> {
  final _controller = ScrollController();
  Timer? _ticker;
  Timer? _resume;
  bool _paused = false;

  static const _pxPerSecond = 16.0;

  @override
  void initState() {
    super.initState();
    _ticker = Timer.periodic(const Duration(milliseconds: 32), (_) {
      if (_paused || !_controller.hasClients) return;
      final max = _controller.position.maxScrollExtent;
      if (max <= 0) return;
      final half = max / 2;
      var next = _controller.offset + _pxPerSecond * 0.032;
      if (next >= half) next -= half;
      _controller.jumpTo(next);
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _resume?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _pause() {
    _resume?.cancel();
    _paused = true;
  }

  void _scheduleResume() {
    _resume?.cancel();
    _resume = Timer(const Duration(seconds: 3), () {
      if (mounted) _paused = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (rect) => LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: const [
          Color(0x00000000),
          Color(0xFF000000),
          Color(0xFF000000),
          Color(0x00000000),
        ],
        stops: const [0, 0.07, 0.88, 1],
      ).createShader(rect),
      blendMode: BlendMode.dstIn,
      child: Listener(
        onPointerDown: (_) => _pause(),
        onPointerUp: (_) => _scheduleResume(),
        onPointerCancel: (_) => _scheduleResume(),
        child: ListView.builder(
          controller: _controller,
          padding: EdgeInsets.zero,
          physics: const BouncingScrollPhysics(),
          itemCount: widget.reviews.length * 2,
          itemBuilder: (context, i) => Padding(
            padding: const EdgeInsets.only(bottom: 9),
            child: _ReviewCard(
              review: widget.reviews[i % widget.reviews.length],
            ),
          ),
        ),
      ),
    );
  }
}

class _Review {
  const _Review({
    required this.name,
    required this.place,
    required this.time,
    required this.title,
    required this.body,
  });
  final String name, place, time, title, body;
}

class _Stars extends StatelessWidget {
  const _Stars({this.size = 11});
  final double size;
  @override
  Widget build(BuildContext context) => Row(
    mainAxisSize: MainAxisSize.min,
    children: [
      for (var i = 0; i < 5; i++)
        Padding(
          padding: const EdgeInsets.only(right: 2),
          child: Icon(Icons.star_rounded, size: size + 3, color: h(42, 90, 58)),
        ),
    ],
  );
}

class _ReviewCard extends StatelessWidget {
  const _ReviewCard({required this.review});
  final _Review review;

  @override
  Widget build(BuildContext context) {
    final initials = review.name
        .split(' ')
        .where((part) => part.isNotEmpty)
        .take(2)
        .map((part) => part[0])
        .join();
    return Container(
      padding: const EdgeInsets.all(13),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(17),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomRight,
          colors: [h(220, 45, 14, 0.92), h(220, 55, 8, 0.96)],
        ),
        border: Border.all(color: h(42, 60, 50, 0.18)),
        boxShadow: [
          BoxShadow(
            color: h(0, 0, 0, 0.5),
            blurRadius: 22,
            spreadRadius: -10,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 32,
                height: 32,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [h(42, 85, 52), h(38, 88, 42)],
                  ),
                ),
                child: Text(
                  initials,
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    color: h(220, 65, 8),
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      review.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: h(40, 25, 95),
                      ),
                    ),
                    Text(
                      review.place,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(fontSize: 9.5, color: h(40, 18, 62)),
                    ),
                  ],
                ),
              ),
              Flexible(
                child: Text(
                  review.time,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                  style: TextStyle(fontSize: 9, color: h(40, 15, 55)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 9),
          const _Stars(size: 8),
          const SizedBox(height: 6),
          Text(
            review.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              fontSize: 12.5,
              fontWeight: FontWeight.w900,
              height: 1.2,
              color: h(42, 88, 80),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            review.body,
            maxLines: 4,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(fontSize: 11, height: 1.42, color: h(40, 20, 76)),
          ),
        ],
      ),
    );
  }
}
