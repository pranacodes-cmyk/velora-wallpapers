import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'pj_ui.dart';

/// Break Free — choose the battle and write an if-then plan.
/// Web mirror: `src/components/projourney/BattleSetup.tsx`.
class BattleSetup extends StatefulWidget {
  const BattleSetup({super.key, this.onSaved});
  final VoidCallback? onSaved;

  @override
  State<BattleSetup> createState() => _BattleSetupState();
}

class _BattleSetupState extends State<BattleSetup> {
  late String? _battle = ProJourneyStore.state.freedom.battle;
  late final _when = TextEditingController(text: ProJourneyStore.state.freedom.when);
  late final _then = TextEditingController(text: ProJourneyStore.state.freedom.then);

  @override
  void dispose() {
    _when.dispose();
    _then.dispose();
    super.dispose();
  }

  bool get _ready => _battle != null && _when.text.trim().length >= 2 && _then.text.trim().length >= 2;

  @override
  Widget build(BuildContext context) {
    return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
      Text(t('pj.fr.pick'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, height: 1.3, color: AppColors.foreground)),
      const SizedBox(height: 2),
      Text(t('pj.fr.pickSub'), style: TextStyle(fontSize: 13, color: AppColors.mutedForeground)),
      const SizedBox(height: 12),
      LayoutBuilder(builder: (context, c) {
        final half = (c.maxWidth - 8) / 2;
        return Wrap(spacing: 8, runSpacing: 8, children: [
          for (final b in kBattles) SizedBox(width: b == 'other' ? c.maxWidth : half, child: _chip(b)),
        ]);
      }),
      const SizedBox(height: 8),
      Row(children: [
        LucideIconLite('lock', size: 12, color: AppColors.mutedForeground),
        const SizedBox(width: 6),
        Expanded(child: Text(t('pj.fr.private'), style: TextStyle(fontSize: 11.5, color: AppColors.mutedForeground))),
      ]),
      const SizedBox(height: 20),
      Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.primary.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
        ),
        child: Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(upper(t('pj.fr.planTitle')), style: PjInk.eyebrow()),
          const SizedBox(height: 4),
          Text(t('pj.fr.planHint'), style: TextStyle(fontSize: 12.5, height: 1.5, color: AppColors.mutedForeground)),
          const SizedBox(height: 12),
          Text(t('pj.fr.when'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.foreground)),
          const SizedBox(height: 4),
          PjField(controller: _when, hint: t('pj.fr.whenPh'), onChanged: (_) => setState(() {})),
          const SizedBox(height: 12),
          Text(t('pj.fr.then'), style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: AppColors.foreground)),
          const SizedBox(height: 4),
          PjField(controller: _then, hint: t('pj.fr.thenPh'), onChanged: (_) => setState(() {})),
          const SizedBox(height: 16),
          GoldButton(
            label: t('pj.fr.save'),
            height: 48,
            onTap: !_ready
                ? null
                : () {
                    haptic(HapticStyle.medium);
                    ProJourneyStore.setBattle(_battle!);
                    ProJourneyStore.setPlan(_when.text, _then.text);
                    Analytics.capture('pro_journey_plan_saved', {'battle': _battle});
                    FocusScope.of(context).unfocus();
                    widget.onSaved?.call();
                  },
          ),
        ]),
      ),
    ]);
  }

  Widget _chip(String b) {
    final on = _battle == b;
    return Semantics(
      button: true,
      selected: on,
      child: GestureDetector(
        onTap: () {
          haptic(HapticStyle.light);
          setState(() => _battle = b);
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 160),
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          decoration: BoxDecoration(
            color: on ? AppColors.primary : AppColors.background.withValues(alpha: 0.6),
            borderRadius: BorderRadius.circular(16),
            border: on ? null : Border.all(color: AppColors.border.withValues(alpha: 0.7)),
          ),
          child: Row(children: [
            Text(kBattleEmoji[b] ?? '', style: const TextStyle(fontSize: 18)),
            const SizedBox(width: 8),
            Expanded(
              child: Text(t('pj.fr.b.$b'),
                  style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600, height: 1.2, color: on ? AppColors.primaryForeground : AppColors.foreground)),
            ),
          ]),
        ),
      ),
    );
  }
}
