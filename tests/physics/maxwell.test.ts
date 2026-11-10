import { describe, expect, it } from 'vitest';
import { maxwell, maxwellCdf, vMostProbable, vMean, vRms } from '../../src/physics/maxwell';
import { Gas3D, GASES } from '../../src/physics/gas';

const mAr = GASES.Ar.mass;
function integrate(f: (v: number) => number, hi: number, n = 4000): number {
  const h = hi / n;
  let s = f(0) + f(hi);
  for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return (s * h) / 3;
}

describe('B.3 Maxwell–Boltzmann distribution', () => {
  const T = 300;
  const hi = 6 * vMostProbable(T, mAr);
  it('is normalised and its averages give v̄ and v_rms; the peak is at v_p', () => {
    expect(integrate((v) => maxwell(v, T, mAr), hi)).toBeCloseTo(1, 9);
    expect(integrate((v) => v * maxwell(v, T, mAr), hi)).toBeCloseTo(vMean(T, mAr), 6);
    expect(Math.sqrt(integrate((v) => v * v * maxwell(v, T, mAr), hi))).toBeCloseTo(vRms(T, mAr), 6);
    const vp = vMostProbable(T, mAr);
    expect(maxwell(vp, T, mAr)).toBeGreaterThan(maxwell(vp * 1.01, T, mAr));
    expect(maxwell(vp, T, mAr)).toBeGreaterThan(maxwell(vp * 0.99, T, mAr));
    // the order v_p < v̄ < v_rms
    expect(vp).toBeLessThan(vMean(T, mAr));
    expect(vMean(T, mAr)).toBeLessThan(vRms(T, mAr));
    expect(maxwellCdf(hi, T, mAr)).toBeCloseTo(1, 6);
  });

  /** Kolmogorov–Smirnov distance between sample speeds and the theory */
  function ks(speeds: number[], Tt: number, m: number): number {
    speeds.sort((a, b) => a - b);
    let d = 0;
    speeds.forEach((v, i) => {
      const F = maxwellCdf(v, Tt, m);
      d = Math.max(d, Math.abs((i + 1) / speeds.length - F), Math.abs(i / speeds.length - F));
    });
    return d;
  }

  it('atoms that start with one speed relax to Maxwell–Boltzmann through the heat-bath wall (KS test)', () => {
    const g = new Gas3D({ counts: { He: 150, Ar: 150 }, L: 30e-9, Lx: 30e-9, T0: 300, seed: 8, sameSpeed: true });
    g.bath = true;
    g.Tbath = 300;
    for (let i = 0; i < 300000; i++) g.step();
    // collect speeds from several well-separated snapshots
    const he: number[] = [];
    const ar: number[] = [];
    for (let k = 0; k < 8; k++) {
      for (let i = 0; i < 20000; i++) g.step();
      for (let i = 0; i < g.N; i++) (g.species[i] === 0 ? he : ar).push(Math.hypot(g.vx[i], g.vy[i], g.vz[i]));
    }
    // 1200 speeds each, partly correlated between snapshots: a KS distance below 0.06
    // (≈ 1.6/√(n_eff) for n_eff ≈ 700) means no detectable difference from the theory
    expect(ks(he, 300, GASES.He.mass)).toBeLessThan(0.06);
    expect(ks(ar, 300, GASES.Ar.mass)).toBeLessThan(0.06);
  });
});
