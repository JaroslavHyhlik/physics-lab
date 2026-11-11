import { describe, expect, it } from 'vitest';
import { StringFD, pulse } from '../../src/physics/stringWave';

/** position of the largest |y| on the string */
const peak = (s: StringFD) => {
  let k = 0;
  for (let i = 0; i < s.y.length; i++) if (Math.abs(s.y[i]) > Math.abs(s.y[k])) k = i;
  return { x: k * s.dx, y: s.y[k] };
};

describe('C.2 wave on a string', () => {
  it('a pulse travels at v = √(T/μ)', () => {
    const s = new StringFD({ L: 10, N: 1000, T: 20, mu1: 0.05, mu2: 0.05, join: 99, end: 'open' });
    const v = Math.sqrt(20 / 0.05); // 20 m/s
    s.drive = pulse(0.05, 0.05);
    const dt = s.maxDt;
    while (s.t < 0.2) s.step(dt);
    const p1 = peak(s);
    const t1 = s.t;
    while (s.t < 0.35) s.step(dt);
    const p2 = peak(s);
    expect((p2.x - p1.x) / (s.t - t1)).toBeCloseTo(v, 0);
    expect(Math.abs((p2.x - p1.x) / (s.t - t1) / v - 1)).toBeLessThan(0.01);
  });

  it('reflection at a fixed end inverts the pulse; at a free end it does not', () => {
    for (const end of ['fixed', 'free'] as const) {
      const s = new StringFD({ L: 5, N: 500, T: 20, mu1: 0.05, mu2: 0.05, join: 99, end });
      s.drive = pulse(0.05, 0.05);
      const dt = s.maxDt;
      while (s.t < 0.38) s.step(dt); // pulse has reflected and is on its way back
      const p = peak(s);
      expect(p.x).toBeLessThan(4.5);
      if (end === 'fixed') expect(p.y).toBeLessThan(-0.045);
      else expect(p.y).toBeGreaterThan(0.045);
    }
  });

  it('at a join to a heavier string part of the pulse is reflected inverted, r = (Z₁ − Z₂)/(Z₁ + Z₂)', () => {
    const mu1 = 0.05;
    const mu2 = 0.2;
    const s = new StringFD({ L: 10, N: 2000, T: 20, mu1, mu2, join: 4, end: 'open' });
    s.drive = pulse(0.05, 0.08);
    const dt = s.maxDt;
    while (s.t < 0.36) s.step(dt);
    // reflected pulse is on the light side (x < 4), transmitted one on the heavy side
    let rmin = 0;
    let tmax = 0;
    for (let i = 0; i < s.y.length; i++) {
      const x = i * s.dx;
      if (x < 4) rmin = Math.min(rmin, s.y[i]);
      else tmax = Math.max(tmax, s.y[i]);
    }
    const Z1 = Math.sqrt(20 * mu1);
    const Z2 = Math.sqrt(20 * mu2);
    expect(rmin / 0.05).toBeCloseTo((Z1 - Z2) / (Z1 + Z2), 1);
    expect(tmax / 0.05).toBeCloseTo((2 * Z1) / (Z1 + Z2), 1);
  });
});
