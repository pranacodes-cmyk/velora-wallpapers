import '../core/services/daily_funnel.dart';
import '../core/services/daily_reminder_service.dart';
import '../core/services/telemetry.dart';
import '../core/services/analytics.dart';
import 'package:flutter/material.dart';
import '../core/app_tabs.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/app_providers.dart';
import '../core/services/engagement_prompts.dart';
import '../core/services/pray_screen_service.dart';
import '../core/services/rating_service.dart';
import '../widgets/bottom_nav_bar.dart';
import '../widgets/exit_confirm_dialog.dart';
import '../widgets/premium_sheet.dart';
import 'bible_chat/bible_chat_screen.dart';
import 'journeys/journeys_screen.dart';
import 'quiz/quiz_screen.dart';
import 'pray_screen/pray_screen_screen.dart';
import 'today/today_screen.dart';
import 'devotional/devotional_screen.dart';
import 'wallpapers/wallpapers_screen.dart';

/// Tab shell — keeps each tab's state alive between switches, exactly like the
/// web app's route-level caching.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell>
    with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _consumeOpenRoute();
      _consumeShieldLaunch();
      _maybeShowUsageMilestone();
    });
  }

  /// One-time day-4 offer: the habit is formed and the free limits have been
  /// felt, so this is the fairest single moment to show Pro.
  Future<void> _maybeShowUsageMilestone() async {
    await Future<void>.delayed(const Duration(milliseconds: 2500));
    if (!mounted) return;
    if (ref.read(premiumProvider)) return;
    if (!ref.read(onboardingDoneProvider)) return;
    if (!EngagementPrompts.shouldShowUsageMilestone()) return;
    final release = RatingOverlayGate.markVisible('usage_day4_paywall');
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PremiumSheet(
        trigger: 'auto_usage_day4',
        onClose: () => Navigator.pop(sheetContext),
        onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
      ),
    );
    release();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _consumeOpenRoute();
      _consumeShieldLaunch();
      PrayScreenService.ensureRunning();
    }
  }

  /// An `open_route` hand-off from a notification tap — the daily reminder's
  /// "Pray now", the Prayer Alarm's CTA, or a content push. Every known route
  /// lands where the tap promised.
  Future<void> _consumeOpenRoute() async {
    final route = await DailyReminder.consumeOpenRoute();
    if (route == null || !mounted) return;
    if (route.startsWith('/devotional')) {
      Analytics.capture('pray_screen_opened_from_reminder');
      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const DevotionalScreen(musicEnabled: false)));
    } else if (route.startsWith('/quiz')) {
      ref.read(activeTabProvider.notifier).state = AppTabs.quiz;
    } else if (route.startsWith('/journeys')) {
      ref.read(activeTabProvider.notifier).state = AppTabs.journeys;
    } else if (route.startsWith('/companion')) {
      Navigator.of(context).push(
        MaterialPageRoute<void>(
          builder: (_) => const BibleChatScreen(),
        ),
      );
    } else if (route.contains('openReflection=1')) {
      ref.read(activeTabProvider.notifier).state = AppTabs.today;
      DailyFunnel.requestOpenReflection();
    }
  }

  Future<void> _consumeShieldLaunch() async {
    await PrayScreenService.drainNativeEvents();
    if (!await PrayScreenService.consumeSacredPauseLaunch() || !mounted) return;
    Analytics.capture('pray_screen_opened_from_shield');
    Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PrayScreenScreen(launchUnlock: true)));
  }

  @override
  Widget build(BuildContext context) {
    final index = ref.watch(activeTabProvider);
    WidgetsBinding.instance.addPostFrameCallback((_) => Telemetry.tab(index));
    final lang = ref.watch(languageProvider);

    return PopScope(
      canPop: false,
      // Web behaviour: hardware back on a root tab goes to Today first, and
      // from Today it opens the exit confirmation instead of closing.
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        // A fullscreen preview/detail overlay handles back itself. Without this
        // guard both handlers fired: the overlay closed *and* the shell jumped
        // to Today, leaving the tab bar hidden.
        if (ref.read(fullscreenOverlayProvider)) return;
        // Quiz tab handles its own back first (abandon a running quiz, leave
        // results) — only when it has nothing left to undo do we fall back to
        // the tab-level behaviour.
        if (index == AppTabs.quiz) {
          final quizBack = ref.read(quizBackHandlerProvider);
          if (quizBack != null && quizBack()) return;
        }
        if (index != AppTabs.today) {
          ref.read(activeTabProvider.notifier).state = AppTabs.today;
          return;
        }
        showExitConfirmDialog(context);
      },
      child: Scaffold(
        body: Stack(
          children: [
            IndexedStack(
              key: ValueKey('translated-tabs-$lang'),
              index: index,
              children: [
                TickerMode(enabled: index == 0, child: const TodayScreen()),
                TickerMode(
                  enabled: index == 1,
                  child: const JourneysScreen(showBackButton: false),
                ),
                TickerMode(
                  enabled: index == 2,
                  child: const WallpapersScreen(),
                ),
                TickerMode(enabled: index == 3, child: const QuizScreen()),
              ],
            ),
            // Keyboard open → the floating tab bar would sit on top of the
            // input the user is typing into, so it steps aside.
            // The quiz's hide-nav flag may only ever hide the bar while the
            // Quiz tab is actually visible. The IndexedStack keeps Quiz alive,
            // so a stale `true` used to strand the user with no tab bar at all.
            if (!(index == AppTabs.quiz && ref.watch(quizNavHiddenProvider)) &&
                !ref.watch(fullscreenOverlayProvider) &&
                MediaQuery.viewInsetsOf(context).bottom < 80)
              BottomNavBar(
                activeIndex: index,
                onChanged: (i) =>
                    ref.read(activeTabProvider.notifier).state = i,
              ),
          ],
        ),
      ),
    );
  }
}
