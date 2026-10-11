import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:video_player/video_player.dart';
import '../../widgets/lucide.dart';

import '../../core/localization/app_localizations.dart';
import 'onboarding_motion.dart';
import 'onboarding_shared.dart';
import 'verse_slide.dart';

/// Reserved space for the fixed Continue CTA at the bottom of the flow.
const double _ctaReserve = 116;

/// Height-adaptive scale: 1.0 on tall phones, gracefully compressed on short
/// ones so nothing ever collides with the Continue button.
double _fit(double available, double reference) =>
    (available / reference).clamp(0.74, 1.0).toDouble();

/// Sacred premium depth: a midnight canvas with a royal-blue bloom and a
/// single gold light-leak, instead of a full-bleed painting wash. The artwork
/// lives in a contained art plate (see `_ArtPlate`) so nothing reads muddy.
class _StoryScaffold extends StatelessWidget {
  const _StoryScaffold({required this.builder});

  final Widget Function(BuildContext context, double scale) builder;

  @override
  Widget build(BuildContext context) => Stack(
    fit: StackFit.expand,
    children: [
      DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: const Alignment(0, -.25),
            radius: .95,
            colors: [Onb.bloom, Onb.canvas],
            stops: const [0, .78],
          ),
        ),
      ),
      // Gold light leak from the bottom-left corner — candlelight in stone.
      Positioned(
        left: -80,
        bottom: -100,
        child: Container(
          width: 230,
          height: 230,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            boxShadow: [
              BoxShadow(
                color: Onb.gold.withValues(alpha: .1),
                blurRadius: 110,
                spreadRadius: 40,
              ),
            ],
          ),
        ),
      ),
      LayoutBuilder(
        builder: (context, c) {
          final top = MediaQuery.paddingOf(context).top;
          final usable = c.maxHeight - top - _ctaReserve;
          return builder(context, _fit(usable, 560));
        },
      ),
    ],
  );
}

/// The story painting, contained in a rounded plate with a gold halo and an
/// inner radiance vignette that melts the edges into the canvas.
class _ArtPlate extends StatelessWidget {
  const _ArtPlate({
    required this.art,
    this.focusX = 0,
    this.shift = 0,
    this.zoom = 1.06,
    this.fit = BoxFit.cover,
  });

  final String art;
  final BoxFit fit;
  final double focusX;
  final double shift;
  final double zoom;

  @override
  Widget build(BuildContext context) => Positioned.fill(
    child: OnbReveal(
      duration: const Duration(milliseconds: 900),
      dy: 0,
      scaleFrom: 1.03,
      child: Container(
        margin: const EdgeInsets.fromLTRB(14, 4, 14, 4),
        decoration: BoxDecoration(
          // Glass plate: the same translucent navy + hairline language the
          // rest of the onboarding cards use, so the painting reads as part
          // of the flow instead of a raw photo edge.
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Onb.surface(0.55), Onb.artMat.withValues(alpha: 0.72)],
          ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: Onb.ink(0.10), width: 1),
          boxShadow: [
            BoxShadow(
              color: Onb.gold.withValues(alpha: .14),
              blurRadius: 54,
              spreadRadius: -18,
            ),
            BoxShadow(
              color: Onb.shade(0.45),
              blurRadius: 30,
              spreadRadius: -14,
              offset: const Offset(0, 16),
            ),
          ],
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(29),
          child: Stack(
            fit: StackFit.expand,
            children: [
              Transform.scale(
                scale: zoom,
                child: FractionalTranslation(
                  translation: Offset(0, shift),
                  child: ColorFiltered(
                    // The source paintings are deliberately low-key; a
                    // restrained lift keeps faces readable on Android.
                    colorFilter: const ColorFilter.matrix([
                      1.1,
                      0,
                      0,
                      0,
                      6,
                      0,
                      1.1,
                      0,
                      0,
                      6,
                      0,
                      0,
                      1.1,
                      0,
                      6,
                      0,
                      0,
                      0,
                      1,
                      0,
                    ]),
                    child: Image.asset(
                      art,
                      fit: fit,
                      alignment: Alignment(focusX, 0),
                    ),
                  ),
                ),
              ),
              // Soft bottom scrim so the locked icons + shield pill stay
              // readable without dimming the face.
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Onb.artMat.withValues(alpha: 0),
                      Onb.artMat.withValues(alpha: .35),
                      Onb.artMat.withValues(alpha: .85),
                    ],
                    stops: const [.35, .68, 1],
                  ),
                ),
              ),
              // Glass sheen: one soft highlight down the top edge.
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [Onb.ink(0.10), Onb.ink(0.02), Onb.ink(0)],
                    stops: const [0, .22, .5],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
}

class _Header extends StatelessWidget {
  const _Header({
    required this.kicker,
    required this.pre,
    required this.gold,
    required this.subcopy,
    required this.scale,
    this.headlineFactor = 1,
  });
  final double headlineFactor;
  final String kicker;
  final String pre;
  final String gold;
  final String subcopy;
  final double scale;

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(26, 34 * scale, 26, 0),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        OnbReveal(
          child: Text(
            kicker.toUpperCase(),
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Onb.gold,
              fontSize: 10,
              fontWeight: FontWeight.w800,
              letterSpacing: 3.2,
            ),
          ),
        ),
        SizedBox(height: 12 * scale),
        OnbReveal(
          delay: const Duration(milliseconds: 78),
          child: OnbHeadline(
            pre: pre,
            gold: gold,
            size: 27 * scale * headlineFactor,
          ),
        ),
        SizedBox(height: 10 * scale),
        OnbReveal(
          delay: const Duration(milliseconds: 156),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 312),
            child: Text(
              subcopy,
              textAlign: TextAlign.center,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: Onb.ink(.6),
                fontSize: 12.5 * scale,
                height: 1.5,
              ),
            ),
          ),
        ),
      ],
    ),
  );
}

