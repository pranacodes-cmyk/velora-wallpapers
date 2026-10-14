import 'dart:async';
import 'dart:convert';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'backend_service.dart';
import 'challenge_store.dart';
import 'prefs.dart';

/// 75 Days of Light — family & friend circles.
/// Web mirror: `src/services/challengeCircle.ts` (same keys, same backend).
///
/// No account needed: the device keeps a private random secret, the backend
/// stores only its hash. Shared with a circle: display name, emoji avatar and
/// progress counts. Reflections never leave the device.
const _identityKey = 'prayly_challenge_identity_v1';
const _overviewKey = 'prayly_challenge_circles_cache_v1';

const kCircleAvatars = ['🐑', '🕊️', '🦁', '⭐', '🌊', '🌿', '🔥', '🌻', '⛰️', '🌸', '🌙', '☀️'];
const kCircleEmojis = ['🪔', '🏡', '❤️', '⛪', '🙏', '✨', '🌿', '👨‍👩‍👧'];

class CircleIdentity {
  const CircleIdentity(this.memberId, this.secret, this.name, this.avatar);
  final String memberId;
  final String secret;
  final String name;
  final String avatar;
  Map<String, String> toJson() => {'memberId': memberId, 'secret': secret, 'name': name, 'avatar': avatar};
}

class CircleMember {
  CircleMember.fromJson(Map<String, dynamic> j)
      : id = '${j['id'] ?? ''}',
        name = '${j['name'] ?? ''}',
        avatar = '${j['avatar'] ?? '🕊️'}',
        mode = '${j['mode'] ?? 'grace'}',
        started = j['started'] == true,
        completedDays = _int(j['completedDays']),
        streak = _int(j['streak']),
        bestStreak = _int(j['bestStreak']),
        litToday = j['litToday'] == true,
        todayDone = _int(j['todayDone']),
        isPro = j['isPro'] == true,
        isMe = j['isMe'] == true,
        sentToday = (j['sentToday'] is List) ? (j['sentToday'] as List).map((e) => '$e').toList() : <String>[];
  final String id;
  final String name;
  final String avatar;
  final String mode;
  final bool started;
  final int completedDays;
  final int streak;
  final int bestStreak;
  final bool litToday;
  final int todayDone;
  final bool isPro;
  final bool isMe;
  final List<String> sentToday;
}

class Circle {
  Circle.fromJson(Map<String, dynamic> j)
      : id = '${j['id'] ?? ''}',
        code = '${j['code'] ?? ''}',
        name = '${j['name'] ?? ''}',
        emoji = '${j['emoji'] ?? '🪔'}',
        isOwner = j['isOwner'] == true,
        members = (j['members'] is List)
            ? (j['members'] as List).whereType<Map>().map((m) => CircleMember.fromJson(Map<String, dynamic>.from(m))).toList()
            : <CircleMember>[],
        litToday = _int(j['litToday']),
        totalDays = _int(j['totalDays']),
        flame = (j['flame'] is num) ? (j['flame'] as num).toDouble() : 0;
  final String id;
  final String code;
  final String name;
  final String emoji;
  final bool isOwner;
  final List<CircleMember> members;
  final int litToday;
  final int totalDays;
  final double flame;
}

class Cheer {
  Cheer.fromJson(Map<String, dynamic> j)
      : id = '${j['id'] ?? ''}',
        kind = '${j['kind'] ?? 'cheer'}',
        circleId = '${j['circleId'] ?? ''}',
        fromName = '${j['fromName'] ?? ''}',
        fromAvatar = '${j['fromAvatar'] ?? '🕊️'}';
  final String id;
  final String kind; // cheer | pray | nudge
  final String circleId;
  final String fromName;
  final String fromAvatar;
}

class CircleOverview {
  const CircleOverview(this.circles, this.cheers, this.raw);
  final List<Circle> circles;
  final List<Cheer> cheers;
  final Map<String, dynamic> raw;

  static CircleOverview parse(Map<String, dynamic> j) => CircleOverview(
        (j['circles'] is List)
            ? (j['circles'] as List).whereType<Map>().map((c) => Circle.fromJson(Map<String, dynamic>.from(c))).toList()
            : <Circle>[],
        (j['cheers'] is List)
            ? (j['cheers'] as List).whereType<Map>().map((c) => Cheer.fromJson(Map<String, dynamic>.from(c))).toList()
            : <Cheer>[],
        j,
      );
}

