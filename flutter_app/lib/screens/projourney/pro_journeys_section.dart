import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'pj_ui.dart';
import 'pro_journey_screen.dart';

/// Journey tab — cinematic shelf of the four Pro Journeys.
/// Web mirror: `src/components/projourney/ProJourneysSection.tsx`.
class ProJourneysSection extends StatelessWidget {
  const ProJourneysSection({super.key, required this.isPremium});
  final bool isPremium;

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ProJourneyStore.revision,
      builder: (context, _) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 4),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Row(children: [
              Flexible(child: Text(t('pj.section.title'), style: JourneyText.section())),
              const SizedBox(width: 8),
              const _ProPill(),
            ]),
            const SizedBox(height: 2),
            Text(t('pj.section.sub'), style: TextStyle(fontSize: 13, height: 1.35, color: AppColors.mutedForeground)),
          ]),
        ),
        const SizedBox(height: 12),
        LayoutBuilder(builder: (context, c) {
          // Bleed the shelf to the screen edges (web: `-mx-4`).
          final w = c.maxWidth + 32;
          return SizedBox(
            height: 246,
            child: OverflowBox(
              minWidth: w,
              maxWidth: w,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.fromLTRB(20, 0, 20, 8),
                itemCount: kProJourneys.length,
                separatorBuilder: (_, __) => const SizedBox(width: 12),
                itemBuilder: (context, i) => _ShelfCard(journey: kProJourneys[i], isPremium: isPremium),
              ),
            ),
          );
        }),
      ]),
    );
  }
}

class _ProPill extends StatelessWidget {
  const _ProPill();
  @override
  Widget build(BuildContext context) => Container(
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
        decoration: BoxDecoration(gradient: PjInk.goldGradient, borderRadius: BorderRadius.circular(999)),
        child: Text(t('pj.pro'), style: const TextStyle(fontSize: 9, fontWeight: FontWeight.w900, letterSpacing: 0.7, color: ChInk.ctaForeground)),
      );
}

class _ShelfCard extends StatelessWidget {
  const _ShelfCard({required this.journey, required this.isPremium});
  final ProJourneyDef journey;
  final bool isPremium;

  @override
  Widget build(BuildContext context) {
    final j = journey;
    final status = ProJourneyStore.status(j.id);
    final done = ProJourneyStore.doneCount(j.id);
    final active = status.kind == JourneyStatusKind.today || status.kind == JourneyStatusKind.wait;
    final locked = !isPremium && status.kind != JourneyStatusKind.done &&
        (status.kind == JourneyStatusKind.fresh || proJourneyRequiresPro(status.day));
    final line = switch (status.kind) {
      JourneyStatusKind.done => t('pj.status.done'),
      _ when locked => t('pj.status.locked'),
      JourneyStatusKind.fresh => t('pj.status.new'),
      JourneyStatusKind.today => t('pj.status.next', {'n': status.day}),
      JourneyStatusKind.wait => t('pj.status.wait', {'n': status.day}),
    };
    final name = t('pj.${j.id}.name');

    return Semantics(
      button: true,
      label: '$name. ${t('pj.days', {'n': j.days})}. $line',
      excludeSemantics: true,
      child: GestureDetector(
        onTap: () {
          haptic(HapticStyle.light);
          Analytics.capture('pro_journey_card_tapped', {'id': j.id, 'status': status.kind.name, 'premium': isPremium});
          Navigator.of(context).push(MaterialPageRoute(builder: (_) => ProJourneyScreen(id: j.id)));
        },
        child: Container(
          width: 172,
          height: 238,
          clipBehavior: Clip.antiAlias,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: AppColors.border.withValues(alpha: 0.4)),
            boxShadow: [BoxShadow(color: PjInk.posterScrim.withValues(alpha: 0.9), blurRadius: 30, spreadRadius: -18, offset: const Offset(0, 14))],
          ),
          child: Stack(fit: StackFit.expand, children: [
            Image.asset(j.cover, fit: BoxFit.cover, cacheWidth: 360),
            DecoratedBox(decoration: BoxDecoration(gradient: PjInk.coverScrim)),
            Positioned(
              left: 10,
              top: 10,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(color: PjInk.posterScrim.withValues(alpha: 0.5), borderRadius: BorderRadius.circular(999)),
                child: Text(t('pj.days', {'n': j.days}), style: const TextStyle(fontSize: 10.5, fontWeight: FontWeight.w700, color: PjInk.posterInk)),
              ),
            ),
            if (status.kind == JourneyStatusKind.done)
              Positioned(
                right: 10,
                top: 10,
                child: Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: PjInk.voyageGold),
                  child: const LucideIconLite('check', size: 16, color: ChInk.ctaForeground, strokeWidth: 3),
                ),
              )
            else if (!isPremium)
              Positioned(
                right: 10,
                top: 10,
                child: Container(
                  width: 28,
                  height: 28,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: PjInk.posterScrim.withValues(alpha: 0.55)),
                  child: const LucideIconLite('lock', size: 14, color: PjInk.posterInk),
                ),
              ),
            Positioned(
              left: 12,
              right: 12,
              bottom: 12,
              child: Column(crossAxisAlignment: CrossAxisAlignment.start, mainAxisSize: MainAxisSize.min, children: [
                Text('${j.emoji} $name',
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: ChInk.serif(19, color: PjInk.posterInk, height: 1.12)),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(99),
                  child: SizedBox(
                    height: 4,
                    width: double.infinity,
                    child: Stack(children: [
                      Positioned.fill(child: ColoredBox(color: PjInk.posterInk.withValues(alpha: 0.22))),
                      FractionallySizedBox(
                        widthFactor: (done / j.days).clamp(0.0, 1.0),
                        child: DecoratedBox(
                          decoration: BoxDecoration(gradient: LinearGradient(colors: [PjInk.voyageGold, ChInk.goldGlow])),
                        ),
                      ),
                    ]),
                  ),
                ),
                const SizedBox(height: 6),
                Text(line,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: locked ? AppColors.premiumGoldGlow : PjInk.posterInk.withValues(alpha: 0.9),
                    )),
              ]),
            ),
          ]),
        ),
      ),
    );
  }
}