/// Brand tiles — the real app icons, full-bleed (no inner padding).
class _BrandIcon extends StatelessWidget {
  const _BrandIcon({required this.id, required this.size, this.radius});
  final String id;
  final double size;
  final double? radius;

  @override
  Widget build(BuildContext context) => ClipRRect(
    borderRadius: BorderRadius.circular(radius ?? size * .28),
    child: SvgPicture.asset(
      'assets/images/social/$id.svg',
      width: size,
      height: size,
    ),
  );
}

const _feedApps = [
  ('instagram', 'Instagram', '12 new likes', 12),
  ('tiktok', 'TikTok', 'New videos waiting', 9),
  ('snapchat', 'Snapchat', '4 new snaps', 4),
  ('x', 'X', '18 new posts', 18),
];

const _guardIds = [
  'instagram',
  'tiktok',
  'snapchat',
  'x',
  'youtube',
  'facebook',
];

/// Slide 1 notification card — original design; only the app icon is kept at
/// full brightness (the card/text carry the fade instead of the whole row).
class _NotificationRow extends StatelessWidget {
  const _NotificationRow({
    required this.id,
    required this.name,
    required this.notice,
    required this.scale,
    required this.dim,
    this.count = '',
    this.badge = 1,
  });
  final String id;
  final String name;
  final String notice;
  final double scale;
  final double dim;

  /// Unread count that lands on the app icon.
  final String count;

  /// 0 → 1 phase of that badge landing.
  final double badge;

  @override
  Widget build(BuildContext context) => Container(
    height: 60 * scale,
    padding: EdgeInsets.symmetric(horizontal: 12 * scale),
    decoration: BoxDecoration(
      color: Onb.surface(.85 * dim),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: Onb.ink(.12 * dim)),
      boxShadow: [
        BoxShadow(color: Onb.shade(.35), blurRadius: 18, offset: Offset(0, 8)),
      ],
    ),
    child: Row(
      children: [
        // Icon stays fully bright; the unread count lands on its corner.
        Stack(
          clipBehavior: Clip.none,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(11 * scale),
                boxShadow: [
                  BoxShadow(
                    color: Onb.shade(.3),
                    blurRadius: 10,
                    offset: const Offset(0, 3),
                  ),
                ],
              ),
              child: _BrandIcon(id: id, size: 36 * scale),
            ),
            if (count.isNotEmpty)
              Positioned(
                top: -6 * scale,
                right: -6 * scale,
                child: Opacity(
                  opacity: badge.clamp(0.0, 1.0),
                  child: Transform.scale(
                    scale: 0.3 + 0.7 * badge.clamp(0.0, 1.0),
                    child: Container(
                      constraints: BoxConstraints(minWidth: 17 * scale),
                      height: 17 * scale,
                      padding: EdgeInsets.symmetric(horizontal: 4 * scale),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: const Color(0xFFFF3B30),
                        borderRadius: BorderRadius.circular(9 * scale),
                        border: Border.all(color: Onb.shade(1), width: 1),
                      ),
                      child: Text(
                        count,
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 9 * scale,
                          height: 1,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
        SizedBox(width: 11 * scale),
        Expanded(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Onb.ink(dim),
                  fontSize: 11.5 * scale,
                  fontWeight: FontWeight.w800,
                ),
              ),
              SizedBox(height: 2 * scale),
              Text(
                notice,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: Onb.ink(.45 * dim),
                  fontSize: 9.5 * scale,
                ),
              ),
            ],
          ),
        ),
        Container(
          width: 7 * scale,
          height: 7 * scale,
          decoration: const BoxDecoration(
            shape: BoxShape.circle,
            color: Color(0xFFFF4D4D),
          ),
        ),
      ],
    ),
  );
}

