import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/content_data.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/rating_service.dart';
import '../../core/data/verse_packs.dart';
import '../../core/services/active_verse_pack.dart';
import '../../core/services/wallpaper_bridge.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart';
import 'daily_verse_wallpaper_preview.dart';
import 'verse_pack_picker.dart';

/// 1:1 port of `src/pages/DailyVerse.tsx`.
///
/// Deviations (documented, not silent):
///  * `DailyVersePrefetchModal` (native asset-prefetch progress UI) is not
///    ported; `WallpaperBridge.setDailyVerseWallpaper` is called directly
///    since the Flutter build has no live-wallpaper-service prefetch bridge.
///  * The live wallpaper auto-rotation service (`DailyVerseWallpaper` plugin:
///    `openPicker`/`isActive`/`getCacheStatus`) has no Flutter MethodChannel
///    counterpart yet, so "Auto-Change Every Day" opens the Premium sheet
///    (when locked) and otherwise shows the native-required toast — the same
///    fallback the web app itself shows on non-native platforms.
class DailyVerseScreen extends ConsumerStatefulWidget {
  const DailyVerseScreen({super.key});

  @override
  ConsumerState<DailyVerseScreen> createState() => _DailyVerseScreenState();
}

class _DailyVerseScreenState extends ConsumerState<DailyVerseScreen> {
  static const _kManualAppliesKey = 'jwbp_verse_manual_applies_v1';

  bool _applying = false;
  bool _premiumOpen = false;
  String _premiumTrigger = 'daily_verse';

  @override
  void initState() {
    super.initState();
    final isPremium = ref.read(premiumProvider);
    Analytics.capture('daily_verse_page_viewed', {
      'is_premium': isPremium,
      'auto_active': false,
      'native': true,
    });
    VersePacks.load().then((_) {
      if (mounted) setState(() {});
    });
    WallpaperBridge.dailyVerseSetPremium(isPremium);
    if (isPremium) WallpaperBridge.dailyVerseMarkUnlocked();
    // Re-sync any previously activated pack to native on mount, so app
    // reinstalls / version bumps don't silently fall back to the 365
    // default rotation while the UI still claims a pack is active.
    final packId = ActiveVersePack.instance.value;
    final pack = VersePacks.getVersePack(packId);
    if (pack != null) {
      WallpaperBridge.dailyVerseSetMoodPack(
        pack.id,
        pack.verses
            .map((v) => {'text': v.text, 'reference': v.reference})
            .toList(),
      );
    }
  }

  void _openPremium(String trigger) {
    haptic(HapticStyle.medium);
    setState(() {
      _premiumTrigger = trigger;
      _premiumOpen = true;
    });
  }

  Future<void> _handleEnableAutoUpdate() async {
    final isPremium = ref.read(premiumProvider);
    Analytics.capture('daily_verse_auto_update_tapped', {
      'is_premium': isPremium,
    });
    if (!isPremium) {
      _openPremium('daily_verse_auto_unlock');
      return;
    }
    haptic(HapticStyle.heavy);
    AppToast.success(context, t('dv.toast.tapSet'));
  }

  void _pitchAutoUpdateIfFree() {
    final isPremium = ref.read(premiumProvider);
    if (isPremium) return;
    final count = Prefs.getInt(_kManualAppliesKey) + 1;
    Prefs.setInt(_kManualAppliesKey, count);
    Future.delayed(const Duration(milliseconds: 2200), () {
      if (!mounted) return;
      _openPremium('daily_verse_manual_apply');
    });
  }

