import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:in_app_review/in_app_review.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../widgets/rating_prompt_dialog.dart';
import 'analytics.dart';
import 'ios_platform.dart';
import 'prefs.dart';

/// 1:1 port of `src/services/rating.ts` — daily-aggressive, 2-step,
/// Jesus-toned Play Store rating gate. Same storage keys, same constants,
/// same throttling/eligibility rules, same analytics events.
class RatingService {
  RatingService._();

  static const _keyLastPrompt = 'jw_rating_last_prompt';
  static const _keyRated = 'jw_rating_done';
  static const _keyOptOut = 'jw_rating_opt_out';
  static const _keyNativeAttempts = 'jw_rating_native_attempts';
  static const _keyDismissCount = 'jw_rating_dismiss_count';
  static const _keyLastDismiss = 'jw_rating_last_dismiss';
  static const _keyFeedbackSent = 'jw_rating_feedback_sent';
  static const _keyOptOutMigratedV2 = 'jw_rating_optout_migrated_v2';

  static const _minHoursBetweenPrompts = 6;
  static const _maxPromptsPerSession = 2;
  static const _minMinutesBetweenSessionPrompts = 8;
  static const _maxNativeAttempts = 3;
  static const _maxDismissals = 6;
  static const _hoursAfterDismiss = 12;

  static const _playStoreUrl =
      'https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app';

  static const _hourMs = 60 * 60 * 1000;

  static int _sessionPromptCount = 0;
  static int _lastSessionPromptAt = 0;
  static Timer? _deferTimer;
  static bool _migrated = false;

  /// Global key so the prompt can be shown from non-widget call sites (data
  /// stores, controllers) exactly like the web fires a DOM CustomEvent.
  /// Wired to `MaterialApp(navigatorKey: RatingService.navigatorKey, ...)`.
  static final GlobalKey<NavigatorState> navigatorKey =
      GlobalKey<NavigatorState>();

  static int _num(String key) => Prefs.getInt(key);
  static void _set(String key, int val) => Prefs.setInt(key, val);

  /// One-time recovery: older builds set a permanent opt-out on ANY
  /// dismissal. Clear that flag once for installs that never sent real
  /// feedback, then let them be asked again.
  static void _migrateOptOutOnce() {
    if (_migrated) return;
    _migrated = true;
    if (Prefs.getInt(_keyOptOutMigratedV2) == 1) return;
    Prefs.setInt(_keyOptOutMigratedV2, 1);
    if (Prefs.getInt(_keyOptOut) == 1 && Prefs.getInt(_keyFeedbackSent) != 1) {
      Prefs.remove(_keyOptOut);
      _set(_keyLastDismiss, DateTime.now().millisecondsSinceEpoch);
    }
  }

  /// Kept for API compatibility with the web hook call sites — no-op.
  static void recordHappyMoment([int weight = 1]) {}

  static bool _everPrompted() => _num(_keyLastPrompt) > 0;

  /// Returns null when eligible, otherwise the reason it's blocked.
  static String? ratingBlockReason() {
    _migrateOptOutOnce();

    if (Prefs.getInt(_keyRated) == 1) return 'already_rated';
    if (Prefs.getInt(_keyOptOut) == 1) return 'opted_out';

    // Guarantee: every new install sees the prompt at least once.
    if (!_everPrompted()) return null;

    if (_num(_keyDismissCount) >= _maxDismissals) return 'dismiss_cap';
    final sinceDismiss =
        DateTime.now().millisecondsSinceEpoch - _num(_keyLastDismiss);
    if (_num(_keyLastDismiss) > 0 &&
        sinceDismiss < _hoursAfterDismiss * _hourMs) {
      return 'dismiss_cooldown';
    }

    if (_sessionPromptCount >= _maxPromptsPerSession) return 'session_cap';
    if (_sessionPromptCount > 0 &&
        DateTime.now().millisecondsSinceEpoch - _lastSessionPromptAt <
            _minMinutesBetweenSessionPrompts * 60000) {
      return 'session_gap';
    }

    final sinceLast =
        DateTime.now().millisecondsSinceEpoch - _num(_keyLastPrompt);
    if (sinceLast < _minHoursBetweenPrompts * _hourMs) return 'cooldown';
    return null;
  }

  static bool isEligibleForRating() => ratingBlockReason() == null;

  /// "Armed" flag for the Quiz screen: quiz completion arms the prompt, and
  /// it actually fires when the user leaves the results screen — mirrors
  /// `sessionStorage['jw_rating_armed']` in `useQuiz.ts` / `Quiz.tsx`.
  static bool _quizArmed = false;
  static void armQuizRating() => _quizArmed = true;
  static void fireArmedQuizRatingIfNeeded() {
    if (!_quizArmed) return;
    _quizArmed = false;
    Future.delayed(const Duration(milliseconds: 600), maybeRequestRating);
  }

