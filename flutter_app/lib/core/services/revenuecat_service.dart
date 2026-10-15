import 'dart:io';

import 'package:flutter/foundation.dart'
    show ValueChanged, debugPrint, kDebugMode, kIsWeb;
import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../env.dart';
import 'meta_capi.dart';
import 'meta_events.dart';
import 'parallax_wallpaper.dart';
import 'prefs.dart';
import 'wallpaper_bridge.dart';
import 'app_log.dart';

/// Port of `src/services/revenuecat.ts` + `src/services/premium-sync.ts`.
/// Same entitlement string, same products, same silent-restore recovery so a
/// returning Pro user is never shown a paywall.
class RevenueCatService {
  RevenueCatService._();

  static bool _configured = false;
  static const _autoRestoreUserKey = 'cw_rc_auto_restored_user_v2';
  static const _freeStrikesKey = 'cw_premium_free_strikes';
  static const _graceUntilKey = 'cw_premium_grace_until';
  static final List<ValueChanged<bool>> _premiumListeners = [];

  static bool _hasPremium(CustomerInfo info) =>
      info.entitlements.active.containsKey(Env.entitlementId);

  /// [explicit] = the user themselves tapped "Restore Purchases". That answer
  /// is authoritative: the strike/grace guards (which exist to protect a payer
  /// from ONE bad background answer) must not keep a stale Pro flag alive,
  /// otherwise Restore reports "no purchases found" while the app still behaves
  /// as Pro — exactly the confusing state seen after a test purchase was
  /// cancelled or the RevenueCat user was deleted.
  static Future<bool> _applyCustomerInfo(
    CustomerInfo info, {
    bool explicit = false,
  }) async {
    var active = _hasPremium(info);
    final wasPremium = Prefs.getBool(StorageKeys.premiumUnlocked);
    if (explicit) {
      await Prefs.remove(_freeStrikesKey);
      await Prefs.remove(_graceUntilKey);
    } else if (active) {
      await Prefs.remove(_freeStrikesKey);
      await Prefs.remove(_graceUntilKey);
    } else if (wasPremium) {
      final now = DateTime.now().millisecondsSinceEpoch;
      final strikes = Prefs.getInt(_freeStrikesKey) + 1;
      var graceUntil = Prefs.getInt(_graceUntilKey);
      if (graceUntil == 0) {
        graceUntil = now + const Duration(hours: 24).inMilliseconds;
        await Prefs.setInt(_graceUntilKey, graceUntil);
      }
      await Prefs.setInt(_freeStrikesKey, strikes);
      if (strikes < 2 && now < graceUntil) active = true;
    }

    await Prefs.setBool(StorageKeys.premiumUnlocked, active);
    if (!active) await Prefs.remove(StorageKeys.adFreeUntil);
    for (final listener in List<ValueChanged<bool>>.of(_premiumListeners)) {
      listener(active);
    }
    // Keep native wallpaper services synchronized with the authoritative
    // entitlement, matching premium-sync.ts in the Capacitor app.
    await WallpaperBridge.dailyVerseSetPremium(active);
    if (!active) await ParallaxWallpaper.clearIfActive();
    return active;
  }

  static void addPremiumListener(ValueChanged<bool> listener) {
    if (!_premiumListeners.contains(listener)) _premiumListeners.add(listener);
  }

  static void removePremiumListener(ValueChanged<bool> listener) {
    _premiumListeners.remove(listener);
  }

  static Future<void> init() async {
    if (_configured || kIsWeb) return;
    final key = Platform.isIOS
        ? Env.revenueCatIosKey
        : Env.revenueCatAndroidKey;
    if (key.isEmpty) return;
    try {
      await Purchases.setLogLevel(LogLevel.error);
      await Purchases.configure(PurchasesConfiguration(key));
      Purchases.addCustomerInfoUpdateListener((info) {
        _applyCustomerInfo(info);
      });
      _configured = true;
      // Identify the RC App User ID to Meta for advanced matching (web parity).
      MetaCapi.captureAppUserId();
      // Attach ad identifiers to the RevenueCat customer so the server can
      // send StartTrial / Purchase to Meta with ad attribution.
      _syncAdIdentifiers();
    } catch (e) {
      // A failed configure() leaves premium on the cached snapshot — loud in
      // debug so a broken store setup is never invisible during QA.
      if (kDebugMode) debugPrint('[revenuecat] configure failed: $e');
    }
  }

  static Future<void> _syncAdIdentifiers() async {
    try {
      await Purchases.collectDeviceIdentifiers();
    } catch (_) {}
    try {
      final anon = await MetaEvents.anonymousId();
      if (anon != null && anon.isNotEmpty) {
        await Purchases.setFBAnonymousID(anon);
      }
    } catch (_) {}
  }

  static bool get _freeTestMode => Prefs.getBool(StorageKeys.freeTestMode);

