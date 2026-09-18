import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import 'lock_screen_mock.dart';
import 'onboarding_shared.dart';

/// 1:1 port of `VerseSlide` (slide 0) from `OnboardingFlow.tsx`.
class VerseSlide extends StatelessWidget {
  const VerseSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final h = MediaQuery.of(context).size.height;
    // transform: scale(clamp(0.65, (100dvh - 320px) / 480, 1))
    final mockScale = (((h - 320) / 480).clamp(0.65, 1.0)).toDouble();

    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.2),
                radius: 0.9,
                colors: [Color(0xFF0E1B35), Color(0xFF040A15)],
                stops: [0, 0.75],
              ),
            ),
          ),
        ),
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 144),
          child: Column(
            children: [
              SizedBox(height: MediaQuery.of(context).padding.top),
              Opacity(
                opacity: 0.75,
                child: Text(
                  t('onb.verse.kicker').toUpperCase(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 4,
                    color: Color(0xFFE5B44C), // hsl(42 75% 60%)
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
              Transform.scale(
                scale: mockScale,
                alignment: Alignment.topCenter,
                child: const LockScreenMock(),
              ),
              const SizedBox(height: 12),
              Opacity(
                opacity: 0.6,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 290),
                  child: Text(
                    t('onb.verse.subcopy'),
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 12.5,
                      height: 1.5,
                      color: Color(0xFFD9D2C4), // hsl(40 22% 82%)
                    ),
                  ),
                ),
              ),
            ],
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

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Text(pre, textAlign: TextAlign.center, style: Onb.headline(size)),
        ShaderMask(
          shaderCallback: (bounds) => const LinearGradient(
            begin: Alignment(-1, -0.3),
            end: Alignment(1, 0.3),
            colors: [Onb.gold, Color(0xFFFFCB66), Onb.gold],
          ).createShader(bounds),
          child: Text(
            gold,
            textAlign: TextAlign.center,
            style: Onb.headline(size).copyWith(color: Colors.white),
          ),
        ),
      ],
    );
  }
}
