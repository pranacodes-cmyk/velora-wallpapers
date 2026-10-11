import 'package:flutter/material.dart';

import 'onboarding_shared.dart';

/// Native-Flutter motion kit for onboarding.
///
/// The Capacitor build had to ship opacity-only 160ms reveals because WebView
/// compositing dropped frames on mid-range Android. Flutter renders through
/// Impeller, so we can afford the original premium choreography: staggered
/// fade + rise + micro-scale entrances, a slow breathing ambient glow and a
/// shimmer sweep on the primary CTA.
///
/// Every animation here is built from [FadeTransition] / [SlideTransition] /
/// [ScaleTransition], which mutate layer properties on the render tree instead
/// of rebuilding the child subtree each frame. Children are therefore built
/// exactly once.
class OnbMotion {
  const OnbMotion._();

  /// Entrance duration for a single element.
  static const enter = Duration(milliseconds: 560);

  /// Delay added per element index in a staggered group.
  static const stagger = Duration(milliseconds: 78);

  /// Slide-to-slide transition length.
  static const slide = Duration(milliseconds: 420);

  static const easeOutExpo = Cubic(0.16, 1, 0.3, 1);
  static const easeOutBack = Cubic(0.34, 1.3, 0.64, 1);
}

/// Fade + rise + micro-scale entrance. Runs once when mounted.
class OnbReveal extends StatefulWidget {
  const OnbReveal({
    super.key,
    required this.child,
    this.index = 0,
    this.dy = 18,
    this.scaleFrom = 0.985,
    this.duration = OnbMotion.enter,
    this.delay,
    this.curve = OnbMotion.easeOutExpo,
  });

  final Widget child;

  /// Position inside a staggered group; multiplied by [OnbMotion.stagger].
  final int index;

  /// Pixels the element travels upward while fading in.
  final double dy;
  final double scaleFrom;
  final Duration duration;
  final Duration? delay;
  final Curve curve;

  @override
  State<OnbReveal> createState() => _OnbRevealState();
}

class _OnbRevealState extends State<OnbReveal>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.duration,
  );
  late final Animation<double> _eased = CurvedAnimation(
    parent: _c,
    curve: widget.curve,
  );

  @override
  void initState() {
    super.initState();
    final delay = widget.delay ?? (OnbMotion.stagger * widget.index);
    if (delay == Duration.zero) {
      _c.forward();
    } else {
      Future<void>.delayed(delay, () {
        if (mounted) _c.forward();
      });
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _eased,
      child: SlideTransition(
        position: Tween<Offset>(
          begin: Offset(0, widget.dy / 100),
          end: Offset.zero,
        ).animate(_eased),
        child: ScaleTransition(
          scale: Tween<double>(begin: widget.scaleFrom, end: 1).animate(_eased),
          child: widget.child,
        ),
      ),
    );
  }
}

/// Wraps each child of a group in a staggered [OnbReveal].
List<Widget> onbStagger(
  List<Widget> children, {
  int startIndex = 0,
  double dy = 18,
}) {
  final out = <Widget>[];
  var i = startIndex;
  for (final child in children) {
    // Spacers don't need their own controller.
    if (child is SizedBox && child.child == null) {
      out.add(child);
      continue;
    }
    out.add(OnbReveal(index: i, dy: dy, child: child));
    i++;
  }
  return out;
}

/// Slow breathing radial glow. Only the glow layer repaints.
class OnbAmbientGlow extends StatefulWidget {
  const OnbAmbientGlow({
    super.key,
    required this.size,
    required this.color,
    this.peak = 0.45,
    this.trough = 0.2,
    this.period = const Duration(milliseconds: 5200),
  });

  final double size;
  final Color color;
  final double peak;
  final double trough;
  final Duration period;

  @override
  State<OnbAmbientGlow> createState() => _OnbAmbientGlowState();
}

