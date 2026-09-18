import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:video_player/video_player.dart';

import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';

/// Shape of a row from Supabase `wallpapers` — mirrors `StaticWallpaperDB`
/// in `src/hooks/useHomeFeed.ts`.
class StaticWallpaperDB {
  const StaticWallpaperDB({
    required this.id,
    required this.title,
    required this.imageUrl,
    required this.isPremium,
    this.categoryId,
    this.sortOrder = 0,
  });

  final String id;
  final String title;
  final String imageUrl;
  final bool isPremium;
  final String? categoryId;
  final int sortOrder;

  factory StaticWallpaperDB.fromJson(Map<String, dynamic> json) =>
      StaticWallpaperDB(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        imageUrl: json['image_url'] as String? ?? '',
        isPremium: json['is_premium'] as bool? ?? false,
        categoryId: json['category_id'] as String?,
        sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      );
}

/// Shape of a row from Supabase `live_wallpapers` — mirrors `LiveWallpaperDB`
/// in `src/hooks/useLiveWallpapers.ts`.
class LiveWallpaperDB {
  const LiveWallpaperDB({
    required this.id,
    required this.title,
    this.subtitle,
    required this.videoUrl,
    this.thumbnailUrl,
    required this.category,
    required this.isPremium,
    this.sortOrder = 0,
  });

  final String id;
  final String title;
  final String? subtitle;
  final String videoUrl;
  final String? thumbnailUrl;
  final String category;
  final bool isPremium;
  final int sortOrder;

  factory LiveWallpaperDB.fromJson(Map<String, dynamic> json) =>
      LiveWallpaperDB(
        id: json['id'] as String,
        title: json['title'] as String? ?? '',
        subtitle: json['subtitle'] as String?,
        videoUrl: json['video_url'] as String? ?? '',
        thumbnailUrl: json['thumbnail_url'] as String?,
        category: json['category'] as String? ?? '',
        isPremium: json['is_premium'] as bool? ?? false,
        sortOrder: (json['sort_order'] as num?)?.toInt() ?? 0,
      );
}

/// Strips slug prefixes ("Viral 07 ") and duplicate words — 1:1 port of the
/// `cleanTitle()` helper duplicated in `StaticWallpaperTile.tsx` / `LiveWallpaperTile.tsx`.
String cleanWallpaperTitle(String title) {
  var cleaned = title.replaceFirst(RegExp(r'^[A-Za-z]+ \d{1,3}\s+'), '');
  final words = cleaned.split(RegExp(r'\s+'));
  final seen = <String>{};
  final result = <String>[];
  for (final word in words) {
    final lower = word.toLowerCase();
    if (seen.add(lower)) result.add(word);
  }
  return result.isEmpty ? title : result.join(' ');
}

/// 1:1 port of `src/components/StaticWallpaperTile.tsx` (favorites-relevant
/// subset — no admin delete/reorder, since Favorites never shows those).
class StaticWallpaperTile extends StatefulWidget {
  const StaticWallpaperTile({
    super.key,
    required this.wallpaper,
    required this.onTap,
    this.isFavorite = false,
    this.onToggleFavorite,
  });

  final StaticWallpaperDB wallpaper;
  final VoidCallback onTap;
  final bool isFavorite;
  final VoidCallback? onToggleFavorite;

  @override
  State<StaticWallpaperTile> createState() => _StaticWallpaperTileState();
}

