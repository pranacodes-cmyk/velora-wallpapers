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
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