  static bool maybeRequestRating({bool force = false}) {
    if (!force) {
      final blocked = ratingBlockReason();
      if (blocked != null) {
        Analytics.capture('rating_prompt_blocked', {'reason': blocked});
        return false;
      }
    }

    // Race guard: if a competing overlay (paywall / permission nudge) is on
    // screen, QUEUE the prompt instead of dropping it — poll until clear.
    if (!force && RatingOverlayGate.anyVisible) {
      if (_deferTimer != null) return false;
      Analytics.capture('rating_prompt_deferred', {
        'holder': RatingOverlayGate.label ?? '',
      });
      var tries = 0;
      _deferTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
        tries += 1;
        if (!RatingOverlayGate.anyVisible) {
          timer.cancel();
          _deferTimer = null;
          maybeRequestRating(force: false);
        } else if (tries > 150) {
          timer.cancel();
          _deferTimer = null;
          Analytics.capture('rating_prompt_dropped', {
            'reason': 'overlay_timeout',
          });
        }
      });
      return false;
    }

    _sessionPromptCount += 1;
    _lastSessionPromptAt = DateTime.now().millisecondsSinceEpoch;
    _set(_keyLastPrompt, DateTime.now().millisecondsSinceEpoch);
    _showPrompt();
    return true;
  }

  static void _showPrompt() {
    if (IosPlatform.isIOS) {
      // App Store rules: no custom "do you like us?" gate — ask Apple's sheet
      // directly at the happy moment (Apple throttles it to 3x a year).
      Analytics.capture('rating_prompt_shown', {'platform': 'ios_native'});
      IosPlatform.requestReview();
      return;
    }
    final ctx = navigatorKey.currentState?.overlay?.context;
    if (ctx == null) return;
    Analytics.capture('rating_prompt_shown');
    showRatingPromptDialog(ctx);
  }

  /// "Yes" path. Tries the native In-App Review sheet first; Google's API
  /// silently no-ops in many cases, so we time the call — under ~1.2s means
  /// the sheet almost certainly never appeared, and we fall back to opening
  /// the Play Store listing directly.
  static Future<void> openNativeRating() async {
    if (IosPlatform.isIOS) {
      try {
        await launchUrl(
          Uri.parse('${IosPlatform.appStoreUrl}?action=write-review'),
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {}
      markRated();
      return;
    }
    if (kIsWeb) {
      try {
        await launchUrl(
          Uri.parse(_playStoreUrl),
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {}
      markRated();
      return;
    }

    final attempts = _num(_keyNativeAttempts);
    var nativeShown = false;

    if (attempts < _maxNativeAttempts) {
      try {
        final inAppReview = InAppReview.instance;
        final start = DateTime.now().millisecondsSinceEpoch;
        await inAppReview.requestReview();
        final elapsed = DateTime.now().millisecondsSinceEpoch - start;
        _set(_keyNativeAttempts, attempts + 1);
        if (elapsed >= 1200) {
          nativeShown = true;
          markRated();
          return;
        }
      } catch (_) {
        // native review unavailable — fall through
      }
    }

    if (nativeShown) return;

    // Fallback: open the actual Play Store listing. market:// launches the
    // Play Store app directly when installed; https is the safety net.
    try {
      final marketUri = Uri.parse(
        'market://details?id=com.jesuswallpaperbible.app',
      );
      final launched = await launchUrl(
        marketUri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        await launchUrl(
          Uri.parse(_playStoreUrl),
          mode: LaunchMode.externalApplication,
        );
      } else {
        Future.delayed(const Duration(milliseconds: 800), () async {
          try {
            await launchUrl(
              Uri.parse(_playStoreUrl),
              mode: LaunchMode.externalApplication,
            );
          } catch (_) {}
        });
      }
    } catch (_) {
      try {
        await launchUrl(
          Uri.parse(_playStoreUrl),
          mode: LaunchMode.externalApplication,
        );
      } catch (_) {}
    }
    markRated();
  }

  static Future<void> openFeedback([String? reason]) async {
    final subject = Uri.encodeComponent(
      'Prayly: Bible Prayer & Verse — feedback',
    );
    final body = Uri.encodeComponent(
      "Hi team,\n\n${reason != null ? "What I'd improve: $reason\n\n" : ''}—",
    );
    _set(_keyFeedbackSent, 1);
    _set(_keyOptOut, 1);
    final url =
        'mailto:support@jesuswallpaperbible.app?subject=$subject&body=$body';
    try {
      await launchUrl(Uri.parse(url));
    } catch (_) {}
  }

  static void markRated() => _set(_keyRated, 1);

  /// Soft "not now" — keeps the install eligible for a later ask.
  static void markLater() {
    _set(_keyDismissCount, _num(_keyDismissCount) + 1);
    _set(_keyLastDismiss, DateTime.now().millisecondsSinceEpoch);
  }

  static void markDeclined() => _set(_keyOptOut, 1);

  static void resetForTesting() {
    for (final k in [
      _keyLastPrompt,
      _keyRated,
      _keyOptOut,
      _keyNativeAttempts,
      _keyDismissCount,
      _keyLastDismiss,
    ]) {
      Prefs.remove(k);
    }
    _sessionPromptCount = 0;
    _lastSessionPromptAt = 0;
  }
}

/// Tiny visibility registry mirroring `src/lib/overlayQueue.ts`'s
/// `anyOverlayVisible`/`markOverlayVisible`. Nothing else registers with it
/// yet (the web's paywall scheduler / permission nudges aren't ported), so
/// today it simply reports "clear" — but any future full-screen sheet can
/// call `RatingOverlayGate.markVisible('name')` to make the rating prompt
/// wait behind it instead of firing underneath it.
class RatingOverlayGate {
  RatingOverlayGate._();

  static final Set<String> _visible = {};

  static bool get anyVisible => _visible.isNotEmpty;
  static String? get label => _visible.isNotEmpty ? _visible.first : null;

  static VoidCallback markVisible(String name) {
    _visible.add(name);
    var released = false;
    return () {
      if (released) return;
      released = true;
      _visible.remove(name);
    };
  }
}
