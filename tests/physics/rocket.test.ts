import { describe, expect, it } from 'vitest';
import { Rocket, tsiolkovsky, R_EARTH, type RocketParams } from '../../src/physics/rocket';

const base: RocketParams = {
  dry: 1000,
  fuel: 4000,
  mdot: 50,
  ve: 2500,
  Cd: 0.5,
  d: 1,
  rho0: 1.2,
  g0: 9.8,
  drag: false,
  gravity: false,
  variableG: false,
};
const dt = 1e-3;
const run = (r: Rocket, T: number) => {
  for (let i = 0; i < Math.round(T / dt); i++) r.step(dt);
};

describe('A.2 rocket with variable mass', () => {
  it('no gravity, no air: Δv = v_e ln(m₀/m_f) (Tsiolkovsky)', () => {
    const r = new Rocket(base);
    run(r, r.burnTime + 1);
    expect(r.y[1] / tsiolkovsky(2500, 5000, 1000)).toBeCloseTo(1, 10);
    expect(r.y[2]).toBe(1000);
    expect(r.tBurnout).toBeCloseTo(80, 9);
  });

  it('thrust F = v_e Δm/Δt', () => {
    const r = new Rocket(base);
    expect(r.thrust()).toBe(2500 * 50);
  });

  it('constant g, no air: v(t) = v_e ln(m₀/m(t)) − gt during the burn', () => {
    const r = new Rocket({ ...base, gravity: true });
    run(r, 30);
    const m = 5000 - 50 * 30;
    expect(r.y[1]).toBeCloseTo(2500 * Math.log(5000 / m) - 9.8 * 30, 7);
  });

  it('after burnout without air: ½v² − g₀R²/(R + h) is conserved (inverse-square gravity)', () => {
    const r = new Rocket({ ...base, gravity: true, variableG: true });
    run(r, r.burnTime + 0.5);
    const E = () => 0.5 * r.y[1] ** 2 - (9.8 * R_EARTH * R_EARTH) / (R_EARTH + r.y[0]);
    const E0 = E();
    run(r, 200);
    expect(Math.abs(E() - E0) / Math.abs(E0)).toBeLessThan(1e-10);
  });

  it('thrust less than weight: the rocket does not lift off', () => {
    const r = new Rocket({ ...base, gravity: true, mdot: 10 }); // F = 25 kN < 49 kN
    run(r, 5);
    expect(r.y[0]).toBe(0);
    expect(r.y[1]).toBe(0);
  });

  it('air resistance lowers the maximum altitude', () => {
    const a = new Rocket({ ...base, gravity: true, variableG: true });
    const b = new Rocket({ ...base, gravity: true, variableG: true, drag: true });
    run(a, 400);
    run(b, 400);
    expect(b.maxH).toBeLessThan(a.maxH);
  });
});
