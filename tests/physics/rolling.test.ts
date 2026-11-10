import { describe, expect, it } from 'vitest';
import { shapes, motionOf, racerAt, type RollParams } from '../../src/physics/rolling';

const deg = Math.PI / 180;
const base: RollParams = { theta: 20 * deg, L: 3, muS: 0.6, muD: 0.4, m: 2, r: 0.1, g: 9.8 };
const shape = (id: string) => shapes.find((s) => s.id === id)!;

describe('A.4 rolling race', () => {
  it('rolling without slipping: a = g sinθ/(1 + I/mr²)', () => {
    for (const [id, k] of [
      ['sphere', 0.4],
      ['cylinder', 0.5],
      ['shell', 2 / 3],
      ['hoop', 1],
    ] as const) {
      const M = motionOf(shape(id), base);
      expect(M.rolls).toBe(true);
      expect(M.a).toBeCloseTo((9.8 * Math.sin(20 * deg)) / (1 + k), 12);
      expect(M.alpha * base.r).toBeCloseTo(M.a, 12);
    }
  });

  it('finishing order: block, sphere, cylinder, hollow sphere, hoop — independent of m and r', () => {
    const times = shapes.map((s) => racerAt(s, base, 99).tEnd);
    for (let i = 1; i < times.length; i++) expect(times[i]).toBeGreaterThan(times[i - 1]);
    const other = shapes.map((s) => racerAt(s, { ...base, m: 50, r: 0.7 }, 99).tEnd);
    other.forEach((t, i) => expect(t).toBeCloseTo(times[i], 12));
  });

  it('energy: mgh = ½mv² + ½Iω² at the bottom (rolling)', () => {
    for (const id of ['sphere', 'cylinder', 'shell', 'hoop']) {
      const R = racerAt(shape(id), base, 99);
      const mgh = base.m * base.g * base.L * Math.sin(base.theta);
      expect(R.KEtrans + R.KErot).toBeCloseTo(mgh, 10);
      // share of rotational energy = k/(1+k)
      expect(R.KErot / mgh).toBeCloseTo(shape(id).k / (1 + shape(id).k), 10);
    }
  });

  it('steep slope with little friction: rolls with slipping, energy lost as heat', () => {
    const p = { ...base, theta: 50 * deg, muS: 0.2, muD: 0.15 };
    const M = motionOf(shape('hoop'), p);
    expect(M.rolls).toBe(false);
    expect(M.a).toBeCloseTo(9.8 * (Math.sin(50 * deg) - 0.15 * Math.cos(50 * deg)), 12);
    const R = racerAt(shape('hoop'), p, 99);
    const mgh = p.m * p.g * p.L * Math.sin(p.theta);
    expect(R.KEtrans + R.KErot + R.heat).toBeCloseTo(mgh, 9);
    expect(R.heat).toBeGreaterThan(0);
  });

  it('no-slip condition: tanθ ≤ μ_s(1 + k)/k', () => {
    const k = 0.5;
    const thMax = Math.atan((0.3 * (1 + k)) / k);
    expect(motionOf(shape('cylinder'), { ...base, muS: 0.3, theta: thMax - 1e-6 }).rolls).toBe(true);
    expect(motionOf(shape('cylinder'), { ...base, muS: 0.3, theta: thMax + 1e-6 }).rolls).toBe(false);
  });
});
