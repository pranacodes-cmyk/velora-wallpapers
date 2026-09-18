import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';

import 'analytics.dart';

/// 1:1 port of `src/utils/nativeShare.ts`.
///
/// Every share ends with the Play Store link so each share is also an organic
/// install opportunity, and the same `share_invoked` analytics event fires.
const kAppPlayStoreUrl =
    'https://play.google.com/store/apps/details?id=com.jesuswallpaperbible.app';

class ShareService {
  const ShareService._();

  /// Mirrors the web `withAppLink()` helper exactly.
  static ({String text, String url}) _withAppLink(String? text, String? url) {
    final finalUrl = (url == null || url.isEmpty) ? kAppPlayStoreUrl : url;
    final baseText = (text ?? '').trim();
    final alreadyHasLink =
        baseText.contains(kAppPlayStoreUrl) || finalUrl == kAppPlayStoreUrl;

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
        ShareParams(text: payload, subject: title),
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
