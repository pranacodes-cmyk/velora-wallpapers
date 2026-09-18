import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:share_plus/share_plus.dart';

import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/streak_store.dart';
import '../../core/services/today_tasks_store.dart';
import '../../core/services/verse_wallpaper.dart';
import 'today_shared.dart';

/// Opens the full-screen reflection, port of
/// `src/components/today/VerseReflectionSheet.tsx`. Presented as a fullscreen
/// fade route (web used a portal + AnimatePresence fade) and the Android back
/// button closes it, same as `useAndroidBack`.
Future<void> openVerseReflection(
  BuildContext context, {
  required VoidCallback onContinueToQuiz,
}) {
  return Navigator.of(context, rootNavigator: true).push(
    PageRouteBuilder(
      opaque: true,
      barrierDismissible: false,
      transitionDuration: const Duration(milliseconds: 250),
      reverseTransitionDuration: const Duration(milliseconds: 250),
      pageBuilder: (_, __, ___) =>
          VerseReflectionSheet(onContinueToQuiz: onContinueToQuiz),
      transitionsBuilder: (_, animation, __, child) =>
          FadeTransition(opacity: animation, child: child),
    ),
  );
}

/// Kept for the checklist's call site.
Future<void> showGeneralRoute(
  BuildContext context, {
  required VoidCallback onContinueToQuiz,
}) => openVerseReflection(context, onContinueToQuiz: onContinueToQuiz);

class VerseReflectionSheet extends StatefulWidget {
  const VerseReflectionSheet({super.key, required this.onContinueToQuiz});

  final VoidCallback onContinueToQuiz;

  @override
  State<VerseReflectionSheet> createState() => _VerseReflectionSheetState();
}

class _VerseReflectionSheetState extends State<VerseReflectionSheet> {
  bool _sharing = false;
  bool _handingOff = false;
  late final bool _allDoneOnOpen;

  @override
  void initState() {
    super.initState();
    final verse = ContentData.verseForDate();
    _allDoneOnOpen = TodayTasksStore.read().allDone;
    // Opening the reflection completes it and protects today's streak.
    TodayTasksStore.markReflectionDone();
    StreakStore.bumpIfNewDay();
    Analytics.capture('reflection_sheet_opened', {
      'reference': verse.reference,
      'all_done': _allDoneOnOpen,
    });
  }

  void _closeOnly() {
    haptic(HapticStyle.soft);
    Analytics.capture('reflection_sheet_closed', {
      'method': 'x_button',
      'all_done': TodayTasksStore.read().allDone,
    });
    Navigator.of(context).maybePop();
  }

  void _closeAndContinueToQuiz() {
    if (_handingOff) return;
    final verse = ContentData.verseForDate();
    final allDone = TodayTasksStore.read().allDone;
    if (allDone) {
      haptic(HapticStyle.soft);
      Analytics.capture('reflection_sheet_closed', {
        'method': 'continue_button',
        'all_done': true,
      });
      Navigator.of(context).maybePop();
      return;
    }
    setState(() => _handingOff = true);
    haptic(HapticStyle.soft);
    Analytics.capture('reflection_continue_to_quiz_tapped', {
      'reference': verse.reference,
    });
    Navigator.of(context).maybePop();
    widget.onContinueToQuiz();
  }

