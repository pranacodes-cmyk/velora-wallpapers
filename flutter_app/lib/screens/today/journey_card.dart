import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/journey_progress_store.dart';
import '../../core/services/user_profile.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/lucide.dart';
import '../../widgets/lucide_cross.dart';
import 'today_shared.dart';
import 'today_ink.dart';

/// 1:1 port of `PersonalizedJourneyCard` in `src/pages/Today.tsx` — the
/// "Chosen for you" headline, gradient title, emoji tile, day-dot ladder and
/// progress footer. The journey dataset loads after first paint, exactly like
/// the web idle-callback import, and the placeholder reserves 360px.
class PersonalizedJourneyCard extends StatefulWidget {
  const PersonalizedJourneyCard({super.key, required this.onOpenJourney});

  final void Function(String journeyId) onOpenJourney;

  @override
  State<PersonalizedJourneyCard> createState() =>
      _PersonalizedJourneyCardState();
}

class _PersonalizedJourneyCardState extends State<PersonalizedJourneyCard> {
  Journey? _journey;

  @override
  void initState() {
    super.initState();
    Future.delayed(const Duration(milliseconds: 300), _load);
  }

  Future<void> _load() async {
    await ContentData.loadDeferred();
    final focus = UserProfile.focus();
    final journey = ContentData.journeyById(UserProfile.focusToJourneyId(focus));
    if (mounted) setState(() => _journey = journey);
  }

  @override
  Widget build(BuildContext context) {
    final journey = _journey;
    if (journey == null) {
      // Reserve the card height so nothing jumps when the data arrives.
      return Container(
        height: 360,
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(24),
          color: AppColors.card,
          border: Border.all(color: TodayInk.glassBorder),
        ),
      );
    }

    final focus = UserProfile.focus() ?? UserFocus.anxiety;
    final completed = JourneyProgressStore.completedDays(journey.id);
    final totalDays = journey.days.length;
    final currentDay = math.min(completed.length + 1, totalDays);
    final progressPct = ((completed.length / totalDays) * 100).round();
    final dayInfo = totalDays >= currentDay
        ? journey.days[currentDay - 1]
        : null;
    final visibleDots = math.min(totalDays, 14);
    final dotStep = totalDays / visibleDots;

