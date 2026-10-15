import 'dart:convert';
import 'prefs.dart';

/// Identical web/Flutter JSON; separate from legacy day completion.
class ProJourneyStudy {
  static const key = 'prayly_pro_journey_study_v2';
  static Map<String, dynamic> _all() {
    try {
      final raw = jsonDecode(Prefs.getString(key) ?? '{}');
      return raw is Map<String, dynamic> ? raw : {};
    } catch (_) { return {}; }
  }
  static Map<String, dynamic> entry(String id, int day) {
    final raw = _all()['$id:$day'];
    return raw is Map<String, dynamic> ? raw : {};
  }
  static Future<void> save(String id, int day, bool read, String note) => Prefs.setString(key, jsonEncode({
    ..._all(), '$id:$day': {'read': read, 'note': note.length > 4000 ? note.substring(0, 4000) : note},
  }));
  static Future<void> resetReading(String id) async {
    final all = _all();
    for (final k in all.keys.toList()) {
      final raw = all[k];
      if (k.startsWith('$id:') && raw is Map<String, dynamic>) all[k] = {...raw, 'read': false};
    }
    await Prefs.setString(key, jsonEncode(all));
  }
}