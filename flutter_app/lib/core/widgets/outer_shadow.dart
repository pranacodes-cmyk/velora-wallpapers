import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// CSS-accurate drop shadow for translucent surfaces.
///
/// Why this exists: CSS clips an outer `box-shadow` to *outside* the border
/// box, so a glow never shines through a semi-transparent card. Flutter's
/// `BoxShadow` paints the full blurred rounded-rect *behind* the box, so any
/// card with a translucent fill (all our glass surfaces) ends up with the glow
/// colour showing through — which is exactly the muddy gold wash the Flutter
/// build had everywhere while the web build looked like dark frosted glass.
///
/// Wrap the (translucent) surface in [OuterShadow] and keep `boxShadow` off
/// its own decoration.
class OuterShadow extends StatelessWidget {
  const OuterShadow({
    super.key,
    required this.borderRadius,
    required this.shadows,
    required this.child,
  });

  final BorderRadius borderRadius;
  final List<BoxShadow> shadows;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    if (shadows.isEmpty) return child;
    return CustomPaint(
      painter: _OuterShadowPainter(borderRadius, shadows),
      child: child,
    );
  }
}

class _OuterShadowPainter extends CustomPainter {
  _OuterShadowPainter(this.radius, this.shadows);

  final BorderRadius radius;
  final List<BoxShadow> shadows;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final rrect = radius.toRRect(rect);

    canvas.save();
    // Everything outside the surface itself — same clipping rule as CSS.
    final outside = Path.combine(
      PathOperation.difference,
      Path()..addRect(rect.inflate(200)),
      Path()..addRRect(rrect),
    );
    canvas.clipPath(outside);
    for (final s in shadows) {
      final paint = Paint()
        ..color = s.color
        ..maskFilter = s.blurRadius > 0
            ? ui.MaskFilter.blur(BlurStyle.normal, s.blurRadius / 2)
            : null;
      final shifted = radius.toRRect(
        rect.shift(s.offset).inflate(s.spreadRadius),
      );
      canvas.drawRRect(shifted, paint);
    }
    canvas.restore();
  }

  @override
  bool shouldRepaint(_OuterShadowPainter old) =>
      old.radius != radius || old.shadows != shadows;
}
