import { describe, expect, it } from 'vitest';
import { lnChoose, entropyHalves, Expansion, heatExchange } from '../../src/physics/entropy';
import { k_B, N_A, R } from '../../src/core/constants';

describe('B.4 entropy', () => {
  it('exact combinatorics: C(4,2) = 6, C(10,5) = 252, Σ C(N,k) = 2^N', () => {
    expect(Math.exp(lnChoose(4, 2))).toBeCloseTo(6, 10);
    expect(Math.exp(lnChoose(10, 5))).toBeCloseTo(252, 8);
    let s = 0;
    for (let k = 0; k <= 20; k++) s += Math.exp(lnChoose(20, k));
    expect(s).toBeCloseTo(2 ** 20, 3);
    expect(entropyHalves(20, 20)).toBe(0); // all on one side: Ω = 1, S = 0
  });

  it('free expansion into twice the volume: ΔS → N k ln 2 = nR ln 2 for large N', () => {
    const N = 100000;
    const dS = entropyHalves(N, N / 2) - entropyHalves(N, N);
    // ln C(N, N/2) = N ln 2 − ½ ln(πN/2) + …: relative difference ~ 6 × 10⁻⁵ here
    expect(Math.abs(dS / (N * k_B * Math.LN2) - 1)).toBeLessThan(1e-4);
    // per mole: N k_B = nR
    expect((N_A * k_B) / R).toBeCloseTo(1, 2);
  });

  it('after the partition is removed the particles spread out to about half on each side', () => {
    const e = new Expansion(400, 3);
    for (let i = 0; i < 200; i++) e.step(0.05);
    expect(e.nLeft).toBe(400); // partition still in
    e.partition = false;
    let sum = 0;
    let n = 0;
    for (let i = 0; i < 4000; i++) {
      e.step(0.05);
      if (i > 1000 && i % 20 === 0) {
        sum += e.nLeft;
        n++;
      }
    }
    // σ of n_left = √N/2 = 10 per snapshot; mean over 150 snapshots: allow ±8 (> 4σ even with correlation)
    expect(Math.abs(sum / n - 200)).toBeLessThan(8);
  });

  it('heat flowing from hot to cold increases the total entropy (ΔS = Q/T_c − Q/T_h > 0)', () => {
    const C1 = 500;
    const C2 = 800;
    let prev = 0;
    for (const t of [1, 5, 20, 100, 1000]) {
      const s = heatExchange(C1, C2, 400, 300, 10, t);
      expect(s.dS).toBeGreaterThan(prev);
      prev = s.dS;
    }
    // small heat: ΔS ≈ Q(1/T_c − 1/T_h)
    const s = heatExchange(C1, C2, 400, 300, 10, 0.01);
    expect(s.dS / (s.Q * (1 / 300 - 1 / 400))).toBeCloseTo(1, 3);
    // energy conserved
    const f = heatExchange(C1, C2, 400, 300, 10, 1e4);
    expect(C1 * (400 - f.T1)).toBeCloseTo(C2 * (f.T2 - 300), 6);
  });
});
