import { describe, expect, it } from 'vitest';
import { displacement, strain, compressions } from '../../src/physics/waves';

const w = { A: 0.02, lambda: 0.8, f: 2.5 };

describe('C.2 travelling waves', () => {
  it('v = fλ: the whole pattern shifts by vΔt in time Δt', () => {
    const v = w.f * w.lambda;
    for (const x of [0.1, 0.5, 1.3]) {
      expect(displacement(x + v * 0.13, 0.2 + 0.13, w)).toBeCloseTo(displacement(x, 0.2, w), 12);
    }
  });

  it('each particle performs SHM with period 1/f and the same amplitude', () => {
    const T = 1 / w.f;
    for (const x of [0, 0.37]) {
      for (const t of [0, 0.11, 0.5]) expect(displacement(x, t + T, w)).toBeCloseTo(displacement(x, t, w), 12);
      let max = 0;
      for (let t = 0; t < T; t += T / 1000) max = Math.max(max, displacement(x, t, w));
      expect(max).toBeCloseTo(w.A, 4);
    }
  });

  it('particles one wavelength apart are in phase; λ/2 apart in antiphase', () => {
    expect(displacement(0.3 + w.lambda, 0.4, w)).toBeCloseTo(displacement(0.3, 0.4, w), 12);
    expect(displacement(0.3 + w.lambda / 2, 0.4, w)).toBeCloseTo(-displacement(0.3, 0.4, w), 12);
  });

  it('compressions are where the strain is most negative, one wavelength apart', () => {
    const c = compressions(3, 0.17, w);
    for (const x of c) expect(strain(x, 0.17, w)).toBeCloseTo((-2 * Math.PI * w.A) / w.lambda, 10);
    for (let i = 1; i < c.length; i++) expect(c[i] - c[i - 1]).toBeCloseTo(w.lambda, 12);
  });
});
