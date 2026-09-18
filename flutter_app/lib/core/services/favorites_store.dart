import 'dart:async';
import 'dart:convert';

import 'analytics.dart';
import 'prefs.dart';
import 'rating_service.dart';

/// 1:1 port of `src/hooks/useFavorites.ts`.
/// Same storage key (`cw_favorites`), same JSON shape, same free-tier limit.
enum FavType { live, static_ }

String favTypeToJson(FavType t) => t == FavType.live ? 'live' : 'static';
FavType favTypeFromJson(String s) =>
    s == 'live' ? FavType.live : FavType.static_;

class FavItem {
  const FavItem({required this.id, required this.type, required this.addedAt});
  final String id;
  final FavType type;
  final int addedAt;

  Map<String, Object?> toJson() => {
    'id': id,
    'type': favTypeToJson(type),
    'addedAt': addedAt,
  };

  factory FavItem.fromJson(Map<String, dynamic> json) => FavItem(
    id: json['id'] as String,
    type: favTypeFromJson(json['type'] as String? ?? 'static'),
    addedAt: (json['addedAt'] as num?)?.toInt() ?? 0,
  );
}

/// Web parity: `FREE_FAVORITES_LIMIT`.
const kFreeFavoritesLimit = 5;

/// Simple in-memory + persisted store. Screens listen via [FavoritesStore.instance]
/// and call [addListener]/[removeListener] (ChangeNotifier-free, minimal — screens
/// just re-load on demand via [load] after a mutation, mirroring the web hook's
/// `useState` re-render model).
class FavoritesStore {
  FavoritesStore._();
  static final FavoritesStore instance = FavoritesStore._();

  static const _key = StorageKeys.favorites;

  List<FavItem> _favorites = _load();

  static List<FavItem> _load() {
    try {
      final raw = Prefs.getString(_key);
      if (raw == null || raw.isEmpty) return [];
      final list = jsonDecode(raw) as List<dynamic>;
      return list
          .map((e) => FavItem.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _save() async {
    await Prefs.setString(
      _key,
      jsonEncode(_favorites.map((f) => f.toJson()).toList()),
    );
  }

  List<FavItem> get favorites => List.unmodifiable(_favorites);

  int get count => _favorites.length;

  bool isFavorite(String id) => _favorites.any((f) => f.id == id);

  /// Returns `true` when the item was added, `false` when removed, and
  /// `null` when the add was blocked by the free-tier limit.
  Future<bool?> toggleFavorite(
    String id,
    FavType type, {
    required bool isPremium,
  }) async {
    final exists = _favorites.any((f) => f.id == id);
    if (exists) {
      _favorites = _favorites.where((f) => f.id != id).toList();
      await _save();
      return false;
    }
    if (!isPremium && _favorites.length >= kFreeFavoritesLimit) {
      Analytics.capture('favorite_limit_reached', {'id': id});
      return null;
    }
    _favorites = [
      ..._favorites,
      FavItem(
        id: id,
        type: type,
        addedAt: DateTime.now().millisecondsSinceEpoch,
      ),
    ];
    await _save();
    Analytics.capture('favorite_added', {
      'wallpaper_id': id,
      'type': favTypeToJson(type),
    });
    // Happy moment → rating ask, same 1.2s delay as `useFavorites.ts`.
    Timer(const Duration(milliseconds: 1200), RatingService.maybeRequestRating);
    return true;
  }

  Future<void> clearFavorites() async {
    _favorites = [];
    await _save();
  }
}
