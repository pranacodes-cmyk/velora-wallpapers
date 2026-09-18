import 'package:flutter/material.dart';

import '../../core/data/verse_packs.dart';
import '../../core/localization/app_localizations.dart';
import '../../core/services/active_verse_pack.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/wallpaper_bridge.dart';
import '../../core/theme/app_colors.dart';
import '../../widgets/app_toast.dart';
import '../today/today_shared.dart';

/// 1:1 port of `src/components/VersePackPicker.tsx`.
///
/// Every verse pack, mapped out right on the setup page — no hidden sheet.
class VersePackPicker extends StatefulWidget {
  const VersePackPicker({
    super.key,
    required this.isPremium,
    required this.onProUpsell,
    this.onPackActivated,
  });

  final bool isPremium;
  final VoidCallback onProUpsell;
  final ValueChanged<String>? onPackActivated;

  @override
  State<VersePackPicker> createState() => _VersePackPickerState();
}

class _VersePackPickerState extends State<VersePackPicker> {
  @override
  void initState() {
    super.initState();
    ActiveVersePack.instance.addListener(_onChange);
  }

  @override
  void dispose() {
    ActiveVersePack.instance.removeListener(_onChange);
    super.dispose();
  }

  void _onChange() {
    if (mounted) setState(() {});
  }

  Future<void> _pushPackToNative(String packId, {bool clear = false}) async {
    if (clear) {
      await WallpaperBridge.dailyVerseSetMoodPack(null, const []);
      return;
    }
    final p = VersePacks.getVersePack(packId);
    if (p == null) return;
    await WallpaperBridge.dailyVerseSetMoodPack(
      packId,
      p.verses.map((v) => {'text': v.text, 'reference': v.reference}).toList(),
    );
  }

  Future<void> _handleTap(String packId) async {
    haptic(HapticStyle.soft);
    if (!widget.isPremium) {
      Analytics.capture('verse_pack_paywall_triggered', {'mood': packId});
      widget.onProUpsell();
      return;
    }

    final stored = ActiveVersePack.instance.value;
    final activePackId = VersePacks.isValidVersePackId(stored) ? stored : null;

    if (activePackId == packId) {
      await ActiveVersePack.instance.set(null);
      await _pushPackToNative(packId, clear: true);
      Analytics.capture('verse_pack_deactivated', {'mood': packId});
      if (mounted) AppToast.success(context, t('wp.packs.deactivatedToast'));
      return;
    }

    await ActiveVersePack.instance.set(packId);
    await _pushPackToNative(packId);
    Analytics.capture('verse_pack_activated', {
      'mood': packId,
      'just_downloaded': false,
    });
    final p = VersePacks.getVersePack(packId);
    if (mounted) {
      AppToast.success(
        context,
        t('wp.packs.activatedToast', {
          'label': p != null ? packLabel(p.id, p.label) : 'Pack',
        }),
      );
    }
    widget.onPackActivated?.call(packId);
    // Happy moment → rating ask, same 4s delay as `VersePackPicker.tsx`.
    Future.delayed(
      const Duration(milliseconds: 4000),
      RatingService.maybeRequestRating,
    );
  }

