import 'dart:convert';

import 'package:flutter/foundation.dart';

import 'prefs.dart';

/// 1:1 port of `src/lib/userProfile.ts` — same keys, same focus → journey map,
/// same free-unlock behaviour for the journey matching the onboarding focus.
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
  static const _unlockedJourneysKey = 'cw_unlocked_journeys';

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
    await addUnlockedJourney(focusToJourneyId(focus));
    revision.value++;
  }

  static List<String> unlockedJourneys() {
    try {
      final raw = Prefs.getString(_unlockedJourneysKey);
      if (raw == null) return const [];
      return (jsonDecode(raw) as List).map((e) => e.toString()).toList();
    } catch (_) {
      return const [];
    }
  }

  static Future<void> addUnlockedJourney(String journeyId) async {
    final current = unlockedJourneys();
    if (current.contains(journeyId)) return;
    await Prefs.setString(
      _unlockedJourneysKey,
      jsonEncode([...current, journeyId]),
    );
    revision.value++;
  }

  static bool isJourneyFreeForUser(String journeyId, bool isPremiumJourney) {
    if (!isPremiumJourney) return true;
    return unlockedJourneys().contains(journeyId);
  }
}

/// Maps a chosen focus to the best-fit journey id in the journey dataset.
String focusToJourneyId(UserFocus? focus) {
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
    default:
      return 'anxiety-peace';
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
