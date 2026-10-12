import 'dart:async';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../core/app_tabs.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:video_player/video_player.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/backend_service.dart';
import '../../core/services/favorites_store.dart';
import '../../core/services/haptics.dart';
import '../../core/services/prefs.dart';
import '../../core/services/share_service.dart';
import '../../core/services/rating_service.dart';
import '../../core/services/wallpaper_bridge.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/color_boost.dart';
import '../../state/app_providers.dart';
import '../../widgets/app_toast.dart';
import '../../widgets/lucide.dart';
import '../../widgets/premium_cross_logo.dart';
import '../../widgets/premium_sheet.dart';
import '../favorites/wallpaper_detail.dart';
import 'live_preview_clip.dart';
import '../favorites/wallpaper_tiles.dart';
import 'feed_banners.dart';
import 'live_preview_overlay.dart';
import 'mode_pill.dart';
import 'wallpaper_search_overlay.dart';
import 'wallpapers_mode.dart';

class _CategoryPill {
  const _CategoryPill(this.id, this.labelKey, this.icon);
  final String id;
  final String labelKey;

  /// Lucide icon name — same icon the web pill uses.
  final String icon;
}

// Mirrors LiveFeed.tsx `categoryPills` (Lucide icons, one-for-one).
const _liveCategories = [
  _CategoryPill('all', 'wp.feed.all', 'flame'),
  _CategoryPill('jesus-christ', 'wp.feed.jesus', 'sun'),
  _CategoryPill('quotes', 'wp.feed.quotes', 'quote'),
  _CategoryPill('cross', 'wp.feed.cross', 'shield'),
  _CategoryPill('prayer', 'wp.feed.prayer', 'heart'),
  _CategoryPill('church', 'wp.feed.church', 'moon'),
  _CategoryPill('holy-spirit', 'wp.feed.spirit', 'zap'),
  _CategoryPill('good-friday', 'wp.feed.friday', 'swords'),
  _CategoryPill('nature-creation', 'wp.feed.creation', 'drama'),
  _CategoryPill('aesthetic-christian', 'wp.feed.aesthetic', 'star'),
];

