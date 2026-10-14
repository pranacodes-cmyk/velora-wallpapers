import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/theme/app_colors.dart';
import 'voyage.dart';

const kJourneyTourKey = 'prayly_journey_buddy_tour_v2';

/// Three-beat cinematic introduction to Journey buddies.
/// Web mirror: `src/components/challenge/JourneyWalkthrough.tsx`.
class JourneyWalkthrough extends StatefulWidget {
  const JourneyWalkthrough({super.key});

  static bool get seen => Prefs.getBool(kJourneyTourKey);

  @override
  State<JourneyWalkthrough> createState() => _JourneyWalkthroughState();
}

class _JourneyWalkthroughState extends State<JourneyWalkthrough> {
  int _page = 0;
  bool _finishing = false;

  Future<void> _finish() async {
    await Prefs.setBool(kJourneyTourKey, true);
    haptic(HapticStyle.light);
    if (mounted) {
      setState(() => _finishing = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop();
      });
    }
  }

  void _next() {
    haptic(HapticStyle.light);
    if (_page == 2) {
      _finish();
    } else {
      setState(() => _page++);
    }
  }

  @override
  Widget build(BuildContext context) {
    final buddies = _page == 1
        ? const [(id: 'tour-dove', days: 18, avatar: '🕊️'), (id: 'tour-lion', days: 10, avatar: '🦁')]
        : const <({String id, int days, String avatar})>[];
    final days = _page == 0 ? 12 : _page == 1 ? 22 : 60;
    final from = _page == 0 ? 4 : _page == 1 ? 14 : 52;
    final bottom = MediaQuery.paddingOf(context).bottom;

    return PopScope(
      canPop: _finishing,
      child: Material(
      color: AppColors.card,
      borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      clipBehavior: Clip.antiAlias,
      child: Padding(
        padding: EdgeInsets.only(bottom: bottom > 0 ? bottom : 20),
        child: SingleChildScrollView(child: Column(mainAxisSize: MainAxisSize.min, children: [
          Stack(children: [
            VoyagePoster(
              key: ValueKey(_page),
              days: days,
              fromDays: from,
              buddies: buddies,
              sailDelay: const Duration(milliseconds: 180),
              sailDuration: const Duration(milliseconds: 2200),
              semanticLabel: t('ch.tour.${_page + 1}.title'),
            ),
          ]),
          Padding(
            padding: const EdgeInsets.fromLTRB(24, 8, 24, 0),
            child: Column(children: [
              Text(t('ch.tour.kicker').toUpperCase(), style: TextStyle(fontSize: 11, letterSpacing: 0, fontWeight: FontWeight.w700, color: AppColors.primary)),
              const SizedBox(height: 8),
              Text(t('ch.tour.${_page + 1}.title'), textAlign: TextAlign.center, style: TextStyle(fontSize: 25, height: 1.15, fontWeight: FontWeight.w700, color: AppColors.foreground)),
              const SizedBox(height: 8),
              Text(t('ch.tour.${_page + 1}.sub'), textAlign: TextAlign.center, style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.mutedForeground)),
              if (_page == 2) ...[
                const SizedBox(height: 16),
                Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                  for (var i = 0; i < 5; i++) Expanded(child: _badge(i)),
                ]),
                const SizedBox(height: 16),
                Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                  Icon(Icons.volunteer_activism_outlined, size: 20, color: AppColors.primary),
                  const SizedBox(width: 8),
                  Flexible(child: Text(t('ch.tour.prayer'), textAlign: TextAlign.center, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w500, color: AppColors.primary))),
                ]),
              ],
              const SizedBox(height: 18),
              Row(mainAxisAlignment: MainAxisAlignment.center, children: [
                for (var i = 0; i < 3; i++) AnimatedContainer(
                  duration: const Duration(milliseconds: 220), margin: const EdgeInsets.symmetric(horizontal: 3),
                  width: i == _page ? 28 : 6, height: 6,
                  decoration: BoxDecoration(borderRadius: BorderRadius.circular(9), color: i == _page ? AppColors.primary : AppColors.muted),
                ),
              ]),
              const SizedBox(height: 20),
              SizedBox(width: double.infinity, height: 48, child: FilledButton.icon(
                onPressed: _next,
                style: FilledButton.styleFrom(backgroundColor: AppColors.primary, foregroundColor: AppColors.primaryForeground, shape: const StadiumBorder()),
                icon: Icon(_page == 2 ? Icons.check_rounded : Icons.arrow_forward_rounded, size: 18),
                label: Text(t(_page == 2 ? 'ch.tour.done' : 'ch.tour.next'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
              )),
            ]),
          ),
        ])),
      ),
    ),
    );
  }

  Widget _badge(int index) {
    const stages = ['spark', 'ember', 'glow', 'radiance', 'beacon'];
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 2),
      child: Column(children: [
        Container(
          width: 40, height: 40, alignment: Alignment.center,
          decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primary.withValues(alpha: 0.1), border: Border.all(color: AppColors.primary.withValues(alpha: 0.5))),
          child: Icon(Icons.workspace_premium_outlined, size: 22, color: AppColors.primary),
        ),
        const SizedBox(height: 4),
        Text('${(index + 1) * 15}', style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
        const SizedBox(height: 4),
        Text(t('ch.stage.${stages[index]}'), textAlign: TextAlign.center, style: TextStyle(fontSize: 10, height: 1.2, color: AppColors.mutedForeground)),
      ]),
    );
  }
}