/// Slide 1 — the pull: a clean stack of notifications, nothing overlapping.
class PrayScreenInterruptionSlide extends StatelessWidget {
  const PrayScreenInterruptionSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L10n.current;
    return _StoryScaffold(
      builder: (context, s) {
        return SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.only(bottom: _ctaReserve),
            child: Column(
              children: [
                _Header(
                  kicker: l.t('onb.ps1.kicker'),
                  pre: l.t('onb.ps1.headlinePre'),
                  gold: l.t('onb.ps1.headlineGold'),
                  subcopy: l.t('onb.ps1.subcopy'),
                  scale: s,
                  headlineFactor: 0.9,
                ),
                // The push storm (identical numbers to the web slide).
                // Pulled up out of dead-centre: dead-centring the stack in all
                // the leftover height left a big empty band right under the
                // gold subtitle on tall phones.
                // Sits right under the subtitle instead of floating in the
                // leftover height — on tall phones any centring (even a
                // negative bias) left a dead band between copy and cards.
                Expanded(
                  child: Align(
                    alignment: Alignment.topCenter,
                    child: Padding(
                      padding: EdgeInsets.only(top: 2 * s),
                      child: _PushStorm(scale: s),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Slide 1 motion — the same calm language as every other slide: each
/// notification fades and rises into place (420ms, 70ms stagger, easeOutCubic
/// curve) and its unread count lands on the app icon 240ms later. No loops,
/// no drift, no glow. Mirrors the web slide number for number.
class _PushStorm extends StatefulWidget {
  const _PushStorm({required this.scale});
  final double scale;

  @override
  State<_PushStorm> createState() => _PushStormState();
}

class _PushStormState extends State<_PushStorm>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  );

  /// Per-tick growth of each unread badge — web uses the same steps.
  static const _badgeStep = [1, 2, 1, 3];
  int _ticks = 0;
  Timer? _ticker;

  @override
  void initState() {
    super.initState();
    _c.forward();
    // The feed keeps piling up on its own, every 700ms (web parity).
    _ticker = Timer.periodic(const Duration(milliseconds: 700), (_) {
      if (mounted) setState(() => _ticks++);
    });
  }

  @override
  void dispose() {
    _ticker?.cancel();
    _c.dispose();
    super.dispose();
  }

  static const _curve = Cubic(0.22, 1, 0.36, 1);

  double _phase(double tMs, double start, double dur) =>
      _curve.transform(((tMs - start) / dur).clamp(0.0, 1.0));

  @override
  Widget build(BuildContext context) {
    final s = widget.scale;
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) {
          final tMs = _c.value * 1200;
          return Align(
            alignment: Alignment.topCenter,
            child: Padding(
              padding: EdgeInsets.fromLTRB(26, 6 * s, 26, 12 * s),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 330),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (var i = 0; i < _feedApps.length; i++) ...[
                      if (i > 0) SizedBox(height: 10 * s),
                      _card(i, tMs, s),
                    ],
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _card(int i, double tMs, double s) {
    final delay = 70.0 * i;
    final e = _phase(tMs, delay, 420);
    final badge = _phase(tMs, delay + 240, 360);
    final raw = _feedApps[i].$4 + _badgeStep[i] * _ticks;
    final shown = raw > 99 ? '99+' : '$raw';
    return Opacity(
      opacity: e,
      child: Transform.translate(
        offset: Offset(0, -14 * (1 - e)),
        child: _NotificationRow(
          id: _feedApps[i].$1,
          name: _feedApps[i].$2,
          notice: _feedApps[i].$3,
          count: shown,
          scale: s,
          dim: 1 - i * .13,
          badge: badge,
        ),
      ),
    );
  }
}

/// Slide 2 — the shield standing over those same apps, locked.
class PrayScreenPauseSlide extends StatelessWidget {
  const PrayScreenPauseSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L10n.current;
    return _StoryScaffold(
      builder: (context, s) {
        return SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.only(bottom: _ctaReserve),
            child: Column(
              children: [
                _Header(
                  kicker: l.t('onb.ps2.kicker'),
                  pre: l.t('onb.ps2.headlinePre'),
                  gold: l.t('onb.ps2.headlineGold'),
                  subcopy: l.t('onb.ps2.subcopy'),
                  scale: s,
                ),
                Expanded(
                  child: Stack(
                    children: [
                      const _ArtPlate(
                        art: 'assets/images/onboarding-story-2-embrace.jpg',
                        // Wide painting fills the glass plate edge to edge.
                        fit: BoxFit.cover,
                        zoom: 1.02,
                      ),
                      Positioned.fill(
                        child: Align(
                          alignment: const Alignment(0, .48),
                          child: Padding(
                            padding: EdgeInsets.symmetric(
                              horizontal: 26,
                              vertical: 6 * s,
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                ConstrainedBox(
                                  constraints: const BoxConstraints(
                                    maxWidth: 330,
                                  ),
                                  child: Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      for (var i = 0; i < _guardIds.length; i++)
                                        _LockedTile(
                                          id: _guardIds[i],
                                          scale: s,
                                          index: i,
                                        ),
                                    ],
                                  ),
                                ),
                                SizedBox(height: 26 * s),
                                OnbReveal(
                                  delay: const Duration(milliseconds: 900),
                                  child: Container(
                                    padding: EdgeInsets.symmetric(
                                      horizontal: 17 * s,
                                      vertical: 9.5 * s,
                                    ),
                                    decoration: BoxDecoration(
                                      color: Onb.surface(.65),
                                      borderRadius: BorderRadius.circular(99),
                                      border: Border.all(
                                        color: Onb.gold.withValues(alpha: .3),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Onb.shade(.3),
                                          blurRadius: 20,
                                          offset: const Offset(0, 4),
                                        ),
                                      ],
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        LucideIcon(
                                          'shield',
                                          color: Onb.gold,
                                          size: 13 * s,
                                        ),
                                        SizedBox(width: 7 * s),
                                        Text(
                                          l.t('onb.ps1.badge'),
                                          style: TextStyle(
                                            color: Onb.gold,
                                            fontSize: 9.5 * s,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 1.4,
                                          ),
                                        ),
                                      ],
                                    ),
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
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Locked app tile — the icon stays bright, then a gold lock snaps on,
/// one tile after another, so the shield visibly "locks" the row.
class _LockedTile extends StatelessWidget {
  const _LockedTile({required this.id, required this.scale, this.index = 0});
  final String id;
  final double scale;
  final int index;

  @override
  Widget build(BuildContext context) {
    final lockDelay = Duration(milliseconds: 240 + 110 * index);
    return SizedBox(
      width: 42 * scale,
      height: 42 * scale,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          OnbReveal(
            delay: Duration(milliseconds: 120 + 60 * index),
            dy: 10,
            scaleFrom: .86,
            child: Transform.rotate(
              // Hand-placed tiles, not a machine grid.
              angle: [-.05, .035, -.02, .05, -.035, .02][index % 6],
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12 * scale),
                  boxShadow: [
                    BoxShadow(
                      color: Onb.shade(.4),
                      blurRadius: 14,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: _BrandIcon(id: id, size: 36 * scale),
              ),
            ),
          ),
          Positioned(
            right: -2,
            bottom: -2,
            child: OnbReveal(
              delay: lockDelay,
              duration: const Duration(milliseconds: 360),
              dy: 0,
              scaleFrom: .3,
              child: Container(
                width: 18 * scale,
                height: 18 * scale,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  // Sealed, not stickered: midnight disc with a gold hairline.
                  color: Onb.canvas,
                  border: Border.all(
                    color: Onb.gold.withValues(alpha: .85),
                    width: 1.2,
                  ),
                ),
                child: LucideIcon('lock', color: Onb.gold, size: 9 * scale),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Slide 3 — how simple it is: lock, pray, open.
class PrayScreenPromiseSlide extends StatelessWidget {
  const PrayScreenPromiseSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final l = L10n.current;
    const times = ['12 AM', '5 AM', '12 PM', '6 PM'];
    final steps = [
      ('lock', l.t('onb.ps3.step1')),
      ('heart', l.t('onb.ps3.step2')),
      ('check', l.t('onb.ps3.step3')),
    ];
    return _StoryScaffold(
      builder: (context, s) {
        return SafeArea(
          bottom: false,
          child: Padding(
            padding: const EdgeInsets.only(bottom: _ctaReserve),
            child: Column(
              children: [
                _Header(
                  kicker: l.t('onb.ps3.kicker'),
                  pre: l.t('onb.ps3.headlinePre'),
                  gold: l.t('onb.ps3.headlineGold'),
                  subcopy: l.t('onb.ps3.subcopy'),
                  scale: s,
                ),
                Expanded(
                  child: Stack(
                    children: [
                      // Steps + times fill this slide; no painting behind them.
                      Positioned.fill(
                        child: Align(
                          alignment: Alignment.topCenter,
                          child: SingleChildScrollView(
                            padding: EdgeInsets.fromLTRB(
                              26,
                              14 * s,
                              26,
                              10 * s,
                            ),
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(maxWidth: 330),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  for (var i = 0; i < steps.length; i++) ...[
                                    if (i > 0) SizedBox(height: 10 * s),
                                    OnbReveal(
                                      delay: Duration(
                                        milliseconds: 70 * (i + 1),
                                      ),
                                      child: _StepRow(
                                        index: i + 1,
                                        icon: steps[i].$1,
                                        label: steps[i].$2,
                                        scale: s,
                                      ),
                                    ),
                                  ],
                                  SizedBox(height: 16 * s),
                                  OnbReveal(
                                    delay: const Duration(milliseconds: 280),
                                    child: Container(
                                      width: double.infinity,
                                      padding: EdgeInsets.all(14 * s),
                                      decoration: BoxDecoration(
                                        color: Onb.surface(.75),
                                        borderRadius: BorderRadius.circular(18),
                                        border: Border.all(
                                          color: Onb.gold.withValues(
                                            alpha: .16,
                                          ),
                                        ),
                                      ),
                                      child: Column(
                                        children: [
                                          Row(
                                            children: [
                                              LucideIcon(
                                                'bell',
                                                color: Onb.gold,
                                                size: 15 * s,
                                              ),
                                              SizedBox(width: 7 * s),
                                              Expanded(
                                                child: Text(
                                                  l.t('onb.ps3.rhythm'),
                                                  maxLines: 1,
                                                  overflow:
                                                      TextOverflow.ellipsis,
                                                  style: TextStyle(
                                                    color: Onb.ink(),
                                                    fontSize: 11 * s,
                                                    fontWeight: FontWeight.w800,
                                                  ),
                                                ),
                                              ),
                                              Text(
                                                l
                                                    .t('onb.ps3.daily')
                                                    .toUpperCase(),
                                                style: TextStyle(
                                                  color: Onb.gold,
                                                  fontSize: 8 * s,
                                                  fontWeight: FontWeight.w900,
                                                  letterSpacing: 1.3,
                                                ),
                                              ),
                                            ],
                                          ),
                                          SizedBox(height: 11 * s),
                                          Row(
                                            children: times
                                                .map(
                                                  (time) => Expanded(
                                                    child: Container(
                                                      margin:
                                                          EdgeInsets.symmetric(
                                                            horizontal: 3 * s,
                                                          ),
                                                      padding:
                                                          EdgeInsets.symmetric(
                                                            vertical: 7 * s,
                                                          ),
                                                      decoration: BoxDecoration(
                                                        color: Onb.gold
                                                            .withValues(
                                                              alpha: .06,
                                                            ),
                                                        borderRadius:
                                                            BorderRadius.circular(
                                                              9,
                                                            ),
                                                        border: Border.all(
                                                          color: Onb.gold
                                                              .withValues(
                                                                alpha: .16,
                                                              ),
                                                        ),
                                                      ),
                                                      child: Text(
                                                        time,
                                                        textAlign:
                                                            TextAlign.center,
                                                        style: TextStyle(
                                                          color: Onb.ink(.72),
                                                          fontSize: 9.5 * s,
                                                          fontWeight:
                                                              FontWeight.w700,
                                                        ),
                                                      ),
                                                    ),
                                                  ),
                                                )
                                                .toList(),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _StepRow extends StatelessWidget {
  const _StepRow({
    required this.index,
    required this.icon,
    required this.label,
    required this.scale,
  });
  final int index;
  final String icon;
  final String label;
  final double scale;

  @override
  Widget build(BuildContext context) => Container(
    padding: EdgeInsets.symmetric(horizontal: 14 * scale, vertical: 12 * scale),
    decoration: BoxDecoration(
      gradient: LinearGradient(
        begin: Alignment.centerLeft,
        end: Alignment.centerRight,
        colors: [Onb.gold.withValues(alpha: .1), Onb.surface(.7)],
      ),
      borderRadius: BorderRadius.circular(18),
      border: Border.all(color: Onb.gold.withValues(alpha: .22)),
      boxShadow: [
        BoxShadow(
          color: Onb.shade(.3),
          blurRadius: 20,
          offset: const Offset(0, 10),
        ),
      ],
    ),
    child: Row(
      children: [
        Container(
          width: 34 * scale,
          height: 34 * scale,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: Onb.gold.withValues(alpha: .1),
            border: Border.all(color: Onb.gold.withValues(alpha: .32)),
          ),
          child: LucideIcon(icon, color: Onb.gold, size: 15 * scale),
        ),
        SizedBox(width: 12 * scale),
        Expanded(
          child: Text(
            label,
            maxLines: 2,
            style: TextStyle(
              color: Onb.ink(.88),
              fontSize: 12.5 * scale,
              fontWeight: FontWeight.w600,
              height: 1.35,
            ),
          ),
        ),
        Text(
          '0$index',
          style: TextStyle(
            color: Onb.gold.withValues(alpha: .45),
            fontSize: 12 * scale,
            fontWeight: FontWeight.w900,
          ),
        ),
      ],
    ),
  );
}

// =============================================================================
// Single Shield slide — mirrors the approved web demonstration:
// launcher → tap → sacred pause → Scripture → prayer → unlock → real feed.
// =============================================================================
const _shieldPhaseMs = [2100, 420, 1600, 2500, 4300, 1200, 2600];
const _shieldApps = [
  ('instagram', 'Instagram'),
  ('tiktok', 'TikTok'),
  ('youtube', 'YouTube'),
  ('facebook', 'Facebook'),
  ('snapchat', 'Snapchat'),
  ('x', 'X'),
];

class PrayScreenShieldSlide extends StatefulWidget {
  const PrayScreenShieldSlide({super.key});

  @override
  State<PrayScreenShieldSlide> createState() => _PrayScreenShieldSlideState();
}

class _PrayScreenShieldSlideState extends State<PrayScreenShieldSlide> {
  late final VideoPlayerController _video;

  @override
  void initState() {
    super.initState();
    _video = VideoPlayerController.asset(
      'assets/images/prayscreen/prayscreen-demo.mp4',
      videoPlayerOptions: VideoPlayerOptions(mixWithOthers: true),
    );
    _video
      ..setLooping(true)
      ..setVolume(0)
      ..initialize().then((_) {
        if (!mounted) return;
        setState(() {});
        _video.play();
      });
  }

  @override
  void dispose() {
    _video.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _StoryScaffold(
    builder: (context, s) => SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.only(bottom: _ctaReserve),
        child: Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(24, 14 * s, 24, 0),
              child: Column(
                children: [
                  Text(
                    'PRAYLY SHIELD',
                    style: TextStyle(
                      color: Onb.gold,
                      fontSize: 8 * s,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2.2,
                    ),
                  ),
                  SizedBox(height: 5 * s),
                  Text.rich(
                    TextSpan(
                      children: [
                        const TextSpan(text: 'See the pause. '),
                        TextSpan(
                          text: 'Feel the difference.',
                          style: TextStyle(color: Onb.gold),
                        ),
                      ],
                    ),
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Onb.ink(1),
                      fontSize: 21 * s,
                      fontWeight: FontWeight.w900,
                      height: 1.1,
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: LayoutBuilder(
                builder: (context, constraints) {
                  final height = constraints.maxHeight.clamp(370.0, 500.0);
                  return Center(
                    child: SizedBox(
                      height: height,
                      // Video is cropped to the phone screen only; the clip
                      // matches its corner curve so no border shows behind.
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(height * 0.058),
                        child: AspectRatio(
                          aspectRatio: 360 / 762,
                          child: _video.value.isInitialized
                              ? VideoPlayer(_video)
                              : ColoredBox(color: Onb.canvas),
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
    ),
  );
}

class _ShieldStage extends StatefulWidget {
  const _ShieldStage({required this.scale});
  final double scale;

  @override
  State<_ShieldStage> createState() => _ShieldStageState();
}

class _ShieldStageState extends State<_ShieldStage> {
  int _phase = 0;
  Timer? _timer;
  bool _artPrecached = false;

  @override
  void initState() {
    super.initState();
    _schedule();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_artPrecached) return;
    _artPrecached = true;
    precacheImage(
      const AssetImage('assets/images/prayscreen/feed.jpg'),
      context,
    );
    precacheImage(
      const AssetImage('assets/images/prayscreen/prayer.jpg'),
      context,
    );
    precacheImage(
      const AssetImage('assets/images/prayscreen/portraits.jpg'),
      context,
    );
  }

  void _schedule() {
    _timer?.cancel();
    _timer = Timer(Duration(milliseconds: _shieldPhaseMs[_phase]), () {
      if (!mounted) return;
      setState(() => _phase = (_phase + 1) % _shieldPhaseMs.length);
      _schedule();
    });
  }

  void _launch() {
    setState(() => _phase = 1);
    _schedule();
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final s = widget.scale;
    final l = L10n.current;
    final captions = [
      l.t('onb.ps1.subcopy'),
      l.t('onb.ps1.badge'),
      l.t('onb.shield.subcopy'),
      l.t('onb.ps2.verse'),
      l.t('onb.ps2.prayer'),
      l.t('onb.ps2.action'),
      l.t('onb.ps3.step3'),
    ];
    return LayoutBuilder(
      builder: (context, constraints) {
        const phoneRatio = 258 / 418;
        final availableHeight = (constraints.maxHeight - 50 * s).clamp(
          300.0,
          418 * s,
        );
        final phoneHeight = availableHeight.toDouble();
        final phoneWidth = (phoneHeight * phoneRatio).clamp(185.0, 258 * s);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: phoneWidth.toDouble(),
              height: phoneHeight,
              padding: EdgeInsets.all(5 * s),
              decoration: BoxDecoration(
                color: Onb.canvas,
                borderRadius: BorderRadius.circular(36 * s),
                border: Border.all(color: Onb.ink(.2), width: 3),
                boxShadow: [
                  BoxShadow(
                    color: Onb.shade(.72),
                    blurRadius: 40,
                    offset: const Offset(0, 22),
                  ),
                  BoxShadow(
                    color: Onb.gold.withValues(alpha: .18),
                    blurRadius: 28,
                    spreadRadius: -14,
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(28 * s),
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    AnimatedSwitcher(
                      duration: const Duration(milliseconds: 360),
                      switchInCurve: Onb.easeOutExpo,
                      switchOutCurve: Curves.easeInCubic,
                      // AnimatedSwitcher normally keeps the outgoing child in
                      // its Stack. On Android that painted the launcher and
                      // Instagram feed together during every phase change.
                      layoutBuilder: (currentChild, previousChildren) =>
                          currentChild ?? const SizedBox.shrink(),
                      child: _phase <= 1
                          ? _LauncherScene(
                              key: const ValueKey('launcher'),
                              scale: s,
                              onLaunch: _launch,
                            )
                          : _phase == 6
                          ? _FeedScene(key: const ValueKey('feed'), scale: s)
                          : _SacredPauseScene(
                              key: ValueKey('pause-$_phase'),
                              phase: _phase,
                              scale: s,
                            ),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      top: 7 * s,
                      child: Center(
                        child: Container(
                          width: 58 * s,
                          height: 16 * s,
                          decoration: BoxDecoration(
                            color: Onb.canvas,
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: 13 * s,
                      right: 13 * s,
                      top: 9 * s,
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            '9:41',
                            style: TextStyle(
                              color: Onb.ink(.8),
                              fontSize: 7 * s,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          Text(
                            '● ◒ ▰',
                            style: TextStyle(
                              color: Onb.ink(.8),
                              fontSize: 6 * s,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 4 * s,
                      child: Center(
                        child: Container(
                          width: 80 * s,
                          height: 4 * s,
                          decoration: BoxDecoration(
                            color: Onb.ink(.65),
                            borderRadius: BorderRadius.circular(99),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            SizedBox(height: 9 * s),
            SizedBox(
              height: 42 * s,
              child: Column(
                children: [
                  Text(
                    captions[_phase],
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Onb.ink(.8),
                      fontSize: 11 * s,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  SizedBox(height: 8 * s),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: List.generate(
                      _shieldPhaseMs.length,
                      (i) => AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        width: (i == _phase ? 20 : 4) * s,
                        height: 4 * s,
                        margin: EdgeInsets.symmetric(horizontal: 3 * s),
                        decoration: BoxDecoration(
                          color: i == _phase ? Onb.gold : Onb.ink(.2),
                          borderRadius: BorderRadius.circular(99),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _LauncherScene extends StatelessWidget {
  const _LauncherScene({
    super.key,
    required this.scale,
    required this.onLaunch,
  });
  final double scale;
  final VoidCallback onLaunch;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    return Stack(
      fit: StackFit.expand,
      children: [
        Image.asset(
          'assets/images/prayscreen/feed.jpg',
          fit: BoxFit.cover,
          opacity: const AlwaysStoppedAnimation(.78),
          filterQuality: FilterQuality.medium,
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Onb.canvas.withValues(alpha: .06),
                Onb.canvas.withValues(alpha: .62),
              ],
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16 * s, 40 * s, 16 * s, 18 * s),
          child: Column(
            children: [
              Text(
                '9:41',
                style: TextStyle(
                  color: Onb.ink(1),
                  fontSize: 20 * s,
                  fontWeight: FontWeight.w300,
                ),
              ),
              Text(
                'WEDNESDAY · SEPTEMBER 30',
                style: TextStyle(
                  color: Onb.ink(.7),
                  fontSize: 6.5 * s,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                ),
              ),
              SizedBox(height: 27 * s),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  childAspectRatio: .9,
                  crossAxisSpacing: 10,
                  mainAxisSpacing: 8,
                ),
                itemCount: _shieldApps.length,
                itemBuilder: (_, i) {
                  final app = _shieldApps[i];
                  return GestureDetector(
                    onTap: onLaunch,
                    behavior: HitTestBehavior.opaque,
                    child: Column(
                      children: [
                        Stack(
                          clipBehavior: Clip.none,
                          children: [
                            _BrandIcon(id: app.$1, size: 34 * s),
                            if (i == 0)
                              Positioned(
                                right: -4,
                                top: -4,
                                child: Container(
                                  height: 15 * s,
                                  constraints: BoxConstraints(minWidth: 15 * s),
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFFF3B30),
                                    borderRadius: BorderRadius.circular(99),
                                    border: Border.all(color: Onb.canvas),
                                  ),
                                  child: Text(
                                    '12',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 6.5 * s,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                ),
                              ),
                          ],
                        ),
                        SizedBox(height: 4 * s),
                        Text(
                          app.$2,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(color: Onb.ink(1), fontSize: 6 * s),
                        ),
                      ],
                    ),
                  );
                },
              ),
              const Spacer(),
              Container(
                height: 49 * s,
                padding: EdgeInsets.symmetric(horizontal: 10 * s),
                decoration: BoxDecoration(
                  color: Onb.canvas.withValues(alpha: .48),
                  borderRadius: BorderRadius.circular(18 * s),
                  border: Border.all(color: Onb.ink(.1)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    for (final app in _shieldApps.take(4))
                      _BrandIcon(id: app.$1, size: 29 * s),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _SacredPauseScene extends StatelessWidget {
  const _SacredPauseScene({
    super.key,
    required this.phase,
    required this.scale,
  });
  final int phase;
  final double scale;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    final l = L10n.current;
    return Stack(
      fit: StackFit.expand,
      children: [
        TweenAnimationBuilder<double>(
          tween: Tween(begin: 1.08, end: 1),
          duration: const Duration(seconds: 6),
          builder: (_, value, child) =>
              Transform.scale(scale: value, child: child),
          child: ColorFiltered(
            colorFilter: const ColorFilter.matrix([
              1.38,
              0,
              0,
              0,
              12,
              0,
              1.38,
              0,
              0,
              12,
              0,
              0,
              1.38,
              0,
              12,
              0,
              0,
              0,
              1,
              0,
            ]),
            child: Image.asset(
              'assets/images/prayscreen/prayer.jpg',
              fit: BoxFit.cover,
              filterQuality: FilterQuality.medium,
            ),
          ),
        ),
        DecoratedBox(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
              colors: [
                Onb.canvas.withValues(alpha: .02),
                Onb.canvas.withValues(alpha: .34),
                Onb.canvas.withValues(alpha: .82),
              ],
              stops: const [0, .48, 1],
            ),
          ),
        ),
        Padding(
          padding: EdgeInsets.fromLTRB(16 * s, 42 * s, 16 * s, 18 * s),
          child: phase == 2
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 56 * s,
                      height: 56 * s,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Onb.canvas.withValues(alpha: .58),
                        border: Border.all(
                          color: Onb.gold.withValues(alpha: .5),
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: Onb.gold.withValues(alpha: .25),
                            blurRadius: 28,
                          ),
                        ],
                      ),
                      child: LucideIcon(
                        'shield',
                        color: Onb.gold,
                        size: 28 * s,
                      ),
                    ),
                    SizedBox(height: 14 * s),
                    Text(
                      'PRAYLY SHIELD',
                      style: TextStyle(
                        color: Onb.gold,
                        fontSize: 8 * s,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 2,
                      ),
                    ),
                    SizedBox(height: 8 * s),
                    Text(
                      'Instagram can wait.',
                      style: TextStyle(
                        color: Onb.ink(1),
                        fontFamily: 'Cormorant Garamond',
                        fontSize: 17 * s,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    SizedBox(height: 7 * s),
                    Text(
                      l.t('onb.shield.subcopy'),
                      textAlign: TextAlign.center,
                      maxLines: 3,
                      style: TextStyle(
                        color: Onb.ink(.72),
                        fontSize: 8 * s,
                        height: 1.45,
                      ),
                    ),
                  ],
                )
              : phase == 3
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      l.t('onb.ps2.kicker').toUpperCase(),
                      style: TextStyle(
                        color: Onb.gold,
                        fontSize: 7 * s,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.7,
                      ),
                    ),
                    SizedBox(height: 14 * s),
                    Text(
                      '“${l.t('onb.ps2.verse')}”',
                      textAlign: TextAlign.center,
                      maxLines: 5,
                      style: TextStyle(
                        color: Onb.ink(1),
                        fontFamily: 'Cormorant Garamond',
                        fontSize: 19 * s,
                        fontWeight: FontWeight.w700,
                        height: 1.25,
                      ),
                    ),
                    SizedBox(height: 13 * s),
                    Container(
                      width: 30 * s,
                      height: 1,
                      color: Onb.gold.withValues(alpha: .6),
                    ),
                    SizedBox(height: 10 * s),
                    Text(
                      l.t('onb.ps2.reference').toUpperCase(),
                      style: TextStyle(
                        color: Onb.gold,
                        fontSize: 7 * s,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.3,
                      ),
                    ),
                  ],
                )
              : Column(
                  mainAxisAlignment: MainAxisAlignment.end,
                  children: [
                    Text(
                      l.t('onb.ps2.kicker').toUpperCase(),
                      style: TextStyle(
                        color: Onb.gold,
                        fontSize: 7 * s,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 1.7,
                      ),
                    ),
                    SizedBox(height: 10 * s),
                    Text(
                      '“${l.t('onb.ps2.prayer')}”',
                      textAlign: TextAlign.center,
                      maxLines: 8,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: Onb.ink(1),
                        fontFamily: 'Cormorant Garamond',
                        fontSize: 13 * s,
                        fontStyle: FontStyle.italic,
                        fontWeight: FontWeight.w600,
                        height: 1.4,
                      ),
                    ),
                    SizedBox(height: 16 * s),
                    Container(
                      height: 40 * s,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: phase == 5
                            ? Onb.goldFill
                            : Onb.canvas.withValues(alpha: .6),
                        borderRadius: BorderRadius.circular(99),
                        border: Border.all(
                          color: Onb.gold.withValues(alpha: .58),
                        ),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          LucideIcon(
                            phase == 5 ? 'check' : 'heart',
                            color: phase == 5 ? Onb.ctaText : Onb.gold,
                            size: 12 * s,
                          ),
                          SizedBox(width: 7 * s),
                          Flexible(
                            child: Text(
                              phase == 5
                                  ? l.t('onb.ps3.step3').toUpperCase()
                                  : l.t('onb.ps2.action').toUpperCase(),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: phase == 5 ? Onb.ctaText : Onb.gold,
                                fontSize: 8 * s,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1,
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
    );
  }
}

class _FeedScene extends StatelessWidget {
  const _FeedScene({super.key, required this.scale});
  final double scale;

  @override
  Widget build(BuildContext context) {
    final s = scale;
    const portraitAlignments = [
      Alignment.topLeft,
      Alignment.topRight,
      Alignment.bottomLeft,
      Alignment.bottomRight,
    ];
    const names = ['You', 'Maya', 'Noah', 'Aanya'];
    return Container(
      color: Onb.surface(1),
      padding: EdgeInsets.only(top: 36 * s, bottom: 9 * s),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 12 * s),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    'Instagram',
                    style: TextStyle(
                      color: Onb.ink(1),
                      fontFamily: 'Cormorant Garamond',
                      fontSize: 16 * s,
                      fontWeight: FontWeight.w800,
                      fontStyle: FontStyle.italic,
                    ),
                  ),
                ),
                LucideIcon('heart', color: Onb.ink(1), size: 15 * s),
                SizedBox(width: 10 * s),
                LucideIcon('share-2', color: Onb.ink(1), size: 15 * s),
              ],
            ),
          ),
          SizedBox(height: 8 * s),
          SizedBox(
            height: 48 * s,
            child: ListView.separated(
              padding: EdgeInsets.symmetric(horizontal: 12 * s),
              scrollDirection: Axis.horizontal,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: names.length,
              separatorBuilder: (_, __) => SizedBox(width: 8 * s),
              itemBuilder: (_, i) => Column(
                children: [
                  Container(
                    width: 34 * s,
                    height: 34 * s,
                    padding: EdgeInsets.all(2 * s),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: Onb.gold, width: 2),
                    ),
                    child: ClipOval(
                      child: Image.asset(
                        'assets/images/prayscreen/portraits.jpg',
                        fit: BoxFit.cover,
                        alignment: portraitAlignments[i],
                      ),
                    ),
                  ),
                  Text(
                    names[i],
                    style: TextStyle(color: Onb.ink(.62), fontSize: 5.5 * s),
                  ),
                ],
              ),
            ),
          ),
          Divider(height: 1, color: Onb.ink(.12)),
          Padding(
            padding: EdgeInsets.all(9 * s),
            child: Row(
              children: [
                ClipOval(
                  child: Image.asset(
                    'assets/images/prayscreen/portraits.jpg',
                    width: 24 * s,
                    height: 24 * s,
                    fit: BoxFit.cover,
                    alignment: Alignment.topLeft,
                  ),
                ),
                SizedBox(width: 7 * s),
                Expanded(
                  child: Text(
                    'still.and.seeking',
                    style: TextStyle(
                      color: Onb.ink(1),
                      fontSize: 7 * s,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                LucideIcon('settings', color: Onb.ink(1), size: 14 * s),
              ],
            ),
          ),
          SizedBox(
            height: 181 * s,
            width: double.infinity,
            child: Image.asset(
              'assets/images/prayscreen/feed.jpg',
              fit: BoxFit.cover,
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(10 * s, 8 * s, 10 * s, 0),
            child: Row(
              children: [
                LucideIcon('heart', color: Onb.ink(1), size: 15 * s),
                SizedBox(width: 10 * s),
                LucideIcon(
                  'message-circle-heart',
                  color: Onb.ink(1),
                  size: 15 * s,
                ),
                SizedBox(width: 10 * s),
                LucideIcon('share-2', color: Onb.ink(1), size: 15 * s),
                const Spacer(),
                LucideIcon('book-open', color: Onb.ink(1), size: 15 * s),
              ],
            ),
          ),
          Padding(
            padding: EdgeInsets.fromLTRB(10 * s, 5 * s, 10 * s, 0),
            child: Text(
              '2,418 likes\nstill.and.seeking  Some peace is found before the scroll begins.',
              maxLines: 3,
              style: TextStyle(
                color: Onb.ink(.92),
                fontSize: 6.5 * s,
                height: 1.35,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
