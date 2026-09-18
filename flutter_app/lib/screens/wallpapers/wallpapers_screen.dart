import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/favorites_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/share_service.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/wallpaper_bridge.dart';
import '../../core/theme/app_colors.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/premium_sheet.dart';
import '../favorites/wallpaper_detail.dart';
import '../favorites/wallpaper_tiles.dart';
import 'feed_banners.dart';

/// Persisted key — mirrors web's `wallpapers.mode.v1` localStorage key.
const _kModeKey = 'wallpapers.mode.v1';

enum WpMode { live, photos, both }

WpMode _modeFromString(String? s) => switch (s) {
  'photos' => WpMode.photos,
  'both' => WpMode.both,
  _ => WpMode.live,
};

String _modeToString(WpMode m) => switch (m) {
  WpMode.live => 'live',
  WpMode.photos => 'photos',
  WpMode.both => 'both',
};

class _CategoryPill {
  const _CategoryPill(this.id, this.labelKey, this.icon);
  final String id;
  final String labelKey;
  final IconData icon;
}

// Mirrors LiveFeed.tsx `categoryPills`.
const _liveCategories = [
  _CategoryPill('all', 'wp.feed.all', Icons.local_fire_department),
  _CategoryPill('jesus-christ', 'wp.feed.jesus', Icons.wb_sunny),
  _CategoryPill('quotes', 'wp.feed.quotes', Icons.format_quote),
  _CategoryPill('cross', 'wp.feed.cross', Icons.shield),
  _CategoryPill('prayer', 'wp.feed.prayer', Icons.favorite),
  _CategoryPill('church', 'wp.feed.church', Icons.nightlight_round),
  _CategoryPill('holy-spirit', 'wp.feed.spirit', Icons.bolt),
  _CategoryPill('good-friday', 'wp.feed.friday', Icons.gavel),
  _CategoryPill('nature-creation', 'wp.feed.creation', Icons.theater_comedy),
  _CategoryPill('aesthetic-christian', 'wp.feed.aesthetic', Icons.star),
];

// Mirrors StaticWallpapers.tsx `categoryPills`.
const _staticCategories = [
  _CategoryPill('all', 'wp.feed.all', Icons.local_fire_department),
  _CategoryPill('jesus-christ', 'wp.feed.jesus', Icons.wb_sunny),
  _CategoryPill('cross', 'wp.feed.cross', Icons.shield),
  _CategoryPill('prayer', 'wp.feed.prayer', Icons.favorite),
  _CategoryPill('daily-verse', 'wp.feed.daily', Icons.eco),
  _CategoryPill('church', 'wp.feed.church', Icons.apartment),
  _CategoryPill('holy-spirit', 'wp.feed.spirit', Icons.category),
  _CategoryPill('good-friday', 'wp.feed.friday', Icons.shield_outlined),
  _CategoryPill('nature-creation', 'wp.feed.creation', Icons.eco_outlined),
  _CategoryPill(
    'aesthetic-christian',
    'wp.feed.aesthetic',
    Icons.local_florist,
  ),
];

const _pageSize = 20;

/// Port target: `src/pages/Wallpapers.tsx`, `LiveFeed.tsx`, `StaticWallpapers.tsx`,
/// `BothFeed.tsx`, `WallpaperModePill.tsx` (admin-only reorder/delete controls
/// intentionally omitted — not user-facing).
class WallpapersScreen extends ConsumerStatefulWidget {
  const WallpapersScreen({super.key});

  @override
  ConsumerState<WallpapersScreen> createState() => _WallpapersScreenState();
}

class _WallpapersScreenState extends ConsumerState<WallpapersScreen> {
  late WpMode _mode = _modeFromString(Prefs.getString(_kModeKey));
  String _activeCategory = 'all';

  final _scrollController = ScrollController();

  List<LiveWallpaperDB> _liveFeed = [];
  List<StaticWallpaperDB> _staticFeed = [];
  bool _loading = true;
  bool _loadingMore = false;
  bool _liveHasMore = true;
  bool _staticHasMore = true;
  int _livePage = 0;
  int _staticPage = 0;

  LiveWallpaperDB? _selectedLive;
  StaticWallpaperDB? _selectedStatic;
  bool _showPremium = false;
  bool _showSearch = false;
  bool _applyingLive = false;

