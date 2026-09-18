import 'dart:io';

import 'package:flutter/services.dart';
import 'package:purchases_flutter/purchases_flutter.dart';

import '../env.dart';
import 'prefs.dart';

/// Port of `src/services/revenuecat.ts` + `src/services/premium-sync.ts`.
/// Same entitlement string, same products, same silent-restore recovery so a
/// returning Pro user is never shown a paywall.
class RevenueCatService {
  RevenueCatService._();

  static bool _configured = false;

  static Future<void> init() async {
    if (_configured) return;
    final key = Platform.isIOS
        ? Env.revenueCatIosKey
        : Env.revenueCatAndroidKey;
    if (key.isEmpty) return;
    try {
      await Purchases.setLogLevel(LogLevel.error);
      await Purchases.configure(PurchasesConfiguration(key));
      _configured = true;
    } catch (_) {}
  }

  static bool get _freeTestMode => Prefs.getBool(StorageKeys.freeTestMode);

  /// Reads the live entitlement. Returns the cached snapshot on failure so a
  /// flaky network never downgrades a paying user mid-session.
  static Future<bool> resolvePremium() async {
    if (_freeTestMode) return false;
    if (!_configured) return Prefs.getBool(StorageKeys.premiumUnlocked);
    try {
      final info = await Purchases.getCustomerInfo();
      final active =
          info.entitlements.active.containsKey(Env.entitlementId) ||
          info.entitlements.active.isNotEmpty;
      await Prefs.setBool(StorageKeys.premiumUnlocked, active);
      return active;
    } catch (_) {
      return Prefs.getBool(StorageKeys.premiumUnlocked);
    }
  }

  /// Silent Play-ownership recovery on cold start (never grants anything on its
  /// own — Play/RevenueCat must confirm a real purchase).
  static Future<bool> recoverIfNeeded() async {
    if (_freeTestMode || !_configured) return false;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        final info = await Purchases.restorePurchases();
        final active = info.entitlements.active.isNotEmpty;
        if (active) {
          await Prefs.setBool(StorageKeys.premiumUnlocked, true);
          return true;
        }
        return false;
      } catch (_) {
        await Future<void>.delayed(const Duration(milliseconds: 400));
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
    } catch (_) {
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
    try {
      final result = await Purchases.purchasePackage(package);
      final active = result.entitlements.active.isNotEmpty;
      if (active) await Prefs.setBool(StorageKeys.premiumUnlocked, true);
      return active;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> restore() async {
    if (!_configured) return false;
    try {
      final info = await Purchases.restorePurchases();
      final active = info.entitlements.active.isNotEmpty;
      await Prefs.setBool(StorageKeys.premiumUnlocked, active);
      return active;
    } catch (_) {
      return false;
    }
  }
}
