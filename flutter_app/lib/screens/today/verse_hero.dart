import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import 'phone_mockup.dart';
import 'today_shared.dart';

/// Day offsets shown in the carousel — identical to web `DAY_OFFSETS`.
const kDayOffsets = <int>[-3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7];
final kTodayIdx = kDayOffsets.indexOf(0);

/// 1:1 port of `VerseHero` in `src/pages/Today.tsx`: badge + promise line,
/// 11-day snap carousel of phone mockups (real mockups only within ±2 of the
/// settled index), live caption, jump-to-today chip, dots and the two CTAs.
class VerseHero extends ConsumerStatefulWidget {
  const VerseHero({
    super.key,
    required this.onPremium,
    required this.onOpenDailyVerse,
  });

  final VoidCallback onPremium;
  final VoidCallback onOpenDailyVerse;

  @override
  ConsumerState<VerseHero> createState() => _VerseHeroState();
}

class _VerseHeroState extends ConsumerState<VerseHero> {
  final _controller = PageController(initialPage: 3, viewportFraction: 0.38);

  int _activeIdx = 3;
  int _settledIdx = 3;
  Timer? _settleTimer;
  Timer? _tick;
  DateTime _now = DateTime.now();
  final _seenLocked = <int>{};

  @override
  void initState() {
    super.initState();
    // The countdown caption only needs minute resolution — 60s ticks on mobile
    // (the web build does the same on Android / low-end devices).
    _tick = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted) setState(() => _now = DateTime.now());
    });
    _controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller.removeListener(_onScroll);
    _controller.dispose();
    _settleTimer?.cancel();
    _tick?.cancel();
    super.dispose();
  }

  void _onScroll() {
    final page = _controller.page;
    if (page == null) return;
    final best = page.round().clamp(0, kDayOffsets.length - 1);
    if (best != _activeIdx) {
      haptic(HapticStyle.soft);
      setState(() => _activeIdx = best);
    }
    // Never mount a heavy mockup mid-swipe — wait for the swipe to settle.
    _settleTimer?.cancel();
    _settleTimer = Timer(const Duration(milliseconds: 140), () {
      if (mounted && _settledIdx != best) setState(() => _settledIdx = best);
    });
  }

  void _scrollToIdx(int i, {bool animate = true}) {
    if (animate) {
      _controller.animateToPage(
        i,
        duration: const Duration(milliseconds: 420),
        curve: Curves.easeOutCubic,
      );
    } else {
      _controller.jumpToPage(i);
    }
  }

  DateTime _dateFor(int offset) {
    final now = DateTime.now();
    return DateTime(
      now.year,
      now.month,
      now.day + offset,
      now.hour,
      now.minute,
    );
  }

  String _captionForOffset(int offset) {
    if (offset == 0) return t('today.caption.today');
    if (offset < 0) {
      return offset == -1
          ? t('today.caption.yesterday')
          : t('today.caption.daysAgo', {'n': -offset});
    }
    final target = DateTime(_now.year, _now.month, _now.day + offset);
    final ms = target.difference(_now).inMilliseconds;
    if (ms <= 0) return t('today.caption.unlocking');
    final totalSec = ms ~/ 1000;
    final days = totalSec ~/ 86400;
    final hours = (totalSec % 86400) ~/ 3600;
    final mins = (totalSec % 3600) ~/ 60;
    final secs = totalSec % 60;
    if (days >= 1) {
      return t('today.caption.unlocksDHM', {'d': days, 'h': hours, 'm': mins});
    }
    if (hours >= 1) {
      return t('today.caption.unlocksHMS', {'h': hours, 'm': mins, 's': secs});
    }
    if (mins >= 1) return t('today.caption.unlocksMS', {'m': mins, 's': secs});
    return t('today.caption.unlocksS', {'s': secs});
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    final activeOffset = kDayOffsets[_activeIdx];
    final isActiveToday = activeOffset == 0;
    final isActiveLocked = !isPremium && !isActiveToday;

    // One upsell impression per session per offset.
    if (isActiveLocked && !_seenLocked.contains(activeOffset)) {
      _seenLocked.add(activeOffset);
      Analytics.capture('today_locked_verse_preview_seen', {
        'day_offset': activeOffset,
      });
    }

    final height = MediaQuery.sizeOf(context).height * 0.32;
    final carouselHeight = height.clamp(250.0, 350.0);

    return FadeRise(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.24)),
          gradient: RadialGradient(
            center: const Alignment(0, -1),
            radius: 1.2,
            colors: [
              AppColors.primary.withValues(alpha: 0.06),
              AppColors.card,
              AppColors.background,
            ],
            stops: const [0, 0.45, 1],
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.75),
              blurRadius: 30,
              spreadRadius: -22,
              offset: const Offset(0, 22),
            ),
          ],
        ),
        child: Stack(
          children: [
            // Ambient aurora behind the phone
            Positioned(
              top: carouselHeight * 0.28,
              left: 0,
              right: 0,
              height: carouselHeight * 0.54,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      colors: [
                        hsl(42, 95, 62, 0.13),
                        hsl(38, 90, 55, 0.07),
                        Colors.transparent,
                      ],
                      stops: const [0, 0.35, 0.65],
                    ),
                  ),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                children: [
                  // Magic line — the hero promise
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      color: AppColors.primary.withValues(alpha: 0.14),
                      border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.32),
                      ),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.star, size: 12, color: AppColors.primary),
                        const SizedBox(width: 6),
                        Text(
                          t('today.hero.badge').toUpperCase(),
                          style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 9 * 0.18,
                            color: AppColors.primary,
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text.rich(
                      TextSpan(
                        children: [
                          TextSpan(text: '${t('today.hero.titlePart1')} '),
                          TextSpan(
                            text: t('today.hero.titlePart2'),
                            style: TextStyle(color: AppColors.primary),
                          ),
                        ],
                      ),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.375,
                        fontWeight: FontWeight.w800,
                        color: AppColors.foreground,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Swipe carousel of phone mockups
                  SizedBox(
                    height: carouselHeight,
                    child: PageView.builder(
                      controller: _controller,
                      padEnds: true,
                      itemCount: kDayOffsets.length,
                      physics: const PageScrollPhysics(),
                      itemBuilder: (context, i) {
                        final offset = kDayOffsets[i];
                        final date = _dateFor(offset);
                        final isToday = offset == 0;
                        final locked = !isPremium && !isToday;
                        final isActive = i == _activeIdx;
                        final near = i == _settledIdx;

                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            haptic(HapticStyle.soft);
                            if (!isActive) {
                              _scrollToIdx(i);
                              Analytics.capture(
                                'today_wallpaper_phone_centered',
                                {'day_offset': offset},
                              );
                              return;
                            }
                            Analytics.capture('today_wallpaper_phone_tapped', {
                              'day_offset': offset,
                              'locked': locked,
                              'is_premium': isPremium,
                            });
                            if (locked) {
                              widget.onPremium();
                            } else {
                              widget.onOpenDailyVerse();
                            }
                          },
                          child: AnimatedOpacity(
                            opacity: isActive ? 1 : 0.32,
                            duration: const Duration(milliseconds: 120),
                            child: AnimatedScale(
                              scale: isActive ? 1 : 0.9,
                              duration: const Duration(milliseconds: 140),
                              curve: Curves.easeOut,
                              child: Padding(
                                // Top room for the "Day X / 365" chip.
                                padding: const EdgeInsets.fromLTRB(4, 22, 4, 8),
                                child: AspectRatio(
                                  aspectRatio: 9 / 19.5,
                                  child: near
                                      ? PhoneMockup(
                                          date: date,
                                          isToday: isToday,
                                          isLocked: false,
                                        )
                                      : const LiteMockup(),
                                ),
                              ),
                            ),
                          ),
                        );
                      },
                    ),
                  ),

                  // Live caption + jump-to-today
                  const SizedBox(height: 8),
                  Wrap(
                    alignment: WrapAlignment.center,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          gradient: isActiveLocked
                              ? LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: [
                                    hsl(42, 70, 16, 0.85),
                                    hsl(38, 70, 10, 0.85),
                                  ],
                                )
                              : null,
                          color: isActiveLocked
                              ? null
                              : AppColors.foreground.withValues(alpha: 0.08),
                          border: Border.all(
                            color: isActiveLocked
                                ? hsl(42, 90, 55, 0.5)
                                : AppColors.foreground.withValues(alpha: 0.12),
                          ),
                          boxShadow: isActiveLocked
                              ? [
                                  BoxShadow(
                                    color: hsl(42, 92, 50, 0.35),
                                    blurRadius: 14,
                                    spreadRadius: -4,
                                    offset: const Offset(0, 4),
                                  ),
                                ]
                              : null,
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isActiveLocked) ...[
                              Container(
                                width: 6,
                                height: 6,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: hsl(42, 100, 70),
                                  boxShadow: [
                                    BoxShadow(
                                      color: hsl(42, 100, 65),
                                      blurRadius: 6,
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 6),
                            ],
                            Text(
                              _captionForOffset(activeOffset).toUpperCase(),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 11 * 0.06,
                                fontFeatures: const [
                                  FontFeature.tabularFigures(),
                                ],
                                color: isActiveLocked
                                    ? hsl(42, 100, 78)
                                    : AppColors.foreground.withValues(
                                        alpha: 0.85,
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      if (_activeIdx != kTodayIdx)
                        TapScale(
                          scale: 0.94,
                          onTap: () {
                            haptic(HapticStyle.soft);
                            _scrollToIdx(kTodayIdx);
                          },
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [hsl(42, 92, 60), hsl(38, 88, 48)],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: AppColors.primary.withValues(
                                    alpha: 0.55,
                                  ),
                                  blurRadius: 14,
                                  spreadRadius: -4,
                                  offset: const Offset(0, 4),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.wb_sunny,
                                  size: 12,
                                  color: AppColors.background,
                                ),
                                const SizedBox(width: 4),
                                Text(
                                  t('today.hero.todayBtn').toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 11 * 0.06,
                                    color: AppColors.background,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                    ],
                  ),

                  // Pagination dots — tappable
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      for (var i = 0; i < kDayOffsets.length; i++)
                        GestureDetector(
                          onTap: () {
                            haptic(HapticStyle.soft);
                            _scrollToIdx(i);
                          },
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 3),
                            child: AnimatedContainer(
                              duration: const Duration(milliseconds: 300),
                              width: i == _activeIdx ? 18 : 5,
                              height: 5,
                              decoration: BoxDecoration(
                                borderRadius: BorderRadius.circular(999),
                                gradient: i == _activeIdx
                                    ? LinearGradient(
                                        colors: [
                                          hsl(42, 92, 60),
                                          hsl(38, 100, 70),
                                        ],
                                      )
                                    : null,
                                color: i == _activeIdx
                                    ? null
                                    : i == kTodayIdx
                                    ? AppColors.primary.withValues(alpha: 0.55)
                                    : AppColors.foreground.withValues(
                                        alpha: 0.18,
                                      ),
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),

                  // Primary CTA
                  const SizedBox(height: 10),
                  TapScale(
                    scale: 0.985,
                    onTap: () {
                      haptic(HapticStyle.medium);
                      Analytics.capture('today_set_verse_cta_tapped', {
                        'is_premium': isPremium,
                        'locked': isActiveLocked,
                        'day_offset': activeOffset,
                      });
                      if (isActiveLocked) {
                        widget.onPremium();
                      } else {
                        widget.onOpenDailyVerse();
                      }
                    },
                    child: Container(
                      height: 48,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        gradient: isActiveLocked
                            ? LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [hsl(42, 78, 52), hsl(38, 80, 42)],
                              )
                            : LinearGradient(
                                begin: const Alignment(-1, -1),
                                end: const Alignment(1, 1),
                                colors: [
                                  AppColors.primary.withValues(alpha: 0.14),
                                  AppColors.accent.withValues(alpha: 0.10),
                                ],
                              ),
                        border: isActiveLocked
                            ? null
                            : Border.all(
                                color: AppColors.primary.withValues(
                                  alpha: 0.42,
                                ),
                              ),
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.primary.withValues(
                              alpha: isActiveLocked ? 0.6 : 0.45,
                            ),
                            blurRadius: isActiveLocked ? 22 : 18,
                            spreadRadius: isActiveLocked ? -6 : -8,
                            offset: Offset(0, isActiveLocked ? 10 : 6),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(
                            isActiveLocked
                                ? Icons.workspace_premium
                                : Icons.star,
                            size: 16,
                            color: isActiveLocked
                                ? AppColors.background
                                : AppColors.primary,
                          ),
                          const SizedBox(width: 8),
                          Text(
                            isActiveLocked
                                ? t('today.hero.ctaUnlock')
                                : t('today.hero.ctaSetFree'),
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 14 * 0.02,
                              color: isActiveLocked
                                  ? AppColors.background
                                  : AppColors.primary,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                  // Secondary CTA — auto-changing wallpaper (Pro upsell)
                  if (!isPremium && !isActiveLocked) ...[
                    const SizedBox(height: 8),
                    TapScale(
                      scale: 0.985,
                      onTap: () {
                        haptic(HapticStyle.medium);
                        Analytics.capture('today_auto_change_pro_tapped', {});
                        widget.onPremium();
                      },
                      child: Container(
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [hsl(42, 92, 60), hsl(38, 88, 48)],
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: AppColors.primary.withValues(alpha: 0.6),
                              blurRadius: 22,
                              spreadRadius: -6,
                              offset: const Offset(0, 10),
                            ),
                          ],
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.workspace_premium,
                              size: 14,
                              color: AppColors.background,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              t('today.hero.ctaAutoChange'),
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 13 * 0.02,
                                color: AppColors.background,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
