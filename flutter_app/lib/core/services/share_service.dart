import 'dart:ui' show PlatformDispatcher, Rect;

import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'analytics.dart';
import 'ios_platform.dart';

/// 1:1 port of `src/utils/nativeShare.ts`.
///
/// Every share ends with the Play Store link so each share is also an organic
/// install opportunity, and the same `share_invoked` analytics event fires.
const _kPlayStoreUrl =
    'https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app';

/// Store link for the platform the user is on (Play on Android/web, App Store
/// on iPhone/iPad) so every share invites friends to the right store.
String get kAppPlayStoreUrl =>
    IosPlatform.isIOS ? IosPlatform.appStoreUrl : _kPlayStoreUrl;

/// iPad presents the share sheet as a popover and needs an anchor; phones and
/// Android ignore it.
Rect? get kShareOrigin {
  if (!IosPlatform.isIOS) return null;
  final views = PlatformDispatcher.instance.views;
  if (views.isEmpty) return null;
  final v = views.first;
  final w = v.physicalSize.width / v.devicePixelRatio;
  final h = v.physicalSize.height / v.devicePixelRatio;
  return Rect.fromLTWH(w / 2 - 1, h * 0.45, 2, 2);
}

class ShareService {
  const ShareService._();

  /// Mirrors the web `withAppLink()` helper exactly.
  static ({String text, String url}) _withAppLink(String? text, String? url) {
    final finalUrl = (url == null || url.isEmpty) ? kAppPlayStoreUrl : url;
    final baseText = (text ?? '').trim();
    // Only skip when the link is already IN THE TEXT — Android's share
    // sheet drops a separate url field in most target apps, so the link
    // must live inside the text payload (mirrors web nativeShare.ts).
    final alreadyHasLink = baseText.contains(kAppPlayStoreUrl);

    final finalText = alreadyHasLink
        ? baseText
        : baseText.isNotEmpty
        ? '$baseText\n\n📲 Get the app: $kAppPlayStoreUrl'
        : '📲 Get Prayly: Bible Prayer & Verse: $kAppPlayStoreUrl';

    return (text: finalText, url: finalUrl);
  }

  static void _report(String method, String status, String? title) {
    Analytics.capture('share_invoked', {
      'method': method,
      'status': status,
      'title': title,
    });
  }

  /// Opens the OS share sheet; falls back to the clipboard when unavailable.
  static Future<void> share({
    String? title,
    String? text,
    String? url,
    String? dialogTitle,
    bool includeAppLink = true,
  }) async {
    final composed = includeAppLink
        ? _withAppLink(text, url)
        : (text: text ?? '', url: url ?? '');

    // The web build passes text + url separately; Android's share sheet only
    // carries one text payload, so the link is appended (same final string the
    // Capacitor plugin produced).
    final payload =
        composed.url.isNotEmpty && !composed.text.contains(composed.url)
        ? '${composed.text}\n${composed.url}'
        : composed.text;

    try {
      final result = await SharePlus.instance.share(
        ShareParams(text: payload, subject: title, sharePositionOrigin: kShareOrigin),
      );

      _report(
        'native',
        result.status == ShareResultStatus.dismissed ? 'cancelled' : 'shown',
        title,
      );
      return;
    } catch (_) {
      // Fall through to the clipboard fallback.
    }

    try {
      await Clipboard.setData(ClipboardData(text: payload));
      _report('clipboard', 'copied', title);
    } catch (_) {
      _report('clipboard', 'failed', title);
    }
  }
}
