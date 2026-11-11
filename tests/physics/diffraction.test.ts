import { describe, expect, it } from 'vitest';
import { slitIntensity } from '../../src/physics/diffraction';

const lambda = 600e-9;
/** local maxima of I(θ) on a fine grid (θ > 0) */
function maxima(f: (t: number) => number, tmax: number, n = 200000): number[] {
  const out: number[] = [];
  const h = tmax / n;
  let a = f(0);
  let b = f(h);
  for (let i = 2; i <= n; i++) {
    const c = f(i * h);
    if (b > a && b >= c && b > 1e-6) out.push((i - 1) * h);
    a = b;
    b = c;
  }
  return out;
}
function minima(f: (t: number) => number, tmax: number, n = 200000): number[] {
  return maxima((t) => -f(t) + 2, tmax, n).filter((t) => f(t) < 1e-6);
}

describe('C.3 interference and diffraction', () => {
  it('single slit: first minimum at sinθ = λ/b (≈ λ/b for small angles)', () => {
    const b = 20e-6;
    const m = minima((t) => slitIntensity(t, lambda, b, 0, 1), 0.08);
    expect(Math.sin(m[0])).toBeCloseTo(lambda / b, 5);
    expect(Math.abs(m[0] / (lambda / b) - 1)).toBeLessThan(0.001);
  });

  it("Young's double slit: fringe spacing s = λD/d on a distant screen", () => {
    const d = 0.25e-3;
    const D = 2;
    const f = (y: number) => slitIntensity(Math.atan(y / D), lambda, 0.02e-3, d, 2);
    // dark fringes (d sinθ = (n + ½)λ) are exact zeros; the single-slit envelope shifts the bright
    // fringes very slightly, so the spacing is measured between neighbouring dark fringes
    const m = minima(f, 0.03, 300000);
    const s = m[1] - m[0];
    expect(Math.abs(s / ((lambda * D) / d) - 1)).toBeLessThan(0.001);
  });

  it('grating: principal maxima at d sinθ = nλ; they get sharper with more slits', () => {
    const d = 2e-6;
    const f = (t: number) => slitIntensity(t, lambda, 0.5e-6, d, 50);
    const peaks = maxima(f, 0.7).filter((t) => f(t) > 0.1);
    expect(Math.sin(peaks[0])).toBeCloseTo(lambda / d, 4);
    expect(Math.sin(peaks[1])).toBeCloseTo((2 * lambda) / d, 4);
    // width of the central maximum (first zero) ∝ 1/N
    const z = (N: number) => minima((t) => slitIntensity(t, lambda, 0.5e-6, d, N), 0.2)[0];
    expect(z(10) / z(50)).toBeCloseTo(5, 2);
  });
});
