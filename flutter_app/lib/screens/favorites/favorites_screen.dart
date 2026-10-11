import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/favorites_store.dart';
import '../../core/services/haptics.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import 'wallpaper_detail.dart';
import 'wallpaper_tiles.dart';

enum _FavTab { all, live, static_ }

/// 1:1 port of `src/pages/Favorites.tsx`.
class FavoritesScreen extends ConsumerStatefulWidget {
  const FavoritesScreen({super.key});

  @override
  ConsumerState<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends ConsumerState<FavoritesScreen> {
  final _store = FavoritesStore.instance;
  List<StaticWallpaperDB> _staticWalls = [];
  List<LiveWallpaperDB> _liveWalls = [];
  bool _loading = true;
  StaticWallpaperDB? _selected;
  _FavTab _tab = _FavTab.all;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() => _loading = true);
    final favorites = _store.favorites;
    final staticIds = favorites
        .where((f) => f.type == FavType.static_)
        .map((f) => f.id)
        .toList();
    final liveIds = favorites
        .where((f) => f.type == FavType.live)
        .map((f) => f.id)
        .toList();
    final client = Supabase.instance.client;

    List<StaticWallpaperDB> statics = [];
    List<LiveWallpaperDB> lives = [];
    try {
      if (staticIds.isNotEmpty) {
        final rows = await client
            .from('wallpapers')
            .select('*')
            .inFilter('id', staticIds);
        statics = (rows as List)
            .map((r) => StaticWallpaperDB.fromJson(r as Map<String, dynamic>))
            .toList();
      }
      if (liveIds.isNotEmpty) {
        final rows = await client
            .from('live_wallpapers')
            .select('*')
            .inFilter('id', liveIds);
        lives = (rows as List)
            .map((r) => LiveWallpaperDB.fromJson(r as Map<String, dynamic>))
            .toList();
      }
    } catch (_) {}

    if (!mounted) return;
    setState(() {
      _staticWalls = statics;
      _liveWalls = lives;
      _loading = false;
    });
  }

  Future<void> _toggleFavorite(String id, FavType type) async {
    final isPremium = ref.read(premiumProvider);
    final result = await _store.toggleFavorite(id, type, isPremium: isPremium);
    if (result == null) {
      // Free-tier limit reached — web dispatches a custom event that the
      // Wallpapers screen listens to; Favorites itself has nothing further
      // to do besides not toggling.
      return;
    }
    await _load();
  }

  void _clearFavorites() {
    haptic(HapticStyle.medium);
    _store.clearFavorites();
    _load();
    AppToast.success(context, t('fav.toast.cleared'));
  }

  @override
  Widget build(BuildContext context) {
    final filteredStatic = _tab == _FavTab.live
        ? <StaticWallpaperDB>[]
        : _staticWalls;
    final filteredLive = _tab == _FavTab.static_
        ? <LiveWallpaperDB>[]
        : _liveWalls;
    final totalCount = filteredStatic.length + filteredLive.length;
    final count = _store.count;

    return Material(
      color: AppColors.background,
      child: Column(
        children: [
          _header(count),
          Expanded(
            child: _loading
                ? _skeletonGrid()
                : totalCount == 0
                ? _emptyState()
                : _grid(filteredLive, filteredStatic),
          ),
        ],
      ),
    );
  }

  Widget _header(int count) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.glass,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        t('fav.title'),
                        style: TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          letterSpacing: -0.5,
                          color: AppColors.foreground,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        t('fav.subtitle', {'count': count}),
                        style: TextStyle(
                          fontSize: 11,
                          color: AppColors.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                  if (count > 0)
                    GestureDetector(
                      onTap: _clearFavorites,
                      child: Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: AppColors.card,
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: AppColors.glassBorder),
                        ),
                        child: Icon(
                          Icons.delete_outline,
                          size: 16,
                          color: AppColors.destructive,
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  _tabButton(_FavTab.all, t('fav.tab.all')),
                  const SizedBox(width: 8),
                  _tabButton(_FavTab.live, t('fav.tab.live')),
                  const SizedBox(width: 8),
                  _tabButton(_FavTab.static_, t('fav.tab.photos')),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _tabButton(_FavTab tab, String label) {
    final active = _tab == tab;
    return GestureDetector(
      onTap: () {
        haptic(HapticStyle.soft);
        setState(() => _tab = tab);
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          gradient: active
              ? LinearGradient(colors: [AppColors.primary, AppColors.accent])
              : null,
          color: active ? null : AppColors.card,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            color: active ? Colors.white : AppColors.mutedForeground,
          ),
        ),
      ),
    );
  }

  Widget _skeletonGrid() {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 128),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 9 / 16,
      ),
      itemCount: 4,
      itemBuilder: (_, _) => DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.muted.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(20),
        ),
      ),
    );
  }

  Widget _emptyState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.primary.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(28),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.1),
                ),
              ),
              child: Icon(
                Icons.favorite_border,
                size: 32,
                color: AppColors.primary.withValues(alpha: 0.4),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              t('fav.empty.title'),
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.foreground,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              t('fav.empty.subtitle'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 13,
                height: 1.4,
                color: AppColors.mutedForeground,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _grid(List<LiveWallpaperDB> lives, List<StaticWallpaperDB> statics) {
    final items = <Widget>[
      ...lives.map(
        (lw) => LiveWallpaperTile(
          key: ValueKey('live-${lw.id}'),
          wallpaper: lw,
          onTap: () {},
          isFavorite: _store.isFavorite(lw.id),
          onToggleFavorite: () => _toggleFavorite(lw.id, FavType.live),
        ),
      ),
      ...statics.map(
        (sw) => StaticWallpaperTile(
          key: ValueKey('static-${sw.id}'),
          wallpaper: sw,
          onTap: () => setState(() => _selected = sw),
          isFavorite: _store.isFavorite(sw.id),
          onToggleFavorite: () => _toggleFavorite(sw.id, FavType.static_),
        ),
      ),
    ];

    return Stack(
      children: [
        GridView.builder(
          padding: const EdgeInsets.fromLTRB(12, 12, 12, 128),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            crossAxisSpacing: 10,
            mainAxisSpacing: 10,
            childAspectRatio: 0.62,
          ),
          itemCount: items.length,
          itemBuilder: (_, i) => items[i],
        ),
        if (_selected != null) _detailOverlay(statics),
      ],
    );
  }

  Widget _detailOverlay(List<StaticWallpaperDB> filteredStatic) {
    final selected = _selected!;
    final idx = filteredStatic.indexWhere((w) => w.id == selected.id);
    final prev = idx > 0 ? filteredStatic[idx - 1] : null;
    final next = (idx >= 0 && idx < filteredStatic.length - 1)
        ? filteredStatic[idx + 1]
        : null;

    return Positioned.fill(
      child: WallpaperDetail(
        wallpaper: DetailWallpaper(
          id: selected.id,
          src: selected.imageUrl,
          title: selected.title,
          isPremium: selected.isPremium,
        ),
        isFavorite: _store.isFavorite(selected.id),
        onToggleFavorite: () => _toggleFavorite(selected.id, FavType.static_),
        onClose: () => setState(() => _selected = null),
        onPrev: prev != null ? () => setState(() => _selected = prev) : null,
        onNext: next != null ? () => setState(() => _selected = next) : null,
      ),
    );
  }
}
