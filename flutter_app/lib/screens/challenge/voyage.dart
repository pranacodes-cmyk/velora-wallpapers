import 'dart:async';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';

import '../../core/services/prefs.dart';
import '../../core/theme/app_colors.dart';
import 'journey_avatar.dart';

/// 75 Days of Light — a wide daytime mountain path with five milestones,
/// measured on the artwork (normalized 0–1) and the lamb placed on it
/// by progress. Web mirror: `src/components/challenge/voyage.ts` +
/// `VoyagePoster.tsx` (same anchors, curves, sizes and timings).

const kVoyageDayArt = 'assets/images/challenge/dawn-path.jpg';
const kLambArt = 'assets/images/challenge/lamb3d-stand.png';

/// Walk cycle: step, stand, other step, stand (same framing, feet aligned).
const kLambWalk = <String>[
  'assets/images/challenge/lamb3d-walk-a.png',
  kLambArt,
  'assets/images/challenge/lamb3d-walk-b.png',
  kLambArt,
];
const int kLambStepMs = 140;

const double kVoyageAspect = 1920 / 800;
const double kLambAspect = 367 / 559;
const kIslandDays = <int>[15, 30, 45, 60, 75];
const int kVoyageDays = 75;

/// Poster-only colours: the art is always photographic, so its ink, scrim
/// and gold are fixed in both themes (web: --poster-ink / --poster-scrim /
/// --voyage-gold / --paywall-cta-foreground).
class VoyageInk {
  const VoyageInk._();
  static const ink = Color(0xFFFFFFFF);
  static const scrim = Color(0xFF0A101F); // hsl(222 50% 8%)
  static const gold = Color(0xFFF6BB31); // hsl(42 92% 58%)
  static const onGold = Color(0xFF0F141F); // hsl(222 35% 9%)
}

typedef _Pt = (double, double);

/// Measured centerline of the cinematic stone road (identical to web).
const List<_Pt> _anchors = [
  (0.2188, 0.8900), (0.3334, 0.7925), (0.4219, 0.7606), (0.5209, 0.7450), (0.6145, 0.7288), (0.6979, 0.7006), (0.7688, 0.6613), (0.7752, 0.6213), (0.7148, 0.5862), (0.6594, 0.5556), (0.6672, 0.5344), (0.7291, 0.5119), (0.7974, 0.4644), (0.8117, 0.4163), (0.7742, 0.3819), (0.7620, 0.3494), (0.7875, 0.3100),
];
const List<_Pt> _controls = [
  (0.2917, 0.8150), (0.3750, 0.7700), (0.4688, 0.7512), (0.5729, 0.7388), (0.6562, 0.7188), (0.7396, 0.6825), (0.7979, 0.6400), (0.7526, 0.6025), (0.6771, 0.5700), (0.6417, 0.5413), (0.6927, 0.5275), (0.7656, 0.4963), (0.8292, 0.4325), (0.7943, 0.4000), (0.7542, 0.3638), (0.7698, 0.3350),
];
const _Pt _cross = (0.787, 0.2);

double _clamp(double v, double lo, double hi) => math.min(hi, math.max(lo, v));

/// Walk pace: soft start and stop, steady stride in between (web: `ease`).
double _walkEase(double t) {
  const a = 0.18;
  if (t < a) return t * t / (2 * a * (1 - a));
  if (t > 1 - a) return 1 - (1 - t) * (1 - t) / (2 * a * (1 - a));
  return (t - a / 2) / (1 - a);
}

_Pt _quad(_Pt p0, _Pt c, _Pt p1, double t) {
  final u = 1 - t;
  return (
    u * u * p0.$1 + 2 * u * t * c.$1 + t * t * p1.$1,
    u * u * p0.$2 + 2 * u * t * c.$2 + t * t * p1.$2,
  );
}

class VoyagePoint {
  const VoyagePoint(this.x, this.y, this.size, this.facing);
  final double x;
  final double y;

  /// Lamb width as a fraction of the artwork width.
  final double size;
  final double facing;
}