    return FadeRise(
      offsetY: 14,
      duration: const Duration(milliseconds: 600),
      child: Container(
        margin: const EdgeInsets.fromLTRB(12, 0, 12, 24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Feature headline
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 0, 4, 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 3,
                    ),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(999),
                      color: TodayInk.primary.withValues(alpha: 0.12),
                      border: Border.all(
                        color: TodayInk.primary.withValues(alpha: 0.35),
                      ),
                    ),
                    child: Text(
                      t('today.journey.chosenForYou').toUpperCase(),
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 10 * 0.22,
                        color: TodayInk.primary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    t('today.journey.titleTop', {'n': totalDays}),
                    style: TextStyle(
                      fontFamily: kSerif,
                      fontFamilyFallback: kSerifFallback,
                      fontWeight: FontWeight.w900,
                      fontSize: 26,
                      height: 1.15,
                      color: AppColors.foreground,
                    ),
                  ),
                  // Gold gradient text (web used background-clip: text).
                  ShaderMask(
                    shaderCallback: (rect) => LinearGradient(
                      colors: [TodayInk.primary, hsl(42, 95, 65)],
                    ).createShader(rect),
                    child: Text(
                      t('today.journey.titleBottom'),
                      style: const TextStyle(
                        fontFamily: kSerif,
                        fontFamilyFallback: kSerifFallback,
                        fontWeight: FontWeight.w900,
                        fontSize: 26,
                        height: 1.15,
                        color: Colors.white,
                      ),
                    ),
                  ),
                  const SizedBox(height: 6),
                  FractionallySizedBox(
                    widthFactor: 0.8,
                    child: Text(
                      t('today.journey.subtitle', {
                        'focus': t('today.journey.focus.${focus.name}'),
                      }),
                      style: TextStyle(
                        fontSize: 13.5,
                        height: 1.5,
                        color: AppColors.mutedForeground,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // The card
            TapScale(
              scale: 0.985,
              onTap: () {
                haptic(HapticStyle.soft);
                Analytics.capture('today_journey_tile_tapped', {
                  'journey_id': journey.id,
                });
                widget.onOpenJourney(journey.id);
              },
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(24),
                  color: AppColors.card,
                  border: Border.all(color: TodayInk.glassBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.6),
                      blurRadius: 36,
                      spreadRadius: -18,
                      offset: const Offset(0, 16),
                    ),
                  ],
                ),
                child: Stack(
                  children: [
                    // Restrained warm highlight; keep the card itself navy.
                    Positioned(
                      top: -80,
                      right: -64,
                      width: 224,
                      height: 224,
                      child: IgnorePointer(
                        child: DecoratedBox(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            gradient: RadialGradient(
                              colors: [
                                TodayInk.primary.withValues(alpha: 0.12),
                                Colors.transparent,
                              ],
                              stops: const [0, 0.65],
                            ),
                          ),
                        ),
                      ),
                    ),
                    // Royal blue glow, bottom-left
                    Positioned(
                      bottom: -96,
                      left: -64,
                      width: 224,
                      height: 224,
                      child: IgnorePointer(
                        child: Opacity(
                          opacity: 0.8,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              gradient: RadialGradient(
                                colors: [
                                  hsl(220, 80, 55, 0.22),
                                  Colors.transparent,
                                ],
                                stops: const [0, 0.65],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                    // Faint cross watermark
                    Positioned(
                      right: 12,
                      bottom: 12,
                      child: IgnorePointer(
                        child: Opacity(
                          opacity: 0.07,
                          child: LucideCross(
                            size: 130,
                            color: TodayInk.primary,
                            strokeWidth: 2,
                          ),
                        ),
                      ),
                    ),

                    Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // Header row
                          Row(
                            children: [
                              Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  Container(
                                    width: 64,
                                    height: 64,
                                    alignment: Alignment.center,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(16),
                                      gradient: RadialGradient(
                                        center: const Alignment(-0.4, -0.6),
                                        radius: 1.2,
                                        colors: [
                                          TodayInk.primary.withValues(
                                            alpha: 0.20,
                                          ),
                                          AppColors.card,
                                        ],
                                        stops: const [0, 0.7],
                                      ),
                                      border: Border.all(
                                        color: TodayInk.primary.withValues(
                                          alpha: 0.55,
                                        ),
                                      ),
                                      boxShadow: [
                                        BoxShadow(
                                          color: TodayInk.primary.withValues(
                                            alpha: 0.22,
                                          ),
                                          blurRadius: 22,
                                          spreadRadius: -10,
                                          offset: const Offset(0, 8),
                                        ),
                                      ],
                                    ),
                                    child: Text(
                                      journey.emoji,
                                      style: const TextStyle(fontSize: 30),
                                    ),
                                  ),
                                  Positioned(
                                    top: -4,
                                    right: -4,
                                    child: Icon(
                                      Icons.star,
                                      size: 14,
                                      color: TodayInk.primary,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      (completed.isEmpty
                                              ? t('today.journey.beginDay1')
                                              : t('today.journey.dayOf', {
                                                  'current': currentDay,
                                                  'total': totalDays,
                                                }))
                                          .toUpperCase(),
                                      style: TextStyle(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.bold,
                                        letterSpacing: 9.5 * 0.24,
                                        color: TodayInk.primary,
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      journey.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 18,
                                        height: 1.2,
                                        fontWeight: FontWeight.w800,
                                        letterSpacing: -0.4,
                                        color: AppColors.foreground,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              Container(
                                width: 32,
                                height: 32,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: TodayInk.primary.withValues(
                                    alpha: 0.18,
                                  ),
                                  border: Border.all(
                                    color: TodayInk.primary.withValues(
                                      alpha: 0.45,
                                    ),
                                  ),
                                ),
                                child: LucideIcon(
                                  'chevron-right',
                                  size: 16,
                                  color: TodayInk.primary,
                                ),
                              ),
                            ],
                          ),

                          // Day-dot ladder
                          const SizedBox(height: 20),
                          Row(
                            children: [
                              for (var i = 0; i < visibleDots; i++)
                                Builder(
                                  builder: (context) {
                                    final dayIndex = (i * dotStep).floor();
                                    final isDone = dayIndex < completed.length;
                                    final isCurrent =
                                        dayIndex == completed.length;
                                    return Expanded(
                                      child: Padding(
                                        padding: EdgeInsets.only(
                                          right: i == visibleDots - 1 ? 0 : 4,
                                        ),
                                        child: Container(
                                          height: 6,
                                          decoration: BoxDecoration(
                                            borderRadius: BorderRadius.circular(
                                              999,
                                            ),
                                            gradient: isDone
                                                ? LinearGradient(
                                                    colors: [
                                                      TodayInk.primary,
                                                      hsl(42, 95, 60),
                                                    ],
                                                  )
                                                : null,
                                            color: isDone
                                                ? null
                                                : TodayInk.primary.withValues(
                                                    alpha: isCurrent
                                                        ? 0.6
                                                        : 0.22,
                                                  ),
                                            boxShadow: isDone
                                                ? [
                                                    BoxShadow(
                                                      color: TodayInk.primary
                                                          .withValues(
                                                            alpha: 0.55,
                                                          ),
                                                      blurRadius: 8,
                                                    ),
                                                  ]
                                                : isCurrent
                                                ? [
                                                    BoxShadow(
                                                      color: TodayInk.primary
                                                          .withValues(
                                                            alpha: 0.45,
                                                          ),
                                                      blurRadius: 6,
                                                    ),
                                                  ]
                                                : null,
                                          ),
                                        ),
                                      ),
                                    );
                                  },
                                ),
                            ],
                          ),

                          // CTA footer
                          const SizedBox(height: 16),
                          Row(
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      completed.isEmpty
                                          ? t('today.journey.startReading')
                                          : t('today.journey.continueReading'),
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 13,
                                        height: 1.2,
                                        fontWeight: FontWeight.bold,
                                        color: AppColors.foreground,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      dayInfo?.title ?? journey.subtitle,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(
                                        fontSize: 11,
                                        color: AppColors.mutedForeground,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                              const SizedBox(width: 12),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 4,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(999),
                                  color: TodayInk.primary.withValues(
                                    alpha: 0.16,
                                  ),
                                  border: Border.all(
                                    color: TodayInk.primary.withValues(
                                      alpha: 0.4,
                                    ),
                                  ),
                                ),
                                child: Text(
                                  '$progressPct%',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.w800,
                                    color: TodayInk.primary,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
