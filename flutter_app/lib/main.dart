import 'core/services/daily_reminder_service.dart';
import 'dart:ui' show PlatformDispatcher;

import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import 'core/env.dart';
import 'core/app_tabs.dart';
import 'core/services/ads_service.dart';
import 'core/services/analytics.dart';
import 'core/services/backend_service.dart';
import 'core/services/content_push_service.dart';
import 'core/services/meta_events.dart';
import 'core/services/ota_service.dart';
import 'core/services/prefs.dart';
import 'core/services/rating_service.dart';
import 'core/services/telemetry.dart';
import 'core/theme/app_colors.dart';
import 'core/theme/app_theme.dart';
import 'screens/onboarding/onboarding_flow.dart';
import 'screens/onboarding/post_onboarding_premium.dart';
import 'screens/shell.dart';
import 'state/app_providers.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Error capture + cold-start clock. Web screenshot harness below overrides
  // the handlers again for CI, which is fine.
  if (!kIsWeb) Telemetry.markMain();

  assert(() {
    debugPaintBaselinesEnabled = false;
    debugPaintSizeEnabled = false;
    debugPaintPointersEnabled = false;
    debugPaintLayerBordersEnabled = false;
    debugRepaintRainbowEnabled = false;
    return true;
  }());

  // Transparent status bar over the content, same as the web/Capacitor build.
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
    ),
  );

  await Prefs.init();

  // ---- visual-parity screenshot harness (web build only) ----
  // `?shot=1&tab=2` skips onboarding and opens a given tab so CI can capture
  // every screen and diff it against the React reference build.
  var initialTab = 0;
  if (kIsWeb) {
    final q = Uri.base.queryParameters;
    final shot = q['shot'];
    if (shot != null) {
      // CI must not inherit an old browser/system light-theme preference.
      await Prefs.setString('cw-theme', q['theme'] ?? 'dark');
      await Prefs.setBool(StorageKeys.onboardingDone, shot != 'onboarding');
      // Four tabs: Today / PrayScreen / Wallpapers / Quiz.
      initialTab = (int.tryParse(q['tab'] ?? '') ?? 0).clamp(
        0,
        AppTabs.lastIndex,
      );

      // Diagnostics for the CI screenshot runs: a release web build swallows
      // widget build failures into a blank grey box, which is exactly how the
      // wallpapers grid "disappeared". Surface the real message both in the
      // browser console and on screen so a screenshot is self-explanatory.
      FlutterError.onError = (details) {
        // ignore: avoid_print
        print(
          'FLUTTER_ERROR: ${details.exceptionAsString()}\n'
          'LIBRARY: ${details.library}\n'
          'CONTEXT: ${details.context}\n'
          '${details.stack}',
        );
        FlutterError.dumpErrorToConsole(details);
      };
      PlatformDispatcher.instance.onError = (error, stack) {
        // ignore: avoid_print
        print('PLATFORM_ERROR: $error\n$stack');
        return true;
      };
      ErrorWidget.builder = (details) => Container(
        padding: const EdgeInsets.all(8),
        color: const Color(0xFFB00020),
        child: Text(
          details.exceptionAsString(),
          style: const TextStyle(color: Colors.white, fontSize: 10),
        ),
      );
    }
  }

  // Backend + analytics start after the first frame is on screen. A microtask
  // here still competed with startup for the UI isolate and the platform
  // channels (AdMob/consent is the heaviest), which made a fresh install feel
  // slow before anything was drawn.
  WidgetsBinding.instance.addPostFrameCallback((_) {
    // Meta attribution runs on its very own chain and is never gated behind
    // another SDK: install + app_open must fire on the first session no matter
    // how slow AdMob, PostHog or the backend are. Only the ordering moved off
    // the startup path — nothing about the tracking itself changed.
    if (!kIsWeb) {
      MetaEvents.init().catchError((_) {}).whenComplete(() {
        // Install + app open are auto-logged by the native Meta SDK with
        // full attribution; no duplicate server copies.
      });
    }

    // Everything else in parallel. Each one is independently guarded, so a
    // hanging SDK can never hold the others (or Meta) back.
    Future(() async {
      await Future.wait<void>([
        BackendService.ensure().catchError((_) {}),
        Posthog()
            .setup(
              PostHogConfig(Env.posthogKey)
                ..host = Env.posthogHost
                ..captureApplicationLifecycleEvents = true,
            )
            .catchError((_) {}),
        // AdMob: initialize and warm the first interstitial in the background,
        // exactly like the web build's `ensureInit()` + `preloadInterstitial()`.
        if (!kIsWeb) AdsService.init().catchError((_) {}),
      ]);
      // PostHog super properties + first-open/session_start, same as the web
      // build's `loaded` hook.
      await AnalyticsBootstrap.bootstrap();
      await Telemetry.start();
    });
  });

  runApp(
    ProviderScope(
      overrides: [activeTabProvider.overrideWith((ref) => initialTab)],
      child: const PraylyApp(),
    ),
  );
}