int _int(Object? v) => v is num ? v.toInt() : 0;

class CircleError implements Exception {
  const CircleError(this.code);
  final String code;

  /// Translation key for this error (same set as the web `circleErrorKey`).
  String get key {
    const known = ['circle_not_found', 'circle_full', 'too_many_circles', 'bad_code', 'network'];
    return 'ch.circle.err.${known.contains(code) ? code : 'generic'}';
  }

  @override
  String toString() => 'CircleError($code)';
}

String circleErrorKey(Object err) => err is CircleError ? err.key : 'ch.circle.err.generic';

class ChallengeCircleService {
  ChallengeCircleService._();

  /// Bumps when identity or the cached overview changes.
  static final revision = ValueNotifier<int>(0);

  /* ── identity + cache ───────────────────────────────────────────────── */

  static CircleIdentity? get identity {
    try {
      final raw = Prefs.getString(_identityKey);
      if (raw == null) return null;
      final j = jsonDecode(raw) as Map<String, dynamic>;
      final id = j['memberId'], secret = j['secret'];
      if (id is! String || secret is! String || id.isEmpty || secret.isEmpty) return null;
      return CircleIdentity(id, secret, '${j['name'] ?? ''}', '${j['avatar'] ?? kCircleAvatars.first}');
    } catch (_) {
      return null;
    }
  }

  static void _saveIdentity(CircleIdentity i) {
    Prefs.setString(_identityKey, jsonEncode(i.toJson()));
    revision.value++;
  }

