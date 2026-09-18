import 'package:flutter/material.dart';

/// Direct 1:1 port of the CSS design tokens in `src/index.css`.
/// Values are the exact same HSL tokens, converted to ARGB.
Color _hsl(double h, double s, double l, [double a = 1]) =>
    HSLColor.fromAHSL(a, h, s / 100, l / 100).toColor();

class AppColors {
  const AppColors._();

  // ---------- dark (default) ----------
  static final background = _hsl(222, 30, 5);
  static final foreground = _hsl(40, 20, 96);
  static final card = _hsl(222, 25, 8);
  static final cardForeground = _hsl(40, 20, 96);
  static final popover = _hsl(222, 25, 8);
  static final primary = _hsl(42, 85, 52); // Royal Gold
  static final primaryForeground = Colors.white;
  static final secondary = _hsl(222, 20, 10);
  static final secondaryForeground = _hsl(40, 15, 85);
  static final muted = _hsl(222, 15, 14);
  static final mutedForeground = _hsl(40, 10, 50);
  static final accent = _hsl(220, 75, 55); // Deep Royal Blue
  static final accentForeground = Colors.white;
  static final destructive = _hsl(0, 84, 60);
  static final border = _hsl(222, 15, 15);
  static final input = _hsl(222, 20, 10);
  static final ring = _hsl(42, 85, 52);

  static final glass = _hsl(222, 20, 5, 0.88);
  static final glassBorder = _hsl(42, 40, 30, 0.15);
  static final premiumGold = _hsl(42, 85, 55);
  static final premiumGoldGlow = _hsl(38, 100, 65);
  static final navBlur = _hsl(222, 25, 4, 0.94);

  // ---------- light ----------
  static final lightBackground = _hsl(40, 30, 97);
  static final lightForeground = _hsl(222, 35, 9);
  static final lightCard = _hsl(40, 40, 99);
  static final lightPrimary = _hsl(42, 85, 42);
  static final lightSecondary = _hsl(40, 10, 94);
  static final lightMuted = _hsl(40, 8, 91);
  static final lightMutedForeground = _hsl(222, 15, 38);
  static final lightAccent = _hsl(220, 75, 50);
  static final lightBorder = _hsl(40, 10, 82);
  static final lightGlass = Colors.white.withValues(alpha: 0.97);
  static final lightGlassBorder = _hsl(42, 30, 60, 0.3);
  static final lightNavBlur = _hsl(0, 0, 98, 0.97);

  /// `--radius: 1.25rem`
  static const radius = 20.0;
}
