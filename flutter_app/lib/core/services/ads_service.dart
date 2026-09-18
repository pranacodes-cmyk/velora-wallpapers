import 'dart:async';

import 'package:google_mobile_ads/google_mobile_ads.dart';

import 'analytics.dart';
import 'prefs.dart';

/// Rewarded / interstitial ads — same production AdMob units, the same
/// ad-free gate and the same "fail open" rule as `src/services/ads.ts`: if
/// AdMob cannot load or show an ad the user still gets the reward, so nobody
/// loses content because Google had no inventory. `false` is returned only
/// when an ad actually showed and the user closed it before earning the
/// reward.
///
/// Interstitials are kept WARM in the background (like the web wrapper) and
/// every interstitial trigger goes through the single 45s global cooldown
/// ported from `src/services/ad-cooldown.ts`, so two ads can never stack.
class AdsService {
  AdsService._();

  static const _rewardedUnit = 'ca-app-pub-2361456317095553/3292910180';
  static const _interstitialUnit = 'ca-app-pub-2361456317095553/7308266108';

  static const _cooldown = Duration(milliseconds: 45000);

  static bool _initialized = false;
  static Future<void>? _initFuture;

  static InterstitialAd? _warmInterstitial;
  static bool _interstitialLoading = false;
  static bool _interstitialShowing = false;

  static DateTime? _lastShownAt;
  static bool _inFlight = false;

  /// Central premium / ad-free gate — mirrors `isAdFreeUser()` on the web:
  /// Pro users and users inside the 24h ad-free window never see an ad.
  static bool get _isAdFree {
    if (Prefs.getBool(StorageKeys.premiumUnlocked)) return true;
    final until = Prefs.getInt(StorageKeys.adFreeUntil);
    return until > DateTime.now().millisecondsSinceEpoch;
  }

  static Future<void> init() {
    if (_initialized) return Future.value();
    return _initFuture ??= MobileAds.instance
        .initialize()
        .then((_) {
          _initialized = true;
          _initFuture = null;
          if (!_isAdFree) _preloadInterstitial();
        })
        .catchError((_) {
          _initFuture = null;
        });
  }

  // ── global cooldown (src/services/ad-cooldown.ts) ────────────────────────
  static int get cooldownRemainingMs {
    final last = _lastShownAt;
    if (last == null) return 0;
    final elapsed = DateTime.now().difference(last).inMilliseconds;
    final left = _cooldown.inMilliseconds - elapsed;
    return left > 0 ? left : 0;
  }

  static bool get isCooldownActive => cooldownRemainingMs > 0 || _inFlight;

  /// Marks that an ad-shaped event just happened (e.g. a rewarded video
  /// finished) so an interstitial cannot stack on top of it.
  static void markAdShown() {
    _lastShownAt = DateTime.now();
  }

  // ── rewarded ─────────────────────────────────────────────────────────────

  /// Shows a rewarded video. Resolves `true` when the reward is earned (or
  /// when no ad could be served at all).
  static Future<bool> showRewarded() async {
    await Analytics.capture('ad_rewarded_requested');

    // Pro / ad-free users instantly get the reward — no ad ever loads.
    if (_isAdFree) {
      await Analytics.capture('ad_rewarded_skipped_pro');
      return true;
    }

    await init();

    final loaded = Completer<RewardedAd?>();
    try {
      await RewardedAd.load(
        adUnitId: _rewardedUnit,
        request: const AdRequest(),
        rewardedAdLoadCallback: RewardedAdLoadCallback(
          onAdLoaded: (ad) {
            if (!loaded.isCompleted) loaded.complete(ad);
          },
          onAdFailedToLoad: (_) {
            if (!loaded.isCompleted) loaded.complete(null);
          },
        ),
      );
    } catch (_) {
      if (!loaded.isCompleted) loaded.complete(null);
    }

    final ad = await loaded.future.timeout(
      const Duration(seconds: 12),
      onTimeout: () => null,
    );
    if (ad == null) {
      await Analytics.capture('ad_rewarded_failed_open');
      return true; // fail open
    }

    var earned = false;
    final done = Completer<bool>();
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (_) => markAdShown(),
      onAdDismissedFullScreenContent: (a) {
        a.dispose();
        markAdShown();
        if (!done.isCompleted) done.complete(earned);
      },
      onAdFailedToShowFullScreenContent: (a, _) {
        a.dispose();
        if (!done.isCompleted) done.complete(true); // fail open
      },
    );

    try {
      await ad.show(
        onUserEarnedReward: (_, _) {
          earned = true;
          Analytics.capture('ad_rewarded_earned');
        },
      );
    } catch (_) {
      if (!done.isCompleted) done.complete(true);
    }

