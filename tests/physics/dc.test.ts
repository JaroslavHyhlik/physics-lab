import { describe, expect, it } from 'vitest';
import { cellCircuit, linearFit, wireResistance, RESISTIVITY } from '../../src/physics/dc';

describe('B.5 cells, internal resistance and resistivity', () => {
  it('V = ε − Ir and energy: εI = I²R + I²r', () => {
    const c = cellCircuit(1.5, 0.5, 2.5);
    expect(c.I).toBeCloseTo(0.5, 14);
    expect(c.V).toBeCloseTo(1.25, 14);
    expect(c.Ptotal).toBeCloseTo(c.Pload + c.Plost, 14);
  });

  it('the load power is largest when R = r', () => {
    const r = 0.8;
    let best = 0;
    let bestR = 0;
    for (let R = 0.01; R < 5; R += 0.001) {
      const p = cellCircuit(6, r, R).Pload;
      if (p > best) {
        best = p;
        bestR = R;
      }
    }
    expect(bestR).toBeCloseTo(r, 2);
    expect(best).toBeCloseTo((6 * 6) / (4 * r), 4);
  });

  it('a straight-line fit of V against I gives slope −r and intercept ε', () => {
    const Is: number[] = [];
    const Vs: number[] = [];
    for (const R of [1, 2, 4, 8, 16]) {
      const c = cellCircuit(4.5, 1.2, R);
      Is.push(c.I);
      Vs.push(c.V);
    }
    const f = linearFit(Is, Vs);
    expect(f.slope).toBeCloseTo(-1.2, 12);
    expect(f.intercept).toBeCloseTo(4.5, 12);
  });

  it('R = ρL/A: 1 m of copper wire, 1 mm² → 0.0168 Ω; doubling L doubles R, doubling A halves it', () => {
    const R1 = wireResistance(RESISTIVITY.copper.rho, 1, 1e-6);
    expect(R1).toBeCloseTo(0.0168, 12);
    expect(wireResistance(RESISTIVITY.copper.rho, 2, 1e-6) / R1).toBeCloseTo(2, 12);
    expect(wireResistance(RESISTIVITY.copper.rho, 1, 2e-6) / R1).toBeCloseTo(0.5, 12);
  });
});
