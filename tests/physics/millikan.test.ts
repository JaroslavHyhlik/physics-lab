import { describe, expect, it } from 'vitest';
import { hoverVoltage, terminalVelocity, stepDrop, dropMassEff, AIR_VISCOSITY, OIL_DENSITY, AIR_DENSITY } from '../../src/physics/millikan';
import { e, g } from '../../src/core/constants';

describe("D.2 parallel plates and Millikan's experiment", () => {
  const r = 0.8e-6;
  const d = 5e-3;
  it('hover voltage V = mgd/q: the drop then has zero velocity', () => {
    for (const n of [1, 2, 3, 5]) {
      const V = hoverVoltage(r, n * e, d);
      expect(V).toBeCloseTo((dropMassEff(r) * g * d) / (n * e), 8);
      expect(Math.abs(terminalVelocity(r, n * e, V / d))).toBeLessThan(1e-18);
    }
  });

  it('no field: Stokes terminal speed v = 2r²(ρ − ρ_air)g/9η', () => {
    expect(terminalVelocity(r, e, 0)).toBeCloseTo((2 * r * r * (OIL_DENSITY - AIR_DENSITY) * g) / (9 * AIR_VISCOSITY), 15);
  });

  it('charges found from hover voltages are whole multiples of e', () => {
    for (const n of [1, 2, 4, 7]) {
      const V = hoverVoltage(r, n * e, d);
      const q = (dropMassEff(r) * g * d) / V;
      expect(q / e).toBeCloseTo(n, 10);
    }
  });

  it('exact motion: the drop approaches terminal velocity and falls at v_t', () => {
    const drop = { r, n: 2, y: 4e-3, v: 0 };
    for (let i = 0; i < 1000; i++) stepDrop(drop, 1e5, 1e-3);
    expect(drop.v).toBeCloseTo(terminalVelocity(r, 2 * e, 1e5), 15);
  });
});
