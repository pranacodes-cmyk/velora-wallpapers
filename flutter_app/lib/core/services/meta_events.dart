import 'package:facebook_app_events/facebook_app_events.dart';
import 'package:flutter/foundation.dart';

/// Meta (Facebook) App Events — 1:1 port of the web build's
/// `src/services/meta-events.ts`.
///
/// Fires the standard events Meta Ads campaigns rely on:
///   - App install / open (auto-logged by the native SDK)
///   - CompleteRegistration (onboarding finished)
///   - InitiatedCheckout (paywall opened)
///   - Purchase / Subscribe (RevenueCat success) → powers Value Optimization
///
/// Every call is a no-op on web and never throws.
class MetaEvents {
  MetaEvents._();

  static final FacebookAppEvents _fb = FacebookAppEvents();
  static bool _ready = false;

  static bool get _available => !kIsWeb;

  /// Call once at app start. The native SDK auto-logs app open/install.
  static Future<void> init() async {
    if (!_available || _ready) return;
    try {
      // Android: allows advertiser-id collection (no-op where ATT governs).
      await _fb.setAdvertiserTracking(enabled: true);
      await _fb.setAutoLogAppEventsEnabled(true);
      _ready = true;
    } catch (_) {
      /* non-fatal */
    }
  }

  static Future<void> logEvent(
    String name, {
    Map<String, dynamic>? params,
    double? valueToSum,
  }) async {
    if (!_available) return;
    try {
      await _fb.logEvent(
        name: name,
        parameters: params,
        valueToSum: valueToSum,
      );
    } catch (_) {
      /* swallow */
    }
  }

  /// Onboarding finished.
  static void completeRegistration() {
    if (!_available) return;
    _fb
        .logCompletedRegistration(registrationMethod: 'onboarding')
        .catchError((_) {});
  }

  /// Paywall opened (top-of-funnel for Value Optimization).
  static void initiatedCheckout([String? productId]) {
    if (!_available) return;
    _fb
        .logInitiatedCheckout(contentId: productId, numItems: 1)
        .catchError((_) {});
  }

  /// Lightweight engagement signal — favorite added.
  static void addToWishlist([String? wallpaperId]) {
    if (!_available) return;
    logEvent(
      'fb_mobile_add_to_wishlist',
      params: wallpaperId == null ? null : {'fb_content_id': wallpaperId},
    );
  }

  /// Wallpaper detail viewed.
  static void contentView([String? wallpaperId]) {
    if (!_available) return;
    _fb.logViewContent(id: wallpaperId).catchError((_) {});
  }

  /// Subscription signal (unchanged). Purchase is NOT sent from the app —
  /// the RevenueCat webhook is the single Purchase sender to Meta.
  static Future<void> subscribe(
    double amount,
    String currency, {
    String? productId,
  }) async {
    if (!_available) return;
    await logEvent(
      'Subscribe',
      valueToSum: amount,
      params: {
        'fb_currency': currency,
        if (productId != null) 'fb_content_id': productId,
      },
    );
  }

  /// Standard Meta StartTrial event — value 0, never a Purchase.
  static Future<void> startTrial(String currency, {String? productId}) async {
    if (!_available) return;
    await logEvent(
      'StartTrial',
      valueToSum: 0,
      params: {
        'fb_currency': currency,
        if (productId != null) 'fb_content_id': productId,
      },
    );
  }
}
