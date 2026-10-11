import 'dart:io' show Platform;

import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:posthog_flutter/posthog_flutter.dart';

import 'meta_capi.dart';
import 'prefs.dart';

/// PostHog wrapper. Event names and property keys must stay byte-identical to
/// `src/services/analytics.ts` so existing dashboards and funnels keep working.
class Analytics {
  const Analytics._();

  static Map<String, Object>? _clean(Map<String, Object?>? props) {
    if (props == null) return null;
    final out = <String, Object>{};
    props.forEach((k, v) {
      if (v != null) out[k] = v;
    });
    return out;
  }

  static Future<void> capture(
    String event, [
    Map<String, Object?>? props,
  ]) async {
    try {
      await Posthog().capture(eventName: event, properties: _clean(props));
    } catch (_) {}
  }

  static Future<void> identify(
    String userId, [
    Map<String, Object>? props,
  ]) async {
    try {
      await Posthog().identify(userId: userId, userProperties: props);
    } catch (_) {}
  }

  static Future<void> register(Map<String, Object> props) async {
    try {
      for (final entry in props.entries) {
        await Posthog().register(entry.key, entry.value);
      }
    } catch (_) {}
  }
}

/// Startup context parity with `src/services/analytics.ts`'s `loaded` hook:
/// stable device id super-property, identify, first-open and session_start.
extension AnalyticsBootstrap on Analytics {
  static Future<void> bootstrap() async {
    try {
      var id = Prefs.getString('cw_device_id');
      var firstOpen = false;
      if (id == null || id.isEmpty) {
        id = MetaCapi.deviceId();
        firstOpen = !Prefs.getBool('cw_session_seen');
      }
      await Prefs.setBool('cw_session_seen', true);

      final platform = kIsWeb
          ? 'web'
          : Platform.isIOS
          ? 'ios-native'
          : 'android-native';

      var isBot = false;
      String? botReason;
      try {
        if (!kIsWeb && Platform.isAndroid) {
          final a = await DeviceInfoPlugin().androidInfo;
          if (!a.isPhysicalDevice) {
            isBot = true;
            botReason = 'emulator';
          }
        }
      } catch (_) {}

      await Analytics.register({
        'device_id': id,
        'app': 'Prayly',
        'platform': platform,
        'is_bot': isBot,
        if (botReason != null) 'bot_reason': botReason,
      });
      await Analytics.identify(id);

      if (firstOpen) {
        await Analytics.capture('app_first_open', {'platform': platform});
      }
      await Analytics.capture('session_start', {
        'platform': platform,
        'onboarded': Prefs.getBool(StorageKeys.onboardingDone),
        'is_premium': Prefs.getBool(StorageKeys.premiumUnlocked),
      });
    } catch (_) {}
  }

  /// Registers the active UI language so every event can be segmented per
  /// language — mirrors `setLangContext()` on the web.
  static Future<void> setLang(String lang) =>
      Analytics.register({'app_lang': lang});
}
