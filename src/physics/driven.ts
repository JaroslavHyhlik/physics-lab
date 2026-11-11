/**
 * Driven damped oscillators  m x'' + b x' + k x = F₀ cos(ωt)  (several independent ones).
 * Integrator: RK4 (smooth, dissipative ODE). Steady state (after the transient dies away):
 *   x = A cos(ωt − δ),  A(ω) = (F₀/m) / √((ω₀² − ω²)² + (bω/m)²),  tan δ = (bω/m)/(ω₀² − ω²)
 * The amplitude peaks at ω_r = √(ω₀² − b²/2m²) (≈ ω₀ for light damping) and the
 * phase lag is π/2 exactly at ω = ω₀.
 */
import { RK4 } from '../core/integrators';

export function steadyAmplitude(m: number, k: number, b: number, F0: number, w: number): number {
  const w0sq = k / m;
  return F0 / m / Math.sqrt((w0sq - w * w) ** 2 + ((b * w) / m) ** 2);
}
export function phaseLag(m: number, k: number, b: number, w: number): number {
  return Math.atan2((b * w) / m, k / m - w * w);
}

export class DrivenOscillators {
  /** y = [x₀, v₀, x₁, v₁, …] */
  readonly y: Float64Array;
  t = 0;
  w = 1; // driving angular frequency
  F0 = 1;
  private rk: RK4;
  private f = (t: number, y: Float64Array, out: Float64Array) => {
    const F = this.F0 * Math.cos(this.w * t);
    for (let i = 0; i < this.m.length; i++) {
      out[2 * i] = y[2 * i + 1];
      out[2 * i + 1] = (F - this.b[i] * y[2 * i + 1] - this.k[i] * y[2 * i]) / this.m[i];
    }
  };
  constructor(
    readonly m: Float64Array,
    readonly k: Float64Array,
    readonly b: Float64Array,
  ) {
    this.y = new Float64Array(2 * m.length);
    this.rk = new RK4(2 * m.length);
  }
  step(dt: number): void {
    // keep each RK4 step well below the shortest period
    let wmax = this.w;
    for (let i = 0; i < this.m.length; i++) wmax = Math.max(wmax, Math.sqrt(this.k[i] / this.m[i]));
    const n = Math.max(1, Math.ceil(dt / (0.02 * (2 * Math.PI) / wmax)));
    const h = dt / n;
    for (let s = 0; s < n; s++) {
      this.rk.step(this.f, this.t, this.y, h);
      this.t += h;
    }
  }
}
