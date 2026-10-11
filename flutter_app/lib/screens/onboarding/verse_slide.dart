import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import 'lock_screen_mock.dart';
import 'onboarding_motion.dart';
import 'onboarding_shared.dart';

/// 1:1 port of `VerseSlide` (slide 0) from `OnboardingFlow.tsx`.
class VerseSlide extends StatelessWidget {
  const VerseSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.sizeOf(context).height;
    // transform: scale(clamp(0.65, (100dvh - 320px) / 480, 1))
    final mockScale = (((h - 320) / 480).clamp(0.65, 1.0)).toDouble();

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: const Alignment(0, -0.2),
                radius: 0.82,
                colors: [Onb.bloom, Onb.canvas],
                stops: const [0, 0.76],
              ),
            ),
          ),
        ),
        Positioned.fill(
          child: LayoutBuilder(
            builder: (context, constraints) => SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 144),
              child: ConstrainedBox(
                constraints: BoxConstraints(
                  minHeight: (constraints.maxHeight - 144)
                      .clamp(0.0, double.infinity)
                      .toDouble(),
                ),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: onbStagger([
                    Opacity(
                      opacity: 0.75,
                      child: Text(
                        t('onb.verse.kicker').toUpperCase(),
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 3.2,
                          color: onbTone(42, 75, 60),
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    OnbHeadline(
                      pre: t('onb.verse.headlinePre'),
                      gold: t('onb.verse.headlineGold'),
                      size: 22,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: 200 * mockScale,
                      height: 400 * mockScale,
                      child: Transform.scale(
                        scale: mockScale,
                        alignment: Alignment.topLeft,
                        child: const LockScreenMock(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Opacity(
                      opacity: 0.6,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 290),
                        child: Text(
                          t('onb.verse.subcopy'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 12.5,
                            height: 1.5,
                            color: onbTone(40, 22, 82),
                          ),
                        ),
                      ),
                    ),
                  ]),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// Headline with the gold gradient span — ports `headlineStyle` + `goldSpan`.
class OnbHeadline extends StatelessWidget {
  const OnbHeadline({
    super.key,
    required this.pre,
    required this.gold,
    this.size = 26,
  });

  final String pre;
  final String gold;
  final double size;

  /// Largest font size (stepping down from `size`) at which the headline stays
  /// exactly two lines: the white line on one line, the gold line on one. If
  /// even the smallest allowed size can't do that (very long translations), we
  /// fall back to the old 2+1 rule so nothing ever clips.
  double _fitted(double maxWidth, TextScaler scaler) {
    bool ok(double fs, String text, int maxLines) {
      final tp = TextPainter(
        text: TextSpan(text: text, style: Onb.headline(fs)),
        textAlign: TextAlign.center,
        textDirection: TextDirection.ltr,
        maxLines: maxLines,
        // The device font-size setting scales the *rendered* text but not a
        // raw TextPainter, so without this the measurement said "one line"
        // while the phone actually wrapped to two — that was the real reason
        // the headline kept breaking into three lines.
        textScaler: scaler,
      )..layout(maxWidth: maxWidth - 1);
      return !tp.didExceedMaxLines;
    }

    // Headroom matters more than raw size here: a long translation
    // ("Endless scrolling is pulling you") needs ~0.72x of 27px to hold one
    // line on a 360dp phone, and 0.62 was sometimes not enough — which is how
    // the headline still ended up on three lines.
    final min = size * 0.5;

    // Pass 1 — the ideal: one white line + one gold line.
    var fs = size;
    while (fs > min) {
      if (ok(fs, pre, 1) && ok(fs, gold, 1)) return fs;
      fs -= 0.5;
    }

    // Pass 2 — safety net for the longest translations.
    fs = size;
    while (fs > min) {
      if (ok(fs, pre, 2) && ok(fs, gold, 1)) return fs;
      fs -= 0.5;
    }
    return min;
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, c) {
        final fs = _fitted(
          c.hasBoundedWidth
              ? c.maxWidth
              : MediaQuery.sizeOf(context).width - 52,
          MediaQuery.textScalerOf(context),
        );
        return Column(
          children: [
            Text(pre, textAlign: TextAlign.center, style: Onb.headline(fs)),
            ShaderMask(
              shaderCallback: (bounds) => LinearGradient(
                begin: const Alignment(-1, -0.3),
                end: const Alignment(1, 0.3),
                colors: [Onb.gold, onbTone(42, 100, 70), Onb.gold],
              ).createShader(bounds),
              child: Text(
                gold,
                textAlign: TextAlign.center,
                style: Onb.headline(fs).copyWith(color: Colors.white),
              ),
            ),
          ],
        );
      },
    );
  }
}
