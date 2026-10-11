import 'dart:async';
import 'dart:ui' show FontFeature;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../core/widgets/outer_shadow.dart';
import '../../state/app_providers.dart';
import 'phone_mockup.dart';
import 'today_shared.dart';
import 'today_ink.dart';

/// Page physics tuned to feel like the web carousel's native momentum scroll.
///
/// Flutter's default [PageScrollPhysics] uses a stiff, heavily damped spring
/// (stiffness 100 / damping 1.0) which makes every flick feel weighty and slow
/// to settle. Softer mass with a livelier spring lets the card follow the
/// finger and snap crisply, like the browser's `snap-x` momentum scrolling.
class _SnappyPagePhysics extends PageScrollPhysics {
  const _SnappyPagePhysics({super.parent});

  @override
  _SnappyPagePhysics applyTo(ScrollPhysics? ancestor) =>
      _SnappyPagePhysics(parent: buildParent(ancestor));

  static final SpringDescription _spring = SpringDescription.withDampingRatio(
    mass: 0.32,
    stiffness: 200,
    ratio: 1.0,
  );

  @override
  SpringDescription get spring => _spring;

  // A touch less finger travel before the drag starts tracking, so the swipe
  // responds immediately instead of feeling glued.
  @override
  double get dragStartDistanceMotionThreshold => 1.5;

