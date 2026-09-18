import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/widgets.dart';
import 'package:sensors_plus/sensors_plus.dart';

/// 1:1 port of `src/hooks/useParallaxTilt.ts`.
///
/// Web listens to `deviceorientation` and normalises `gamma / 20` and
/// `(beta - 45) / 20` into a -1..1 vector, then eases `current` toward that
/// target by 10% every frame. Flutter has no DeviceOrientation event, so the
/// same angles are derived from the gravity vector of the accelerometer — the
/// identical maths the parallax rail already uses.
class ParallaxTilt {
  ParallaxTilt();

  Offset _target = Offset.zero;
  Offset _current = Offset.zero;
  StreamSubscription<AccelerometerEvent>? _sub;

  /// The eased tilt vector, read inside the consumer's own frame loop.
  Offset get current => _current;

  void start() {
    _sub ??= accelerometerEventStream().listen(_onAccel);
  }

  void stop() {
    _sub?.cancel();
    _sub = null;
  }

  void dispose() => stop();

  /// Pointer fallback (web's mousemove branch): -1..1 inside the given size.
  void setFromPointer(Offset local, Size size) {
    if (size.width <= 0 || size.height <= 0) return;
    _target = Offset(
      (local.dx / size.width - 0.5) * 2,
      (local.dy / size.height - 0.5) * 2,
    );
  }

  void _onAccel(AccelerometerEvent e) {
    final gamma =
        math.atan2(e.x, math.sqrt(e.y * e.y + e.z * e.z)) * 180 / math.pi;
    final beta = math.atan2(e.y, e.z.abs() < 1e-6 ? 1e-6 : e.z) * 180 / math.pi;
    _target = Offset(
      -(gamma / 20).clamp(-1.0, 1.0),
      -((beta - 45) / 20).clamp(-1.0, 1.0),
    );
  }

  /// Web's rAF easing loop: `current += (target - current) * 0.1`.
  void step() {
    _current = Offset(
      _current.dx + (_target.dx - _current.dx) * 0.1,
      _current.dy + (_target.dy - _current.dy) * 0.1,
    );
  }
}
