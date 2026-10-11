import 'package:flutter/foundation.dart';

import 'prefs.dart';

/// 1:1 port of `src/lib/userProfile.ts` — same keys and same focus handling.
enum UserFocus { anxiety, gratitude, strength, healing, doubt, closer }

class FocusMeta {
  const FocusMeta(this.label, this.emoji, this.line);
  final String label;
  final String emoji;
  final String line;
}

const kFocusMeta = <UserFocus, FocusMeta>{
  UserFocus.anxiety: FocusMeta('Peace', '🌊', 'Quieting an anxious mind'),
  UserFocus.gratitude: FocusMeta(
    'Gratitude',
    '🌅',
    'A heart that gives thanks',
  ),
  UserFocus.strength: FocusMeta('Strength', '🛡️', "Courage for what's ahead"),
  UserFocus.healing: FocusMeta('Healing', '🌿', 'Mending a heavy heart'),
  UserFocus.doubt: FocusMeta('Faith', '🕊️', 'Rebuilding belief, gently'),
  UserFocus.closer: FocusMeta('Closer', '✝️', 'A deeper walk with God'),
};

class UserProfile {
  UserProfile._();

  static const _focusKey = 'cw_user_focus';
  static const _nameKey = 'cw_user_name';

  static final revision = ValueNotifier<int>(0);

  static UserFocus? focus() {
    final raw = Prefs.getString(_focusKey);
    if (raw == null) return null;
    return UserFocus.values.where((f) => f.name == raw).firstOrNull;
  }

  static String? name() {
    final raw = Prefs.getString(_nameKey)?.trim();
    return (raw == null || raw.isEmpty) ? null : raw;
  }

  static Future<void> setName(String value) async {
    await Prefs.setString(_nameKey, value.trim());
    revision.value++;
  }

  static Future<void> setFocus(UserFocus focus) async {
    await Prefs.setString(_focusKey, focus.name);
    revision.value++;
  }

  // ---------------- journey unlocks ----------------
  /// 1:1 with web `isJourneyFreeForUser` in `src/lib/userProfile.ts`: a
  /// premium journey is free for this user once it has been unlocked (stored
  /// as a comma-joined id list — Prefs has no string-list helper).
  static const _unlockedJourneysKey = 'cw_unlocked_journeys';

  static Set<String> _unlockedJourneys() {
    final raw = Prefs.getString(_unlockedJourneysKey) ?? '';
    return raw.split(',').where((s) => s.isNotEmpty).toSet();
  }

  static bool isJourneyFreeForUser(String id, bool isPremium) {
    if (!isPremium) return true;
    return _unlockedJourneys().contains(id);
  }

  static Future<void> unlockJourney(String id) async {
    final set = _unlockedJourneys()..add(id);
    await Prefs.setString(_unlockedJourneysKey, set.join(','));
    revision.value++;
  }

  /// 1:1 with web `focusToJourneyId` in `src/lib/userProfile.ts`.
  static String focusToJourneyId(UserFocus? focus) {
    switch (focus) {
      case UserFocus.anxiety:
        return 'anxiety-peace';
      case UserFocus.strength:
        return 'strength-hard-times';
      case UserFocus.healing:
        return 'healing';
      case UserFocus.gratitude:
        return 'gratitude-joy';
      case UserFocus.doubt:
        return 'building-faith';
      case UserFocus.closer:
        return 'purpose-calling';
      case null:
        return 'anxiety-peace';
    }
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
