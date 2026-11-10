import { describe, expect, it } from 'vitest';
import { DriftCar, steadyYawRate, type DriftParams } from '../../src/physics/drift';

const base: DriftParams = { m: 1300, a: 1.2, b: 1.4, Iz: 2000, muS: 1.0, muD: 0.8, Ck: 12, Pmax: 200e3, g: 9.8, CdA: 0, rho: 1.2 };
const dt = 1e-3;

describe('A.2 car drift (tyre model)', () => {
  it('coasting straight with no drag keeps a constant speed', () => {
    const c = new DriftCar(base);
    c.reset(undefined, 20);
    for (let i = 0; i < 3000; i++) c.step(dt);
    expect(c.y[3]).toBeCloseTo(20, 9);
    expect(c.y[0]).toBeCloseTo(60, 6);
  });

  it('gentle steady cornering matches the linear bicycle model r = vδ/(L + Kv²)', () => {
    const c = new DriftCar(base);
    c.reset(undefined, 15);
    c.ctl.steer = 0.01;
    // keep the speed with a little throttle balancing the tyre drag in a turn
    for (let i = 0; i < 8000; i++) c.step(dt);
    const r = c.y[5];
    expect(r / steadyYawRate(base, c.y[3], 0.01)).toBeCloseTo(1, 2);
    expect(c.front.sliding || c.rear.sliding).toBe(false);
  });

  it('friction circle: no tyre force ever exceeds μ_s F_N', () => {
    const c = new DriftCar(base);
    c.reset(undefined, 25);
    c.ctl.steer = 0.35;
    c.ctl.throttle = 1;
    for (let i = 0; i < 6000; i++) {
      c.step(dt);
      for (const ax of [c.front, c.rear]) expect(Math.hypot(ax.fx, ax.fy)).toBeLessThanOrEqual(base.muS * ax.Fz * (1 + 1e-9));
    }
  });

  it('cornering acceleration never exceeds about μ_s g', () => {
    const c = new DriftCar(base);
    c.reset(undefined, 25);
    c.ctl.steer = 0.4;
    let maxA = 0;
    for (let i = 0; i < 6000; i++) {
      c.step(dt);
      maxA = Math.max(maxA, Math.abs(c.latAccel));
    }
    expect(maxA).toBeLessThanOrEqual(base.muS * base.g * 1.0001);
  });

  it('locked wheels (sliding): stopping distance v²/(2μ_d g)', () => {
    const c = new DriftCar(base);
    const v = 20;
    c.reset(undefined, v);
    c.ctl.brake = 1; // asks for more than μ_s F_N → both axles slide
    let guard = 0;
    let slidingWhileBraking = true;
    while (c.y[3] > 0.02 && guard++ < 1e5) {
      c.step(dt);
      if (c.y[3] > 1) slidingWhileBraking &&= c.front.sliding && c.rear.sliding;
    }
    expect(slidingWhileBraking).toBe(true);
    expect(c.y[0] / ((v * v) / (2 * base.muD * base.g))).toBeCloseTo(1, 2);
  });

  it('power oversteer: full throttle in a tight turn breaks the rear loose (drift)', () => {
    const c = new DriftCar(base);
    c.reset(undefined, 15);
    c.ctl.steer = 0.25;
    c.ctl.throttle = 1;
    let drifted = false;
    for (let i = 0; i < 4000; i++) {
      c.step(dt);
      if (c.rear.sliding && Math.abs(c.beta) > 0.1) drifted = true;
    }
    expect(drifted).toBe(true);
  });
});
