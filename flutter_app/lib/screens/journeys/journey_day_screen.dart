import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/journey_progress_store.dart';
import '../../core/services/journey_narration_audio.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/streak_store.dart';
import '../../core/services/user_profile.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart' show hsl;
import 'journey_guides.dart';

enum _Stage { opening, verse, deeper, checkin }

/// Port of `src/pages/JourneyDay.tsx` — the day-by-day experience.
/// (`RichDayExperience` multi-slide days and the AI reflection sheet are not
/// ported yet; every day falls back to this standard opening/verse/deeper/
/// checkin flow, which is what all non-rich days already use on web.)
class JourneyDayScreen extends ConsumerStatefulWidget {
  const JourneyDayScreen({super.key, required this.journeyId});

  final String journeyId;

  @override
  ConsumerState<JourneyDayScreen> createState() => _JourneyDayScreenState();
}

class _JourneyDayScreenState extends ConsumerState<JourneyDayScreen> {
  late Journey? _journey = ContentData.journeyById(widget.journeyId);
  late int _selectedDay = _initialDay();
  _Stage _stage = _Stage.opening;
  final Set<int> _checked = {};
  bool _premiumOpen = false;

  int _initialDay() {
    final j = ContentData.journeyById(widget.journeyId);
    if (j == null) return 1;
    final completed = JourneyProgressStore.completedDays(j.id);
    if (completed.isEmpty) return 1;
    if (completed.length >= j.days.length) return j.days.length;
    final maxDone = completed.reduce((a, b) => a > b ? a : b);
    return (maxDone + 1).clamp(1, j.days.length);
  }

  bool _isDayLocked(List<int> completed, int d) {
    if (d == 1) return false;
    for (var i = 1; i < d; i++) {
      if (!completed.contains(i)) return true;
    }
    return false;
  }

