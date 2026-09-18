import 'dart:async';
import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:sensors_plus/sensors_plus.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/theme/app_colors.dart';
import '../../core/services/haptics.dart';
import '../../core/services/parallax_physics.dart';
import '../../core/services/parallax_scenes.dart';
import '../../core/services/personal_cross.dart';
import '../../widgets/engraved_overlay.dart';
import 'today_shared.dart';

/// 1:1 port of `src/components/ParallaxRail.tsx`.
///
/// Same 8 scenes, same horizontal snap pager (one scene per page), same
/// active±1 image loading, same OneEuro + per-layer Spring physics, the same
/// 30fps-capped loop on Android, the same idle sine drift, the same live/tilt
/// chips, corner brackets, vignettes, next-scene cue, dots, gold CTA and hint
/// line — and it shares the engraving widget with the preview exactly like the
/// web app shares `EngravedOverlay`.
class ParallaxRail extends StatefulWidget {
  const ParallaxRail({super.key, required this.onOpenScene});

  /// Mirrors `navigate('/parallax?scene=<id>&personalize=1')`.
  final void Function(String sceneId, bool personalize) onOpenScene;

  @override
  State<ParallaxRail> createState() => _ParallaxRailState();
}

class _ParallaxRailState extends State<ParallaxRail> {
  final _controller = PageController();
  List<ParallaxScene> _scenes = const [];
  int _activeIdx = 0;
  Set<int> _loadedIdx = {0, 1};

  String _personalName = '';
  PersonalVerse? _personalVerse;

  @override
  void initState() {
    super.initState();
    _load();
    PersonalCross.revision.addListener(_syncPersonal);
  }

  Future<void> _load() async {
    final scenes = await ParallaxScenes.load();
    if (!mounted) return;
    setState(() {
      _scenes = scenes;
      _personalName = PersonalCross.name();
      _personalVerse = PersonalCross.verse();
    });
  }

  void _syncPersonal() {
    if (!mounted) return;
    setState(() {
      _personalName = PersonalCross.name();
      _personalVerse = PersonalCross.verse();
    });
  }

  @override
  void dispose() {
    PersonalCross.revision.removeListener(_syncPersonal);
    _controller.dispose();
    super.dispose();
  }

  void _onPage(int idx) {
    if (idx == _activeIdx) return;
    setState(() {
      _activeIdx = idx.clamp(0, _scenes.length - 1);
      // Cards keep their image once seen; distant cards never load one.
      final next = {..._loadedIdx};
      for (final i in [idx - 1, idx, idx + 1]) {
        if (i >= 0 && i < _scenes.length) next.add(i);
      }
      _loadedIdx = next;
    });
  }

  bool get _hasPersonalized => _personalName.isNotEmpty;

  void _openPreview([ParallaxScene? scene]) {
    final s = scene ?? _scenes[_activeIdx];
    widget.onOpenScene(s.id, !_hasPersonalized);
  }