  @override
  double get minFlingVelocity => 30;

}

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
  // The page slot is (card width + gap) / screen width, both derived from the
  // carousel height exactly like web — see `_ensureController` in build().
  PageController _controller = PageController(
    initialPage: 3,
    viewportFraction: 0.34,
  );
  double _fraction = 0.34;

  /// Rebuilds the controller only when the computed slot changes meaningfully
  /// (first layout, rotation, split-screen), keeping the current page.
  void _ensureController(double fraction) {
    final f = fraction.clamp(0.20, 0.60).toDouble();
    if ((f - _fraction).abs() < 0.005) return;
    final page = _active.value;
    final old = _controller;
    _fraction = f;
    _controller = PageController(initialPage: page, viewportFraction: f);
    WidgetsBinding.instance.addPostFrameCallback((_) => old.dispose());
  }

  // Swipe state lives in notifiers, never in setState: a page change used to
  // rebuild the WHOLE hero (11 mockups, shadows, CTAs) on the same frame the
  // fling was still animating, which is the "jam" felt mid-swipe. Now only the
  // caption/dots/CTA subtree repaints, and the pages themselves ride the
  // controller directly.
  final _active = ValueNotifier<int>(3);
  // Keep full artwork only around the resting page. This preserves the
  // original separate-phone composition without decoding every mockup during
  // a fling.
  final _settled = ValueNotifier<int>(3);
  Timer? _settleTimer;
  Timer? _tick;
  final _nowN = ValueNotifier<DateTime>(DateTime.now());
  final _seenLocked = <int>{};

  int get _activeIdx => _active.value;

  @override
  void initState() {
    super.initState();
    // The countdown caption only needs minute resolution — 60s ticks on mobile
    // (the web build does the same on Android / low-end devices).
    _tick = Timer.periodic(const Duration(seconds: 60), (_) {
      if (mounted) _nowN.value = DateTime.now();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _precacheAround(_active.value);
    });
  }


  @override
  void dispose() {
    _controller.dispose();
    _tick?.cancel();
    _settleTimer?.cancel();
    _active.dispose();
    _settled.dispose();
    _nowN.dispose();
    super.dispose();
  }

  DateTime _lastHaptic = DateTime.fromMillisecondsSinceEpoch(0);

  /// Warm the decode for the pages the user is heading towards. Without this
  /// the first decode started exactly when the card swapped to its full mockup
  /// — i.e. on the swipe's last frames — which showed up as a hitch on landing.
  void _precacheAround(int index) {
    if (!mounted) return;
    final dpr = MediaQuery.devicePixelRatioOf(context);
    final w = (104 * dpr).clamp(240.0, 420.0).round();
    for (final d in const [1, -1, 2, -2]) {
      final i = index + d;
      if (i < 0 || i >= kDayOffsets.length) continue;
      final url = ContentData.bgCardForDay(_dateFor(kDayOffsets[i]));
      if (url == null || url.isEmpty) continue;
      precacheImage(
        CachedNetworkImageProvider(url, maxWidth: w),
        context,
        onError: (_, __) {},
      );

    }
  }

  void _onPageChanged(int index) {
    if (index == _active.value) return;
    // A fast fling crosses several pages; firing the vibrator on each one
    // blocks the UI thread on Samsung/One UI. Throttle to ~1 tick per 110ms.
    final now = DateTime.now();
    if (now.difference(_lastHaptic).inMilliseconds > 110) {
      _lastHaptic = now;
      haptic(HapticStyle.soft);
    }
    _active.value = index;
    // Image decode and the full-mockup window are BOTH deferred until the
    // finger/fling has stopped. Decoding (or swapping a Lite card for the heavy
    // PhoneMockup) while the gesture is live was the actual stutter: it inflates
    // a new widget tree and uploads a texture on the very frames that must stay
    // free. The web build behaves the same way via its 140ms settle timer.
    _settleTimer?.cancel();
    _settleTimer = Timer(const Duration(milliseconds: 140), () {
      if (!mounted) return;
      _settled.value = _active.value;
      _precacheAround(_active.value);
    });
  }



  void _scrollToIdx(int i, {bool animate = true}) {
    if (animate) {
      _controller.animateToPage(
        i,
        duration: const Duration(milliseconds: 260),
        curve: Curves.fastOutSlowIn,
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
    final target = DateTime(
      _nowN.value.year,
      _nowN.value.month,
      _nowN.value.day + offset,
    );
    final ms = target.difference(_nowN.value).inMilliseconds;
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

    // The 384px-wide web preview resolves this track to its 300px minimum.
    // Native Android has a much taller usable viewport (around 830dp on an
    // S23 Ultra), so using 38% of height alone made the exact same layout grow
    // to ~315px in the APK: wider phones and visibly collapsed breathing room.
    // Cap by width so a phone-size device renders the same 300px composition
    // as the approved 384px web preview, regardless of screen aspect ratio.
    final screen = MediaQuery.sizeOf(context);
    final heightFromViewport = screen.height * 0.38;
    final heightFromWidth = screen.width * (300 / 384);
    final maxPhoneTrack = heightFromWidth.clamp(300.0, 420.0);
    final carouselHeight = heightFromViewport
        .clamp(300.0, maxPhoneTrack)
        .toDouble();

    // Web derives the phone's WIDTH from its height + 9/19.5 aspect ratio
    // (`height: 92%`, `aspectRatio: 9 / 19.5`) and then puts a 6% gap between
    // the cards. Flutter was doing the opposite: the page width came from
    // viewportFraction and the mockup filled it, so the phones came out wider
    // than the web ones and the gap collapsed to the 4px side padding.
    // Now the width is computed exactly like web and the page slot is
    // card + gap, so the spacing is identical.
    final cardHeight = (carouselHeight - 30) * 0.92;
    final cardWidth = cardHeight * 9 / 19.5;
    // Fixed 16px breathing space — the same value the web track now uses, so
    // the two builds cannot drift apart again (a `%` gap resolved against the
    // container's content box and collapsed to ~7px in the browser).
    const gap = 16.0;
    // PageController applies viewportFraction to the PageView's own width,
    // not the full screen. This carousel sits inside 12px outer margins and
    // 16px inner padding on both sides, so dividing by screen.width silently
    // shrank every slot by 56px worth of scale and swallowed the intended gap.
    // Use the real viewport width so the visible edge-to-edge gap is 16px.
    final pageViewportWidth = (screen.width - 56).clamp(1.0, double.infinity);
    _ensureController((cardWidth + gap) / pageViewportWidth);

    return FadeRise(
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 4, 12, 16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          border: Border.all(color: TodayInk.primary.withValues(alpha: 0.16)),
          color: AppColors.card,
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
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
              child: Column(
                children: [
                  // Magic line — the hero promise. The pill hugs its text and
                  // stays centred (web: `inline-flex` + `text-center`);
                  // FittedBox keeps long translations inside the card instead
                  // of stretching the pill full width.
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 3,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: TodayInk.primary.withValues(alpha: 0.14),
                        border: Border.all(
                          color: TodayInk.primary.withValues(alpha: 0.32),
                        ),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.star, size: 12, color: TodayInk.primary),
                          const SizedBox(width: 6),
                          Text(
                            t('today.hero.badge').toUpperCase(),
                            maxLines: 1,
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 9 * 0.18,
                              color: TodayInk.primary,
                            ),
                          ),
                        ],
                      ),
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
                            style: TextStyle(color: TodayInk.primary),
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
                  // 14: the "Day X / 365" chip sits 24px above each phone frame
                  // and the page padding below now reserves 28px for it, so the
                  // empty band under the gold subtitle is used instead of wasted.
                  const SizedBox(height: 14),

                  // Swipe carousel of phone mockups
                  SizedBox(
                    height: carouselHeight,
                    child: PageView.builder(
                      controller: _controller,
                      padEnds: true,
                      // Keeps the neighbouring mockup rendered so a fast swipe
                      // never lands on an empty page mid-flick.
                      allowImplicitScrolling: true,
                      // Clip.none: the centred phone scales up and its
                      // "Day X / 365" chip lives 24px above the frame — hard
                      // clipping sliced that chip in half.
                      clipBehavior: Clip.none,
                      itemCount: kDayOffsets.length,
                      physics: const _SnappyPagePhysics(
                        parent: BouncingScrollPhysics(),
                      ),
                      onPageChanged: _onPageChanged,
                      itemBuilder: (context, i) {
                        final offset = kDayOffsets[i];
                        final date = _dateFor(offset);
                        final isToday = offset == 0;
                        final locked = !isPremium && !isToday;

                        // Full mockups: ±2 around the RESTING page only.
                        //
                        // It used to also follow `_active`, i.e. the page under
                        // the finger, which meant a heavy PhoneMockup subtree
                        // was built (and a Lite card thrown away) in the middle
                        // of the gesture — a full element/layout pass on a frame
                        // that had 8ms to spare. Now the window only moves once
                        // the swipe has settled, and it is two cards wide so the
                        // destination is already a real mockup before it can
                        // reach the centre. Nothing is rebuilt while the finger
                        // moves; the pages just ride the controller.
                        final card = ValueListenableBuilder<int>(
                          valueListenable: _settled,
                          builder: (context, settled, _) {
                            final near = (i - settled).abs() <= 2;
                            return AspectRatio(
                              aspectRatio: 9 / 19.5,
                              child: near
                                  ? PhoneMockup(
                                      date: date,
                                      isToday: isToday,
                                      isLocked: false,
                                    )
                                  : LiteMockup(date: date),
                            );
                          },
                        );



                        return GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            haptic(HapticStyle.soft);
                            if (i != _active.value) {
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
                          // Scale + dim used to be an AnimatedBuilder that
                          // REBUILT a Stack + ColoredBox for every visible page
                          // on every scroll pixel (5 widgets × 120Hz on an S23
                          // Ultra). _DepthCard does the same maths in a render
                          // object: the controller only triggers a repaint, so
                          // no widget/element work happens while the finger
                          // moves. That is what the web version effectively
                          // does by writing transforms straight to the DOM.
                          child: _DepthCard(
                            controller: _controller,
                            index: i,
                            dimColor: AppColors.card,
                            child: RepaintBoundary(
                              child: Padding(
                                // Web: paddingBlock 22px 8px. Horizontal space
                                // comes from the slot being card + gap wide, so
                                // the phone keeps its exact web width.
                                padding: const EdgeInsets.fromLTRB(0, 22, 0, 8),
                                child: Center(
                                  child: SizedBox(
                                    width: cardWidth,
                                    height: cardHeight,
                                    child: card,
                                  ),
                                ),
                              ),
                            ),
                          ),

                        );
                      },
                    ),
                  ),

                  // Caption / dots / CTAs depend on the active page and the
                  // clock only — isolated so a swipe (or the 60s tick) never
                  // rebuilds the carousel and its mockups.
                  AnimatedBuilder(
                    animation: Listenable.merge([_active, _nowN]),
                    builder: (context, _) {
                      final activeIdx = _active.value;
                      final activeOffset = kDayOffsets[activeIdx];
                      final isActiveLocked = !isPremium && activeOffset != 0;
                      // One upsell impression per session per offset.
                      if (isActiveLocked &&
                          !_seenLocked.contains(activeOffset)) {
                        _seenLocked.add(activeOffset);
                        Analytics.capture('today_locked_verse_preview_seen', {
                          'day_offset': activeOffset,
                        });
                      }
                      return Column(
                        children: [
                          // Live caption + jump-to-today. On today's page the
                          // pill only repeated the free CTA below it, so it is
                          // hidden there — countdown/past-day captions stay.
                          SizedBox(height: activeOffset == 0 ? 2 : 8),
                          Wrap(
                            alignment: WrapAlignment.center,
                            crossAxisAlignment: WrapCrossAlignment.center,
                            spacing: 8,
                            runSpacing: 6,
                            children: [
                              if (activeOffset != 0)
                                Container(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 4,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(999),
                                    // Web: locked → dark gold gradient pill, gold text.
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
                                        : AppColors.foreground.withValues(
                                            alpha: 0.08,
                                          ),
                                    border: Border.all(
                                      color: isActiveLocked
                                          ? hsl(42, 90, 55, 0.5)
                                          : AppColors.foreground.withValues(
                                              alpha: 0.12,
                                            ),
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
                                        _captionForOffset(
                                          activeOffset,
                                        ).toUpperCase(),
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
                                        colors: [
                                          hsl(42, 92, 60),
                                          hsl(38, 88, 48),
                                        ],
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: TodayInk.primary.withValues(
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
                                        LucideIcon(
                                          'sun',
                                          size: 12,
                                          color: AppColors.background,
                                        ),
                                        const SizedBox(width: 4),
                                        Text(
                                          t(
                                            'today.hero.todayBtn',
                                          ).toUpperCase(),
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
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 3,
                                    ),
                                    child: AnimatedContainer(
                                      duration: const Duration(
                                        milliseconds: 300,
                                      ),
                                      width: i == _activeIdx ? 18 : 5,
                                      height: 5,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(
                                          999,
                                        ),
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
                                            ? TodayInk.primary.withValues(
                                                alpha: 0.55,
                                              )
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
                            // The glow must stay OUTSIDE the button: this fill is
                            // translucent in the unlocked state, and Flutter's own
                            // boxShadow bleeds through it (CSS clips it away), which is
                            // what turned the button mustard instead of dark glass.
                            child: OuterShadow(
                              borderRadius: BorderRadius.circular(16),
                              shadows: [
                                BoxShadow(
                                  color: isActiveLocked
                                      ? TodayInk.primary.withValues(alpha: 0.6)
                                      : TodayInk.primary.withValues(
                                          alpha: 0.45,
                                        ),
                                  blurRadius: isActiveLocked ? 22 : 18,
                                  spreadRadius: -8,
                                  offset: Offset(0, isActiveLocked ? 10 : 6),
                                ),
                              ],
                              child: Container(
                                height: 48,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  // Web locked → filled gold; unlocked → glass tint.
                                  gradient: isActiveLocked
                                      ? LinearGradient(
                                          begin: Alignment.topCenter,
                                          end: Alignment.bottomCenter,
                                          colors: [
                                            hsl(42, 78, 52),
                                            hsl(38, 80, 42),
                                          ],
                                        )
                                      : null,
                                  // Web: flat card surface + thin primary frame.
                                  color: isActiveLocked ? null : AppColors.card,
                                  border: isActiveLocked
                                      ? null
                                      : Border.all(
                                          color: TodayInk.primary.withValues(
                                            alpha: 0.35,
                                          ),
                                          width: 1.5,
                                        ),
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
                                          : TodayInk.primary,
                                    ),
                                    const SizedBox(width: 8),
                                    Flexible(
                                      child: Text(
                                        isActiveLocked
                                            ? t('today.hero.ctaUnlock')
                                            : t('today.hero.ctaSetFree'),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(
                                          fontSize: 14,
                                          fontWeight: FontWeight.bold,
                                          letterSpacing: 14 * 0.02,
                                          color: isActiveLocked
                                              ? AppColors.background
                                              : TodayInk.primary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
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
                                Analytics.capture(
                                  'today_auto_change_pro_tapped',
                                  {},
                                );
                                widget.onPremium();
                              },
                              child: Container(
                                height: 44,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  // Web: linear-gradient(180deg, hsl(42 92% 60%), hsl(38 88% 48%))
                                  gradient: LinearGradient(
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                    colors: [hsl(42, 92, 60), hsl(38, 88, 48)],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: TodayInk.primary.withValues(
                                        alpha: 0.6,
                                      ),
                                      blurRadius: 22,
                                      spreadRadius: -6,
                                      offset: const Offset(0, 10),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    LucideIcon(
                                      'crown',
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
                      );
                    },
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Centre-scale + side-dim for one carousel page, done at paint time.
///
/// The page controller only marks this render object as needing paint, so a
/// swipe never rebuilds widgets — the whole point of the rewrite. Mirrors the
/// web carousel's direct transform writes (`Today.tsx` `paintDepth`).
class _DepthCard extends SingleChildRenderObjectWidget {
  const _DepthCard({
    required this.controller,
    required this.index,
    required this.dimColor,
    required Widget super.child,
  });

  final PageController controller;
  final int index;
  final Color dimColor;

  @override
  _DepthRender createRenderObject(BuildContext context) =>
      _DepthRender(controller: controller, index: index, dimColor: dimColor);

  @override
  void updateRenderObject(BuildContext context, _DepthRender renderObject) {
    renderObject
      ..controller = controller
      ..index = index
      ..dimColor = dimColor;
  }
}

class _DepthRender extends RenderProxyBox {
  _DepthRender({
    required PageController controller,
    required int index,
    required Color dimColor,
  }) : _controller = controller,
       _index = index,
       _dimColor = dimColor;

  PageController _controller;
  int _index;
  Color _dimColor;

  /// Last distance actually painted. Cards further than one page away are
  /// already fully scaled/dimmed, so a scroll tick cannot change their look —
  /// repainting them anyway meant all 11 cards asked for a repaint on every
  /// sub-pixel of the swipe. Only the two or three cards that can still change
  /// do any work now.
  double _painted = -1;

  void _onScroll() {
    final d = _distance();
    if (d >= 1 && _painted >= 1) return;
    markNeedsPaint();
  }

  double _distance() {
    final page =
        _controller.hasClients && _controller.position.hasContentDimensions
        ? (_controller.page ?? _index.toDouble())
        : _index.toDouble();
    return (_index - page).abs().clamp(0.0, 1.0);
  }

  set controller(PageController v) {
    if (v == _controller) return;
    if (attached) _controller.removeListener(_onScroll);
    _controller = v;
    if (attached) _controller.addListener(_onScroll);
    markNeedsPaint();
  }

  set index(int v) {
    if (v == _index) return;
    _index = v;
    markNeedsPaint();
  }

  set dimColor(Color v) {
    if (v == _dimColor) return;
    _dimColor = v;
    markNeedsPaint();
  }

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _controller.addListener(_onScroll);
  }

  @override
  void detach() {
    _controller.removeListener(_onScroll);
    super.detach();
  }

  // The scale rides a real compositor layer, so the card's cached raster is
  // reused frame after frame instead of being re-rasterised while the finger
  // moves. This is what the browser does when it writes `transform` to the DOM.
  @override
  bool get alwaysNeedsCompositing => true;

  @override
  void paint(PaintingContext context, Offset offset) {
    if (child == null) return;
    final distance = _distance();
    _painted = distance;
    final scale = 1 - 0.1 * distance;
    final cx = size.width / 2;
    final cy = size.height / 2;
    final m = Matrix4.identity()
      ..translate(cx, cy)
      ..scale(scale, scale)
      ..translate(-cx, -cy);
    context.pushTransform(true, offset, m, (ctx, off) {
      super.paint(ctx, off);
      if (distance > 0.01) {
        ctx.canvas.drawRect(
          off & size,
          Paint()..color = _dimColor.withValues(alpha: 0.42 * distance),
        );
      }
    });
  }
}

