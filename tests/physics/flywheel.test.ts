import { describe, expect, it } from 'vitest';
import { Flywheel } from '../../src/physics/flywheel';

const base = { I: 0.05, r: 0.02, m: 0.5, h: 1, tauF: 0, g: 9.8 };
const run = (f: Flywheel, T: number, dt = 1e-3) => {
  for (let i = 0; i < Math.round(T / dt); i++) f.step(dt);
};

describe('A.4 rotational dynamics (τ = Iα)', () => {
  it('a = mg/(m + I/r²) and T = m(g − a) without friction', () => {
    const f = new Flywheel(base);
    const a = (0.5 * 9.8) / (0.5 + 0.05 / 0.0004);
    expect(f.aFall).toBeCloseTo(a, 12);
    expect(f.tension).toBeCloseTo(0.5 * (9.8 - a), 12);
    // torque on the wheel equals Iα
    expect(f.tension * 0.02).toBeCloseTo(0.05 * f.alpha, 12);
  });

  it('falls h in t = √(2h/a); energy mgh = ½mv² + ½Iω²', () => {
    const f = new Flywheel(base);
    const T = Math.sqrt(2 / f.aFall);
    run(f, T * 0.999);
    expect(f.landed).toBe(false);
    expect(f.EpLost).toBeCloseTo(f.EkMass + f.EkRot, 9);
    run(f, 0.01);
    expect(f.landed).toBe(true);
  });

  it('with bearing friction the wheel slows uniformly after the mass lands', () => {
    const f = new Flywheel({ ...base, tauF: 0.002 });
    run(f, 20);
    expect(f.landed).toBe(true);
    const w1 = f.omega;
    run(f, 1);
    expect(w1 - f.omega).toBeCloseTo(0.002 / 0.05, 9);
  });

  it('with friction, while falling: mgh = ½mv² + ½Iω² + heat', () => {
    const f = new Flywheel({ ...base, tauF: 0.002 });
    run(f, 1.5);
    expect(f.landed).toBe(false);
    expect(f.EpLost).toBeCloseTo(f.EkMass + f.EkRot + f.heat, 9);
  });

  it('too much friction: nothing moves (mgr ≤ τ_f)', () => {
    const f = new Flywheel({ ...base, tauF: 0.2 });
    run(f, 2);
    expect(f.y).toBe(0);
  });
});