  @override
  Widget build(BuildContext context) {
    // The web page reserves 180px while the rail lazy-loads so scroll never
    // jumps; mirror that with a fixed-height shell until the data lands.
    if (_scenes.isEmpty || _personalVerse == null) {
      return const SizedBox(height: 180);
    }

    final active = _scenes[_activeIdx];
    final cardMaxHeight = MediaQuery.sizeOf(context).height * 0.49;

    return Padding(
      padding: const EdgeInsets.only(left: 12, right: 12, bottom: 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // ---- header row ----------------------------------------------
          Padding(
            padding: const EdgeInsets.only(left: 4, right: 4, bottom: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Container(
                  width: 3,
                  height: 14,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(99),
                    gradient: LinearGradient(
                      begin: Alignment.topCenter,
                      end: Alignment.bottomCenter,
                      colors: [gold, gold.withValues(alpha: 0.55)],
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: gold.withValues(alpha: 0.45),
                        blurRadius: 8,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    t('px.railHeader').toUpperCase(),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 11 * 0.16,
                      color: AppColors.foreground.withValues(alpha: 0.85),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                _hasPersonalized
                    ? _Pill(
                        label: '✓ ${t('px.personalBadge')}',
                        color: hsl(42, 90, 70),
                        background: hsl(42, 60, 20, 0.35),
                        border: hsl(42, 70, 55, 0.4),
                      )
                    : _Pill(
                        label: t('px.newBadge'),
                        color: AppColors.foreground.withValues(alpha: 0.6),
                        background: hsl(0, 0, 100, 0.04),
                        border: hsl(0, 0, 100, 0.08),
                      ),
              ],
            ),
          ),

          // ---- snap pager ----------------------------------------------
          SizedBox(
            height: math.min(
              cardMaxHeight,
              (MediaQuery.sizeOf(context).width - 24) * 13 / 9,
            ),
            child: Stack(
              children: [
                PageView.builder(
                  controller: _controller,
                  onPageChanged: _onPage,
                  itemCount: _scenes.length,
                  itemBuilder: (context, i) => _ParallaxHero(
                    scene: _scenes[i],
                    // Only the active + neighbouring cards load their image.
                    loadImage: _loadedIdx.contains(i),
                    animate: i == _activeIdx,
                    personalName: _personalName,
                    personalVerse: _personalVerse!,
                    onOpen: () => _openPreview(_scenes[i]),
                  ),
                ),
                if (_scenes.length > 1 && _activeIdx < _scenes.length - 1)
                  Positioned(
                    right: 12,
                    top: 0,
                    bottom: 0,
                    child: Center(
                      child: _NextCue(
                        onTap: () => _controller.animateToPage(
                          _activeIdx + 1,
                          duration: const Duration(milliseconds: 320),
                          curve: Curves.easeOutCubic,
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),

          // ---- pagination dots -----------------------------------------
          if (_scenes.length > 1)
            Padding(
              padding: const EdgeInsets.only(top: 10),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  for (var i = 0; i < _scenes.length; i++)
                    GestureDetector(
                      onTap: () => _controller.animateToPage(
                        i,
                        duration: const Duration(milliseconds: 320),
                        curve: Curves.easeOutCubic,
                      ),
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 220),
                        margin: const EdgeInsets.symmetric(horizontal: 3),
                        width: i == _activeIdx ? 18 : 6,
                        height: 6,
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(99),
                          color: i == _activeIdx ? null : hsl(0, 0, 100, 0.22),
                          gradient: i == _activeIdx
                              ? LinearGradient(
                                  colors: [hsl(42, 85, 60), hsl(38, 85, 48)],
                                )
                              : null,
                          boxShadow: i == _activeIdx
                              ? [
                                  BoxShadow(
                                    color: hsl(42, 80, 55, 0.55),
                                    blurRadius: 8,
                                  ),
                                ]
                              : null,
                        ),
                      ),
                    ),
                ],
              ),
            ),

          // ---- gold CTA -------------------------------------------------
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: TapScale(
              scale: 0.985,
              onTap: () => _openPreview(),
              child: Container(
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [hsl(42, 80, 54), hsl(38, 82, 42)],
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: gold.withValues(alpha: 0.65),
                      blurRadius: 26,
                      offset: const Offset(0, 12),
                      spreadRadius: -8,
                    ),
                  ],
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.workspace_premium,
                      size: 16,
                      color: AppColors.background,
                    ),
                    const SizedBox(width: 8),
                    Text(
                      t('px.setSceneWallpaper', {'name': active.localizedName}),
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        letterSpacing: 14 * 0.02,
                        color: AppColors.background,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),

          Padding(
            padding: const EdgeInsets.only(top: 8),
            child: Text(
              (_hasPersonalized
                      ? t('px.reopenRetune')
                      : t('px.personalizeHint'))
                  .toUpperCase(),
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 10.5,
                fontWeight: FontWeight.w600,
                letterSpacing: 10.5 * 0.14,
                color: AppColors.foreground.withValues(alpha: 0.45),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Pill extends StatelessWidget {
  const _Pill({
    required this.label,
    required this.color,
    required this.background,
    required this.border,
  });

  final String label;
  final Color color;
  final Color background;
  final Color border;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 20,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: border, width: 1),
      ),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          fontSize: 9.5,
          fontWeight: FontWeight.w700,
          letterSpacing: 9.5 * 0.14,
          color: color,
        ),
      ),
    );
  }
}

/// The right-edge "swipe" cue with the web's 1800ms nudge animation.
class _NextCue extends StatefulWidget {
  const _NextCue({required this.onTap});

  final VoidCallback onTap;

