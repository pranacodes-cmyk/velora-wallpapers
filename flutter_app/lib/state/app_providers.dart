import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/localization/app_localizations.dart';
import '../core/services/daily_reminder_service.dart';
import '../core/services/ios_platform.dart';
import '../core/services/pray_screen_service.dart';
import '../core/services/prayer_pause_store.dart';
import '../core/services/prefs.dart';
import '../core/services/revenuecat_service.dart';

/// ---------------- language ----------------
class LanguageController extends StateNotifier<String> {
  LanguageController() : super(kDefaultLang);

  Future<void> bootstrap() async {
    final saved = Prefs.getString(StorageKeys.lang);
    final device = ui.PlatformDispatcher.instance.locale.toLanguageTag();
    final lang = saved ?? resolveLang(device);
    await L10n.load(lang);
    state = lang;
    IosPlatform.syncState(lang: lang, premium: Prefs.getBool(StorageKeys.premiumUnlocked));
    // Sacred Pause prayers are published from the backend; warm them up (and
    // refresh the on-device cache) without holding the first frame.
    PrayerPauseStore.load(lang);
  }

  Future<void> change(String lang) async {
    await L10n.load(lang);
    await Prefs.setString(StorageKeys.lang, lang);
    state = lang;
    IosPlatform.syncState(lang: lang);
    // Native re-arm + prayer refresh run after the new language has painted,
    // so rapid switching never stalls the UI on platform-channel work.
    Future<void>.delayed(const Duration(milliseconds: 400), () {
      if (state == lang) DailyReminder.sync();
    });
    PrayerPauseStore.load(lang).then((_) {
      PrayScreenService.pushBlockerCopy();
    });
  }
}

final languageProvider = StateNotifierProvider<LanguageController, String>(
  (_) => LanguageController(),
);

/// ---------------- premium ----------------
class PremiumController extends StateNotifier<bool> {
  PremiumController() : super(Prefs.getBool(StorageKeys.premiumUnlocked)) {
    RevenueCatService.addPremiumListener(_onPremiumChanged);
  }

  void _onPremiumChanged(bool active) => state = active;

  /// Every Pro change also reaches the iOS widgets / wallpaper renderer
  /// (no-op on Android and web).
  @override
  set state(bool value) {
    super.state = value;
    IosPlatform.syncState(premium: value);
  }

  @override
  void dispose() {
    RevenueCatService.removePremiumListener(_onPremiumChanged);
    super.dispose();
  }

  /// Cold-start reconciliation: trust the cached snapshot for instant paint,
  /// then confirm with RevenueCat/Play in the background.
  Future<void> bootstrap() async {
    state = Prefs.getBool(StorageKeys.premiumUnlocked);
    await RevenueCatService.init();
    var active = await RevenueCatService.resolvePremium();
    if (!active) active = await RevenueCatService.recoverIfNeeded();
    state = active;
  }

  Future<void> refresh() async {
    state = await RevenueCatService.resolvePremium();
  }

  Future<bool> restore() async {
    final ok = await RevenueCatService.restore();
    state = Prefs.getBool(StorageKeys.premiumUnlocked);
    return ok;
  }

  void setUnlocked() => state = true;
}

final premiumProvider = StateNotifierProvider<PremiumController, bool>(
  (_) => PremiumController(),
);

/// ---------------- onboarding ----------------
class OnboardingController extends StateNotifier<bool> {
  OnboardingController() : super(Prefs.getBool(StorageKeys.onboardingDone));

  Future<void> complete() async {
    await Prefs.setBool(StorageKeys.onboardingDone, true);
    state = true;
  }

  Future<void> replay() async {
    await Prefs.setBool(StorageKeys.onboardingDone, false);
    state = false;
  }
}

final onboardingDoneProvider =
    StateNotifierProvider<OnboardingController, bool>(
      (_) => OnboardingController(),
    );

/// ---------------- user name ----------------
final userNameProvider = StateProvider<String>(
  (_) => Prefs.getString(StorageKeys.userName) ?? '',
);

/// ---------------- theme ----------------
/// Same three options and the same `cw-theme` storage key the web Settings
/// page writes, so a user's choice carries over between the two builds.
class ThemeController extends StateNotifier<ThemeMode> {
  ThemeController() : super(_read());

  static const _key = 'cw-theme';

  static ThemeMode _read() {
    switch (Prefs.getString(_key)) {
      case 'light':
        return ThemeMode.light;
      case 'dark':
        return ThemeMode.dark;
      default:
        return ThemeMode.system;
    }
  }

  Future<void> change(ThemeMode mode) async {
    await Prefs.setString(_key, switch (mode) {
      ThemeMode.light => 'light',
      ThemeMode.dark => 'dark',
      ThemeMode.system => 'system',
    });
    state = mode;
  }
}

final themeModeProvider = StateNotifierProvider<ThemeController, ThemeMode>(
  (_) => ThemeController(),
);

/// ---------------- bottom nav ----------------
final activeTabProvider = StateProvider<int>((_) => 0);

/// Increments whenever Android's full-screen Shield asks Flutter to begin the
/// rewarded Sacred Pause flow. A token avoids losing repeat requests.
final prayScreenLaunchTokenProvider = StateProvider<int>((_) => 0);

/// Hides the floating bottom nav while a quiz run is in progress — mirrors
/// the web's `document.body.dataset.hideNav` toggle in `src/pages/Quiz.tsx`.
final quizNavHiddenProvider = StateProvider<bool>((_) => false);

/// Set by the Quiz page so Android's hardware back first steps *inside* the
/// quiz (abandon run / leave results) exactly like the web history stack,
/// before the page itself closes (`QuizRoutePage`).
final quizBackHandlerProvider = StateProvider<bool Function()?>((_) => null);

/// True while a root-level fullscreen preview (wallpaper detail / live preview)
/// is open, so the tab bar hides exactly like the web `fixed inset-0` overlay.
final fullscreenOverlayProvider = StateProvider<bool>((_) => false);
