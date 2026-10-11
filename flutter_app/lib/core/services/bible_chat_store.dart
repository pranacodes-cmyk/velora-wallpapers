import 'dart:convert';

import 'prefs.dart';

/// 1:1 port of `src/pages/Companion.tsx` history persistence and
/// `src/lib/companionQuota.ts` daily free-message quota.
class BibleChatMessage {
  const BibleChatMessage({required this.role, required this.content});

  /// "user" | "assistant" — matches the web `Msg["role"]` union exactly.
  final String role;
  final String content;

  factory BibleChatMessage.fromJson(Map<String, dynamic> j) => BibleChatMessage(
    role: '${j['role'] ?? ''}',
    content: '${j['content'] ?? ''}',
  );

  Map<String, dynamic> toJson() => {'role': role, 'content': content};

  BibleChatMessage copyWith({String? content}) =>
      BibleChatMessage(role: role, content: content ?? this.content);
}

class BibleChatStore {
  BibleChatStore._();

  static const _historyKey = 'jw_companion_history_v1';
  static const _maxHistory = 40;

  static const _quotaKey = 'jw_companion_quota_daily_v1';
  static const _firstDayKey = 'jw_companion_first_day_v1';

  static const firstDayLimit = 5;
  static const returningDailyLimit = 5;

  static List<BibleChatMessage> loadHistory() {
    try {
      final raw = Prefs.getString(_historyKey);
      if (raw == null) return [];
      final arr = jsonDecode(raw);
      if (arr is! List) return [];
      final msgs = arr
          .whereType<Map<String, dynamic>>()
          .map(BibleChatMessage.fromJson)
          .toList();
      if (msgs.length > _maxHistory) {
        return msgs.sublist(msgs.length - _maxHistory);
      }
      return msgs;
    } catch (_) {
      return [];
    }
  }

  static Future<void> saveHistory(List<BibleChatMessage> msgs) async {
    final trimmed = msgs.length > _maxHistory
        ? msgs.sublist(msgs.length - _maxHistory)
        : msgs;
    await Prefs.setString(
      _historyKey,
      jsonEncode(trimmed.map((m) => m.toJson()).toList()),
    );
  }

  static Future<void> clearHistory() async {
    await Prefs.remove(_historyKey);
  }

  static String _todayKey() {
    final now = DateTime.now().toUtc();
    return '${now.year.toString().padLeft(4, '0')}-'
        '${now.month.toString().padLeft(2, '0')}-'
        '${now.day.toString().padLeft(2, '0')}';
  }

  static String _firstDay() {
    var d = Prefs.getString(_firstDayKey);
    if (d == null) {
      d = _todayKey();
      // Fire and forget — mirrors the web's synchronous localStorage write.
      Prefs.setString(_firstDayKey, d);
    }
    return d;
  }

  static int getDailyLimit() =>
      _firstDay() == _todayKey() ? firstDayLimit : returningDailyLimit;

  static Map<String, Object> _readQuota() {
    try {
      final raw = Prefs.getString(_quotaKey);
      if (raw == null) return {'date': _todayKey(), 'used': 0};
      final parsed = jsonDecode(raw) as Map<String, dynamic>;
      if (parsed['date'] != _todayKey()) {
        return {'date': _todayKey(), 'used': 0};
      }
      return {
        'date': parsed['date'],
        'used': (parsed['used'] as num?)?.toInt() ?? 0,
      };
    } catch (_) {
      return {'date': _todayKey(), 'used': 0};
    }
  }

  static int getRemaining() {
    final used = _readQuota()['used'] as int;
    final left = getDailyLimit() - used;
    return left < 0 ? 0 : left;
  }

  static Future<int> consumeMessage() async {
    final state = _readQuota();
    final next = (state['used'] as int) + 1;
    await Prefs.setString(
      _quotaKey,
      jsonEncode({'date': _todayKey(), 'used': next}),
    );
    final left = getDailyLimit() - next;
    return left < 0 ? 0 : left;
  }
}
