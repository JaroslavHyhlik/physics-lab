import { describe, expect, it } from 'vitest';
import { Lift, Pulley } from '../../src/physics/newton';

const g = 9.8;

describe("A.2 Newton's laws: lift", () => {
  const lift = new Lift({ m: 70, a: 1.5, t1: 2, t2: 4, dir: 1, g, freeFall: false });
  it('scales read N = m(g + a): heavier speeding up, normal at constant speed, lighter slowing down', () => {
    expect(lift.normal(1)).toBeCloseTo(70 * (g + 1.5), 12);
    expect(lift.normal(3)).toBeCloseTo(70 * g, 12);
    expect(lift.normal(7)).toBeCloseTo(70 * (g - 1.5), 12);
  });
  it('the trip ends at rest after s = a t₁² + a t₁ t₂ (exact suvat)', () => {
    expect(lift.velocity(8)).toBe(0);
    expect(lift.height(8)).toBeCloseTo(1.5 * 4 + 1.5 * 2 * 4, 12);
    expect(lift.height(20)).toBeCloseTo(lift.height(8), 12);
  });
  it('velocity is the area under a–t and height the area under v–t (numerical check)', () => {
    let v = 0;
    let h = 0;
    const dt = 1e-4;
    for (let t = 0; t < 8; t += dt) {
      const vm = lift.velocity(t + dt / 2);
      v += lift.accel(t + dt / 2) * dt;
      h += vm * dt;
    }
    expect(v).toBeCloseTo(0, 6);
    expect(h).toBeCloseTo(lift.height(8), 5);
  });
  it('free fall (cable snaps): the scales read zero', () => {
    const f = new Lift({ m: 70, a: 1, t1: 1, t2: 1, dir: 1, g, freeFall: true });
    expect(f.normal(0.7)).toBeCloseTo(0, 12);
    expect(f.height(2)).toBeCloseTo(-0.5 * g * 4, 12);
  });
});

describe("A.2 Newton's laws: connected bodies", () => {
  it('Atwood machine: a = (m₁ − m₂)g/(m₁ + m₂), T = 2m₁m₂g/(m₁ + m₂)', () => {
    const p = new Pulley({ mode: 'atwood', m1: 3, m2: 2, muS: 0, muD: 0, g, L: 10 });
    expect(p.a).toBeCloseTo(g / 5, 12);
    expect(p.tension).toBeCloseTo((2 * 3 * 2 * g) / 5, 12);
    // Newton II for each mass separately
    expect(3 * g - p.tension).toBeCloseTo(3 * p.a, 12);
    expect(p.tension - 2 * g).toBeCloseTo(2 * p.a, 12);
    for (let i = 0; i < 10000; i++) p.step(1e-4);
    expect(p.s).toBeCloseTo(0.5 * p.a * 1, 9);
  });
  it('table: stays at rest while m₂g ≤ μ_s m₁g', () => {
    const p = new Pulley({ mode: 'table', m1: 4, m2: 1.5, muS: 0.4, muD: 0.3, g, L: 2 });
    expect(p.moves).toBe(false);
    p.step(0.5);
    expect(p.s).toBe(0);
    expect(p.friction).toBeCloseTo(1.5 * g, 12);
  });
  it('table: a = (m₂ − μ_d m₁)g/(m₁ + m₂) once it moves; tension and friction consistent', () => {
    const p = new Pulley({ mode: 'table', m1: 2, m2: 1.5, muS: 0.4, muD: 0.3, g, L: 2 });
    expect(p.moves).toBe(true);
    const a = ((1.5 - 0.6) * g) / 3.5;
    expect(p.a).toBeCloseTo(a, 12);
    expect(p.tension - p.friction).toBeCloseTo(2 * a, 12);
    expect(1.5 * g - p.tension).toBeCloseTo(1.5 * a, 12);
  });
});