class PraylyApp extends ConsumerStatefulWidget {
  const PraylyApp({super.key});

  @override
  ConsumerState<PraylyApp> createState() => _PraylyAppState();
}

class _PraylyAppState extends ConsumerState<PraylyApp>
    with WidgetsBindingObserver {
  bool _ready = false;
  bool? _appliedLight;

  /// Stable identity for the whole screen tree. It must never change on a
  /// theme flip — remounting here used to reset every carousel (Daily Verse
  /// mockups jumped back to the first slide) and restart media.
  final _homeKey = GlobalKey();

  /// Repaint the entire tree in place after a brightness change. Many widgets
  /// read the static `AppColors` tokens instead of `Theme.of`, so they need an
  /// explicit rebuild — but keeping their `State` alive preserves scroll and
  /// carousel positions.
  static void _rebuildDeep(Element el) {
    el.markNeedsBuild();
    el.visitChildren(_rebuildDeep);
  }

  @override
  void initState() {
    super.initState();
    // "System" theme has to follow the OS switching between light and dark
    // while the app is open — without this observer the tokens stayed on
    // whatever brightness was active at launch.
    WidgetsBinding.instance.addObserver(this);
    _boot();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangePlatformBrightness() {
    if (mounted) setState(() {});
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    Telemetry.lifecycle(state);
    if (state == AppLifecycleState.resumed) {
      // Subscription renewals, cancellations, refunds and grace-period changes
      // can happen while the app is backgrounded in Google Play.
      ref.read(premiumProvider.notifier).refresh();
    }
  }

  Future<void> _boot() async {
    // Content OTA: bounded wait on the splash, so a fresh install already gets
    // the newest prayers/verses/translations without a store update.
    await OtaService.bootstrap();
    // Language must be resolved before first paint (all UI text depends on it).
    await ref.read(languageProvider.notifier).bootstrap();
    AnalyticsBootstrap.setLang(ref.read(languageProvider));
    if (mounted) setState(() => _ready = true);
    Telemetry.markReady();
    // Purchase state reconciles in the background — no blocking dark screen.
    ref.read(premiumProvider.notifier).bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);

    final mode = ref.watch(themeModeProvider);
    // Resolve brightness here (not inside MaterialApp.builder): the token set
    // is a plain static, so it has to be correct *before* any screen builds,
    // and the whole tree has to be rebuilt when it flips. Reading the OS
    // brightness from the dispatcher keeps "System" honest even when no
    // MediaQuery exists above MaterialApp.
    final platformDark =
        PlatformDispatcher.instance.platformBrightness == Brightness.dark;
    final isLight =
        mode == ThemeMode.light || (mode == ThemeMode.system && !platformDark);
    AppColors.isLight = isLight;

    // Status bar / nav bar icons have to invert in light mode, otherwise the
    // white icons disappear on the cream background. Only pushed when the
    // brightness actually changes — build runs on every language/theme tick.
    if (_appliedLight != isLight) {
      final isFlip = _appliedLight != null;
      _appliedLight = isLight;
      SystemChrome.setSystemUIOverlayStyle(
        SystemUiOverlayStyle(
          statusBarColor: Colors.transparent,
          statusBarIconBrightness: isLight ? Brightness.dark : Brightness.light,
          statusBarBrightness: isLight ? Brightness.light : Brightness.dark,
          systemNavigationBarColor: Colors.transparent,
          systemNavigationBarIconBrightness: isLight
              ? Brightness.dark
              : Brightness.light,
        ),
      );
      if (isFlip) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          final el = _homeKey.currentContext as Element?;
          if (el != null && el.mounted) _rebuildDeep(el);
        });
      }
    }

    return MaterialApp(
      title: 'Prayly: Bible Prayer & Verse',
      navigatorKey: RatingService.navigatorKey,
      navigatorObservers: [TelemetryNavObserver()],
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      // Same three-way choice the Settings page writes to `cw-theme`.
      themeMode: mode,
      // Identity stays stable across a theme flip; the new tokens reach every
      // widget through the deep rebuild above, so carousels, scroll offsets
      // and media keep their place instead of snapping back to the start.
      home: KeyedSubtree(
        key: _homeKey,
        // `t()` reads the active dictionary directly, so const/offstage tab
        // trees do not subscribe to an inherited locale. Key the translated
        // subtree by language to guarantee every cached screen refreshes when
        // Settings switches languages (including a switch back to English).
        child: KeyedSubtree(
          key: ValueKey('translated-app-$lang'),
          child: _ready ? const RootGate() : const _BootScreen(),
        ),
      ),
      builder: (context, child) {
        final theme = Theme.of(context);
        AppColors.isLight = isLight;
        // 1) Every subtree gets a Material ancestor + an explicit DefaultTextStyle
        //    so no Text can ever fall back to Flutter's yellow-underlined
        //    error style (what showed up as double yellow lines on device).
        // 2) The web build renders at a fixed CSS font size, so the OS font
        //    scale must not resize text here — that was causing the shifted
        //    positions and overflow stripes on large-font devices.
        return MediaQuery(
          data: MediaQuery.of(
            context,
          ).copyWith(textScaler: TextScaler.noScaling),
          child: Material(
            type: MaterialType.transparency,
            child: DefaultTextStyle(
              style: (theme.textTheme.bodyMedium ?? const TextStyle()).copyWith(
                decoration: TextDecoration.none,
                decorationColor: Colors.transparent,
              ),
              child: TelemetryTapCapture(
                child: child ?? const SizedBox.shrink(),
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Plain boot screen — no branded logo/cross (deliberate: the branded splash
/// was rejected). Follows the active theme so light mode no longer flashes a
/// near-black screen before the first paint.
class _BootScreen extends StatelessWidget {
  const _BootScreen();

  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.isLight ? AppColors.background : const Color(0xFF02060F),
    child: const SizedBox.expand(),
  );
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
  bool _pushesBootstrapped = false;

  /// Notification permission is asked once the user is actually inside the app
  /// (never during onboarding or the premium handoff), then the daily verse /
  /// quiz / companion / journey alarms are repaired natively.
  void _bootstrapPushes() {
    if (_pushesBootstrapped) return;
    _pushesBootstrapped = true;
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      await ContentPushes.bootstrap();
      await ContentPushes.syncProMode(ref.read(premiumProvider));
      await DailyReminder.sync();
    });
  }

  @override
  Widget build(BuildContext context) {
    final done = ref.watch(onboardingDoneProvider);
    // Fresh onboarding stays in the premium handoff until its sheet has fully
    // closed, so the first permission request appears only on Home. Returning
    // users are also repaired here without depending on a paywall marker.
    if (done && !_inPremiumHandoff) _bootstrapPushes();

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
          if (!replay) setState(() => _inPremiumHandoff = true);
        },
      );
    }
    return const AppShell();
  }
}
