import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/services/prefs.dart';
import '../../core/services/revenuecat_service.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import '../../widgets/trial_ready_transition.dart';
import 'onboarding_shared.dart';

/// 1:1 port of `src/components/PostOnboardingPremium.tsx`.
/// Trial transition (3.2s) → Premium sheet mounts beneath it → transition fades
/// (at 3.46s). `SHOWN_KEY` is only written when the user actually dismisses the
/// sheet, so a kill/crash mid-flow retries on the next launch. Premium users
/// see neither the transition nor the paywall — the handoff fires immediately.
const _shownKey = 'cw_post_onboarding_premium_shown';

class PostOnboardingPremium extends ConsumerStatefulWidget {
  const PostOnboardingPremium({super.key, required this.onFinished});

  /// Mounts the home shell — always fires exactly once.
  final VoidCallback onFinished;

  @override
  ConsumerState<PostOnboardingPremium> createState() =>
      _PostOnboardingPremiumState();
}

class _PostOnboardingPremiumState extends ConsumerState<PostOnboardingPremium> {
  bool _showTransition = false;
  bool _showSheet = false;
  bool _handedOff = false;
  final _timers = <Timer>[];

  @override
  void initState() {
    super.initState();
    _start();
  }

  @override
  void dispose() {
    for (final timer in _timers) {
      timer.cancel();
    }
    super.dispose();
  }

  void _handoff() {
    if (_handedOff) return;
    _handedOff = true;
    widget.onFinished();
  }

  void _start() {
    final isPremium = ref.read(premiumProvider);
    final alreadyShown = Prefs.getBool(_shownKey);
    if (isPremium || alreadyShown) {
      _handoff();
      return;
    }
    // Trial off (RevenueCat offering has no free phase): skip the
    // "3 days free" slide and open the paid paywall directly.
    if (!RevenueCatService.trialOffered) {
      setState(() => _showSheet = true);
      return;
    }
    setState(() => _showTransition = true);
    _timers.add(
      Timer(const Duration(milliseconds: 3200), () {
        if (!mounted) return;
        if (ref.read(premiumProvider)) {
          _handoff();
          return;
        }
        setState(() => _showSheet = true);
      }),
    );
    // Let the sheet finish mounting beneath the opaque transition, then reveal
    // it — never a blank frame or two overlapping animations.
    _timers.add(
      Timer(const Duration(milliseconds: 3460), () {
        if (!mounted) return;
        setState(() => _showTransition = false);
      }),
    );
  }

  void _closeSheet() {
    Prefs.setBool(_shownKey, true);
    if (mounted) setState(() => _showSheet = false);
    // Keep the midnight onboarding surface behind the sheet until its exit is
    // fully gone; only then mount the homepage.
    Timer(const Duration(milliseconds: 260), _handoff);
  }

  @override
  Widget build(BuildContext context) {
    // Entitlement can arrive while the last onboarding frame is still mounted
    // (restore, purchase or a CustomerInfo push) — release immediately.
    ref.listen<bool>(premiumProvider, (_, isPremium) {
      if (!isPremium || _showSheet) return;
      setState(() => _showTransition = false);
      _handoff();
    });

    // This paywall is the root route (it replaces onboarding), so the Android
    // hardware back button used to pop the whole app. Back now behaves like
    // the sheet's close button; during the trial transition it is swallowed.
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_showSheet) _closeSheet();
      },
      child: Material(
        color: Onb.canvas,
        child: Stack(
          children: [
            if (_showSheet)
              PremiumSheet(
                trigger: 'post_onboarding',
                onClose: _closeSheet,
                onUnlock: () {},
              ),
            if (_showTransition) const TrialReadyTransition(),
          ],
        ),
      ),
    );
  }
}
