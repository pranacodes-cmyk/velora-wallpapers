import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/daily_funnel.dart';
import '../../core/services/haptics.dart';
import '../../core/services/today_tasks_store.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../core/widgets/outer_shadow.dart';
import 'today_shared.dart';
import 'verse_reflection_sheet.dart';
import 'today_ink.dart';

/// 1:1 port of `src/components/today/TodayChecklist.tsx`:
/// section label + progress ring card + three tappable task rows with the
/// featured "NEXT" row, and the all-done footer.
class TodayChecklist extends ConsumerStatefulWidget {
  const TodayChecklist({
    super.key,
    required this.onOpenDevotional,
    required this.onOpenQuiz,
    required this.onOpenDailyQuiz,
  });

  final VoidCallback onOpenDevotional;
  final VoidCallback onOpenQuiz;
  final VoidCallback onOpenDailyQuiz;

  @override
  ConsumerState<TodayChecklist> createState() => _TodayChecklistState();
}

class _TodayChecklistState extends ConsumerState<TodayChecklist> {
  int _lastReflectionRequest = DailyFunnel.openReflection.value;

  @override
  void initState() {
    super.initState();
    // Direct-open bridge from prayer "Continue" — skip the overlay entirely.
    DailyFunnel.openReflection.addListener(_onReflectionRequested);
    DailyFunnel.revision.addListener(_onHandoffChanged);
    _onReflectionRequested();
    _onHandoffChanged();
  }

  @override
  void dispose() {
    DailyFunnel.openReflection.removeListener(_onReflectionRequested);
    DailyFunnel.revision.removeListener(_onHandoffChanged);
    super.dispose();
  }

  /// 1:1 of the simple (non-animated) parts of `FunnelHandoff.tsx` — the
  /// silent back-exit path stores a handoff step that Today must resolve
  /// into the actual next screen/tab the next time it settles.
  void _onHandoffChanged() {
    if (DailyFunnel.autoOpensSilenced) return;
    final step = DailyFunnel.getHandoff();
    if (step == null) return;
    final tasks = TodayTasksStore.read();
    if (step == HandoffStep.reflection && tasks.reflection) {
      DailyFunnel.clearHandoff();
      return;
    }
    if (step == HandoffStep.quiz && tasks.quiz) {
      DailyFunnel.clearHandoff();
      return;
    }
    DailyFunnel.clearHandoff();
    if (step == HandoffStep.reflection) {
      Future.delayed(const Duration(milliseconds: 60), () {
        if (mounted) _openReflection();
      });
    } else if (step == HandoffStep.quiz) {
      Future.delayed(const Duration(milliseconds: 60), () {
        if (mounted) widget.onOpenDailyQuiz();
      });
    }
  }

  void _onReflectionRequested() {
    final v = DailyFunnel.openReflection.value;
    if (v == 0 || v == _lastReflectionRequest) return;
    _lastReflectionRequest = v;
    if (DailyFunnel.autoOpensSilenced) return;
    // Small beat so the page is settled (web uses a 60ms timeout).
    Future.delayed(const Duration(milliseconds: 60), () {
      if (mounted) _openReflection();
    });
  }

