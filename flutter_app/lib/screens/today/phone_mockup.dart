import 'dart:math' as math;
import 'dart:typed_data';
import 'dart:ui' show ImageFilter;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/content_data.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'today_shared.dart';

/// Placeholder for off-screen carousel slides — port of `LiteMockup` in
/// `src/pages/Today.tsx`. Flat titanium frame, no image decode, no verse lookup.
class LiteMockup extends StatelessWidget {
  const LiteMockup({super.key, this.date});

  /// When given, the side card shows that day's real (cached) wallpaper so the
  /// carousel never looks like a row of black holes — same as the web build.
  final DateTime? date;

  @override
  Widget build(BuildContext context) {
    final src = date == null ? null : ContentData.bgCardForDay(date!);
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
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(23),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [hsl(220, 45, 9), hsl(220, 55, 5)],
          ),
        ),
        // No ColorBoost here: `ColorFiltered` forces a saveLayer for every
        // card on every frame of the swipe (the carousel moves them all), and
        // the homeRail boost (contrast 1.05 / saturate 1.10) is invisible at
        // this size. Dropping it removes N full-card GPU layers per frame.
        child: src == null
            ? const SizedBox.expand()
            : CachedNetworkImage(
                imageUrl: src,
                fit: BoxFit.cover,
                fadeInDuration: const Duration(milliseconds: 120),
                memCacheWidth: 240,
                placeholder: (_, _) => const SizedBox.expand(),
                errorWidget: (_, _, _) => const SizedBox.expand(),
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
    this.previewBytes,
    this.loading = false,
  });

  final DateTime date;
  final bool isToday;
  final bool isLocked;
  final String? previewSrc;
  final Uint8List? previewBytes;
  final bool loading;

  /// The mockup's type is drawn at fixed logical sizes (8px clock label, 7.5px
  /// date, …) that were tuned for a ~104px wide card. Two things broke that:
  /// the OS font-size setting (Android "Large" text scaled every label up and
  /// pushed the date onto two lines / spilled the verse) and small phones,
  /// where the card is narrower but the type stayed the same size.
  ///
  /// So the phone is now laid out ONCE at its design width and uniformly
  /// scaled to whatever space it gets, with text scaling disabled inside — the
  /// mockup looks pixel-identical on every screen and font setting.
  @override
  Widget build(BuildContext context) {
    const designW = 104.0;
    // No RepaintBoundary here: the carousel already wraps every page in one,
    // and a second nested boundary inside the depth transform made Impeller
    // allocate and blit two offscreen textures per card per frame.
    return MediaQuery.withNoTextScaling(
      child: LayoutBuilder(
        builder: (context, c) {
          final scale = (c.maxWidth.isFinite && c.maxWidth > 0)
              ? c.maxWidth / designW
              : 1.0;
          return Transform.scale(
            scale: scale,
            alignment: Alignment.center,
            child: SizedBox(
              width: designW,
              height: c.maxHeight.isFinite
                  ? c.maxHeight / scale
                  : designW * 2.2,
              child: _phone(context),
            ),
          );
        },
      ),
    );
  }


  Widget _phone(BuildContext context) {
    final bg = ContentData.bgCardForDay(date);
    final verse = ContentData.verseForDate(date);
    // Always paint the real cached day background; the heavy rendered PNG used
    // to be inserted here for today and left the card pitch black when the
    // canvas render failed. Verse text is drawn as crisp Flutter widgets.
    final src = bg;

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
        // Titanium gold frame.
        //
        // Perf: the carousel transform changes every frame, so each visible
        // card's picture is re-rasterised every frame (a browser reuses the
        // cached texture for a CSS transform — that is exactly why the
        // Capacitor build felt lighter). Two things dominated that per-frame
        // cost and are gone now:
        //   * a SweepGradient shader on the 3px frame (sweep is the most
        //     expensive gradient on Impeller) → the same linear titanium ramp
        //     LiteMockup already uses; indistinguishable on a 3px edge;
        //   * a 48px-blur / -20 spread drop shadow plus a radial "ground
        //     contact" gradient, i.e. two large blurred fills per card per
        //     frame → one tight shadow.
        Positioned.fill(
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(26),
              gradient: LinearGradient(
                begin: const Alignment(-0.6, -1),
                end: const Alignment(0.6, 1),
                colors: AppColors.isLight
                    ? [hsl(220, 12, 78), hsl(220, 14, 38), hsl(220, 12, 82)]
                    : [hsl(42, 35, 38), hsl(0, 0, 5), hsl(42, 30, 32)],
                stops: const [0, 0.55, 1],
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.7),
                  blurRadius: 14,
                  spreadRadius: -6,
                  offset: const Offset(0, 10),
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

                  // Readability gradient
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
                    // The phone is always laid out at the fixed 104dp design
                    // width (3dp frame + 1dp bezel → 96dp screen), so this inset
                    // is a constant: no LayoutBuilder, no extra layout pass per
                    // card while the carousel moves.
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 96 * 0.09,
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

                  // Lock-screen clock + date. FittedBox keeps long translated
                  // weekday/month labels on one line inside the tiny mockup.
                  Positioned(
                    top: 26,
                    left: 0,
                    right: 0,
                    child: Column(
                      children: [
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: FittedBox(
                            fit: BoxFit.scaleDown,
                            child: Text(
                              '${dayLabel(date)}, ${monthLabel(date.month - 1)} ${date.day}',
                              maxLines: 1,
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

                  // Verse overlay (every day, including today)
                  if (!isLocked)
                    Positioned(
                      top: 56,
                      bottom: 30,
                      left: 0,
                      right: 0,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 10),
                        child: FittedBox(
                          fit: BoxFit.scaleDown,
                          alignment: Alignment.center,
                          child: SizedBox(
                            width: 84,
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
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
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
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
                      ),
                    ),

                  // Locked day — frosted teaser
                  if (isLocked)
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
                                  LucideIcon(
                                    'lock',
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
              overflow: TextOverflow.ellipsis,
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
    // ColorBoost removed on purpose — see LiteMockup: one saveLayer per phone
    // per frame during the swipe for an imperceptible colour tweak.
    // Decode to the real on-screen need (card is ~104dp wide) instead of a flat
    // 480px: on a 3x panel that was ~2x more pixels to decode and upload for
    // every visible phone, and the decode landed exactly on the swipe's last
    // frames — which is what read as a hitch when the card settled.
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final cacheW = (104 * dpr).clamp(240.0, 420.0).round();
    return CachedNetworkImage(
      imageUrl: src,
      fit: BoxFit.cover,
      memCacheWidth: cacheW,
      fadeInDuration: Duration(milliseconds: eager ? 0 : 160),
      placeholder: (_, __) => const _ImagePlaceholder(),
      errorWidget: (_, __, ___) => const _ImagePlaceholder(),
    );
  }

}

class _ImagePlaceholder extends StatelessWidget {
  const _ImagePlaceholder();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [hsl(222, 42, 10), hsl(222, 52, 5)],
        ),
      ),
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
    return RepaintBoundary(
      child: AnimatedBuilder(
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
      ),
    );
  }
}
