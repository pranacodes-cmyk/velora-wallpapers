import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prayer_alarm_service.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/app_toast.dart';
import 'today_shared.dart';

/// 1:1 port of `src/components/prayer/ProPrayerToggle.tsx`.
/// Pro/Trial-only one-tap silence / restore for the prayer bells.
class ProPrayerToggle extends StatefulWidget {
  const ProPrayerToggle({super.key});

  @override
  State<ProPrayerToggle> createState() => _ProPrayerToggleState();
}

class _ProPrayerToggleState extends State<ProPrayerToggle> {
  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: PrayerAlarms.revision,
      builder: (context, _, __) {
        final config = PrayerAlarms.load();
        final enabled = config.enabled;

        return FadeRise(
          offsetY: 6,
          child: Container(
            margin: const EdgeInsets.only(left: 12, right: 12, top: 12),
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
            decoration: BoxDecoration(
              color: AppColors.glass,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.22),
              ),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(16),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                child: Row(
                  children: [
                    Container(
                      width: 32,
                      height: 32,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(12),
                        color: enabled
                            ? AppColors.primary.withValues(alpha: 0.18)
                            : AppColors.foreground.withValues(alpha: 0.08),
                      ),
                      child: Icon(
                        enabled
                            ? Icons.notifications_active_outlined
                            : Icons.notifications_off_outlined,
                        size: 14,
                        color: enabled
                            ? AppColors.primary
                            : AppColors.foreground.withValues(alpha: 0.6),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Text(
                                t('prayer.toggle.label'),
                                style: TextStyle(
                                  fontSize: 12,
                                  height: 1.15,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.9,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 6,
                                  vertical: 1,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(999),
                                  color: AppColors.primary.withValues(
                                    alpha: 0.18,
                                  ),
                                ),
                                child: Text(
                                  t('today.badge.pro').toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 8.5,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: 0.8,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 2),
                          Text(
                            enabled
                                ? t('prayer.toggle.ringing')
                                : t('prayer.toggle.silenced'),
                            style: TextStyle(
                              fontSize: 10.5,
                              color: AppColors.foreground.withValues(
                                alpha: 0.55,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    _IosSwitch(
                      on: enabled,
                      width: 44,
                      height: 26,
                      knob: 22,
                      onTap: () => _toggle(config),
                    ),
                  ],
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  Future<void> _toggle(PrayerAlarmsConfig config) async {
    haptic(HapticStyle.soft);
    try {
      if (config.enabled) {
        await PrayerAlarms.disable();
        if (!mounted) return;
        AppToast.success(
          context,
          t('prayer.toggle.pausedTitle'),
          description: t('prayer.toggle.pausedDesc'),
        );
      } else {
        final times = config.times.isNotEmpty
            ? config.times
            : List<PrayerTime>.from(kDefaultPrayerTimes);
        await PrayerAlarms.enable(
          times: times,
          soundEnabled: config.soundEnabled,
        );
        if (!mounted) return;
        AppToast.success(
          context,
          t('prayer.toggle.onTitle'),
          description: t('prayer.toggle.onDesc'),
        );
      }
    } catch (_) {
      if (!mounted) return;
      AppToast.error(context, t('prayer.toggle.error'));
    }
  }
}

/// Shared iOS-style switch used by both prayer cards (spring knob on the Pro
/// toggle, plain slide on the alarm rows — matching the web transitions).
class _IosSwitch extends StatelessWidget {
  const _IosSwitch({
    required this.on,
    required this.onTap,
    required this.width,
    required this.height,
    required this.knob,
  });

  final bool on;
  final VoidCallback onTap;
  final double width;
  final double height;
  final double knob;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: on
              ? AppColors.primary
              : AppColors.foreground.withValues(alpha: 0.18),
        ),
        child: Stack(
          children: [
            AnimatedPositioned(
              duration: const Duration(milliseconds: 220),
              curve: Curves.easeOutBack,
              left: on ? width - knob - 2 : 2,
              top: (height - knob) / 2,
              child: Container(
                width: knob,
                height: knob,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.25),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Exposed so `prayer_alarm_toggles.dart` reuses the identical switch visuals.
class IosSwitch extends StatelessWidget {
  const IosSwitch({
    super.key,
    required this.on,
    required this.onTap,
    this.width = 42,
    this.height = 24,
    this.knob = 20,
    this.offColor,
    this.glow = false,
  });

  final bool on;
  final VoidCallback onTap;
  final double width;
  final double height;
  final double knob;
  final Color? offColor;
  final bool glow;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: width,
        height: height,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: on ? AppColors.primary : (offColor ?? AppColors.glassBorder),
          boxShadow: on && glow
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.55),
                    blurRadius: 14,
                    spreadRadius: -4,
                  ),
                ]
              : null,
        ),
        child: Stack(
          children: [
            AnimatedPositioned(
              duration: const Duration(milliseconds: 200),
              curve: Curves.easeOut,
              left: on ? knob : 2,
              top: 2,
              child: Container(
                width: knob,
                height: knob,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: AppColors.primaryForeground,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
