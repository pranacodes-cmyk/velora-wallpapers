import 'package:flutter/material.dart';

import '../core/theme/app_colors.dart';

/// 1:1 port of `src/components/PremiumCrossLogo.tsx`:
/// gradient gold tile, glossy top highlight, slim ornate white cross.
class PremiumCrossLogo extends StatelessWidget {
  const PremiumCrossLogo({super.key, this.size = 32});

  final double size;

  @override
  Widget build(BuildContext context) {
    final radius = (size * 0.3).roundToDouble();
    final crossSize = size * 0.62;

    return Container(
      width: size,
      height: size,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(radius),
        gradient: LinearGradient(
          begin: const Alignment(-0.8, -1),
          end: const Alignment(0.8, 1),
          colors: [
            AppColors.primary,
            AppColors.primary.withValues(alpha: 0.78),
            AppColors.primary.withValues(alpha: 0.55),
          ],
          stops: const [0, 0.55, 1],
        ),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.38),
            blurRadius: 18,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Glossy top highlight
          Positioned(
            left: 4,
            right: 4,
            top: 2,
            height: size / 2,
            child: Opacity(
              opacity: 0.6,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  borderRadius: const BorderRadius.vertical(
                    top: Radius.circular(10),
                  ),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.white.withValues(alpha: 0.32),
                      Colors.white.withValues(alpha: 0),
                    ],
                  ),
                ),
              ),
            ),
          ),
          SizedBox(
            width: crossSize,
            height: crossSize,
            child: CustomPaint(painter: _CrossPainter()),
          ),
        ],
      ),
    );
  }
}

class _CrossPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final u = size.width / 24; // same 24x24 viewBox as the web SVG
    final paint = Paint()
      ..shader = const LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [Color(0xFFFFFFFF), Color(0xF2FFF8E1)],
      ).createShader(Rect.fromLTWH(0, 0, size.width, size.height));

    final r = Radius.circular(0.6 * u);
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(11.1 * u, 3 * u, 12.9 * u, 20.4 * u),
        r,
      ),
      paint,
    );
    canvas.drawRRect(
      RRect.fromRectAndRadius(
        Rect.fromLTRB(5.4 * u, 9.8 * u, 18.6 * u, 12.2 * u),
        r,
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
