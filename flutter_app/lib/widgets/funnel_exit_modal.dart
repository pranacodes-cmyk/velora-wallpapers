import 'package:flutter/material.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/today_tasks_store.dart';
import '../core/theme/app_colors.dart';

/// 1:1 port of `src/components/today/FunnelExitModal.tsx` — the exit-intent
/// sheet showing the live 3-step plan before the user bails.
Future<void> showFunnelExitModal(
  BuildContext context, {
  required VoidCallback onLeave,
}) {
  return showGeneralDialog(
    context: context,
    barrierDismissible: true,
    barrierLabel: 'funnel-exit',
    barrierColor: Colors.black.withValues(alpha: 0.7),
    transitionDuration: const Duration(milliseconds: 340),
    pageBuilder: (_, _, _) => const SizedBox.shrink(),
    transitionBuilder: (context, anim, _, _) {
      final curved = CurvedAnimation(
        parent: anim,
        curve: const Cubic(0.22, 1, 0.36, 1),
      );
      return Opacity(
        opacity: anim.value,
        child: Transform.translate(
          offset: Offset(0, (1 - curved.value) * 40),
          child: Transform.scale(
            scale: 0.97 + curved.value * 0.03,
            child: _FunnelExitCard(
              onContinue: () => Navigator.of(context).pop(),
              onLeave: () {
                Navigator.of(context).pop();
                onLeave();
              },
            ),
          ),
        ),
      );
    },
  );
}

class _FunnelExitCard extends StatelessWidget {
  const _FunnelExitCard({required this.onContinue, required this.onLeave});

  final VoidCallback onContinue;
  final VoidCallback onLeave;

  @override
  Widget build(BuildContext context) {
    final tasks = TodayTasksStore.read();
    final remaining = tasks.total - tasks.doneCount;
    final steps = <_Step>[
      _Step(
        'prayer',
        'funnel.step.prayer',
        'funnel.step.prayerSub',
        Icons.volunteer_activism_rounded,
        tasks.prayer,
      ),
      _Step(
        'reflection',
        'funnel.step.reflection',
        'funnel.step.reflectionSub',
        Icons.menu_book_rounded,
        tasks.reflection,
      ),
      _Step(
        'quiz',
        'funnel.step.quiz',
        'funnel.step.quizSub',
        Icons.psychology_rounded,
        tasks.quiz,
      ),
    ];
    final nextIndex = steps.indexWhere((s) => !s.done);

    return Material(
      type: MaterialType.transparency,
      child: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 16),
          child: Align(
            alignment: Alignment.bottomCenter,
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 400),
              child: Container(
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: AppColors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.35),
                      blurRadius: 80,
                      offset: const Offset(0, 30),
                    ),
                  ],
                ),
                clipBehavior: Clip.antiAlias,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    // Header
                    Padding(
                      padding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
                      child: Column(
                        children: [
                          Text(
                            remaining == 0
                                ? t('funnel.exit.eyebrowDone')
                                : t('funnel.exit.eyebrow'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 10 * 0.3,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(height: 8),
                          Text(
                            remaining == 0
                                ? t('funnel.exit.titleDone')
                                : remaining == 3
                                ? t('funnel.exit.titleThree')
                                : remaining == 1
                                ? t('funnel.exit.titleOne')
                                : t('funnel.exit.titleN', {'n': '$remaining'}),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 22,
                              height: 1.2,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.22,
                              color: AppColors.foreground,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            t('funnel.exit.sub'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              height: 1.55,
                              color: AppColors.mutedForeground,
                            ),
                          ),
                        ],
                      ),
                    ),

                    // Steps list
                    Padding(
                      padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
                      child: Container(
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.border),
                        ),
                        clipBehavior: Clip.antiAlias,
                        child: Column(
                          children: [
                            for (var i = 0; i < steps.length; i++) ...[
                              if (i > 0)
                                Divider(
                                  height: 1,
                                  thickness: 1,
                                  color: AppColors.border,
                                ),
                              _StepRow(step: steps[i], isNext: i == nextIndex),
                            ],
                          ],
                        ),
                      ),
                    ),

                    // Actions
                    Padding(
                      padding: const EdgeInsets.fromLTRB(20, 4, 20, 20),
                      child: Column(
                        children: [
                          GestureDetector(
                            onTap: onContinue,
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 15),
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(16),
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.primary.withValues(
                                      alpha: 0.55,
                                    ),
                                    blurRadius: 32,
                                    spreadRadius: -10,
                                    offset: const Offset(0, 14),
                                  ),
                                ],
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    remaining == 0
                                        ? t('funnel.exit.close')
                                        : t('funnel.exit.cta'),
                                    style: TextStyle(
                                      fontSize: 15,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: -0.15,
                                      color: AppColors.primaryForeground,
                                    ),
                                  ),
                                  if (remaining > 0) ...[
                                    const SizedBox(width: 8),
                                    Icon(
                                      Icons.arrow_forward_rounded,
                                      size: 18,
                                      color: AppColors.primaryForeground,
                                    ),
                                  ],
                                ],
                              ),
                            ),
                          ),
                          GestureDetector(
                            onTap: onLeave,
                            child: Container(
                              width: double.infinity,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              margin: const EdgeInsets.only(top: 4),
                              color: Colors.transparent,
                              child: Text(
                                t('funnel.exit.later'),
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.mutedForeground,
                                ),
                              ),
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
        ),
      ),
    );
  }
}

class _Step {
  const _Step(this.key, this.labelKey, this.subKey, this.icon, this.done);
  final String key;
  final String labelKey;
  final String subKey;
  final IconData icon;
  final bool done;
}

class _StepRow extends StatelessWidget {
  const _StepRow({required this.step, required this.isNext});

  final _Step step;
  final bool isNext;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              color: step.done
                  ? AppColors.primary
                  : isNext
                  ? AppColors.primary.withValues(alpha: 0.15)
                  : AppColors.muted,
              border: isNext && !step.done
                  ? Border.all(color: AppColors.primary.withValues(alpha: 0.3))
                  : null,
            ),
            child: Icon(
              step.done ? Icons.check_rounded : step.icon,
              size: 18,
              color: step.done
                  ? AppColors.primaryForeground
                  : isNext
                  ? AppColors.primary
                  : AppColors.mutedForeground,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  t(step.labelKey),
                  style: TextStyle(
                    fontSize: 14.5,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.15,
                    color: step.done
                        ? AppColors.mutedForeground
                        : AppColors.foreground,
                    decoration: step.done ? TextDecoration.lineThrough : null,
                  ),
                ),
                Text(
                  step.done ? t('funnel.exit.completed') : t(step.subKey),
                  style: TextStyle(
                    fontSize: 11.5,
                    height: 1.15,
                    color: AppColors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
          if (isNext && !step.done)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                color: AppColors.primary.withValues(alpha: 0.12),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.3),
                ),
              ),
              child: Text(
                t('funnel.exit.next'),
                style: TextStyle(
                  fontSize: 9.5,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 9.5 * 0.22,
                  color: AppColors.primary,
                ),
              ),
            ),
        ],
      ),
    );
  }
}
