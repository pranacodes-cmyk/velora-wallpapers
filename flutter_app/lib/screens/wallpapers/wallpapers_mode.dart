/// Feed mode shared by the wallpapers screen and its mode pill.
library;

/// Persisted key — mirrors web's `wallpapers.mode.v1` localStorage key.
const kWallpapersModeKey = 'wallpapers.mode.v1';

enum WpMode { live, photos, both }

WpMode wpModeFromString(String? s) => switch (s) {
  'photos' => WpMode.photos,
  'both' => WpMode.both,
  _ => WpMode.live,
};

String wpModeToString(WpMode m) => switch (m) {
  WpMode.live => 'live',
  WpMode.photos => 'photos',
  WpMode.both => 'both',
};
