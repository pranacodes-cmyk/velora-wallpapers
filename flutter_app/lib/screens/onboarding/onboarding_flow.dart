import '../../core/services/telemetry.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/meta_events.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../state/app_providers.dart';
import 'bible_slide.dart';
import 'rhythm_slide.dart';
import 'language_slide.dart';
import 'late_slides.dart';
import 'onboarding_motion.dart';
import 'onboarding_shared.dart';
import 'dart:async';
import '../../core/services/daily_reminder_service.dart';
import '../../core/services/prayer_alarm_service.dart';
import 'verse_slide.dart';

/// 1:1 port of the controller in `src/components/onboarding/OnboardingFlow.tsx`.
///
/// Flow: language picker → daily verse → daily prayer → Prayer Lock (Shield
/// story) → guided journeys → social proof (real reviews). Nothing is gated
/// on the last slide.
bool shouldShowOnboarding() => !Prefs.getBool(StorageKeys.onboardingDone);

class OnboardingFlow extends ConsumerStatefulWidget {
  const OnboardingFlow({super.key, required this.onComplete});

  /// Fired when onboarding finishes; the caller owns the trial animation and
  /// paywall handoff, exactly like `PostOnboardingPremium` on web.
  final void Function({required bool replay, String? focus}) onComplete;

  @override
  ConsumerState<OnboardingFlow> createState() => _OnboardingFlowState();
}

class _OnboardingFlowState extends ConsumerState<OnboardingFlow> {
  static const _totalSlides = 5;
  static const _lastStep = _totalSlides - 1;

  bool _langPicked = Prefs.getString(Onb.langPickedKey) != null;
  int _step = 0;
  bool _closing = false;
  bool _navLocked = false;
  bool _forward = true;

  bool get _isFinale => _step >= _lastStep;
  // Nothing to pick any more: the last slide is social proof, so Continue is
  // always live.
  bool get _canAdvance => true;

  @override
  void initState() {
    super.initState();
    _trackStep();
  }

  void _trackStep() {
    Analytics.capture('onboarding_step_viewed', {'step': _step});
    Telemetry.screen('onboarding:$_step', kind: 'onboarding');
  }

  void _lockNav() {
    _navLocked = true;
    Future.delayed(Onb.navLock, () => _navLocked = false);
  }

  void _advance() {
    if (_navLocked || _closing) return;
    if (!_canAdvance) {
      haptic(HapticStyle.soft);
      return;
    }
    if (_step < _lastStep) {
      if (_step == 2) {
        // Rhythm choice (Morning / Evening / Both) is the alarm opt-in.
        final slot = DailyReminder.slots;
        final times = <PrayerTime>[
          if (slot != 'evening') const PrayerTime(hour: 7, minute: 0, label: 'Morning Prayer'),
          if (slot != 'morning') const PrayerTime(hour: 21, minute: 0, label: 'Evening Prayer'),
        ];
        unawaited(PrayerAlarms.enable(times: times, soundEnabled: true).catchError((_) {}));
      }
      _lockNav();
      setState(() {
        _forward = true;
        _step++;
      });
      _trackStep();
      haptic(HapticStyle.soft);
    }
  }

  void _goBack() {
    if (_navLocked || _closing) return;
    if (_step == 0) {
      setState(() => _langPicked = false);
      haptic(HapticStyle.soft);
      return;
    }
    _lockNav();
    setState(() {
      _forward = false;
      _step = _step - 1 < 0 ? 0 : _step - 1;
    });
    _trackStep();
    haptic(HapticStyle.soft);
  }

  Future<void> _finish([String? focusOverride]) async {
    if (_closing) return;
    if (!_canAdvance && focusOverride == null) {
      haptic(HapticStyle.soft);
      return;
    }
    haptic(HapticStyle.medium);
    setState(() => _closing = true);

    await Prefs.setBool(StorageKeys.onboardingDone, true);
    await Prefs.setString(
      StorageKeys.onboardingDoneAt,
      DateTime.now().millisecondsSinceEpoch.toString(),
    );

    final chosen = focusOverride;
    Analytics.capture('onboarding_completed', {'focus': chosen ?? ''});
    MetaEvents.completeRegistration();
    await ref.read(onboardingDoneProvider.notifier).complete();

    final replay = Prefs.getString(StorageKeys.onboardingReplay) == '1';
    await Prefs.remove(StorageKeys.onboardingReplay);
    widget.onComplete(replay: replay, focus: chosen);
  }

  void _onHorizontalDragEnd(DragEndDetails d) {
    final v = d.primaryVelocity ?? 0;
    if (v < -250) {
      if (_isFinale) {
        _finish();
      } else {
        _advance();
      }
    } else if (v > 250) {
      _goBack();
    }
  }

  Widget _slide() {
    switch (_step) {
      case 0:
        return const VerseSlide();
      case 1:
        return const PrayerSlide();
      case 2:
        return const RhythmSlide();
      case 3:
        return const BibleSlide();
      default:
        return const SocialProofSlide();
    }
  }

