import { describe, expect, it } from 'vitest';
import { ChainReaction, NU, fissionProbability, kInfinity } from '../../src/physics/chain';
import { Rng } from '../../src/core/rng';

describe('E.4 chain reaction (Monte Carlo)', () => {
  it('k∞ = ν σ_f/σ_a for pure U-235 ≈ 2.09; natural uranium ≈ 1.33', () => {
    expect(kInfinity(1)).toBeCloseTo((NU * 585) / 681, 12);
    expect(kInfinity(0.0072)).toBeCloseTo(1.33, 1);
  });

  it('in a huge lump (almost no leakage) the measured k equals k∞ within 4σ', () => {
    const e = 0.03;
    const c = new ChainReaction(new Rng(8), 400, 'disc', e, 20000);
    const N0 = 2000;
    c.followUpToGen = 0;
    c.inject(N0, true);
    while (c.n > 0 && (c.aliveInGen[0] ?? 0) > 0) c.step(0.5);
    // generation 0 finished: expected births = N0 · p_f · ν
    const pf = fissionProbability(e);
    const mean = N0 * pf * NU;
    // variance per neutron: fission (prob p) gives 2 or 3
    const ex2 = pf * (0.57 * 4 + 0.43 * 9);
    const sd = Math.sqrt(N0 * (ex2 - (pf * NU) ** 2));
    expect(Math.abs(c.births[1] - mean)).toBeLessThan(4 * sd);
    expect(c.escaped).toBe(0);
    expect(c.overflow).toBe(false);
  });

  it('from the centre of a disc of radius R, a fraction e^(−R) escapes before absorption', () => {
    const c = new ChainReaction(new Rng(3), 1.5, 'disc', 0, 6000); // e = 0: no fission
    const N = 5000;
    c.inject(N, true);
    while (c.n > 0) c.step(0.2);
    const p = Math.exp(-1.5);
    expect(Math.abs(c.escaped / N - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / N));
    expect(c.escaped + c.captured).toBe(N);
  });

  it('smaller or flatter lumps leak more: k falls below 1 (subcritical)', () => {
    const kOf = (R: number, shape: 'disc' | 'plate') => {
      const c = new ChainReaction(new Rng(11), R, shape, 1, 20000);
      c.followUpToGen = 0;
      c.inject(1500);
      while ((c.aliveInGen[0] ?? 0) > 0) c.step(0.5);
      return c.births[1] / c.births[0];
    };
    const big = kOf(6, 'disc');
    const small = kOf(0.5, 'disc');
    const flat = kOf(6, 'plate');
    expect(big).toBeGreaterThan(1.3);
    expect(small).toBeLessThan(1);
    expect(flat).toBeLessThan(big);
  });
});
