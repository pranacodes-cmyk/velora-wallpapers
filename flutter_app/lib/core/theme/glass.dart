import 'dart:ui';

import 'package:flutter/material.dart';

import 'app_colors.dart';

/// Glassmorphism surface used by headers, sheets, nav bar and tiles —
/// mirrors the `.glass` / `--nav-blur` styles from `src/index.css`.
class GlassPanel extends StatelessWidget {
  const GlassPanel({
    super.key,
    required this.child,
    this.blur = 18,
    this.radius = AppColors.radius,
    this.color,
    this.borderColor,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final double blur;
  final double radius;
  final Color? color;
  final Color? borderColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: color ?? AppColors.glass,
            borderRadius: BorderRadius.circular(radius),
            border: Border.all(color: borderColor ?? AppColors.glassBorder),
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}

/// Premium tile decoration — port of `--tile-grad` / `--tile-shadow`.
BoxDecoration premiumTileDecoration({double radius = AppColors.radius}) {
  return BoxDecoration(
    borderRadius: BorderRadius.circular(radius),
    gradient: RadialGradient(
      center: const Alignment(0, -1),
      radius: 1.3,
      colors: [AppColors.goldWash, AppColors.card, AppColors.background],
      stops: const [0, 0.42, 1],
    ),
    border: Border.all(color: AppColors.goldBorder),
    boxShadow: [
      BoxShadow(
        color: Colors.black.withValues(alpha: 0.7),
        blurRadius: 40,
        spreadRadius: -18,
        offset: const Offset(0, 18),
      ),
    ],
  );
}
