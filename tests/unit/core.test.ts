import { describe, expect, it } from 'vitest';
import {
  RK4,
  DormandPrince45,
  velocityVerlet,
  yoshida4,
  borisPush,
  type Derivative,
  type Acceleration,
} from '../../src/core/integrators';
import { FixedStepper } from '../../src/core/loop';
import { Rng } from '../../src/core/rng';
import { ellipticK, pendulumPeriodExact } from '../../src/core/special';
import { Recorder } from '../../src/core/recorder';
import { toCsv } from '../../src/core/csv';
import { fmt } from '../../src/core/format';

// y' = -y, exact y = e^-t
const decay: Derivative = (_t, y, out) => {
  out[0] = -y[0];
};
// harmonic oscillator x'' = -x (ω = 1)
const sho: Acceleration = (x, _t, out) => {
  out[0] = -x[0];
};

function rk4Error(h: number): number {
  const rk = new RK4(1);
  const y = new Float64Array([1]);
  const n = Math.round(1 / h);
  for (let i = 0; i < n; i++) rk.step(decay, i * h, y, h);
  return Math.abs(y[0] - Math.exp(-1));
}

function symplecticError(method: typeof yoshida4, h: number, T = 10): number {
  const x = new Float64Array([1]);
  const v = new Float64Array([0]);
  const a = new Float64Array(1);
  sho(x, 0, a);
  const n = Math.round(T / h);
  for (let i = 0; i < n; i++) method(x, v, a, h, i * h, sho);
  return Math.abs(x[0] - Math.cos(T));
}

describe('integrators: order of accuracy', () => {
  it('RK4 is 4th order (halving h reduces the error ~16×)', () => {
    const ratio = rk4Error(0.1) / rk4Error(0.05);
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(18);
  });

  it('velocity Verlet is 2nd order (~4×)', () => {
    const ratio = symplecticError(velocityVerlet, 0.02) / symplecticError(velocityVerlet, 0.01);
    expect(ratio).toBeGreaterThan(3.7);
    expect(ratio).toBeLessThan(4.3);
  });

  it('Yoshida is 4th order (~16×)', () => {
    const ratio = symplecticError(yoshida4, 0.04) / symplecticError(yoshida4, 0.02);
    expect(ratio).toBeGreaterThan(14);
    expect(ratio).toBeLessThan(18);
  });

  it('Dormand–Prince reaches the requested tolerance', () => {
    const dp = new DormandPrince45(1);
    const y = new Float64Array([1]);
    dp.integrate((_t, yy, out) => (out[0] = yy[0]), 0, 1, y, 0.1, 1e-12, 1e-12);
    expect(Math.abs(y[0] - Math.E)).toBeLessThan(1e-10);
  });
});

describe('integrators: conservation', () => {
  it('Yoshida keeps harmonic-oscillator energy bounded over 10⁵ steps (no drift)', () => {
    const x = new Float64Array([1]);
    const v = new Float64Array([0]);
    const a = new Float64Array(1);
    const h = 0.01;
    let maxErr = 0;
    for (let i = 0; i < 100000; i++) {
      yoshida4(x, v, a, h, i * h, sho);
      maxErr = Math.max(maxErr, Math.abs(0.5 * (x[0] ** 2 + v[0] ** 2) - 0.5));
    }
    expect(maxErr / 0.5).toBeLessThan(1e-8);
  });

  it('Boris pusher: magnetic field does no work, radius r = mv/(qB)', () => {
    const q = 1.6e-19;
    const m = 1.673e-27;
    const B = 0.5;
    const v0 = 1e5;
    const r = (m * v0) / (q * B);
    const period = (2 * Math.PI * m) / (q * B);
    const h = period / 2000;
    const x = new Float64Array([0, 0, 0]);
    const v = new Float64Array([v0, 0, 0]);
    let maxY = 0;
    for (let i = 0; i < 20000; i++) {
      borisPush(x, v, [0, 0, 0], [0, 0, B], q / m, h);
      maxY = Math.max(maxY, Math.abs(x[1]));
    }
    expect(Math.abs(Math.hypot(v[0], v[1], v[2]) - v0) / v0).toBeLessThan(1e-12);
    // circle diameter 2r; discretisation error O(h²)
    expect(Math.abs(maxY - 2 * r) / (2 * r)).toBeLessThan(1e-4);
  });
});

