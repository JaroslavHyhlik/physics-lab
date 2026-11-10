import { describe, expect, it } from 'vitest';
import { Collision2D, standardSetup } from '../../src/physics/collision2d';

function run(c: Collision2D, dt: number, T = 4) {
  for (let i = 0; i < T / dt; i++) c.step(dt);
  return c;
}
const angle = (x: number, y: number) => Math.atan2(y, x);

describe('A.2 collisions in 2D', () => {
  it.each([1, 0.7, 0.3, 0])('e = %s: momentum vector conserved', (e) => {
    const p = standardSetup(1.3, 0.8, 0.1, 0.15, 1.7, -0.4, 0.12, e);
    const c = new Collision2D(p);
    const px0 = c.px;
    const py0 = c.py;
    run(c, 1e-3);
    expect(c.collided).toBe(true);
    // rounding error only (a few ulp of |p| ≈ 2)
    expect(Math.abs(c.px - px0)).toBeLessThan(1e-12);
    expect(Math.abs(c.py - py0)).toBeLessThan(1e-12);
  });

  it.each([0.02, 0.08, 0.15])('equal masses, elastic, target at rest, b = %s m: velocities at 90°', (b) => {
    const c = run(new Collision2D(standardSetup(1, 1, 0.1, 0.1, 2, 0, b, 1)), 1e-3);
    const s = c.s;
    const dot = s[2] * s[6] + s[3] * s[7];
    expect(Math.abs(dot) / (Math.hypot(s[2], s[3]) * Math.hypot(s[6], s[7]))).toBeLessThan(1e-12);
    // target moves along the line of centres: angle −φ with sin φ = b/(r₁ + r₂)
    expect(angle(s[6], s[7])).toBeCloseTo(-Math.asin(b / 0.2), 12);
    expect(Math.hypot(s[6], s[7])).toBeCloseTo(2 * Math.sqrt(1 - (b / 0.2) ** 2), 12);
  });

  it('elastic: kinetic energy conserved; inelastic: loss = ½μv_n²(1 − e²)', () => {
    for (const e of [1, 0.5]) {
      const p = standardSetup(2, 0.5, 0.12, 0.08, 1.5, 0, 0.1, e);
      const c = new Collision2D(p);
      const K0 = c.kinetic;
      run(c, 1e-3);
      const mu = (2 * 0.5) / 2.5;
      const R = 0.2;
      const vn = 1.5 * Math.sqrt(1 - (0.1 / R) ** 2); // normal component of the approach velocity
      expect(K0 - c.kinetic).toBeCloseTo(0.5 * mu * vn * vn * (1 - e * e), 12);
    }
  });

  it('head-on (b = 0) reduces to the 1D formulas', () => {
    const m1 = 1;
    const m2 = 3;
    const u1 = 2;
    const u2 = -0.5;
    const e = 0.6;
    const c = run(new Collision2D(standardSetup(m1, m2, 0.1, 0.1, u1, u2, 0, e)), 1e-3);
    const M = m1 + m2;
    expect(c.s[2]).toBeCloseTo(((m1 - e * m2) * u1 + (1 + e) * m2 * u2) / M, 12);
    expect(c.s[6]).toBeCloseTo(((m2 - e * m1) * u2 + (1 + e) * m1 * u1) / M, 12);
    expect(c.s[3]).toBe(0);
    expect(c.s[7]).toBe(0);
  });

  it('impulse on each puck equals its change of momentum', () => {
    const p = standardSetup(1, 2, 0.1, 0.1, 1.5, 0, 0.1, 0.8);
    const c = run(new Collision2D(p), 1e-3);
    expect(c.J[0]).toBeCloseTo(p.m2 * (c.s[6] - p.u2x), 12);
    expect(c.J[1]).toBeCloseTo(p.m2 * (c.s[7] - p.u2y), 12);
    expect(-c.J[0]).toBeCloseTo(p.m1 * (c.s[2] - p.u1x), 12);
  });

  it('contact happens exactly at |r₂ − r₁| = r₁ + r₂, independent of the step size', () => {
    const p = standardSetup(1, 1.5, 0.1, 0.12, 1.1, -0.3, 0.07, 0.9);
    const a = run(new Collision2D(p), 1e-3, 3);
    const b = run(new Collision2D(p), 0.012, 3);
    const k = a.contact;
    expect(Math.hypot(k[2] - k[0], k[3] - k[1])).toBeCloseTo(0.22, 12);
    for (let i = 0; i < 8; i++) expect(b.s[i]).toBeCloseTo(a.s[i], 10);
    expect(b.tc).toBeCloseTo(a.tc, 12);
  });

  it('a miss (b ≥ r₁ + r₂) changes nothing; centre of mass moves uniformly', () => {
    const p = standardSetup(1, 1, 0.1, 0.1, 1.5, 0, 0.21, 1);
    const c = run(new Collision2D(p), 1e-3);
    expect(c.collided).toBe(false);
    expect(c.s[2]).toBe(1.5);
    const c2 = new Collision2D(standardSetup(1, 2, 0.1, 0.1, 1.5, 0, 0.05, 0.5));
    const vcm = c2.px / c2.M;
    const x0 = c2.xcm;
    run(c2, 1e-3, 2);
    expect(c2.xcm).toBeCloseTo(x0 + vcm * c2.t, 10);
  });
});
