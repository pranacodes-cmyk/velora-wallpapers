import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;

import '../env.dart';
import '../localization/app_localizations.dart';
import 'prefs.dart';
import 'app_log.dart';

/// One Sacred Pause — the verse, its reference and the prayer shown when a
/// guarded app is opened.
class PrayerPause {
  const PrayerPause(this.verse, this.reference, this.prayer);

  final String verse;
  final String reference;
  final String prayer;

  Map<String, String> toJson() => {
    'verse': verse,
    'reference': reference,
    'prayer': prayer,
  };

  static PrayerPause fromJson(Map<String, dynamic> m) => PrayerPause(
    (m['verse'] ?? '').toString(),
    (m['reference'] ?? '').toString(),
    (m['prayer'] ?? '').toString(),
  );
}

/// Server-controlled Sacred Pause prayers.
///
/// The prayers live in the backend table `pray_pauses` (one row per slot and
/// language), so new prayers can be published without a store release. The
/// last successful response is cached on device, and if the network or the
/// backend is unavailable the bundled `ps.pauseN.*` strings are used — the
/// Shield never shows an empty prayer.
class PrayerPauseStore {
  PrayerPauseStore._();

  static const _bundledCount = 40;
  static List<PrayerPause> _pauses = const [];
  static String _lang = '';
  static bool _fetching = false;

  static String _key(String lang) => 'ps_pauses_$lang';

  /// How many prayers the rotation currently cycles through.
  static int get length => _pauses.isNotEmpty ? _pauses.length : _bundledCount;

  /// Loads the cached prayers for [lang] and refreshes them from the server in
  /// the background. Never throws, never blocks the UI.
  static Future<void> load(String lang) async {
    if (_lang != lang) {
      _lang = lang;
      _pauses = const [];
      final cached = Prefs.getString(_key(lang));
      if (cached != null && cached.isNotEmpty) _pauses = _parse(cached);
    }
    await _fetch(lang);
  }

  static List<PrayerPause> _parse(String raw) {
    try {
      final list = jsonDecode(raw) as List<dynamic>;
      final parsed = list
          .whereType<Map<String, dynamic>>()
          .map(PrayerPause.fromJson)
          .where((p) => p.verse.isNotEmpty && p.prayer.isNotEmpty)
          .toList(growable: false);
      return parsed;
    } catch (e) {
      AppLog.error('prayer_pause.parse', e);
      return const [];
    }
  }

  static Future<void> _fetch(String lang) async {
    if (_fetching) return;
    _fetching = true;
    try {
      final uri = Uri.parse(
        '${Env.supabaseUrl}/rest/v1/pray_pauses'
        '?select=slot,verse,reference,prayer&active=eq.true'
        '&lang=eq.$lang&order=slot.asc',
      );
      final res = await http
          .get(
            uri,
            headers: const {
              'apikey': Env.supabaseAnonKey,
              'Authorization': 'Bearer ${Env.supabaseAnonKey}',
            },
          )
          .timeout(const Duration(seconds: 6));
      if (res.statusCode != 200) return;
      final fresh = _parse(utf8.decode(res.bodyBytes));
      if (fresh.isEmpty || lang != _lang) return;
      _pauses = fresh;
      await Prefs.setString(
        _key(lang),
        jsonEncode(fresh.map((p) => p.toJson()).toList()),
      );
    } catch (e) {
      if (kDebugMode) debugPrint('[pray_pauses] fetch failed: $e');
    } finally {
      _fetching = false;
    }
  }

  /// The prayer for a rotation [index]. Falls back to the bundled copy so the
  /// very first launch (offline install) still reads beautifully.
  static PrayerPause at(int index) {
    if (_pauses.isNotEmpty) {
      return _pauses[index.abs() % _pauses.length];
    }
    final l = L10n.current;
    final slot = (index.abs() % _bundledCount) + 1;
    return PrayerPause(
      l.t('ps.pause$slot.verse'),
      l.t('ps.pause$slot.ref'),
      l.t('ps.pause$slot.prayer'),
    );
  }
}