/// Lamb width (fraction of artwork width) at a road height: smaller further away.
const List<_Pt> _sizeByY = [(0.31, 0.02), (0.40, 0.024), (0.52, 0.03), (0.58, 0.034), (0.74, 0.046), (0.89, 0.078)];
double _sizeAt(double y) {
  const t = _sizeByY;
  if (y <= t[0].$1) return t[0].$2;
  for (var i = 1; i < t.length; i++) {
    if (y <= t[i].$1) return t[i - 1].$2 + (y - t[i - 1].$1) / (t[i].$1 - t[i - 1].$1) * (t[i].$2 - t[i - 1].$2);
  }
  return t.last.$2;
}

/// Every day is the same distance "in the world": screen length divided by
/// the lamb's perspective size, so steps shrink naturally uphill (web: same table).
const int _kSamples = 24;
final ({List<double> start, List<List<double>> table}) _legs = () {
  var total = 0.0;
  final start = <double>[];
  final raw = <List<double>>[];
  for (var leg = 0; leg < _controls.length; leg++) {
    start.add(total);
    final row = <double>[total];
    var prev = _anchors[leg];
    for (var i = 1; i <= _kSamples; i++) {
      final p = _quad(_anchors[leg], _controls[leg], _anchors[leg + 1], i / _kSamples);
      final dx = (p.$1 - prev.$1) * kVoyageAspect, dy = p.$2 - prev.$2;
      total += math.sqrt(dx * dx + dy * dy) / _sizeAt((p.$2 + prev.$2) / 2);
      row.add(total);
      prev = p;
    }
    raw.add(row);
  }
  start.add(total);
  return (
    start: [for (final v in start) v / total * kVoyageDays],
    table: [for (final row in raw) [for (final v in row) v / total * kVoyageDays]],
  );
}();

({int leg, double t}) _legOf(double days) {
  final d = _clamp(days, 0, kVoyageDays.toDouble());
  final start = _legs.start;
  var leg = 0;
  while (leg < _controls.length - 1 && d > start[leg + 1]) {
    leg++;
  }
  final row = _legs.table[leg];
  var i = 0;
  while (i < _kSamples - 1 && d > row[i + 1]) {
    i++;
  }
  final span = row[i + 1] - row[i];
  final f = span > 0 ? _clamp((d - row[i]) / span, 0, 1) : 0.0;
  return (leg: leg, t: (i + f) / _kSamples);
}

/// Lamb position for a (fractional) number of completed days.
VoyagePoint voyagePoint(double days) {
  final (:leg, :t) = _legOf(days);
  final p = _quad(_anchors[leg], _controls[leg], _anchors[leg + 1], t);
  final dx = (1 - t) * (_controls[leg].$1 - _anchors[leg].$1) + t * (_anchors[leg + 1].$1 - _controls[leg].$1);
  return VoyagePoint(p.$1, p.$2, _sizeAt(p.$2), dx < 0 ? -1 : 1);
}

Offset islandPoint(int index) {
  final p = voyagePoint(kIslandDays[index.clamp(0, 4)].toDouble());
  return Offset(p.x, p.y);
}

/// Where each island's day label sits relative to its marker. The route climbs
/// straight into island 30 from below, so its label sits to the left instead.
/// Web: `LABEL_SIDE` / `labelBox` / `shipBox` in `voyage.ts`.
const _kLabelLeft = <bool>[false, true, false, false, false];
const double _kLabelW = 28;
const double _kLabelH = 18;
const double _kLabelGap = 11;

/// Label pill box in artwork pixels.
Rect labelBox(int index, Size art) {
  final p = islandPoint(index);
  final cx = p.dx * art.width, cy = p.dy * art.height;
  if (_kLabelLeft[index]) {
    return Rect.fromLTRB(cx - _kLabelGap - _kLabelW, cy - _kLabelH / 2, cx - _kLabelGap, cy + _kLabelH / 2);
  }
  final t = cy + (index < 2 ? 12 : 9);
  return Rect.fromLTRB(cx - _kLabelW / 2, t, cx + _kLabelW / 2, t + _kLabelH);
}

/// Visible lamb body (transparent margins trimmed), artwork pixels.
Rect lambBox(double days, Size art) {
  final s = voyagePoint(days);
  final sw = s.size * art.width, sh = sw / kLambAspect;
  final x = s.x * art.width, y = s.y * art.height;
  return Rect.fromLTRB(x - 0.5 * sw, y - 0.985 * sh, x + 0.5 * sw, y + 0.015 * sh);
}

/// True while the lamb covers a milestone label — that label fades out.
bool labelHidden(int index, double days, Size art) => labelBox(index, art).overlaps(lambBox(days, art));

