import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/ads_service.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/wallpaper_bridge.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';

/// Minimal shape passed into the detail view — mirrors the `Wallpaper` type
/// consumed by `src/components/WallpaperDetail.tsx`.
class DetailWallpaper {
  const DetailWallpaper({
    required this.id,
    required this.src,
    required this.title,
    this.isPremium = false,
  });

  final String id;
  final String src;
  final String title;
  final bool isPremium;
}

enum _ApplyTarget { home, lock, both }

String _applyTargetName(_ApplyTarget t) => switch (t) {
  _ApplyTarget.home => 'home',
  _ApplyTarget.lock => 'lock',
  _ApplyTarget.both => 'both',
};

/// 1:1 port of `src/components/WallpaperDetail.tsx` (static-image path — this
/// is the only variant Favorites needs; live wallpapers open their own reel
/// elsewhere in the app).
class WallpaperDetail extends ConsumerStatefulWidget {
  const WallpaperDetail({
    super.key,
    required this.wallpaper,
    required this.onClose,
    this.isFavorite = false,
    this.onToggleFavorite,
    this.onPrev,
    this.onNext,
  });

  final DetailWallpaper wallpaper;
  final VoidCallback onClose;
  final bool isFavorite;
  final VoidCallback? onToggleFavorite;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;

  @override
  ConsumerState<WallpaperDetail> createState() => _WallpaperDetailState();
}

class _WallpaperDetailState extends ConsumerState<WallpaperDetail> {
  bool _imageLoaded = false;
  bool _showApplySheet = false;
  bool _showPremium = false;
  bool _applying = false;
  bool _adUnlocked = false;
  bool _watchingAd = false;

  @override
  void didUpdateWidget(covariant WallpaperDetail old) {
    super.didUpdateWidget(old);
    if (old.wallpaper.id != widget.wallpaper.id) {
      setState(() {
        _imageLoaded = false;
        _adUnlocked = false;
      });
      Analytics.capture('content_view', {'wallpaper_id': widget.wallpaper.id});
    }
  }

  @override
  void initState() {
    super.initState();
    Analytics.capture('content_view', {'wallpaper_id': widget.wallpaper.id});
  }

  bool get _isPremiumUser => ref.read(premiumProvider);

  void _handleApplyTap() {
    haptic(HapticStyle.light);
    setState(() => _showApplySheet = true);
  }

  Future<void> _handleShare() async {
    await ShareService.share(
      title: t('wp.share.appTitle'),
      text: t('wp.share.staticText'),
      dialogTitle: t('wp.share.dialogStatic'),
    );
  }

  Future<void> _handleWatchAd() async {
    if (_applying || _watchingAd) return;
    setState(() => _watchingAd = true);
    final earned = await AdsService.showRewarded();
    if (!mounted) return;
    setState(() => _watchingAd = false);
    if (!earned) {
      AppToast.error(context, t('wp.live.adNotCompleted'));
      return;
    }
    setState(() => _adUnlocked = true);
  }

  Future<void> _applyWallpaper(_ApplyTarget target) async {
    if (_applying) return;
    setState(() => _applying = true);
    try {
      final ok = await WallpaperBridge.setStaticWallpaper(
        widget.wallpaper.src,
        target: _applyTargetName(target),
      );
      if (!mounted) return;
      final label = target == _ApplyTarget.home
          ? t('wp.detail.home')
          : target == _ApplyTarget.lock
          ? t('wp.detail.lock')
          : t('wp.detail.targetBoth');
      if (ok) {
        haptic(HapticStyle.heavy);
        AppToast.success(context, t('wp.detail.setSuccess', {'label': label}));
        Analytics.capture('wallpaper_applied', {
          'wallpaper_id': widget.wallpaper.id,
          'type': 'static',
          'target': _applyTargetName(target),
          'is_premium_wallpaper': widget.wallpaper.isPremium,
        });
        // Happy moment → rating ask, same 3.5s delay as `WallpaperDetail.tsx`.
        Timer(
          const Duration(milliseconds: 3500),
          RatingService.maybeRequestRating,
        );
      } else {
        AppToast.error(context, t('wp.detail.setFailed'));
        Analytics.capture('wallpaper_apply_failed', {
          'wallpaper_id': widget.wallpaper.id,
          'type': 'static',
          'target': _applyTargetName(target),
          'reason': 'unknown',
        });
      }
    } catch (e) {
      if (!mounted) return;
      AppToast.error(context, t('wp.detail.setFailed'));
      Analytics.capture('wallpaper_apply_failed', {
        'wallpaper_id': widget.wallpaper.id,
        'type': 'static',
        'target': _applyTargetName(target),
        'reason': '$e',
      });
    } finally {
      if (mounted) {
        setState(() {
          _applying = false;
          _showApplySheet = false;
          _adUnlocked = false;
        });
      }
    }
  }

