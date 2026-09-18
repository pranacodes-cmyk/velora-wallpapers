import 'dart:ui' as ui;

import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/localization/app_localizations.dart';
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
  }

  Future<void> change(String lang) async {
    await L10n.load(lang);
    await Prefs.setString(StorageKeys.lang, lang);
    state = lang;
  }
}

final languageProvider = StateNotifierProvider<LanguageController, String>(
  (_) => LanguageController(),
);

/// ---------------- premium ----------------
class PremiumController extends StateNotifier<bool> {
  PremiumController() : super(Prefs.getBool(StorageKeys.premiumUnlocked));

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
    state = ok;
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

/// Hides the floating bottom nav while a quiz run is in progress — mirrors
/// the web's `document.body.dataset.hideNav` toggle in `src/pages/Quiz.tsx`.
final quizNavHiddenProvider = StateProvider<bool>((_) => false);
