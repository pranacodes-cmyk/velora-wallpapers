import 'dart:math' as math;

/// 1:1 port of `src/lib/parallaxPhysics.ts`.
///
/// OneEuro = adaptive low-pass filter for noisy sensor input.
/// Spring = semi-implicit Euler spring integrator, per layer, so the background
/// lags heavily while the foreground snaps — that is what sells the depth.
/// Both are frame-rate independent: pass the real dt (seconds) every step.
class OneEuro {
  OneEuro([this.minCutoff = 1.2, this.beta = 0.02, this.dCutoff = 1]);

  final double minCutoff;
  final double beta;
  final double dCutoff;

  double _xPrev = 0;
  double _dxPrev = 0;
  double _tPrev = 0;
  bool _inited = false;

  double _alpha(double cutoff, double dt) {
    final r = 2 * math.pi * cutoff * dt;
    return r / (r + 1);
  }

  double filter(double x, double tSec) {
    if (!_inited) {
      _inited = true;
      _tPrev = tSec;
      _xPrev = x;
      _dxPrev = 0;
      return x;
    }
    final dt = math.max(1e-3, tSec - _tPrev);
    _tPrev = tSec;
    final dx = (x - _xPrev) / dt;
    final aD = _alpha(dCutoff, dt);
    final dxHat = aD * dx + (1 - aD) * _dxPrev;
    final cutoff = minCutoff + beta * dxHat.abs();
    final a = _alpha(cutoff, dt);
    final xHat = a * x + (1 - a) * _xPrev;
    _xPrev = xHat;
    _dxPrev = dxHat;
    return xHat;
  }

  void reset() => _inited = false;
}

class Spring {
  Spring([this.stiffness = 90, this.damping = 14]);

  final double stiffness;
  final double damping;

  double pos = 0;
  double vel = 0;

  double step(double target, double dt) {
    // Cap dt so a giant frame gap can't launch the spring across the screen.
    final h = math.min(dt, 1 / 30);
    final accel = (target - pos) * stiffness - vel * damping;
    vel += accel * h;
    pos += vel * h;
    return pos;
  }

  void reset([double p = 0]) {
    pos = p;
    vel = 0;
  }
}
