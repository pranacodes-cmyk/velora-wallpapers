import 'dart:async';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import 'onboarding_shared.dart';

/// 1:1 port of `LockScreenMock` inside `src/components/onboarding/OnboardingFlow.tsx`.
/// 200x400 phone frame, fixed 10:08 time, 4 rotating verse+wallpaper pairs on a
/// 3600ms timer with a 550ms opacity cross-fade, glass verse card at top 116,
/// gold "new every morning" badge at 22% from the bottom, home indicator bar.
class LockScreenMock extends StatefulWidget {
  const LockScreenMock({super.key});

  @override
  State<LockScreenMock> createState() => _LockScreenMockState();
}

class _VersePair {
  const _VersePair(this.text, this.reference, this.bg);
  final String text;
  final String reference;
  final String bg;
}

const _sunrise = 'assets/images/onboarding-bg-sunrise.webp';
const _ocean = 'assets/images/onboarding-bg-ocean.webp';
const _clouds = 'assets/images/onboarding-bg-clouds.webp';

class _LockScreenMockState extends State<LockScreenMock> {
  late final List<_VersePair> _pairs = [
    _VersePair(t('onb.lock.verse1Text'), t('onb.lock.verse1Ref'), _sunrise),
    _VersePair(t('onb.lock.verse2Text'), t('onb.lock.verse2Ref'), _ocean),
    _VersePair(t('onb.lock.verse3Text'), t('onb.lock.verse3Ref'), _clouds),
    _VersePair(t('onb.lock.verse4Text'), t('onb.lock.verse4Ref'), _sunrise),
  ];

  int _index = 0;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _timer = Timer.periodic(const Duration(milliseconds: 3600), (_) {
      if (!mounted) return;
      setState(() => _index = (_index + 1) % _pairs.length);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final current = _pairs[_index];

    return SizedBox(
      width: 200,
      height: 400,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Ambient gold glow behind the phone
          const Positioned(
            left: -40,
            right: -40,
            top: -40,
            bottom: -40,
            child: IgnorePointer(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x59E8B02C), Colors.transparent],
                    stops: [0, 0.65],
                  ),
                ),
              ),
            ),
          ),
          // Device frame
          Container(
            width: 200,
            height: 400,
            padding: const EdgeInsets.all(4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(38),
              gradient: const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFF5B6070),
                  Color(0xFF16191F),
                  Color(0xFF474C54),
                ],
                stops: [0, 0.5, 1],
              ),
              boxShadow: const [
                BoxShadow(
                  color: Color(0xE6000000),
                  blurRadius: 26,
                  spreadRadius: -14,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(34),
              child: ColoredBox(
                color: const Color(0xFF040A18),
                child: Stack(
                  children: [
                    // Cross-fading wallpapers
                    for (var i = 0; i < _pairs.length; i++)
                      Positioned.fill(
                        child: AnimatedOpacity(
                          opacity: i == _index ? 1 : 0,
                          duration: const Duration(milliseconds: 550),
                          curve: Curves.easeOut,
                          child: Image.asset(_pairs[i].bg, fit: BoxFit.cover),
                        ),
                      ),
                    // Top + bottom scrims
                    Positioned.fill(
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: const [
                                Color(0x8C000000),
                                Colors.transparent,
                                Color(0x59050A14),
                                Color(0xC7030812),
                              ],
                              stops: const [0, 0.5, 0.78, 1],
                            ),
                          ),
                        ),
                      ),
                    ),
                    // Notch
                    Positioned(
                      top: 6,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          width: 64,
                          height: 17,
                          decoration: BoxDecoration(
                            color: Colors.black,
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                    ),
                    // Date + time
                    Positioned(
                      top: 28,
                      left: 0,
                      right: 0,
                      child: Column(
                        children: [
                          Text(
                            t('onb.lock.today').toUpperCase(),
                            style: const TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 1,
                              color: Color(0xC7FFFFFF),
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            '10:08',
                            style: TextStyle(
                              fontSize: 60,
                              height: 1,
                              fontWeight: FontWeight.w300,
                              color: Colors.white,
                              shadows: [
                                Shadow(
                                  color: Color(0x80000000),
                                  blurRadius: 12,
                                  offset: Offset(0, 2),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    // Verse glass card
                    Positioned(
                      top: 116,
                      left: 12,
                      right: 12,
                      child: Container(
                        constraints: const BoxConstraints(minHeight: 84),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 14,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(16),
                          gradient: const LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomRight,
                            colors: [Color(0x8C16233D), Color(0xB80A1428)],
                          ),
                          border: Border.all(color: const Color(0x42D2A23D)),
                          boxShadow: const [
                            BoxShadow(
                              color: Color(0xB3000000),
                              blurRadius: 30,
                              spreadRadius: -10,
                              offset: Offset(0, 12),
                            ),
                          ],
                        ),
                        child: AnimatedSwitcher(
                          duration: Onb.inDur,
                          layoutBuilder: (currentChild, previous) =>
                              currentChild ?? const SizedBox.shrink(),
                          child: Column(
                            key: ValueKey(current.reference),
                            children: [
                              Text(
                                '"${current.text}"',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 10,
                                  height: 1.45,
                                  fontStyle: FontStyle.italic,
                                  fontWeight: FontWeight.w300,
                                  fontFamily:
                                      'serif', // Georgia on web; Android resolves 'serif' the same way
                                  color: Color(0xFFF6F1E6),
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                '— ${current.reference}'.toUpperCase(),
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 7.5,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 2.25,
                                  color: Color(0xFFEFC56A),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // "New every morning" badge
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: 400 * 0.22,
                      child: Center(
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: const Color(0x38E5A521),
                            borderRadius: BorderRadius.circular(999),
                            border: Border.all(color: const Color(0x80F0BB52)),
                            boxShadow: const [
                              BoxShadow(
                                color: Color(0x80E8A82B),
                                blurRadius: 18,
                                spreadRadius: -6,
                                offset: Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Container(
                                width: 3,
                                height: 3,
                                decoration: const BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Color(0xFFF7CB54),
                                ),
                              ),
                              const SizedBox(width: 4),
                              Text(
                                t('onb.lock.badge').toUpperCase(),
                                style: const TextStyle(
                                  fontSize: 6,
                                  fontWeight: FontWeight.w700,
                                  letterSpacing: 0.84,
                                  color: Color(0xFFF8DFA6),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                    // Home indicator
                    Positioned(
                      bottom: 6,
                      left: 0,
                      right: 0,
                      child: Center(
                        child: Container(
                          width: 74,
                          height: 3,
                          decoration: BoxDecoration(
                            color: const Color(0x99FFFFFF),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
