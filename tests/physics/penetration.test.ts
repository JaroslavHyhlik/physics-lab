import { describe, expect, it } from 'vitest';
import { alphaRangeAir, betaRange, countRate, poisson, solidFraction, transmission, trueRate } from '../../src/physics/penetration';
import { Rng } from '../../src/core/rng';

describe('E.3 radiation penetration', () => {
  it('γ follows the inverse square law with distance (point source, small window)', () => {
    const r20 = trueRate('gamma', 'none', 0, 20);
    const r40 = trueRate('gamma', 'none', 0, 40);
    expect(r20 / r40).toBeCloseTo(4, 1);
    expect(Math.abs(r20 / r40 / 4 - 1)).toBeLessThan(0.005);
    // near the window the exact solid angle stays finite and never exceeds half of all directions
    expect(solidFraction(0)).toBeCloseTo(0.5, 12);
  });

  it('α: about 4 cm range in air, stopped by a sheet of paper', () => {
    expect(alphaRangeAir()).toBeCloseTo(4.1, 1);
    expect(transmission('alpha', 'none', 0, 2)).toBe(1);
    expect(transmission('alpha', 'none', 0, 6)).toBe(0);
    expect(transmission('alpha', 'paper', 0, 2)).toBe(0);
  });

  it('β: pass paper, reduced by mm of aluminium, stopped by about 4 mm of Al (2.28 MeV end point)', () => {
    expect(betaRange(2.28) / 2.7 * 10).toBeCloseTo(4.1, 1); // range in mm of aluminium
    const none = transmission('beta', 'none', 0, 5);
    // most get through paper; the soft Sr-90 component (0.546 MeV) loses about a quarter in 8 mg cm⁻²
    expect(transmission('beta', 'paper', 0, 5) / none).toBeGreaterThan(0.8);
    const al1 = transmission('beta', 'al', 1, 5);
    expect(al1).toBeLessThan(0.5 * none);
    expect(al1).toBeGreaterThan(0);
    expect(transmission('beta', 'al', 5, 5)).toBe(0);
    expect(transmission('beta', 'pb', 2, 5)).toBe(0);
  });

  it('γ: half-value thickness of lead about 1 cm at 1.25 MeV; only a little absorbed by aluminium', () => {
    const T = (x: number) => transmission('gamma', 'pb', x, 5) / transmission('gamma', 'none', 0, 5);
    const hvl = Math.log(2) / (0.059 * 11.35) * 10; // mm
    expect(T(hvl)).toBeCloseTo(0.5, 6);
    expect(hvl).toBeGreaterThan(9);
    expect(hvl).toBeLessThan(11);
    expect(transmission('gamma', 'al', 5, 5) / transmission('gamma', 'none', 0, 5)).toBeGreaterThan(0.9);
  });

  it('the counter adds background and loses counts to dead time at high rates', () => {
    expect(countRate('alpha', 'paper', 0, 2)).toBeCloseTo(0.4, 12);
    const R = trueRate('beta', 'none', 0, 1);
    expect(countRate('beta', 'none', 0, 1, false)).toBeLessThan(R);
  });

  it('Poisson counts: mean and variance equal the expected number (within 4σ)', () => {
    const rng = new Rng(2);
    for (const m of [0.3, 4, 80]) {
      const N = 20000;
      let s = 0;
      let s2 = 0;
      for (let i = 0; i < N; i++) {
        const k = poisson(rng, m);
        s += k;
        s2 += k * k;
      }
      const mean = s / N;
      const varc = s2 / N - mean * mean;
      expect(Math.abs(mean - m)).toBeLessThan(4 * Math.sqrt(m / N));
      expect(Math.abs(varc / m - 1)).toBeLessThan(0.06);
    }
  });
});
