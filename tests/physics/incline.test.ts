import { describe, expect, it } from 'vitest';
import { Incline, type InclineParams } from '../../src/physics/incline';

const deg = Math.PI / 180;
const g = 9.8;
const base: InclineParams = { theta: 30 * deg, m: 2, muS: 0.5, muD: 0.4, F: 0, L: 100, s0: 50, u: 0, g, friction: true };
const dt = 1e-3;
const run = (b: Incline, T: number) => {
  for (let i = 0; i < Math.round(T / dt); i++) b.step(dt);
};

describe('A.2 inclined plane with friction', () => {
  it('stays at rest when tanθ ≤ μ_s; static friction = mg sinθ', () => {
    const b = new Incline({ ...base, theta: 25 * deg }); // tan 25° = 0.466 < 0.5
    run(b, 3);
    expect(b.s).toBe(50);
    expect(b.friction).toBeCloseTo(2 * g * Math.sin(25 * deg), 12);
    expect(b.isStatic).toBe(true);
  });

  it('slides down when tanθ > μ_s with a = g(sinθ − μ_d cosθ)', () => {
    const b = new Incline({ ...base, theta: 35 * deg });
    const a = g * (Math.sin(35 * deg) - 0.4 * Math.cos(35 * deg));
    run(b, 2);
    expect(b.a).toBeCloseTo(-a, 12);
    expect(b.s).toBeCloseTo(50 - 0.5 * a * 4, 9);
    expect(b.v).toBeCloseTo(-a * 2, 9);
  });

  it('pushed up the slope: stops after u²/(2g(sinθ + μ_d cosθ)), then stays (tanθ < μ_s)', () => {
    const u = 6;
    const b = new Incline({ ...base, theta: 20 * deg, u });
    run(b, 5);
    const d = (u * u) / (2 * g * (Math.sin(20 * deg) + 0.4 * Math.cos(20 * deg)));
    expect(b.s - 50).toBeCloseTo(d, 9);
    expect(b.v).toBe(0);
  });

  it('pushed up a steep slope: stops, then slides back down with the smaller acceleration', () => {
    const u = 5;
    const th = 40 * deg;
    const b = new Incline({ ...base, theta: th, u });
    const aUp = g * (Math.sin(th) + 0.4 * Math.cos(th));
    const aDown = g * (Math.sin(th) - 0.4 * Math.cos(th));
    const tStop = u / aUp;
    run(b, tStop + 1);
    const sTop = 50 + (u * u) / (2 * aUp);
    const tDown = b.t - tStop;
    expect(b.s).toBeCloseTo(sTop - 0.5 * aDown * tDown * tDown, 8);
    expect(b.v).toBeCloseTo(-aDown * tDown, 8);
  });

  it('applied force: starts moving up only when F > mg sinθ + μ_s mg cosθ', () => {
    const th = 30 * deg;
    const Fc = 2 * g * (Math.sin(th) + 0.5 * Math.cos(th));
    const below = new Incline({ ...base, F: Fc - 0.01 });
    run(below, 1);
    expect(below.s).toBe(50);
    const above = new Incline({ ...base, F: Fc + 0.5 });
    run(above, 1);
    expect(above.s).toBeGreaterThan(50);
    expect(above.a).toBeCloseTo((Fc + 0.5 - 2 * g * (Math.sin(th) + 0.4 * Math.cos(th))) / 2, 12);
  });

  it('energy: ΔE_k + ΔE_p + thermal energy = work done by the applied force', () => {
    const b = new Incline({ ...base, theta: 38 * deg, u: 7, F: 3 });
    const E0 = b.Ek + b.Ep;
    run(b, 6);
    expect(b.Ek + b.Ep + b.heat - E0).toBeCloseTo(b.workF, 9);
  });

  it('frictionless: a = −g sinθ and mechanical energy is conserved', () => {
    const b = new Incline({ ...base, friction: false, u: 3 });
    const E0 = b.Ek + b.Ep;
    run(b, 2);
    expect(b.a).toBeCloseTo(-g * 0.5, 12);
    expect(b.Ek + b.Ep).toBeCloseTo(E0, 9);
  });

  it('critical angle = tan⁻¹ μ_s', () => {
    expect(new Incline(base).criticalAngle).toBeCloseTo(Math.atan(0.5), 14);
  });
});
