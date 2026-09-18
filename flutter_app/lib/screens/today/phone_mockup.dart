import 'dart:math' as math;
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/content_data.dart';
import '../../core/theme/app_colors.dart';
import 'today_shared.dart';

/// Placeholder for off-screen carousel slides — port of `LiteMockup` in
/// `src/pages/Today.tsx`. Flat titanium frame, no image decode, no verse lookup.
class LiteMockup extends StatelessWidget {
  const LiteMockup({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(26),
        gradient: LinearGradient(
          begin: const Alignment(-0.6, -1),
          end: const Alignment(0.6, 1),
          colors: [hsl(42, 30, 30), hsl(0, 0, 6), hsl(42, 25, 24)],
          stops: const [0, 0.55, 1],
        ),
      ),
      child: DecoratedBox(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(23),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [hsl(220, 45, 9), hsl(220, 55, 5)],
          ),
        ),
      ),
    );
  }
}

/// 1:1 port of `PhoneMockup` in `src/pages/Today.tsx`: titanium-gold frame,
/// iOS status bar + dynamic island, lock-screen clock, verse overlay for other
/// days, frosted "veiled scripture" teaser when locked, `Day X / 365` chip.
class PhoneMockup extends StatelessWidget {
  const PhoneMockup({
    super.key,
    required this.date,
    required this.isToday,
    this.isLocked = false,
    this.previewSrc,
    this.loading = false,
  });

  final DateTime date;
  final bool isToday;
  final bool isLocked;
  final String? previewSrc;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final bg = ContentData.bgCardForDay(date);
    final verse = ContentData.verseForDate(date);
    final src = isToday ? (previewSrc ?? bg) : bg;

    // Android WebViews got a softer veil on web; Flutter renders the same 5px.
    const blurPx = 5.0;

    // Book name only ("Psalms" from "Psalms 91:1").
    final match = RegExp(r'^(\d?\s?[^\d]+?)\s*\d').firstMatch(verse.reference);
    final teaserRef = (match?.group(1) ?? verse.reference).trim();

    // Devanagari matras break with wide tracking — near-zero for Hindi.
    final lang = L10n.current.lang;
    final refTracking = lang == 'hi' ? 0.03 : 0.18;
    final lockedRefTracking = lang == 'hi' ? 0.03 : 0.2;

    // Fit the verse by shrinking type instead of cutting mid-sentence.
    var versePreview = verse.text.trim();
    if (versePreview.length > 160) {
      final cut = versePreview.substring(0, 160);
      final sp = cut.lastIndexOf(' ');
      versePreview = '${(sp > 160 * 0.6 ? cut.substring(0, sp) : cut).trim()}…';
    }
    final verseFontSize = versePreview.length > 130
        ? 7.2
        : versePreview.length > 100
        ? 8.2
        : 9.5;

    final timeLabel = isToday
        ? '${date.hour}:${twoDigits(date.minute)}'
        : '8:00';

