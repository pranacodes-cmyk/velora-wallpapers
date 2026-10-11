import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/backend_service.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/color_boost.dart';
import '../../widgets/lucide.dart';
import '../favorites/wallpaper_tiles.dart';
import 'live_preview_clip.dart';

/// 1:1 subset of `src/components/SearchOverlay.tsx` (admin reorder stripped).
class SearchOverlay extends StatefulWidget {
  const SearchOverlay({
    required this.onClose,
    required this.onOpenStatic,
    required this.onOpenLive,
  });
  final VoidCallback onClose;
  final ValueChanged<StaticWallpaperDB> onOpenStatic;
  final ValueChanged<LiveWallpaperDB> onOpenLive;

  @override
  State<SearchOverlay> createState() => SearchOverlayState();
}

class SearchOverlayState extends State<SearchOverlay> {
  final _controller = TextEditingController();
  Timer? _debounce;
  bool _loading = false;
  List<Object> _results = []; // StaticWallpaperDB or LiveWallpaperDB

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String q) {
    _debounce?.cancel();
    if (q.trim().length < 2) {
      setState(() => _results = []);
      return;
    }
    _debounce = Timer(
      const Duration(milliseconds: 350),
      () => _search(q.trim()),
    );
  }

  Future<void> _search(String q) async {
    setState(() => _loading = true);
    try {
      await BackendService.ensure();
      final client = Supabase.instance.client;
      final term = '%$q%';
      final staticRows = await client
          .from('wallpapers')
          .select('id, title, image_url, is_premium')
          .ilike('title', term)
          .limit(10);
      final liveRows = await client
          .from('live_wallpapers')
          .select('*')
          .ilike('title', term)
          .limit(10);
      final lives = (liveRows as List)
          .map((r) => LiveWallpaperDB.fromJson(r as Map<String, dynamic>))
          .toList();
      final statics = (staticRows as List)
          .map((r) => StaticWallpaperDB.fromJson(r as Map<String, dynamic>))
          .toList();
      if (!mounted) return;
      setState(() => _results = [...lives, ...statics]);
    } catch (_) {
      if (!mounted) return;
      setState(() => _results = []);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final q = _controller.text.trim();
    return Material(
      color: AppColors.background,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: widget.onClose,
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: BoxDecoration(
                        color: AppColors.card,
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.3),
                        ),
                      ),
                      child: LucideIcon(
                        'arrow-left',
                        size: 20,
                        color: AppColors.foreground.withValues(alpha: 0.8),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      autofocus: true,
                      onChanged: _onChanged,
                      decoration: InputDecoration(
                        hintText: t('wp.search.placeholder'),
                        prefixIcon: LucideIcon('search', size: 18),
                        filled: true,
                        fillColor: AppColors.secondary.withValues(alpha: 0.6),
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                          borderSide: BorderSide.none,
                        ),
                        contentPadding: const EdgeInsets.symmetric(vertical: 0),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: _loading
                  ? Center(
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5,
                        color: AppColors.primary,
                      ),
                    )
                  : q.length < 2
                  ? Center(
                      child: Text(
                        t('wp.search.typeToSearch'),
                        style: TextStyle(
                          color: AppColors.mutedForeground.withValues(
                            alpha: 0.6,
                          ),
                        ),
                      ),
                    )
                  : _results.isEmpty
                  ? Center(
                      child: Text(
                        t('wp.search.noResultsFor', {'query': q}),
                        style: TextStyle(color: AppColors.mutedForeground),
                      ),
                    )
                  : GridView.builder(
                      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                            crossAxisCount: 2,
                            crossAxisSpacing: 12,
                            mainAxisSpacing: 12,
                            childAspectRatio: 3 / 5,
                          ),
                      itemCount: _results.length,
                      itemBuilder: (_, i) {
                        final r = _results[i];
                        final isLive = r is LiveWallpaperDB;
                        final title = isLive
                            ? (r as LiveWallpaperDB).title
                            : (r as StaticWallpaperDB).title;
                        final img = isLive
                            ? (r as LiveWallpaperDB).thumbnailUrl
                            : (r as StaticWallpaperDB).imageUrl;
                        return GestureDetector(
                          onTap: () => isLive
                              ? widget.onOpenLive(r as LiveWallpaperDB)
                              : widget.onOpenStatic(r as StaticWallpaperDB),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(16),
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                ColoredBox(color: AppColors.secondary),
                                if (isLivePreviewClip(img))
                                  LivePreviewClip(
                                    url: img!,
                                    boost: ColorBoostPreset.previewClip,
                                  )
                                else if (img != null)
                                  ColorBoost(
                                    preset: ColorBoostPreset.still,
                                    child: CachedNetworkImage(
                                      imageUrl: img,
                                      fit: BoxFit.cover,
                                      memCacheWidth: 720,
                                    ),
                                  ),
                                DecoratedBox(
                                  decoration: BoxDecoration(
                                    gradient: LinearGradient(
                                      begin: Alignment.bottomCenter,
                                      end: Alignment.topCenter,
                                      colors: [
                                        Colors.black.withValues(alpha: 0.7),
                                        Colors.transparent,
                                      ],
                                    ),
                                  ),
                                ),
                                Positioned(
                                  left: 10,
                                  right: 10,
                                  bottom: 10,
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 6,
                                          vertical: 2,
                                        ),
                                        decoration: BoxDecoration(
                                          color: isLive
                                              ? AppColors.primary.withValues(
                                                  alpha: 0.2,
                                                )
                                              : AppColors.foreground.withValues(
                                                  alpha: 0.1,
                                                ),
                                          borderRadius: BorderRadius.circular(
                                            999,
                                          ),
                                        ),
                                        child: Text(
                                          isLive
                                              ? t('wp.search.liveBadge')
                                              : t('wp.search.staticBadge'),
                                          style: TextStyle(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w700,
                                            color: isLive
                                                ? AppColors.primary
                                                : Colors.white70,
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        title,
                                        maxLines: 2,
                                        overflow: TextOverflow.ellipsis,
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 12,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
