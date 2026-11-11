import { describe, expect, it } from 'vitest';
import { dampedMotion, period, shm, wrapPhase } from '../../src/physics/oscillator';
import { RK4 } from '../../src/core/integrators';

describe('C.1 mass–spring oscillator', () => {
  const m = 0.5;
  const k = 20;
  it('T = 2π√(m/k): zero crossings are half a period apart (no damping)', () => {
    const T = period(m, k);
    const crossings: number[] = [];
    let prev = dampedMotion(m, k, 0, 0.1, 0, 0).x;
    const dt = T / 20000;
    for (let t = dt; t < 3 * T; t += dt) {
      const x = dampedMotion(m, k, 0, 0.1, 0, t).x;
      if (prev > 0 !== x > 0) crossings.push(t - (dt * x) / (x - prev));
      prev = x;
    }
    expect(crossings[2] - crossings[0]).toBeCloseTo(T, 6);
  });

  it('(HL) x = x₀ sin(ωt + φ); v = ±ω√(x₀² − x²); energy ½kx² + ½mv² is constant', () => {
    const w = Math.sqrt(k / m);
    const x0 = 0.08;
    const phi = 0.7;
    for (const t of [0, 0.13, 0.5, 1.7]) {
      const s = dampedMotion(m, k, 0, x0 * Math.sin(phi), w * x0 * Math.cos(phi), t);
      expect(s.x).toBeCloseTo(x0 * Math.sin(w * t + phi), 12);
      expect(Math.abs(s.v)).toBeCloseTo(w * Math.sqrt(x0 * x0 - s.x * s.x), 10);
      expect(0.5 * k * s.x ** 2 + 0.5 * m * s.v ** 2).toBeCloseTo(0.5 * m * w * w * x0 * x0, 12);
      expect(s.a).toBeCloseTo(-w * w * s.x, 10);
    }
  });

  it('damped motion agrees with RK4 integration in all three regimes', () => {
    for (const b of [0.8, 2 * Math.sqrt(k * m), 15]) {
      const y = new Float64Array([0.1, 0.3]);
      const rk = new RK4(2);
      const f = (_t: number, s: Float64Array, o: Float64Array) => {
        o[0] = s[1];
        o[1] = (-k * s[0] - b * s[1]) / m;
      };
      const h = 1e-4;
      for (let i = 0; i < 20000; i++) rk.step(f, i * h, y, h);
      const ex = dampedMotion(m, k, b, 0.1, 0.3, 2);
      expect(y[0]).toBeCloseTo(ex.x, 10);
      expect(y[1]).toBeCloseTo(ex.v, 10);
    }
  });

  it('critical damping returns without overshoot; light damping: amplitude envelope e^(−bt/2m)', () => {
    const bc = 2 * Math.sqrt(k * m);
    for (let t = 0; t < 3; t += 0.01) expect(dampedMotion(m, k, bc, 0.1, 0, t).x).toBeGreaterThanOrEqual(0);
    const b = 0.4;
    const T = period(m, k);
    const g = b / (2 * m);
    // compare successive maxima (t ≈ nT_d); ratio e^{−γT_d}
    const Td = (2 * Math.PI) / Math.sqrt(k / m - g * g);
    const r = dampedMotion(m, k, b, 0.1, -g * 0.1, Td).x / 0.1;
    expect(r).toBeCloseTo(Math.exp(-g * Td), 10);
    expect(Td).toBeGreaterThan(T);
  });
});


describe('C.1 (HL) SHM, phase and the reference circle', () => {
  const x0 = 0.05;
  const w = 4;
  it('v = ±ω√(x₀² − x²), a = −ω²x, Eₖ = ½mω²(x₀² − x²), E_T = ½mω²x₀²', () => {
    const m = 0.3;
    for (const t of [0, 0.2, 0.9, 2.5]) {
      const s = shm(x0, w, 0.4, t);
      expect(Math.abs(s.v)).toBeCloseTo(w * Math.sqrt(x0 * x0 - s.x * s.x), 12);
      expect(s.a).toBeCloseTo(-w * w * s.x, 12);
      expect(0.5 * m * s.v * s.v).toBeCloseTo(0.5 * m * w * w * (x0 * x0 - s.x * s.x), 14);
      expect(0.5 * m * s.v * s.v + 0.5 * m * w * w * s.x * s.x).toBeCloseTo(0.5 * m * w * w * x0 * x0, 14);
    }
  });

  it('the projection of a point moving round a circle at ω is SHM; a phase difference Δφ shifts it by Δφ/ω in time', () => {
    for (const t of [0.1, 0.7, 1.3]) {
      const ang = w * t + 0.4;
      expect(shm(x0, w, 0.4, t).x).toBeCloseTo(x0 * Math.sin(ang), 14); // y-projection of the phasor
      expect(shm(x0, w, 0.4 + Math.PI / 2, t).x).toBeCloseTo(shm(x0, w, 0.4, t + Math.PI / 2 / w).x, 12);
    }
    expect(wrapPhase(3 * Math.PI / 2)).toBeCloseTo(-Math.PI / 2, 14);
    expect(wrapPhase(-Math.PI)).toBeCloseTo(Math.PI, 14);
  });
});