/// Route between two (fractional) day counts, in [size] pixel space.
Path voyagePath(double from, double to, Size size) {
  final a = _clamp(math.min(from, to), 0, kVoyageDays.toDouble());
  final b = _clamp(math.max(from, to), 0, kVoyageDays.toDouble());
  final path = Path();
  if (b - a < 0.001) return path;
  var first = true;
  for (var leg = 0; leg < _controls.length; leg++) {
    final s = _legs.start[leg], e = _legs.start[leg + 1];
    if (b <= s || a >= e) continue;
    final t0 = a <= s ? 0.0 : _legOf(a).t;
    final t1 = b >= e ? 1.0 : _legOf(b).t;
    final p0 = _anchors[leg], c = _controls[leg], p1 = _anchors[leg + 1];
    final pa = _quad(p0, c, p1, t0);
    final pb = _quad(p0, c, p1, t1);
    // Control of the [t0,t1] slice: B(t0) + (t1 - t0) * B'(t0) / 2
    final dx = (1 - t0) * (c.$1 - p0.$1) + t0 * (p1.$1 - c.$1);
    final dy = (1 - t0) * (c.$2 - p0.$2) + t0 * (p1.$2 - c.$2);
    final q = (pa.$1 + (t1 - t0) * dx, pa.$2 + (t1 - t0) * dy);
    if (first) path.moveTo(pa.$1 * size.width, pa.$2 * size.height);
    path.quadraticBezierTo(q.$1 * size.width, q.$2 * size.height, pb.$1 * size.width, pb.$2 * size.height);
    first = false;
  }
  return path;
}

/// Next island the ship is heading for, or null once at the cross.
({int index, int day})? nextIsland(int completed) {
  for (var i = 0; i < kIslandDays.length; i++) {
    if (completed < kIslandDays[i]) return (index: i, day: kIslandDays[i]);
  }
  return null;
}

/* ── "last seen" position so the ship visibly sails forward on return ── */

const _kSeenKey = 'prayly_voyage_seen_v1';

int? getVoyageSeen() {
  final raw = Prefs.getString(_kSeenKey);
  if (raw == null) return null;
  return int.tryParse(raw) ?? double.tryParse(raw)?.round();
}

void setVoyageSeen(int days) => Prefs.setString(_kSeenKey, '$days');

/// Visible window of the artwork (normalized 0–1).
class VoyageCrop {
  const VoyageCrop(this.x0, this.y0, this.x1, this.y1);
  static const full = VoyageCrop(0, 0, 1, 1);

  /// Framed on the road and the Cross so the lamb stays readable on phones.
  static const road = VoyageCrop(0.16, 0.1, 0.88, 1);
  final double x0;
  final double y0;
  final double x1;
  final double y1;
  double get aspect => (x1 - x0) * kVoyageAspect / (y1 - y0);
}

/// Wide daytime pilgrimage artwork with an away-facing lamb in every theme.
class VoyagePoster extends StatefulWidget {
  const VoyagePoster({
    super.key,
    required this.days,
    this.fromDays,
    this.crop = VoyageCrop.road,
    this.labels = false,
    this.showRoute = false,
    this.night = false,
    this.semanticLabel,
    this.sailDelay = const Duration(milliseconds: 450),
    this.sailDuration = const Duration(milliseconds: 2600),
    this.onArrive,
    this.overlay = const [],
    this.buddies = const [],
  });

  /// Friends on the same road — smaller lambs with their avatar (web: `buddies`).
  final List<({String id, int days, String avatar})> buddies;

  /// Completed days (0–75); the lamb stands here.
  final int days;

  /// When set (and lower than [days]) the lamb walks from here to [days].
  final int? fromDays;
  final VoyageCrop crop;
  final bool labels;
  final bool showRoute;
  final bool night;
  final String? semanticLabel;
  final Duration sailDelay;
  final Duration sailDuration;
  final VoidCallback? onArrive;

  /// Widgets layered over the visible window (scrims, titles, chips).
  final List<Widget> overlay;

  @override
  State<VoyagePoster> createState() => _VoyagePosterState();
}

