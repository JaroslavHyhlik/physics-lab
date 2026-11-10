import { describe, expect, it } from 'vitest';
import { curveForces, idealSpeed, maxSpeed, minSpeed, CurveRun, type CurveParams } from '../../src/physics/bankedCurve';

const deg = Math.PI / 180;
const base: CurveParams = { m: 1200, r: 50, theta: 15 * deg, mu: 0.6, g: 9.8 };

describe('A.2 circular motion & banked curve', () => {
  it("Newton's second law: vertical forces balance, horizontal resultant = mv²/r", () => {
    for (const v of [5, 12, 20, 27]) {
      const F = curveForces(base, v);
      const c = Math.cos(base.theta);
      const s = Math.sin(base.theta);
      expect(F.N * c - F.f * s - base.m * base.g).toBeCloseTo(0, 8);
      expect(F.N * s + F.f * c).toBeCloseTo((base.m * v * v) / base.r, 8);
    }
  });

  it('ideal speed √(rg tanθ) needs no friction and N = mg/cosθ', () => {
    const v = idealSpeed(base);
    const F = curveForces(base, v);
    expect(F.f).toBeCloseTo(0, 8);
    expect(F.N).toBeCloseTo((base.m * base.g) / Math.cos(base.theta), 8);
    expect(F.regime).toBe('ideal');
  });

  it('at the maximum and minimum speeds friction is exactly μ_s N', () => {
    const p = { ...base, theta: 35 * deg, mu: 0.3 };
    const Fmax = curveForces(p, maxSpeed(p));
    expect(Fmax.f / Fmax.N).toBeCloseTo(0.3, 10);
    const Fmin = curveForces(p, minSpeed(p));
    expect(-Fmin.f / Fmin.N).toBeCloseTo(0.3, 10);
    expect(curveForces(p, maxSpeed(p) * 1.01).regime).toBe('slides-out');
    expect(curveForces(p, minSpeed(p) * 0.99).regime).toBe('slides-in');
  });

  it('flat road: v_max = √(μ_s g r)', () => {
    const p = { ...base, theta: 0 };
    expect(maxSpeed(p)).toBeCloseTo(Math.sqrt(0.6 * 9.8 * 50), 10);
    expect(minSpeed(p)).toBe(0);
  });

  it('steep bank with enough friction never slides out (tanθ ≥ 1/μ_s)', () => {
    expect(maxSpeed({ ...base, theta: 60 * deg, mu: 0.8 })).toBe(Infinity);
  });

  it('uniform circular motion: a = v²/r = 4π²r/T²', () => {
    const run = new CurveRun(50, 20);
    const T = run.period;
    expect((4 * Math.PI ** 2 * 50) / T ** 2).toBeCloseTo((20 * 20) / 50, 10);
    for (let i = 0; i < 1000; i++) run.step(T / 1000);
    expect(Math.min(run.phi, 2 * Math.PI - run.phi)).toBeLessThan(1e-9);
  });
});
