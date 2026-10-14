import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import 'package:flutter/rendering.dart' show ScrollDirection;
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/content_push_service.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prayer_alarm_service.dart';
import '../../core/services/streak_store.dart';
import '../../core/services/user_profile.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/keep_alive.dart' as app_keep_alive;
import '../../widgets/lucide.dart';
import '../../widgets/life_calendar_preview.dart';
import '../../state/app_providers.dart';
import '../../widgets/premium_sheet.dart';
import '../../widgets/screen_scaffold.dart';
import '../../widgets/streak_badge.dart';
import '../pray_screen/pray_screen_screen.dart';
import '../daily_verse/daily_verse_screen.dart';
import '../devotional/devotional_screen.dart';
import '../challenge/challenge_home_card.dart';
import '../quiz/quiz_route.dart';
import '../parallax/parallax_preview_screen.dart';
import 'prayer_alarm_toggles.dart';
import 'notification_permission_card.dart';
import '../settings/settings_screen.dart';
import 'daily_question_card.dart';
import 'gift_button.dart';
import 'parallax_rail.dart';
import 'premium_nudge.dart';
import 'today_checklist.dart';
import 'today_shared.dart';
import 'verse_hero.dart';
import 'today_ink.dart';

/// 1:1 port of `src/pages/Today.tsx` — the home screen.
///
/// Render order matches the web page exactly: header, VerseHero, checklist,
/// prayer toggles + ParallaxRail (reserved, landing in the next slice),
/// premium nudge for free users, daily question, footer.
class TodayScreen extends ConsumerStatefulWidget {
  const TodayScreen({super.key});

  @override
  ConsumerState<TodayScreen> createState() => _TodayScreenState();
}

class _TodayScreenState extends ConsumerState<TodayScreen> {
  @override
  void initState() {
    super.initState();
    // Streak ticks on mount, same as the web page's `useStreak()`.
    StreakStore.bumpIfNewDay();
    ContentData.load().then((_) {
      if (mounted) setState(() {});
    });
    // Restore opted-in classic alarms without cancelling the user's schedule.
    PrayerAlarms.bootstrap();
    Analytics.capture('today_page_viewed', {
      'is_premium': ref.read(premiumProvider),
    });
  }

