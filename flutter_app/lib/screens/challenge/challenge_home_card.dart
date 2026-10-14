import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/app_tabs.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import 'challenge_day_screen.dart';
import 'challenge_widgets.dart';
import 'voyage.dart';

/// Home entry for the Journey: the voyage strip, today's progress and one action.
/// Web mirror: `src/components/challenge/ChallengeHomeCard.tsx`.
class ChallengeHomeCard extends ConsumerStatefulWidget {
  const ChallengeHomeCard({super.key});

  @override
  ConsumerState<ChallengeHomeCard> createState() => _ChallengeHomeCardState();
}

class _ChallengeHomeCardState extends ConsumerState<ChallengeHomeCard> {
  static const _crop = VoyageCrop.road;

  @override
  void initState() {
    super.initState();
    ChallengeStore.evaluate();
  }

  void _open(ChallengeView v) {
    haptic(HapticStyle.medium);
    Analytics.capture('challenge_home_card_tapped', {'status': v.state.status, 'day': v.day, 'lit': v.lit});
    if (v.idle || v.lit || v.finished) {
      ref.read(activeTabProvider.notifier).state = AppTabs.journey;
    } else {
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const ChallengeDayScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: ChallengeStore.revision,
      builder: (context, _, __) {
        final v = ChallengeStore.view();
        final plan = challengeDay(v.day);
        final steps = v.lit || v.finished ? 3 : v.done.where(kRequiredTasks.contains).length;
        return Padding(
          padding: const EdgeInsets.fromLTRB(12, 0, 12, 24),
          child: Semantics(
            button: true,
            label: t('ch.name'),
            child: GestureDetector(
              onTap: () => _open(v),
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.border.withValues(alpha: 0.5)),
                  boxShadow: [
                    BoxShadow(color: AppColors.primary.withValues(alpha: 0.6), blurRadius: 44, spreadRadius: -30, offset: const Offset(0, 22)),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Padding(padding: const EdgeInsets.fromLTRB(16, 16, 16, 12), child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                      Text(t('ch.name'), style: TextStyle(fontSize: 20, height: 1.2, fontWeight: FontWeight.w600, color: AppColors.foreground)),
                      if (!v.idle) ...[const SizedBox(height: 4), Text(t('ch.hub.daysProgress', {'n': v.completed}), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground))],
                    ])),
                    VoyagePoster(days: v.idle ? 0 : v.completed, crop: _crop, semanticLabel: t('ch.voyage.a11y', {'n': v.completed})),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                      child: Row(
                        children: [
                          Expanded(child: _status(v, plan, steps)),
                          const SizedBox(width: 12),
                          Container(
                            padding: const EdgeInsets.fromLTRB(14, 8, 10, 8),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              gradient: LinearGradient(colors: [ChInk.gold, ChInk.goldGlow]),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(v.idle ? t('ch.home.start') : t('ch.home.continue'),
                                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w800, color: ChInk.ctaForeground)),
                                const SizedBox(width: 2),
                                const LucideIconLite('chevron-right', size: 16, color: ChInk.ctaForeground),
                              ],
                            ),
                          ),
                        ],
                      ),
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

  Widget _status(ChallengeView v, ChallengeDayPlan plan, int steps) {
    if (v.idle) {
      return Text(t('ch.home.startSub'), style: TextStyle(fontSize: 13.5, height: 1.35, color: AppColors.mutedForeground));
    }
    if (v.finished) {
      return Text(t('ch.home.finished'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground));
    }
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text.rich(
          TextSpan(children: [
            TextSpan(text: '${t('ch.day', {'day': plan.day})} · '),
            TextSpan(text: plan.title, style: TextStyle(fontWeight: FontWeight.w400, color: AppColors.mutedForeground)),
          ]),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700, color: AppColors.foreground),
        ),
        const SizedBox(height: 6),
        Row(
          children: [
            for (var i = 0; i < kTaskIds.length; i++) ...[
              if (i > 0) const SizedBox(width: 4),
              AnimatedContainer(
                duration: const Duration(milliseconds: 260),
                width: 16,
                height: 6,
                decoration: BoxDecoration(
                  color: (kTaskIds[i] == 'reflect' ? v.done.contains('reflect') : i < steps) ? AppColors.primary : AppColors.muted,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ],
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                v.lit ? t('ch.circle.lit') : t('ch.hub.stepsDone', {'n': steps}),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(fontSize: 12, height: 1.3, color: AppColors.mutedForeground),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
