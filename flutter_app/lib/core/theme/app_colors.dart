import 'package:flutter/material.dart';

/// Direct 1:1 port of the CSS design tokens in `src/index.css`.
/// Values are the exact same HSL tokens, converted to ARGB.
Color _hsl(double h, double s, double l, [double a = 1]) =>
    HSLColor.fromAHSL(a, h, s / 100, l / 100).toColor();

/// Every screen reads its surfaces from here, so the tokens themselves switch
/// between the dark and light palettes — exactly how the web build swaps the
/// `.light` class on `<html>`. `AppColors.isLight` is set once per frame in
/// `main.dart`'s `MaterialApp.builder` from `Theme.of(context).brightness`.
class AppColors {
  const AppColors._();

  static bool isLight = false;

  // ---------- dark palette ----------
  static final _dBackground = _hsl(222, 30, 5);
  static final _dForeground = _hsl(40, 20, 96);
  static final _dCard = _hsl(222, 25, 8);
  static final _dPrimary = _hsl(42, 85, 52); // Royal Gold
  static final _dSecondary = _hsl(222, 20, 10);
  static final _dMuted = _hsl(222, 15, 14);
  static final _dMutedForeground = _hsl(40, 10, 50);
  static final _dAccent = _hsl(220, 75, 55); // Deep Royal Blue
  static final _dBorder = _hsl(222, 15, 15);
  static final _dGlass = _hsl(222, 20, 5, 0.88);
  static final _dGlassBorder = _hsl(42, 40, 30, 0.15);
  static final _dGlassRaised = _hsl(222, 26, 9, 0.96);
  static final _dGlassSoft = _hsl(222, 24, 11, 0.78);
  static final _dGoldBorder = _hsl(42, 40, 30, 0.22);
  static final _dNavBlur = _hsl(222, 25, 4, 0.94);

  // ---------- light palette ----------
  // Exact values from the `.light` block in `src/index.css`, including the
  // light-mode tile duotone (ivory card, royal-blue structural frame, gold as
  // the sparing accent).
  static final lightBackground = _hsl(40, 30, 97);
  static final lightForeground = _hsl(222, 35, 9);
  static final lightCard = _hsl(40, 40, 99);
  static final lightPrimary = _hsl(42, 85, 42);
  static final lightSecondary = _hsl(40, 10, 94);
  static final lightSecondaryForeground = _hsl(222, 25, 18);
  static final lightMuted = _hsl(40, 8, 91);
  static final lightMutedForeground = _hsl(222, 15, 38);
  static final lightAccent = _hsl(220, 75, 50);
  static final lightBorder = _hsl(40, 10, 82);
  static final lightInput = _hsl(40, 8, 93);
  static final lightGlass = _hsl(0, 0, 100, 0.97);
  static final lightGlassBorder = _hsl(42, 30, 60, 0.3);
  static final lightNavBlur = _hsl(0, 0, 98, 0.97);
  static final lightDestructive = _hsl(0, 84, 50);
  // `--tile-grad-soft` (light): white → hsl(220 50% 98%)
  static final _lGlassRaised = _hsl(0, 0, 100);
  static final _lGlassSoft = _hsl(220, 50, 98);
  // `--tile-border` (light): deep royal-blue frame, not gold
  static final _lGoldBorder = _hsl(222, 55, 32, 0.32);

  // ---------- resolved tokens ----------
  static Color get background => isLight ? lightBackground : _dBackground;
  static Color get foreground => isLight ? lightForeground : _dForeground;
  static Color get card => isLight ? lightCard : _dCard;
  static Color get cardForeground => foreground;
  static Color get popover => card;
  static Color get primary => isLight ? lightPrimary : _dPrimary;
  static Color get primaryForeground => Colors.white;
  static Color get secondary => isLight ? lightSecondary : _dSecondary;
  static Color get secondaryForeground =>
      isLight ? lightSecondaryForeground : _hsl(40, 15, 85);
  static Color get muted => isLight ? lightMuted : _dMuted;
  static Color get mutedForeground =>
      isLight ? lightMutedForeground : _dMutedForeground;
  static Color get accent => isLight ? lightAccent : _dAccent;
  static Color get accentForeground => Colors.white;
  static Color get destructive => isLight ? lightDestructive : _hsl(0, 84, 60);
  static Color get border => isLight ? lightBorder : _dBorder;
  static Color get input => isLight ? lightInput : _hsl(222, 20, 10);
  static Color get ring => primary;

