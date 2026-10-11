import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/backend_service.dart';
import '../../core/services/haptics.dart';
import '../../core/services/share_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/color_boost.dart';
import '../../widgets/lucide.dart';
import '../favorites/wallpaper_tiles.dart';
import 'live_preview_clip.dart';

/// Minimal live-wallpaper preview/apply overlay — 1:1 subset of
/// `src/components/LivePreviewOverlay.tsx` (fullscreen video, apply CTA,
/// premium gate, swipe prev/next, share).
class LivePreviewOverlay extends StatefulWidget {
  const LivePreviewOverlay({
    required this.wallpaper,
    required this.isPremiumUser,
    required this.applying,
    required this.onClose,
    required this.onApply,
    required this.onPremium,
    this.onPrev,
    this.onNext,
    required this.isFavorite,
    required this.onToggleFavorite,
  });

  final LiveWallpaperDB wallpaper;
  final bool isPremiumUser;
  final bool applying;
  final VoidCallback onClose;
  final VoidCallback onApply;
  final VoidCallback onPremium;
  final VoidCallback? onPrev;
  final VoidCallback? onNext;
  final bool isFavorite;
  final VoidCallback onToggleFavorite;

  @override
  State<LivePreviewOverlay> createState() => LivePreviewOverlayState();
}

class LivePreviewOverlayState extends State<LivePreviewOverlay> {
  VideoPlayerController? _controller;
  bool _ready = false;

  @override
  void initState() {
    super.initState();
    Analytics.capture('content_view', {'wallpaper_id': widget.wallpaper.id});
    _init();
  }

  void _init() {
    _controller =
        VideoPlayerController.networkUrl(Uri.parse(widget.wallpaper.videoUrl))
          ..setLooping(true)
          ..initialize().then((_) {
            if (!mounted) return;
            setState(() => _ready = true);
            _controller?.play();
          });
  }

  @override
  void didUpdateWidget(covariant LivePreviewOverlay old) {
    super.didUpdateWidget(old);
    if (old.wallpaper.id != widget.wallpaper.id) {
      _controller?.dispose();
      _ready = false;
      Analytics.capture('content_view', {'wallpaper_id': widget.wallpaper.id});
      _init();
    }
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  Future<void> _share() async {
    await ShareService.share(
      title: t('wp.share.appTitle'),
      text: t('wp.share.liveText'),
      dialogTitle: t('wp.share.dialogLive'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.wallpaper;
    final gated = !widget.isPremiumUser && w.isPremium;
    return PopScope(
      // Hardware back closes the preview (web parity) instead of bubbling up to
      // the tab shell, which used to jump to Today and leave the nav hidden.
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        if (!widget.applying) widget.onClose();
      },
      child: Material(
      color: Colors.black,
      child: GestureDetector(
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
            if (_ready && _controller != null)
              ColorBoost(
                preset: ColorBoostPreset.fullVideo,
                child: ClipRect(
                  clipBehavior: Clip.hardEdge,
                  child: Transform.scale(
                    scale: 1.06,
                    filterQuality: FilterQuality.medium,
                    child: FittedBox(
                      fit: BoxFit.cover,
                      child: SizedBox(
                        width: _controller!.value.size.width,
                        height: _controller!.value.size.height,
                        child: VideoPlayer(_controller!),
                      ),
                    ),
                  ),
                ),
              )
            else if (isLivePreviewClip(w.thumbnailUrl))
              LivePreviewClip(
                url: w.thumbnailUrl!,
                fallbackUrl: w.videoUrl,
                boost: ColorBoostPreset.fullVideo,
              )
            else if (w.thumbnailUrl != null)
              ColorBoost(
                preset: ColorBoostPreset.still,
                child: CachedNetworkImage(
                  imageUrl: w.thumbnailUrl!,
                  fit: BoxFit.cover,
                  // Full-screen preview: decode at phone width, not tile width,
                  // otherwise the still behind the video looks blurry.
                  memCacheWidth: 1080,
                  filterQuality: FilterQuality.medium,
                ),
              )
            else
              ColoredBox(color: AppColors.secondary),
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    Colors.black.withValues(alpha: 0.35),
                    Colors.transparent,
                    Colors.black.withValues(alpha: 0.6),
                  ],
                ),
              ),
            ),
            SafeArea(
              child: Align(
                alignment: Alignment.topCenter,
                child: Padding(
                padding: const EdgeInsets.all(20),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _roundBtn(Icons.arrow_back, widget.onClose),
                    Row(
                      children: [
                        _roundBtn(
                          widget.isFavorite
                              ? Icons.favorite
                              : Icons.favorite_border,
                          widget.onToggleFavorite,
                        ),
                        const SizedBox(width: 10),
                        GestureDetector(
                          onTap: _share,
                          child: Container(
                            height: 48,
                            padding: const EdgeInsets.symmetric(horizontal: 16),
                            decoration: BoxDecoration(
                              color: Colors.black.withValues(alpha: 0.28),
                              borderRadius: BorderRadius.circular(999),
                              border: Border.all(
                                color: AppColors.primary.withValues(
                                  alpha: 0.55,
                                ),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                LucideIcon(
                                  'share-2',
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
                  ],
                ),
                ),
              ),
            ),
            Positioned(
              left: 24,
              right: 24,
              bottom: 24,
              child: SafeArea(
                top: false,
                child: GestureDetector(
                  onTap: widget.applying ? null : widget.onApply,
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
                        Icon(
                          gated ? Icons.lock : Icons.smartphone,
                          color: Colors.black,
                          size: 18,
                        ),
                        const SizedBox(width: 10),
                        Text(
                          gated ? t('wp.live.unlockTitle') : t('wp.reel.apply'),
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
          ],
        ),
      ),
      ),
    );
  }

  Widget _roundBtn(IconData icon, VoidCallback onTap) => GestureDetector(
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
