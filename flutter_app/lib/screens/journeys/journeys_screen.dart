import 'dart:async';

import 'package:flutter/material.dart';
import '../../widgets/lucide.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/journey_progress_store.dart';
import '../../core/services/streak_store.dart';
import '../../core/services/user_profile.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/lucide_cross.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart' show FadeRise, TapScale, hsl;
import 'journey_assets.dart';
import 'journey_day_screen.dart';
import 'locked_day_sheet.dart';

class _LockSheetState {
  const _LockSheetState({
    required this.journeyId,
    required this.day,
    required this.mode,
    this.unlockAt,
  });
  final String journeyId;
  final int day;
  final String mode; // 'time' | 'ad'
  final int? unlockAt;
}

/// 1:1 port of `src/pages/Journeys.tsx`.
class JourneysScreen extends ConsumerStatefulWidget {
  const JourneysScreen({super.key, this.showBackButton = false});

  final bool showBackButton;

  @override
  ConsumerState<JourneysScreen> createState() => _JourneysScreenState();
}

class _JourneysScreenState extends ConsumerState<JourneysScreen> {
  Timer? _timer;
  int _now = DateTime.now().millisecondsSinceEpoch;

  /// Next day-unlock timestamp seen during build. `_now` only gates a boolean
  /// (no visible countdown lives on this screen), so the ticker rebuilds the
  /// screen exactly once — when that unlock moment passes — instead of every
  /// second.
  int? _watchedUnlockAt;

  @override
  void initState() {
    super.initState();
    ContentData.loadDeferred().then((_) {
      if (mounted) setState(() {});
    });
    _timer = Timer.periodic(const Duration(seconds: 1), (_) {
      if (!mounted) return;
      final unlockAt = _watchedUnlockAt;
      final now = DateTime.now().millisecondsSinceEpoch;
      if (unlockAt == null || now < unlockAt) return;
      setState(() => _now = now);
    });
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  bool _isJourneyFreeForUser(Journey j) =>
      UserProfile.isJourneyFreeForUser(j.id, j.isPremium);

  void _go(String id, List<Journey> journeys, bool isPremium) {
    final j = journeys.where((x) => x.id == id).cast<Journey?>().firstOrNull;
    if (j == null) return;
    if (!isPremium && !_isJourneyFreeForUser(j)) {
      haptic(HapticStyle.medium);
      _openPremiumSheet('journeys');
      return;
    }
    final completed = JourneyProgressStore.completedDays(j.id).length;
    final nextDay = (completed + 1).clamp(1, j.days.length).toInt();

    if (JourneyProgressStore.isPremiumJourneyDay(nextDay, isPremium)) {
      haptic(HapticStyle.medium);
      _openPremiumSheet('journeys');
      return;
    }

    final unlockAt = JourneyProgressStore.getDayUnlockAt(j.id, nextDay);
    if (unlockAt != null && unlockAt > DateTime.now().millisecondsSinceEpoch) {
      haptic(HapticStyle.soft);
      _openLockSheet(
        j,
        _LockSheetState(
          journeyId: j.id,
          day: nextDay,
          mode: 'time',
          unlockAt: unlockAt,
        ),
      );
      return;
    }
    if (JourneyProgressStore.requiresAdUnlock(j.id, nextDay, isPremium)) {
      haptic(HapticStyle.soft);
      _openLockSheet(
        j,
        _LockSheetState(journeyId: j.id, day: nextDay, mode: 'ad'),
      );
      return;
    }
    haptic(HapticStyle.soft);
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => JourneyDayScreen(journeyId: id)));
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    // Single source of truth for brightness (resolved once in main.dart), so
    // this screen can never disagree with the token set.
    final isDark = !AppColors.isLight;

    final journeys = ContentData.allJourneys();
    if (journeys.isEmpty) {
      return const SizedBox.shrink();
    }

    final streakDays = StreakStore.load().current;

