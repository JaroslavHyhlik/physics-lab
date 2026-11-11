import { describe, expect, it } from 'vitest';
import { ARCSEC, PC_IN_AU, apparentOffset, distancePc } from '../../src/physics/parallax';

const extent = (dPc: number, beta: number) => {
  let e0 = Infinity;
  let e1 = -Infinity;
  let n0 = Infinity;
  let n1 = -Infinity;
  for (let i = 0; i < 2000; i++) {
    const [e, n] = apparentOffset(i / 2000, dPc, beta);
    e0 = Math.min(e0, e);
    e1 = Math.max(e1, e);
    n0 = Math.min(n0, n);
    n1 = Math.max(n1, n);
  }
  return { east: (e1 - e0) / 2, north: (n1 - n0) / 2 };
};

describe('E.5 stellar parallax', () => {
  it('d (pc) = 1/p (″); 1 pc ≈ 206 265 AU', () => {
    expect(distancePc(0.768)).toBeCloseTo(1.302, 3);
    expect(PC_IN_AU).toBeCloseTo(206265, 0);
  });

  it('the star traces an ellipse: semi-axes p (east–west) and p sin β (north–south)', () => {
    for (const [d, betaDeg] of [
      [1.3, -44.8],
      [7.7, 61.7],
      [100, 10],
    ]) {
      const beta = (betaDeg * Math.PI) / 180;
      const p = 1 / d;
      const x = extent(d, beta);
      expect(Math.abs(x.east / p - 1)).toBeLessThan(1e-4);
      expect(Math.abs(x.north / (p * Math.abs(Math.sin(beta))) - 1)).toBeLessThan(1e-3);
    }
  });

  it('at the ecliptic pole the shift is a circle of radius p; tan p = 1 AU/d exactly', () => {
    const d = 2;
    const x = extent(d, Math.PI / 2);
    const p = Math.atan(1 / (d * PC_IN_AU)) / ARCSEC;
    expect(x.east).toBeCloseTo(p, 6);
    expect(x.north).toBeCloseTo(p, 6);
  });
});