class _VoyagePosterState extends State<VoyagePoster> with TickerProviderStateMixin {
  late final AnimationController _ambient =
      AnimationController(vsync: this, duration: const Duration(milliseconds: 4800));
  late final AnimationController _sail =
      AnimationController(vsync: this, duration: widget.sailDuration);
  double _start = 0;
  double _target = 0;
  bool _reduced = false;
  bool _started = false;
  Timer? _sailTimer;

  /// A real sail is under way; only its completion counts as an arrival.
  bool _sailing = false;

  @override
  void initState() {
    super.initState();
    _target = _clampDays(widget.days);
    _start = _target;
    _sail.addStatusListener((s) {
      if (s != AnimationStatus.completed || !_sailing) return;
      _sailing = false;
      if (!mounted) return;
      setState(() {});
      widget.onArrive?.call();
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduced = MediaQuery.maybeDisableAnimationsOf(context) ?? false;
    if (_reduced) {
      _ambient.stop();
    } else if (!_ambient.isAnimating) {
      _ambient.repeat();
    }
    if (!_started) {
      _started = true;
      _maybeSail(widget.fromDays);
    }
  }

  @override
  void didUpdateWidget(VoyagePoster old) {
    super.didUpdateWidget(old);
    if (old.days != widget.days || old.fromDays != widget.fromDays) {
      _target = _clampDays(widget.days);
      _start = _target;
      _sail.stop();
      _sail.value = 0;
      _maybeSail(widget.fromDays);
    }
  }

  double _clampDays(int d) => _clamp(d.toDouble(), 0, kVoyageDays.toDouble());

  void _maybeSail(int? from) {
    _sailTimer?.cancel();
    _sailing = false;
    final wants = from != null && from < widget.days;
    if (!wants || _reduced) {
      _start = _target;
      _sail.value = 1;
      // Reduced motion skips the sail, but the arrival still happened
      // (web: VoyagePoster calls onArrive straight away).
      if (wants) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) widget.onArrive?.call();
        });
      }
      return;
    }
    _start = _clampDays(from);
    _sail.value = 0;
    _sailing = true;
    _sailTimer = Timer(widget.sailDelay, () {
      if (mounted && _sailing) _sail.forward(from: 0);
    });
  }

  @override
  void dispose() {
    _sailTimer?.cancel();
    _ambient.dispose();
    _sail.dispose();
    super.dispose();
  }

  double get _shown => _start + (_target - _start) * _walkEase(_sail.value);

  @override
  Widget build(BuildContext context) {
    final crop = widget.crop;
    final cw = crop.x1 - crop.x0;
    return Semantics(
      image: true,
      label: widget.semanticLabel,
      child: AspectRatio(
        aspectRatio: crop.aspect,
        child: LayoutBuilder(builder: (context, box) {
          final w = box.maxWidth / cw;
          final h = w / kVoyageAspect;
          return ClipRect(
            child: Stack(
              clipBehavior: Clip.hardEdge,
              children: [
                Positioned(
                  left: -crop.x0 * w,
                  top: -crop.y0 * h,
                  width: w,
                  height: h,
                  child: ExcludeSemantics(
                    child: AnimatedBuilder(
                      animation: Listenable.merge([_ambient, _sail]),
                      builder: (context, _) => _art(Size(w, h)),
                    ),
                  ),
                ),
                ...widget.overlay,
              ],
            ),
          );
        }),
      ),
    );
  }

  Widget _buddyLamb(({String id, int days, String avatar}) b, Size size) {
    final p = voyagePoint(b.days.clamp(0, kVoyageDays).toDouble());
    final w = p.size * 0.82 * size.width;
    final h = w / kLambAspect;
    final av = math.max(16.0, w * 0.78);
    return Positioned(
      left: p.x * size.width - w / 2,
      top: p.y * size.height - h * 0.985,
      width: w,
      height: h,
      child: Stack(clipBehavior: Clip.none, children: [
        Positioned.fill(child: Transform.flip(
          flipX: p.facing < 0,
          child: Opacity(opacity: 0.9, child: Image.asset(kLambArt, fit: BoxFit.contain, gaplessPlayback: true)),
        )),
        Positioned(
          left: (w - av) / 2,
          top: -av * 1.05,
          width: av,
          height: av,
          child: Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: AppColors.card,
              border: Border.all(color: AppColors.primary, width: 2),
              boxShadow: [BoxShadow(color: AppColors.background.withValues(alpha: 0.5), blurRadius: 6, offset: const Offset(0, 2))],
            ),
            child: ClipOval(child: JourneyAvatar(avatar: b.avatar, size: av)),
          ),
        ),
      ]),
    );
  }

  Widget _art(Size size) {
    final shown = _shown;
    final reached = (shown + 0.001).floor();
    final next = nextIsland(reached);
    final done = reached >= kVoyageDays;
    final lamb = voyagePoint(shown);
    final a = _reduced ? 0.0 : _ambient.value;
    final sailing = _sail.isAnimating;
    final bob = math.sin(a * 2 * math.pi); // one 4.8s swell
    final pulse = (a * 2) % 1; // 2.4s ring
    final lambW = lamb.size * size.width;
    final lambH = lambW / kLambAspect;
    // Calm breath while standing; four-pose stride with a light step bounce.
    final breath = 0.5 + 0.5 * bob;
    final walkedMs = _sail.value * widget.sailDuration.inMilliseconds;
    final lambFrame = sailing ? kLambWalk[(walkedMs / kLambStepMs).floor() % kLambWalk.length] : kLambArt;
    final stepBob = math.sin(walkedMs / (kLambStepMs * 2) * math.pi).abs();

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Positioned.fill(
          child: Image.asset(
            kVoyageDayArt,
            fit: BoxFit.cover,
            gaplessPlayback: true,
            filterQuality: FilterQuality.medium,
          ),
        ),
        if (done)
          Positioned(
            left: _cross.$1 * size.width - size.width * 0.15,
            top: _cross.$2 * size.height - size.height * 0.19,
            width: size.width * 0.30,
            height: size.height * 0.38,
            child: Opacity(
              opacity: 0.75 + 0.25 * (0.5 + 0.5 * math.sin(a * 3 * math.pi)),
              child: DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [
                    VoyageInk.gold.withValues(alpha: 0.75),
                    VoyageInk.gold.withValues(alpha: 0.25),
                    VoyageInk.gold.withValues(alpha: 0),
                  ], stops: const [0, 0.45, 1]),
                ),
              ),
            ),
          ),
        if (widget.showRoute) Positioned.fill(
          child: CustomPaint(
            painter: _RoutePainter(shown: shown, reached: reached, next: next?.index, pulse: pulse, animate: !_reduced),
          ),
        ),
        if (widget.labels)
          for (var i = 0; i < kIslandDays.length; i++)
            _placedLabel(i, size, reached, labelHidden(i, shown, size)),
        // Buddies — smaller lambs on the same road, each with their avatar.
        for (final b in widget.buddies.take(6)) _buddyLamb(b, size),
        // The lamb — feet anchored on the path; real leg poses while walking.
        Positioned(
          left: lamb.x * size.width - lambW * 0.50,
          top: lamb.y * size.height - lambH * 0.985,
          width: lambW,
          height: lambH,
          child: Stack(clipBehavior: Clip.none, children: [
          // Soft contact shade under the hooves grounds the lamb (web: .voyage-lamb-contact).
          Positioned(
            left: lambW * 0.06,
            width: lambW * 0.92,
            bottom: -lambH * 0.03 - lambW * 0.46 + lambH * 0.045,
            height: lambW * 0.92,
            child: Transform.scale(
              scaleY: lambH * 0.09 / (lambW * 0.92),
              child: const DecoratedBox(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(colors: [Color(0x6B42291A), Color(0x2442291A), Color(0x0042291A)], stops: [0, 0.6, 1]),
                ),
              ),
            ),
          ),
          Positioned.fill(child: Transform.translate(
            offset: Offset(0, sailing ? -lambH * 0.016 * stepBob : 0),
            child: Transform(
              alignment: Alignment.bottomCenter,
              transform: Matrix4.diagonal3Values(
                lamb.facing * (sailing ? 1 : 1 + 0.006 * breath),
                sailing ? 1 : 1 + 0.018 * breath,
                1,
              ),
              child: Image.asset(lambFrame, fit: BoxFit.contain, gaplessPlayback: true, filterQuality: FilterQuality.medium),
            ),
          )),
          ]),
        ),
      ],
    );
  }

  /// Island label beside its marker; fades while the ship sails over it.
  Widget _placedLabel(int i, Size size, int reached, bool hidden) {
    final box = labelBox(i, size);
    final label = AnimatedOpacity(
      opacity: hidden ? 0 : 1,
      duration: _reduced ? Duration.zero : const Duration(milliseconds: 220),
      child: _IslandLabel(day: kIslandDays[i], reached: reached >= kIslandDays[i]),
    );
    // Pills size to their digits; anchor them like the web translate rules.
    return _kLabelLeft[i]
        ? Positioned(
            right: size.width - box.right,
            top: box.top,
            height: box.height,
            child: Align(alignment: Alignment.centerRight, child: label),
          )
        : Positioned(
            left: box.center.dx - 40,
            width: 80,
            top: box.top,
            child: Center(child: label),
          );
  }
}