// Mirrors StaticWallpapers.tsx `categoryPills` (Lucide icons, one-for-one).
const _staticCategories = [
  _CategoryPill('all', 'wp.feed.all', 'flame'),
  _CategoryPill('jesus-christ', 'wp.feed.jesus', 'sun'),
  _CategoryPill('cross', 'wp.feed.cross', 'shield'),
  _CategoryPill('prayer', 'wp.feed.prayer', 'heart'),
  _CategoryPill('daily-verse', 'wp.feed.daily', 'leaf'),
  _CategoryPill('church', 'wp.feed.church', 'building-2'),
  _CategoryPill('holy-spirit', 'wp.feed.spirit', 'shapes'),
  _CategoryPill('good-friday', 'wp.feed.friday', 'shield-alert'),
  _CategoryPill('nature-creation', 'wp.feed.creation', 'leaf'),
  _CategoryPill('aesthetic-christian', 'wp.feed.aesthetic', 'flower-2'),
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
  late WpMode _mode = wpModeFromString(Prefs.getString(kWallpapersModeKey));
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

  // Surfaced instead of silently leaving the grid blank (previously a bare
  // `catch (_) {}` swallowed every fetch failure).
  bool _hasError = false;

  final _favStore = FavoritesStore.instance;

  bool get _isPremium => ref.read(premiumProvider);

  bool get _needsLive => _mode == WpMode.live || _mode == WpMode.both;
  bool get _needsStatic => _mode == WpMode.photos || _mode == WpMode.both;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    // First fetch after the first frame — `_reload()` calls setState, which is
    // unsafe while this element is still being built.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _reload();
    });
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  bool _loadMoreScheduled = false;
  int _previewFirst = 0;
  int _previewLast = 3;

  void _onScroll() {
    if (!_scrollController.hasClients) return;
    final pos = _scrollController.position;
    final width = MediaQuery.sizeOf(context).width;
    final tileHeight = ((width - 34) / 2) / (9 / 16) + 10;
    final firstRow = (pos.pixels / tileHeight)
        .floor()
        .clamp(0, 100000)
        .toInt();
    // Only hand the four decoder slots to the first two rows in view. The old
    // one-row overscan enabled twelve clips at once, so cached rows above the
    // viewport repeatedly evicted the clips the user was actually looking at.
    final first = (firstRow * 2).clamp(0, 100000).toInt();
    final last = first + 3;
    if (first != _previewFirst || last != _previewLast) {
      setState(() {
        _previewFirst = first;
        _previewLast = last;
      });
    }
    if (pos.maxScrollExtent - pos.pixels >= 800) return;
    // NEVER call setState straight from a scroll notification: it can land in
    // the middle of a layout pass and trip
    // `_debugRelayoutBoundaryAlreadyMarkedNeedsLayout` (the red screen).
    if (_loadMoreScheduled) return;
    _loadMoreScheduled = true;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _loadMoreScheduled = false;
      if (mounted) _loadMore();
    });
  }

  Future<void> _setMode(WpMode m) async {
    if (m == _mode) return;
    setState(() {
      _mode = m;
      _activeCategory = 'all';
    });
    await Prefs.setString(kWallpapersModeKey, wpModeToString(m));
    _reload();
  }

  void _setCategory(String id) {
    if (id == _activeCategory) return;
    haptic(HapticStyle.soft);
    setState(() {
      _activeCategory = id;
      _previewFirst = 0;
      _previewLast = 3;
    });
    if (_scrollController.hasClients) {
      _scrollController.animateTo(
        0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
    }
    _reload();
  }

  // Session cache of the first page per (feed kind + category). Switching a
  // tab or category back and forth used to re-hit the network every time and
  // flash a spinner; react-query does the same caching on the web build.
  static final Map<String, List<LiveWallpaperDB>> _liveFirstPageCache = {};
  static final Map<String, List<StaticWallpaperDB>> _staticFirstPageCache = {};

  String get _cacheKey => _activeCategory;

  Future<void> _reload() async {
    final cachedLive = _needsLive ? _liveFirstPageCache[_cacheKey] : null;
    final cachedStatic = _needsStatic ? _staticFirstPageCache[_cacheKey] : null;
    final liveReady = !_needsLive || cachedLive != null;
    final staticReady = !_needsStatic || cachedStatic != null;

    if (liveReady && staticReady) {
      setState(() {
        _hasError = false;
        _liveFeed = cachedLive ?? [];
        _staticFeed = cachedStatic ?? [];
        _livePage = cachedLive == null ? 0 : 1;
        _staticPage = cachedStatic == null ? 0 : 1;
        _liveHasMore = (cachedLive?.length ?? 0) == _pageSize;
        _staticHasMore = (cachedStatic?.length ?? 0) == _pageSize;
        _loading = false;
      });
      return;
    }

    setState(() {
      _loading = true;
      _hasError = false;
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

  static const _fetchTimeout = Duration(seconds: 12);

  /// Resolves a category slug to its `categories.id`, exactly like
  /// `useWallpapers.ts`'s `resolveCategoryAndFetch` — the static wallpapers
  /// table is filtered by `category_id`, not by a joined slug.
  /// Slug → id memo. Categories never change during a session, so this kills
  /// one round-trip per category switch and per pagination page.
  static final Map<String, String?> _categoryIdCache = {};

  Future<String?> _resolveStaticCategoryId(String slug) async {
    if (_categoryIdCache.containsKey(slug)) return _categoryIdCache[slug];
    final client = Supabase.instance.client;
    final row = await client
        .from('categories')
        .select('id')
        .eq('slug', slug)
        .maybeSingle()
        .timeout(_fetchTimeout);
    final id = row?['id'] as String?;
    _categoryIdCache[slug] = id;
    return id;
  }

  Future<void> _fetchPage({required bool reset}) async {
    final category = _activeCategory == 'all' ? null : _activeCategory;
    var failed = false;

    try {
      await BackendService.ensure();
      final client = Supabase.instance.client;
      if (_needsLive) {
        final page = _livePage;
        // Mirrors `useLiveWallpapers.ts`: table `live_wallpapers`, filtered by
        // its own `category` text column, ordered by `sort_order` ascending.
        var q = client.from('live_wallpapers').select('*');
        if (category != null) q = q.eq('category', category);
        final rows = await q
            .order('sort_order', ascending: true)
            .range(page * _pageSize, page * _pageSize + _pageSize - 1)
            .timeout(_fetchTimeout);
        final items = (rows as List)
            .map((r) => LiveWallpaperDB.fromJson(r as Map<String, dynamic>))
            .toList();
        if (page == 0) _liveFirstPageCache[_cacheKey] = items;
        if (!mounted) return;
        setState(() {
          _liveFeed = [..._liveFeed, ...items];
          _liveHasMore = items.length == _pageSize;
          _livePage = page + 1;
        });
      }
      if (_needsStatic) {
        final page = _staticPage;
        // Mirrors `useWallpapers.ts`: table `wallpapers`, filtered by
        // `category_id` resolved from the `categories` table (not a join
        // filter), ordered by `sort_order` ascending.
        String? categoryId;
        if (category != null) {
          categoryId = await _resolveStaticCategoryId(category);
        }
        var q = client.from('wallpapers').select('*, categories!left(slug)');
        if (categoryId != null) q = q.eq('category_id', categoryId);
        final rows = await q
            .order('sort_order', ascending: true)
            .range(page * _pageSize, page * _pageSize + _pageSize - 1)
            .timeout(_fetchTimeout);
        final items = (rows as List)
            .map((r) => StaticWallpaperDB.fromJson(r as Map<String, dynamic>))
            .toList();
        if (page == 0) _staticFirstPageCache[_cacheKey] = items;
        if (!mounted) return;
        setState(() {
          _staticFeed = [..._staticFeed, ...items];
          _staticHasMore = items.length == _pageSize;
          _staticPage = page + 1;
        });
      }
    } catch (e, st) {
      // Surface the failure instead of silently leaving the grid blank.
      failed = true;
      debugPrint('WallpapersScreen fetch failed: $e\n$st');
    }

    if (!mounted) return;
    // Only flip the visible error state when this page ended up with nothing
    // to show at all — keep whatever already loaded on a load-more hiccup.
    final stillEmpty = _mode == WpMode.both
        ? _liveFeed.isEmpty && _staticFeed.isEmpty
        : _mode == WpMode.photos
        ? _staticFeed.isEmpty
        : _liveFeed.isEmpty;
    if (failed && stillEmpty) {
      setState(() => _hasError = true);
    } else if (!failed) {
      setState(() => _hasError = false);
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

  List<_FeedItem>? _bothCache;
  int _bothCacheKey = -1;

  /// Interleaved live/static feed. Memoised: it used to re-walk both lists on
  /// every rebuild of this screen (which happens on every favorite toggle).
  List<_FeedItem> get _bothItems {
    final key = _liveFeed.length * 100003 + _staticFeed.length;
    final cached = _bothCache;
    if (cached != null && _bothCacheKey == key) return cached;
    final built = _buildBothItems();
    _bothCache = built;
    _bothCacheKey = key;
    return built;
  }

  List<_FeedItem> _buildBothItems() {
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
    if (w.isPremium && !_isPremium) {
      setState(() => _showPremium = true);
      return;
    }
    _doApplyLive(w);
  }

  /// Web parity: a wallpaper preview is a `fixed inset-0` overlay that also
  /// covers the tab bar. Flutter paints the shell's nav above this screen, so
  /// the shell has to be told to hide it while a preview is open.
  void _syncFullscreenFlag() {
    final open = _selectedLive != null || _selectedStatic != null;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final notifier = ref.read(fullscreenOverlayProvider.notifier);
      if (notifier.state != open) notifier.state = open;
    });
  }

  @override
  Widget build(BuildContext context) {
    _syncFullscreenFlag();
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
              trigger: 'wallpapers_${wpModeToString(_mode)}',
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
                      const PremiumCrossLogo(size: 32),
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
                      ModePill(mode: _mode, onChange: _setMode),
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
                          child: LucideIcon(
                            'search',
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
                                    AppColors.glassRaised,
                                    AppColors.card,
                                  ],
                                )
                              : null,
                          color: active ? null : AppColors.card,
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: active
                                ? AppColors.primary.withValues(alpha: 0.46)
                                : AppColors.glassBorder,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            LucideIcon(
                              cat.icon,
                              size: 12,
                              strokeWidth: 2.4,
                              color: active
                                  ? AppColors.primary
                                  : AppColors.mutedForeground,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              t(cat.labelKey),
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: active
                                    ? AppColors.primary
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

    // Never leave the grid blank on a fetch failure — show a retry state
    // instead of the generic "no results" empty state.
    if (isEmpty && _hasError) {
      return RefreshIndicator(
        color: AppColors.primary,
        onRefresh: _reload,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [SizedBox(height: 420, child: _errorState())],
        ),
      );
    }

    if (isEmpty) return _emptyState();

    final hasMore = _mode == WpMode.both
        ? (_liveHasMore || _staticHasMore)
        : _mode == WpMode.photos
        ? _staticHasMore
        : _liveHasMore;

    // Slivers (not a ListView with a shrink-wrapped GridView inside): the
    // nested shrink-wrap re-laid out the whole feed on every append, which is
    // what produced the red relayout-boundary crash and the janky scroll.
    return CustomScrollView(
      controller: _scrollController,
      slivers: [
        // Keep this tab focused on wallpapers. The daily-verse tree promotion
        // duplicated Today's setup flow and pushed the actual feed down.
        if (_mode == WpMode.live && _activeCategory == 'all')
          const SliverToBoxAdapter(child: NewTodayBanner()),
        _grid(),
        if (_loadingMore)
          SliverToBoxAdapter(
            child: Padding(
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
          ),
        if (!hasMore)
          SliverToBoxAdapter(
            child: Padding(
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
          ),
        const SliverToBoxAdapter(child: SizedBox(height: 128)),
      ],
    );
  }

  Widget _grid() {
    // Wallpapers is tab index 2 in the shell (Today 0 / Wallpapers 1 /
    // Journeys 2 / Quiz 3) — only decode previews while it's foregrounded.
    final previewsEnabled =
        ref.watch(activeTabProvider) == AppTabs.wallpapers;
    late List<Widget> tiles;
    switch (_mode) {
      case WpMode.live:
        tiles = [
          for (var i = 0; i < _liveFeed.length; i++)
            LiveWallpaperTile(
              key: ValueKey('live-${_liveFeed[i].id}'),
              wallpaper: _liveFeed[i],
              lockAll: false,
              previewEnabled:
                  previewsEnabled && i >= _previewFirst && i <= _previewLast,
              onTap: () => setState(() => _selectedLive = _liveFeed[i]),
              isFavorite: _favStore.isFavorite(_liveFeed[i].id),
              onToggleFavorite: () =>
                  _toggleFavorite(_liveFeed[i].id, FavType.live),
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
          for (var i = 0; i < _bothItems.length; i++)
            _bothItems[i].isLive
                ? LiveWallpaperTile(
                    key: ValueKey('both-live-${_bothItems[i].live!.id}'),
                    wallpaper: _bothItems[i].live!,
                    lockAll: false,
                    previewEnabled: previewsEnabled &&
                        i >= _previewFirst &&
                        i <= _previewLast,
                    onTap: () =>
                        setState(() => _selectedLive = _bothItems[i].live),
                    isFavorite: _favStore.isFavorite(_bothItems[i].live!.id),
                    onToggleFavorite: () =>
                        _toggleFavorite(_bothItems[i].live!.id, FavType.live),
                  )
                : StaticWallpaperTile(
                    key: ValueKey('both-static-${_bothItems[i].static_!.id}'),
                    wallpaper: _bothItems[i].static_!,
                    onTap: () => setState(
                      () => _selectedStatic = _bothItems[i].static_,
                    ),
                    isFavorite: _favStore.isFavorite(
                      _bothItems[i].static_!.id,
                    ),
                    onToggleFavorite: () => _toggleFavorite(
                      _bothItems[i].static_!.id,
                      FavType.static_,
                    ),
                  ),
        ];
    }
    return SliverPadding(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      sliver: SliverGrid(
        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
          crossAxisCount: 2,
          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
          childAspectRatio: _mode == WpMode.photos ? 3 / 5 : 9 / 16,
        ),
        delegate: SliverChildBuilderDelegate(
          (_, i) => tiles[i],
          childCount: tiles.length,
        ),
      ),
    );
  }

  Widget _skeletonGrid(double aspect) {
    return GridView.builder(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 128),
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

  /// Shown instead of a silently-blank grid when the Supabase fetch fails —
  /// no equivalent in the web build (React Query keeps retrying quietly in
  /// the background), but a native app needs a visible, tappable retry.
  Widget _errorState() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            LucideIcon(
              'cloud-off',
              size: 40,
              color: AppColors.mutedForeground.withValues(alpha: 0.7),
            ),
            const SizedBox(height: 12),
            Text(
              t('wp.feed.loadError'),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: AppColors.foreground,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              t('wp.feed.loadErrorHint'),
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 12, color: AppColors.mutedForeground),
            ),
            const SizedBox(height: 16),
            GestureDetector(
              onTap: () {
                haptic(HapticStyle.soft);
                // Retry must always hit the network, never the session cache.
                _liveFirstPageCache.remove(_cacheKey);
                _staticFirstPageCache.remove(_cacheKey);
                _reload();
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: AppColors.primary,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    LucideIcon('refresh-cw', size: 15, color: Colors.white),
                    const SizedBox(width: 6),
                    Text(
                      t('common.retry'),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
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
      child: LivePreviewOverlay(
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
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _loadMore();
      });
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
      child: SearchOverlay(
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
