import 'package:flutter/material.dart';

/// Exact port of the Lucide `Cross` icon used all over the web app.
/// Material's `Icons.add` was standing in for it, which reads as a plus sign
/// (equal arms) instead of a latin cross — the mismatch the header icons showed.
class LucideCross extends StatelessWidget {
  const LucideCross({
    super.key,
    this.size = 16,
    required this.color,
    this.strokeWidth = 2,
  });

  final double size;
  final Color color;

  /// Same meaning as Lucide's `strokeWidth` (in the 24x24 viewBox).
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    // Same tight-constraint guard as LucideIcon: inside a fixed-size parent a
    // bare SizedBox is forced to the parent's size and the cross blew up.
    return Center(
      widthFactor: 1,
      heightFactor: 1,
      child: SizedBox(
        width: size,
        height: size,
        child: CustomPaint(
          painter: _LucideCrossPainter(color: color, strokeWidth: strokeWidth),
        ),
      ),
    );
  }
}

class _LucideCrossPainter extends CustomPainter {
  const _LucideCrossPainter({required this.color, required this.strokeWidth});

  final Color color;
  final double strokeWidth;

  @override
  void paint(Canvas canvas, Size size) {
    final u = size.width / 24;
    const r = Radius.circular(2);
    Offset p(double x, double y) => Offset(x * u, y * u);
    final radius = Radius.elliptical(r.x * u, r.y * u);

    final path = Path()
      ..moveTo(9 * u, 4 * u)
      ..arcToPoint(p(11, 2), radius: radius, clockwise: true)
      ..lineTo(13 * u, 2 * u)
      ..arcToPoint(p(15, 4), radius: radius, clockwise: true)
      ..lineTo(15 * u, 9 * u)
      ..lineTo(20 * u, 9 * u)
      ..arcToPoint(p(22, 11), radius: radius, clockwise: true)
      ..lineTo(22 * u, 13 * u)
      ..arcToPoint(p(20, 15), radius: radius, clockwise: true)
      ..lineTo(15 * u, 15 * u)
      ..lineTo(15 * u, 20 * u)
      ..arcToPoint(p(13, 22), radius: radius, clockwise: true)
      ..lineTo(11 * u, 22 * u)
      ..arcToPoint(p(9, 20), radius: radius, clockwise: true)
      ..lineTo(9 * u, 15 * u)
      ..lineTo(4 * u, 15 * u)
      ..arcToPoint(p(2, 13), radius: radius, clockwise: true)
      ..lineTo(2 * u, 11 * u)
      ..arcToPoint(p(4, 9), radius: radius, clockwise: true)
      ..lineTo(9 * u, 9 * u)
      ..close();

    canvas.drawPath(
      path,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeJoin = StrokeJoin.round
        ..strokeCap = StrokeCap.round
        ..strokeWidth = strokeWidth * u
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(covariant _LucideCrossPainter old) =>
      old.color != color || old.strokeWidth != strokeWidth;
}