    return done.future;
  }

  // ── interstitial (warm cache + cooldown) ─────────────────────────────────

  /// Warms the next interstitial in the background so showing is instant.
  /// Safe to call at any time; no-op for ad-free users.
  static void primeInterstitial() {
    if (_isAdFree) return;
    init().then((_) => _preloadInterstitial());
  }

  static void _preloadInterstitial() {
    if (_isAdFree ||
        _interstitialLoading ||
        _interstitialShowing ||
        _warmInterstitial != null) {
      return;
    }
    _interstitialLoading = true;
    InterstitialAd.load(
      adUnitId: _interstitialUnit,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (ad) {
          _interstitialLoading = false;
          _warmInterstitial = ad;
        },
        onAdFailedToLoad: (_) {
          _interstitialLoading = false;
          _warmInterstitial = null;
        },
      ),
    ).catchError((_) {
      _interstitialLoading = false;
    });
  }

  /// Shows an interstitial only if the global 45s cooldown allows it.
  /// Returns true if an ad was actually attempted, false if suppressed.
  /// `force` bypasses the cooldown — use very sparingly.
  static Future<bool> tryShowInterstitial(
    String? label, {
    bool force = false,
  }) async {
    if (_isAdFree) return false;
    if (!force && isCooldownActive) return false;

    _inFlight = true;
    try {
      await _showInterstitial(label);
      _lastShownAt = DateTime.now();
      return true;
    } catch (_) {
      return false;
    } finally {
      _inFlight = false;
    }
  }

  /// Best-effort interstitial. Never blocks the caller's flow.
  /// Prefer [tryShowInterstitial] — it respects the global cooldown.
  static Future<void> showInterstitial([String? label]) =>
      _showInterstitial(label);

  static Future<void> _showInterstitial(String? label) async {
    if (_isAdFree) return;
    await init();

    var ad = _warmInterstitial;
    if (ad == null) {
      final loaded = Completer<InterstitialAd?>();
      try {
        await InterstitialAd.load(
          adUnitId: _interstitialUnit,
          request: const AdRequest(),
          adLoadCallback: InterstitialAdLoadCallback(
            onAdLoaded: (a) {
              if (!loaded.isCompleted) loaded.complete(a);
            },
            onAdFailedToLoad: (_) {
              if (!loaded.isCompleted) loaded.complete(null);
            },
          ),
        );
      } catch (_) {
        if (!loaded.isCompleted) loaded.complete(null);
      }
      ad = await loaded.future.timeout(
        const Duration(seconds: 8),
        onTimeout: () => null,
      );
    }

    if (ad == null) {
      await Analytics.capture('ad_interstitial_unavailable', {
        if (label != null) 'label': label,
      });
      return;
    }

    _warmInterstitial = null;
    _interstitialShowing = true;
    final done = Completer<void>();
    ad.fullScreenContentCallback = FullScreenContentCallback(
      onAdShowedFullScreenContent: (_) {
        markAdShown();
        Analytics.capture('ad_interstitial_shown', {
          if (label != null) 'label': label,
        });
      },
      onAdDismissedFullScreenContent: (a) {
        a.dispose();
        _interstitialShowing = false;
        markAdShown();
        if (!done.isCompleted) done.complete();
        _preloadInterstitial(); // warm the next one
      },
      onAdFailedToShowFullScreenContent: (a, _) {
        a.dispose();
        _interstitialShowing = false;
        if (!done.isCompleted) done.complete();
        _preloadInterstitial();
      },
    );

    try {
      await ad.show();
    } catch (_) {
      _interstitialShowing = false;
      if (!done.isCompleted) done.complete();
    }
    return done.future;
  }

  // ── UMP consent (GDPR revocation) ────────────────────────────────────────

  /// Re-opens the AdMob consent (UMP) form so the user can change their
  /// personalized-ads preference. Required by Google for GDPR revocation.
  static Future<bool> showPrivacyOptionsForm() async {
    await init();
    final done = Completer<bool>();
    try {
      ConsentForm.showPrivacyOptionsForm((error) {
        if (!done.isCompleted) done.complete(error == null);
      });
    } catch (_) {
      if (!done.isCompleted) done.complete(false);
    }
    return done.future.timeout(
      const Duration(seconds: 20),
      onTimeout: () => false,
    );
  }

  /// Whether the privacy options form is available right now — used to hide
  /// the Settings row in regions where it does not apply.
  static Future<bool> isPrivacyOptionsRequired() async {
    try {
      await init();
      final status = await ConsentInformation.instance
          .getPrivacyOptionsRequirementStatus();
      return status == PrivacyOptionsRequirementStatus.required;
    } catch (_) {
      return false;
    }
  }
}