  final _favStore = FavoritesStore.instance;

  bool get _isPremium => ref.read(premiumProvider);

  bool get _needsLive => _mode == WpMode.live || _mode == WpMode.both;
  bool get _needsStatic => _mode == WpMode.photos || _mode == WpMode.both;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _reload();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    if (pos.maxScrollExtent - pos.pixels < 800) _loadMore();
  }

  Future<void> _setMode(WpMode m) async {
    if (m == _mode) return;
    setState(() {
      _mode = m;
      _activeCategory = 'all';
    });
    await Prefs.setString(_kModeKey, _modeToString(m));
    _reload();
  }

  void _setCategory(String id) {
    if (id == _activeCategory) return;
    haptic(HapticStyle.soft);
    setState(() => _activeCategory = id);
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
    _reload();
  }

  Future<void> _reload() async {
    setState(() {
      _loading = true;
      _livePage = 0;
      _staticPage = 0;
      _liveHasMore = true;
      _staticHasMore = true;
      _liveFeed = [];
      _staticFeed = [];
    });
    await _fetchPage(reset: true);
    if (!mounted) return;
    setState(() => _loading = false);
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _loading) return;
    final needMoreLive = _needsLive && _liveHasMore;
    final needMoreStatic = _needsStatic && _staticHasMore;
    if (!needMoreLive && !needMoreStatic) return;
    setState(() => _loadingMore = true);
    await _fetchPage(reset: false);
    if (!mounted) return;
    setState(() => _loadingMore = false);
  }

  Future<void> _fetchPage({required bool reset}) async {
    final client = Supabase.instance.client;
    final category = _activeCategory == 'all' ? null : _activeCategory;

    try {
      if (_needsLive) {
        final page = _livePage;
        var q = client.from('live_wallpapers').select('*');
        if (category != null) q = q.eq('category', category);
        final rows = await q
            .order('sort_order', ascending: true)
            .range(page * _pageSize, page * _pageSize + _pageSize - 1);
        final items = (rows as List)
            .map((r) => LiveWallpaperDB.fromJson(r as Map<String, dynamic>))
            .toList();
        if (!mounted) return;
        setState(() {
          _liveFeed = [..._liveFeed, ...items];
          _liveHasMore = items.length == _pageSize;
          _livePage = page + 1;
        });
      }
      if (_needsStatic) {
        final page = _staticPage;
        var q = client.from('wallpapers').select('*');
        if (category != null) {
          q = client
              .from('wallpapers')
              .select(
                'id, title, image_url, is_premium, category_id, sort_order, categories!inner(slug)',
              )
              .eq('categories.slug', category);
        }
        final rows = await q
            .order('sort_order', ascending: true)
            .range(page * _pageSize, page * _pageSize + _pageSize - 1);
        final items = (rows as List)
            .map((r) => StaticWallpaperDB.fromJson(r as Map<String, dynamic>))
            .toList();
        if (!mounted) return;
        setState(() {
          _staticFeed = [..._staticFeed, ...items];
          _staticHasMore = items.length == _pageSize;
          _staticPage = page + 1;
        });
      }
    } catch (_) {
      // Network hiccup — keep whatever we already have; feed simply stops
      // growing until the user retries via pull/scroll.
    }
  }

  Future<void> _toggleFavorite(String id, FavType type) async {
    final result = await _favStore.toggleFavorite(
      id,
      type,
      isPremium: _isPremium,
    );
    if (result == null) {
      if (!mounted) return;
      AppToast.error(context, t('fav.empty.title'));
      return;
    }
    setState(() {});
  }

  List<_FeedItem> get _bothItems {
    final out = <_FeedItem>[];
    var li = 0, si = 0;
    while (li < _liveFeed.length || si < _staticFeed.length) {
      for (var k = 0; k < 3 && li < _liveFeed.length; k++, li++) {
        out.add(_FeedItem.live(_liveFeed[li]));
      }
      if (si < _staticFeed.length) {
        out.add(_FeedItem.static_(_staticFeed[si]));
        si++;
      }
    }
    return out;
  }

  Future<void> _doApplyLive(LiveWallpaperDB w) async {
    setState(() => _applyingLive = true);
    try {
      final ok = await WallpaperBridge.setLiveWallpaper(w.videoUrl);
      if (!mounted) return;
      if (ok) {
        haptic(HapticStyle.heavy);
        AppToast.success(context, t('wp.applied'));
        Analytics.capture('wallpaper_applied', {
          'wallpaper_id': w.id,
          'type': 'live',
          'is_premium_wallpaper': w.isPremium,
        });
        // Happy moment → rating ask, same 3.5s delay the web feeds use.
        Timer(
          const Duration(milliseconds: 3500),
          RatingService.maybeRequestRating,
        );
      } else {
        AppToast.error(context, t('wp.notApplied'));
        Analytics.capture('wallpaper_apply_failed', {
          'wallpaper_id': w.id,
          'type': 'live',
          'reason': 'unknown',
        });
      }
    } catch (_) {
      if (!mounted) return;
      AppToast.error(context, t('wp.notApplied'));
    } finally {
      if (mounted) setState(() => _applyingLive = false);
    }
  }

  void _handleApplyLive(LiveWallpaperDB w) {
    if (_applyingLive) return;
    // Live wallpapers are Pro-only — every tile needs premium (mirrors
    // `handleApplyLive` in LiveFeed.tsx).
    if (!_isPremium) {
      setState(() => _showPremium = true);
      return;
    }
    _doApplyLive(w);
  }

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.background,
      child: Stack(
        children: [
          Column(
            children: [
              _header(),
              Expanded(child: _body()),
            ],
          ),
          if (_selectedLive != null) _liveOverlay(),
          if (_selectedStatic != null) _staticOverlay(),
          if (_showPremium)
            PremiumSheet(
              trigger: 'wallpapers_${_modeToString(_mode)}',
              onClose: () => setState(() => _showPremium = false),
              onUnlock: () {
                ref.read(premiumProvider.notifier).setUnlocked();
                setState(() => _showPremium = false);
              },
            ),
          if (_showSearch) _searchOverlay(),
          if (_applyingLive) _applyingOverlay(),
        ],
      ),
    );
  }

  Widget _header() {
    final showCategories = _mode != WpMode.both;
    final categories = _mode == WpMode.photos
        ? _staticCategories
        : _liveCategories;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: AppColors.glass,
        border: Border(bottom: BorderSide(color: AppColors.glassBorder)),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [AppColors.primary, AppColors.accent],
                          ),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: const Icon(
                          Icons.church,
                          size: 18,
                          color: Colors.white,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Prayly',
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              letterSpacing: -0.3,
                              color: AppColors.primary,
                            ),
                          ),
                          Text(
                            'BIBLE PRAYER & VERSE',
                            style: TextStyle(
                              fontSize: 8,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.4,
                              color: AppColors.mutedForeground.withValues(
                                alpha: 0.65,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      _ModePill(mode: _mode, onChange: _setMode),
                      const SizedBox(width: 8),
                      GestureDetector(
                        onTap: () {
                          haptic(HapticStyle.soft);
                          setState(() => _showSearch = true);
                        },
                        child: Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppColors.foreground.withValues(alpha: 0.06),
                            shape: BoxShape.circle,
                            border: Border.all(color: AppColors.glassBorder),
                          ),
                          child: Icon(
                            Icons.search,
                            size: 16,
                            color: AppColors.foreground.withValues(alpha: 0.6),
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            if (showCategories)
              SizedBox(
                height: 40,
                child: ListView.separated(
                  padding: const EdgeInsets.symmetric(horizontal: 10),
                  scrollDirection: Axis.horizontal,
                  itemCount: categories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: 6),
                  itemBuilder: (_, i) {
                    final cat = categories[i];
                    final active = cat.id == _activeCategory;
                    return GestureDetector(
                      onTap: () => _setCategory(cat.id),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 200),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        decoration: BoxDecoration(
                          gradient: active
                              ? LinearGradient(
                                  colors: [
                                    AppColors.primary,
                                    AppColors.primary.withValues(alpha: 0.8),
                                  ],
                                )
                              : null,
                          color: active ? null : AppColors.card,
                          borderRadius: BorderRadius.circular(999),
                          border: active
                              ? null
                              : Border.all(color: AppColors.glassBorder),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              cat.icon,
                              size: 12,
                              color: active
                                  ? Colors.white
                                  : AppColors.mutedForeground,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              t(cat.labelKey),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: active
                                    ? Colors.white
                                    : AppColors.mutedForeground,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }

  Widget _body() {
    if (_loading) return _skeletonGrid(_mode == WpMode.photos ? 3 / 5 : 9 / 16);

    final isEmpty = _mode == WpMode.both
        ? _bothItems.isEmpty
        : _mode == WpMode.photos
        ? _staticFeed.isEmpty
        : _liveFeed.isEmpty;

    if (isEmpty) return _emptyState();

    final hasMore = _mode == WpMode.both
        ? (_liveHasMore || _staticHasMore)
        : _mode == WpMode.photos
        ? _staticHasMore
        : _liveHasMore;

    return ListView(
      controller: _scrollController,
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 96),
      children: [
        // Same placement as web: LiveFeed shows the "new today" banner + daily
        // verse card on the "all" category, StaticWallpapers shows only the
        // card (with pt-3), BothFeed always shows the card.
        if (_mode == WpMode.live && _activeCategory == 'all') ...[
          const NewTodayBanner(),
          const DailyVerseCard(),
        ] else if (_mode == WpMode.photos && _activeCategory == 'all')
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: DailyVerseCard(),
          )
        else if (_mode == WpMode.both)
          const Padding(
            padding: EdgeInsets.only(top: 12),
            child: DailyVerseCard(),
          ),
        _grid(),
        if (_loadingMore)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  color: AppColors.primary,
                ),
              ),
            ),
          ),
        if (!hasMore)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 24),
            child: Center(
              child: Text(
                t('wp.feed.seenAll'),
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.mutedForeground,
                ),
              ),
            ),
          ),
      ],
    );
  }

  Widget _grid() {
    late List<Widget> tiles;
    switch (_mode) {
      case WpMode.live:
        tiles = [
          for (final w in _liveFeed)
            LiveWallpaperTile(
              key: ValueKey('live-${w.id}'),
              wallpaper: w,
              onTap: () => setState(() => _selectedLive = w),
              isFavorite: _favStore.isFavorite(w.id),
              onToggleFavorite: () => _toggleFavorite(w.id, FavType.live),
            ),
        ];
      case WpMode.photos:
        tiles = [
          for (final w in _staticFeed)
            StaticWallpaperTile(
              key: ValueKey('static-${w.id}'),
              wallpaper: w,
              onTap: () => setState(() => _selectedStatic = w),
              isFavorite: _favStore.isFavorite(w.id),
              onToggleFavorite: () => _toggleFavorite(w.id, FavType.static_),
            ),
        ];
      case WpMode.both:
        tiles = [
          for (final it in _bothItems)
            it.isLive
                ? LiveWallpaperTile(
                    key: ValueKey('both-live-${it.live!.id}'),
                    wallpaper: it.live!,
                    onTap: () => setState(() => _selectedLive = it.live),
                    isFavorite: _favStore.isFavorite(it.live!.id),
                    onToggleFavorite: () =>
                        _toggleFavorite(it.live!.id, FavType.live),
                  )
                : StaticWallpaperTile(
                    key: ValueKey('both-static-${it.static_!.id}'),
                    wallpaper: it.static_!,
                    onTap: () => setState(() => _selectedStatic = it.static_),
                    isFavorite: _favStore.isFavorite(it.static_!.id),
                    onToggleFavorite: () =>
                        _toggleFavorite(it.static_!.id, FavType.static_),
                  ),
        ];
    }
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: _mode == WpMode.photos ? 3 / 5 : 9 / 16,
      ),
      itemCount: tiles.length,
      itemBuilder: (_, i) => tiles[i],
    );
  }

  Widget _skeletonGrid(double aspect) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 96),
      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: aspect,
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
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text('🕊️', style: TextStyle(fontSize: 40)),
          const SizedBox(height: 8),
          Text(
            t('wp.feed.noResults'),
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.mutedForeground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _liveOverlay() {
    final w = _selectedLive!;
    final list = _mode == WpMode.both ? _liveFeed : _liveFeed;
    final idx = list.indexWhere((e) => e.id == w.id);
    final prev = idx > 0 ? list[idx - 1] : null;
    final next = (idx >= 0 && idx < list.length - 1) ? list[idx + 1] : null;
    return Positioned.fill(
      child: _LivePreviewOverlay(
        wallpaper: w,
        isPremiumUser: _isPremium,
        applying: _applyingLive,
        onClose: () => setState(() => _selectedLive = null),
        onApply: () => _handleApplyLive(w),
        onPremium: () => setState(() => _showPremium = true),
        onPrev: prev != null
            ? () => setState(() => _selectedLive = prev)
            : null,
        onNext: next != null
            ? () => setState(() => _selectedLive = next)
            : null,
        isFavorite: _favStore.isFavorite(w.id),
        onToggleFavorite: () => _toggleFavorite(w.id, FavType.live),
      ),
    );
  }

  Widget _staticOverlay() {
    final w = _selectedStatic!;
    final list = _mode == WpMode.both ? _staticFeed : _staticFeed;
    final idx = list.indexWhere((e) => e.id == w.id);
    final prev = idx > 0 ? list[idx - 1] : null;
    final next = (idx >= 0 && idx < list.length - 1) ? list[idx + 1] : null;
    if (idx >= 0 && idx >= list.length - 3 && _staticHasMore && !_loadingMore) {
      _loadMore();
    }
    return Positioned.fill(
      child: WallpaperDetail(
        wallpaper: DetailWallpaper(
          id: w.id,
          src: w.imageUrl,
          title: w.title,
          isPremium: w.isPremium,
        ),
        isFavorite: _favStore.isFavorite(w.id),
        onToggleFavorite: () => _toggleFavorite(w.id, FavType.static_),
        onClose: () => setState(() => _selectedStatic = null),
        onPrev: prev != null
            ? () => setState(() => _selectedStatic = prev)
            : null,
        onNext: next != null
            ? () => setState(() => _selectedStatic = next)
            : null,
      ),
    );
  }

  Widget _applyingOverlay() {
    return Positioned.fill(
      child: ColoredBox(
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
                t('wp.feed.applyingLive'),
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
    );
  }

  Widget _searchOverlay() {
    return Positioned.fill(
      child: _SearchOverlay(
        onClose: () => setState(() => _showSearch = false),
        onOpenStatic: (w) => setState(() {
          _showSearch = false;
          _selectedStatic = w;
        }),
        onOpenLive: (w) => setState(() {
          _showSearch = false;
          _selectedLive = w;
        }),
      ),
    );
  }
}

class _FeedItem {
  const _FeedItem.live(this.live) : static_ = null;
  const _FeedItem.static_(this.static_) : live = null;
  final LiveWallpaperDB? live;
  final StaticWallpaperDB? static_;
  bool get isLive => live != null;
}

class _ModePill extends StatefulWidget {
  const _ModePill({required this.mode, required this.onChange});
  final WpMode mode;
  final ValueChanged<WpMode> onChange;

  @override
  State<_ModePill> createState() => _ModePillState();
}

class _ModePillState extends State<_ModePill> {
  final _link = LayerLink();
  OverlayEntry? _entry;

  @override
  void dispose() {
    _entry?.remove();
    super.dispose();
  }

  void _toggle() {
    haptic(HapticStyle.soft);
    if (_entry != null) {
      _close();
    } else {
      _open();
    }
  }

  void _close() {
    _entry?.remove();
    _entry = null;
    if (mounted) setState(() {});
  }

  void _open() {
    final options = [
      (WpMode.live, 'wp.mode.live', Icons.videocam),
      (WpMode.photos, 'wp.mode.photos', Icons.image),
      (WpMode.both, 'wp.mode.both', Icons.layers),
    ];
    _entry = OverlayEntry(
      builder: (context) => Stack(
        children: [
          Positioned.fill(
            child: GestureDetector(
              behavior: HitTestBehavior.translucent,
              onTap: _close,
            ),
          ),
          CompositedTransformFollower(
            link: _link,
            targetAnchor: Alignment.bottomRight,
            followerAnchor: Alignment.topRight,
            offset: const Offset(0, 8),
            child: Material(
              color: Colors.transparent,
              child: Container(
                width: 160,
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(
                  color: AppColors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.glassBorder),
                  boxShadow: const [
                    BoxShadow(
                      color: Colors.black45,
                      blurRadius: 24,
                      offset: Offset(0, 8),
                    ),
                  ],
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    for (final opt in options)
                      GestureDetector(
                        onTap: () {
                          haptic(HapticStyle.soft);
                          widget.onChange(opt.$1);
                          _close();
                        },
                        child: Container(
                          width: double.infinity,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 10,
                            vertical: 8,
                          ),
                          decoration: BoxDecoration(
                            color: opt.$1 == widget.mode
                                ? AppColors.primary.withValues(alpha: 0.15)
                                : null,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                opt.$3,
                                size: 15,
                                color: opt.$1 == widget.mode
                                    ? AppColors.primary
                                    : AppColors.mutedForeground,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  t(opt.$2),
                                  style: TextStyle(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: opt.$1 == widget.mode
                                        ? AppColors.foreground
                                        : AppColors.mutedForeground.withValues(
                                            alpha: 0.8,
                                          ),
                                  ),
                                ),
                              ),
                              if (opt.$1 == widget.mode)
                                Icon(
                                  Icons.check,
                                  size: 14,
                                  color: AppColors.primary,
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
        ],
      ),
    );
    Overlay.of(context).insert(_entry!);
    setState(() {});
  }

  @override
  Widget build(BuildContext context) {
    final labelKey = switch (widget.mode) {
      WpMode.live => 'wp.mode.live',
      WpMode.photos => 'wp.mode.photos',
      WpMode.both => 'wp.mode.both',
    };
    final icon = switch (widget.mode) {
      WpMode.live => Icons.videocam,
      WpMode.photos => Icons.image,
      WpMode.both => Icons.layers,
    };
    return CompositedTransformTarget(
      link: _link,
      child: GestureDetector(
        onTap: _toggle,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 10),
          decoration: BoxDecoration(
            color: AppColors.primary.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.35),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(icon, size: 14, color: AppColors.primary),
              const SizedBox(width: 6),
              Text(
                t(labelKey),
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.foreground.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(width: 4),
              Icon(
                _entry != null
                    ? Icons.keyboard_arrow_up
                    : Icons.keyboard_arrow_down,
                size: 14,
                color: AppColors.foreground.withValues(alpha: 0.55),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Minimal live-wallpaper preview/apply overlay — 1:1 subset of
/// `src/components/LivePreviewOverlay.tsx` (fullscreen video, apply CTA,
/// premium gate, swipe prev/next, share).
class _LivePreviewOverlay extends StatefulWidget {
  const _LivePreviewOverlay({
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
  State<_LivePreviewOverlay> createState() => _LivePreviewOverlayState();
}

class _LivePreviewOverlayState extends State<_LivePreviewOverlay> {
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
  void didUpdateWidget(covariant _LivePreviewOverlay old) {
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
    final gated = !widget.isPremiumUser;
    return Material(
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
              FittedBox(
                fit: BoxFit.cover,
                child: SizedBox(
                  width: _controller!.value.size.width,
                  height: _controller!.value.size.height,
                  child: VideoPlayer(_controller!),
                ),
              )
            else if (w.thumbnailUrl != null)
              CachedNetworkImage(imageUrl: w.thumbnailUrl!, fit: BoxFit.cover)
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
                  ],
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

/// 1:1 subset of `src/components/SearchOverlay.tsx` (admin reorder stripped).
class _SearchOverlay extends StatefulWidget {
  const _SearchOverlay({
    required this.onClose,
    required this.onOpenStatic,
    required this.onOpenLive,
  });
  final VoidCallback onClose;
  final ValueChanged<StaticWallpaperDB> onOpenStatic;
  final ValueChanged<LiveWallpaperDB> onOpenLive;

  @override
  State<_SearchOverlay> createState() => _SearchOverlayState();
}

class _SearchOverlayState extends State<_SearchOverlay> {
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
                      child: Icon(
                        Icons.arrow_back,
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
                        prefixIcon: const Icon(Icons.search, size: 18),
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
                                if (img != null)
                                  CachedNetworkImage(
                                    imageUrl: img,
                                    fit: BoxFit.cover,
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
