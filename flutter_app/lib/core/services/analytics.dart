import 'package:posthog_flutter/posthog_flutter.dart';

/// PostHog wrapper. Event names and property keys must stay byte-identical to
/// `src/services/analytics.ts` so existing dashboards and funnels keep working.
class Analytics {
  const Analytics._();

  static Future<void> capture(
    String event, [
    Map<String, Object>? props,
  ]) async {
    try {
      await Posthog().capture(eventName: event, properties: props);
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
