import { describe, expect, it } from 'vitest';
import { DIE_P, decayConstant, diceLambda, diceLifetimes, expectedN, halfLifeOf, lifetimes, remaining } from '../../src/physics/decay';
import { linearFit } from '../../src/physics/dc';
import { Rng } from '../../src/core/rng';

describe('E.3 random decay', () => {
  it('T½ = ln 2/λ and N = N₀e^(−λt) halves every half-life', () => {
    const lam = decayConstant(8.02);
    expect(halfLifeOf(lam)).toBeCloseTo(8.02, 12);
    expect(expectedN(1000, lam, 8.02)).toBeCloseTo(500, 9);
    expect(expectedN(1000, lam, 3 * 8.02)).toBeCloseTo(125, 9);
  });

  it('(HL) the number left agrees with N₀e^(−λt) within 4σ at several times', () => {
    const rng = new Rng(42);
    const N0 = 20000;
    const lam = decayConstant(1);
    const times = lifetimes(rng, N0, lam);
    for (const t of [0.25, 1, 2, 4]) {
      const p = Math.exp(-lam * t);
      const sigma = Math.sqrt(N0 * p * (1 - p));
      expect(Math.abs(remaining(times, t) - N0 * p)).toBeLessThan(4 * sigma);
    }
  });

  it('(HL) a straight-line fit of ln N against t gives the decay constant', () => {
    const rng = new Rng(9);
    const N0 = 20000;
    const lam = decayConstant(2);
    const times = lifetimes(rng, N0, lam);
    const ts: number[] = [];
    const lnN: number[] = [];
    for (let t = 0; t <= 8; t += 0.25) {
      ts.push(t);
      lnN.push(Math.log(remaining(times, t)));
    }
    const fit = linearFit(ts, lnN);
    // statistical spread of a fitted slope over 4 half-lives with N₀ = 20000 is about 0.3 %
    expect(Math.abs(-fit.slope / lam - 1)).toBeLessThan(0.02);
    expect(fit.intercept).toBeCloseTo(Math.log(N0), 1);
  });

  it('dice: survivors after n throws follow (5/6)ⁿ, a "half-life" of about 3.8 throws', () => {
    expect(Math.LN2 / diceLambda()).toBeCloseTo(3.8, 1);
    const rng = new Rng(1);
    const N0 = 12000;
    const n = diceLifetimes(rng, N0);
    for (const k of [1, 3, 6]) {
      const p = (1 - DIE_P) ** k;
      const left = remaining(n, k);
      expect(Math.abs(left - N0 * p)).toBeLessThan(4 * Math.sqrt(N0 * p * (1 - p)));
    }
    expect(Math.min(...n)).toBe(1);
  });

  it('the result does not depend on how often it is looked at (lifetimes are fixed at the start)', () => {
    const times = lifetimes(new Rng(5), 1000, 0.3);
    let coarse = 0;
    for (let t = 0; t <= 3; t += 1.5) coarse = remaining(times, t);
    let fine = 0;
    for (let k = 0; k <= 3000; k++) fine = remaining(times, k / 1000);
    expect(fine).toBe(coarse);
  });
});