class _StaticWallpaperTileState extends State<StaticWallpaperTile> {
  @override
  Widget build(BuildContext context) {
    final w = widget.wallpaper;
    return GestureDetector(
      onTap: () {
        haptic(HapticStyle.light);
        widget.onTap();
      },
      child: AspectRatio(
        aspectRatio: 3 / 5,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: AppColors.secondary.withValues(alpha: 0.3)),
              CachedNetworkImage(
                imageUrl: w.imageUrl,
                fit: BoxFit.cover,
                fadeInDuration: const Duration(milliseconds: 300),
                placeholder: (_, _) => const _Shimmer(),
                errorWidget: (_, _, _) => const _TileError(),
              ),
              // Bottom gradient for legibility.
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.70),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),
              if (w.isPremium)
                Positioned(top: 12, right: 12, child: _PremiumBadge()),
              if (widget.onToggleFavorite != null)
                Positioned(
                  bottom: 10,
                  right: 10,
                  child: _FavoriteButton(
                    isFavorite: widget.isFavorite,
                    onTap: widget.onToggleFavorite!,
                  ),
                ),
              Positioned(
                left: 12,
                right: 40,
                bottom: 12,
                child: Text(
                  cleanWallpaperTitle(w.title),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    letterSpacing: -0.1,
                    shadows: [Shadow(color: Colors.black54, blurRadius: 6)],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 1:1 port of `src/components/LiveWallpaperTile.tsx` (favorites-relevant
/// subset: thumbnail/video preview, play/pause toggle, premium badge, heart).
class LiveWallpaperTile extends StatefulWidget {
  const LiveWallpaperTile({
    super.key,
    required this.wallpaper,
    required this.onTap,
    this.isFavorite = false,
    this.onToggleFavorite,
  });

  final LiveWallpaperDB wallpaper;
  final VoidCallback onTap;
  final bool isFavorite;
  final VoidCallback? onToggleFavorite;

  @override
  State<LiveWallpaperTile> createState() => _LiveWallpaperTileState();
}

class _LiveWallpaperTileState extends State<LiveWallpaperTile> {
  VideoPlayerController? _controller;
  bool _previewActive = false;
  bool _videoReady = false;

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }

  void _togglePreview() {
    haptic(HapticStyle.soft);
    setState(() => _previewActive = !_previewActive);
    if (_previewActive) {
      _controller ??=
          VideoPlayerController.networkUrl(Uri.parse(widget.wallpaper.videoUrl))
            ..setLooping(true)
            ..initialize().then((_) {
              if (!mounted) return;
              setState(() => _videoReady = true);
              _controller?.play();
            });
      if (_videoReady) _controller?.play();
    } else {
      _controller?.pause();
    }
  }

  @override
  Widget build(BuildContext context) {
    final w = widget.wallpaper;
    return GestureDetector(
      onTap: () {
        haptic(HapticStyle.light);
        widget.onTap();
      },
      child: AspectRatio(
        aspectRatio: 9 / 16,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(22),
          child: Stack(
            fit: StackFit.expand,
            children: [
              ColoredBox(color: AppColors.secondary),
              if (_previewActive && _videoReady && _controller != null)
                FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: _controller!.value.size.width,
                    height: _controller!.value.size.height,
                    child: VideoPlayer(_controller!),
                  ),
                )
              else if (w.thumbnailUrl != null)
                CachedNetworkImage(
                  imageUrl: w.thumbnailUrl!,
                  fit: BoxFit.cover,
                  placeholder: (_, _) => const _Shimmer(),
                  errorWidget: (_, _, _) => const _TileError(),
                )
              else
                const _Shimmer(),
              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.bottomCenter,
                    end: Alignment.topCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.85),
                      Colors.black.withValues(alpha: 0.02),
                    ],
                  ),
                ),
              ),
              Positioned(
                top: 10,
                left: 10,
                right: 10,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _RoundIconButton(
                      icon: _previewActive ? Icons.pause : Icons.play_arrow,
                      onTap: _togglePreview,
                    ),
                    if (w.isPremium) _PremiumBadge(),
                  ],
                ),
              ),
              if (widget.onToggleFavorite != null)
                Positioned(
                  bottom: 10,
                  right: 10,
                  child: _FavoriteButton(
                    isFavorite: widget.isFavorite,
                    onTap: widget.onToggleFavorite!,
                    size: 32,
                  ),
                ),
              Positioned(
                left: 12,
                right: 44,
                bottom: 12,
                child: Text(
                  cleanWallpaperTitle(w.title),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.1,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PremiumBadge extends StatelessWidget {
  const _PremiumBadge();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
      ),
      child: Icon(Icons.diamond, size: 12, color: AppColors.premiumGold),
    );
  }
}

class _FavoriteButton extends StatelessWidget {
  const _FavoriteButton({
    required this.isFavorite,
    required this.onTap,
    this.size = 28,
  });
  final bool isFavorite;
  final VoidCallback onTap;
  final double size;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () {
        haptic(HapticStyle.soft);
        onTap();
      },
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: isFavorite
              ? HSLColor.fromAHSL(1, 0, 0.80, 0.55).toColor()
              : Colors.black.withValues(alpha: 0.5),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Icon(
          isFavorite ? Icons.favorite : Icons.favorite_border,
          size: size * 0.43,
          color: isFavorite
              ? Colors.white
              : Colors.white.withValues(alpha: 0.8),
        ),
      ),
    );
  }
}

class _RoundIconButton extends StatelessWidget {
  const _RoundIconButton({required this.icon, required this.onTap});
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: 28,
        height: 28,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.black.withValues(alpha: 0.6),
          border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
        ),
        child: Icon(icon, size: 14, color: Colors.white.withValues(alpha: 0.9)),
      ),
    );
  }
}

class _Shimmer extends StatelessWidget {
  const _Shimmer();
  @override
  Widget build(BuildContext context) =>
      ColoredBox(color: AppColors.muted.withValues(alpha: 0.5));
}

class _TileError extends StatelessWidget {
  const _TileError();
  @override
  Widget build(BuildContext context) => ColoredBox(
    color: AppColors.secondary.withValues(alpha: 0.5),
    child: const Center(
      child: Icon(Icons.refresh, color: Colors.white24, size: 22),
    ),
  );
}
