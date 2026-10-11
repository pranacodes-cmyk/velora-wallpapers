import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import 'today_shared.dart';

/// 1:1 port of `PremiumNudge` in `src/pages/Today.tsx` — free users only.
/// No shimmer sweep (deliberately removed on web for Android performance).
class PremiumNudge extends StatelessWidget {
  const PremiumNudge({super.key, required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    return FadeRise(
      offsetY: 12,
      delay: const Duration(milliseconds: 350),
      duration: const Duration(milliseconds: 600),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 16, 12, 32),
        child: TapScale(
          scale: 0.985,
          onTap: () {
            haptic(HapticStyle.medium);
            onOpen();
          },
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(22),
              color: AppColors.card,
              border: Border.all(color: AppColors.goldBorder),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.65),
                  blurRadius: 26,
                  spreadRadius: -16,
                  offset: const Offset(0, 10),
                ),
              ],
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(16),
                    gradient: LinearGradient(
                      begin: const Alignment(-1, -1),
                      end: const Alignment(1, 1),
                      colors: [hsl(42, 90, 60), hsl(38, 100, 70)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: hsl(42, 85, 50, 0.6),
                        blurRadius: 16,
                        spreadRadius: -4,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                  child: LucideIcon(
                    'crown',
                    size: 20,
                    color: AppColors.background,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('today.nudge.title'),
                        style: TextStyle(
                          fontSize: 13.5,
                          height: 1.2,
                          fontWeight: FontWeight.w800,
                          color: AppColors.foreground,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        t('today.nudge.subtitle'),
                        style: TextStyle(
                          fontSize: 11,
                          height: 1.375,
                          color: AppColors.foreground.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      begin: const Alignment(-1, -1),
                      end: const Alignment(1, 1),
                      colors: [hsl(42, 95, 62), hsl(42, 88, 50)],
                    ),
                  ),
                  child: Text(
                    t('today.nudge.cta'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 11 * 0.06,
                      color: AppColors.background,
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
}