  Future<void> _handleApplyWallpaper() async {
    if (_applying) return;
    final isPremium = ref.read(premiumProvider);
    Analytics.capture('daily_verse_apply_tapped', {
      'is_premium': isPremium,
      'native': true,
    });

    setState(() => _applying = true);
    haptic(HapticStyle.heavy);

    try {
      if (!isPremium) {
        final earned = await AdsService.showRewarded();
        if (!earned) {
          if (mounted) AppToast.error(context, t('dv.toast.adError'));
          return;
        }
      }

      final bg = ContentData.backgroundForDay();
      final verse = ContentData.verseForDate();
      final ok = await WallpaperBridge.setDailyVerseWallpaper({
        'url': bg?.url,
        'verseText': verse.text,
        'verseReference': verse.reference,
        'target': 'both',
      });

      if (!ok) {
        if (mounted) AppToast.error(context, t('dv.toast.applyError'));
        return;
      }

      if (mounted) AppToast.success(context, t('dv.toast.tapSet'));
      _pitchAutoUpdateIfFree();
      // Biggest happy moment in the app — ask for the rating 5s later. If the
      // paywall pitch opens first, the overlay gate parks the prompt until it
      // closes (same behaviour as `DailyVerse.tsx`).
      Future.delayed(
        const Duration(milliseconds: 5000),
        RatingService.maybeRequestRating,
      );
    } finally {
      if (mounted) setState(() => _applying = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isPremium = ref.watch(premiumProvider);
    final verse = ContentData.verseForDate();
    final bg = ContentData.backgroundForDay();

    return Stack(
      children: [
        Scaffold(
          backgroundColor: AppColors.background,
          body: SafeArea(
            bottom: false,
            child: Column(
              children: [
                // Glass header
                DecoratedBox(
                  decoration: BoxDecoration(
                    color: AppColors.glass,
                    border: Border(
                      bottom: BorderSide(color: AppColors.glassBorder),
                    ),
                  ),
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 12),
                    child: Row(
                      children: [
                        TapScale(
                          scale: 0.9,
                          onTap: () => Navigator.of(context).maybePop(),
                          child: Container(
                            width: 36,
                            height: 36,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(14),
                              color: AppColors.foreground.withValues(
                                alpha: 0.06,
                              ),
                              border: Border.all(
                                color: AppColors.foreground.withValues(
                                  alpha: 0.08,
                                ),
                              ),
                            ),
                            child: Icon(
                              Icons.arrow_back,
                              size: 18,
                              color: AppColors.foreground.withValues(
                                alpha: 0.8,
                              ),
                            ),
                          ),
                        ),
                        Expanded(
                          child: Column(
                            children: [
                              Text.rich(
                                TextSpan(
                                  children: [
                                    TextSpan(
                                      text: t('dv.header.daily'),
                                      style: TextStyle(
                                        color: AppColors.primary,
                                      ),
                                    ),
                                    TextSpan(
                                      text: t('dv.header.verse'),
                                      style: TextStyle(
                                        color: AppColors.foreground.withValues(
                                          alpha: 0.9,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w900,
                                  letterSpacing: -0.3,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                t('dv.header.subtitle').toUpperCase(),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w600,
                                  letterSpacing: 1.8,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.7,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 36),
                      ],
                    ),
                  ),
                ),

                Expanded(
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(12, 16, 12, 160),
                    children: [
                      // Today badge
                      FadeRise(
                        child: Center(
                          child: Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(999),
                              color: AppColors.primary.withValues(alpha: 0.12),
                              border: Border.all(
                                color: AppColors.primary.withValues(
                                  alpha: 0.25,
                                ),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Container(
                                  width: 6,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: AppColors.primary,
                                  ),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  t('dv.badge.today').toUpperCase(),
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1.5,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Wallpaper mockup card
                      FadeRise(
                        child: Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 220),
                            child: FractionallySizedBox(
                              widthFactor: 0.58,
                              child: Container(
                                clipBehavior: Clip.antiAlias,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(22),
                                  border: Border.all(
                                    color: AppColors.glassBorder,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(
                                        alpha: 0.5,
                                      ),
                                      blurRadius: 60,
                                      offset: const Offset(0, 20),
                                    ),
                                  ],
                                ),
                                child: DailyVerseWallpaperPreview(
                                  verse: verse,
                                  backgroundUrl: bg?.url,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Primary CTA — Apply
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 24, 16, 0),
                        child: Column(
                          children: [
                            TapScale(
                              scale: 0.97,
                              onTap: _applying ? () {} : _handleApplyWallpaper,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 16,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      AppColors.primary,
                                      AppColors.primary.withValues(alpha: 0.78),
                                    ],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.45,
                                      ),
                                      blurRadius: 40,
                                      offset: const Offset(0, 12),
                                    ),
                                  ],
                                ),
                                child: Opacity(
                                  opacity: _applying ? 0.7 : 1,
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: [
                                      const Icon(
                                        Icons.smartphone,
                                        color: Colors.white,
                                        size: 20,
                                      ),
                                      const SizedBox(width: 10),
                                      Text(
                                        _applying
                                            ? t('dv.cta.preparing')
                                            : t('dv.cta.apply'),
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 15,
                                          fontWeight: FontWeight.w900,
                                          letterSpacing: -0.2,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: '${t('dv.cta.free')} ',
                                    style: TextStyle(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  TextSpan(
                                    text: '\u00b7 ${t('dv.cta.freeDesc')}',
                                  ),
                                ],
                              ),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.foreground.withValues(
                                  alpha: 0.6,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Secondary CTA — Auto-Change
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
                        child: Column(
                          children: [
                            TapScale(
                              scale: 0.97,
                              onTap: _handleEnableAutoUpdate,
                              child: Container(
                                width: double.infinity,
                                padding: const EdgeInsets.symmetric(
                                  vertical: 14,
                                ),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      AppColors.primary,
                                      AppColors.accent,
                                    ],
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: AppColors.primary.withValues(
                                        alpha: 0.55,
                                      ),
                                      blurRadius: 44,
                                      offset: const Offset(0, 14),
                                    ),
                                  ],
                                ),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(
                                      Icons.workspace_premium,
                                      color: Colors.white,
                                      size: 16,
                                    ),
                                    const SizedBox(width: 8),
                                    Text(
                                      t('dv.cta.auto'),
                                      style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w900,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(
                                    text: '${t('dv.cta.premium')} ',
                                    style: TextStyle(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.w900,
                                    ),
                                  ),
                                  TextSpan(
                                    text: '\u00b7 ${t('dv.cta.premiumDesc')}',
                                  ),
                                ],
                              ),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 10.5,
                                fontWeight: FontWeight.w600,
                                color: AppColors.foreground.withValues(
                                  alpha: 0.65,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),

                      // Verse Packs — fully mapped out right here, no hidden sheet
                      VersePackPicker(
                        isPremium: isPremium,
                        onProUpsell: () =>
                            _openPremium('daily_verse_bg_pro_locked'),
                        onPackActivated: (mood) {
                          Analytics.capture('verse_pack_apply_auto_launched', {
                            'mood': mood,
                          });
                          Future.delayed(
                            const Duration(milliseconds: 250),
                            _handleApplyWallpaper,
                          );
                        },
                      ),

                      // Pro auto-update explainer card
                      Padding(
                        padding: const EdgeInsets.fromLTRB(16, 20, 16, 0),
                        child: Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(22),
                            color: AppColors.primary.withValues(alpha: 0.08),
                            border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.28),
                            ),
                          ),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 44,
                                height: 44,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(16),
                                  gradient: LinearGradient(
                                    begin: Alignment.topLeft,
                                    end: Alignment.bottomRight,
                                    colors: [
                                      AppColors.primary,
                                      AppColors.primary.withValues(alpha: 0.7),
                                    ],
                                  ),
                                ),
                                child: const Icon(
                                  Icons.wb_sunny,
                                  color: Colors.white,
                                  size: 20,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          t('dv.auto.title'),
                                          style: TextStyle(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.w900,
                                            color: AppColors.foreground,
                                          ),
                                        ),
                                        if (!isPremium) ...[
                                          const SizedBox(width: 6),
                                          Icon(
                                            Icons.workspace_premium,
                                            size: 14,
                                            color: AppColors.primary,
                                          ),
                                        ],
                                      ],
                                    ),
                                    const SizedBox(height: 2),
                                    Text(
                                      t('dv.auto.subIdle'),
                                      style: TextStyle(
                                        fontSize: 11,
                                        height: 1.35,
                                        color: AppColors.foreground.withValues(
                                          alpha: 0.75,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(height: 10),
                                    Wrap(
                                      spacing: 6,
                                      runSpacing: 6,
                                      children:
                                          [
                                                '\u{1F54A}\uFE0F ${t('dv.auto.chip1')}',
                                                '\u{1F64F} ${t('dv.auto.chip2')}',
                                                '\u{1F49B} ${t('dv.auto.chip3')}',
                                                '\u{1F305} ${t('dv.auto.chip4')}',
                                              ]
                                              .map(
                                                (chip) => Container(
                                                  padding:
                                                      const EdgeInsets.symmetric(
                                                        horizontal: 10,
                                                        vertical: 4,
                                                      ),
                                                  decoration: BoxDecoration(
                                                    borderRadius:
                                                        BorderRadius.circular(
                                                          999,
                                                        ),
                                                    color: AppColors.foreground
                                                        .withValues(
                                                          alpha: 0.06,
                                                        ),
                                                    border: Border.all(
                                                      color: AppColors
                                                          .foreground
                                                          .withValues(
                                                            alpha: 0.08,
                                                          ),
                                                    ),
                                                  ),
                                                  child: Text(
                                                    chip,
                                                    style: TextStyle(
                                                      fontSize: 10,
                                                      fontWeight:
                                                          FontWeight.bold,
                                                      color: AppColors
                                                          .foreground
                                                          .withValues(
                                                            alpha: 0.85,
                                                          ),
                                                    ),
                                                  ),
                                                ),
                                              )
                                              .toList(),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),

                      // Why section
                      Padding(
                        padding: const EdgeInsets.fromLTRB(8, 28, 8, 0),
                        child: Column(
                          children: [
                            Text(
                              t('dv.why.eyebrow').toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 2.2,
                                color: AppColors.primary.withValues(alpha: 0.8),
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text.rich(
                              TextSpan(
                                children: [
                                  TextSpan(text: '${t('dv.why.title1')}\n'),
                                  TextSpan(
                                    text: t('dv.why.title2'),
                                    style: TextStyle(color: AppColors.primary),
                                  ),
                                ],
                              ),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 19,
                                fontWeight: FontWeight.w800,
                                height: 1.2,
                                color: AppColors.foreground,
                              ),
                            ),
                            const SizedBox(height: 8),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                              ),
                              child: Text(
                                t('dv.why.sub'),
                                textAlign: TextAlign.center,
                                style: TextStyle(
                                  fontSize: 12.5,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.65,
                                  ),
                                ),
                              ),
                            ),
                            const SizedBox(height: 20),
                            GridView.count(
                              crossAxisCount: 2,
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              crossAxisSpacing: 10,
                              mainAxisSpacing: 10,
                              childAspectRatio: 1.5,
                              children:
                                  [
                                    (
                                      '\u{1F305}',
                                      t('dv.pillar.auto.title'),
                                      t('dv.pillar.auto.desc'),
                                    ),
                                    (
                                      '\u{1FAB6}',
                                      t('dv.pillar.battery.title'),
                                      t('dv.pillar.battery.desc'),
                                    ),
                                    (
                                      '\u{1F64F}',
                                      t('dv.pillar.forget.title'),
                                      t('dv.pillar.forget.desc'),
                                    ),
                                    (
                                      '\u271D\uFE0F',
                                      t('dv.pillar.verses.title'),
                                      t('dv.pillar.verses.desc'),
                                    ),
                                  ].map((f) {
                                    final (icon, title, desc) = f;
                                    return Container(
                                      padding: const EdgeInsets.all(12),
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(16),
                                        color: AppColors.card,
                                        border: Border.all(
                                          color: AppColors.glassBorder,
                                        ),
                                      ),
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        mainAxisAlignment:
                                            MainAxisAlignment.start,
                                        children: [
                                          Text(
                                            icon,
                                            style: const TextStyle(
                                              fontSize: 20,
                                            ),
                                          ),
                                          const SizedBox(height: 6),
                                          Text(
                                            title,
                                            style: TextStyle(
                                              fontSize: 11.5,
                                              fontWeight: FontWeight.w900,
                                              color: AppColors.foreground,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            desc,
                                            style: TextStyle(
                                              fontSize: 10,
                                              height: 1.3,
                                              color: AppColors.foreground
                                                  .withValues(alpha: 0.65),
                                            ),
                                          ),
                                        ],
                                      ),
                                    );
                                  }).toList(),
                            ),
                            const SizedBox(height: 12),
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 24,
                              ),
                              child: Column(
                                children: [
                                  Text(
                                    t('dv.closing.quote'),
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      fontSize: 11,
                                      fontStyle: FontStyle.italic,
                                      color: AppColors.foreground.withValues(
                                        alpha: 0.55,
                                      ),
                                    ),
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '\u2014 Psalm 119:105',
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 1,
                                      color: AppColors.primary.withValues(
                                        alpha: 0.7,
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
              ],
            ),
          ),
        ),
        if (_premiumOpen)
          PremiumSheet(
            trigger: _premiumTrigger,
            onClose: () => setState(() => _premiumOpen = false),
            onUnlock: () {
              ref.read(premiumProvider.notifier).setUnlocked();
              setState(() => _premiumOpen = false);
            },
          ),
      ],
    );
  }
}