  @override
  Widget build(BuildContext context) {
    final stored = ActiveVersePack.instance.value;
    final activePackId = VersePacks.isValidVersePackId(stored) ? stored : null;
    final isPremium = widget.isPremium;
    final allPacks = VersePacks.all;

    return Padding(
      padding: const EdgeInsets.fromLTRB(12, 8, 12, 0),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(22),
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.primary.withValues(alpha: 0.13),
              AppColors.accent.withValues(alpha: 0.09),
              AppColors.primary.withValues(alpha: 0.06),
            ],
          ),
          border: Border.all(
            color: AppColors.primary.withValues(alpha: isPremium ? 0.5 : 0.4),
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('wp.packs.headerTitle'),
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.2,
                          color: AppColors.foreground,
                          height: 1.1,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        t('px.packs.countSub', {'count': allPacks.length}),
                        style: TextStyle(
                          fontSize: 10.5,
                          fontWeight: FontWeight.w700,
                          color: AppColors.foreground.withValues(alpha: 0.7),
                        ),
                      ),
                    ],
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 2,
                  ),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(6),
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [
                        AppColors.primary,
                        AppColors.primary.withValues(alpha: 0.82),
                      ],
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        isPremium ? Icons.check : Icons.workspace_premium,
                        size: 10,
                        color: AppColors.primaryForeground,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        isPremium ? t('wp.packs.unlocked') : 'PRO',
                        style: TextStyle(
                          fontSize: 9,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 1,
                          color: AppColors.primaryForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),

            for (final group in versePackGroups) ...[
              Padding(
                padding: const EdgeInsets.only(top: 14, left: 2),
                child: Text(
                  packGroupTitle(groupId(group.id), group.title),
                  style: TextStyle(
                    fontSize: 11.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: -0.2,
                    color: AppColors.foreground.withValues(alpha: 0.9),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 2, bottom: 8, left: 2),
                child: Text(
                  packGroupSubtitle(groupId(group.id), group.subtitle),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w700,
                    color: AppColors.foreground.withValues(alpha: 0.55),
                  ),
                ),
              ),
              GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                crossAxisSpacing: 8,
                mainAxisSpacing: 8,
                childAspectRatio: 1.35,
                children: VersePacks.getPacksByGroup(group.id).map((p) {
                  final active = activePackId == p.id;
                  return TapScale(
                    scale: 0.95,
                    onTap: () => _handleTap(p.id),
                    child: Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        color: active
                            ? AppColors.primary.withValues(alpha: 0.16)
                            : AppColors.foreground.withValues(alpha: 0.05),
                        border: Border.all(
                          color: active
                              ? AppColors.primary.withValues(alpha: 0.6)
                              : AppColors.foreground.withValues(alpha: 0.08),
                          width: active ? 1.5 : 1,
                        ),
                      ),
                      child: Stack(
                        children: [
                          Positioned(
                            top: 0,
                            right: 0,
                            child: active
                                ? Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 6,
                                      vertical: 2,
                                    ),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(6),
                                      color: AppColors.primary,
                                    ),
                                    child: Text(
                                      t('wp.packs.on'),
                                      style: TextStyle(
                                        fontSize: 7.5,
                                        fontWeight: FontWeight.w900,
                                        letterSpacing: 1,
                                        color: AppColors.primaryForeground,
                                      ),
                                    ),
                                  )
                                : (!isPremium
                                      ? Icon(
                                          Icons.lock,
                                          size: 12,
                                          color: AppColors.foreground
                                              .withValues(alpha: 0.35),
                                        )
                                      : const SizedBox.shrink()),
                          ),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Container(
                                width: 36,
                                height: 36,
                                alignment: Alignment.center,
                                margin: const EdgeInsets.only(bottom: 6),
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(12),
                                  gradient: active
                                      ? LinearGradient(
                                          begin: Alignment.topLeft,
                                          end: Alignment.bottomRight,
                                          colors: [
                                            AppColors.primary,
                                            AppColors.primary.withValues(
                                              alpha: 0.75,
                                            ),
                                          ],
                                        )
                                      : null,
                                  color: active
                                      ? null
                                      : AppColors.foreground.withValues(
                                          alpha: 0.07,
                                        ),
                                ),
                                child: Text(
                                  p.emoji,
                                  style: const TextStyle(fontSize: 18),
                                ),
                              ),
                              Padding(
                                padding: const EdgeInsets.only(right: 20),
                                child: Text(
                                  packLabel(p.id, p.label),
                                  maxLines: 2,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w900,
                                    letterSpacing: -0.2,
                                    height: 1.1,
                                    color: AppColors.foreground,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                packTagline(p.id, p.tagline),
                                maxLines: 2,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 9.5,
                                  fontWeight: FontWeight.w700,
                                  height: 1.25,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.6,
                                  ),
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                t('wp.packs.daily'),
                                style: TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.w800,
                                  letterSpacing: 0.4,
                                  color: AppColors.foreground.withValues(
                                    alpha: 0.45,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                }).toList(),
              ),
            ],

            if (!isPremium)
              Padding(
                padding: const EdgeInsets.only(top: 14),
                child: TapScale(
                  scale: 0.97,
                  onTap: () {
                    haptic(HapticStyle.medium);
                    widget.onProUpsell();
                  },
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(16),
                      gradient: LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: [
                          AppColors.primary,
                          AppColors.primary.withValues(alpha: 0.82),
                        ],
                      ),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.7),
                          blurRadius: 22,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.workspace_premium,
                          size: 16,
                          color: AppColors.primaryForeground,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          t('px.packs.unlockAllCta', {
                            'count': allPacks.length,
                          }),
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w900,
                            letterSpacing: -0.2,
                            color: AppColors.primaryForeground,
                          ),
                        ),
                      ],
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
