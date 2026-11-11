import { describe, expect, it } from 'vitest';
import { NBody, figureEight } from '../../src/physics/nbody';
import { AU } from '../../src/core/constants';

const MSUN = 1.989e30;

describe('D.1 N-body gravity', () => {
  it('figure-eight: the three bodies return to their starting positions after one period', () => {
    const { bodies, period } = figureEight(AU, MSUN);
    const s = new NBody();
    const start = bodies.map((b) => ({ ...b }));
    bodies.forEach((b) => s.add(b));
    const E0 = s.energy;
    s.advance(period, 0.002, false);
    for (let i = 0; i < 3; i++) {
      expect(Math.hypot(s.bodies[i].x - start[i].x, s.bodies[i].y - start[i].y) / AU).toBeLessThan(1e-4);
    }
    expect(Math.abs(s.energy / E0 - 1)).toBeLessThan(1e-8);
  });

  it('total momentum is conserved, also when bodies merge', () => {
    const s = new NBody();
    s.add({ x: 0, y: 0, vx: 0, vy: 0, m: MSUN, r: 7e8 });
    s.add({ x: AU, y: 0, vx: 0, vy: 2e4, m: 6e24, r: 6.4e6 });
    s.add({ x: -0.3 * AU, y: 0.01 * AU, vx: 5e4, vy: 0, m: 1e27, r: 7e7 }); // falls into the star
    const [px0, py0] = s.momentum;
    const scale = Math.hypot(...s.bodies.map((b) => b.m * Math.hypot(b.vx, b.vy)));
    s.advance(3e7);
    const [px, py] = s.momentum;
    expect(s.merges).toBeGreaterThan(0);
    expect(Math.abs(px - px0) / scale).toBeLessThan(1e-10);
    expect(Math.abs(py - py0) / scale).toBeLessThan(1e-10);
  });
});