class _IslandLabel extends StatelessWidget {
  const _IslandLabel({required this.day, required this.reached});
  final int day;
  final bool reached;

  @override
  Widget build(BuildContext context) {
    final pill = Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 1),
      decoration: BoxDecoration(
        color: reached ? VoyageInk.gold.withValues(alpha: 0.95) : VoyageInk.scrim.withValues(alpha: 0.42),
        borderRadius: BorderRadius.circular(999),
        border: reached ? null : Border.all(color: VoyageInk.ink.withValues(alpha: 0.18)),
      ),
      child: Text(
        '$day',
        textScaler: TextScaler.noScaling,
        style: TextStyle(
          fontSize: 11,
          height: 16 / 11,
          fontWeight: FontWeight.w800,
          fontFeatures: const [ui.FontFeature.tabularFigures()],
          color: reached ? VoyageInk.onGold : VoyageInk.ink,
        ),
      ),
    );
    if (reached) return pill;
    return ClipRRect(
      borderRadius: BorderRadius.circular(999),
      child: BackdropFilter(filter: ui.ImageFilter.blur(sigmaX: 6, sigmaY: 6), child: pill),
    );
  }
}

class _RoutePainter extends CustomPainter {
  _RoutePainter({required this.shown, required this.reached, required this.next, required this.pulse, required this.animate});
  final double shown;
  final int reached;
  final int? next;
  final double pulse;
  final bool animate;