    final dayOfYear = ContentData.dayOfYear(date);
    final daysInYear = ContentData.daysInYear(date);

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Ground contact shadow
        Positioned(
          bottom: -8,
          left: 0,
          right: 0,
          height: 16,
          child: Center(
            child: FractionallySizedBox(
              widthFactor: 0.78,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      Colors.black.withValues(alpha: 0.65),
                      Colors.transparent,
                    ],
                    stops: const [0, 0.7],
                  ),
                ),
              ),
            ),
          ),
        ),

        // Titanium gold frame
        Positioned.fill(
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: SweepGradient(
                startAngle: 130 * math.pi / 180,
                endAngle: 130 * math.pi / 180 + 2 * math.pi,
                colors: [
                  hsl(42, 35, 38),
                  hsl(0, 0, 8),
                  hsl(0, 0, 4),
                  hsl(0, 0, 6),
                  hsl(42, 28, 28),
                  hsl(42, 35, 38),
                ],
                stops: const [0, 60 / 360, 150 / 360, 230 / 360, 320 / 360, 1],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.95),
                  blurRadius: 48,
                  spreadRadius: -20,
                  offset: const Offset(0, 24),
                ),
              ],
            ),
            child: Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: Colors.black,
                borderRadius: BorderRadius.circular(23),
                border: Border.all(color: Colors.black, width: 1),
              ),
              child: Stack(
                children: [
                  if (src != null)
                    Positioned.fill(
                      child: isLocked
                          ? ImageFiltered(
                              imageFilter: ImageFilter.blur(
                                sigmaX: blurPx,
                                sigmaY: blurPx,
                              ),
                              child: Transform.scale(
                                scale: 1.08,
                                child: _Bg(src: src, eager: isToday),
                              ),
                            )
                          : _Bg(src: src, eager: isToday),
                    ),

                  if (loading && isToday && previewSrc == null)
                    const Positioned.fill(
                      child: Center(child: _GoldenPulseDots()),
                    ),

                  // Readability gradient (today uses the rendered wallpaper)
                  if (!isToday)
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: isLocked
                                ? [
                                    hsl(228, 40, 6, 0.32),
                                    hsl(228, 40, 5, 0.6),
                                    hsl(228, 40, 4, 0.68),
                                  ]
                                : [
                                    Colors.black.withValues(alpha: 0.25),
                                    Colors.black.withValues(alpha: 0.55),
                                    Colors.black.withValues(alpha: 0.6),
                                    Colors.black.withValues(alpha: 0.4),
                                  ],
                            stops: isLocked
                                ? const [0, 0.45, 1]
                                : const [0, 0.38, 0.6, 1],
                          ),
                        ),
                      ),
                    ),

                  if (isLocked)
                    Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: RadialGradient(
                            center: const Alignment(0, 0.04),
                            radius: 0.8,
                            colors: [hsl(42, 95, 62, 0.14), Colors.transparent],
                            stops: const [0, 0.7],
                          ),
                        ),
                      ),
                    ),

                  // iOS status bar
                  Positioned(
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 22,
                    child: LayoutBuilder(
                      builder: (context, c) => Padding(
                        padding: EdgeInsets.symmetric(
                          horizontal: c.maxWidth * 0.09,
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              timeLabel,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 8,
                                height: 1,
                                fontWeight: FontWeight.w600,
                                shadows: [
                                  Shadow(
                                    color: Color(0x99000000),
                                    blurRadius: 2,
                                    offset: Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),
                            const _StatusIcons(),
                          ],
                        ),
                      ),
                    ),
                  ),

                  // Dynamic island
                  Positioned(
                    top: 6,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: FractionallySizedBox(
                        widthFactor: 0.24,
                        child: Container(
                          height: 10,
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                    ),
                  ),

                  // Lock-screen clock + date
                  Positioned(
                    top: 26,
                    left: 0,
                    right: 0,
                    child: Column(
                      children: [
                        Text(
                          '${dayLabel(date)}, ${monthLabel(date.month - 1)} ${date.day}',
                          style: TextStyle(
                            color: Colors.white.withValues(alpha: 0.95),
                            fontSize: 7.5,
                            fontWeight: FontWeight.w500,
                            letterSpacing: 0.2,
                            shadows: const [
                              Shadow(
                                color: Color(0xB3000000),
                                blurRadius: 3,
                                offset: Offset(0, 1),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          timeLabel,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 30,
                            height: 1,
                            fontWeight: FontWeight.w300,
                            letterSpacing: -1,
                            shadows: [
                              Shadow(
                                color: Color(0xB3000000),
                                blurRadius: 6,
                                offset: Offset(0, 2),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Verse overlay for other days
                  if (!isToday && !isLocked)
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 12),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(
                              '“$versePreview”',
                              textAlign: TextAlign.center,
                              maxLines: 7,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontFamily: kSerif,
                                fontFamilyFallback: kSerifFallback,
                                fontStyle: FontStyle.italic,
                                fontWeight: FontWeight.w600,
                                color: Colors.white,
                                fontSize: verseFontSize,
                                height: 1.35,
                                shadows: const [
                                  Shadow(
                                    color: Color(0xD9000000),
                                    blurRadius: 6,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              '— ${verse.reference}'.toUpperCase(),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: hsl(42, 92, 70),
                                fontSize: 6.5,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 6.5 * refTracking,
                                shadows: const [
                                  Shadow(
                                    color: Color(0xD9000000),
                                    blurRadius: 3,
                                    offset: Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Locked day — frosted teaser
                  if (!isToday && isLocked)
                    Positioned.fill(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            for (final w in const [0.92, 1.0, 0.78, 0.58])
                              Padding(
                                padding: const EdgeInsets.only(bottom: 4),
                                child: FractionallySizedBox(
                                  widthFactor: w,
                                  child: Container(
                                    height: 4.5,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      gradient: LinearGradient(
                                        colors: [
                                          Colors.white.withValues(alpha: 0.16),
                                          Colors.white.withValues(alpha: 0.42),
                                          Colors.white.withValues(alpha: 0.16),
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.45,
                                          ),
                                          blurRadius: 3,
                                          offset: const Offset(0, 1),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            const SizedBox(height: 6),
                            Text(
                              teaserRef.toUpperCase(),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: hsl(42, 95, 74),
                                fontSize: 6.5,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 6.5 * lockedRefTracking,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 6,
                                vertical: 2,
                              ),
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                color: hsl(42, 90, 58, 0.18),
                                border: Border.all(
                                  color: hsl(42, 95, 68, 0.55),
                                  width: 0.5,
                                ),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.lock,
                                    size: 6,
                                    color: hsl(42, 100, 78),
                                  ),
                                  const SizedBox(width: 3),
                                  Text(
                                    t('today.badge.pro'),
                                    style: TextStyle(
                                      fontSize: 5.5,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 5.5 * 0.14,
                                      color: hsl(42, 100, 80),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),

                  // Home indicator
                  Positioned(
                    bottom: 5,
                    left: 0,
                    right: 0,
                    child: Center(
                      child: Container(
                        width: 60,
                        height: 3,
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.85),
                          borderRadius: BorderRadius.circular(999),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),

        // "Day X / 365" chip above the frame
        Positioned(
          top: -24,
          left: 0,
          right: 0,
          child: Center(
            child: Text(
              t('today.dayBadge', {'day': dayOfYear, 'total': daysInYear}),
              maxLines: 1,
              style: TextStyle(
                fontSize: 9,
                fontWeight: FontWeight.w600,
                letterSpacing: 9 * 0.16,
                color: AppColors.primary.withValues(alpha: 0.85),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _Bg extends StatelessWidget {
  const _Bg({required this.src, required this.eager});

  final String src;
  final bool eager;

  @override
  Widget build(BuildContext context) {
    return CachedNetworkImage(
      imageUrl: src,
      fit: BoxFit.cover,
      fadeInDuration: Duration(milliseconds: eager ? 0 : 160),
      placeholder: (_, __) => const SizedBox.shrink(),
      errorWidget: (_, __, ___) => const SizedBox.shrink(),
    );
  }
}

class _StatusIcons extends StatelessWidget {
  const _StatusIcons();

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        // Signal bars
        for (final h in const [2.0, 3.5, 5.0, 7.0])
          Padding(
            padding: const EdgeInsets.only(right: 1),
            child: Container(
              width: 1.5,
              height: h,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(0.3),
              ),
            ),
          ),
        const SizedBox(width: 2),
        // Battery
        Container(
          width: 12,
          height: 5.5,
          padding: const EdgeInsets.all(0.5),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(1.5),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.9),
              width: 0.6,
            ),
          ),
          child: FractionallySizedBox(
            widthFactor: 0.8,
            alignment: Alignment.centerLeft,
            child: Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(0.5),
              ),
            ),
          ),
        ),
        Container(
          width: 1,
          height: 3,
          margin: const EdgeInsets.only(left: 0.5),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.9),
            borderRadius: const BorderRadius.horizontal(
              right: Radius.circular(1),
            ),
          ),
        ),
      ],
    );
  }
}

/// Port of the `.golden-pulse-dots` loader used while today's wallpaper renders.
class _GoldenPulseDots extends StatefulWidget {
  const _GoldenPulseDots();

  @override
  State<_GoldenPulseDots> createState() => _GoldenPulseDotsState();
}

class _GoldenPulseDotsState extends State<_GoldenPulseDots>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) => Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: List.generate(3, (i) {
          final phase = (_c.value + i * 0.2) % 1.0;
          final scale = 0.7 + 0.4 * math.sin(phase * math.pi).abs();
          return Padding(
            padding: const EdgeInsets.symmetric(horizontal: 3),
            child: Transform.scale(
              scale: scale,
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: AppColors.primary.withValues(alpha: 0.85),
                  shape: BoxShape.circle,
                ),
              ),
            ),
          );
        }),
      ),
    );
  }
}
