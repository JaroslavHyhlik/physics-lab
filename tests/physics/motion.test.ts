import { describe, expect, it } from 'vitest';
import { Mover, scripts } from '../../src/physics/motion';

const dt = 1e-3;

describe('A.1 motion graphs', () => {
  it('constant acceleration is exact: s = ut + ½at², v = u + at, v² = u² + 2as', () => {
    const m = new Mover();
    m.mode = 'acc';
    m.input = 0.7;
    m.reset(-5, 1.2);
    for (let i = 0; i < 4000; i++) m.step(dt);
    const t = 4;
    expect(m.x).toBeCloseTo(-5 + 1.2 * t + 0.5 * 0.7 * t * t, 9);
    expect(m.v).toBeCloseTo(1.2 + 0.7 * t, 9);
    expect(m.v ** 2).toBeCloseTo(1.2 ** 2 + 2 * 0.7 * (m.x + 5), 8);
  });

  it('area under the v–t graph = displacement; gradient of x–t = v', () => {
    const m = new Mover();
    m.mode = 'script';
    m.script = scripts.trip.s;
    m.reset(m.script.x0, m.script.u);
    const xs: number[] = [];
    const vs: number[] = [];
    for (let i = 0; i <= 10000; i++) {
      xs.push(m.x);
      vs.push(m.v);
      m.step(dt);
    }
    let area = 0;
    for (let i = 1; i < vs.length; i++) area += 0.5 * (vs[i] + vs[i - 1]) * dt;
    expect(area).toBeCloseTo(xs[xs.length - 1] - xs[0], 6);
    for (const i of [1500, 4000, 7000]) {
      const grad = (xs[i + 1] - xs[i - 1]) / (2 * dt);
      expect(grad).toBeCloseTo(vs[i], 3);
    }
    // trip: 2 s at 1 m s⁻², 4 s cruising at 2 m s⁻¹, 2 s at −1 m s⁻² → 2 + 8 + 2 = 12 m
    expect(xs[10000] - xs[0]).toBeCloseTo(12, 6);
  });

  it('velocity control: reaches the target speed with |a| ≤ a_max', () => {
    const m = new Mover();
    m.mode = 'vel';
    m.amax = 2;
    m.input = 3;
    m.reset(-9, 0);
    let maxA = 0;
    for (let i = 0; i < 3000; i++) {
      m.step(dt);
      maxA = Math.max(maxA, Math.abs(m.a));
    }
    expect(m.v).toBeCloseTo(3, 9);
    expect(maxA).toBeLessThanOrEqual(2 + 1e-12);
  });

  it('position control settles on the target without overshooting far', () => {
    const m = new Mover();
    m.mode = 'pos';
    m.input = 4;
    m.reset(0, 0);
    let maxX = 0;
    for (let i = 0; i < 10000; i++) {
      m.step(dt);
      maxX = Math.max(maxX, m.x);
    }
    expect(m.x).toBeCloseTo(4, 4);
    expect(maxX).toBeLessThan(4.05);
  });

  it('turn-round script: v = 0 at t = u/|a|, then returns', () => {
    const m = new Mover();
    m.mode = 'script';
    m.script = scripts.turn.s;
    m.reset(m.script.x0, m.script.u);
    for (let i = 0; i < 5000; i++) m.step(dt);
    expect(m.v).toBeCloseTo(0, 9);
    expect(m.x).toBeCloseTo(-6 + (3 * 3) / (2 * 0.6), 8);
  });
});
