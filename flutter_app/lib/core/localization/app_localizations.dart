import 'dart:convert';

import 'package:flutter/foundation.dart' show compute;
import 'package:flutter/services.dart';
import '../services/ota_service.dart';

/// Supported languages — exact copy of `src/i18n/config.ts`.
class AppLanguage {
  const AppLanguage(this.code, this.label, this.native, this.flag);
  final String code;
  final String label;
  final String native;
  final String flag;
}

const kLanguages = <AppLanguage>[
  AppLanguage('en', 'English', 'English', '🇺🇸'),
  AppLanguage('es', 'Spanish', 'Español', '🇪🇸'),
  AppLanguage('pt', 'Portuguese', 'Português (BR)', '🇧🇷'),
  AppLanguage('fil', 'Filipino', 'Filipino', '🇵🇭'),
  AppLanguage('hi', 'Hindi', 'हिन्दी', '🇮🇳'),
  AppLanguage('id', 'Indonesian', 'Bahasa Indonesia', '🇮🇩'),
  AppLanguage('fr', 'French', 'Français', '🇫🇷'),
  AppLanguage('de', 'German', 'Deutsch', '🇩🇪'),
];

const kDefaultLang = 'en';
const kLangStorageKey = 'app-lang';

/// Maps any device/BCP-47 tag onto a supported language (same rules as web).
String resolveLang(String? tag) {
  if (tag == null || tag.isEmpty) return kDefaultLang;
  final base = tag.toLowerCase().split(RegExp(r'[-_]')).first;
  if (base == 'tl' || base == 'tgl' || base == 'fil') return 'fil';
  if (base == 'pt') return 'pt';
  final hit = kLanguages.where((l) => l.code == base);
  return hit.isEmpty ? kDefaultLang : hit.first.code;
}

/// Runtime dictionary loaded from `assets/translations/<lang>.json`.
/// Those files are generated from the web app's i18n modules by
/// `bun scripts/export-i18n-flutter.mjs`, guaranteeing string parity.
class L10n {
  L10n._(this.lang, this._dict);

  final String lang;
  final Map<String, String> _dict;

  static L10n? _current;
  static L10n get current => _current ?? L10n._(kDefaultLang, const {});

  /// Runs on a background isolate: the dictionaries are ~1 MB of JSON and
  /// decoding them on the UI isolate delayed the very first frame (the
  /// onboarding language picker appeared late).
  static Map<String, String> _decode(String raw) =>
      (jsonDecode(raw) as Map<String, dynamic>).map(
        (k, v) => MapEntry(k, v?.toString() ?? ''),
      );

  /// Merged dictionaries already built this session. Switching languages
  /// back and forth used to re-read + re-decode ~1 MB of JSON (twice, with
  /// English) on every tap, which froze the mockups mid-swipe.
  static final Map<String, L10n> _cache = {};
  static final Map<String, Future<L10n>> _inflight = {};

  static Future<L10n> load(String lang) {
    final code = kLanguages.any((l) => l.code == lang) ? lang : kDefaultLang;
    final hit = _cache[code];
    if (hit != null) {
      _current = hit;
      return Future.value(hit);
    }
    return _inflight[code] ??= _build(code).then((i) {
      _cache[code] = i;
      _inflight.remove(code);
      return i;
    });
  }

  static Map<String, String>? _englishCache;

  static Future<L10n> _build(String code) async {
    final assetPath = 'assets/translations/$code.json';
    final raw = await OtaService.loadString(assetPath);
    // An older OTA translation bundle can legitimately predate newly shipped
    // onboarding keys. Merge it over the APK dictionary instead of replacing
    // the APK dictionary wholesale, so raw keys can never leak into the UI.
    final bundledRaw = await rootBundle.loadString(assetPath);
    // Spawning an isolate costs more than the decode itself for the small
    // dictionaries (English is ~60 KB), so only the big translated ones pay it.
    final bundled = bundledRaw.length > 250000
        ? await compute(_decode, bundledRaw)
        : _decode(bundledRaw);
    final english = code == kDefaultLang
        ? (_englishCache ??= bundled)
        : (_englishCache ??= _decode(
            await rootBundle.loadString(
              'assets/translations/$kDefaultLang.json',
            ),
          ));
    final downloaded = raw == bundledRaw
        ? const <String, String>{}
        : raw.length > 250000
        ? await compute(_decode, raw)
        : _decode(raw);
    // Never let malformed/stale OTA entries such as
    // `"jn.header.title": "jn.header.title"` replace real bundled copy.
    final validDownloaded = Map<String, String>.fromEntries(
      downloaded.entries.where(
        (entry) => entry.value.trim().isNotEmpty && entry.value != entry.key,
      ),
    );
    final map = <String, String>{
      ...english,
      ...bundled,
      ...validDownloaded,
    };
    final instance = L10n._(code, map);
    _current = instance;
    return instance;
  }

  /// `t("key", { name: "Mohit" })` — supports the web app's `{{token}}` syntax.
  String t(String key, [Map<String, Object?>? vars]) {
    final hit = _dict[key];
    var out = hit == null || hit.isEmpty || hit == key ? '' : hit;
    if (vars != null) {
      vars.forEach((k, v) {
        out = out.replaceAll('{{$k}}', '${v ?? ''}');
      });
    }
    return out;
  }

  /// Content lookup that returns null when a key is missing — mirrors the web
  /// app's `tc()` so translated Bible content falls back to the English source.
  String? tcRaw(String key) {
    final hit = _dict[key];
    if (hit == null || hit.isEmpty) return null;
    return hit;
  }
}

String t(String key, [Map<String, Object?>? vars]) => L10n.current.t(key, vars);

/// `tc("v.John 3:16")` → translated verse text, or null when untranslated.
String? tc(String key) => L10n.current.tcRaw(key);
