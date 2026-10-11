import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/daily_reminder_service.dart';
import '../../core/services/haptics.dart';
import 'onboarding_motion.dart';
import 'verse_slide.dart' show OnbHeadline;

/// 1:1 port of `RhythmSlide` in `OnboardingLateSlides.tsx`.
/// Morning / Evening / Both → quiet daily reminder at 07:00 / 21:00 / both.
class RhythmSlide extends StatefulWidget {
  const RhythmSlide({super.key});

  @override
  State<RhythmSlide> createState() => _RhythmSlideState();
}

class _RhythmSlideState extends State<RhythmSlide> {
  static const _options = [
    ('morning', '🌅', 38.0),
    ('evening', '🌙', 220.0),
    ('both', '✨', 45.0),
  ];

  late String _picked = DailyReminder.slots;

  @override
  void initState() {
    super.initState();
    DailyReminder.setSlots(_picked);
  }

  void _pick(String id) {
    if (id == _picked) return;
    haptic(HapticStyle.soft);
    setState(() => _picked = id);
    DailyReminder.setSlots(id);
    Analytics.capture('onboarding_rhythm_picked', {'slot': id});
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        const Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: RadialGradient(
                center: Alignment(0, -0.35),
                radius: 0.9,
                colors: [Color(0xFF0F1B38), Color(0xFF050A18)],
                stops: [0, 0.75],
              ),
            ),
          ),
        ),
        Positioned(
          top: MediaQuery.sizeOf(context).height * 0.06,
          left: (MediaQuery.sizeOf(context).width - 460) / 2,
          child: const OnbAmbientGlow(
            size: 460,
            color: Color(0xFFEDB53F),
            peak: 0.55,
            trough: 0.3,
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
                      t('onb.rhythm.kicker').toUpperCase(),
                      textAlign: TextAlign.center,
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
                    pre: t('onb.rhythm.headlinePre'),
                    gold: t('onb.rhythm.headlineGold'),
                  ),
                  const SizedBox(height: 8),
                  Opacity(
                    opacity: 0.7,
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 310),
                      child: Text(
                        t('onb.rhythm.subcopy'),
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
                  for (final o in _options) ...[
                    _RhythmCard(
                      title: t('onb.rhythm.${o.$1}Title'),
                      desc: t('onb.rhythm.${o.$1}Desc'),
                      emoji: o.$2,
                      hue: o.$3,
                      selected: _picked == o.$1,
                      onTap: () => _pick(o.$1),
                    ),
                    const SizedBox(height: 10),
                  ],
                  const SizedBox(height: 10),
                  Opacity(
                    opacity: 0.55,
                    child: Text(
                      t('onb.rhythm.footer'),
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

Color _h(double hue, double s, double l, [double a = 1]) =>
    HSLColor.fromAHSL(a, hue, s / 100, l / 100).toColor();

class _RhythmCard extends StatelessWidget {
  const _RhythmCard({
    required this.title,
    required this.desc,
    required this.emoji,
    required this.hue,
    required this.selected,
    required this.onTap,
  });

  final String title;
  final String desc;
  final String emoji;
  final double hue;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: AnimatedScale(
        scale: selected ? 1.015 : 1,
        duration: const Duration(milliseconds: 220),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 240),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(16),
            gradient: LinearGradient(
              begin: Alignment.topCenter,
              end: Alignment.bottomRight,
              colors: selected
                  ? [_h(42, 60, 20, 0.55), _h(220, 55, 9, 0.96)]
                  : const [Color(0xEB101F3B), Color(0xF5070F20)],
            ),
            border: Border.all(
              color: selected
                  ? _h(42, 88, 58, 0.85)
                  : _h(40, 30, 70, 0.14),
              width: selected ? 1.5 : 1,
            ),
            boxShadow: [
              selected
                  ? BoxShadow(
                      color: _h(42, 90, 55, 0.45),
                      blurRadius: 26,
                      spreadRadius: -6,
                    )
                  : const BoxShadow(
                      color: Color(0xB3000000),
                      blurRadius: 36,
                      spreadRadius: -14,
                      offset: Offset(0, 18),
                    ),
            ],
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  gradient: LinearGradient(
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                    colors: [_h(hue, 85, 55, 0.22), _h(hue, 85, 45, 0.04)],
                  ),
                  border: Border.all(color: _h(hue, 70, 55, 0.3)),
                ),
                child: Text(emoji, style: const TextStyle(fontSize: 22)),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontSize: 14.5,
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                        color: Color(0xFFF7F3E9),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      desc,
                      style: const TextStyle(
                        fontSize: 11,
                        color: Color(0xFFAAA394),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: selected
                      ? const LinearGradient(
                          colors: [Color(0xFFF7CF55), Color(0xFFE8A10F)],
                        )
                      : null,
                  border: selected
                      ? null
                      : Border.all(color: _h(40, 20, 70, 0.3), width: 1.5),
                ),
                child: selected
                    ? const Icon(Icons.check_rounded,
                        size: 15, color: Color(0xFF071022))
                    : null,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
