import 'dart:convert';
import 'dart:math';

import 'prefs.dart';

/// 1:1 port of `src/lib/aiPastoralStore.ts` — personal prayer history plus the
/// lifetime free quota (ONE personalized prayer, then the Premium sheet).
class AiPastoralStore {
  AiPastoralStore._();

  static const _prayerKey = 'jw_personal_prayers_v1';
  static const _quotaKey = 'jw_ai_pastoral_quota_v2';
  static const _max = 200;
  static const freeLifetimeLimit = 1;

  static List<SavedPrayer> list() {
    try {
      final raw = Prefs.getString(_prayerKey);
      if (raw == null) return [];
      final arr = jsonDecode(raw);
      if (arr is! List) return [];
      return arr
          .whereType<Map<String, dynamic>>()
          .map(SavedPrayer.fromJson)
          .toList();
    } catch (_) {
      return [];
    }
  }

  static Future<SavedPrayer> save(String topic, String prayer) async {
    final item = SavedPrayer(
      id:
          '${DateTime.now().millisecondsSinceEpoch.toRadixString(36)}-'
          '${Random().nextInt(1 << 30).toRadixString(36)}',
      ts: DateTime.now().millisecondsSinceEpoch,
      topic: topic,
      prayer: prayer,
    );
    final next = [item, ...list()].take(_max).toList();
    await Prefs.setString(
      _prayerKey,
      jsonEncode(next.map((e) => e.toJson()).toList()),
    );
    return item;
  }

  static int _used() {
    try {
      final raw = Prefs.getString(_quotaKey);
      if (raw == null) return 0;
      final m = jsonDecode(raw) as Map<String, dynamic>;
      final used = (m['used'] as num?)?.toInt() ?? 0;
      return used < 0 ? 0 : used;
    } catch (_) {
      return 0;
    }
  }

  static int get remaining {
    final left = freeLifetimeLimit - _used();
    return left < 0 ? 0 : left;
  }

  static Future<int> consume() async {
    final next = _used() + 1;
    await Prefs.setString(_quotaKey, jsonEncode({'used': next}));
    final left = freeLifetimeLimit - next;
    return left < 0 ? 0 : left;
  }
}

class SavedPrayer {
  const SavedPrayer({
    required this.id,
    required this.ts,
    required this.topic,
    required this.prayer,
  });

  final String id;
  final int ts;
  final String topic;
  final String prayer;

  factory SavedPrayer.fromJson(Map<String, dynamic> j) => SavedPrayer(
    id: '${j['id']}',
    ts: (j['ts'] as num?)?.toInt() ?? 0,
    topic: '${j['topic'] ?? ''}',
    prayer: '${j['prayer'] ?? ''}',
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'ts': ts,
    'topic': topic,
    'prayer': prayer,
  };
}
