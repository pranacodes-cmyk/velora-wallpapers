import 'dart:convert';

import 'package:flutter/services.dart';

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

  static Future<L10n> load(String lang) async {
    final code = kLanguages.any((l) => l.code == lang) ? lang : kDefaultLang;
    final raw = await rootBundle.loadString('assets/translations/$code.json');
    final map = (jsonDecode(raw) as Map<String, dynamic>).map(
      (k, v) => MapEntry(k, v?.toString() ?? ''),
    );
    final instance = L10n._(code, map);
    _current = instance;
    return instance;
  }

  /// `t("key", { name: "Mohit" })` — supports the web app's `{{token}}` syntax.
  String t(String key, [Map<String, Object?>? vars]) {
    var out = _dict[key] ?? key;
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