  Future<void> _openReflection() async {
    await showGeneralRoute(context, onContinueToQuiz: widget.onOpenDailyQuiz);
    if (mounted) setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<int>(
      valueListenable: TodayTasksStore.revision,
      builder: (context, _, __) {
        final tasks = TodayTasksStore.read();
        final items = <_Task>[
          _Task(
            id: 'prayer',
            title: t('today.checklist.prayerTitle'),
            hint: tasks.prayer
                ? t('today.checklist.prayerHintDone')
                : t('today.checklist.prayerHint'),
            icon: 'hand-heart',
            done: tasks.prayer,
            onTap: () {
              haptic(HapticStyle.soft);
              widget.onOpenDevotional();
            },
          ),
          _Task(
            id: 'reflection',
            title: t('today.checklist.reflectionTitle'),
            hint: tasks.reflection
                ? t('today.checklist.reflectionHintDone')
                : t('today.checklist.reflectionHint'),
            icon: 'book-open',
            done: tasks.reflection,
            onTap: () {
              haptic(HapticStyle.soft);
              _openReflection();
            },
          ),
          _Task(
            id: 'quiz',
            title: t('today.checklist.quizTitle'),
            hint: tasks.quiz
                ? t('today.checklist.quizHintDone')
                : t('today.checklist.quizHint'),
            icon: 'brain',
            done: tasks.quiz,
            onTap: () {
              haptic(HapticStyle.soft);
              // Daily checklist ka step = daily quiz. Landing page dikhane ke
              // bajaye seedha daily run start hota hai (web: /quiz?auto=daily).
              if (tasks.quiz) {
                widget.onOpenQuiz();
              } else {
                widget.onOpenDailyQuiz();
              }
            },
          ),
        ];
        final firstUndoneIdx = items.indexWhere((e) => !e.done);
        final pct = tasks.doneCount / tasks.total;

        return Padding(
          padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Section label
              Padding(
                padding: const EdgeInsets.only(left: 4, bottom: 12),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      width: 4,
                      height: 18,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        gradient: LinearGradient(
                          begin: Alignment.topCenter,
                          end: Alignment.bottomCenter,
                          colors: [
                            TodayInk.primary,
                            TodayInk.primary.withValues(alpha: 0.5),
                          ],
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: TodayInk.primary.withValues(alpha: 0.7),
                            blurRadius: 14,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            t('today.checklist.sectionLabel').toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              height: 1,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 10 * 0.22,
                              color: TodayInk.primary.withValues(alpha: 0.9),
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            tasks.allDone
                                ? t('today.checklist.allDone')
                                : tasks.doneCount == 0
                                ? t('today.checklist.zeroDone')
                                : t(
                                    (tasks.total - tasks.doneCount) == 1
                                        ? 'today.checklist.stepsLeftOne'
                                        : 'today.checklist.stepsLeftOther',
                                    {'count': tasks.total - tasks.doneCount},
                                  ),
                            style: TextStyle(
                              fontSize: 15,
                              height: 1.25,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.3,
                              color: AppColors.foreground,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Card
              FadeRise(
                duration: const Duration(milliseconds: 450),
                child: Container(
                  clipBehavior: Clip.antiAlias,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(26),
                    border: Border.all(
                      color: TodayInk.primary.withValues(alpha: 0.16),
                    ),
                    color: AppColors.card,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.isLight
                            ? TodayInk.primary.withValues(alpha: 0.10)
                            : Colors.black.withValues(alpha: 0.7),
                        blurRadius: AppColors.isLight ? 30 : 22,
                        spreadRadius: -16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Stack(
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Hero row — progress ring + headline
                          Padding(
                            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
                            child: Row(
                              children: [
                                _ProgressRing(
                                  percent: pct,
                                  done: tasks.doneCount,
                                  total: tasks.total,
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        (tasks.allDone
                                                ? t(
                                                    'today.checklist.streakProtected',
                                                  )
                                                : t(
                                                    'today.checklist.dailyDevotion',
                                                  ))
                                            .toUpperCase(),
                                        style: TextStyle(
                                          fontSize: 11,
                                          height: 1,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 11 * 0.16,
                                          color: TodayInk.primary.withValues(
                                            alpha: 0.85,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 6),
                                      Text(
                                        tasks.allDone
                                            ? t('today.checklist.allDoneSafe')
                                            : t('today.checklist.finishAll'),
                                        style: TextStyle(
                                          fontSize: 13,
                                          height: 1.375,
                                          fontWeight: FontWeight.w600,
                                          color: AppColors.foreground
                                              .withValues(alpha: 0.7),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Task rows
                          Padding(
                            padding: const EdgeInsets.fromLTRB(10, 0, 10, 10),
                            child: Column(
                              children: [
                                for (var i = 0; i < items.length; i++)
                                  Padding(
                                    padding: EdgeInsets.only(
                                      bottom: i == items.length - 1 ? 0 : 6,
                                    ),
                                    child: FadeRise(
                                      offsetY: 6,
                                      delay: Duration(
                                        milliseconds: 80 + i * 60,
                                      ),
                                      duration: const Duration(
                                        milliseconds: 320,
                                      ),
                                      child: _TaskRow(
                                        task: items[i],
                                        isNext: i == firstUndoneIdx,
                                      ),
                                    ),
                                  ),
                              ],
                            ),
                          ),

                          if (tasks.allDone)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  LucideIcon(
                                    'check',
                                    size: 14,
                                    color: TodayInk.primary,
                                  ),
                                  const SizedBox(width: 6),
                                  Text(
                                    t('today.checklist.allDoneFooter'),
                                    style: TextStyle(
                                      fontSize: 11.5,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.2,
                                      color: TodayInk.primary,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _Task {
  const _Task({
    required this.id,
    required this.title,
    required this.hint,
    required this.icon,
    required this.done,
    required this.onTap,
  });

  final String id;
  final String title;
  final String hint;
  final String icon;
  final bool done;
  final VoidCallback onTap;
}

class _TaskRow extends StatelessWidget {
  const _TaskRow({required this.task, required this.isNext});

  final _Task task;
  final bool isNext;

  @override
  Widget build(BuildContext context) {
    return TapScale(
      onTap: task.onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          // Web renders this row as translucent glass with a thin gold outline;
          // strong gold gradients/shadows turned the whole row mustard on AMOLED.
          gradient: isNext
              ? LinearGradient(
                  begin: const Alignment(-1, -1),
                  end: const Alignment(1, 1),
                  colors: [
                    gold.withValues(alpha: 0.05),
                    gold.withValues(alpha: 0.012),
                  ],
                )
              : null,
          color: isNext
              ? null
              : task.done
              ? Colors.transparent
              : AppColors.foreground.withValues(alpha: 0.025),
          border: Border.all(
            color: isNext ? gold.withValues(alpha: 0.30) : Colors.transparent,
          ),
          boxShadow: isNext
              ? [
                  BoxShadow(
                    color: AppColors.isLight
                        ? gold.withValues(alpha: 0.12)
                        : Colors.black.withValues(alpha: 0.5),
                    blurRadius: 18,
                    spreadRadius: -12,
                    offset: const Offset(0, 8),
                  ),
                ]
              : null,
        ),
        child: Row(
          children: [
            // Gold icon tile
            OuterShadow(
              borderRadius: BorderRadius.circular(14),
              // Glow stays outside the tile: the isNext tile fill is
              // translucent, so an inner boxShadow would tint it mustard.
              shadows: isNext && !task.done
                  ? [
                      BoxShadow(
                        color: gold.withValues(alpha: 0.3),
                        blurRadius: 14,
                      ),
                    ]
                  : const [],
              child: Container(
                width: 44,
                height: 44,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(14),
                  gradient: LinearGradient(
                    begin: const Alignment(-1, -1),
                    end: const Alignment(1, 1),
                    colors: task.done
                        ? [gold, gold.withValues(alpha: 0.78)]
                        : isNext
                        ? [
                            gold.withValues(alpha: 0.28),
                            gold.withValues(alpha: 0.10),
                          ]
                        : [
                            gold.withValues(alpha: 0.14),
                            gold.withValues(alpha: 0.05),
                          ],
                  ),
                  border: Border.all(
                    color: gold.withValues(
                      alpha: task.done
                          ? 0.7
                          : isNext
                          ? 0.5
                          : 0.25,
                    ),
                  ),
                  boxShadow: task.done
                      ? [
                          BoxShadow(
                            color: gold.withValues(alpha: 0.7),
                            blurRadius: 18,
                            spreadRadius: -10,
                            offset: const Offset(0, 8),
                          ),
                        ]
                      : null,
                ),
                child: task.done
                    ? Icon(Icons.check, size: 20, color: ink)
                    : LucideIcon(task.icon, size: 20, color: gold),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          task.title,
                          style: TextStyle(
                            fontSize: 14.5,
                            height: 1.2,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                            color: task.done
                                ? AppColors.foreground.withValues(alpha: 0.5)
                                : AppColors.foreground,
                            decoration: task.done
                                ? TextDecoration.lineThrough
                                : TextDecoration.none,
                            decorationColor: AppColors.foreground.withValues(
                              alpha: 0.35,
                            ),
                          ),
                        ),
                      ),
                      if (isNext) ...[
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 2,
                          ),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(999),
                            gradient: LinearGradient(
                              begin: const Alignment(-1, -1),
                              end: const Alignment(1, 1),
                              colors: [gold, gold.withValues(alpha: 0.82)],
                            ),
                            border: Border.all(
                              color: gold.withValues(alpha: 0.6),
                            ),
                            boxShadow: [
                              BoxShadow(
                                color: gold.withValues(alpha: 0.6),
                                blurRadius: 12,
                              ),
                            ],
                          ),
                          child: Text(
                            t('today.checklist.next').toUpperCase(),
                            style: TextStyle(
                              fontSize: 9,
                              fontWeight: FontWeight.w900,
                              letterSpacing: 9 * 0.14,
                              color: ink,
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 2),
                  Text(
                    task.hint,
                    style: TextStyle(
                      fontSize: 11.5,
                      height: 1.375,
                      fontWeight: isNext ? FontWeight.w600 : FontWeight.normal,
                      color: isNext
                          ? gold.withValues(alpha: 0.95)
                          : AppColors.foreground.withValues(alpha: 0.5),
                    ),
                  ),
                ],
              ),
            ),
            if (!task.done)
              LucideIcon(
                'chevron-right',
                size: 18,
                color: isNext
                    ? gold
                    : AppColors.foreground.withValues(alpha: 0.35),
              ),
          ],
        ),
      ),
    );
  }
}

class _ProgressRing extends StatelessWidget {
  const _ProgressRing({
    required this.percent,
    required this.done,
    required this.total,
  });

  final double percent;
  final int done;
  final int total;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 56,
      height: 56,
      child: Stack(
        alignment: Alignment.center,
        children: [
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0, end: percent),
            duration: const Duration(milliseconds: 900),
            curve: Curves.easeOut,
            builder: (context, value, _) => SizedBox(
              width: 56,
              height: 56,
              child: CircularProgressIndicator(
                value: value,
                strokeWidth: 5,
                strokeCap: StrokeCap.round,
                backgroundColor: AppColors.foreground.withValues(alpha: 0.08),
                valueColor: AlwaysStoppedAnimation(TodayInk.primary),
              ),
            ),
          ),
          Text.rich(
            TextSpan(
              children: [
                TextSpan(text: '$done'),
                TextSpan(
                  text: '/$total',
                  style: TextStyle(
                    fontWeight: FontWeight.bold,
                    color: AppColors.foreground.withValues(alpha: 0.4),
                  ),
                ),
              ],
            ),
            style: TextStyle(
              fontSize: 14,
              height: 1,
              fontWeight: FontWeight.w900,
              letterSpacing: -0.3,
              color: AppColors.foreground,
            ),
          ),
        ],
      ),
    );
  }
}
