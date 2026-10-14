import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'breath_prayer.dart';
import 'passage_card.dart';
import 'pj_ui.dart';

/// Break Free — the 90-second rescue: breathe, read 1 Corinthians 10:13,
/// remember your plan and take one way out.
/// Web mirror: `src/components/projourney/StandFirmSheet.tsx`.
Future<void> showStandFirmSheet(BuildContext context) {
  Analytics.capture('pro_journey_sos_opened', const {});
  return showChallengeSheet<void>(
    context,
    title: t('pj.sos.title'),
    closeLabel: t('pj.close'),
    builder: (sheet) => _StandFirm(onClose: () => Navigator.of(sheet).pop()),
  );
}

class _StandFirm extends StatefulWidget {
  const _StandFirm({required this.onClose});
  final VoidCallback onClose;

  @override
  State<_StandFirm> createState() => _StandFirmState();
}

class _StandFirmState extends State<_StandFirm> {
  bool _won = false;

  @override
  Widget build(BuildContext context) {
    if (_won) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 24),
        child: Column(children: [
          PjPop(
            child: Container(
              width: 80,
              height: 80,
              alignment: Alignment.center,
              decoration: BoxDecoration(shape: BoxShape.circle, gradient: PjInk.goldGradient),
              child: const LucideIconLite('shield-check', size: 40, color: ChInk.ctaForeground),
            ),
          ),
          const SizedBox(height: 16),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 280),
            child: Text(t('pj.sos.won'), textAlign: TextAlign.center, style: ChInk.serif(22, height: 1.3)),
          ),
          const SizedBox(height: 24),
          GoldButton(label: t('pj.cele.done'), onTap: widget.onClose),
        ]),
      );
    }

    final f = ProJourneyStore.state.freedom;
    final plan = f.when.isNotEmpty && f.then.isNotEmpty ? t('pj.fr.planLine', {'when': f.when, 'then': f.then}) : '';
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t('pj.sos.sub'), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground)),
      const SizedBox(height: 20),
      BreathPrayer(cycles: 6, onComplete: () => Analytics.capture('pro_journey_sos_breathed', const {})),
      const SizedBox(height: 20),
      const PassageCard(passage: kSosPassage, small: true),
      if (plan.isNotEmpty) ...[
        const SizedBox(height: 20),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.background.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(upper(t('pj.fr.yourPlan')), style: PjInk.eyebrow()),
            const SizedBox(height: 4),
            Text(plan, style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, height: 1.35, color: AppColors.foreground)),
          ]),
        ),
      ],
      const SizedBox(height: 20),
      Text(t('pj.sos.after'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.foreground)),
      const SizedBox(height: 8),
      for (final k in const ['a1', 'a2', 'a3', 'a4'])
        Padding(
          padding: const EdgeInsets.only(bottom: 6),
          child: Row(children: [
            LucideIconLite('check', size: 16, color: AppColors.primary, strokeWidth: 2.6),
            const SizedBox(width: 10),
            Expanded(child: Text(t('pj.sos.$k'), style: TextStyle(fontSize: 14, color: AppColors.foreground.withValues(alpha: 0.9)))),
          ]),
        ),
      const SizedBox(height: 16),
      PjGoldButton(
        label: t('pj.sos.done'),
        icon: 'shield-check',
        shine: false,
        onTap: () {
          haptic(HapticStyle.heavy);
          ProJourneyStore.recordSos();
          Analytics.capture('pro_journey_sos_won', const {});
          setState(() => _won = true);
        },
      ),
      const SizedBox(height: 12),
      Text(t('pj.fr.help'), textAlign: TextAlign.center, style: TextStyle(fontSize: 11.5, height: 1.5, color: AppColors.mutedForeground)),
    ]);
  }
}
