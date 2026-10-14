import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/pro_journeys.dart';
import '../../core/theme/app_colors.dart';
import '../challenge/challenge_widgets.dart';
import 'pj_ui.dart';

/// Prayer Warrior — private prayer list with answered prayers.
/// Web mirror: `src/components/projourney/PrayerList.tsx`.
class PrayerList extends StatefulWidget {
  const PrayerList({super.key, this.compact = false});
  final bool compact;

  @override
  State<PrayerList> createState() => _PrayerListState();
}

class _PrayerListState extends State<PrayerList> {
  final _name = TextEditingController();
  final _need = TextEditingController();

  @override
  void dispose() {
    _name.dispose();
    _need.dispose();
    super.dispose();
  }

  void _add() {
    final items = ProJourneyStore.state.prayers;
    if (_name.text.trim().isEmpty || items.length >= kPrayerListMax) return;
    if (ProJourneyStore.addPrayer(_name.text, _need.text)) {
      haptic(HapticStyle.light);
      Analytics.capture('pro_journey_prayer_added', {'count': items.length + 1});
      _name.clear();
      _need.clear();
      setState(() {});
    }
  }

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: ProJourneyStore.revision,
      builder: (context, _) {
        final items = ProJourneyStore.state.prayers;
        final full = items.length >= kPrayerListMax;
        final answered = ProJourneyStore.answeredCount;
        return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Row(children: [
            Expanded(child: Text(upper(t('pj.pl.title')), style: PjInk.eyebrow())),
            if (items.isNotEmpty)
              Text(
                '${t('pj.pl.count', {'n': items.length})}${answered > 0 ? ' · ${t('pj.pl.answeredN', {'n': answered})}' : ''}',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.mutedForeground),
              ),
          ]),
          if (!widget.compact) ...[
            const SizedBox(height: 4),
            Text(t('pj.pl.sub'), style: TextStyle(fontSize: 13, color: AppColors.mutedForeground)),
          ],
          const SizedBox(height: 12),
          if (items.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(t('pj.pl.empty'), style: TextStyle(fontSize: 13.5, height: 1.5, color: AppColors.mutedForeground)),
            )
          else
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                color: AppColors.background.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border.withValues(alpha: 0.6)),
              ),
              child: Column(children: [
                for (var i = 0; i < items.length; i++) ...[
                  if (i > 0) Divider(height: 1, thickness: 1, color: AppColors.border.withValues(alpha: 0.7)),
                  _row(items[i]),
                ],
              ]),
            ),
          const SizedBox(height: 12),
          if (full)
            Text(t('pj.pl.full'), style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground))
          else ...[
            Row(children: [
              Expanded(
                child: Semantics(
                  label: t('pj.pl.name'),
                  child: PjField(controller: _name, hint: t('pj.pl.name'), maxLength: 40, onChanged: (_) => setState(() {}), onSubmitted: (_) => _add()),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 46,
                child: Opacity(
                  opacity: _name.text.trim().isEmpty ? 0.4 : 1,
                  child: FilledButton.icon(
                    onPressed: _name.text.trim().isEmpty ? null : _add,
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      disabledBackgroundColor: AppColors.primary,
                      foregroundColor: AppColors.primaryForeground,
                      disabledForegroundColor: AppColors.primaryForeground,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                    ),
                    icon: LucideIconLite('plus', size: 16, color: AppColors.primaryForeground, strokeWidth: 2.6),
                    label: Text(t('pj.pl.add'), style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w700)),
                  ),
                ),
              ),
            ]),
            const SizedBox(height: 8),
            Semantics(
              label: t('pj.pl.need'),
              child: PjField(controller: _need, hint: t('pj.pl.need'), fontSize: 14, onSubmitted: (_) => _add()),
            ),
          ],
          const SizedBox(height: 8),
          Text(t('pj.pl.private'), style: TextStyle(fontSize: 11.5, color: AppColors.mutedForeground)),
        ]);
      },
    );
  }

  Widget _row(PrayerItem p) {
    final done = p.answered != null;
    final initial = p.name.trim().isEmpty ? '' : p.name.trim().characters.first.toUpperCase();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(children: [
        Container(
          width: 36,
          height: 36,
          alignment: Alignment.center,
          decoration: BoxDecoration(shape: BoxShape.circle, color: done ? AppColors.primary : AppColors.primary.withValues(alpha: 0.1)),
          child: done
              ? LucideIconLite('check', size: 16, color: AppColors.primaryForeground, strokeWidth: 3)
              : Text(initial, style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.primary)),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(p.name,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  fontSize: 14.5,
                  fontWeight: FontWeight.w600,
                  color: done ? AppColors.mutedForeground : AppColors.foreground,
                  decoration: done ? TextDecoration.lineThrough : null,
                  decorationColor: AppColors.primary.withValues(alpha: 0.6),
                )),
            if (p.need.isNotEmpty)
              Text(p.need, maxLines: 1, overflow: TextOverflow.ellipsis, style: TextStyle(fontSize: 12.5, color: AppColors.mutedForeground)),
          ]),
        ),
        const SizedBox(width: 8),
        Semantics(
          button: true,
          toggled: done,
          child: GestureDetector(
            onTap: () {
              haptic(done ? HapticStyle.light : HapticStyle.medium);
              ProJourneyStore.toggleAnswered(p.id);
              if (!done) Analytics.capture('pro_journey_prayer_answered', const {});
            },
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: done ? AppColors.primary.withValues(alpha: 0.15) : null,
                borderRadius: BorderRadius.circular(999),
                border: done ? null : Border.all(color: AppColors.border),
              ),
              child: Text(t(done ? 'pj.pl.answered' : 'pj.pl.markAnswered'),
                  style: TextStyle(fontSize: 11.5, fontWeight: FontWeight.w700, color: done ? AppColors.primary : AppColors.mutedForeground)),
            ),
          ),
        ),
        if (!widget.compact)
          IconButton(
            tooltip: t('pj.pl.remove'),
            visualDensity: VisualDensity.compact,
            onPressed: () {
              haptic(HapticStyle.light);
              ProJourneyStore.removePrayer(p.id);
            },
            icon: LucideIconLite('x', size: 16, color: AppColors.mutedForeground.withValues(alpha: 0.7)),
          ),
      ]),
    );
  }
}
