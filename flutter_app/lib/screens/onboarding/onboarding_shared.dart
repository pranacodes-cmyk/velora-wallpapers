import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// The onboarding flow is authored once, in the midnight palette. Light mode is
/// not a second hand-written theme: every authored HSL passes through this one
/// mapper, so the whole flow stays coherent and no screen can invent its own
/// light surfaces. Mirrors how the web build re-scopes the same markup under
/// `.light`.
Color onbTone(double hue, double s, double l, [double a = 1]) {
  Color hsl(double h2, double s2, double l2, double a2) =>
      HSLColor.fromAHSL(a2.clamp(0.0, 1.0), h2, s2 / 100, l2 / 100).toColor();

  // Onboarding is authored, and now shipped, in the midnight palette only.
  if (!Onb.isLight) return hsl(hue, s, l, a);

  // Authored black shadows → soft navy shadows (ivory can't take pure black).
  if (s <= 6 && l <= 8) return hsl(222, 45, 34, a * 0.24);

  // Every light authored tone — pure white body copy, warm off-white type,
  // hairlines — lands on ONE navy ink ladder. This runs before the gold test on
  // purpose: hsl(40 30% 96%) headlines are warm white, not gold, and mapping
  // them through the gold branch is what made light mode read muddy brown.
  if (s <= 42 && l >= 56) {
    return hsl(222, 26, ((100 - l) * 0.5 + 8).clamp(8, 44), a);
  }

  final isGold = hue >= 28 && hue <= 54 && s >= 55;
  if (isGold) {
    // Gold stays gold, but solid on cream: a deep antique gold, never pale.
    if (a >= 0.85) return hsl(hue, 92, l >= 65 ? 44 : 36, a);
    return hsl(hue, 90, l > 55 ? 44 : l.clamp(36, 50), a * 1.6);
  }

  // Dark structural surfaces (navy cards, scrims) → clean white plates, so the
  // ivory canvas stays the background and cards actually separate from it.
  if (l <= 34) return hsl(hue, s.clamp(0, 18), 99, a);

  return hsl(hue, s, l, a);
}


/// 1:1 port of `src/components/onboarding/onboardingShared.ts`.
/// Flutter renders on the GPU via Impeller, so the Android-specific
/// "cheap mode" values are the ones we keep: short opacity-only reveals,
/// no infinite loops, no runtime blur on full-screen layers.
class Onb {
  const Onb._();

  static const navLock = Duration(milliseconds: 190);
  static const slideFade = Duration(milliseconds: 160);
  static const inDelay = Duration.zero;
  static const inDur = Duration(milliseconds: 160);
  static const stagger = Duration.zero;

  /// Background reveal peak opacity (`onbBgAnimate`, Android branch).
  static double bgPeak(double peak) => peak > 0.65 ? peak : 0.65;
  static const bgIn = Duration(milliseconds: 280);
  static const bgOut = Duration(milliseconds: 180);

  static const easeOutExpo = Cubic(0.22, 1, 0.36, 1);

  /// True while the app is rendering the light palette (system or manual).
  /// Onboarding always renders the midnight palette, in both system themes.
  static bool get isLight => false;

  /// `headlineStyle` — hsl(40 30% 96%) / hsl(40 15% 70%) / hsl(40 15% 62%).
  static Color get headlineColor => onbTone(40, 30, 96);
  static Color get subColor => onbTone(40, 15, 70);
  static Color get dimColor => onbTone(40, 15, 62);

  /// Same deep navy as the web onboarding scope: hsl(222 30% 5%).
  /// In light mode the flow sits on the app's own ivory background.
  static Color get canvas =>
      isLight ? AppColors.lightBackground : const Color(0xFF090B11);

  /// Text/icon colour that sits on top of a solid gold surface — stays the
  /// same deep navy in both modes, because the gold never lightens.
  static const ctaText = Color(0xFF051022); // hsl(220 65% 8%)

  static Color get gold => onbTone(42, 85, 52);
  static Color get goldBright => onbTone(38, 100, 66);
  static Color get goldLabel => onbTone(42, 85, 60);

  /// Solid gold fill for CTAs and seals — identical in both modes so the
  /// purchase affordance never reads washed out.
  static const goldFill = Color(0xFFE8B02C);
  static const goldFillBright = Color(0xFFFFC04D);

  static const goldGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [goldFill, goldFillBright],
  );

  /// Authored-white body copy and hairlines (navy ink in light mode).
  static Color ink([double a = 1]) => onbTone(0, 0, 100, a);

  /// Authored-black shadows (soft navy in light mode).
  static Color shade([double a = 1]) => onbTone(0, 0, 0, a);

  /// The recurring card/pill surface behind onboarding content:
  /// hsl(220 48% 12%) in dark, near-white in light.
  static Color surface([double a = 1]) => onbTone(220, 48, 12, a);

  /// Royal-blue bloom behind every story slide. In light mode the same gesture
  /// becomes a warm candle-gold halo over ivory — a blue wash on cream just
  /// reads grey.
  static Color get bloom => isLight
      ? HSLColor.fromAHSL(1, 43, 0.60, 0.90).toColor()
      : onbTone(224, 65, 33, 0.235);

  /// Deep navy frame the story painting sits in. In dark mode the artwork melts
  /// into the canvas; on ivory it needs a real frame or it looks pasted on.
  static Color get artMat =>
      isLight ? const Color(0xFF0B1224) : const Color(0xFF090B11);

  /// `headlineStyle`: -0.02em tracking (scales with the font size like CSS em),
  /// 1.18 line-height, and a soft depth shadow (dropped in light mode, where a
  /// dark glow behind navy ink only reads as smudge).
  static TextStyle headline(double size) => TextStyle(
    fontSize: size,
    color: headlineColor,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.02 * size,
    height: 1.18,
    shadows: isLight
        ? null
        : const [
            Shadow(
              color: Color(0x99000000),
              blurRadius: 24,
              offset: Offset(0, 2),
            ),
          ],
  );

  /// Prayer times seeded by the Time slide — same hours/labels as web.
  static List<Map<String, Object>> prayerTimes(String pick) {
    if (pick == 'morning') {
      return [
        {'hour': 7, 'minute': 0, 'label': 'Morning Prayer'},
      ];
    }
    if (pick == 'evening') {
      return [
        {'hour': 21, 'minute': 0, 'label': 'Evening Prayer'},
      ];
    }
    return [
      {'hour': 7, 'minute': 0, 'label': 'Morning Prayer'},
      {'hour': 21, 'minute': 0, 'label': 'Evening Prayer'},
    ];
  }

  static const prayerSeedKey = 'jwbp_prayer_alarms_v1';
  static const langPickedKey = 'onb-lang-picked';
}

/// Scales a clamp(min, preferred-vh, max) CSS value against the real viewport.
double clampVh(BuildContext context, double min, double vh, double max) {
  final h = MediaQuery.sizeOf(context).height;
  final v = h * vh / 100;
  return v < min ? min : (v > max ? max : v);
}

/// Scales a clamp(min, preferred-vw, max) CSS value against the real viewport.
double clampVw(BuildContext context, double min, double vw, double max) {
  final w = MediaQuery.sizeOf(context).width;
  final v = w * vw / 100;
  return v < min ? min : (v > max ? max : v);
}