  static Color get glass => isLight ? lightGlass : _dGlass;
  static Color get glassBorder => isLight ? lightGlassBorder : _dGlassBorder;

  /// Structural surfaces stay navy in dark mode and near-white in light mode.
  /// Gold is reserved for text, icons, thin borders and purchase CTAs.
  static Color get glassRaised => isLight ? _lGlassRaised : _dGlassRaised;
  static Color get glassSoft => isLight ? _lGlassSoft : _dGlassSoft;
  static Color get blueWash =>
      isLight ? _hsl(220, 75, 55, 0.07) : _hsl(220, 75, 55, 0.055);
  static Color get goldWash =>
      isLight ? _hsl(42, 85, 52, 0.09) : _hsl(42, 85, 52, 0.045);
  static Color get goldBorder => isLight ? _lGoldBorder : _dGoldBorder;
  static Color get premiumGold => isLight ? _hsl(42, 85, 44) : _hsl(42, 85, 55);
  static Color get premiumGoldGlow =>
      isLight ? _hsl(38, 100, 52) : _hsl(38, 100, 65);
  static Color get navBlur => isLight ? lightNavBlur : _dNavBlur;

  // Exact CSS premium-tile primitives from `src/index.css`. Keeping these
  // centralized prevents individual Flutter cards from inventing dark fills.
  static List<Color> get tileGradient => isLight
      ? [_hsl(42, 95, 78, 0.32), _hsl(42, 50, 97), _hsl(220, 40, 99)]
      : [
          primary.withValues(alpha: 0.18),
          _dCard,
          _dBackground,
        ];
  static List<double> get tileGradientStops =>
      isLight ? const [0, 0.3, 0.75] : const [0, 0.42, 1];
  static Color get tileBorder =>
      isLight ? _hsl(222, 55, 32, 0.32) : primary.withValues(alpha: 0.4);
  static Color get tileAurora =>
      isLight ? _hsl(42, 95, 60, 0.42) : _hsl(42, 95, 60, 0.35);
  static List<BoxShadow> get tileShadow => isLight
      ? [
          BoxShadow(color: _hsl(222, 50, 18, 0.07), blurRadius: 2, offset: const Offset(0, 1)),
          BoxShadow(color: _hsl(222, 60, 28, 0.18), blurRadius: 24, spreadRadius: -8, offset: const Offset(0, 10)),
          BoxShadow(color: _hsl(222, 65, 22, 0.28), blurRadius: 52, spreadRadius: -20, offset: const Offset(0, 28)),
        ]
      : [
          BoxShadow(color: Colors.black.withValues(alpha: 0.7), blurRadius: 40, spreadRadius: -18, offset: const Offset(0, 18)),
          BoxShadow(color: primary.withValues(alpha: 0.22), spreadRadius: 1),
        ];

  // Public dark-scope values used by the intentionally midnight onboarding
  // paywall while the rest of the app remains in the user's selected theme.
  static Color get darkBackground => _dBackground;
  static Color get darkPrimary => _dPrimary;
  static Color get darkForeground => _dForeground;
  static Color get darkCard => _dCard;
  static Color get darkMuted => _dMuted;
  static Color get darkMutedForeground => _hsl(40, 10, 62);
  static Color get darkBorder => _dBorder;
  static Color get darkGlassRaised => _dGlassRaised;

  /// The web build writes `text-foreground/70`, `bg-foreground/5` and friends,
  /// which flip with the theme. Flutter screens used literal white for those,
  /// which is invisible on the cream light background — use this instead.
  static Color fg([double alpha = 1]) =>
      alpha >= 1 ? foreground : foreground.withValues(alpha: alpha);

  /// `--radius: 1.25rem`
  static const radius = 20.0;
}