  void _handleComplete() {
    haptic(HapticStyle.medium);
    final journey = _journey!;
    final wasFirst = !JourneyProgressStore.completedDays(
      journey.id,
    ).contains(_selectedDay);
    if (wasFirst) {
      JourneyProgressStore.completeDay(journey.id, _selectedDay);
      Analytics.capture('journey_day_completed', {
        'journey_id': journey.id,
        'day': _selectedDay,
        'total_days': journey.days.length,
      });
      // Happy moment → rating ask, same 6s delay as `useJourneyProgress.ts`.
      Future.delayed(
        const Duration(milliseconds: 6000),
        RatingService.maybeRequestRating,
      );
    }
    setState(() => _stage = _Stage.checkin);

    final isPremium = ref.read(premiumProvider);
    if (!isPremium) AdsService.primeInterstitial();
    if (wasFirst && _selectedDay == 1 && !isPremium) {
      Future.delayed(const Duration(milliseconds: 900), () {
        AdsService.showInterstitial();
      });
    }
    if (wasFirst && !isPremium) {
      Future.delayed(const Duration(milliseconds: 1600), () {
        if (mounted) setState(() => _premiumOpen = true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final journey = _journey;
    final isPremium = ref.watch(premiumProvider);

    if (journey == null) {
      return Scaffold(
        body: Center(
          child: TextButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: Text(t('jn.day.notFound')),
          ),
        ),
      );
    }

    // Premium-only journeys bounce non-premium users back.
    final journeyFree = UserProfile.isJourneyFreeForUser(
      journey.id,
      journey.isPremium,
    );
    if (!isPremium && !journeyFree) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AppToast.error(context, t('jn.toast.premiumReq'));
        Navigator.of(context).maybePop();
      });
      return const SizedBox.shrink();
    }

    if (JourneyProgressStore.isPremiumJourneyDay(_selectedDay, isPremium)) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        AppToast.error(
          context,
          t('jn.toast.dayPremiumReq', {'day': _selectedDay}),
        );
        Navigator.of(context).maybePop();
      });
      return const SizedBox.shrink();
    }

    final totalDays = journey.days.length;
    final dayData = journey.days.firstWhere(
      (d) => d.day == _selectedDay,
      orElse: () => journey.days.first,
    );
    final completedDays = JourneyProgressStore.completedDays(journey.id);
    final isCompleted = completedDays.contains(_selectedDay);
    final hue = journey.hue;
    final guide = getJourneyDayGuide(journey.id, _selectedDay, dayData.title);

    return Scaffold(
      backgroundColor: hsl(222, 30, 5),
      body: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.topLeft,
            radius: 1.4,
            colors: [hsl(hue, 60, 22, 0.55), Colors.transparent],
            stops: const [0, 0.55],
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _RoundButton(
                      icon: Icons.chevron_left,
                      onTap: () {
                        haptic(HapticStyle.soft);
                        Navigator.of(context).maybePop();
                      },
                    ),
                    Text(
                      '${journey.emoji} ${journey.title}',
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 9 * 0.15,
                        color: Colors.white.withValues(alpha: 0.5),
                      ),
                    ),
                    const SizedBox(width: 40),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: journey.days.map((d) {
                    final done = completedDays.contains(d.day);
                    final active = d.day == _selectedDay;
                    final locked = _isDayLocked(completedDays, d.day);
                    return GestureDetector(
                      onTap: () {
                        if (locked) {
                          haptic(HapticStyle.light);
                          AppToast.error(
                            context,
                            t('jn.toast.completePrevious', {'n': d.day - 1}),
                          );
                          return;
                        }
                        haptic(HapticStyle.soft);
                        setState(() {
                          _selectedDay = d.day;
                          _stage = _Stage.opening;
                          _checked.clear();
                        });
                      },
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: active ? 28 : 8,
                        height: 8,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: done
                              ? hsl(hue, 75, 60)
                              : active
                              ? hsl(hue, 70, 55, 0.6)
                              : locked
                              ? Colors.white.withValues(alpha: 0.08)
                              : Colors.white.withValues(alpha: 0.18),
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ),
              Expanded(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                  child: _buildStage(
                    context,
                    hue,
                    dayData,
                    guide,
                    isCompleted,
                    totalDays,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      bottomSheet: _premiumOpen
          ? PremiumSheet(
              trigger: 'journey_day_${_selectedDay}_complete',
              journeyTitle: journey.title,
              day: _selectedDay,
              totalDays: totalDays,
              onClose: () => setState(() => _premiumOpen = false),
              onUnlock: () {
                ref.read(premiumProvider.notifier).setUnlocked();
                setState(() => _premiumOpen = false);
              },
            )
          : null,
    );
  }

  Widget _buildStage(
    BuildContext context,
    double hue,
    JourneyDay dayData,
    JourneyDayGuide guide,
    bool isCompleted,
    int totalDays,
  ) {
    switch (_stage) {
      case _Stage.opening:
        return _OpeningStage(
          journeyId: widget.journeyId,
          hue: hue,
          day: _selectedDay,
          dayData: dayData,
          onBegin: () {
            haptic(HapticStyle.medium);
            setState(() => _stage = _Stage.verse);
          },
        );
      case _Stage.verse:
        return _VerseStage(
          hue: hue,
          dayData: dayData,
          guide: guide,
          onContinue: () {
            haptic(HapticStyle.medium);
            setState(() => _stage = _Stage.deeper);
          },
        );
      case _Stage.deeper:
        return _DeeperStage(
          hue: hue,
          day: _selectedDay,
          totalDays: totalDays,
          dayData: dayData,
          guide: guide,
          checked: _checked,
          onToggle: (i) {
            haptic(HapticStyle.soft);
            setState(() {
              if (!_checked.remove(i)) _checked.add(i);
            });
          },
          onComplete: _handleComplete,
        );
      case _Stage.checkin:
        return _CheckinStage(
          hue: hue,
          day: _selectedDay,
          totalDays: totalDays,
          onContinue: () {
            haptic(HapticStyle.soft);
            AppToast.success(
              context,
              t('jn.day.nextWaiting', {'day': _selectedDay + 1}),
            );
            Navigator.of(context).maybePop();
          },
          onFinish: () => Navigator.of(context).maybePop(),
        );
    }
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.06),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Icon(icon, color: Colors.white, size: 20),
      ),
    );
  }
}

