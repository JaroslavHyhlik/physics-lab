import { describe, expect, it } from 'vitest';
import { NUCLIDES, bindingEnergy, find, liquidDrop, massDefect, qValue } from '../../src/physics/binding';
import { u_MeV } from '../../src/core/constants';

describe('E.3 binding energy per nucleon (AME2020)', () => {
  it('binding energy from the mass excesses agrees with the tabulated BE/A for every nuclide', () => {
    let worst = 0;
    for (const n of NUCLIDES) if (n.A > 1) worst = Math.max(worst, Math.abs(bindingEnergy(n) / n.A - n.bea));
    // the table rounds BE/A to 1 eV; electron binding energies make up the rest
    expect(worst).toBeLessThan(2e-3);
  });

  it('⁴He ≈ 7.07 MeV per nucleon; the curve peaks near ⁵⁶Fe/⁶²Ni at about 8.8 MeV', () => {
    expect(find(2, 2)!.bea).toBeCloseTo(7.074, 3);
    const top = NUCLIDES.reduce((a, b) => (b.bea > a.bea ? b : a));
    expect([26, 28]).toContain(top.Z);
    expect(top.bea).toBeCloseTo(8.79, 1);
    expect(find(26, 30)!.bea).toBeCloseTo(8.79, 2);
    expect(find(28, 34)!.bea).toBeCloseTo(8.795, 3);
  });

  it('mass defect × 931.5 MeV u⁻¹ = binding energy (²H: 2.22 MeV)', () => {
    const d = find(1, 1)!;
    expect(massDefect(d) * u_MeV).toBeCloseTo(bindingEnergy(d), 9);
    expect(bindingEnergy(d)).toBeCloseTo(2.2246, 3);
  });

  it('Q values: D + T → ⁴He + n is 17.6 MeV; ²³⁵U + n → ¹⁴¹Ba + ⁹²Kr + 3n is about 173 MeV', () => {
    expect(qValue([[1, 1], [1, 2]], [[2, 2], [0, 1]])).toBeCloseTo(17.59, 2);
    const q = qValue(
      [[92, 143], [0, 1]],
      [[56, 85], [36, 56], [0, 1], [0, 1], [0, 1]],
    );
    expect(q).toBeGreaterThan(170);
    expect(q).toBeLessThan(176);
  });

  it('the liquid-drop formula is within a few % of the measured curve for medium and heavy nuclei', () => {
    for (const [Z, N] of [
      [26, 30],
      [50, 70],
      [82, 126],
      [92, 146],
    ]) {
      const m = find(Z, N)!;
      expect(Math.abs(liquidDrop(Z, Z + N) / (Z + N) / m.bea - 1)).toBeLessThan(0.02);
    }
  });
});
