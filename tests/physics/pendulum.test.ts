import { describe, expect, it } from 'vitest';
import { Pendulum } from '../../src/physics/pendulum';
import { pendulumPeriodExact } from '../../src/core/special';

const dt = 1e-3; // the step used by the simulation
const deg = Math.PI / 180;

function run(p: Pendulum, seconds: number) {
  const n = Math.round(seconds / dt);
  for (let i = 0; i < n; i++) p.step(dt);
}

describe('C.1 pendulum', () => {
  it('small amplitude: period = 2π√(l/g) (booklet), within the θ₀²/16 correction', () => {
    const p = new Pendulum({ l: 1, m: 1, g: 9.8, b: 0, theta0: 0.01 });
    run(p, 10);
    const T0 = 2 * Math.PI * Math.sqrt(1 / 9.8);
    // exact relative correction is θ₀²/16 = 6.25e-6
    expect(Math.abs(p.measuredPeriod / T0 - 1)).toBeLessThan(1e-5);
  });

  it.each([30, 90, 120, 170])('θ₀ = %i°: period matches the exact elliptic-integral result', (a) => {
    const l = 0.8;
    const p = new Pendulum({ l, m: 0.5, g: 9.8, b: 0, theta0: a * deg });
    const T = pendulumPeriodExact(l, 9.8, a * deg);
    run(p, 4 * T);
    expect(Math.abs(p.measuredPeriod - T) / T).toBeLessThan(1e-6);
  });

  it('large amplitude period is longer than the small-angle formula (90° → +18.0%)', () => {
    const T = pendulumPeriodExact(1, 9.8, 90 * deg);
    const T0 = 2 * Math.PI * Math.sqrt(1 / 9.8);
    expect(T / T0).toBeCloseTo(1.18034, 4);
  });

  it('undamped: total energy conserved to 1e-8 over 1000 periods at 90°', () => {
    const p = new Pendulum({ l: 1, m: 2, g: 9.8, b: 0, theta0: 90 * deg });
    const E0 = p.E;
    const T = pendulumPeriodExact(1, 9.8, 90 * deg);
    const n = Math.round((1000 * T) / dt);
    let maxErr = 0;
    for (let i = 0; i < n; i++) {
      p.step(dt);
      if (i % 97 === 0) maxErr = Math.max(maxErr, Math.abs(p.E - E0) / E0);
    }
    expect(maxErr).toBeLessThan(1e-8);
  });

  it('damped small-angle ghost matches the analytic underdamped solution', () => {
    const l = 1;
    const g = 9.8;
    const m = 0.5;
    const b = 0.1; // γ = b/m = 0.2 s⁻¹
    const th0 = 0.2;
    const p = new Pendulum({ l, m, g, b, theta0: th0 });
    run(p, 10);
    const gamma = b / m;
    const w0 = Math.sqrt(g / l);
    const wd = Math.sqrt(w0 * w0 - (gamma * gamma) / 4);
    const t = p.t;
    const exact = th0 * Math.exp((-gamma * t) / 2) * (Math.cos(wd * t) + (gamma / (2 * wd)) * Math.sin(wd * t));
    expect(Math.abs(p.thetaSmall - exact)).toBeLessThan(1e-9);
  });

  it('damping removes energy monotonically', () => {
    const p = new Pendulum({ l: 1, m: 1, g: 9.8, b: 0.3, theta0: 60 * deg });
    let prev = p.E;
    for (let i = 0; i < 20000; i++) {
      p.step(dt);
      if (i % 50 === 0) {
        expect(p.E).toBeLessThanOrEqual(prev + 1e-12);
        prev = p.E;
      }
    }
  });

  it('mass does not change the motion (only the energy)', () => {
    const a = new Pendulum({ l: 1, m: 0.1, g: 9.8, b: 0, theta0: 1 });
    const b = new Pendulum({ l: 1, m: 10, g: 9.8, b: 0, theta0: 1 });
    run(a, 3);
    run(b, 3);
    expect(a.theta).toBe(b.theta);
    expect(b.E / a.E).toBeCloseTo(100, 10);
  });

  it('tension at the bottom of a swing released from 90° is 3mg', () => {
    const p = new Pendulum({ l: 1, m: 1, g: 9.8, b: 0, theta0: 90 * deg });
    let maxT = 0;
    for (let i = 0; i < 3000; i++) {
      p.step(dt);
      maxT = Math.max(maxT, p.tension);
    }
    expect(maxT / (3 * 9.8)).toBeCloseTo(1, 5);
  });
});
