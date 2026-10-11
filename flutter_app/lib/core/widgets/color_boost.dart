import 'package:flutter/widgets.dart';

/// Flutter port of the CSS `filter: contrast(x) saturate(y) brightness(z)`
/// enhancement the web app applies to every wallpaper image/video
/// (see `StaticWallpaperTile.tsx` / `LiveWallpaperTile.tsx`).
///
/// CSS applies the functions left-to-right, so the matrices are composed in
/// the same order: contrast -> saturate -> brightness.
List<double> _identity() => <double>[
  1, 0, 0, 0, 0, //
  0, 1, 0, 0, 0, //
  0, 0, 1, 0, 0, //
  0, 0, 0, 1, 0, //
];

/// Multiply two 4x5 colour matrices (`b` applied after `a`).
List<double> _mul(List<double> b, List<double> a) {
  final out = List<double>.filled(20, 0);
  for (var row = 0; row < 4; row++) {
    for (var col = 0; col < 4; col++) {
      var sum = 0.0;
      for (var k = 0; k < 4; k++) {
        sum += b[row * 5 + k] * a[k * 5 + col];
      }
      out[row * 5 + col] = sum;
    }
    var offset = b[row * 5 + 4];
    for (var k = 0; k < 4; k++) {
      offset += b[row * 5 + k] * a[k * 5 + 4];
    }
    out[row * 5 + 4] = offset;
  }
  return out;
}

List<double> _contrastMatrix(double c) {
  final t = 127.5 * (1 - c);
  return <double>[
    c, 0, 0, 0, t, //
    0, c, 0, 0, t, //
    0, 0, c, 0, t, //
    0, 0, 0, 1, 0, //
  ];
}

List<double> _brightnessMatrix(double b) => <double>[
  b, 0, 0, 0, 0, //
  0, b, 0, 0, 0, //
  0, 0, b, 0, 0, //
  0, 0, 0, 1, 0, //
];

/// Standard SVG/CSS `saturate()` matrix (Rec. 709 luminance weights).
List<double> _saturateMatrix(double s) {
  const lr = 0.2126, lg = 0.7152, lb = 0.0722;
  return <double>[
    lr + s * (1 - lr), lg * (1 - s), lb * (1 - s), 0, 0, //
    lr * (1 - s), lg + s * (1 - lg), lb * (1 - s), 0, 0, //
    lr * (1 - s), lg * (1 - s), lb + s * (1 - lb), 0, 0, //
    0, 0, 0, 1, 0, //
  ];
}

/// Builds the composed matrix for the given CSS-equivalent values.
List<double> colorBoostMatrix({
  double contrast = 1,
  double saturate = 1,
  double brightness = 1,
}) {
  var m = _identity();
  m = _mul(_contrastMatrix(contrast), m);
  m = _mul(_saturateMatrix(saturate), m);
  m = _mul(_brightnessMatrix(brightness), m);
  return m;
}

/// Preset strengths that mirror the exact values used in the web app.
class ColorBoostPreset {
  const ColorBoostPreset(this.contrast, this.saturate, this.brightness);
  final double contrast;
  final double saturate;
  final double brightness;

  /// `contrast(1.1) saturate(1.2) brightness(1.03)` — static wallpaper tiles.
  static const still = ColorBoostPreset(1.10, 1.20, 1.03);

  /// `contrast(1.14) saturate(1.3) brightness(1.06)` — looping preview clips.
  static const previewClip = ColorBoostPreset(1.14, 1.30, 1.06);

  /// `contrast(1.08) saturate(1.15) brightness(1.02)` — inline video fallback.
  static const videoFallback = ColorBoostPreset(1.08, 1.15, 1.02);

  /// `contrast(1.06) saturate(1.1) brightness(1.02)` — full-quality playback.
  static const fullVideo = ColorBoostPreset(1.06, 1.10, 1.02);

  /// `saturate(1.1) contrast(1.05)` — Today rail cards and phone mockups.
  static const homeRail = ColorBoostPreset(1.05, 1.10, 1.0);

  /// `saturate(0.55)` — inactive neighbour cards in the Today carousel.
  static const dimmedNeighbour = ColorBoostPreset(1.0, 0.55, 1.0);
}

/// Wraps [child] in the web app's colour-boost filter so Flutter previews look
/// as rich as the web previews.
class ColorBoost extends StatelessWidget {
  const ColorBoost({
    super.key,
    required this.child,
    this.preset = ColorBoostPreset.still,
    this.enabled = true,
  });

  final Widget child;
  final ColorBoostPreset preset;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    if (!enabled) return child;
    return ColorFiltered(
      colorFilter: ColorFilter.matrix(
        colorBoostMatrix(
          contrast: preset.contrast,
          saturate: preset.saturate,
          brightness: preset.brightness,
        ),
      ),
      child: child,
    );
  }
}

/// Port of the web tile's inner vignette
/// (`box-shadow: inset 0 0 30px 5px rgba(0,0,0,0.25)`), which gives the
/// previews their depth. Purely decorative — never hit-testable.
class TileVignette extends StatelessWidget {
  const TileVignette({super.key, this.opacity = 0.25});
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: RadialGradient(
            center: Alignment.center,
            radius: 0.95,
            colors: [
              const Color(0x00000000),
              Color.fromRGBO(0, 0, 0, opacity * 0.35),
              Color.fromRGBO(0, 0, 0, opacity),
            ],
            stops: const [0.55, 0.85, 1.0],
          ),
        ),
      ),
    );
  }
}
