import 'package:flutter/material.dart';

/// A tiny shimmering placeholder used while store prices are still loading, so
/// the paywall reads as "fetching" instead of showing a dead dash.
class PriceShimmer extends StatefulWidget {
  const PriceShimmer({
    super.key,
    required this.width,
    required this.height,
    required this.base,
  });

  final double width;
  final double height;
  final Color base;

  @override
  State<PriceShimmer> createState() => _PriceShimmerState();
}

class _PriceShimmerState extends State<PriceShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat(reverse: true);

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // RepaintBoundary keeps the pulse from repainting the whole plan card.
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        builder: (context, _) => Container(
          width: widget.width,
          height: widget.height,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(4),
            color: widget.base.withValues(
              alpha: 0.14 + (0.16 * _c.value),
            ),
          ),
        ),
      ),
    );
  }
}
