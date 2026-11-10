import { describe, expect, it } from 'vitest';
import { idealP, idealV, idealT, vdwP, vdwV, criticalT, VDW } from '../../src/physics/gasLaws';
import { R } from '../../src/core/constants';

describe('B.3 gas laws', () => {
  const n = 0.002;
  it("Boyle (T constant): pV is constant; Charles (p constant): V/T constant; Gay-Lussac (V constant): p/T constant", () => {
    const T = 293;
    for (const V of [1e-5, 3e-5, 1e-4]) expect(idealP(n, V, T) * V).toBeCloseTo(n * R * T, 10);
    const p = 1e5;
    for (const T2 of [250, 300, 400]) expect(idealV(n, p, T2) / T2).toBeCloseTo((n * R) / p, 15);
    const V = 5e-5;
    for (const T2 of [250, 300, 400]) expect(idealP(n, V, T2) / T2).toBeCloseTo((n * R) / V, 10);
    expect(idealT(n, idealP(n, V, 321), V)).toBeCloseTo(321, 10);
  });

  it('van der Waals gas behaves ideally at low density', () => {
    for (const g of Object.values(VDW)) {
      const V = 1; // 1 m³ for 0.002 mol: extremely dilute
      expect(Math.abs(vdwP(n, V, 300, g) / idealP(n, V, 300) - 1)).toBeLessThan(1e-6);
    }
  });

  it('solving for V returns a volume with the requested pressure', () => {
    for (const g of Object.values(VDW)) {
      for (const p of [1e4, 1e5, 1e6]) {
        const V = vdwV(0.1, p, 350, g);
        expect(vdwP(0.1, V, 350, g) / p).toBeCloseTo(1, 9);
      }
    }
  });

  it('critical temperature of CO₂ from a and b: 8a/(27Rb) ≈ 304 K (measured 304.1 K)', () => {
    expect(Math.abs(criticalT(VDW.CO2) - 304.1) / 304.1).toBeLessThan(0.01);
  });
});