  /// Reads the live entitlement. Returns the cached snapshot on failure so a
  /// flaky network never downgrades a paying user mid-session.
  static Future<bool> resolvePremium() async {
    if (_freeTestMode) return false;
    if (!_configured) return Prefs.getBool(StorageKeys.premiumUnlocked);
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        if (attempt == 0) {
          try {
            await Purchases.invalidateCustomerInfoCache();
          } catch (_) {}
        }
        final info = await Purchases.getCustomerInfo();
        return await _applyCustomerInfo(info);
      } catch (e) {
        AppLog.error('revenuecat.silent_restore', e, {'attempt': attempt});
        if (attempt < 2) {
          await Future<void>.delayed(
            Duration(milliseconds: 800 * (attempt + 1)),
          );
        }
      }
    }
    return Prefs.getBool(StorageKeys.premiumUnlocked);
  }

  /// Silent Play-ownership recovery on cold start (never grants anything on its
  /// own — Play/RevenueCat must confirm a real purchase).
  static Future<bool> recoverIfNeeded() async {
    if (kIsWeb || _freeTestMode || !_configured) return false;
    final appUserId = await Purchases.appUserID;
    if (appUserId.isNotEmpty &&
        Prefs.getString(_autoRestoreUserKey) == appUserId) {
      return false;
    }
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await Purchases.syncPurchases();
        final info = await Purchases.restorePurchases();
        final active = _hasPremium(info);
        if (active) {
          await _applyCustomerInfo(info);
          if (appUserId.isNotEmpty) {
            await Prefs.setString(_autoRestoreUserKey, appUserId);
          }
          return true;
        }
        return false;
      } catch (_) {
        if (attempt < 2) {
          await Future<void>.delayed(
            Duration(milliseconds: 1200 * (attempt + 1)),
          );
        }
      }
    }
    return false;
  }

  /// Port of `fetchOfferingPackages()` — packages keyed by plan id, with the
  /// offerings cache busted first so the sheet always shows live Play prices.
  static Future<Map<String, Package>> planPackages() async {
    if (!_configured) await init();
    if (!_configured) return const {};
    try {
      try {
        await Purchases.invalidateCustomerInfoCache();
      } catch (_) {}
      final current = (await Purchases.getOfferings()).current;
      if (current == null) return const {};
      final map = <String, Package>{};
      if (current.weekly != null) map['weekly'] = current.weekly!;
      if (current.monthly != null) map['monthly'] = current.monthly!;
      if (current.annual != null) map['yearly'] = current.annual!;
      for (final pkg in current.availablePackages) {
        // RevenueCat package identifiers: $rc_weekly, $rc_monthly, $rc_annual
        if (pkg.identifier == '\$rc_weekly') map['weekly'] = pkg;
        if (pkg.identifier == '\$rc_monthly') map['monthly'] = pkg;
        if (pkg.identifier == '\$rc_annual') map['yearly'] = pkg;
      }
      return map;
    } catch (e) {
      AppLog.error('revenuecat.plan_packages', e);
      return const {};
    }
  }

  /// Same semantics as `isUserCancelled()` in the web service.
  static bool isUserCancelled(Object error) {
    if (error is PlatformException) {
      return PurchasesErrorHelper.getErrorCode(error) ==
          PurchasesErrorCode.purchaseCancelledError;
    }
    return error.toString().toLowerCase().contains('cancel');
  }

  static Future<Offerings?> offerings() async {
    if (!_configured) return null;
    try {
      return await Purchases.getOfferings();
    } catch (_) {
      return null;
    }
  }

  static Future<bool> purchase(Package package) async {
    if (!_configured) await init();
    if (!_configured) {
      throw StateError('Purchases are unavailable on this device.');
    }
    // purchases_flutter 10 returns a PurchaseResult (Play Billing 8).
    final result = await Purchases.purchasePackage(package);
    final info = result.customerInfo;
    final active = _hasPremium(info);
    await _applyCustomerInfo(info);

    if (active) {
      // StartTrial and Purchase are sent to Meta ONLY by the RevenueCat
      // webhook (server), so they are never double-counted and still arrive
      // when the app is closed or payment confirms late. Make sure the ad
      // identifiers are on the customer before RevenueCat fires the webhook.
      _syncAdIdentifiers();
    }
    return active;
  }

  static Future<bool> restore() async {
    if (!_configured) await init();
    if (!_configured) {
      throw StateError('Purchases are unavailable on this device.');
    }
    // Reconcile the device's Play purchases first. This is required after a
    // reinstall, where RevenueCat may have created a fresh anonymous user.
    await Purchases.syncPurchases();
    // Bust the cache so restore reads live entitlements, not a stale snapshot.
    try {
      await Purchases.invalidateCustomerInfoCache();
    } catch (_) {}
    final info = await Purchases.restorePurchases();
    final active = _hasPremium(info);
    await _applyCustomerInfo(info, explicit: true);
    return active;
  }
}
