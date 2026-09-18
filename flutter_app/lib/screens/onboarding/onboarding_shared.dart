import 'package:flutter/material.dart';

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

  /// `headlineStyle`
  static const headlineColor = Color(0xFFF7F2E8); // hsl(40 30% 96%)
  static const subColor = Color(0xFFB8B0A2); // hsl(40 15% 70%)
  static const dimColor = Color(0xFFA39B8C); // hsl(40 15% 62%)

  /// Deep navy onboarding canvas — hsl(220 65% 4%)
  static const canvas = Color(0xFF02060F);
  static const ctaText = Color(0xFF051022); // hsl(220 65% 8%)

  static const gold = Color(0xFFE8B02C); // hsl(42 85% 52%)
  static const goldBright = Color(0xFFFFB855); // hsl(38 100% 66%)
  static const goldLabel = Color(0xFFEDBB47); // hsl(42 85% 60%)

  static const goldGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [gold, goldBright],
  );

  /// `headlineStyle`: -0.02em tracking (scales with the font size like CSS em),
  /// 1.18 line-height, 0 2px 24px black 60% shadow.
  static TextStyle headline(double size) => TextStyle(
    fontSize: size,
    color: headlineColor,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.02 * size,
    height: 1.18,
    shadows: const [
      Shadow(color: Color(0x99000000), blurRadius: 24, offset: Offset(0, 2)),
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
  final h = MediaQuery.of(context).size.height;
  final v = h * vh / 100;
  return v < min ? min : (v > max ? max : v);
}

/// Scales a clamp(min, preferred-vw, max) CSS value against the real viewport.
double clampVw(BuildContext context, double min, double vw, double max) {
  final w = MediaQuery.of(context).size.width;
  final v = w * vw / 100;
  return v < min ? min : (v > max ? max : v);
}
