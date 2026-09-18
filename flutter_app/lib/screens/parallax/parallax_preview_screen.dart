import 'dart:math' as math;

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/localization/app_localizations.dart';
import '../../core/services/analytics.dart';
import '../../core/services/haptics.dart';
import '../../core/services/parallax_physics.dart';
import '../../core/services/parallax_scenes.dart';
import '../../core/services/parallax_tilt.dart';
import '../../core/services/parallax_wallpaper.dart';
import '../../core/services/personal_cross.dart';
import '../../core/services/rating_service.dart';
import '../../state/app_providers.dart';
import '../../widgets/engraved_overlay.dart';
import '../../widgets/premium_sheet.dart';
import '../today/today_shared.dart';
import 'personalize_cross_sheet.dart';

/// 1:1 port of `src/pages/ParallaxPreview.tsx` — the immersive 3D wallpaper
/// stage: per-layer springs driven by tilt, swipe/arrows/dots between scenes,
/// personalize pill, engraved overlay and the gold "Set as Wallpaper" CTA that
/// opens the paywall for free users.
class ParallaxPreviewScreen extends ConsumerStatefulWidget {
  const ParallaxPreviewScreen({
    super.key,
    this.sceneId,
    this.personalize = false,
  });

  final String? sceneId;
  final bool personalize;

  @override
  ConsumerState<ParallaxPreviewScreen> createState() =>
      _ParallaxPreviewScreenState();
}

