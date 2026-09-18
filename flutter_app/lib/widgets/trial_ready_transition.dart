import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/theme/app_colors.dart';

/// 1:1 port of `src/components/TrialReadyTransition.tsx`.
/// Opaque midnight screen, gold switch flipping on, knob sliding across,
/// checkmark reveal, then the localized trial headline. Opacity + transform
/// only (no blur, no infinite animation) so Android stays butter smooth.
class TrialReadyTransition extends StatefulWidget {
  const TrialReadyTransition({super.key});

  @override
  State<TrialReadyTransition> createState() => _TrialReadyTransitionState();
}

class _TrialReadyTransitionState extends State<TrialReadyTransition>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    // 0.18s fade + 0.6s switch + 0.5s delay knob (0.62s) + check + title
    duration: const Duration(milliseconds: 1600),
  )..forward();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  /// Web: framer-motion `transition={{ delay, duration }}` on a 1.6s span.
  Animation<double> _seg(double delayMs, double durationMs, Curve curve) {
    final begin = delayMs / 1600;
    final end = (delayMs + durationMs) / 1600;
    return CurvedAnimation(
      parent: _c,
      curve: Interval(begin.clamp(0, 1), end.clamp(0, 1), curve: curve),
    );
  }

  @override
  Widget build(BuildContext context) {
    final reduceMotion =
        MediaQuery.maybeOf(context)?.disableAnimations ?? false;
    if (reduceMotion) _c.value = 1.0;

    // easeOutExpo-ish [0.22, 1, 0.36, 1] and the spring-ish knob curve.
    final shell = _seg(0, 600, const Cubic(0.22, 1, 0.36, 1));
    final knob = _seg(500, 620, const Cubic(0.34, 1.56, 0.64, 1));
    final check = _seg(1020, 300, Curves.easeOut);
    final title = _seg(1120, 420, Curves.easeOut);

    return ColoredBox(
      color: AppColors.background,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 32),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 384),
              child: AnimatedBuilder(
                animation: _c,
                builder: (context, _) {
                  return Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      // ── switch shell: muted → royal gold ──
                      Opacity(
                        opacity: shell.value,
                        child: Transform.scale(
                          scale: 0.9 + 0.1 * shell.value,
                          child: Container(
                            width: 112, // w-28
                            height: 64, // h-16
                            decoration: BoxDecoration(
                              color: Color.lerp(
                                AppColors.muted,
                                AppColors.premiumGold,
                                shell.value,
                              ),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(color: AppColors.border),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.black.withValues(alpha: 0.35),
                                  blurRadius: 15,
                                  offset: const Offset(0, 8),
                                ),
                              ],
                            ),
                            child: Stack(
                              children: [
                                Positioned(
                                  left: 8 + 48 * knob.value, // left-2 → x:48
                                  top: 8,
                                  child: Container(
                                    width: 48,
                                    height: 48,
                                    decoration: BoxDecoration(
                                      color: AppColors.primaryForeground,
                                      shape: BoxShape.circle,
                                      boxShadow: [
                                        BoxShadow(
                                          color: Colors.black.withValues(
                                            alpha: 0.25,
                                          ),
                                          blurRadius: 6,
                                          offset: const Offset(0, 3),
                                        ),
                                      ],
                                    ),
                                    child: Center(
                                      child: Opacity(
                                        opacity: check.value,
                                        child: Transform.scale(
                                          scale: 0.5 + 0.5 * check.value,
                                          child: Icon(
                                            Icons.check_rounded,
                                            size: 28,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 32), // mt-8
                      Opacity(
                        opacity: title.value,
                        child: Transform.translate(
                          offset: Offset(0, 8 * (1 - title.value)),
                          child: Text(
                            t('premium.trialTransition.title'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 24,
                              height: 1.1,
                              fontWeight: FontWeight.w600,
                              color: AppColors.foreground,
                            ),
                          ),
                        ),
                      ),
                    ],
                  );
                },
              ),
            ),
          ),
        ),
      ),
    );
  }
}
