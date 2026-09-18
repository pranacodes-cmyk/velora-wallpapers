import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:posthog_flutter/posthog_flutter.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'core/env.dart';
import 'core/services/ads_service.dart';
import 'core/services/prefs.dart';
import 'core/services/rating_service.dart';
import 'core/theme/app_theme.dart';
import 'screens/onboarding/onboarding_flow.dart';
import 'screens/onboarding/post_onboarding_premium.dart';
import 'screens/shell.dart';
import 'state/app_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Transparent status bar over the content, same as the web/Capacitor build.
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
    ),
  );

  await Prefs.init();

  // Backend + analytics start in parallel and never block first paint.
  Future.microtask(() async {
    try {
      await Supabase.initialize(
        url: Env.supabaseUrl,
        anonKey: Env.supabaseAnonKey,
      );
    } catch (_) {}
    try {
      await Posthog().setup(
        PostHogConfig(Env.posthogKey)
          ..host = Env.posthogHost
          ..captureApplicationLifecycleEvents = true,
      );
    } catch (_) {}
    // AdMob: initialize and warm the first interstitial in the background,
    // exactly like the web build's `ensureInit()` + `preloadInterstitial()`.
    try {
      await AdsService.init();
    } catch (_) {}
  });

  runApp(const ProviderScope(child: PraylyApp()));
}

class PraylyApp extends ConsumerStatefulWidget {
  const PraylyApp({super.key});

  @override
  ConsumerState<PraylyApp> createState() => _PraylyAppState();
}

class _PraylyAppState extends ConsumerState<PraylyApp> {
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    // Language must be resolved before first paint (all UI text depends on it).
    await ref.read(languageProvider.notifier).bootstrap();
    if (mounted) setState(() => _ready = true);
    // Purchase state reconciles in the background — no blocking dark screen.
    ref.read(premiumProvider.notifier).bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(languageProvider);

    return MaterialApp(
      title: 'Prayly: Bible Prayer & Verse',
      navigatorKey: RatingService.navigatorKey,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      // Same three-way choice the Settings page writes to `cw-theme`.
      themeMode: ref.watch(themeModeProvider),
      home: _ready ? const RootGate() : const _BootScreen(),
    );
  }
}

/// Plain dark boot screen — no branded logo/cross (deliberate: the branded
/// splash was rejected), matching the web build's boot behaviour.
class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) =>
      const ColoredBox(color: Color(0xFF02060F), child: SizedBox.expand());
}

/// Decides between onboarding, the post-onboarding premium handoff and the tab
/// shell — same gate as the web app's `OnboardingProvider` wrapping the router.
class RootGate extends ConsumerStatefulWidget {
  const RootGate({super.key});

  @override
  ConsumerState<RootGate> createState() => _RootGateState();
}

class _RootGateState extends ConsumerState<RootGate> {
  bool _inPremiumHandoff = false;

  @override
  Widget build(BuildContext context) {
    final done = ref.watch(onboardingDoneProvider);

    if (_inPremiumHandoff) {
      return PostOnboardingPremium(
        onFinished: () {
          if (mounted) setState(() => _inPremiumHandoff = false);
        },
      );
    }

    if (!done) {
      return OnboardingFlow(
        onComplete: ({required bool replay, String? focus}) {
          setState(() => _inPremiumHandoff = true);
        },
      );
    }
    return const AppShell();
  }
}