  Future<void> _handleShare() async {
    if (_sharing) return;
    final verse = ContentData.verseForDate();
    haptic(HapticStyle.medium);
    setState(() => _sharing = true);
    Analytics.capture('reflection_share_tapped', {
      'reference': verse.reference,
    });
    try {
      // Same as the web hook: render the 1170x2532 verse wallpaper and share
      // the image file with the verse caption + Play Store link.
      final ok = await VerseWallpaper.share();
      if (!ok) {
        await SharePlus.instance.share(
          ShareParams(text: '"${verse.text}"\n— ${verse.reference}'),
        );

      }
      Analytics.capture('reflection_share_completed', {
        'reference': verse.reference,
      });
    } catch (_) {
    } finally {
      if (mounted) setState(() => _sharing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final verse = ContentData.verseForDate();
    final reflection = ContentData.reflectionFor(verse.refKey);
    final bg = ContentData.backgroundForDay()?.url;
    final safeTop = MediaQuery.paddingOf(context).top;
    final safeBottom = MediaQuery.paddingOf(context).bottom;

    return PopScope(
      canPop: true,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop && !_handingOff) {
          Analytics.capture('reflection_sheet_closed', {
            'method': 'x_button',
            'all_done': TodayTasksStore.read().allDone,
          });
        }
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            // Full wallpaper background
            if (bg != null)
              Positioned.fill(
                child: CachedNetworkImage(imageUrl: bg, fit: BoxFit.cover),
              ),
            Positioned.fill(
              child: DecoratedBox(
                decoration: const BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Color(0x8C000000),
                      Color(0x73000000),
                      Color(0xB3000000),
                      Color(0xEB000000),
                    ],
                    stops: [0, 0.3, 0.7, 1],
                  ),
                ),
              ),
            ),
            Positioned.fill(
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: const Alignment(0, -0.24),
                      radius: 0.95,
                      colors: [
                        Colors.transparent,
                        Colors.black.withValues(alpha: 0.55),
                      ],
                      stops: const [0.25, 1],
                    ),
                  ),
                ),
              ),
            ),

            // Scrollable content
            Positioned.fill(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                  24,
                  safeTop < 18 ? 18 : safeTop,
                  24,
                  safeBottom < 22 ? 22 : safeBottom,
                ),
                child: ConstrainedBox(
                  constraints: BoxConstraints(
                    minHeight:
                        MediaQuery.sizeOf(context).height -
                        (safeTop + safeBottom + 40),
                  ),
                  child: Column(
                    children: [
                      // Eyebrow
                      const SizedBox(height: 40),
                      FadeRise(
                        offsetY: -6,
                        delay: const Duration(milliseconds: 50),
                        duration: const Duration(milliseconds: 400),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.star,
                              size: 12,
                              color: Color(0xFFFCD34D),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              "TODAY'S REFLECTION",
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 10 * 0.3,
                                color: const Color(
                                  0xFFFDE68A,
                                ).withValues(alpha: 0.95),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 32),

                      // Verse hero
                      FadeRise(
                        offsetY: 14,
                        delay: const Duration(milliseconds: 120),
                        duration: const Duration(milliseconds: 550),
                        child: Column(
                          children: [
                            const SizedBox(height: 24),
                            SizedBox(
                              width: 32,
                              height: 40,
                              child: CustomPaint(painter: _GoldCrossPainter()),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              '"${verse.text}"',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                fontFamily: kSerif,
                                fontFamilyFallback: kSerifFallback,
                                fontStyle: FontStyle.italic,
                                fontWeight: FontWeight.w600,
                                fontSize: 22,
                                height: 1.5,
                                color: Colors.white,
                                shadows: [
                                  Shadow(
                                    color: Color(0xE6000000),
                                    blurRadius: 20,
                                    offset: Offset(0, 2),
                                  ),
                                  Shadow(
                                    color: Color(0xE6000000),
                                    blurRadius: 4,
                                    offset: Offset(0, 1),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 24),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Container(
                                  width: 40,
                                  height: 1,
                                  color: const Color(
                                    0xFFFDE68A,
                                  ).withValues(alpha: 0.55),
                                ),
                                const SizedBox(width: 12),
                                Text(
                                  verse.reference.toUpperCase(),
                                  style: const TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: 11 * 0.28,
                                    color: Color(0xFFFDE68A),
                                    shadows: [
                                      Shadow(
                                        color: Color(0xD9000000),
                                        blurRadius: 6,
                                        offset: Offset(0, 1),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(width: 12),
                                Container(
                                  width: 40,
                                  height: 1,
                                  color: const Color(
                                    0xFFFDE68A,
                                  ).withValues(alpha: 0.55),
                                ),
                              ],
                            ),
                            const SizedBox(height: 40),
                          ],
                        ),
                      ),

                      // Two-part reflection
                      FadeRise(
                        offsetY: 14,
                        delay: const Duration(milliseconds: 220),
                        duration: const Duration(milliseconds: 550),
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(16),
                            color: const Color(
                              0xFF0A0C14,
                            ).withValues(alpha: 0.6),
                            border: Border.all(
                              color: Colors.white.withValues(alpha: 0.08),
                            ),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'REFLECTION',
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 10 * 0.24,
                                  color: const Color(
                                    0xFFFDE68A,
                                  ).withValues(alpha: 0.85),
                                ),
                              ),
                              const SizedBox(height: 10),
                              Text(
                                reflection.meaning,
                                style: TextStyle(
                                  fontSize: 14.5,
                                  height: 1.65,
                                  color: Colors.white.withValues(alpha: 0.9),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Text(
                                reflection.apply,
                                style: TextStyle(
                                  fontSize: 14,
                                  height: 1.6,
                                  fontStyle: FontStyle.italic,
                                  color: const Color(
                                    0xFFFEF3C7,
                                  ).withValues(alpha: 0.9),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      const SizedBox(height: 24),

                      // CTAs
                      FadeRise(
                        offsetY: 10,
                        delay: const Duration(milliseconds: 320),
                        duration: const Duration(milliseconds: 450),
                        child: Column(
                          children: [
                            TapScale(
                              scale: 0.985,
                              onTap: _closeAndContinueToQuiz,
                              child: Opacity(
                                opacity: _handingOff ? 0.7 : 1,
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 16,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(22),
                                    gradient: const LinearGradient(
                                      begin: Alignment(-1, -1),
                                      end: Alignment(1, 1),
                                      colors: [
                                        Color(0xFFFFD966),
                                        Color(0xFFF5CC6E),
                                        Color(0xFFE8B94A),
                                      ],
                                      stops: [0, 0.45, 1],
                                    ),
                                    boxShadow: [
                                      BoxShadow(
                                        color: const Color(
                                          0xFFF5CC6E,
                                        ).withValues(alpha: 0.6),
                                        blurRadius: 36,
                                        spreadRadius: -10,
                                        offset: const Offset(0, 16),
                                      ),
                                    ],
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.check,
                                        size: 18,
                                        color: Color(0xFF1A1305),
                                      ),
                                      const SizedBox(width: 8),
                                      Text(
                                        _handingOff
                                            ? 'Loading quiz…'
                                            : 'Continue to Daily Quiz →',
                                        style: const TextStyle(
                                          fontSize: 15,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: -0.3,
                                          color: Color(0xFF1A1305),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 10),
                            TapScale(
                              scale: 0.985,
                              onTap: _handleShare,
                              child: Opacity(
                                opacity: _sharing ? 0.7 : 1,
                                child: Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    vertical: 12,
                                  ),
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(18),
                                    color: Colors.white.withValues(alpha: 0.04),
                                    border: Border.all(
                                      color: Colors.white.withValues(
                                        alpha: 0.15,
                                      ),
                                    ),
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      Icon(
                                        Icons.ios_share,
                                        size: 14,
                                        color: Colors.white.withValues(
                                          alpha: 0.85,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Text(
                                        _sharing
                                            ? 'Preparing…'
                                            : 'Share this verse',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white.withValues(
                                            alpha: 0.85,
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
              ),
            ),

            // Close button
            Positioned(
              top: (safeTop < 14 ? 14 : safeTop),
              right: 16,
              child: GestureDetector(
                onTap: _closeOnly,
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black.withValues(alpha: 0.45),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                  child: const Icon(Icons.close, size: 18, color: Colors.white),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The glowing gold cross above the verse (web inline SVG, 28x36 viewBox).
class _GoldCrossPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final sx = size.width / 28;
    final sy = size.height / 36;
    final glow = Paint()
      ..color = const Color(0xFFF5CC6E).withValues(alpha: 0.75)
      ..strokeWidth = 2.8 * sx
      ..strokeCap = StrokeCap.round
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    final paint = Paint()
      ..color = const Color(0xFFF5CC6E)
      ..strokeWidth = 2.8 * sx
      ..strokeCap = StrokeCap.round;

    for (final p in [glow, paint]) {
      canvas.drawLine(Offset(14 * sx, 2 * sy), Offset(14 * sx, 34 * sy), p);
      canvas.drawLine(Offset(3 * sx, 12 * sy), Offset(25 * sx, 12 * sy), p);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
