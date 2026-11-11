/**
 * Linear damped oscillator  m x'' + b x' + k x = 0  (x measured from the equilibrium position).
 * Exact closed-form solution for all three regimes (under-, critically and over-damped), so the
 * motion is exact at any time and independent of the frame rate. γ = b/2m, ω₀ = √(k/m).
 * For a vertical spring the equilibrium is lowered by mg/k; the motion about it is the same.
 */
export interface OscState {
  x: number;
  v: number;
  a: number;
}

export function dampedMotion(m: number, k: number, b: number, x0: number, v0: number, t: number): OscState {
  const w0sq = k / m;
  const g = b / (2 * m);
  let x: number;
  let v: number;
  const d = w0sq - g * g;
  const eps = 1e-12 * w0sq;
  if (d > eps) {
    const wd = Math.sqrt(d);
    const A = x0;
    const B = (v0 + g * x0) / wd;
    const e = Math.exp(-g * t);
    const c = Math.cos(wd * t);
    const s = Math.sin(wd * t);
    x = e * (A * c + B * s);
    v = e * (-g * (A * c + B * s) + wd * (-A * s + B * c));
  } else if (d < -eps) {
    const sq = Math.sqrt(-d);
    const r1 = -g + sq;
    const r2 = -g - sq;
    const C1 = (v0 - r2 * x0) / (r1 - r2);
    const C2 = x0 - C1;
    x = C1 * Math.exp(r1 * t) + C2 * Math.exp(r2 * t);
    v = r1 * C1 * Math.exp(r1 * t) + r2 * C2 * Math.exp(r2 * t);
  } else {
    const A = x0;
    const B = v0 + g * x0;
    const e = Math.exp(-g * t);
    x = (A + B * t) * e;
    v = (B - g * (A + B * t)) * e;
  }
  return { x, v, a: -w0sq * x - 2 * g * v };
}

export const period = (m: number, k: number) => 2 * Math.PI * Math.sqrt(m / k);
