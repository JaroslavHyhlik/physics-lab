import { describe, expect, it } from 'vitest';
import { Orbit, M_SUN, escapeSpeed, orbitalSpeed } from '../../src/physics/gravity';
import { AU, G } from '../../src/core/constants';

describe("D.1 orbits and Kepler's laws", () => {
  const GM = G * M_SUN;
  it('T² = 4π²a³/(GM): the measured period matches for an ellipse', () => {
    const r0 = AU;
    const v0 = 1.2 * orbitalSpeed(GM, r0); // e = 0.44
    const o = new Orbit(M_SUN, r0, 0, 0, v0);
    const { a, T } = o.elements();
    expect(T * T).toBeCloseTo((4 * Math.PI * Math.PI * a ** 3) / GM, -10);
    // measure: time between successive crossings of the +x axis going upwards
    const h = T / 20000;
    const cross: number[] = [];
    let prevY = o.x[1];
    while (cross.length < 3) {
      o.step(h);
      if (prevY < 0 && o.x[1] >= 0 && o.x[0] > 0) cross.push(o.t - (h * o.x[1]) / (o.x[1] - prevY));
      prevY = o.x[1];
    }
    expect(Math.abs((cross[2] - cross[1]) / T - 1)).toBeLessThan(1e-6);
  });

  it('energy drift below 10⁻⁸ over 1000 orbits; equal areas in equal times (L constant)', () => {
    const o = new Orbit(M_SUN, AU, 0, 0, 1.15 * orbitalSpeed(GM, AU));
    const E0 = o.energy;
    const L0 = o.L;
    const { T } = o.elements();
    const h = T / 2000;
    let maxE = 0;
    for (let i = 0; i < 2000 * 1000; i++) {
      o.step(h);
      if (i % 997 === 0) maxE = Math.max(maxE, Math.abs(o.energy / E0 - 1));
    }
    expect(maxE).toBeLessThan(1e-8);
    expect(Math.abs(o.L / L0 - 1)).toBeLessThan(1e-10);
  });

  it('(HL) escape speed √(2GM/r) = √2 × circular speed; a body at escape speed is unbound (E = 0)', () => {
    expect(escapeSpeed(GM, AU) / orbitalSpeed(GM, AU)).toBeCloseTo(Math.SQRT2, 14);
    const o = new Orbit(M_SUN, AU, 0, 0, escapeSpeed(GM, AU));
    expect(Math.abs(o.energy) / (GM / AU)).toBeLessThan(1e-14);
  });
});
