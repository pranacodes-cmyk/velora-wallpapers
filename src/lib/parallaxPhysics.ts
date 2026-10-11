/**
 * Parallax physics primitives — the difference between "digital tilt" and
 * "Unity-smooth". Two tools:
 *
 * 1. OneEuro — adaptive low-pass filter for noisy sensor input. Cuts jitter
 *    when the phone is nearly still, but lets fast motion through unfiltered
 *    (so it doesn't feel laggy). https://gery.casiez.net/1euro/
 *
 * 2. Spring — critically-ish-damped spring integrator (semi-implicit Euler).
 *    Layers get their own mass/damping so bg lags heavily, fg reacts crisply,
 *    creating actual depth instead of "same motion, different multiplier".
 *
 * Both are frame-rate independent — pass real dt (seconds) each step so 60,
 * 90 and 120Hz devices feel identical.
 */

export class OneEuro {
  private minCutoff: number;
  private beta: number;
  private dCutoff: number;
  private xPrev = 0;
  private dxPrev = 0;
  private tPrev = 0;
  private inited = false;

  constructor(minCutoff = 1.2, beta = 0.02, dCutoff = 1) {
    this.minCutoff = minCutoff;
    this.beta = beta;
    this.dCutoff = dCutoff;
  }

  private alpha(cutoff: number, dt: number) {
    const r = 2 * Math.PI * cutoff * dt;
    return r / (r + 1);
  }

  filter(x: number, tSec: number) {
    if (!this.inited) {
      this.inited = true;
      this.tPrev = tSec;
      this.xPrev = x;
      this.dxPrev = 0;
      return x;
    }
    const dt = Math.max(1e-3, tSec - this.tPrev);
    this.tPrev = tSec;
    const dx = (x - this.xPrev) / dt;
    const aD = this.alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = this.alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    return xHat;
  }

  reset() {
    this.inited = false;
  }
}

export class Spring {
  pos = 0;
  vel = 0;
  stiffness: number;
  damping: number;

  constructor(stiffness = 90, damping = 14) {
    this.stiffness = stiffness;
    this.damping = damping;
  }

  step(target: number, dt: number) {
    // Cap dt to avoid a giant frame-gap (tab-switch, GC pause) launching the
    // spring across the screen. 1/30s max step keeps it stable.
    const h = Math.min(dt, 1 / 30);
    const accel = (target - this.pos) * this.stiffness - this.vel * this.damping;
    this.vel += accel * h;
    this.pos += this.vel * h;
    return this.pos;
  }

  reset(pos = 0) {
    this.pos = pos;
    this.vel = 0;
  }
}
