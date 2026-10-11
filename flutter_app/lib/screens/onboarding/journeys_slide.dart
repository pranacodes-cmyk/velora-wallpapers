import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import 'onboarding_motion.dart';
import 'onboarding_shared.dart';
import 'verse_slide.dart' show OnbHeadline;

/// 1:1 port of `JourneysSlide` (slide 1) from `OnboardingFlow.tsx`.
/// Three journey cards with hue-tinted accent bar, cross glyph tile and a
/// 7-bar equaliser on the first card.
class _Journey {
  const _Journey(this.title, this.meta, this.hue);
  final String title;
  final String meta;
  final double hue;
}

Color _h(double hue, double s, double l, [double a = 1]) =>
    HSLColor.fromAHSL(a, hue, s / 100, l / 100).toColor();

class JourneysSlide extends StatelessWidget {
  const JourneysSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final journeys = <_Journey>[
      _Journey(t('onb.journeys.item1Title'), t('onb.journeys.item1Meta'), 42),
      _Journey(t('onb.journeys.item2Title'), t('onb.journeys.item2Meta'), 28),
      _Journey(t('onb.journeys.item3Title'), t('onb.journeys.item3Meta'), 220),
    ];

    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.3),
                radius: 0.9,
                colors: [Color(0xFF0F1C39), Color(0xFF050A19)],
                stops: [0, 0.7],
              ),
            ),
          ),
        ),
        // Breathing blue halo — Impeller handles this at 120fps, so the
        // Capacitor-era static glow is no longer necessary.
        Positioned(
          top: MediaQuery.sizeOf(context).height * 0.08,
          left: (MediaQuery.sizeOf(context).width - 480) / 2,
          child: const OnbAmbientGlow(
            size: 480,
            color: Color(0xFF3B82F6),
            peak: 0.5,
            trough: 0.26,
          ),
        ),
        SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(28, 40, 28, 128),
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 420),
              child: Column(
                children: onbStagger([
                  SizedBox(height: MediaQuery.paddingOf(context).top),
                  Opacity(
                    opacity: 0.75,
                    child: Text(
                      t('onb.journeys.kicker').toUpperCase(),
                      style: const TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 4,
                        color: Color(0xFFE5B44C),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  OnbHeadline(
                    pre: t('onb.journeys.headlinePre'),
                    gold: t('onb.journeys.headlineGold'),
                  ),
                  const SizedBox(height: 8),
                  Opacity(
                    opacity: 0.7,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 310),
                      child: Text(
                        t('onb.journeys.subcopy'),
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontSize: 12.5,
                          height: 1.5,
                          color: Color(0xFFD5CEC0),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 28),
                  for (var i = 0; i < journeys.length; i++) ...[
                    _JourneyCard(journey: journeys[i], showEqualiser: i == 0),
                    if (i != journeys.length - 1) const SizedBox(height: 10),
                  ],
                  const SizedBox(height: 20),
                  Opacity(
                    opacity: 0.55,
                    child: Text(
                      t('onb.journeys.footer'),
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 11,
                        letterSpacing: 0.55,
                        color: Color(0xFFC2BBAD),
                      ),
                    ),
                  ),
                ]),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _JourneyCard extends StatelessWidget {
  const _JourneyCard({required this.journey, required this.showEqualiser});

  final _Journey journey;
  final bool showEqualiser;

  @override
  Widget build(BuildContext context) {
    final hue = journey.hue;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        gradient: const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomRight,
          colors: [Color(0xEB101F3B), Color(0xF5070F20)],
        ),
        border: Border.all(color: _h(hue, 70, 55, 0.22)),
        boxShadow: const [
          BoxShadow(
            color: Color(0xB3000000),
            blurRadius: 36,
            spreadRadius: -14,
            offset: Offset(0, 18),
          ),
        ],
      ),
      child: Stack(
        children: [
          Positioned(
            left: -16,
            top: 2,
            bottom: 2,
            child: Container(
              width: 3,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [_h(hue, 90, 60), _h(hue, 85, 45)],
                ),
                boxShadow: [
                  BoxShadow(color: _h(hue, 90, 55, 0.6), blurRadius: 12),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 8),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [_h(hue, 85, 55, 0.22), _h(hue, 85, 45, 0.04)],
                    ),
                    border: Border.all(color: _h(hue, 70, 55, 0.3)),
                  ),
                  child: Center(child: _CrossGlyph(color: _h(hue, 85, 62))),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        journey.title,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w700,
                          height: 1.15,
                          color: Color(0xFFF7F3E9),
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        journey.meta,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: const TextStyle(
                          fontSize: 10.5,
                          color: Color(0xFFAAA394),
                        ),
                      ),
                    ],
                  ),
                ),
                if (showEqualiser) const _Equaliser(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

/// 13x18 cross glyph — same two rounded bars as the inline SVG on web.
class _CrossGlyph extends StatelessWidget {
  const _CrossGlyph({required this.color});
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 13,
      height: 18,
      child: Stack(
        alignment: Alignment.center,
        children: [
          Align(
            alignment: Alignment.topCenter,
            child: Container(
              width: 3.7,
              height: 18,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
          Positioned(
            top: 4.5,
            child: Container(
              width: 13,
              height: 3.7,
              decoration: BoxDecoration(
                color: color,
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 7 gold bars, heights 6/12/8/16/10/14/7, staggered 1.2s scaleY pulse.
class _Equaliser extends StatefulWidget {
  const _Equaliser();

  @override
  State<_Equaliser> createState() => _EqualiserState();
}

class _EqualiserState extends State<_Equaliser>
    with SingleTickerProviderStateMixin {
  static const _heights = [6.0, 12.0, 8.0, 16.0, 10.0, 14.0, 7.0];
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1200),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        for (var i = 0; i < _heights.length; i++)
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: AnimatedBuilder(
              animation: _c,
              builder: (context, _) {
                final phase = (_c.value + i * 0.1) % 1.0;
                final scale = 1 + 0.6 * (1 - (phase * 2 - 1).abs());
                return Transform.scale(
                  scaleY: scale,
                  child: Container(
                    width: 2,
                    height: _heights[i],
                    decoration: BoxDecoration(
                      color: const Color(0xFFEDBB47),
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                );
              },
            ),
          ),
      ],
    );
  }
}
