import 'package:shared_preferences/shared_preferences.dart';

/// Thin synchronous wrapper around SharedPreferences.
/// Storage keys are the exact same strings the web app uses in localStorage,
/// so behaviour (streaks, favorites, premium snapshot, onboarding) is identical.
class Prefs {
  Prefs._();

  static SharedPreferences? _p;

  static Future<void> init() async {
    _p ??= await SharedPreferences.getInstance();
  }

  static String? getString(String key) => _p?.getString(key);
  static Future<void> setString(String key, String value) async =>
      _p?.setString(key, value);

  static bool getBool(String key, {bool fallback = false}) =>
      _p?.getBool(key) ?? fallback;
  static Future<void> setBool(String key, bool value) async =>
      _p?.setBool(key, value);

  static int getInt(String key, {int fallback = 0}) =>
      _p?.getInt(key) ?? fallback;
  static Future<void> setInt(String key, int value) async =>
      _p?.setInt(key, value);

  static Future<void> remove(String key) async => _p?.remove(key);

  /// Wipes everything except the given keys — the web Settings "Delete my
  /// data" row does exactly this (clears localStorage, keeps `cw-theme`).
  static Future<void> clearExcept(Set<String> keep) async {
    final store = _p;
    if (store == null) return;
    for (final key in store.getKeys().toList()) {
      if (!keep.contains(key)) await store.remove(key);
    }
  }
}

/// Storage keys shared with the web app — never rename these.
class StorageKeys {
  const StorageKeys._();

  static const lang = 'app-lang';
  static const premiumUnlocked = 'cw_premium_unlocked';
  static const freeTestMode = 'cw_free_test_mode';
  static const adFreeUntil = 'cw_ad_free_until';
  // Web writes this on completion (`cw_onboarded_v3` in OnboardingFlow.tsx).
  static const onboardingDone = 'cw_onboarded_v3';
  static const onboardingDoneAt = 'cw_onboarded_v3_at';
  static const onboardingReplay = 'cw_onboarding_replay_active';
  static const userFocus = 'cw_user_focus';
  static const userTime = 'cw_user_time';
  static const userName = 'cw_user_name';
  static const favorites = 'cw_favorites';
  static const streakCount = 'cw_streak_count';
  static const streakLastDay = 'cw_streak_last_day';
}