class _OpeningStage extends StatelessWidget {
  const _OpeningStage({
    required this.journeyId,
    required this.hue,
    required this.day,
    required this.dayData,
    required this.onBegin,
  });
  final String journeyId;
  final double hue;
  final int day;
  final JourneyDay dayData;
  final VoidCallback onBegin;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 24),
        Text(
          t('jn.day.badge', {'day': day}),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 10 * 0.3,
            color: hsl(hue, 75, 72),
          ),
        ),
        const SizedBox(height: 12),
        _JourneyNarrationButton(journeyId: journeyId, day: day, hue: hue),
        const SizedBox(height: 12),
        Text(
          dayData.title,
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 30,
            fontWeight: FontWeight.w800,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 24),
        Container(width: 80, height: 1, color: hsl(hue, 80, 65, 0.7)),
        const SizedBox(height: 24),
        Text(
          dayData.opening,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 17,
            height: 1.5,
            fontWeight: FontWeight.w500,
            color: Colors.white.withValues(alpha: 0.9),
          ),
        ),
        const SizedBox(height: 32),
        _PrimaryButton(
          hue: hue,
          label: t('jn.day.beginBtn', {'day': day}),
          icon: Icons.arrow_forward,
          onTap: onBegin,
        ),
      ],
    );
  }
}

class _VerseStage extends StatelessWidget {
  const _VerseStage({
    required this.hue,
    required this.dayData,
    required this.guide,
    required this.onContinue,
  });
  final double hue;
  final JourneyDay dayData;
  final JourneyDayGuide guide;
  final VoidCallback onContinue;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          t('jn.day.versePart'),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 10 * 0.28,
            color: hsl(hue, 75, 72),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [hsl(hue, 45, 12), hsl(hue, 55, 8)],
            ),
            borderRadius: BorderRadius.circular(24),
            border: Border.all(color: hsl(hue, 70, 55, 0.35)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                dayData.verse,
                style: const TextStyle(
                  fontSize: 18,
                  height: 1.6,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                '— ${dayData.reference}',
                style: TextStyle(
                  fontSize: 12.5,
                  fontWeight: FontWeight.w800,
                  color: hsl(hue, 80, 75),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        Text(
          t('jn.day.meaningLabel'),
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 10 * 0.2,
            color: Colors.white.withValues(alpha: 0.55),
          ),
        ),
        const SizedBox(height: 10),
        Text(
          dayData.explanation,
          style: const TextStyle(
            fontSize: 15.5,
            height: 1.7,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 12),
        Text(
          guide.meditation,
          style: TextStyle(
            fontSize: 15,
            height: 1.75,
            color: Colors.white.withValues(alpha: 0.85),
          ),
        ),
        const SizedBox(height: 26),
        _PrimaryButton(
          hue: hue,
          label: t('jn.day.continueBtn'),
          icon: Icons.arrow_forward,
          onTap: onContinue,
        ),
      ],
    );
  }
}

class _DeeperStage extends StatelessWidget {
  const _DeeperStage({
    required this.hue,
    required this.day,
    required this.totalDays,
    required this.dayData,
    required this.guide,
    required this.checked,
    required this.onToggle,
    required this.onComplete,
  });
  final double hue;
  final int day;
  final int totalDays;
  final JourneyDay dayData;
  final JourneyDayGuide guide;
  final Set<int> checked;
  final void Function(int) onToggle;
  final VoidCallback onComplete;

