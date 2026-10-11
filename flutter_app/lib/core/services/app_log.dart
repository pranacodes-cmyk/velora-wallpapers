import 'package:flutter/foundation.dart';

import 'analytics.dart';

/// Lightweight failure breadcrumb.
///
/// Critical paths (purchases, unlocks, progress saves) used to swallow their
/// errors silently, which made production issues invisible. `AppLog.error`
/// prints in debug builds and — for release — ships a single lean PostHog
/// event so the same failure can be spotted on the dashboard without any
/// personal data leaving the device.
class AppLog {
  const AppLog._();

  static void error(String scope, Object? err, [Map<String, Object?>? extra]) {
    final message = err?.toString() ?? 'unknown';
    if (kDebugMode) {
      debugPrint('[$scope] $message${extra == null ? '' : ' $extra'}');
      return;
    }
    Analytics.capture('app_error', {
      'scope': scope,
      // Keep it short: dashboards only need the signature, not a stack dump.
      'message': message.length > 180 ? message.substring(0, 180) : message,
      ...?extra,
    });
  }
}