class _ParallaxPreviewScreenState extends ConsumerState<ParallaxPreviewScreen>
    with SingleTickerProviderStateMixin, WidgetsBindingObserver {
  late final Ticker _ticker;
  final _tilt = ParallaxTilt();

  List<ParallaxScene> _scenes = const [];
  int _sceneIdx = 0;

  // Spring integrators per layer — bg heavy, fg crisp, glow/shadow between.
  final _bgSx = Spring(55, 16), _bgSy = Spring(55, 16);
  final _fgSx = Spring(150, 20), _fgSy = Spring(150, 20);
  final _glSx = Spring(95, 18), _glSy = Spring(95, 18);
  final _shSx = Spring(110, 19), _shSy = Spring(110, 19);
  final _whSx = Spring(90, 18), _whSy = Spring(90, 18);

  Offset _bgT = Offset.zero, _glowT = Offset.zero;
  Offset _fgT = Offset.zero, _shadowT = Offset.zero;
  double _bgScale = 1.14, _fgScale = 1.05;

  double _startMs = 0, _lastFrameMs = 0;
  bool _sheetOpen = false;

  bool _applying = false;
  bool _appliedOk = false;
  String? _applyError;

  String _personalName = '';
  PersonalVerse _personalVerse = kPersonalVerses.first;

  Offset? _swipeStart;

  ParallaxScene? get _scene =>
      _scenes.isEmpty ? null : _scenes[_sceneIdx.clamp(0, _scenes.length - 1)];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _ticker = createTicker(_tick);
    PersonalCross.revision.addListener(_syncPersonal);
    _syncPersonal();
    _load();
  }

  Future<void> _load() async {
    final scenes = await ParallaxScenes.load();
    if (!mounted) return;
    final idx = widget.sceneId == null
        ? -1
        : scenes.indexWhere((s) => s.id == widget.sceneId);
    setState(() {
      _scenes = scenes;
      _sceneIdx = idx >= 0 ? idx : 0;
    });
    _tilt.start();
    _ticker.start();
    // `?personalize=1` — auto-open the engraving sheet.
    if (widget.personalize) {
      WidgetsBinding.instance.addPostFrameCallback((_) => _openSheet());
    }
  }

  void _syncPersonal() {
    setState(() {
      _personalName = PersonalCross.name();
      _personalVerse = PersonalCross.verse();
    });
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _tilt.start();
      if (!_ticker.isActive && !_sheetOpen) _ticker.start();
    } else {
      _tilt.stop();
      if (_ticker.isActive) _ticker.stop();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    PersonalCross.revision.removeListener(_syncPersonal);
    _ticker.dispose();
    _tilt.dispose();
    super.dispose();
  }

  void _tick(Duration elapsed) {
    final scene = _scene;
    if (scene == null) return;
    final now = elapsed.inMicroseconds / 1000.0;
    if (_startMs == 0) {
      _startMs = now;
      _lastFrameMs = now;
    }
    final dt = math.max(0.001, (now - _lastFrameMs) / 1000);
    _lastFrameMs = now;
    _tilt.step();
    final tSec = (now - _startMs) / 1000;
    final driftX = math.sin(tSec * 0.35) * 0.18;
    final driftY = math.sin(tSec * 0.28 + 1.2) * 0.12;
    final targetX = _tilt.current.dx + driftX;
    final targetY = _tilt.current.dy + driftY;

    if (scene.wholeMove) {
      final wx = _whSx.step(targetX, dt);
      final wy = _whSy.step(targetY, dt);
      // Strong sideways motion, tiny vertical crop so tall lock screens
      // never cut the artwork.
      final px = wx * 46, py = wy * 12;
      _bgT = Offset(px, py);
      _glowT = Offset(px, py);
      _fgT = Offset(px, py);
      _shadowT = Offset(px, py * 0.7);
      _bgScale = 1.025;
      _fgScale = 1.015;
    } else {
      final bx = _bgSx.step(targetX, dt), by = _bgSy.step(targetY, dt);
      final gx = _glSx.step(targetX, dt), gy = _glSy.step(targetY, dt);
      final fx = _fgSx.step(targetX, dt), fy = _fgSy.step(targetY, dt);
      final sx = _shSx.step(targetX, dt), sy = _shSy.step(targetY, dt);
      _bgT = Offset(bx * 14, by * 14);
      _glowT = Offset(gx * 23, gy * 23);
      _fgT = Offset(fx * 42, fy * 42);
      _shadowT = Offset(sx * 34, sy * 26);
      _bgScale = 1.14;
      _fgScale = 1.05;
    }
    setState(() {});
  }

  void _track(String event, [Map<String, Object?> props = const {}]) {
    final scene = _scene;
    Analytics.capture(event, {'scene_id': scene?.id, ...props});
  }

  Future<void> _openSheet() async {
    final scene = _scene;
    if (scene == null) return;
    setState(() => _sheetOpen = true);
    if (_ticker.isActive) _ticker.stop();
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: hsl(0, 0, 0, 0.7),
      builder: (_) => const PersonalizeCrossSheet(),
    );
    if (!mounted) return;
    setState(() => _sheetOpen = false);
    _syncPersonal();
    if (!_ticker.isActive) _ticker.start();
  }

  Future<void> _handleApply() async {
    final scene = _scene;
    if (scene == null || _applying) return;
    final isPremium = ref.read(premiumProvider);
    _track('parallax_apply_tapped', {'is_premium': isPremium});
    if (!isPremium) {
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        backgroundColor: Colors.transparent,
        builder: (ctx) => PremiumSheet(
          trigger: 'parallax_preview',
          onClose: () => Navigator.of(ctx).maybePop(),
          onUnlock: () {
            ref.read(premiumProvider.notifier).setUnlocked();
            Navigator.of(ctx).maybePop();
          },
        ),
      );
      return;
    }
    setState(() {
      _applyError = null;
      _appliedOk = false;
      _applying = true;
    });
    try {
      final res = await ParallaxWallpaper.apply(scene);
      if (!mounted) return;
      if (res.applied) {
        setState(() => _appliedOk = true);
        _track('parallax_applied');
        Analytics.capture('wallpaper_applied', {
          'wallpaper_id': scene.id,
          'type': 'parallax',
        });
        // Happy moment → rating ask, same 3.5s delay as
        // `live-wallpaper-apply.ts` uses after a live wallpaper is set.
        Future.delayed(
          const Duration(milliseconds: 3500),
          RatingService.maybeRequestRating,
        );
      } else {
        _track('parallax_apply_unconfirmed');
        setState(() => _applyError = t('wp.parallax.errorConfirm'));
      }
    } catch (e) {
      _track('parallax_apply_failed', {'message': e.toString()});
      if (mounted) {
        setState(() => _applyError = t('wp.parallax.errorFailed'));
      }
    } finally {
      if (mounted) setState(() => _applying = false);
      Future.delayed(const Duration(milliseconds: 2400), () {
        if (mounted) setState(() => _appliedOk = false);
      });
    }
  }

  void _goToScene(int nextIdx) {
    if (nextIdx < 0 || nextIdx >= _scenes.length || nextIdx == _sceneIdx)
      return;
    setState(() => _sceneIdx = nextIdx);
    _bgSx.reset();
    _bgSy.reset();
    _fgSx.reset();
    _fgSy.reset();
    haptic(HapticStyle.soft);
  }

  void _onSwipeEnd(Offset end) {
    final s = _swipeStart;
    _swipeStart = null;
    if (s == null) return;
    final dx = end.dx - s.dx;
    final dy = end.dy - s.dy;
    if (dx.abs() < 60 || dx.abs() < dy.abs() * 1.2) return;
    _goToScene(dx < 0 ? _sceneIdx + 1 : _sceneIdx - 1);
  }

  @override
  Widget build(BuildContext context) {
    final scene = _scene;
    final topPad = math.max(MediaQuery.of(context).padding.top, 16.0);
    final bottomPad = math.max(MediaQuery.of(context).padding.bottom, 16.0);
    final hasPersonalized = _personalName.isNotEmpty;
    final hasPrev = _sceneIdx > 0;
    final hasNext = _sceneIdx < _scenes.length - 1;

    return Scaffold(
      backgroundColor: Colors.black,
      body: Listener(
        onPointerDown: (e) => _swipeStart = e.position,
        onPointerUp: (e) => _onSwipeEnd(e.position),
        onPointerCancel: (_) => _swipeStart = null,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (scene != null) ..._stage(scene),

            // Bottom scrim
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              height: 240,
              child: IgnorePointer(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                      colors: [
                        hsl(0, 0, 0, 0.9),
                        hsl(0, 0, 0, 0.4),
                        Colors.transparent,
                      ],
                      stops: const [0, 0.5, 1],
                    ),
                  ),
                ),
              ),
            ),

            // Engraving — mirrors the native lock-screen layout.
            if (hasPersonalized)
              Positioned(
                left: 0,
                right: 0,
                bottom: 210,
                child: IgnorePointer(
                  child: EngravedOverlay(
                    name: _personalName,
                    verse: _personalVerse,
                  ),
                ),
              ),

            // Back
            Positioned(
              top: topPad,
              left: 16,
              child: TapScale(
                onTap: () => Navigator.of(context).maybePop(),
                child: Container(
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: hsl(0, 0, 0, 0.4),
                  ),
                  child: const Icon(
                    Icons.arrow_back,
                    size: 20,
                    color: Colors.white,
                  ),
                ),
              ),
            ),

            // Personalize / Edit glass pill
            Positioned(
              top: topPad,
              right: 16,
              child: TapScale(
                scale: 0.96,
                onTap: _openSheet,
                child: Container(
                  height: 40,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(999),
                    color: hsl(0, 0, 100, 0.14),
                    border: Border.all(color: hsl(0, 0, 100, 0.22)),
                    boxShadow: [
                      BoxShadow(
                        color: hsl(0, 0, 0, 0.5),
                        blurRadius: 24,
                        spreadRadius: -8,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.edit, size: 14, color: Colors.white),
                      const SizedBox(width: 6),
                      Text(
                        hasPersonalized
                            ? t('wp.parallax.edit')
                            : t('wp.parallax.personalize'),
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          letterSpacing: -0.12,
                          color: Colors.white,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

            // Prev cue
            if (hasPrev)
              Positioned(
                left: 12,
                top: 0,
                bottom: 0,
                child: Center(
                  child: TapScale(
                    scale: 0.95,
                    onTap: () => _goToScene(_sceneIdx - 1),
                    child: Container(
                      height: 40,
                      padding: const EdgeInsets.symmetric(horizontal: 10),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: hsl(0, 0, 0, 0.55),
                        border: Border.all(color: hsl(42, 70, 65, 0.35)),
                        boxShadow: [
                          BoxShadow(
                            color: hsl(0, 0, 0, 0.6),
                            blurRadius: 22,
                            spreadRadius: -8,
                            offset: const Offset(0, 8),
                          ),
                        ],
                      ),
                      child: const Icon(
                        Icons.chevron_left,
                        size: 18,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ),

            // Next cue (nudge + arrow pulse)
            if (hasNext)
              Positioned(
                right: 12,
                top: 0,
                bottom: 0,
                child: Center(
                  child: _NextCue(onTap: () => _goToScene(_sceneIdx + 1)),
                ),
              ),

            // Bottom controls
            Positioned(
              left: 0,
              right: 0,
              bottom: bottomPad,
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_scenes.length > 1)
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          for (var i = 0; i < _scenes.length; i++)
                            Padding(
                              padding: const EdgeInsets.symmetric(
                                horizontal: 4,
                              ),
                              child: GestureDetector(
                                onTap: () => _goToScene(i),
                                child: AnimatedContainer(
                                  duration: const Duration(milliseconds: 250),
                                  width: i == _sceneIdx ? 22 : 7,
                                  height: 6,
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(999),
                                    gradient: i == _sceneIdx
                                        ? LinearGradient(
                                            colors: [
                                              hsl(42, 90, 65),
                                              hsl(38, 88, 50),
                                            ],
                                          )
                                        : null,
                                    color: i == _sceneIdx
                                        ? null
                                        : hsl(0, 0, 100, 0.28),
                                    boxShadow: i == _sceneIdx
                                        ? [
                                            BoxShadow(
                                              color: hsl(42, 85, 55, 0.7),
                                              blurRadius: 10,
                                            ),
                                          ]
                                        : null,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 6,
                      ),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(999),
                        color: hsl(0, 0, 0, 0.5),
                      ),
                      child: Text(
                        _scenes.length > 1
                            ? t('wp.parallax.instructions', {
                                'name': scene?.localizedName ?? '',
                              })
                            : t('wp.parallax.tilt'),
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.4,
                          color: hsl(0, 0, 100, 0.9),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: 384),
                      child: TapScale(
                        scale: 0.985,
                        onTap: _handleApply,
                        child: Opacity(
                          opacity: _applying ? 0.85 : 1,
                          child: Container(
                            height: 48,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(16),
                              gradient: LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: _appliedOk
                                    ? [hsl(140, 60, 45), hsl(150, 65, 40)]
                                    : [hsl(42, 78, 52), hsl(38, 80, 42)],
                              ),
                              boxShadow: [
                                BoxShadow(
                                  color: _appliedOk
                                      ? hsl(150, 65, 40, 0.6)
                                      : gold.withValues(alpha: 0.6),
                                  blurRadius: 22,
                                  spreadRadius: -6,
                                  offset: const Offset(0, 10),
                                ),
                              ],
                            ),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                if (_applying)
                                  SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(
                                      strokeWidth: 2,
                                      valueColor: AlwaysStoppedAnimation(ink),
                                    ),
                                  )
                                else
                                  Icon(
                                    _appliedOk
                                        ? Icons.check_circle
                                        : ParallaxWallpaper.isSupported
                                        ? Icons.workspace_premium
                                        : Icons.smartphone,
                                    size: 16,
                                    color: ink,
                                  ),
                                const SizedBox(width: 8),
                                Text(
                                  _applying
                                      ? t('px.preparing')
                                      : _appliedOk
                                      ? t('px.applied')
                                      : ParallaxWallpaper.isSupported
                                      ? t('px.setWallpaper')
                                      : t('px.openAndroidApp'),
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 0.28,
                                    color: ink,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    if (_applyError != null)
                      Padding(
                        padding: const EdgeInsets.only(top: 8),
                        child: Text(
                          _applyError!,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: 11,
                            color: hsl(0, 80, 82, 0.9),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// The parallax stage: background, contact shadow and cut-out foreground.
  List<Widget> _stage(ParallaxScene scene) {
    final inset = scene.wholeMove ? 16.0 : 36.0;
    return [
      Positioned(
        left: -inset,
        right: -inset,
        top: -inset,
        bottom: -inset,
        child: Transform.translate(
          offset: _bgT,
          child: Transform.scale(
            scale: _bgScale,
            child: CachedNetworkImage(
              imageUrl: scene.bg,
              fit: BoxFit.cover,
              fadeInDuration: const Duration(milliseconds: 200),
              placeholder: (_, __) => const ColoredBox(color: Colors.black),
              errorWidget: (_, __, ___) =>
                  const ColoredBox(color: Colors.black),
            ),
          ),
        ),
      ),
      if (!scene.wholeMove) ...[
        // Contact shadow under the figure.
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          top: 0,
          child: IgnorePointer(
            child: LayoutBuilder(
              builder: (context, c) => Stack(
                children: [
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: c.maxHeight * 0.06,
                    height: 60,
                    child: Transform.translate(
                      offset: _shadowT,
                      child: Center(
                        child: FractionallySizedBox(
                          widthFactor: 0.55,
                          child: DecoratedBox(
                            decoration: BoxDecoration(
                              gradient: RadialGradient(
                                colors: [
                                  hsl(0, 0, 0, 0.55),
                                  Colors.transparent,
                                ],
                                stops: const [0, 0.7],
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        // Foreground cut-out with the soft bottom fade.
        Positioned.fill(
          child: IgnorePointer(
            child: LayoutBuilder(
              builder: (context, c) {
                final h = c.maxHeight * (scene.fgHeight / 100);
                final bust = scene.variant == 'bust';
                return Stack(
                  children: [
                    Positioned(
                      left: 0,
                      right: 0,
                      bottom: bust ? 0 : c.maxHeight * 0.01,
                      height: h,
                      child: Transform.translate(
                        offset: _fgT,
                        child: Transform.scale(
                          scale: _fgScale,
                          child: Center(
                            child: AspectRatio(
                              aspectRatio: 832 / 1472,
                              child: ShaderMask(
                                blendMode: BlendMode.dstIn,
                                shaderCallback: (rect) => LinearGradient(
                                  begin: Alignment.topCenter,
                                  end: Alignment.bottomCenter,
                                  colors: const [
                                    Colors.white,
                                    Colors.white,
                                    Colors.transparent,
                                  ],
                                  stops: [0, bust ? 0.78 : 0.88, 1],
                                ).createShader(rect),
                                child: CachedNetworkImage(
                                  imageUrl: scene.fgFor(),
                                  fit: BoxFit.contain,
                                  fadeInDuration: const Duration(
                                    milliseconds: 220,
                                  ),
                                  placeholder: (_, __) => const SizedBox(),
                                  errorWidget: (_, __, ___) => const SizedBox(),
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ],
    ];
  }
}

/// Right-edge "Swipe ›" cue — 1800ms nudge with the 900ms arrow pulse.
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
        final nudge = math.sin(_c.value * math.pi * 2) * -2 - 2;
        final arrow = math.sin(_c.value * math.pi * 4) * 2 + 2;
        return Transform.translate(
          offset: Offset(nudge, 0),
          child: TapScale(
            scale: 0.95,
            onTap: widget.onTap,
            child: Container(
              height: 40,
              padding: const EdgeInsets.symmetric(horizontal: 12),
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(999),
                color: hsl(0, 0, 0, 0.58),
                border: Border.all(color: hsl(42, 70, 65, 0.42)),
                boxShadow: [
                  BoxShadow(
                    color: hsl(0, 0, 0, 0.65),
                    blurRadius: 22,
                    spreadRadius: -8,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Text(
                    t('wp.parallax.swipe'),
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.55,
                      color: hsl(0, 0, 100, 0.95),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Transform.translate(
                    offset: Offset(arrow, 0),
                    child: const Icon(
                      Icons.chevron_right,
                      size: 18,
                      color: Colors.white,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