  @override
  Widget build(BuildContext context) {
    // Hardware back inside onboarding must walk the story backwards, never
    // close the app (web does the same with its own back handler). On the
    // language picker — the very first screen — back is simply ignored.
    if (!_langPicked) {
      return PopScope(
        canPop: false,
        child: LanguageSlide(onDone: () => setState(() => _langPicked = true)),
      );
    }

    final bottomInset = MediaQuery.paddingOf(context).bottom;
    final topInset = MediaQuery.paddingOf(context).top;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _goBack();
      },
      child: ColoredBox(
        color: Onb.canvas,
        child: GestureDetector(
          onHorizontalDragEnd: _onHorizontalDragEnd,
          behavior: HitTestBehavior.translucent,
          child: Stack(
            children: [
              Positioned.fill(
                child: AnimatedSwitcher(
                  duration: OnbMotion.slide,
                  reverseDuration: const Duration(milliseconds: 240),
                  transitionBuilder: (child, animation) =>
                      onbSlideTransition(child, animation, forward: _forward),
                  layoutBuilder: (current, previous) => Stack(
                    fit: StackFit.expand,
                    children: [...previous, if (current != null) current],
                  ),
                  child: RepaintBoundary(key: ValueKey(_step), child: _slide()),
                ),
              ),

              // Bottom CTA
              if (!_closing)
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 0,
                  child: Container(
                    padding: EdgeInsets.fromLTRB(
                      32,
                      16,
                      32,
                      bottomInset > 28 ? bottomInset : 28,
                    ),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Onb.canvas.withValues(alpha: 0),
                          Onb.canvas.withValues(alpha: 0.6),
                          Onb.canvas,
                        ],
                        stops: const [0, 0.4, 1],
                      ),
                    ),
                    child: Column(
                      children: [
                        Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 360),
                            child: OnbPressable(
                              onTap: _isFinale ? () => _finish() : _advance,
                              child: AnimatedOpacity(
                                duration: const Duration(milliseconds: 260),
                                opacity: _canAdvance ? 1 : 0.6,
                                // No shimmer sweep on the CTA (plain gold).
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 320),
                                  curve: Curves.easeOut,
                                  width: double.infinity,
                                  height: 56,
                                  alignment: Alignment.center,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(999),
                                    gradient: LinearGradient(
                                      begin: const Alignment(-1, -0.3),
                                      end: const Alignment(1, 0.3),
                                      colors: _canAdvance
                                          ? const [
                                              Color(0xFFE3A91E),
                                              Color(0xFFFFC04D),
                                              Color(0xFFE3A91E),
                                            ]
                                          : [
                                              onbTone(224, 22, 23),
                                              onbTone(224, 24, 19),
                                            ],
                                    ),
                                    boxShadow: _canAdvance
                                        ? [
                                            BoxShadow(
                                              color: const Color(
                                                0xFFC98A0A,
                                              ).withValues(alpha: 0.45),
                                              blurRadius: 24,
                                              spreadRadius: -6,
                                              offset: const Offset(0, 10),
                                            ),
                                          ]
                                        : [
                                            BoxShadow(
                                              color: Onb.shade(0.4),
                                              blurRadius: 12,
                                              spreadRadius: -4,
                                              offset: const Offset(0, 4),
                                            ),
                                          ],
                                  ),
                                  child: ClipRRect(
                                    borderRadius: BorderRadius.circular(999),
                                    child: Stack(
                                      alignment: Alignment.center,
                                      children: [
                                        // Single diagonal light sheen across
                                        // the gold — polished, not embossed.
                                        if (_canAdvance)
                                          Positioned.fill(
                                            child: DecoratedBox(
                                              decoration: BoxDecoration(
                                                gradient: LinearGradient(
                                                  begin: const Alignment(
                                                    -1,
                                                    -1,
                                                  ),
                                                  end: const Alignment(.4, 1),
                                                  colors: [
                                                    Colors.white.withValues(
                                                      alpha: .26,
                                                    ),
                                                    Colors.white.withValues(
                                                      alpha: .04,
                                                    ),
                                                    Colors.transparent,
                                                  ],
                                                  stops: const [0, .42, .7],
                                                ),
                                              ),
                                            ),
                                          ),
                                        Text(
                                          _isFinale
                                              ? t('onb.cta.begin')
                                              : t('onb.cta.continue'),
                                          style: TextStyle(
                                            fontSize: 15.5,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.6,
                                            color: _canAdvance
                                                ? Onb.ctaText
                                                : onbTone(40, 8, 61),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: 12),
                        Opacity(
                          opacity: 0.4,
                          child: Text(
                            (_isFinale
                                    ? t('onb.cta.tapToEnter')
                                    : t('onb.cta.swipeOrTap'))
                                .toUpperCase(),
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              letterSpacing: 3,
                              color: onbTone(40, 12, 69),
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
      ),
    );
  }
}
