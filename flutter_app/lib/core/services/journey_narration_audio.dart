import 'dart:convert';

import 'package:http/http.dart' as http;

import 'prayer_audio.dart';
import 'prefs.dart';

/// Journey narration files are generated on R2 by `generate-day-narration`.
/// This resolver mirrors the web player without blocking the screen on misses.
class JourneyNarrationAudio {
  JourneyNarrationAudio._();

  static const _cacheKey = 'jw_journey_audio_manifest_v1';
  static const _missTtlMs = 15 * 60 * 1000;
  static const _probeTimeout = Duration(seconds: 6);

  static String _safeKey(String value) => value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r'[^a-z0-9_-]+'), '-')
      .replaceAll(RegExp(r'^-+|-+$'), '');

  static String urlFor(String journeyId, int day) =>
      '${PrayerAudio.r2PublicBase}/narrations/${_safeKey(journeyId)}-day$day.mp3';

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

  static Future<String?> resolve(String journeyId, int day) async {
    final url = urlFor(journeyId, day);
    final key = '${_safeKey(journeyId)}::$day';
    final cache = _readCache();
    final entry = cache[key];
    if (entry is Map) {
      final available = entry['available'] == true;
      final ts = (entry['ts'] as num?)?.toInt() ?? 0;
      if (available) return url;
      if (DateTime.now().millisecondsSinceEpoch - ts < _missTtlMs) return null;
    }

    final exists = await _probe(url);
    if (exists == null) return null;
    cache[key] = {
      'available': exists,
      'ts': DateTime.now().millisecondsSinceEpoch,
    };
    await _writeCache(cache);
    return exists ? url : null;
  }
}
