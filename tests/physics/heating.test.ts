import { describe, expect, it } from 'vitest';
import { WATER, heatingState, stageEnergies, energyToReach } from '../../src/physics/heating';

describe('B.1 heating curve', () => {
  const m = 0.5;
  const P = 800;
  const T0 = -20;
  const T = (t: number) => heatingState(P * t, m, T0).T;

  it('plateaus last mL/P (melting and boiling)', () => {
    const [q1, q2, q3, q4] = stageEnergies(m, T0);
    expect((q2 - q1) / P).toBeCloseTo((m * WATER.Lf) / P, 9);
    expect((q4 - q3) / P).toBeCloseTo((m * WATER.Lv) / P, 9);
    // temperature is constant inside each plateau
    const tm = (q1 + q2) / (2 * P);
    expect(T(tm)).toBe(0);
    expect(T((q3 + q4) / (2 * P))).toBe(100);
    // half of the ice is melted half-way through the plateau
    expect(heatingState(P * tm, m, T0).liquid).toBeCloseTo(m / 2, 12);
  });

  it('slopes are P/(mc) in each single-phase stage', () => {
    const [q1, q2, q3, q4] = stageEnergies(m, T0);
    const slope = (Qa: number, Qb: number) => (T(Qb / P) - T(Qa / P)) / ((Qb - Qa) / P);
    expect(slope(0.1 * q1, 0.9 * q1)).toBeCloseTo(P / (m * WATER.cSolid), 10);
    expect(slope(q2 + 0.1 * (q3 - q2), q3 - 0.1 * (q3 - q2))).toBeCloseTo(P / (m * WATER.cLiquid), 10);
    expect(slope(q4 * 1.01, q4 * 1.05)).toBeCloseTo(P / (m * WATER.cGas), 10);
  });

  it('mass is conserved and temperature is continuous at stage boundaries', () => {
    for (const q of stageEnergies(m, T0)) {
      const a = heatingState(q * (1 - 1e-12), m, T0);
      const b = heatingState(q * (1 + 1e-12), m, T0);
      expect(Math.abs(a.T - b.T)).toBeLessThan(1e-6);
      expect(a.solid + a.liquid + a.gas).toBeCloseTo(m, 12);
      expect(b.solid + b.liquid + b.gas).toBeCloseTo(m, 12);
    }
  });

  it('energy to reach a temperature is the inverse of T(Q)', () => {
    for (const Tt of [-10, 0, 50, 100, 120]) {
      const Q = energyToReach(Tt, m, T0);
      expect(heatingState(Q, m, T0).T).toBeCloseTo(Tt, 9);
    }
    // hand calculation: 1 kg ice at −20 °C to water at 20 °C
    expect(energyToReach(20, 1, -20)).toBeCloseTo(1 * 2100 * 20 + 3.34e5 + 1 * 4180 * 20, 6);
  });
});