  @override
  void paint(Canvas canvas, Size size) {
    // Web draws in a 1000×800 viewBox stretched to the poster.
    final s = size.width / 1000;

    // Route ahead: round dots every 13 units, with a soft shadow.
    final ahead = voyagePath(shown, kVoyageDays.toDouble(), size);
    final dotShadow = Paint()
      ..color = VoyageInk.scrim.withValues(alpha: 0.4)
      ..maskFilter = MaskFilter.blur(BlurStyle.normal, 1.2 * s + 0.4);
    final dot = Paint()..color = VoyageInk.ink.withValues(alpha: 0.9);
    final step = 13 * s;
    final r = 2.1 * s + 0.35;
    for (final m in ahead.computeMetrics()) {
      for (double d = 0; d <= m.length; d += step) {
        final tan = m.getTangentForOffset(d);
        if (tan == null) continue;
        canvas.drawCircle(tan.position + Offset(0, 1 * s + 0.3), r, dotShadow);
        canvas.drawCircle(tan.position, r, dot);
      }
    }

    // Sailed route: gold glow + dashed gold line.
    if (shown > 0.05) {
      final sailed = voyagePath(0, shown, size);
      canvas.drawPath(
        sailed,
        Paint()
          ..style = PaintingStyle.stroke
          ..strokeCap = StrokeCap.round
          ..strokeWidth = 11 * s
          ..color = VoyageInk.gold.withValues(alpha: 0.32),
      );
      final dashGlow = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 5.2 * s
        ..color = VoyageInk.gold.withValues(alpha: 0.8)
        ..maskFilter = MaskFilter.blur(BlurStyle.normal, 3 * s);
      final dash = Paint()
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeWidth = 5.2 * s
        ..color = VoyageInk.gold;
      final dashed = Path();
      for (final m in sailed.computeMetrics()) {
        for (double d = 0; d < m.length; d += 16 * s) {
          dashed.addPath(m.extractPath(d, math.min(m.length, d + 9 * s)), Offset.zero);
        }
      }
      canvas.drawPath(dashed, dashGlow);
      canvas.drawPath(dashed, dash);
    }

    // Island markers.
    for (var i = 0; i < kIslandDays.length; i++) {
      final c = Offset(islandPoint(i).dx * size.width, islandPoint(i).dy * size.height);
      final got = reached >= kIslandDays[i];
      final isNext = next == i;
      if (isNext && animate) {
        final scale = 0.55 + 0.95 * Curves.easeOut.transform(pulse);
        canvas.drawCircle(
          c,
          16 * s * scale,
          Paint()
            ..style = PaintingStyle.stroke
            ..strokeWidth = 2 * s
            ..color = VoyageInk.ink.withValues(alpha: 0.85 * (1 - pulse)),
        );
      }
      final radius = (got || isNext ? 8.5 : 6) * s;
      if (got) {
        canvas.drawCircle(c, radius + 2 * s, Paint()
          ..color = VoyageInk.gold.withValues(alpha: 0.9)
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, 4 * s));
        canvas.drawCircle(c, radius, Paint()..color = VoyageInk.gold);
        canvas.drawCircle(c, radius, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.5 * s
          ..color = VoyageInk.ink);
        final check = Path()
          ..moveTo(c.dx - 3.6 * s, c.dy + 0.2 * s)
          ..lineTo(c.dx - 1 * s, c.dy + 2.8 * s)
          ..lineTo(c.dx + 3.8 * s, c.dy - 2.4 * s);
        canvas.drawPath(check, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.2 * s
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..color = VoyageInk.onGold);
      } else if (isNext) {
        canvas.drawCircle(c, radius, Paint()..color = VoyageInk.scrim.withValues(alpha: 0.35));
        canvas.drawCircle(c, radius, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 3 * s
          ..color = VoyageInk.ink);
      } else {
        canvas.drawCircle(c, radius, Paint()..color = VoyageInk.ink.withValues(alpha: 0.92));
        canvas.drawCircle(c, radius, Paint()
          ..style = PaintingStyle.stroke
          ..strokeWidth = 1.5 * s
          ..color = VoyageInk.scrim.withValues(alpha: 0.25));
      }
    }
  }

  @override
  bool shouldRepaint(_RoutePainter old) =>
      old.shown != shown || old.reached != reached || old.next != next || (animate && old.pulse != pulse);
}

