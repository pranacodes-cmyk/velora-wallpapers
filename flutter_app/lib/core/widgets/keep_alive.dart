import 'package:flutter/material.dart';

/// Keeps a list child's State alive while it scrolls out of the viewport.
///
/// The web build never unmounts a card once it is in the DOM. Without this the
/// Flutter list disposed heavy cards (hero carousel, parallax rail, quiz card)
/// as soon as they left the cache extent, which replayed their entrance
/// animations, re-ran their init work on every scroll pass and — because an
/// inner `PageView` was rebuilt against collapsed metrics — snapped those
/// carousels to their last page all by themselves.
class KeepAlive extends StatefulWidget {
  const KeepAlive({super.key, required this.child});

  final Widget child;

  @override
  State<KeepAlive> createState() => _KeepAliveState();
}

class _KeepAliveState extends State<KeepAlive>
    with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return RepaintBoundary(child: widget.child);
  }
}
