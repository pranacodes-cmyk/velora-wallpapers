import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/challenge_data.dart' show kRequiredTasks, kTaskIds;
import '../../core/theme/app_colors.dart';
import 'challenge_widgets.dart';

/// Five 15-day stages, mirrored from web `STAGES` in `challenge75.ts`.
const List<(String, int, int)> kJourneyStages = [
  ('spark', 1, 15),
  ('ember', 16, 30),
  ('glow', 31, 45),
  ('radiance', 46, 60),
  ('beacon', 61, 75),
];

/// Today's four steps as glowing stones on a short path (web `TodayPath`).
class TodayPath extends StatelessWidget {
  const TodayPath({
    super.key,
    required this.taskIds,
    required this.icons,
    required this.done,
    required this.allDone,
    required this.subtitles,
    required this.onOpen,
  });

  final List<String> taskIds;
  final Map<String, String> icons;
  final List<String> done;
  final bool allDone;
  final Map<String, String> subtitles;
  final ValueChanged<String> onOpen;

  bool _isDone(String id) =>
      id == 'reflect' ? done.contains(id) : allDone || done.contains(id);

  @override
  Widget build(BuildContext context) {
    final requiredCount = kRequiredTasks.where(_isDone).length;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text(t('ch.hub.steps'), style: TextStyle(fontSize: 17, fontWeight: FontWeight.w600, color: AppColors.foreground)),
              const SizedBox(height: 2),
              Text(t('ch.hub.stepsDone', {'n': requiredCount}), style: TextStyle(fontSize: 12, color: AppColors.mutedForeground)),
            ])),
            const JourneyInfoButton(kind: 'steps'),
          ]),
          const SizedBox(height: 16),
          Row(children: [for (final id in taskIds) Expanded(child: _stone(id, _isDone(id), id == taskIds.firstWhere((x) => !_isDone(x), orElse: () => '')))]),
        ],
      ),
    );
  }

  Widget _stone(String id, bool d, bool current) {
    return Semantics(
      button: true,
      label: d ? '${t('ch.task.$id')} · ${t('ch.task.done')}' : t('ch.task.$id'),
      child: GestureDetector(
        onTap: () => onOpen(id),
        child: Column(
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 260),
              width: 44,
              height: 44,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: d ? AppColors.primary : (current ? AppColors.primary.withValues(alpha: 0.1) : AppColors.muted),
                border: current && !d ? Border.all(color: AppColors.primary.withValues(alpha: 0.5)) : null,
              ),
              child: d
                  ? Icon(Icons.check_rounded, size: 22, color: AppColors.primaryForeground)
                  : LucideIconLite(icons[id] ?? 'map-pin', size: 20, strokeWidth: 1.9, color: current ? AppColors.primary : AppColors.mutedForeground),
            ),
            const SizedBox(height: 6),
            Text(t('ch.task.$id'),
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: d || current ? AppColors.foreground : AppColors.mutedForeground)),
            if (id == 'reflect' && !d)
              Text(t('ch.task.optional'), textAlign: TextAlign.center, style: TextStyle(fontSize: 9.5, fontWeight: FontWeight.w600, letterSpacing: 0.4, color: AppColors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}

/// Five collectible medallions plus the live streak (web `MilestoneShelf`).
class MilestoneShelf extends StatelessWidget {
  const MilestoneShelf({super.key, required this.completed, required this.streak});
  final int completed;
  final int streak;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.only(top: 20),
      decoration: BoxDecoration(border: Border(top: BorderSide(color: AppColors.border))),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Expanded(child: Text(t('ch.hub.badges'), style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: AppColors.foreground))),
              const JourneyInfoButton(kind: 'badges'),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(color: AppColors.primary.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(99)),
                child: Row(mainAxisSize: MainAxisSize.min, children: [
                  LucideIconLite('flame', size: 14, color: AppColors.primary),
                  const SizedBox(width: 4),
                  Text(t('ch.streak', {'n': streak}), style: TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700, color: AppColors.primary)),
                ]),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              for (final s in kJourneyStages) Expanded(child: _medal(s.$1, s.$2, s.$3)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _medal(String key, int from, int to) {
    final p = ((completed - from + 1) / (to - from + 1)).clamp(0.0, 1.0);
    final earned = completed >= to;
    return Column(
      children: [
        SizedBox(
          width: 54,
          height: 54,
          child: Stack(
            alignment: Alignment.center,
            children: [
              SizedBox(
                width: 50,
                height: 50,
                child: CircularProgressIndicator(
                  value: p,
                  strokeWidth: 3,
                  strokeCap: StrokeCap.round,
                  backgroundColor: AppColors.muted,
                  valueColor: AlwaysStoppedAnimation(AppColors.primary),
                ),
              ),
              Container(
                width: 40,
                height: 40,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: earned ? AppColors.primary : (p > 0 ? AppColors.primary.withValues(alpha: 0.1) : AppColors.muted),
                  boxShadow: earned ? [BoxShadow(color: AppColors.primary.withValues(alpha: 0.7), blurRadius: 16, spreadRadius: -2)] : null,
                ),
                child: earned || p > 0
                    ? Text('$to', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: earned ? AppColors.primaryForeground : AppColors.primary))
                    : LucideIconLite('lock', size: 14, color: AppColors.mutedForeground),
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(t('ch.stage.$key'),
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: earned ? AppColors.primary : AppColors.mutedForeground)),
      ],
    );
  }
}

/// On-demand explanations shared by the daily path, milestones and crew card.
class JourneyInfoButton extends StatelessWidget {
  const JourneyInfoButton({super.key, required this.kind});
  final String kind;

  @override
  Widget build(BuildContext context) {
    final title = t(kind == 'steps' ? 'ch.hub.steps' : kind == 'lamb' ? 'ch.help.lambTitle' : 'ch.hub.badges');
    return IconButton(
      tooltip: '$title · ${t('ch.intro.how')}',
      style: IconButton.styleFrom(minimumSize: const Size(36, 36), fixedSize: const Size(36, 36), padding: EdgeInsets.zero),
      icon: Icon(Icons.info_outline_rounded, size: 18, color: AppColors.mutedForeground),
      onPressed: () => showChallengeSheet<void>(context,
        title: title, closeLabel: t('ch.notice.ok'),
        builder: (_) => Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: [
          Text(t('ch.help.$kind'), style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.mutedForeground)),
          const SizedBox(height: 20),
          if (kind == 'steps') for (final id in kTaskIds)
            Padding(padding: const EdgeInsets.only(bottom: 16), child: Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Container(width: 40, height: 40, decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primary.withValues(alpha: 0.1)),
                child: Center(child: LucideIconLite(kTaskIcon[id] ?? 'map-pin', size: 20, color: AppColors.primary))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Row(children: [
                  Flexible(child: Text(t('ch.task.$id'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground))),
                  if (id == 'reflect') ...[
                    const SizedBox(width: 8),
                    Text(t('ch.task.optional'), style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, letterSpacing: 0.4, color: AppColors.mutedForeground)),
                  ],
                ]),
                const SizedBox(height: 4),
                Text(t('ch.help.$id'), style: TextStyle(fontSize: 14, height: 1.5, color: AppColors.mutedForeground)),
              ])),
            ])),
          if (kind == 'badges') for (final stage in kJourneyStages)
            Padding(padding: const EdgeInsets.only(bottom: 12), child: Row(children: [
              Container(width: 40, height: 40, alignment: Alignment.center,
                decoration: BoxDecoration(shape: BoxShape.circle, color: AppColors.primary.withValues(alpha: 0.1)),
                child: Text('${stage.$3}', style: TextStyle(fontWeight: FontWeight.w700, color: AppColors.primary))),
              const SizedBox(width: 12),
              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                Text(t('ch.stage.${stage.$1}'), style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: AppColors.foreground)),
                Text(t('ch.stage.range', {'from': stage.$2, 'to': stage.$3}), style: TextStyle(fontSize: 14, color: AppColors.mutedForeground)),
              ])),
            ])),
        ])),
    );
  }
}