  static CircleOverview? get cached {
    try {
      final raw = Prefs.getString(_overviewKey);
      if (raw == null) return null;
      return CircleOverview.parse(jsonDecode(raw) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  static CircleOverview _cache(Map<String, dynamic> res) {
    final value = <String, dynamic>{
      'circles': res['circles'] ?? const [],
      'cheers': res['cheers'] ?? const [],
      'fetchedAt': DateTime.now().millisecondsSinceEpoch,
    };
    Prefs.setString(_overviewKey, jsonEncode(value));
    revision.value++;
    return CircleOverview.parse(value);
  }

  static String _randomSecret() {
    final r = math.Random.secure();
    return List.generate(32, (_) => r.nextInt(256).toRadixString(16).padLeft(2, '0')).join();
  }

  /* ── transport ──────────────────────────────────────────────────────── */

  static Future<Map<String, dynamic>> _call(String action, [Map<String, Object?> payload = const {}, bool auth = true]) async {
    final id = auth ? identity : null;
    if (auth && id == null) throw const CircleError('no_identity');
    final body = <String, Object?>{
      'action': action,
      'today': ChallengeStore.localDate(),
      if (id != null) 'memberId': id.memberId,
      if (id != null) 'secret': id.secret,
      ...payload,
    };
    try {
      await BackendService.ensure();
      final res = await Supabase.instance.client.functions.invoke('challenge-circle', body: body);
      final data = res.data;
      final map = data is Map ? Map<String, dynamic>.from(data) : data is String ? jsonDecode(data) as Map<String, dynamic> : <String, dynamic>{};
      if (map['error'] != null) throw CircleError('${map['error']}');
      return map;
    } on CircleError {
      rethrow;
    } on FunctionException catch (e) {
      final d = e.details;
      String code = 'network';
      if (d is Map && d['error'] != null) {
        code = '${d['error']}';
      } else if (d is String) {
        try {
          final m = jsonDecode(d);
          if (m is Map && m['error'] != null) code = '${m['error']}';
        } catch (_) {}
      }
      throw CircleError(code);
    } catch (_) {
      throw const CircleError('network');
    }
  }

  static Map<String, Object?> progressPayload([ChallengeState? s]) {
    final st = s ?? ChallengeStore.state;
    final today = ChallengeStore.localDate();
    return {
      'mode': st.mode,
      'startedOn': st.startedOn,
      'completedDays': ChallengeStore.completedCount(st),
      'currentStreak': ChallengeStore.liveStreak(st, today),
      'bestStreak': st.bestStreak,
      'lastLitOn': st.lastLitOn,
      'todayOn': today,
      'todayDone': ChallengeStore.tasksDoneToday(st, today).length,
      'attempts': st.attempts,
      'isPro': Prefs.getBool(StorageKeys.premiumUnlocked),
    };
  }

  /* ── actions ────────────────────────────────────────────────────────── */

  static Future<CircleIdentity> ensureIdentity(String name, String avatar, String lang) async {
    final existing = identity;
    if (existing != null) {
      if (existing.name != name || existing.avatar != avatar) {
        await _call('profile', {'name': name, 'avatar': avatar, 'lang': lang});
        _saveIdentity(CircleIdentity(existing.memberId, existing.secret, name, avatar));
      }
      return CircleIdentity(existing.memberId, existing.secret, name, avatar);
    }
    final secret = _randomSecret();
    final res = await _call('register', {
      'secret': secret,
      'name': name,
      'avatar': avatar,
      'lang': lang,
      'progress': progressPayload(),
    }, false);
    final next = CircleIdentity('${res['memberId']}', secret, name, avatar);
    _saveIdentity(next);
    return next;
  }

  static Future<CircleOverview> fetchOverview() async => _cache(await _call('overview'));

  static Future<String> createCircle(String name, String emoji) async {
    final res = await _call('create_circle', {'name': name, 'emoji': emoji});
    _cache(res);
    return '${res['circleId']}';
  }

  static Future<String> joinCircle(String code) async {
    final res = await _call('join_circle', {'code': code});
    _cache(res);
    return '${res['circleId']}';
  }

  static Future<CircleOverview> leaveCircle(String circleId) async =>
      _cache(await _call('leave_circle', {'circleId': circleId}));

  static Future<void> sendCheer(String circleId, String toMember, String kind) async {
    await _call('cheer', {'circleId': circleId, 'toMember': toMember, 'kind': kind});
  }

  static Future<void> markCheersSeen(List<String> ids) async {
    if (ids.isEmpty) return;
    await _call('seen', {'ids': ids});
    final c = cached;
    if (c != null) {
      final raw = Map<String, dynamic>.from(c.raw);
      raw['cheers'] = (raw['cheers'] is List)
          ? (raw['cheers'] as List).where((x) => x is Map && !ids.contains('${x['id']}')).toList()
          : const [];
      _cache(raw);
    }
  }

  static Timer? _syncTimer;

  /// Push local progress to the backend (debounced, silent on failure).
  static void scheduleProgressSync([Duration delay = const Duration(milliseconds: 1200)]) {
    if (identity == null) return;
    _syncTimer?.cancel();
    _syncTimer = Timer(delay, () {
      _syncTimer = null;
      _call('sync', {'progress': progressPayload()}).catchError((_) => <String, dynamic>{});
    });
  }

  /* ── Journey buddies (web mirror: buddiesOf / myBuddyCode) ─────────── */

  static const _buddyCodeKey = 'prayly_buddy_code_v1';

  /// Everyone who shares any circle with me, most progress first.
  static List<(CircleMember, String)> buddies([CircleOverview? o]) {
    final seen = <String, (CircleMember, String)>{};
    for (final c in (o ?? cached)?.circles ?? const <Circle>[]) {
      for (final m in c.members) {
        if (!m.isMe && !seen.containsKey(m.id)) seen[m.id] = (m, c.id);
      }
    }
    final list = seen.values.toList()..sort((a, b) => b.$1.completedDays.compareTo(a.$1.completedDays));
    return list;
  }

  /// My personal buddy code (my own walk circle), created on first use.
  static Future<String> myBuddyCode() async {
    final saved = Prefs.getString(_buddyCodeKey);
    if (saved != null && saved.isNotEmpty) return saved;
    var o = cached;
    o ??= await fetchOverview().catchError((_) => const CircleOverview([], [], {}));
    Circle? own;
    for (final c in o.circles) {
      if (c.isOwner) { own = c; break; }
    }
    var code = own?.code ?? '';
    if (code.isEmpty) {
      final id = await createCircle('Journey', '🐑');
      for (final c in cached?.circles ?? const <Circle>[]) {
        if (c.id == id) code = c.code;
      }
    }
    if (code.isEmpty) throw const CircleError('network');
    Prefs.setString(_buddyCodeKey, code);
    return code;
  }
}