/// Legibility scrim over a poster (direct child of the poster overlay stack).
/// Top: theme background fading down over the sky; bottom: dark sea scrim.
/// Web: `.voyage-scrim-top` / `.voyage-scrim-bottom`.
class PosterScrim extends StatelessWidget {
  const PosterScrim.top({super.key, required this.heightFactor}) : bottom = false;
  const PosterScrim.bottom({super.key, required this.heightFactor}) : bottom = true;
  final double heightFactor;
  final bool bottom;

  @override
  Widget build(BuildContext context) {
    final base = bottom ? VoyageInk.scrim : AppColors.background;
    final a = bottom ? const [0.78, 0.38, 0.0] : const [0.72, 0.3, 0.0];
    return Positioned.fill(
      child: IgnorePointer(
        child: FractionallySizedBox(
          alignment: bottom ? Alignment.bottomCenter : Alignment.topCenter,
          widthFactor: 1,
          heightFactor: heightFactor,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: bottom ? Alignment.bottomCenter : Alignment.topCenter,
                end: bottom ? Alignment.topCenter : Alignment.bottomCenter,
                colors: [for (final x in a) base.withValues(alpha: x)],
                stops: const [0, 0.55, 1],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Thin gold progress bar used under posters (web: `.voyage-progress`).
class VoyageProgressBar extends StatelessWidget {
  const VoyageProgressBar({super.key, required this.value, this.height = 6, this.track});
  final double value;
  final double height;
  final Color? track;

  @override
  Widget build(BuildContext context) {
    final v = value.clamp(0.0, 1.0);
    return ClipRRect(
      borderRadius: BorderRadius.circular(height),
      child: SizedBox(
        height: height,
        child: Stack(children: [
          Positioned.fill(child: ColoredBox(color: track ?? VoyageInk.ink.withValues(alpha: 0.22))),
          FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: v == 0 ? 0.0 : math.max(0.03, v),
            heightFactor: 1,
            child: DecoratedBox(
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(height),
                gradient: LinearGradient(colors: [VoyageInk.gold, AppColors.premiumGoldGlow]),
                boxShadow: [BoxShadow(color: VoyageInk.gold.withValues(alpha: 0.7), blurRadius: 10)],
              ),
            ),
          ),
        ]),
      ),
    );
  }
}
