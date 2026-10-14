import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/challenge_data.dart';
import '../../core/services/challenge_store.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import 'challenge_day_screen.dart';
import 'challenge_screen.dart';
import 'challenge_widgets.dart';

/// Home entry for 75 Days of Light (replaces the old Journey card).
/// Web mirror: `src/components/challenge/ChallengeHomeCard.tsx`.
class ChallengeHomeCard extends StatefulWidget {
  const ChallengeHomeCard({super.key});

  @override
  State<ChallengeHomeCard> createState() => _ChallengeHomeCardState();
}

class _ChallengeHomeCardState extends State<ChallengeHomeCard> {
  @override
  void initState() {
    super.initState();
    ChallengeStore.evaluate();
  }

  void _open(ChallengeView v) {
    haptic(HapticStyle.medium);
    Analytics.capture('challenge_home_card_tapped', {'status': v.state.status, 'day': v.day, 'lit': v.lit});
    final hub = v.idle || v.lit || v.finished;
    Navigator.of(context).push(MaterialPageRoute<void>(
      builder: (_) => hub ? const ChallengeScreen() : const ChallengeDayScreen(),
    ));
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: ChallengeStore.revision,
      builder: (context, _, __) {
        final v = ChallengeStore.view();
        final plan = challengeDay(v.day);
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
                  borderRadius: BorderRadius.circular(26),
                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.3)),
                  boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.35), blurRadius: 50, spreadRadius: -30, offset: const Offset(0, 22))],
                ),
                child: Stack(
                  children: [
                    Positioned.fill(child: Image.asset(heroArt(), fit: BoxFit.cover)),
                    const Positioned.fill(
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(colors: [Color(0xCC000000), Color(0x8C000000), Color(0x33000000)]),
                        ),
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 16, 12, 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Expanded(child: _copy(v, plan)),
                          SizedBox(
                            width: 100,
                            child: ChallengeLamp(
                              tier: v.tier,
                              intensity: v.idle ? 0.3 : v.intensity,
                              state: v.idle ? LampState.ember : (v.lit || v.finished ? LampState.lit : LampState.waiting),
                              width: 96,
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

  Widget _copy(ChallengeView v, ChallengeDayPlan plan) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(upper(t('ch.home.kicker')), style: ChInk.eyebrow(10.5, ChInk.amber200, tracking: 0.2)),
        const SizedBox(height: 4),
        Text(
          t('ch.name'),
          style: ChInk.serif(23, color: Colors.white).copyWith(shadows: const [Shadow(color: Color(0x80000000), blurRadius: 12)]),
        ),
        const SizedBox(height: 4),
        if (v.idle)
          Text(t('ch.home.startSub'), style: const TextStyle(fontSize: 13, height: 1.3, color: Color(0xCCFFFFFF)))
        else if (v.finished)
          Text(t('ch.home.finished'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: ChInk.amber100))
        else ...[
          Text.rich(
            TextSpan(children: [
              TextSpan(text: t('ch.day', {'day': plan.day}), style: const TextStyle(fontWeight: FontWeight.w700, color: ChInk.amber100)),
              TextSpan(text: ' · ${plan.title}'),
            ]),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: const TextStyle(fontSize: 13.5, color: Color(0xD9FFFFFF)),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(999),
                  child: Stack(
                    children: [
                      Container(height: 6, color: const Color(0x33FFFFFF)),
                      FractionallySizedBox(
                        widthFactor: (v.completed / kChallengeDays).clamp(0.0, 1.0),
                        child: Container(
                          height: 6,
                          decoration: const BoxDecoration(gradient: LinearGradient(colors: [Color(0xFFFCD34D), Color(0xFFFEF08A)])),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Text('${v.completed}/75', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w600, color: Color(0xBFFFFFFF))),
              if (v.streak > 0) ...[
                const SizedBox(width: 6),
                const LucideIconLite('flame', size: 12, color: ChInk.orange300),
                Text('${v.streak}', style: const TextStyle(fontSize: 11.5, fontWeight: FontWeight.w800, color: ChInk.orange300)),
              ],
            ],
          ),
        ],
        const SizedBox(height: 12),
        Row(
          children: [
            for (final id in kTaskIds) ...[
              _taskThumb(id, !v.idle && v.done.contains(id)),
              const SizedBox(width: 6),
            ],
            Expanded(
              child: Align(
                alignment: Alignment.centerRight,
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: Container(
                    padding: const EdgeInsets.fromLTRB(12, 6, 8, 6),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      gradient: LinearGradient(colors: [ChInk.gold, ChInk.goldGlow]),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(v.idle ? t('ch.home.start') : t('ch.home.continue'),
                            style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w800, color: ChInk.ctaForeground)),
                        const LucideIconLite('chevron-right', size: 16, color: ChInk.ctaForeground),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
        if (v.lit && !v.finished) ...[
          const SizedBox(height: 8),
          Text(t('ch.home.lit'), style: const TextStyle(fontSize: 11.5, color: Color(0xB3FFFFFF))),
        ],
      ],
    );
  }

  Widget _taskThumb(String id, bool done) => Container(
        width: 28,
        height: 28,
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(8),
          border: Border.all(color: done ? const Color(0xFFFCD34D) : const Color(0x40FFFFFF)),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Opacity(opacity: done ? 1 : 0.75, child: Image.asset(kTaskArt[id]!, fit: BoxFit.cover)),
            if (done)
              Container(
                color: const Color(0x59000000),
                alignment: Alignment.center,
                child: const LucideIconLite('check', size: 14, color: ChInk.amber200, strokeWidth: 3),
              ),
          ],
        ),
      );
}
