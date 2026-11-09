import { describe, expect, it } from 'vitest';
import { Collision1D, finalVelocities, type CollisionParams } from '../../src/physics/collision1d';

const dt = 1e-4;
const base: CollisionParams = { m1: 1, m2: 3, u1: 2, u2: -0.5, e: 1, k: 2000, x1: -1, x2: 1, w: 0.3 };

function collide(p: CollisionParams) {
  const c = new Collision1D(p);
  for (let i = 0; i < 4 / dt && !(c.done && c.t > 0.05); i++) c.step(dt);
  for (let i = 0; i < 1000; i++) c.step(dt); // a little after the contact
  return c;
}

describe('A.2 collisions in 1D', () => {
  it.each([1, 0.8, 0.5, 0.2])('e = %s: final velocities match the formula, momentum conserved', (e) => {
    const p = { ...base, e };
    const c = collide(p);
    const [v1, v2] = finalVelocities(p.m1, p.m2, p.u1, p.u2, e);
    expect(c.y[1]).toBeCloseTo(v1, 5);
    expect(c.y[3]).toBeCloseTo(v2, 5);
    expect(c.momentum).toBeCloseTo(p.m1 * p.u1 + p.m2 * p.u2, 10);
    // measured restitution
    expect((c.y[3] - c.y[1]) / (p.u1 - p.u2)).toBeCloseTo(e, 5);
  });

  it('elastic collision conserves kinetic energy', () => {
    const c = collide(base);
    const KE0 = 0.5 * base.m1 * base.u1 ** 2 + 0.5 * base.m2 * base.u2 ** 2;
    expect(c.kinetic / KE0).toBeCloseTo(1, 6);
  });

  it('equal masses, elastic: velocities are exchanged', () => {
    const c = collide({ ...base, m1: 2, m2: 2, u1: 1.5, u2: 0 });
    expect(c.y[1]).toBeCloseTo(0, 5);
    expect(c.y[3]).toBeCloseTo(1.5, 5);
  });

  it('perfectly inelastic (e = 0): common velocity, maximum loss of kinetic energy', () => {
    const p = { ...base, e: 0 };
    const c = collide(p);
    const v = (p.m1 * p.u1 + p.m2 * p.u2) / (p.m1 + p.m2);
    expect(c.stuck).toBe(true);
    expect(c.y[1]).toBeCloseTo(v, 6);
    expect(c.y[3]).toBeCloseTo(v, 6);
    expect(c.momentum).toBeCloseTo(p.m1 * p.u1 + p.m2 * p.u2, 10);
  });

  it('impulse J = ∫F dt equals the change of momentum of each cart', () => {
    const p = { ...base, e: 0.6 };
    const c = collide(p);
    expect(c.impulse).toBeCloseTo(p.m2 * (c.y[3] - p.u2), 8);
    expect(-c.impulse).toBeCloseTo(p.m1 * (c.y[1] - p.u1), 8);
  });

  it('contact time ≈ π√(μ/k) for an elastic bumper', () => {
    const c = collide(base);
    const mu = (base.m1 * base.m2) / (base.m1 + base.m2);
    expect((c.contactEnd - c.contactStart) / (Math.PI * Math.sqrt(mu / base.k))).toBeCloseTo(1, 2);
  });
});
