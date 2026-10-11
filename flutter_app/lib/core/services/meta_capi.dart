import 'dart:io' show Platform;
import 'dart:math';
import 'dart:ui' show PlatformDispatcher;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:package_info_plus/package_info_plus.dart';
import 'package:purchases_flutter/purchases_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'backend_service.dart';
import 'prefs.dart';

/// Client → server Meta Conversions API helper.
/// 1:1 port of `src/services/meta-capi.ts`: fire-and-forget POST to the
/// `meta-capi` edge function with a stable device_id, an `_fbp` browser id,
/// advanced-matching identifiers and an `event_id` so server events are
/// deduplicated against the native SDK events fired by [MetaEvents].
class MetaCapi {
  MetaCapi._();

  static const _deviceKey = 'cw_device_id';
  static const _installFiredKey = 'cw_meta_install_fired';
  static const _fbpKey = 'cw_fbp';
  static const _appUserIdKey = 'cw_app_user_id';
  static const _emailKey = 'cw_user_email';

  static final _rand = Random();
  static Map<String, Object?>? _appDataCache;

  static String _uuid() {
    // RFC-4122-ish v4 — only needs to be unique per event for dedup.
    const hex = '0123456789abcdef';
    final b = StringBuffer();
    for (var i = 0; i < 32; i++) {
      if (i == 12) {
        b.write('4');
        continue;
      }
      b.write(hex[_rand.nextInt(16)]);
    }
    final s = b.toString();
    return '${s.substring(0, 8)}-${s.substring(8, 12)}-${s.substring(12, 16)}'
        '-${s.substring(16, 20)}-${s.substring(20)}';
  }

  static String deviceId() {
    final existing = Prefs.getString(_deviceKey);
    if (existing != null && existing.isNotEmpty) return existing;
    final id = _uuid();
    Prefs.setString(_deviceKey, id);
    return id;
  }

  /// Native builds have no `fbclid` in a URL, so only the `_fbp` browser id is
  /// generated (same format Meta expects: `fb.1.{ts}.{rand}`).
  static void ensureFbp() {
    final existing = Prefs.getString(_fbpKey);
    if (existing != null && existing.isNotEmpty) return;
    final rand = _rand.nextInt(1 << 32);
    Prefs.setString(
      _fbpKey,
      'fb.1.${DateTime.now().millisecondsSinceEpoch}.$rand',
    );
  }

  /// Advanced matching — higher match rates when the identity is known.
  static void setUserIdentity({String? appUserId, String? email}) {
    if (appUserId != null && appUserId.isNotEmpty) {
      Prefs.setString(_appUserIdKey, appUserId);
    }
    if (email != null && email.trim().isNotEmpty) {
      Prefs.setString(_emailKey, email.trim().toLowerCase());
    }
  }

  /// Mirrors `revenuecat.ts` — stores the RC App User ID for matching.
  static Future<void> captureAppUserId() async {
    if (kIsWeb) return;
    try {
      final id = await Purchases.appUserID;
      if (id.isNotEmpty) setUserIdentity(appUserId: id);
    } catch (_) {}
  }

  static Future<Map<String, Object?>> _appData() async {
    final cached = _appDataCache;
    if (cached != null) return cached;

    final platform = kIsWeb
        ? 'web'
        : Platform.isIOS
        ? 'ios'
        : 'android';
    var appVersion = '1.0.0';
    var osVersion = platform == 'ios' ? '17.0' : '13';
    var bundleId = 'com.jesuswallpaperbible.app';
    var deviceModel = '';
    try {
      final info = await PackageInfo.fromPlatform();
      if (info.version.isNotEmpty) appVersion = info.version;
      if (info.packageName.isNotEmpty) bundleId = info.packageName;
    } catch (_) {}
    try {
      final plugin = DeviceInfoPlugin();
      if (!kIsWeb && Platform.isAndroid) {
        final a = await plugin.androidInfo;
        osVersion = a.version.release;
        deviceModel = a.model;
      } else if (!kIsWeb && Platform.isIOS) {
        final i = await plugin.iosInfo;
        osVersion = i.systemVersion;
        deviceModel = i.utsname.machine;
      }
    } catch (_) {}

    final view = PlatformDispatcher.instance.views.isEmpty
        ? null
        : PlatformDispatcher.instance.views.first;
    final size = view?.physicalSize;
    final locale = PlatformDispatcher.instance.locale;
    final offset = DateTime.now().timeZoneOffset;
    final sign = offset.isNegative ? '-' : '+';

    final data = <String, Object?>{
      'platform': platform,
      'bundle_id': bundleId,
      'app_version': appVersion,
      'os_version': osVersion,
      if (deviceModel.isNotEmpty) 'device_model': deviceModel,
      'locale':
          '${locale.languageCode}_${(locale.countryCode ?? 'US').toUpperCase()}',
      'timezone': 'GMT$sign${offset.inHours.abs()}',
      'screen_width': size?.width.round() ?? 0,
      'screen_height': size?.height.round() ?? 0,
      'advertiser_tracking_enabled': 1,
    };
    _appDataCache = data;
    return data;
  }

  static Future<void> track(
    String eventName, {
    double? value,
    String? currency,
    Map<String, Object?>? customData,
    String? eventId,
  }) async {
    try {
      await BackendService.ensure();
      ensureFbp();
      await Supabase.instance.client.functions.invoke(
        'meta-capi',
        body: {
          'event_name': eventName,
          'event_id': eventId ?? _uuid(),
          if (value != null) 'value': value,
          if (currency != null) 'currency': currency,
          if (customData != null) 'custom_data': customData,
          'device_id': deviceId(),
          if (Prefs.getString(_appUserIdKey) != null)
            'app_user_id': Prefs.getString(_appUserIdKey),
          if (Prefs.getString(_emailKey) != null)
            'email': Prefs.getString(_emailKey),
          if (Prefs.getString(_fbpKey) != null) 'fbp': Prefs.getString(_fbpKey),
          'action_source': 'app',
          'app_data': await _appData(),
        },
      );
    } catch (_) {
      /* fire-and-forget */
    }
  }

  static void appOpen() {
    track('fb_mobile_activate_app');
  }

  /// Fires Install (`fb_mobile_first_app_launch`) exactly once per device.
  static void installOnce() {
    if (Prefs.getBool(_installFiredKey)) return;
    Prefs.setBool(_installFiredKey, true);
    track('fb_mobile_first_app_launch');
  }

  static void viewContent({String? contentId, String? contentName}) {
    track(
      'ViewContent',
      customData: {
        if (contentId != null) 'content_ids': [contentId],
        if (contentName != null) 'content_name': contentName,
      },
    );
  }

  static void initiateCheckout(
    double value,
    String currency, {
    String? productId,
  }) {
    track(
      'InitiateCheckout',
      value: value,
      currency: currency,
      customData: productId == null
          ? null
          : {
              'content_ids': [productId],
            },
    );
  }

  /// Subscribe signal only. Purchase is sent to Meta exclusively by the
  /// RevenueCat webhook (server) — the app must never send Purchase.
  static void subscribe(double value, String currency, {String? productId}) {
    track(
      'Subscribe',
      value: value,
      currency: currency,
      eventId: _uuid(),
      customData: productId == null
          ? null
          : {
              'content_ids': [productId],
            },
    );
  }
}