  @override
  State<_NextCue> createState() => _NextCueState();
}

class _NextCueState extends State<_NextCue>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _c,
      builder: (context, child) {
        // 0% / 100% at 0px, 50% at -4px — matches `prayly-rail-next-cue`.
        final dx = -4 * (1 - (math.cos(_c.value * 2 * math.pi) + 1) / 2);
        return Transform.translate(offset: Offset(dx, 0), child: child);
      },
      child: TapScale(
        scale: 0.95,
        onTap: widget.onTap,
        child: Container(
          height: 36,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: hsl(0, 0, 0, 0.58),
            borderRadius: BorderRadius.circular(99),
            border: Border.all(color: hsl(42, 70, 65, 0.42), width: 1),
            boxShadow: [
              BoxShadow(
                color: hsl(0, 0, 0, 0.72),
                blurRadius: 22,
                offset: const Offset(0, 8),
                spreadRadius: -8,
              ),
            ],
          ),
          child: Row(
            children: [
              Text(
                t('wp.parallax.swipe').toUpperCase(),
                style: const TextStyle(
                  fontSize: 10.5,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 10.5 * 0.08,
                  color: Colors.white,
                ),
              ),
              const SizedBox(width: 6),
              const Text(
                '›',
                style: TextStyle(fontSize: 16, height: 1, color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Full-width "3D Live Wallpaper" hero card — the depth engine.
class _ParallaxHero extends StatefulWidget {
  const _ParallaxHero({
    required this.scene,
    required this.loadImage,
    required this.animate,
    required this.personalName,
    required this.personalVerse,
    required this.onOpen,
  });

  final ParallaxScene scene;
  final bool loadImage;

  /// Only the card in view runs frames — the web version uses an
  /// IntersectionObserver for exactly this (ANR-safe).
  final bool animate;
  final String personalName;
  final PersonalVerse personalVerse;
  final VoidCallback onOpen;

  @override
  State<_ParallaxHero> createState() => _ParallaxHeroState();
}

class _ParallaxHeroState extends State<_ParallaxHero>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final Ticker _ticker;

  // Home rail preview only. The full ParallaxPreview screen carries the larger
  // sensor movement; Today must stay smooth while other sections load.
  // The real lock-screen output is the native service and is untouched.
  static const double _displacement = 0.50;

  final _fx = OneEuro(1.0, 0.015, 1);
  final _fy = OneEuro(1.0, 0.015, 1);

  // Per-layer springs: bg heavy (drifts), fg crisp (snaps), halo in between.
  final _bgSx = Spring(55, 13);
  final _bgSy = Spring(55, 13);
  final _fgSx = Spring(150, 16);
  final _fgSy = Spring(150, 16);
  final _haSx = Spring(95, 14);
  final _haSy = Spring(95, 14);

  Offset _bg = Offset.zero;
  Offset _fg = Offset.zero;
  Offset _halo = Offset.zero;

  StreamSubscription<AccelerometerEvent>? _accel;
  bool _gyroActive = false;
  Offset _gyroXY = Offset.zero;
  double _lastGyroAtMs = 0;
  bool _rebase = true;
  double? _baseGamma;
  double? _baseBeta;

  bool _pointerActive = false;
  Offset _pointerXY = Offset.zero;
  Offset _pointerStart = Offset.zero;
  bool _swiping = false;

  double _lastPaintMs = 0;
  double _lastFrameMs = 0;
  double _startMs = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = createTicker(_tick);
    if (widget.animate) _start();
  }

  @override
  void didUpdateWidget(_ParallaxHero old) {
    super.didUpdateWidget(old);
    if (widget.animate != old.animate) {
      widget.animate ? _start() : _stop();
    }
  }

  void _start() {
    if (_ticker.isActive) return;
    _rebase = true;
    _fx.reset();
    _fy.reset();
    _lastFrameMs = 0;
    _startMs = 0;
    _ticker.start();
  }

  void _stop() {
    if (_ticker.isActive) _ticker.stop();
    _accel?.cancel();
    _accel = null;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    // Mirrors the web `visibilitychange` pause.
    if (state == AppLifecycleState.resumed) {
      if (widget.animate) _start();
    } else {
      _stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _stop();
    _ticker.dispose();
    super.dispose();
  }

  /// Accelerometer stands in for `deviceorientation`: gamma/beta in degrees are
  /// derived from the gravity vector, then normalised by /20 exactly like web.
  void _onAccel(AccelerometerEvent e) {
    final gamma =
        math.atan2(e.x, math.sqrt(e.y * e.y + e.z * e.z)) * 180 / math.pi;
    final beta = math.atan2(e.y, e.z.abs() < 1e-6 ? 1e-6 : e.z) * 180 / math.pi;
    final nowMs = DateTime.now().millisecondsSinceEpoch.toDouble();
    if (_rebase) {
      _baseGamma = gamma;
      _baseBeta = beta;
      _rebase = false;
      _fx.reset();
      _fy.reset();
      return;
    }
    final tSec = nowMs / 1000;
    final rawX = (gamma - (_baseGamma ?? 0)) / 20;
    final rawY = (beta - (_baseBeta ?? 0)) / 20;
    _gyroXY = Offset(
      _fx.filter(rawX, tSec).clamp(-1.0, 1.0),
      _fy.filter(rawY, tSec).clamp(-1.0, 1.0),
    );
    _gyroActive = true;
    _lastGyroAtMs = nowMs;
  }

  void _tick(Duration elapsed) {
    final now = elapsed.inMicroseconds / 1000.0;
    if (_startMs == 0) {
      _startMs = now;
      _lastFrameMs = now;
    }
    // Time-based 15fps cap on the home rail.
    if (now - _lastPaintMs < 64) return;
    _lastPaintMs = now;
    final dt = math.max(0.001, (now - _lastFrameMs) / 1000);
    _lastFrameMs = now;
    final tSec = (now - _startMs) / 1000;

    // Gentle sine idle drift so it never looks frozen.
    final idleX = math.sin(tSec * 0.25) * 0.46;
    final idleY = math.sin(tSec * 0.18 + 1.1) * 0.32;
    var targetX = idleX;
    var targetY = idleY;
    final nowMs = DateTime.now().millisecondsSinceEpoch.toDouble();
    final gyroFresh = _gyroActive && nowMs - _lastGyroAtMs < 900;
    if (gyroFresh) {
      targetX = _gyroXY.dx + idleX * 0.15;
      targetY = _gyroXY.dy + idleY * 0.15;
    } else if (_pointerActive) {
      targetX = _pointerXY.dx;
      targetY = _pointerXY.dy;
    }

    final bgX = _bgSx.step(targetX, dt);
    final bgY = _bgSy.step(targetY, dt);
    final fgX = _fgSx.step(targetX, dt);
    final fgY = _fgSy.step(targetY, dt);
    final haX = _haSx.step(targetX, dt);
    final haY = _haSy.step(targetY, dt);

    const d = _displacement;
    setState(() {
      if (widget.scene.wholeMove) {
        _bg = Offset(bgX * 24 * d, bgY * 7 * d);
        _halo = Offset(haX * 24 * d, haY * 7 * d);
      } else {
        _bg = Offset(bgX * 8 * d, bgY * 7 * d);
        _fg = Offset(fgX * 24 * d, fgY * 16 * d);
        _halo = Offset(haX * 14 * d, haY * 12 * d);
      }
    });
  }

  // ---- pointer follow (same swipe hand-back rules as web) ---------------
  void _onPointerDown(Offset local) {
    _pointerStart = local;
    _swiping = false;
  }

  void _onPointerMove(Offset local, Size size) {
    final dx = local.dx - _pointerStart.dx;
    final dy = local.dy - _pointerStart.dy;
    // Horizontal intent = the user is paging the rail; give the gesture back.
    if (_swiping || (dx.abs() > 8 && dx.abs() > dy.abs())) {
      _swiping = true;
      _pointerActive = false;
      return;
    }
    _pointerXY = Offset(
      (local.dx / size.width - 0.5) * 2,
      (local.dy / size.height - 0.5) * 2,
    );
    _pointerActive = true;
  }

  void _release() {
    _pointerActive = false;
    _rebase = true;
  }

  @override
  Widget build(BuildContext context) {
    final scene = widget.scene;
    return LayoutBuilder(
      builder: (context, c) {
        final size = Size(c.maxWidth, c.maxHeight);
        return Listener(
          onPointerDown: (e) => _onPointerDown(e.localPosition),
          onPointerMove: (e) => _onPointerMove(e.localPosition, size),
          onPointerUp: (_) => _release(),
          onPointerCancel: (_) => _release(),
          child: RepaintBoundary(
            child: TapScale(
              scale: 0.99,
              onTap: () {
                // Suppress the tap that ends a horizontal swipe.
                if (_swiping) {
                  _swiping = false;
                  return;
                }
                haptic(HapticStyle.light);
                widget.onOpen();
              },
              child: Container(
                decoration: BoxDecoration(
                  color: Colors.black,
                  borderRadius: BorderRadius.circular(28),
                  boxShadow: [
                    BoxShadow(
                      color: hsl(0, 0, 0, 0.72),
                      blurRadius: 36,
                      offset: const Offset(0, 30),
                      spreadRadius: -24,
                    ),
                    BoxShadow(
                      color: hsl(42, 60, 40, 0.12),
                      blurRadius: 12,
                      offset: const Offset(0, 8),
                      spreadRadius: -12,
                    ),
                  ],
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(28),
                  child: Stack(
                    children: [
                      // ---- background layer (heavy spring) ----------------
                      Positioned(
                        left: scene.wholeMove ? -10 : -28,
                        right: scene.wholeMove ? -10 : -28,
                        top: scene.wholeMove ? -10 : -28,
                        bottom: scene.wholeMove ? -10 : -28,
                        child: Transform.translate(
                          offset: _bg,
                          child: Transform.scale(
                            scale: scene.wholeMove ? 1.02 : 1.07,
                            child: widget.loadImage
                                ? CachedNetworkImage(
                                    imageUrl: scene.bgCard.isNotEmpty
                                        ? scene.bgCard
                                        : scene.bg,
                                    fit: BoxFit.cover,
                                    fadeInDuration: const Duration(
                                      milliseconds: 220,
                                    ),
                                    placeholder: (_, __) =>
                                        const ColoredBox(color: Colors.black),
                                    errorWidget: (_, __, ___) =>
                                        const ColoredBox(color: Colors.black),
                                  )
                                : const ColoredBox(color: Colors.black),
                          ),
                        ),
                      ),

                      // ---- foreground cutout (crisp spring) ---------------
                      if (!scene.wholeMove && widget.loadImage)
                        Positioned.fill(
                          child: IgnorePointer(
                            child: Transform.translate(
                              offset: _fg,
                              child: Align(
                                alignment: Alignment.bottomCenter,
                                child: Transform.scale(
                                  scale: 1.025,
                                  child: SizedBox(
                                    height: size.height * scene.fgHeight / 100,
                                    child: AspectRatio(
                                      aspectRatio: 832 / 1472,
                                      child: ShaderMask(
                                        blendMode: BlendMode.dstIn,
                                        shaderCallback: (r) =>
                                            const LinearGradient(
                                              begin: Alignment.topCenter,
                                              end: Alignment.bottomCenter,
                                              colors: [
                                                Colors.black,
                                                Colors.black,
                                                Colors.transparent,
                                              ],
                                              stops: [0, 0.9, 1],
                                            ).createShader(r),
                                        child: CachedNetworkImage(
                                          imageUrl: scene.fgCardFor(),
                                          fit: BoxFit.contain,
                                          placeholder: (_, __) =>
                                              const SizedBox.shrink(),
                                          errorWidget: (_, __, ___) =>
                                              const SizedBox.shrink(),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                      // ---- halo (mid spring) ------------------------------
                      Positioned.fill(
                        child: IgnorePointer(
                          child: Transform.translate(
                            offset: _halo,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                gradient: RadialGradient(
                                  center: const Alignment(0, -0.1),
                                  radius: 0.75,
                                  colors: [
                                    hsl(42, 90, 70, 0.04),
                                    Colors.transparent,
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // ---- top vignette ----------------------------------
                      Positioned(
                        left: 0,
                        right: 0,
                        top: 0,
                        height: size.height * 0.18,
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  hsl(0, 0, 0, 0.55),
                                  Colors.transparent,
                                ],
                              ),
                            ),
                          ),
                        ),
                      ),

                      // ---- bottom vignette -------------------------------
                      Positioned(
                        left: 0,
                        right: 0,
                        bottom: 0,
                        height: size.height * 0.36,
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: LinearGradient(
                                begin: Alignment.bottomCenter,
                                end: Alignment.topCenter,
                                colors: [
                                  hsl(0, 0, 0, 0.82),
                                  hsl(0, 0, 0, 0.28),
                                  Colors.transparent,
                                ],
                                stops: const [0, 0.55, 1],
                              ),
                            ),
                          ),
                        ),
                      ),

                      // ---- inner hairline ring ---------------------------
                      Positioned.fill(
                        child: IgnorePointer(
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(28),
                              border: Border.all(
                                color: hsl(42, 70, 70, 0.14),
                                width: 1,
                              ),
                            ),
                          ),
                        ),
                      ),

                      // ---- corner brackets (viewfinder cue) --------------
                      for (final corner in const ['tl', 'tr', 'bl', 'br'])
                        Positioned(
                          top: corner.startsWith('t') ? 10 : null,
                          bottom: corner.startsWith('b') ? 10 : null,
                          left: corner.endsWith('l') ? 10 : null,
                          right: corner.endsWith('r') ? 10 : null,
                          child: IgnorePointer(child: _Bracket(corner: corner)),
                        ),

                      // ---- LIVE chip -------------------------------------
                      Positioned(
                        top: 12,
                        left: 12,
                        child: IgnorePointer(child: const _LiveChip()),
                      ),

                      // ---- tilt hint chip --------------------------------
                      Positioned(
                        top: 12,
                        right: 12,
                        child: IgnorePointer(
                          child: Container(
                            height: 24,
                            padding: const EdgeInsets.symmetric(horizontal: 10),
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: hsl(0, 0, 0, 0.42),
                              borderRadius: BorderRadius.circular(99),
                              border: Border.all(
                                color: hsl(0, 0, 100, 0.12),
                                width: 1,
                              ),
                            ),
                            child: Text(
                              t('px.tiltDepth').toUpperCase(),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w600,
                                letterSpacing: 10 * 0.14,
                                color: Colors.white.withValues(alpha: 0.8),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // ---- personalized engraving (shared widget) --------
                      EngravedOverlay(
                        name: widget.personalName,
                        verse: widget.personalVerse,
                        compact: true,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}

class _Bracket extends StatelessWidget {
  const _Bracket({required this.corner});

  final String corner;

  @override
  Widget build(BuildContext context) {
    final line = BorderSide(color: hsl(42, 75, 68, 0.55), width: 1);
    final top = corner.startsWith('t');
    final left = corner.endsWith('l');
    return SizedBox(
      width: 16,
      height: 16,
      child: DecoratedBox(
        decoration: BoxDecoration(
          border: Border(
            top: top ? line : BorderSide.none,
            bottom: top ? BorderSide.none : line,
            left: left ? line : BorderSide.none,
            right: left ? BorderSide.none : line,
          ),
          borderRadius: BorderRadius.only(
            topLeft: corner == 'tl' ? const Radius.circular(8) : Radius.zero,
            topRight: corner == 'tr' ? const Radius.circular(8) : Radius.zero,
            bottomLeft: corner == 'bl' ? const Radius.circular(8) : Radius.zero,
            bottomRight: corner == 'br'
                ? const Radius.circular(8)
                : Radius.zero,
          ),
        ),
      ),
    );
  }
}

/// Glass "LIVE" chip with the 1.8s pulsing dot.
class _LiveChip extends StatefulWidget {
  const _LiveChip();

  @override
  State<_LiveChip> createState() => _LiveChipState();
}

class _LiveChipState extends State<_LiveChip>
    with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1800),
  )..repeat();

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 24,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      decoration: BoxDecoration(
        color: hsl(0, 0, 0, 0.42),
        borderRadius: BorderRadius.circular(99),
        border: Border.all(color: hsl(42, 70, 65, 0.28), width: 1),
      ),
      child: Row(
        children: [
          AnimatedBuilder(
            animation: _c,
            builder: (context, _) {
              // 0%/100% opacity 1 scale 1, 50% opacity 0.55 scale 0.82.
              final k = (1 - math.cos(_c.value * 2 * math.pi)) / 2;
              return Opacity(
                opacity: 1 - 0.45 * k,
                child: Transform.scale(
                  scale: 1 - 0.18 * k,
                  child: Container(
                    width: 6,
                    height: 6,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: hsl(140, 70, 55),
                      boxShadow: [
                        BoxShadow(color: hsl(140, 70, 55, 0.9), blurRadius: 6),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
          const SizedBox(width: 6),
          Text(
            t('wp.reel.live').toUpperCase(),
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w700,
              letterSpacing: 10 * 0.18,
              color: Colors.white.withValues(alpha: 0.9),
            ),
          ),
        ],
      ),
    );
  }
}
