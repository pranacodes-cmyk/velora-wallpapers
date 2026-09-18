import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:just_audio/just_audio.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/content_data.dart';
import '../../core/services/daily_funnel.dart';
import '../../core/services/prayer_slots.dart';
import '../../core/services/today_tasks_store.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/funnel_exit_modal.dart';
import '../prayer/personal_prayer_sheet.dart';
import 'devotional_backgrounds.dart';
import 'devotional_slide.dart';
import 'locked_prayer_card.dart';

/// 1:1 port of `src/pages/Devotional.tsx` — two vertically snapped prayer
/// slides (current slot first), ambient music, rewarded-ad unlock for the
/// future slot and the funnel handoff back to Today.
class DevotionalScreen extends ConsumerStatefulWidget {
  const DevotionalScreen({super.key});

  @override
  ConsumerState<DevotionalScreen> createState() => _DevotionalScreenState();
}

class _DevotionalScreenState extends ConsumerState<DevotionalScreen>
    with WidgetsBindingObserver {
  final _player = AudioPlayer();
  final _musicReady = ValueNotifier<bool>(false);
  final _pageController = PageController();

  late final PrayerSlot _currentSlot = PrayerSlots.currentSlot();
  late final List<PrayerSlot> _slots = _currentSlot == PrayerSlot.morning
      ? [PrayerSlot.morning, PrayerSlot.evening]
      : [PrayerSlot.evening, PrayerSlot.morning];

  late Map<PrayerSlot, bool> _unlocked = {
    PrayerSlot.morning: PrayerSlots.isUnlocked(PrayerSlot.morning),
    PrayerSlot.evening: PrayerSlots.isUnlocked(PrayerSlot.evening),
  };
  PrayerSlot? _loadingSlot;
  int _activeIdx = 0;
  Timer? _refreshTimer;
  double _fadeVolume = 0;
  Timer? _fadeTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    PrayerSlots.revision.addListener(_refreshUnlocked);
    _refreshTimer = Timer.periodic(
      const Duration(minutes: 1),
      (_) => _refreshUnlocked(),
    );
    _markOpenedIfNeeded();
    _startMusic();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PrayerSlots.revision.removeListener(_refreshUnlocked);
    _refreshTimer?.cancel();
    _fadeTimer?.cancel();
    _player.dispose();
    _musicReady.dispose();
    _pageController.dispose();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshUnlocked();
      _fadeIn();
    } else {
      _fadeTimer?.cancel();
      _player.pause();
    }
  }

  /* ---------- ambient music (same R2 track, fade to 0.28) ---------- */

  Future<void> _startMusic() async {
    try {
      await _player.setLoopMode(LoopMode.one);
      await _player.setUrl(kPrayerMusicUrl);
      await _player.setVolume(0);
      _fadeIn();
      _musicReady.value = true;
    } catch (_) {
      // Music is optional — narration must still be allowed to play.
      _musicReady.value = true;
    }
  }

  void _fadeIn() {
    _fadeTimer?.cancel();
    _player.play();
    _fadeTimer = Timer.periodic(const Duration(milliseconds: 80), (timer) {
      _fadeVolume = (_fadeVolume + 0.02).clamp(0, 0.28);
      _player.setVolume(_fadeVolume);
      if (_fadeVolume >= 0.28) timer.cancel();
    });
  }

  /* ---------- unlock state ---------- */

  void _refreshUnlocked() {
    final next = {
      PrayerSlot.morning: PrayerSlots.isUnlocked(PrayerSlot.morning),
      PrayerSlot.evening: PrayerSlots.isUnlocked(PrayerSlot.evening),
    };
    if (next[PrayerSlot.morning] == _unlocked[PrayerSlot.morning] &&
        next[PrayerSlot.evening] == _unlocked[PrayerSlot.evening]) {
      return;
    }
    if (mounted) setState(() => _unlocked = next);
    _markOpenedIfNeeded();
  }

  void _markOpenedIfNeeded() {
    final active = _slots[_activeIdx];
    if (_unlocked[active] == true) {
      PrayerSlots.markOpened(active);
      DailyFunnel.markPrayerViewed();
    }
  }

  Future<void> _handleUnlock(PrayerSlot slot) async {
    if (_loadingSlot != null) return;
    setState(() => _loadingSlot = slot);
    await Analytics.capture('prayer_unlock_started', {'slot': slot.name});
    try {
      final earned = await AdsService.showRewarded();
      if (earned) {
        await PrayerSlots.markUnlocked(slot);
        await PrayerSlots.markOpened(slot);
        if (mounted) {
          setState(() => _unlocked = {..._unlocked, slot: true});
          AppToast.success(context, t('dev.toast.unlocked'));
        }
        await Analytics.capture('prayer_unlocked', {'slot': slot.name});
      } else {
        if (mounted) AppToast.success(context, t('dev.toast.stayToEnd'));
        await Analytics.capture('prayer_unlock_abandoned', {'slot': slot.name});
      }
    } catch (_) {
      if (mounted) AppToast.error(context, t('dev.toast.error'));
    } finally {
      if (mounted) setState(() => _loadingSlot = null);
    }
  }

  /* ---------- leaving ---------- */

  void _leave({bool fromContinue = false}) {
    final tasks = TodayTasksStore.read();
    final prayerWasSeen = tasks.prayer || DailyFunnel.prayerViewedMs > 0;

    if (fromContinue && prayerWasSeen && !tasks.reflection) {
      DailyFunnel.requestOpenReflection();
    } else if (fromContinue && prayerWasSeen && !tasks.quiz) {
      DailyFunnel.setHandoff(HandoffStep.quiz);
    } else if (!fromContinue && prayerWasSeen && !tasks.reflection) {
      DailyFunnel.setHandoff(HandoffStep.reflection);
    } else if (!fromContinue && prayerWasSeen && !tasks.quiz) {
      DailyFunnel.setHandoff(HandoffStep.quiz);
    }

    // No interstitial on prayer close/continue — it kills the return rate.
    if (mounted) Navigator.of(context).maybePop();
  }

  /// Escalating exit rescue — 1:1 of `useFunnelExit({ from: "prayer" })`.
  bool _tryExit() {
    final tasks = TodayTasksStore.read();
    if (tasks.allDone || tasks.prayer) return true;
    final count = DailyFunnel.readExitCount();
    DailyFunnel.bumpExitCount();
    if (count == 0) {
      // Same hardcoded copy as `useFunnelExit` on web.
      AppToast.success(
        context,
        '🙏 Just two more minutes — finish your walk today',
        description: 'Your streak is one tap away.',
      );
      return true;
    }
    showFunnelExitModal(context, onLeave: () => _leave());
    return false;
  }

  void _handleBack() {
    if (_tryExit()) _leave();
  }

  /* ---------- build ---------- */

  int _bgIndexFor(PrayerSlot slot) {
    final day = ContentData.dayOfYear();
    return (day + (slot == PrayerSlot.evening ? 1 : 0)) %
        kDevotionalBackgrounds.length;
  }

  DateTime _dateFor(PrayerSlot slot) {
    final now = DateTime.now();
    return slot == PrayerSlot.evening ? now.add(const Duration(days: 1)) : now;
  }

  @override
  Widget build(BuildContext context) {
    final padTop = MediaQuery.paddingOf(context).top;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _handleBack();
      },
      child: Scaffold(
        backgroundColor: Colors.black,
        body: Stack(
          children: [
            PageView.builder(
              controller: _pageController,
              scrollDirection: Axis.vertical,
              itemCount: _slots.length,
              onPageChanged: (i) {
                setState(() => _activeIdx = i);
                _markOpenedIfNeeded();
              },
              itemBuilder: (context, i) {
                final slot = _slots[i];
                final date = _dateFor(slot);
                final locked = _unlocked[slot] != true;
                if (locked) {
                  return Stack(
                    fit: StackFit.expand,
                    children: [
                      Opacity(
                        opacity: 0.5,
                        child: Image.network(
                          kDevotionalBackgrounds[_bgIndexFor(slot)],
                          fit: BoxFit.cover,
                        ),
                      ),
                      DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withValues(alpha: 0.7),
                              Colors.black.withValues(alpha: 0.85),
                            ],
                          ),
                        ),
                        child: const SizedBox.expand(),
                      ),
                      LockedPrayerCard(
                        onUnlock: () => _handleUnlock(slot),
                        isLoading: _loadingSlot == slot,
                        title: slot == PrayerSlot.evening
                            ? t('dev.locked.eveningTitle')
                            : t('dev.locked.tomorrowTitle'),
                        subtitle: slot == PrayerSlot.evening
                            ? t('dev.locked.eveningSubtitle')
                            : t('dev.locked.tomorrowSubtitle'),
                        countdownLabel: t('dev.locked.countdownLabel'),
                      ),
                    ],
                  );
                }
                return DevotionalSlide(
                  prayer: ContentData.prayerForDate(date),
                  prayerIndex: ContentData.prayerIndexForDate(date),
                  bgIndex: _bgIndexFor(slot),
                  isActive: _activeIdx == i,
                  slideNumber: i + 1,
                  totalSlides: _slots.length,
                  musicReady: _musicReady,
                  onOpenPersonalPrayer: () => showPersonalPrayerSheet(context),
                  continueLabel: t('dev.slide.continue'),
                  onContinue: () => _leave(fromContinue: true),
                );
              },
            ),

            // Funnel-aware back button — kept subtle so it doesn't fight the prayer
            Positioned(
              left: 12,
              top: padTop > 14 ? padTop : 14,
              child: GestureDetector(
                onTap: _handleBack,
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.black.withValues(alpha: 0.4),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.15),
                    ),
                  ),
                  child: Icon(
                    Icons.arrow_back_rounded,
                    size: 18,
                    color: Colors.white.withValues(alpha: 0.9),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
