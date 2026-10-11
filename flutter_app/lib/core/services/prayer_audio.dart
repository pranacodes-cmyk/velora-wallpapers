import 'dart:convert';

import 'package:http/http.dart' as http;

import 'prefs.dart';

/// 1:1 port of `src/lib/prayerAudio.ts` — narrations live on R2 at a
/// predictable path, are probed once per prayer and cached (misses re-probed
/// after 15 minutes).
class PrayerAudio {
  PrayerAudio._();

  static const r2PublicBase =
      'https://pub-d9ad13d080884ba18697f09f5aa3b7e9.r2.dev';
  static const _cacheKey = 'jw_prayer_audio_manifest_v4';
  static const _missTtlMs = 15 * 60 * 1000;
  static const _probeTimeout = Duration(seconds: 6);

  static String urlFor(int index) =>
      '$r2PublicBase/prayers/daily-prayer-$index.mp3';

  static Map<String, dynamic> _readCache() {
    try {
      final raw = Prefs.getString(_cacheKey);
      if (raw == null) return {};
      return jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      return {};
    }
  }

  static Future<void> _writeCache(Map<String, dynamic> c) async {
    await Prefs.setString(_cacheKey, jsonEncode(c));
  }

  /// true = exists, false = definite 404, null = inconclusive.
  static Future<bool?> _probe(String url) async {
    try {
      final resp = await http.head(Uri.parse(url)).timeout(_probeTimeout);
      if (resp.statusCode == 404) return false;
      if (resp.statusCode >= 200 && resp.statusCode < 400) return true;
      return null;
    } catch (_) {
      return null;
    }
  }

  /// Resolves the narration URL for a prayer index, or null when there is none.
  static Future<String?> resolve(int index) async {
    final url = urlFor(index);
    final key = '$index';
    final cache = _readCache();
    final entry = cache[key];
    if (entry is Map) {
      final available = entry['available'] == true;
      final ts = (entry['ts'] as num?)?.toInt() ?? 0;
      if (available) return url;
      if (DateTime.now().millisecondsSinceEpoch - ts < _missTtlMs) return null;
    }

    final result = await _probe(url);
    // 1:1 of `resolvePrayerAudio` on web: this app only ever runs as a
    // native client, so an inconclusive probe (network blip / WebView-style
    // quirk) must optimistically assume the narration exists rather than
    // hide the "Listen in His voice" button — playback itself handles a
    // truly-missing file gracefully.
    final available = result ?? true;

    // Only persist conclusive results so a flaky probe doesn't poison the
    // cache for the whole miss-TTL window.
    if (result != null) {
      cache[key] = {
        'available': available,
        'ts': DateTime.now().millisecondsSinceEpoch,
      };
      await _writeCache(cache);
    }
    return available ? url : null;
  }
}