  @override
  Widget build(BuildContext context) {
    final tasks = [
      guide.practice,
      t('jn.day.breathTask', {'prayer': guide.breathPrayer}),
      t('jn.day.comeBackTask', {'day': (day + 1).clamp(1, totalDays)}),
    ];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          t('jn.day.part2'),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            letterSpacing: 10 * 0.28,
            color: hsl(hue, 75, 72),
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: hsl(hue, 50, 14, 0.55),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: hsl(hue, 70, 58, 0.28)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('jn.day.pause'),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 10 * 0.2,
                  color: hsl(hue, 80, 75),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                guide.reflection,
                style: const TextStyle(
                  fontSize: 15.5,
                  height: 1.65,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 14),
              Text(
                guide.breathPrayer,
                style: TextStyle(
                  fontSize: 14.5,
                  height: 1.6,
                  fontStyle: FontStyle.italic,
                  color: Colors.white.withValues(alpha: 0.8),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [hsl(hue, 45, 12), hsl(hue, 55, 8)],
            ),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: hsl(hue, 70, 55, 0.3)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('jn.day.prayer'),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 10 * 0.2,
                  color: hsl(hue, 80, 75),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                dayData.prayer,
                style: TextStyle(
                  fontSize: 15.5,
                  height: 1.65,
                  fontStyle: FontStyle.italic,
                  color: Colors.white.withValues(alpha: 0.95),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.05),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                t('jn.day.doToday'),
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 10 * 0.2,
                  color: Colors.white.withValues(alpha: 0.55),
                ),
              ),
              const SizedBox(height: 10),
              for (var i = 0; i < tasks.length; i++)
                GestureDetector(
                  onTap: () => onToggle(i),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: checked.contains(i)
                          ? hsl(hue, 60, 45, 0.15)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Container(
                          width: 20,
                          height: 20,
                          margin: const EdgeInsets.only(top: 2),
                          decoration: BoxDecoration(
                            color: checked.contains(i)
                                ? hsl(hue, 75, 55)
                                : Colors.transparent,
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: checked.contains(i)
                                  ? hsl(hue, 75, 55)
                                  : Colors.white.withValues(alpha: 0.3),
                              width: 1.5,
                            ),
                          ),
                          child: checked.contains(i)
                              ? const Icon(
                                  Icons.check,
                                  size: 14,
                                  color: Colors.white,
                                )
                              : null,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Text(
                            tasks[i],
                            style: TextStyle(
                              fontSize: 14.5,
                              height: 1.5,
                              color: checked.contains(i)
                                  ? Colors.white.withValues(alpha: 0.55)
                                  : Colors.white.withValues(alpha: 0.92),
                              decoration: checked.contains(i)
                                  ? TextDecoration.lineThrough
                                  : null,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
        const SizedBox(height: 22),
        _PrimaryButton(
          hue: hue,
          label: t('jn.day.completeBtn', {'day': day}),
          icon: Icons.check,
          onTap: onComplete,
        ),
      ],
    );
  }
}

class _CheckinStage extends StatelessWidget {
  const _CheckinStage({
    required this.hue,
    required this.day,
    required this.totalDays,
    required this.onContinue,
    required this.onFinish,
  });
  final double hue;
  final int day;
  final int totalDays;
  final VoidCallback onContinue;
  final VoidCallback onFinish;

  @override
  Widget build(BuildContext context) {
    final isLast = day >= totalDays;
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        const SizedBox(height: 20),
        Text(
          t('jn.day.checkin.title'),
          style: const TextStyle(
            fontSize: 24,
            fontWeight: FontWeight.w800,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          t('jn.day.checkin.subtitle'),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: 14,
            color: Colors.white.withValues(alpha: 0.7),
          ),
        ),
        const SizedBox(height: 24),
        Text(
          t('jn.day.dayComplete', {'day': day}),
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: hsl(hue, 80, 75),
          ),
        ),
        const SizedBox(height: 28),
        if (!isLast)
          _PrimaryButton(
            hue: hue,
            label: t('jn.day.checkin.doneBtn'),
            icon: Icons.chevron_right,
            onTap: onContinue,
          )
        else ...[
          Text(
            t('jn.day.finished'),
            style: const TextStyle(fontSize: 14, color: Colors.white),
          ),
          const SizedBox(height: 4),
          Text(
            t('jn.day.carryIt'),
            style: TextStyle(
              fontSize: 12,
              color: Colors.white.withValues(alpha: 0.55),
            ),
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: onFinish,
            child: Text(t('jn.day.backToJourneys')),
          ),
        ],
      ],
    );
  }
}

