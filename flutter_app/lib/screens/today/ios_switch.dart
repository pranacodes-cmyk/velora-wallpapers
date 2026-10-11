import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import 'today_ink.dart';

/// Shared switch used by the individual prayer alarm rows.
class IosSwitch extends StatelessWidget {
  const IosSwitch({
    super.key,
    required this.on,
    required this.onTap,
    this.width = 42,
    this.height = 24,
    this.knob = 20,
    this.offColor,
    this.glow = false,
  });

  final bool on;
  final VoidCallback onTap;
  final double width;
  final double height;
  final double knob;
  final Color? offColor;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: on ? TodayInk.primary : (offColor ?? TodayInk.glassBorder),
          boxShadow: on && glow
              ? [
                  BoxShadow(
                    color: TodayInk.primary.withValues(alpha: 0.55),
                    blurRadius: 14,
                    spreadRadius: -4,
                  ),
                ]
              : null,
        ),
        child: Stack(
          children: [
            AnimatedPositioned(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              left: on ? knob : 2,
              top: 2,
              child: Container(
                width: knob,
                height: knob,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryForeground,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
