import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

part 'lucide_paths.dart';

/// Renders a Lucide icon with the exact geometry the web build uses.
///
/// Material's icon set was standing in for Lucide across the app (filled,
/// heavier, different silhouettes) which is why headers, category chips and the
/// streak badge never matched the web screens. The path data in
/// `lucide_paths.dart` is generated straight out of `lucide-react` so the shapes
/// are identical; stroke width / linecap / linejoin match Lucide's defaults.
class LucideIcon extends StatelessWidget {
  const LucideIcon(
    this.name, {
    super.key,
    this.size = 16,
    this.color,
    this.strokeWidth = 2,
    this.filled = false,
  });

  final String name;
  final double size;

  /// Defaults to the ambient [IconTheme] colour, like Material's `Icon`.
  final Color? color;

  /// Same units as Lucide's `strokeWidth` (24x24 viewBox).
  final double strokeWidth;

  /// Mirrors `fill="currentColor"` on the web (e.g. the streak flame at 3+ days).
  final bool filled;

  static bool has(String name) => _lucideBodies.containsKey(name);

  @override
  Widget build(BuildContext context) {
    final color =
        this.color ?? IconTheme.of(context).color ?? const Color(0xFFFFFFFF);
    final body = _lucideBodies[name];
    if (body == null) return SizedBox(width: size, height: size);
    final hex =
        '#'
        '${(color.r * 255).round().toRadixString(16).padLeft(2, '0')}'
        '${(color.g * 255).round().toRadixString(16).padLeft(2, '0')}'
        '${(color.b * 255).round().toRadixString(16).padLeft(2, '0')}';
    final svg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" '
        'viewBox="0 0 24 24" fill="${filled ? hex : 'none'}" stroke="$hex" '
        'stroke-width="$strokeWidth" stroke-linecap="round" '
        'stroke-linejoin="round">$body</svg>';
    // Center first: when the icon sits directly inside a fixed-size Container
    // (the 48x48 gradient premium tile, category chips, badges) that parent
    // hands down *tight* constraints, which a bare SizedBox cannot shrink
    // below — the icon then stretched to the full tile and looked broken.
    // Center relaxes the constraints and keeps the requested glyph size.
    return Center(
      widthFactor: 1,
      heightFactor: 1,
      child: SizedBox(
        width: size,
        height: size,
        child: SvgPicture.string(
          svg,
          width: size,
          height: size,
          // Opacity is applied here so the cached picture stays colour-stable.
          colorFilter: color.a < 1
              ? ColorFilter.mode(color, BlendMode.srcIn)
              : null,
        ),
      ),
    );
  }
}
