import { describe, expect, it } from 'vitest';
import { Calorimeter, MATERIALS, cFromMixture } from '../../src/physics/calorimetry';

describe('B.1 calorimetry (method of mixtures)', () => {
  const m1 = 0.2;
  const m2 = 0.25;
  const make = (h = 0) => new Calorimeter(m1 * MATERIALS.copper, m2 * MATERIALS.water, 95, 20, 5, h, 20);

  it('without losses: matches the exact solution and Σmc·ΔT = 0', () => {
    const cal = make();
    const dt = 0.01; // τ ≈ 13 s, so h/τ < 1e-3: RK4 error ~ (h/τ)⁴, far below the tolerance
    for (let i = 0; i < 20000; i++) cal.step(dt);
    const [e1, e2] = cal.exact(cal.t);
    expect(cal.y[0]).toBeCloseTo(e1, 9);
    expect(cal.y[1]).toBeCloseTo(e2, 9);
    expect(cal.Qout - cal.Qin).toBeCloseTo(0, 6);
    // after 200 s ≈ 15τ the remaining difference is ~ 75 K · e⁻¹⁵ ≈ 5 × 10⁻⁶ K
    expect(cal.y[1]).toBeCloseTo(cal.equilibrium(), 4);
  });

  it('final temperature = (C1T1 + C2T2)/(C1 + C2); c can be recovered from T_f', () => {
    const cal = make();
    const Tf = cal.equilibrium();
    expect(Tf).toBeCloseTo((77 * 95 + 1045 * 20) / (77 + 1045), 10);
    expect(cFromMixture(m1, 95, m2, MATERIALS.water, 20, Tf)).toBeCloseTo(MATERIALS.copper, 9);
  });

  it('with heat loss to the room: energy balance holds and the measured c comes out too small', () => {
    const cal = make(0.8);
    for (let i = 0; i < 6000; i++) cal.step(0.01);
    // energy given out = energy taken in + energy lost
    expect(cal.Qout - cal.Qin - cal.y[2]).toBeCloseTo(0, 6);
    // read T_f at the highest water temperature reached (as a student would)
    let best = -Infinity;
    const c2 = make(0.8);
    for (let i = 0; i < 6000; i++) {
      c2.step(0.01);
      best = Math.max(best, c2.y[1]);
    }
    expect(cFromMixture(m1, 95, m2, MATERIALS.water, 20, best)).toBeLessThan(MATERIALS.copper);
  });
});
