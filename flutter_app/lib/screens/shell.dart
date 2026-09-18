import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../state/app_providers.dart';
import '../widgets/bottom_nav_bar.dart';
import '../widgets/exit_confirm_dialog.dart';
import 'journeys/journeys_screen.dart';
import 'quiz/quiz_screen.dart';
import 'today/today_screen.dart';
import 'wallpapers/wallpapers_screen.dart';

/// Tab shell — keeps each tab's state alive between switches, exactly like the
/// web app's route-level caching.
class AppShell extends ConsumerWidget {
  const AppShell({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final index = ref.watch(activeTabProvider);

    return PopScope(
      canPop: false,
      // Web behaviour: hardware back on a root tab goes to Today first, and
      // from Today it opens the exit confirmation instead of closing.
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (index != 0) {
          ref.read(activeTabProvider.notifier).state = 0;
          return;
        }
        showExitConfirmDialog(context);
      },
      child: Scaffold(
        body: Stack(
          children: [
            IndexedStack(
              index: index,
              children: const [
                TodayScreen(),
                WallpapersScreen(),
                JourneysScreen(),
                QuizScreen(),
              ],
            ),
            if (!ref.watch(quizNavHiddenProvider))
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
