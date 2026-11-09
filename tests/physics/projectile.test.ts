import { describe, expect, it } from 'vitest';
import { Projectile, vacuumResults, optimumAngle, rangeWithDrag, type ProjectileParams } from '../../src/physics/projectile';

const dt = 1e-3;
const deg = Math.PI / 180;
const base: ProjectileParams = { u: 20, angle: 40 * deg, h0: 0, m: 0.145, d: 0.074, Cd: 0.47, rho: 1.2, g: 9.8 };

function fly(p: ProjectileParams) {
  const pr = new Projectile(p);
  let guard = 0;
  while (!pr.done && guard++ < 1e7) pr.step(dt);
  return pr;
}

describe('A.1 projectile motion', () => {
  it.each([15, 45, 70])('vacuum, θ = %i°: range u²sin2θ/g, time 2u sinθ/g, height u²sin²θ/2g', (a) => {
    const pr = fly({ ...base, angle: a * deg });
    const u = base.u;
    const g = base.g;
    const th = a * deg;
    expect(pr.vacuum.s[0] / ((u * u * Math.sin(2 * th)) / g)).toBeCloseTo(1, 10);
    expect(pr.vacuum.tLand / ((2 * u * Math.sin(th)) / g)).toBeCloseTo(1, 10);
    expect(pr.vacuum.maxHeight / ((u * u * Math.sin(th) ** 2) / (2 * g))).toBeCloseTo(1, 10);
  });

  it('vacuum launch from a height matches the analytic result', () => {
    const p = { ...base, h0: 12, angle: 25 * deg };
    const pr = fly(p);
    const r = vacuumResults(p.u, p.angle, p.h0, p.g);
    expect(pr.vacuum.s[0] / r.range).toBeCloseTo(1, 10);
    expect(pr.vacuum.tLand / r.T).toBeCloseTo(1, 10);
  });

  it('vertical fall with drag: v = v_t·tanh(gt/v_t)', () => {
    const p = { ...base, angle: -Math.PI / 2, u: 0, h0: 1000 };
    const pr = new Projectile(p);
    const T = 3;
    for (let i = 0; i < T / dt; i++) pr.step(dt);
    const vt = pr.terminalSpeed;
    const exact = vt * Math.tanh((p.g * T) / vt);
    expect(Math.abs(-pr.air.s[3] - exact) / exact).toBeLessThan(1e-9);
  });

  it('terminal speed v_t = √(2mg/(ρC_dA))', () => {
    const pr = new Projectile(base);
    const A = (Math.PI * base.d ** 2) / 4;
    expect(pr.terminalSpeed).toBeCloseTo(Math.sqrt((2 * base.m * base.g) / (base.rho * base.Cd * A)), 10);
  });

  it('drag reduces range and height; mechanical energy only decreases', () => {
    const p = { ...base, u: 40 };
    const pr = new Projectile(p);
    let E = Infinity;
    while (!pr.done) {
      pr.step(dt);
      const s = pr.air.s;
      const e = 0.5 * p.m * (s[2] ** 2 + s[3] ** 2) + p.m * p.g * s[1];
      expect(e).toBeLessThanOrEqual(E + 1e-9);
      E = e;
    }
    expect(pr.air.s[0]).toBeLessThan(pr.vacuum.s[0]);
    expect(pr.air.maxHeight).toBeLessThan(pr.vacuum.maxHeight);
  });

  it('with drag the best angle is below 45°; without drag it is 45°', () => {
    const withDrag = optimumAngle({ ...base, u: 40 });
    expect(withDrag / deg).toBeLessThan(44);
    expect(withDrag / deg).toBeGreaterThan(30);
    const noDrag = optimumAngle({ ...base, rho: 0 });
    expect(noDrag / deg).toBeCloseTo(45, 2);
    // and it really is a maximum
    const r = rangeWithDrag({ ...base, u: 40, angle: withDrag });
    expect(r).toBeGreaterThan(rangeWithDrag({ ...base, u: 40, angle: withDrag + 3 * deg }));
    expect(r).toBeGreaterThan(rangeWithDrag({ ...base, u: 40, angle: withDrag - 3 * deg }));
  });
});