describe('FixedStepper', () => {
  it('gives the same number of steps at 30, 60 and 144 fps', () => {
    const counts = [30, 60, 144].map((fps) => {
      const s = new FixedStepper(0.001);
      let n = 0;
      for (let i = 0; i < fps * 2; i++) s.advance(1 / fps, () => n++);
      return n;
    });
    for (const n of counts) expect(Math.abs(n - 2000)).toBeLessThanOrEqual(1);
  });

  it('time scale changes only how many steps run', () => {
    const s = new FixedStepper(0.001);
    s.timeScale = 0.25;
    for (let i = 0; i < 60; i++) s.advance(1 / 60, () => {});
    expect(s.time).toBeCloseTo(0.25, 3);
  });

  it('caps steps per frame and clamps long pauses', () => {
    const s = new FixedStepper(0.001, 50);
    const n = s.advance(5, () => {});
    expect(n).toBe(50);
    expect(s.dropped).toBe(50);
  });
});

describe('special functions', () => {
  it('K(0) = π/2 and K(1/√2) = 1.854074677301372', () => {
    expect(ellipticK(0)).toBeCloseTo(Math.PI / 2, 14);
    expect(ellipticK(Math.SQRT1_2)).toBeCloseTo(1.854074677301372, 13);
  });
  it('exact pendulum period tends to 2π√(l/g) for small amplitude', () => {
    const T0 = 2 * Math.PI * Math.sqrt(1 / 9.8);
    expect(pendulumPeriodExact(1, 9.8, 1e-6) / T0).toBeCloseTo(1, 12);
    // known series: T ≈ T0 (1 + θ²/16) for small θ
    const th = 0.1;
    expect(pendulumPeriodExact(1, 9.8, th) / T0 - 1).toBeCloseTo(th * th / 16, 6);
  });
});

describe('Rng', () => {
  it('is reproducible with a seed', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });
  it('uniform mean and gaussian variance are correct within 4σ', () => {
    const r = new Rng(7);
    const N = 200000;
    let s = 0;
    let s2 = 0;
    let g = 0;
    for (let i = 0; i < N; i++) {
      s += r.next();
      const z = r.gaussian();
      g += z;
      s2 += z * z;
    }
    expect(Math.abs(s / N - 0.5)).toBeLessThan(4 * Math.sqrt(1 / 12 / N));
    expect(Math.abs(g / N)).toBeLessThan(4 / Math.sqrt(N));
    expect(Math.abs(s2 / N - 1)).toBeLessThan(4 * Math.sqrt(2 / N));
  });
});

describe('Recorder and CSV', () => {
  it('keeps contiguous data and drops the oldest half when full', () => {
    const rec = new Recorder([{ key: 't', label: 't', unit: 's' }], 10);
    for (let i = 0; i < 12; i++) rec.push([i]);
    expect(rec.length).toBe(7);
    expect(Array.from(rec.view(0))).toEqual([5, 6, 7, 8, 9, 10, 11]);
  });

  it('writes English and Czech-Excel CSV', () => {
    const cols = [
      { label: 't', unit: 's', data: [0, 0.1 + 0.2] },
      { label: 'x', unit: 'm', data: [1.5, -2] },
    ];
    expect(toCsv(cols, 'en')).toBe('t (s),x (m)\r\n0,1.5\r\n0.3,-2\r\n');
    expect(toCsv(cols, 'cz')).toBe('t (s);x (m)\r\n0;1,5\r\n0,3;-2\r\n');
  });

  it('formats numbers with significant figures', () => {
    expect(fmt(2.5, 3)).toBe('2.50');
    expect(fmt(-0.000012345, 3)).toBe('−1.23 × 10⁻⁵');
    expect(fmt(123456, 3)).toBe('1.23 × 10⁵');
    expect(fmt(9.8, 2)).toBe('9.8');
  });
});