class _OnbAmbientGlowState extends State<OnbAmbientGlow>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.period,
  );

  @override
  void initState() {
    super.initState();
    _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final glow = RepaintBoundary(
      child: SizedBox(
        width: widget.size,
        height: widget.size,
        child: DecoratedBox(
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                widget.color.withValues(alpha: 0.32),
                widget.color.withValues(alpha: 0.12),
                Colors.transparent,
              ],
              stops: const [0, 0.35, 0.72],
            ),
          ),
        ),
      ),
    );

    final curved = CurvedAnimation(parent: _c, curve: Curves.easeInOut);
    return IgnorePointer(
      child: FadeTransition(
        opacity: Tween<double>(
          begin: widget.trough,
          end: widget.peak,
        ).animate(curved),
        child: ScaleTransition(
          scale: Tween<double>(begin: 0.94, end: 1.06).animate(curved),
          child: glow,
        ),
      ),
    );
  }
}

/// Gold shimmer sweeping across the primary CTA. Uses a shader so no layout or
/// rebuild work happens per frame.
class OnbShimmer extends StatefulWidget {
  const OnbShimmer({
    super.key,
    required this.child,
    this.enabled = true,
    this.period = const Duration(milliseconds: 2600),
  });

  final Widget child;
  final bool enabled;
  final Duration period;

  @override
  State<OnbShimmer> createState() => _OnbShimmerState();
}

class _OnbShimmerState extends State<OnbShimmer>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.period,
  );

  @override
  void initState() {
    super.initState();
    if (widget.enabled) _c.repeat();
  }

  @override
  void didUpdateWidget(OnbShimmer old) {
    super.didUpdateWidget(old);
    if (widget.enabled && !_c.isAnimating) {
      _c.repeat();
    } else if (!widget.enabled && _c.isAnimating) {
      _c.stop();
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _c,
        child: widget.child,
        builder: (context, child) {
          final t = _c.value * 2 - 0.5;
          return ShaderMask(
            blendMode: BlendMode.srcATop,
            shaderCallback: (bounds) => LinearGradient(
              begin: Alignment(t - 0.6, -0.4),
              end: Alignment(t + 0.6, 0.4),
              colors: const [
                Color(0x00FFFFFF),
                Color(0x3DFFFFFF),
                Color(0x00FFFFFF),
              ],
              stops: const [0.35, 0.5, 0.65],
            ).createShader(bounds),
            child: child,
          );
        },
      ),
    );
  }
}

/// Soft breathing pulse used for the CTA glow and gold accents.
class OnbBreathe extends StatefulWidget {
  const OnbBreathe({
    super.key,
    required this.child,
    this.from = 1.0,
    this.to = 1.035,
    this.period = const Duration(milliseconds: 2400),
  });

  final Widget child;
  final double from;
  final double to;
  final Duration period;

  @override
  State<OnbBreathe> createState() => _OnbBreatheState();
}

class _OnbBreatheState extends State<OnbBreathe>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: widget.period,
  );

  @override
  void initState() {
    super.initState();
    _c.repeat(reverse: true);
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: Tween<double>(
        begin: widget.from,
        end: widget.to,
      ).animate(CurvedAnimation(parent: _c, curve: Curves.easeInOut)),
      child: widget.child,
    );
  }
}

/// Directional slide + fade transition between onboarding slides.
Widget onbSlideTransition(
  Widget child,
  Animation<double> animation, {
  required bool forward,
}) {
  final eased = CurvedAnimation(
    parent: animation,
    curve: OnbMotion.easeOutExpo,
    reverseCurve: Curves.easeOutCubic,
  );
  return FadeTransition(
    opacity: eased,
    child: SlideTransition(
      position: Tween<Offset>(
        begin: Offset(forward ? 0.14 : -0.14, 0),
        end: Offset.zero,
      ).animate(eased),
      child: child,
    ),
  );
}

/// Tap feedback used on onboarding cards/CTAs: 60ms press-in, spring release.
class OnbPressable extends StatefulWidget {
  const OnbPressable({
    super.key,
    required this.child,
    this.onTap,
    this.scale = 0.965,
  });

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<OnbPressable> createState() => _OnbPressableState();
}

class _OnbPressableState extends State<OnbPressable> {
  bool _down = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: widget.onTap,
      onTapDown: (_) => setState(() => _down = true),
      onTapUp: (_) => setState(() => _down = false),
      onTapCancel: () => setState(() => _down = false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: Duration(milliseconds: _down ? 70 : 220),
        curve: _down ? Curves.easeOut : OnbMotion.easeOutBack,
        child: widget.child,
      ),
    );
  }
}

/// Convenience: onboarding gold used by the motion widgets.
Color get onbGold => Onb.gold;
