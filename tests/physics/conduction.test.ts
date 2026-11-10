import { describe, expect, it } from 'vitest';
import { Slab, CONDUCT_MATERIALS } from '../../src/physics/conduction';

describe('B.1 thermal conduction', () => {
  it('steady state: straight-line profile and P = kAΔT/Δx at both faces', () => {
    const s = new Slab(CONDUCT_MATERIALS.copper, 0.3, 1e-4, 100, 20);
    s.step(12 * s.tau); // e^{−12} ≈ 6 × 10⁻⁶ of the start difference left
    for (let i = 0; i < s.N; i++) expect(s.T[i]).toBeCloseTo(100 - (80 * i) / (s.N - 1), 2);
    const P = (400 * 1e-4 * 80) / 0.3;
    expect(s.Psteady).toBeCloseTo(P, 12);
    expect(Math.abs(s.Pin / P - 1)).toBeLessThan(1e-3);
    expect(Math.abs(s.Pout / P - 1)).toBeLessThan(1e-3);
  });

  it('transient profile matches the exact Fourier-series solution', () => {
    const s = new Slab(CONDUCT_MATERIALS.glass, 0.01, 1, 40, 0, 81);
    const t = 0.5 * s.tau;
    s.step(t);
    // FTCS error ~ Δx²: with 80 cells, below 0.2 % of ΔT
    for (const i of [10, 20, 40, 60]) expect(Math.abs(s.T[i] - s.exact(i * s.dx, s.t))).toBeLessThan(0.08);
  });

  it('energy balance: stored energy rises at P_in − P_out', () => {
    const s = new Slab(CONDUCT_MATERIALS.steel, 0.1, 1e-3, 80, 20, 81);
    s.step(0.3 * s.tau);
    const E1 = s.stored;
    const p1 = s.Pin - s.Pout;
    const dt = 0.01 * s.tau;
    s.step(dt);
    const p2 = s.Pin - s.Pout;
    expect(Math.abs((s.stored - E1) / dt / ((p1 + p2) / 2) - 1)).toBeLessThan(0.01);
  });

  it('stays stable for a huge requested step (CFL limit enforced)', () => {
    const s = new Slab(CONDUCT_MATERIALS.copper, 0.05, 1e-4, 100, 0);
    s.step(1000 * s.maxDt);
    for (const v of s.T) expect(v).toBeGreaterThanOrEqual(-1e-9);
    for (const v of s.T) expect(v).toBeLessThanOrEqual(100 + 1e-9);
  });
});
