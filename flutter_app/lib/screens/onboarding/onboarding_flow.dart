import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../state/app_providers.dart';
import 'journeys_slide.dart';
import 'language_slide.dart';
import 'late_slides.dart';
import 'onboarding_shared.dart';
import 'verse_slide.dart';

/// 1:1 port of the controller in `src/components/onboarding/OnboardingFlow.tsx`.
///
/// Flow: language picker (step 0, own chrome) → 5 slides
/// (0 verse, 1 journeys, 2 prayer, 3 bible chat, 4 focus = last).
/// Focus is gated: Continue stays disabled until a focus is picked, and picking
/// one finishes onboarding after 240ms (one-tap finish, like web).
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
  String? _focusPick;

  bool get _isFinale => _step >= _lastStep;
  bool get _canAdvance => _step == 4 ? _focusPick != null : true;

  @override
  void initState() {
    super.initState();
    _trackStep();
  }

  void _trackStep() =>
      Analytics.capture('onboarding_step_viewed', {'step': _step});

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
      _lockNav();
      setState(() => _step++);
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
    setState(() => _step = _step - 1 < 0 ? 0 : _step - 1);
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

    final chosen = focusOverride ?? _focusPick;
    Analytics.capture('onboarding_completed', {'focus': chosen ?? ''});
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
        return const JourneysSlide();
      case 2:
        return const PrayerSlide();
      case 3:
        return const BibleChatSlide();
      default:
        return FocusSlide(
          picked: _focusPick,
          onPick: (f) {
            if (_closing) return;
            setState(() => _focusPick = f);
            // Mirrors web `setUserFocus(f)`.
            Prefs.setString(StorageKeys.userFocus, f);
            Future.delayed(const Duration(milliseconds: 240), () => _finish(f));
          },
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_langPicked) {
      return LanguageSlide(onDone: () => setState(() => _langPicked = true));
    }

    final bottomInset = MediaQuery.of(context).padding.bottom;
    final topInset = MediaQuery.of(context).padding.top;

    return ColoredBox(
      color: Onb.canvas,
      child: GestureDetector(
        onHorizontalDragEnd: _onHorizontalDragEnd,
        behavior: HitTestBehavior.translucent,
        child: Stack(
          children: [
            Positioned.fill(
              child: AnimatedSwitcher(
                duration: Onb.slideFade,
                switchInCurve: Curves.easeOut,
                switchOutCurve: Curves.easeOut,
                layoutBuilder: (current, previous) =>
                    current ?? const SizedBox.shrink(),
                child: KeyedSubtree(key: ValueKey(_step), child: _slide()),
              ),
            ),

            // Progress dots
            if (!_closing)
              Positioned(
                top: (topInset > 14 ? topInset : 14) + 12,
                left: 0,
                right: 0,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    for (var i = 0; i < _totalSlides; i++)
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 4),
                        child: AnimatedContainer(
                          duration: Onb.inDur,
                          curve: Onb.easeOutExpo,
                          width: i == _step ? 24 : 6,
                          height: 3,
                          decoration: BoxDecoration(
                            color: const Color(
                              0xFFEDBB47,
                            ).withValues(alpha: i == _step ? 1 : 0.35),
                            borderRadius: BorderRadius.circular(999),
                          ),
                        ),
                      ),
                  ],
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
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [
                        Colors.transparent,
                        Color(0x9902060F),
                        Onb.canvas,
                      ],
                      stops: [0, 0.4, 1],
                    ),
                  ),
                  child: Column(
                    children: [
                      Center(
                        child: ConstrainedBox(
                          constraints: const BoxConstraints(maxWidth: 360),
                          child: GestureDetector(
                            onTap: _isFinale ? () => _finish() : _advance,
                            child: Opacity(
                              opacity: _canAdvance ? 1 : 0.6,
                              child: Container(
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
                                        : const [
                                            Color(0xFF2B3345),
                                            Color(0xFF232A39),
                                          ],
                                  ),
                                  boxShadow: _canAdvance
                                      ? const [
                                          BoxShadow(
                                            color: Color(0x80E3A91E),
                                            blurRadius: 32,
                                            spreadRadius: -8,
                                            offset: Offset(0, 12),
                                          ),
                                        ]
                                      : const [
                                          BoxShadow(
                                            color: Color(0x66000000),
                                            blurRadius: 12,
                                            spreadRadius: -4,
                                            offset: Offset(0, 4),
                                          ),
                                        ],
                                ),
                                child: Text(
                                  _isFinale
                                      ? t('onb.cta.begin')
                                      : _canAdvance
                                      ? t('onb.cta.continue')
                                      : (_step == 4
                                            ? t('onb.cta.pickFocus')
                                            : t('onb.cta.continue')),
                                  style: TextStyle(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 0.9,
                                    color: _canAdvance
                                        ? Onb.ctaText
                                        : const Color(0xFF9C948A),
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
                          style: const TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 3,
                            color: Color(0xFFB0A899),
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
    );
  }
}