class _PrimaryButton extends StatelessWidget {
  const _PrimaryButton({
    required this.hue,
    required this.label,
    required this.icon,
    required this.onTap,
  });
  final double hue;
  final String label;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onTap,
        style: ElevatedButton.styleFrom(
          backgroundColor: hsl(hue, 70, 55),
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(20),
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              label,
              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w800),
            ),
            const SizedBox(width: 8),
            Icon(icon, size: 16),
          ],
        ),
      ),
    );
  }
}

class _JourneyNarrationButton extends StatefulWidget {
  const _JourneyNarrationButton({
    required this.journeyId,
    required this.day,
    required this.hue,
  });

  final String journeyId;
  final int day;
  final double hue;

  @override
  State<_JourneyNarrationButton> createState() =>
      _JourneyNarrationButtonState();
}

class _JourneyNarrationButtonState extends State<_JourneyNarrationButton> {
  String? _url;
  AudioPlayer? _player;
  bool _loading = true;
  bool _playing = false;
  double _progress = 0;
  final _subs = <StreamSubscription<dynamic>>[];

  @override
  void initState() {
    super.initState();
    _resolve();
  }

  @override
  void didUpdateWidget(covariant _JourneyNarrationButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.journeyId != widget.journeyId ||
        oldWidget.day != widget.day) {
      _disposePlayer();
      setState(() {
        _url = null;
        _loading = true;
        _playing = false;
        _progress = 0;
      });
      _resolve();
    }
  }

  @override
  void dispose() {
    _disposePlayer();
    super.dispose();
  }

  void _disposePlayer() {
    for (final s in _subs) {
      s.cancel();
    }
    _subs.clear();
    _player?.dispose();
    _player = null;
  }

  Future<void> _resolve() async {
    final url = await JourneyNarrationAudio.resolve(
      widget.journeyId,
      widget.day,
    );
    if (!mounted) return;
    setState(() {
      _url = url;
      _loading = false;
    });
  }

  AudioPlayer _ensurePlayer(String url) {
    final existing = _player;
    if (existing != null) return existing;
    final p = AudioPlayer();
    _subs.add(
      p.positionStream.listen((pos) {
        final d = p.duration;
        if (d != null && d.inMilliseconds > 0 && mounted) {
          setState(() => _progress = pos.inMilliseconds / d.inMilliseconds);
        }
      }),
    );
    _subs.add(
      p.playerStateStream.listen((state) {
        if (!mounted) return;
        setState(() {
          _playing =
              state.playing &&
              state.processingState != ProcessingState.completed;
          if (state.processingState == ProcessingState.completed) _progress = 1;
        });
      }),
    );
    p.setUrl(url).catchError((_) => null);
    _player = p;
    return p;
  }

  Future<void> _toggle() async {
    final url = _url;
    if (url == null) return;
    haptic(HapticStyle.soft);
    final p = _ensurePlayer(url);
    if (_playing) {
      await p.pause();
    } else {
      await p.play().catchError((_) {});
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return SizedBox(
        width: 26,
        height: 26,
        child: CircularProgressIndicator(
          strokeWidth: 2,
          color: hsl(widget.hue, 75, 68),
        ),
      );
    }
    if (_url == null) return const SizedBox.shrink();
    return GestureDetector(
      onTap: _toggle,
      child: Container(
        height: 40,
        constraints: const BoxConstraints(maxWidth: 150),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          color: Colors.white.withValues(alpha: 0.07),
          border: Border.all(color: Colors.white.withValues(alpha: 0.12)),
        ),
        clipBehavior: Clip.antiAlias,
        child: Stack(
          children: [
            FractionallySizedBox(
              widthFactor: _progress.clamp(0, 1).toDouble(),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      hsl(widget.hue, 70, 55, 0.28),
                      hsl(widget.hue, 80, 65, 0.14),
                    ],
                  ),
                ),
              ),
            ),
            Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 28,
                    height: 28,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: LinearGradient(
                        colors: [
                          hsl(widget.hue, 75, 60),
                          hsl(widget.hue, 80, 48),
                        ],
                      ),
                    ),
                    child: Icon(
                      _playing ? Icons.pause : Icons.play_arrow,
                      size: 16,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    _playing
                        ? t('jn.narration.listening')
                        : t('jn.narration.listen'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
