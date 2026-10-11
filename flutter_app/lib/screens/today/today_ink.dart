import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// Mirrors the web build's `.light [data-theme-scope="today"]` override in
/// `src/index.css`: pure gold on cream reads cheap, so on the Today page the
/// structural colour becomes deep royal-blue ink and gold drops back to a
/// sparing accent. In dark mode these are identical to the global tokens.
class TodayInk {
  const TodayInk._();

  static Color _hsl(double h, double s, double l, [double a = 1]) =>
      HSLColor.fromAHSL(a, h, s / 100, l / 100).toColor();

  /// `--primary: 222 60% 24%`
  static Color get primary =>
      AppColors.isLight ? _hsl(222, 60, 24) : AppColors.primary;

  /// `--ring: 222 60% 24%`
  static Color get ring => primary;

  /// `--accent: 42 88% 44%`
  static Color get accent =>
      AppColors.isLight ? _hsl(42, 88, 44) : AppColors.accent;

  /// `--premium-gold: 42 70% 42%`
  static Color get premiumGold =>
      AppColors.isLight ? _hsl(42, 70, 42) : AppColors.premiumGold;

  /// `--premium-gold-glow: 38 75% 50%`
  static Color get premiumGoldGlow =>
      AppColors.isLight ? _hsl(38, 75, 50) : AppColors.premiumGoldGlow;

  /// `--glass-border: 222 40% 30% / 0.18`
  static Color get glassBorder =>
      AppColors.isLight ? _hsl(222, 40, 30, 0.18) : AppColors.glassBorder;
}
