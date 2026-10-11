import 'package:flutter/material.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../today/prayer_alarm_toggles.dart';

/// Classic silent alarm preview and the same opt-in controls as Today.
class PrayerAlarmSlide extends StatelessWidget {
  const PrayerAlarmSlide({super.key});

  @override
  Widget build(BuildContext context) {
    final height = MediaQuery.sizeOf(context).height;
    final phoneHeight = (height * .36).clamp(220.0, 340.0);
    return ColoredBox(
      color: AppColors.background,
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(20, 40, 20, 160),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(children: [
              Text(t('onb.time.eyebrowPick'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primary)),
              const SizedBox(height: 8),
              Text(t('onb.time.titlePick'), textAlign: TextAlign.center, style: TextStyle(fontSize: 24, fontWeight: FontWeight.w700, color: AppColors.foreground)),
              const SizedBox(height: 20),
              Container(
                height: phoneHeight,
                width: phoneHeight * 9 / 19.5,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(color: AppColors.card, borderRadius: BorderRadius.circular(28), border: Border.all(color: AppColors.goldBorder)),
                child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.add_rounded, size: 44, color: AppColors.primary),
                  const SizedBox(height: 20),
                  Text(t('onb.time.bellLabel'), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: AppColors.primary)),
                  Text('7:00', style: TextStyle(fontSize: 38, fontWeight: FontWeight.w200, color: AppColors.foreground)),
                  Text(t('onb.time.morningPrayerLabel'), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, color: AppColors.foreground)),
                  const SizedBox(height: 18),
                  Text(t('onb.time.openPrayerBtn'), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: AppColors.primary)),
                ]),
              ),
              const SizedBox(height: 12),
              Text(t('onb.time.mockAlarm'), style: TextStyle(fontSize: 11, color: AppColors.primary)),
              const SizedBox(height: 16),
              const PrayerAlarmToggles(),
            ]),
          ),
        ),
      ),
    );
  }
}