    Journey? inProgress;
    for (final j in journeys) {
      final c = JourneyProgressStore.completedDays(j.id).length;
      if (c > 0 && c < j.days.length) {
        inProgress = j;
        break;
      }
    }
    final featured = inProgress ?? journeys.first;
    final featuredCompleted = JourneyProgressStore.completedDays(
      featured.id,
    ).length;
    final featuredPct = (featuredCompleted / featured.days.length) * 100;
    final featuredNextDay = (featuredCompleted + 1).clamp(
      1,
      featured.days.length,
    );
    final featuredUnlockAt = JourneyProgressStore.getDayUnlockAt(
      featured.id,
      featuredNextDay,
    );
    _watchedUnlockAt = featuredUnlockAt;
    final featuredIsWaiting =
        featuredUnlockAt != null && featuredUnlockAt > _now;
    final featuredNeedsAd = JourneyProgressStore.requiresAdUnlock(
      featured.id,
      featuredNextDay,
      isPremium,
    );
    final featuredNeedsPremium = JourneyProgressStore.isPremiumJourneyDay(
      featuredNextDay,
      isPremium,
    );

    final remaining = journeys.where((j) => j.id != featured.id).toList();
    final frees = remaining.where(_isJourneyFreeForUser).toList();
    final paids = remaining.where((j) => !_isJourneyFreeForUser(j)).toList();
    final rest = <Journey>[];
    final max = frees.length > paids.length ? frees.length : paids.length;
    for (var i = 0; i < max; i++) {
      if (i < frees.length) rest.add(frees[i]);
      if (i < paids.length) rest.add(paids[i]);
    }

    final ink = isDark ? hsl(44, 60, 96) : hsl(222, 38, 10);
    final muted = isDark ? hsl(220, 18, 68) : hsl(222, 16, 39);
    final soft = isDark ? hsl(222, 22, 22) : hsl(42, 28, 84);
    final surface = isDark ? hsl(222, 32, 12) : Colors.white;