  void _handleApplyOptionTap(_ApplyTarget target) {
    _applyWallpaper(target);
  }

  @override
  Widget build(BuildContext context) {
    final isPremiumUser = ref.watch(premiumProvider);
    final w = widget.wallpaper;

    return PopScope(
      canPop: !_applying,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (_applying) return;
        if (_showPremium) {
          setState(() => _showPremium = false);
        } else if (_showApplySheet) {
          setState(() {
            _showApplySheet = false;
            _adUnlocked = false;
          });
        } else {
          widget.onClose();
        }
      },
      child: Material(
        color: Colors.black,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (!_imageLoaded)
              ColoredBox(
                color: AppColors.secondary.withValues(alpha: 0.3),
                child: const Center(
                  child: SizedBox(
                    width: 32,
                    height: 32,
                    child: CircularProgressIndicator(strokeWidth: 3),
                  ),
                ),
              ),
            GestureDetector(
              behavior: HitTestBehavior.translucent,
              onHorizontalDragEnd: (details) {
                final v = details.primaryVelocity ?? 0;
                if (v < -200 && widget.onNext != null) {
                  haptic(HapticStyle.light);
                  widget.onNext!();
                } else if (v > 200 && widget.onPrev != null) {
                  haptic(HapticStyle.light);
                  widget.onPrev!();
                }
              },
              child: Stack(
                fit: StackFit.expand,
                children: [
                  CachedNetworkImage(
                    imageUrl: w.src,
                    fit: BoxFit.cover,
                    imageBuilder: (context, provider) {
                      WidgetsBinding.instance.addPostFrameCallback((_) {
                        if (mounted && !_imageLoaded) {
                          setState(() => _imageLoaded = true);
                        }
                      });
                      return Image(image: provider, fit: BoxFit.cover);
                    },
                    errorWidget: (_, _, _) =>
                        const ColoredBox(color: Colors.black),
                  ),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          Colors.black.withValues(alpha: 0.25),
                          Colors.transparent,
                          Colors.black.withValues(alpha: 0.55),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Top bar
            SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _RoundButton(icon: Icons.arrow_back, onTap: widget.onClose),
                    GestureDetector(
                      onTap: _handleShare,
                      child: Container(
                        height: 48,
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        decoration: BoxDecoration(
                          color: Colors.black.withValues(alpha: 0.28),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: AppColors.primary.withValues(alpha: 0.55),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.share,
                              size: 16,
                              color: AppColors.primary,
                            ),
                            const SizedBox(width: 8),
                            Text(
                              t('wp.detail.share'),
                              style: TextStyle(
                                color: AppColors.primary,
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                letterSpacing: 0.6,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Bottom apply button
            Positioned(
              left: 24,
              right: 24,
              bottom: 24,
              child: SafeArea(
                top: false,
                child: AnimatedOpacity(
                  opacity: _imageLoaded ? 1 : 0,
                  duration: const Duration(milliseconds: 250),
                  child: GestureDetector(
                    onTap: _handleApplyTap,
                    child: Container(
                      height: 52,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(999),
                        boxShadow: const [
                          BoxShadow(
                            color: Colors.black38,
                            blurRadius: 16,
                            offset: Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(
                            Icons.smartphone,
                            color: Colors.black,
                            size: 18,
                          ),
                          const SizedBox(width: 10),
                          Text(
                            t('wp.reel.apply'),
                            style: const TextStyle(
                              color: Colors.black,
                              fontSize: 15,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),

            if (_showApplySheet)
              _ApplySheet(
                title: w.title,
                isPremiumUser: isPremiumUser,
                adUnlocked: _adUnlocked,
                applying: _applying,
                watchingAd: _watchingAd,
                onDismiss: () {
                  if (_applying || _watchingAd) return;
                  setState(() {
                    _showApplySheet = false;
                    _adUnlocked = false;
                  });
                },
                onWatchAd: _handleWatchAd,
                onGoPremium: () {
                  setState(() {
                    _showApplySheet = false;
                    _showPremium = true;
                  });
                },
                onPickTarget: _handleApplyOptionTap,
              ),

            if (_applying)
              ColoredBox(
                color: AppColors.background.withValues(alpha: 0.95),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 56,
                        height: 56,
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          color: AppColors.primary,
                        ),
                      ),
                      const SizedBox(height: 18),
                      Text(
                        t('wp.detail.preparingOverlay'),
                        style: TextStyle(
                          color: AppColors.foreground,
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        t('wp.feed.dontClose'),
                        style: TextStyle(
                          color: AppColors.mutedForeground,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

            if (_showPremium)
              PremiumSheet(
                trigger: 'wallpaper_detail',
                onClose: () => setState(() => _showPremium = false),
                onUnlock: () =>
                    ref.read(premiumProvider.notifier).setUnlocked(),
              ),
          ],
        ),
      ),
    );
  }
}

class _RoundButton extends StatelessWidget {
  const _RoundButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 48,
        height: 48,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.black.withValues(alpha: 0.2),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Icon(icon, color: Colors.white, size: 22),
      ),
    );
  }
}

class _ApplySheet extends StatelessWidget {
  const _ApplySheet({
    required this.title,
    required this.isPremiumUser,
    required this.adUnlocked,
    required this.applying,
    required this.watchingAd,
    required this.onDismiss,
    required this.onWatchAd,
    required this.onGoPremium,
    required this.onPickTarget,
  });

  final String title;
  final bool isPremiumUser;
  final bool adUnlocked;
  final bool applying;
  final bool watchingAd;
  final VoidCallback onDismiss;
  final VoidCallback onWatchAd;
  final VoidCallback onGoPremium;
  final void Function(_ApplyTarget) onPickTarget;

  @override
  Widget build(BuildContext context) {
    final showUnlock = !isPremiumUser && !adUnlocked;
    return Stack(
      children: [
        Positioned.fill(
          child: GestureDetector(
            onTap: onDismiss,
            child: ColoredBox(color: Colors.black.withValues(alpha: 0.6)),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: SafeArea(
            top: false,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              decoration: BoxDecoration(
                color: AppColors.card,
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(24),
                ),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 20),
                    decoration: BoxDecoration(
                      color: AppColors.muted,
                      borderRadius: BorderRadius.circular(999),
                    ),
                  ),
                  if (showUnlock) ...[
                    Text(
                      t('wp.detail.unlockTitle'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.foreground,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '"$title"',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.mutedForeground,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 20),
                    GestureDetector(
                      onTap: onWatchAd,
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        margin: const EdgeInsets.only(bottom: 10),
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.05),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: const Color(0x2622C55E),
                                border: Border.all(
                                  color: const Color(0x4D22C55E),
                                ),
                              ),
                              child: const Icon(
                                Icons.play_arrow,
                                color: Color(0xFF4ADE80),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    t('wp.live.freeAd'),
                                    style: TextStyle(
                                      color: AppColors.foreground,
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    t('wp.live.freeAdSub'),
                                    style: TextStyle(
                                      color: AppColors.mutedForeground,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (watchingAd)
                              const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: onGoPremium,
                      child: Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: AppColors.secondary.withValues(alpha: 0.6),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(
                            color: AppColors.premiumGold.withValues(alpha: 0.2),
                          ),
                        ),
                        child: Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppColors.premiumGold,
                              ),
                              child: const Icon(
                                Icons.workspace_premium,
                                color: Color(0xFF3A2000),
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    t('wp.live.premiumTitle'),
                                    style: TextStyle(
                                      color: AppColors.foreground,
                                      fontSize: 15,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  Text(
                                    t('wp.live.premiumSub'),
                                    style: TextStyle(
                                      color: AppColors.mutedForeground,
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(
                              Icons.flash_on,
                              color: Colors.blueAccent,
                            ),
                          ],
                        ),
                      ),
                    ),
                  ] else ...[
                    Text(
                      t('wp.detail.setTitle'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.foreground,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      t('wp.detail.chooseWhere'),
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        color: AppColors.mutedForeground,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 18),
                    _applyOption(
                      Icons.home_outlined,
                      t('wp.detail.home'),
                      t('wp.detail.homeSub'),
                      () => onPickTarget(_ApplyTarget.home),
                      applying,
                    ),
                    const SizedBox(height: 10),
                    _applyOption(
                      Icons.lock_outline,
                      t('wp.detail.lock'),
                      t('wp.detail.lockSub'),
                      () => onPickTarget(_ApplyTarget.lock),
                      applying,
                    ),
                    const SizedBox(height: 10),
                    _applyOption(
                      Icons.layers_outlined,
                      t('wp.detail.both'),
                      t('wp.detail.bothSub'),
                      () => onPickTarget(_ApplyTarget.both),
                      applying,
                    ),
                    if (applying) ...[
                      const SizedBox(height: 16),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 16,
                            height: 16,
                            child: CircularProgressIndicator(
                              strokeWidth: 2,
                              color: AppColors.primary,
                            ),
                          ),
                          const SizedBox(width: 8),
                          Text(
                            t('wp.detail.applying'),
                            style: TextStyle(
                              color: AppColors.mutedForeground,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _applyOption(
    IconData icon,
    String label,
    String sub,
    VoidCallback onTap,
    bool disabled,
  ) {
    return GestureDetector(
      onTap: disabled ? null : onTap,
      child: Opacity(
        opacity: disabled ? 0.5 : 1,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: AppColors.secondary.withValues(alpha: 0.8),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: LinearGradient(
                    colors: [AppColors.primary, AppColors.accent],
                  ),
                ),
                child: Icon(icon, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 14),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      color: AppColors.foreground,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Text(
                    sub,
                    style: TextStyle(
                      color: AppColors.mutedForeground,
                      fontSize: 11,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
