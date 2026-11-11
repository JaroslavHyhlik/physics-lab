import { describe, expect, it } from 'vitest';
import {
  GRAPHITE_D,
  braggAngle,
  fringeSpacing,
  momentum,
  ringRadius,
  sampleHit,
  slitIntensity,
  spacingFromRing,
  wavelength,
  wavelengthOf,
  wavelengthRelativistic,
} from '../../src/physics/deBroglie';
import { Rng } from '../../src/core/rng';
import { h, e, m_e } from '../../src/core/constants';

describe('E.2 (HL) matter waves', () => {
  it('λ = h/p = h/√(2 m_e eV): about 0.123 nm at 100 V, and λ ∝ 1/√V', () => {
    expect(wavelength(100)).toBeCloseTo(h / Math.sqrt(2 * m_e * e * 100), 25);
    expect(Math.abs(wavelength(100) / 1.23e-10 - 1)).toBeLessThan(5e-3);
    expect(wavelength(400) / wavelength(100)).toBeCloseTo(0.5, 12);
    expect(momentum(100) * wavelength(100)).toBeCloseTo(h, 45);
    // relativistic correction is small at school-tube voltages (≈ 0.24 % at 5 kV)
    const corr = 1 - wavelengthRelativistic(5000) / wavelength(5000);
    expect(corr).toBeGreaterThan(0.002);
    expect(corr).toBeLessThan(0.003);
    // a tennis ball: absurdly small wavelength
    expect(wavelengthOf(0.058, 30)).toBeLessThan(1e-33);
  });

  it('graphite rings obey Bragg 2d sin θ = λ, shrink as V rises, and give d back', () => {
    const L = 0.135;
    const lam = wavelength(4000);
    for (const d of GRAPHITE_D) {
      const th = braggAngle(d, lam);
      expect(2 * d * Math.sin(th)).toBeCloseTo(lam, 22);
      const r = ringRadius(d, lam, L);
      expect(spacingFromRing(r, lam, L) / d).toBeCloseTo(1, 10);
      // small-angle: r ≈ Lλ/d
      expect(Math.abs(r / ((L * lam) / d) - 1)).toBeLessThan(0.01);
    }
    expect(ringRadius(GRAPHITE_D[0], wavelength(5000), L)).toBeLessThan(ringRadius(GRAPHITE_D[0], wavelength(2000), L));
    expect(Number.isNaN(braggAngle(0.1e-9, 0.3e-9))).toBe(true);
  });

  it('electrons arriving one at a time build up the two-slit pattern (counts within 4σ of the intensity)', () => {
    const lam = wavelength(600); // ≈ 50 pm
    const d = 272e-9;
    const a = 62e-9;
    const L = 1;
    const s = fringeSpacing(lam, d, L);
    const Y = 4 * s;
    const rng = new Rng(3);
    const N = 20000;
    let central = 0;
    let dark = 0;
    for (let i = 0; i < N; i++) {
      const y = sampleHit(rng, lam, d, a, L, Y);
      if (Math.abs(y) < s / 4) central++;
      if (Math.abs(Math.abs(y) - s / 2) < s / 20) dark++;
    }
    // expected fraction from a numerical integral of the intensity
    const integ = (f: (y: number) => number, lo: number, hi: number, n = 4000) => {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += f(lo + ((i + 0.5) * (hi - lo)) / n);
      return (sum * (hi - lo)) / n;
    };
    const I = (y: number) => slitIntensity(y, lam, d, a, L);
    const p = integ(I, -s / 4, s / 4) / integ(I, -Y, Y);
    expect(Math.abs(central / N - p)).toBeLessThan(4 * Math.sqrt((p * (1 - p)) / N));
    // near the first dark fringe almost nothing arrives
    expect(dark / N).toBeLessThan(0.004);
    // with one slit closed the dark fringe disappears
    let darkOne = 0;
    for (let i = 0; i < N; i++) if (Math.abs(Math.abs(sampleHit(rng, lam, d, a, L, Y, false)) - s / 2) < s / 20) darkOne++;
    expect(darkOne / N).toBeGreaterThan(0.02);
  });
});