    void onFeaturedClick() {
      if (featuredNeedsPremium) {
        haptic(HapticStyle.medium);
        _openPremiumSheet('journeys');
        return;
      }
      if (featuredIsWaiting && featuredUnlockAt != null) {
        haptic(HapticStyle.soft);
        _openLockSheet(
          featured,
          _LockSheetState(
            journeyId: featured.id,
            day: featuredNextDay,
            mode: 'time',
            unlockAt: featuredUnlockAt,
          ),
        );
        return;
      }
      if (featuredNeedsAd) {
        haptic(HapticStyle.soft);
        _openLockSheet(
          featured,
          _LockSheetState(
            journeyId: featured.id,
            day: featuredNextDay,
            mode: 'ad',
          ),
        );
        return;
      }
      _go(featured.id, journeys, isPremium);
    }

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: isDark
              ? [hsl(222, 44, 5), hsl(222, 38, 8), hsl(224, 36, 6)]
              : [hsl(42, 60, 98), hsl(42, 48, 96), hsl(44, 54, 95)],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            _buildHeader(context, ink, muted, streakDays, surface, isDark),
            Expanded(
              // Slivers keep the journey cards lazy: only the ones near the
              // viewport inflate, which removes the first-paint stall the
              // eager Column caused on mid-range devices.
              child: CustomScrollView(
                slivers: [
                  SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 20),
                        _buildFeatured(
                          context,
                          featured,
                          featuredCompleted,
                          featuredPct,
                          featuredNextDay,
                          featuredNeedsPremium,
                          isDark,
                          onFeaturedClick,
                        ),
                        _buildSectionDivider(ink),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 32),
                          child: Text(
                            t('jn.header.tagline'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 12,
                              fontStyle: FontStyle.italic,
                              height: 1.4,
                              color: muted,
                            ),
                          ),
                        ),
                        const SizedBox(height: 20),
                      ],
                    ),
                  ),
                  SliverPadding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    sliver: SliverList.builder(
                      itemCount: rest.length,
                      itemBuilder: (context, i) {
                        final journey = rest[i];
                        return Padding(
                          padding: EdgeInsets.only(top: i == 0 ? 0 : 16),
                          child: FadeRise(
                            delay: Duration(milliseconds: 40 + i * 35),
                            duration: const Duration(milliseconds: 400),
                            child: _JourneyCard(
                              journey: journey,
                              isDark: isDark,
                              ink: ink,
                              muted: muted,
                              isPremium: isPremium,
                              isFree: _isJourneyFreeForUser(journey),
                              onTap: () => _go(journey.id, journeys, isPremium),
                            ),
                          ),
                        );
                      },
                    ),
                  ),
                  SliverToBoxAdapter(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        const SizedBox(height: 32),
                        _buildTopicFooter(ink),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(32, 24, 32, 148),
                          child: Text(
                            t('jn.footer.verse'),
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13.5,
                              fontStyle: FontStyle.italic,
                              height: 1.6,
                              color: muted.withValues(alpha: 0.75),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    Color ink,
    Color muted,
    int streakDays,
    Color surface,
    bool isDark,
  ) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.paddingOf(context).top > 0 ? 12 : 20,
        20,
        16,
      ),
      decoration: BoxDecoration(
        color: surface.withValues(alpha: 0.92),
        border: Border(
          bottom: BorderSide(color: hsl(42, 28, 84, isDark ? 0.15 : 0.7)),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              if (widget.showBackButton) ...[
                TapScale(
                  onTap: () {
                    haptic(HapticStyle.soft);
                    Navigator.of(context).maybePop();
                  },
                  child: SizedBox(
                    width: 32,
                    height: 32,
                    child: Icon(
                      Icons.chevron_left_rounded,
                      size: 24,
                      color: ink,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
              ],
              Container(
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(10),
                  gradient: LinearGradient(
                    colors: [hsl(42, 85, 55, 0.22), hsl(42, 85, 55, 0.08)],
                  ),
                  border: Border.all(color: hsl(42, 85, 55, 0.35)),
                ),
                child: Center(
                  child: LucideCross(
                    size: 16,
                    color: hsl(42, 85, 55),
                    strokeWidth: 2.6,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  t('jn.header.title'),
                  style: TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w800,
                    letterSpacing: -0.5,
                    color: ink,
                  ),
                ),
              ),
              if (streakDays >= 1)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  height: 28,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    gradient: LinearGradient(
                      colors: [hsl(42, 85, 55, 0.18), hsl(42, 85, 55, 0.08)],
                    ),
                    border: Border.all(color: hsl(42, 85, 55, 0.4)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      LucideIcon('flame', size: 12, color: hsl(38, 100, 65)),
                      const SizedBox(width: 6),
                      Text(
                        '$streakDays',
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                          color: hsl(38, 100, 65),
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            t('jn.header.subtitle'),
            style: TextStyle(fontSize: 12, height: 1.35, color: muted),
          ),
        ],
      ),
    );
  }

  Widget _buildFeatured(
    BuildContext context,
    Journey featured,
    int featuredCompleted,
    double featuredPct,
    int featuredNextDay,
    bool featuredNeedsPremium,
    bool isDark,
    VoidCallback onTap,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 10),
            child: Text(
              featuredCompleted > 0
                  ? t('jn.featured.continue')
                  : t('jn.featured.begin'),
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                letterSpacing: 10 * 0.2,
                color: hsl(38, 100, 65),
              ),
            ),
          ),
          FadeRise(
            duration: const Duration(milliseconds: 500),
            child: TapScale(
              scale: 0.99,
              onTap: onTap,
              child: Container(
                clipBehavior: Clip.antiAlias,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(28),
                  border: Border.all(color: hsl(42, 85, 55, 0.35)),
                  boxShadow: [
                    BoxShadow(
                      color: (isDark ? Colors.black : hsl(222, 40, 20))
                          .withValues(alpha: isDark ? 0.85 : 0.5),
                      blurRadius: 60,
                      spreadRadius: -30,
                      offset: const Offset(0, 26),
                    ),
                  ],
                ),
                child: SizedBox(
                  height: 340,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      _JourneyImage(path: kJourneyImages[featured.id]),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.15),
                              Colors.transparent,
                              Colors.black.withValues(alpha: 0.5),
                              Colors.black.withValues(alpha: 0.92),
                            ],
                            stops: const [0, 0.4, 0.72, 1],
                          ),
                        ),
                      ),
                      Positioned(
                        top: 14,
                        left: 14,
                        right: 14,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _GlassPill(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  if (!featuredNeedsPremium &&
                                      featuredCompleted == 0)
                                    LucideCross(
                                      size: 10,
                                      color: hsl(45, 100, 92),
                                      strokeWidth: 3,
                                    )
                                  else
                                    Icon(
                                      featuredNeedsPremium
                                          ? Icons.workspace_premium
                                          : Icons.local_fire_department,
                                      size: 10,
                                      color: hsl(45, 100, 92),
                                    ),
                                  const SizedBox(width: 6),
                                  Text(
                                    featuredNeedsPremium
                                        ? t('jn.featured.badge.premium')
                                        : featuredCompleted > 0
                                        ? t('jn.featured.badge.inProgress')
                                        : t('jn.featured.badge.begin'),
                                    style: TextStyle(
                                      fontSize: 9.5,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: 9.5 * 0.16,
                                      color: hsl(45, 100, 92),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            _GlassPill(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  const Icon(
                                    Icons.access_time,
                                    size: 10,
                                    color: Colors.white,
                                  ),
                                  const SizedBox(width: 4),
                                  Text(
                                    t('jn.featured.meta.days', {
                                      'days': featured.days.length,
                                    }),
                                    style: const TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w700,
                                      color: Colors.white,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                featured.title,
                                style: const TextStyle(
                                  fontSize: 34,
                                  fontWeight: FontWeight.w600,
                                  height: 1.0,
                                  letterSpacing: -0.5,
                                  color: Colors.white,
                                ),
                              ),
                              const SizedBox(height: 6),
                              Text(
                                featured.subtitle,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 15,
                                  fontStyle: FontStyle.italic,
                                  height: 1.3,
                                  color: Colors.white.withValues(alpha: 0.92),
                                ),
                              ),
                              const SizedBox(height: 16),
                              Row(
                                children: [
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(
                                            999,
                                          ),
                                          child: SizedBox(
                                            height: 4,
                                            child: Stack(
                                              children: [
                                                Container(
                                                  color: Colors.white
                                                      .withValues(alpha: 0.22),
                                                ),
                                                FractionallySizedBox(
                                                  widthFactor:
                                                      (featuredPct / 100).clamp(
                                                        0,
                                                        1,
                                                      ),
                                                  child: Container(
                                                    decoration: BoxDecoration(
                                                      gradient: LinearGradient(
                                                        colors: [
                                                          hsl(42, 85, 55),
                                                          hsl(38, 100, 65),
                                                        ],
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                        const SizedBox(height: 6),
                                        Text(
                                          featuredCompleted >=
                                                  featured.days.length
                                              ? t('jn.featured.meta.complete')
                                              : t('jn.featured.meta.progress', {
                                                  'current': featuredNextDay,
                                                  'total': featured.days.length,
                                                  'pct': featuredPct.round(),
                                                }),
                                          style: TextStyle(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.white.withValues(
                                              alpha: 0.9,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 16,
                                    ),
                                    height: 40,
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(999),
                                      gradient: LinearGradient(
                                        colors: [
                                          hsl(42, 85, 55),
                                          hsl(38, 100, 65),
                                        ],
                                      ),
                                    ),
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        if (featuredNeedsPremium) ...[
                                          LucideIcon(
                                            'crown',
                                            size: 14,
                                            color: hsl(222, 60, 8),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            t('jn.cta.unlock'),
                                            style: TextStyle(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w900,
                                              color: hsl(222, 60, 8),
                                            ),
                                          ),
                                        ] else if (featuredCompleted == 0) ...[
                                          Text(
                                            t('jn.cta.start'),
                                            style: TextStyle(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w900,
                                              color: hsl(222, 60, 8),
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Icon(
                                            Icons.arrow_forward,
                                            size: 14,
                                            color: hsl(222, 60, 8),
                                          ),
                                        ] else if (featuredCompleted >=
                                            featured.days.length) ...[
                                          LucideIcon(
                                            'check',
                                            size: 14,
                                            color: hsl(222, 60, 8),
                                          ),
                                          const SizedBox(width: 6),
                                          Text(
                                            t('jn.cta.review'),
                                            style: TextStyle(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w900,
                                              color: hsl(222, 60, 8),
                                            ),
                                          ),
                                        ] else ...[
                                          Text(
                                            t('jn.cta.continue'),
                                            style: TextStyle(
                                              fontSize: 12.5,
                                              fontWeight: FontWeight.w900,
                                              color: hsl(222, 60, 8),
                                            ),
                                          ),
                                          const SizedBox(width: 6),
                                          Icon(
                                            Icons.arrow_forward,
                                            size: 14,
                                            color: hsl(222, 60, 8),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionDivider(Color ink) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 36, 20, 20),
      child: Row(
        children: [
          Expanded(child: Container(height: 1, color: hsl(42, 85, 55, 0.4))),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: Text(
              t('jn.section.all'),
              style: TextStyle(
                fontSize: 22,
                fontWeight: FontWeight.w600,
                color: ink,
              ),
            ),
          ),
          Expanded(child: Container(height: 1, color: hsl(42, 85, 55, 0.4))),
        ],
      ),
    );
  }

  Widget _buildTopicFooter(Color ink) {
    const topics = [
      ['jn.topic.anxiety', '♡'],
      ['jn.topic.grief', '🕊'],
      ['jn.topic.forgiveness', '✝'],
      ['jn.topic.growth', '🌱'],
    ];
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.symmetric(vertical: 16),
      decoration: BoxDecoration(
        border: Border.symmetric(
          horizontal: BorderSide(color: hsl(42, 85, 55, 0.18)),
        ),
      ),
      child: Wrap(
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        spacing: 12,
        runSpacing: 8,
        children: [
          for (var i = 0; i < topics.length; i++)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  topics[i][1],
                  style: TextStyle(fontSize: 13, color: hsl(38, 100, 65)),
                ),
                const SizedBox(width: 6),
                Text(
                  '${t(topics[i][0])}.',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: ink,
                  ),
                ),
                if (i < topics.length - 1) ...[
                  const SizedBox(width: 4),
                  Text(
                    '•',
                    style: TextStyle(fontSize: 10, color: hsl(42, 85, 55, 0.5)),
                  ),
                ],
              ],
            ),
        ],
      ),
    );
  }

  void _openPremiumSheet(String trigger) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => PremiumSheet(
        trigger: trigger,
        onClose: () => Navigator.of(context).maybePop(),
        onUnlock: () {
          ref.read(premiumProvider.notifier).setUnlocked();
          Navigator.of(context).maybePop();
        },
      ),
    );
  }

  void _openLockSheet(Journey j, _LockSheetState lock) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => LockedDaySheet(
        journeyTitle: j.title,
        journeyEmoji: j.emoji,
        hue: j.hue,
        day: lock.day,
        unlockAt: lock.unlockAt,
        mode: lock.mode,
        onUnlockWithPremium: () {
          Navigator.of(context).maybePop();
          _openPremiumSheet('journeys');
        },
      ),
    );
  }
}

class _GlassPill extends StatelessWidget {
  const _GlassPill({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(999),
        color: Colors.black.withValues(alpha: 0.55),
        border: Border.all(color: hsl(42, 85, 55, 0.4)),
      ),
      child: child,
    );
  }
}

class _JourneyCard extends StatelessWidget {
  const _JourneyCard({
    required this.journey,
    required this.isDark,
    required this.ink,
    required this.muted,
    required this.isPremium,
    required this.isFree,
    required this.onTap,
  });

  final Journey journey;
  final bool isDark;
  final Color ink;
  final Color muted;
  final bool isPremium;
  final bool isFree;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final completed = JourneyProgressStore.completedDays(journey.id);
    final completedCount = completed.length;
    final totalDays = journey.days.length;
    final pct = ((completedCount / totalDays) * 100).round();
    final isStarted = completedCount > 0;
    final isFinished = completedCount >= totalDays;
    final premiumLocked = !isPremium && !isFree;

    final ctaLabel = premiumLocked
        ? t('jn.card.unlock')
        : isFinished
        ? t('jn.card.review')
        : isStarted
        ? t('jn.card.continue', {'n': completedCount + 1})
        : t('jn.card.start');

    return TapScale(
      scale: 0.985,
      onTap: onTap,
      child: Container(
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(26),
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: isDark
                ? [hsl(222, 34, 13), hsl(222, 36, 10)]
                : [Colors.white, hsl(43, 68, 96)],
          ),
          border: Border.all(color: hsl(42, 85, 55, 0.28)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            AspectRatio(
              aspectRatio: 16 / 10,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  _JourneyImage(path: kJourneyImages[journey.id]),
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: FractionallySizedBox(
                      heightFactor: 1 / 3,
                      widthFactor: 1,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.transparent,
                              (isDark ? hsl(222, 36, 10) : Colors.white)
                                  .withValues(alpha: 0.7),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 12,
                    left: 12,
                    right: 12,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        _GlassPill(
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(
                                Icons.access_time,
                                size: 10,
                                color: Colors.white,
                              ),
                              const SizedBox(width: 5),
                              Text(
                                t('jn.card.days', {'n': totalDays}),
                                style: TextStyle(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: 10 * 0.14,
                                  color: hsl(45, 100, 92),
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (isFinished)
                          _RoundBadge(
                            gradientColors: [hsl(42, 85, 55), hsl(38, 100, 65)],
                            child: LucideIcon(
                              'check',
                              size: 16,
                              color: hsl(222, 60, 8),
                            ),
                          )
                        else if (isStarted)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 10,
                              vertical: 5,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              color: hsl(42, 85, 55, 0.95),
                            ),
                            child: Text(
                              t('jn.card.dayNum', {'n': completedCount + 1}),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 10 * 0.14,
                                color: hsl(222, 60, 8),
                              ),
                            ),
                          )
                        else if (premiumLocked)
                          _RoundBadge(
                            gradientColors: [hsl(45, 95, 62), hsl(38, 95, 48)],
                            child: LucideIcon(
                              'crown',
                              size: 16,
                              color: hsl(30, 60, 14),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    journey.title,
                    style: TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w600,
                      height: 1.05,
                      letterSpacing: -0.3,
                      color: ink,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    journey.subtitle,
                    style: TextStyle(
                      fontSize: 14,
                      fontStyle: FontStyle.italic,
                      height: 1.3,
                      color: muted,
                    ),
                  ),
                  const SizedBox(height: 12),
                  if (isStarted) ...[
                    Row(
                      children: [
                        Expanded(
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(999),
                            child: SizedBox(
                              height: 4,
                              child: Stack(
                                children: [
                                  Container(
                                    color:
                                        (isDark ? Colors.white : Colors.black)
                                            .withValues(
                                              alpha: isDark ? 0.12 : 0.08,
                                            ),
                                  ),
                                  FractionallySizedBox(
                                    widthFactor: (pct / 100).clamp(0, 1),
                                    child: Container(
                                      decoration: BoxDecoration(
                                        gradient: LinearGradient(
                                          colors: [
                                            hsl(42, 85, 55),
                                            hsl(38, 100, 65),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          '$pct%',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w900,
                            color: muted,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                  ],
                  Container(
                    width: double.infinity,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        colors: [hsl(42, 85, 55), hsl(38, 100, 65)],
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (premiumLocked)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: LucideIcon(
                              'crown',
                              size: 16,
                              color: hsl(222, 60, 8),
                            ),
                          ),
                        if (isFinished && !premiumLocked)
                          Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: LucideIcon(
                              'check',
                              size: 16,
                              color: hsl(222, 60, 8),
                            ),
                          ),
                        Text(
                          ctaLabel,
                          style: TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.2,
                            color: hsl(222, 60, 8),
                          ),
                        ),
                        if (!isFinished && !premiumLocked)
                          Padding(
                            padding: const EdgeInsets.only(left: 8),
                            child: Icon(
                              Icons.arrow_forward,
                              size: 16,
                              color: hsl(222, 60, 8),
                            ),
                          ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoundBadge extends StatelessWidget {
  const _RoundBadge({required this.gradientColors, required this.child});
  final List<Color> gradientColors;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 32,
      height: 32,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(colors: gradientColors),
      ),
      child: child,
    );
  }
}

class _JourneyImage extends StatelessWidget {
  const _JourneyImage({required this.path});

  final String? path;

  @override
  Widget build(BuildContext context) {
    final src = path;
    if (src == null || src.isEmpty) return const _JourneyFallback();
    return Image.asset(
      src,
      fit: BoxFit.cover,
      errorBuilder: (_, _, _) => const _JourneyFallback(),
    );
  }
}

class _JourneyFallback extends StatelessWidget {
  const _JourneyFallback();

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [hsl(222, 34, 16), hsl(222, 40, 7)],
        ),
      ),
      child: Center(
        child: Icon(Icons.auto_stories, size: 34, color: hsl(42, 85, 55, 0.7)),
      ),
    );
  }
}

extension _FirstOrNull<T> on Iterable<T> {
  T? get firstOrNull => isEmpty ? null : first;
}