  void _openPremium() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => PremiumSheet(
        trigger: 'today',
        onClose: () => Navigator.of(sheetContext).maybePop(),
        onUnlock: () => ref.read(premiumProvider.notifier).setUnlocked(),
      ),
    );
  }

  void _openDevotional() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const DevotionalScreen()));
  }

  /// `useGreeting()` — morning before 12, afternoon before 18, else evening.
  ({String text, IconData icon}) _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) {
      return (text: t('today.greeting.morning'), icon: Icons.wb_sunny);
    }
    if (hour < 18) {
      return (text: t('today.greeting.afternoon'), icon: Icons.wb_twilight);
    }
    return (text: t('today.greeting.evening'), icon: Icons.nightlight_round);
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    final providerName = ref.watch(userNameProvider);
    final userName = providerName.trim().isNotEmpty
        ? providerName.trim()
        : UserProfile.name();
    final greeting = _greeting();
    final now = DateTime.now();

    return Container(
      color: AppColors.background,
      child: Column(
        children: [
          // ---------------- Header ----------------
          Container(
            padding: EdgeInsets.only(
              top: MediaQuery.paddingOf(context).top < 8
                  ? 8
                  : MediaQuery.paddingOf(context).top,
            ),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  AppColors.background,
                  AppColors.background.withValues(alpha: 0.92),
                ],
              ),
              border: Border(bottom: BorderSide(color: TodayInk.glassBorder)),
            ),
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
              child: Row(
                children: [
                  GiftButton(
                    onTap: () {
                      haptic(HapticStyle.soft);
                      showLifeCalendarPreview(context, ref.read(languageProvider));
                    },
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Icon(
                              greeting.icon,
                              size: 12,
                              color: TodayInk.primary,
                            ),
                            const SizedBox(width: 6),
                            Flexible(
                              child: Text(
                                greeting.text.toUpperCase(),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.bold,
                                  letterSpacing: 9.5 * 0.2,
                                  color: TodayInk.primary.withValues(
                                    alpha: 0.8,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          userName ?? t('today.header.fallbackName'),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: (MediaQuery.sizeOf(context).width * 0.044)
                                .clamp(15.0, 22.0),
                            height: 1.2,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.4,
                            color: AppColors.foreground,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          '${dayLabel(now)}, ${monthLabel(now.month - 1)} ${now.day}',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.w600,
                            letterSpacing: 10 * 0.04,
                            color: AppColors.foreground.withValues(alpha: 0.5),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const StreakBadge(),
                  const SizedBox(width: 6),
                  TapScale(
                    scale: 0.9,
                    onTap: () {
                      haptic(HapticStyle.soft);
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => const SettingsScreen(),
                        ),
                      );
                    },
                    child: Container(
                      width: 36,
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppColors.foreground.withValues(alpha: 0.06),
                        border: Border.all(color: TodayInk.glassBorder),
                      ),
                      child: LucideIcon(
                        'settings',
                        size: 16,
                        color: AppColors.foreground.withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ---------------- Scroll body ----------------
          Expanded(
            // Any drag/fling on Today (page scroll or the verse carousel)
            // pauses the cosmetic motion loops further down the screen, so the
            // gesture keeps the full frame budget.
            child: NotificationListener<ScrollNotification>(
              onNotification: (n) {
                if (n is ScrollStartNotification) {
                  TodayGesture.active = true;
                } else if (n is ScrollEndNotification ||
                    n is UserScrollNotification &&
                        n.direction == ScrollDirection.idle) {
                  TodayGesture.active = false;
                }
                return false;
              },
              child: ListView(
                key: const PageStorageKey('today-scroll'),

              // Keep cards alive off-screen so their entrance animations do not
              // replay every time the user scrolls back up (web keeps the DOM).
              // One screen of look-ahead is enough to avoid replaying entrance
              // animations; 2400px kept every heavy card + its tickers alive.
              cacheExtent: 900,
              padding: EdgeInsets.only(
                top: 12,
                bottom: 132 + MediaQuery.paddingOf(context).bottom,
              ),
              children: [
                app_keep_alive.KeepAlive(
                  child: VerseHero(
                    onPremium: _openPremium,
                    onOpenDailyVerse: () => Navigator.of(context).push(
                      MaterialPageRoute(
                        builder: (_) => const DailyVerseScreen(),
                      ),
                    ),
                  ),
                ),
                const NotificationPermissionCard(),


                app_keep_alive.KeepAlive(
                  child: TodayChecklist(
                    onOpenDevotional: _openDevotional,
                    onOpenQuiz: () => openQuiz(context),
                    onOpenDailyQuiz: () => openQuiz(context, autoDaily: true),
                  ),
                ),
                const app_keep_alive.KeepAlive(child: PrayerAlarmToggles()),

                app_keep_alive.KeepAlive(
                  child: ParallaxRail(
                    onOpenScene: (id, personalize) =>
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => ParallaxPreviewScreen(
                              sceneId: id,
                              personalize: personalize,
                            ),
                          ),
                        ),
                  ),
                ),

                const app_keep_alive.KeepAlive(child: ChallengeHomeCard()),

                Padding(
                  padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
                  child: GestureDetector(
                    onTap: () {
                      haptic(HapticStyle.soft);
                      Navigator.of(context).push(MaterialPageRoute<void>(builder: (_) => const PrayScreenScreen()));
                    },
                    child: Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        borderRadius: BorderRadius.circular(22),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.25)),
                        boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.18), blurRadius: 32, offset: const Offset(0, 12), spreadRadius: -18)],
                      ),
                      child: Stack(children: [
                        Positioned(right: -40, top: -48, child: Container(width: 160, height: 160, decoration: BoxDecoration(shape: BoxShape.circle, gradient: RadialGradient(colors: [AppColors.primary.withValues(alpha: 0.22), AppColors.primary.withValues(alpha: 0)])))),
                        Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
                              Container(
                                width: 56, height: 56,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  gradient: LinearGradient(begin: Alignment.topCenter, end: Alignment.bottomCenter, colors: [AppColors.primary.withValues(alpha: 0.25), AppColors.primary.withValues(alpha: 0.05)]),
                                  border: Border.all(color: AppColors.primary.withValues(alpha: 0.35)),
                                ),
                                child: Stack(alignment: Alignment.center, children: [
                                  Icon(Icons.shield_outlined, size: 28, color: AppColors.primary),
                                  Icon(Icons.lock_rounded, size: 11, color: AppColors.primary),
                                ]),
                              ),
                              const SizedBox(width: 16),
                              Expanded(child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
                                const SizedBox(height: 2),
                                Text(t('premium.benefit.shield.title'), style: AppTheme.serif(size: 22, weight: FontWeight.w600, color: AppColors.foreground, height: 1.15)),
                                const SizedBox(height: 4),
                                Text(t('ps.tagline'), style: TextStyle(fontSize: 13, height: 1.35, color: AppColors.mutedForeground)),
                              ])),
                            ]),
                            const SizedBox(height: 16),
                            Row(children: [
                              _shieldChip(Icons.lock_outline_rounded, t('ps.mode.prayer')),
                              const SizedBox(width: 8),
                              _shieldChip(Icons.menu_book_outlined, t('bible.title')),
                              const Spacer(),
                              Container(
                                height: 36,
                                padding: const EdgeInsets.symmetric(horizontal: 16),
                                decoration: BoxDecoration(color: AppColors.primary, borderRadius: BorderRadius.circular(18), boxShadow: [BoxShadow(color: AppColors.primary.withValues(alpha: 0.45), blurRadius: 16, offset: const Offset(0, 6), spreadRadius: -6)]),
                                child: Row(mainAxisSize: MainAxisSize.min, children: [
                                  Text(t('ps.btn.on'), style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: AppColors.primaryForeground)),
                                  const SizedBox(width: 6),
                                  Icon(Icons.arrow_forward_rounded, size: 14, color: AppColors.primaryForeground),
                                ]),
                              ),
                            ]),
                          ]),
                        ),
                      ]),
                    ),
                  ),
                ),

                if (!isPremium) PremiumNudge(onOpen: _openPremium),

                app_keep_alive.KeepAlive(
                  child: DailyQuestionCard(
                    onOpenQuiz: () => openQuiz(context),
                  ),
                ),

                // ---------------- Footer ----------------
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 40, 24, 16),
                  child: Column(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(999),
                          color: AppColors.glass,
                          border: Border.all(color: TodayInk.glassBorder),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              '✝',
                              style: TextStyle(
                                fontSize: 10,
                                color: TodayInk.primary,
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              t('today.footer.tagline').toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 10 * 0.22,
                                color: TodayInk.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 260),
                        child: Text(
                          t('today.footer.line1'),
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            height: 1.6,
                            color: AppColors.foreground.withValues(alpha: 0.45),
                          ),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        t('today.footer.soliDeo'),
                        style: TextStyle(
                          fontSize: 10,
                          fontStyle: FontStyle.italic,
                          color: AppColors.foreground.withValues(alpha: 0.3),
                        ),
                      ),
                    ],
                  ),
                ),
                ],
              ),
            ),
          ),

        ],
      ),
    );
  }
}

Widget _shieldChip(IconData icon, String label) => Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(color: AppColors.muted.withValues(alpha: 0.6), borderRadius: BorderRadius.circular(16)),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 14, color: AppColors.primary),
        const SizedBox(width: 6),
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.foreground.withValues(alpha: 0.8))),
      ]),
    );
