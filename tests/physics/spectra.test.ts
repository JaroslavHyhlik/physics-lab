import { describe, expect, it } from 'vitest';
import { LAMPS, rydbergLambda, airIndex, photonEnergyEV } from '../../src/physics/spectra';

describe('E.1 atomic spectra', () => {
  it('Balmer series (n → 2) from the Rydberg formula matches the NIST hydrogen lines (air) within 0.02 nm', () => {
    LAMPS.H.lines.forEach((ln, i) => {
      const vac = rydbergLambda(2, i + 3);
      const air = vac / airIndex(vac);
      expect(Math.abs(air * 1e9 - ln.nm)).toBeLessThan(0.02);
    });
  });

  it('photon energies: E = hc/λ (Hα ≈ 1.89 eV); violet photons carry more energy than red ones', () => {
    expect(photonEnergyEV(656.28e-9)).toBeCloseTo(1.89, 2);
    expect(photonEnergyEV(410e-9)).toBeGreaterThan(photonEnergyEV(656e-9));
  });

  it('every lamp has its lines inside the visible range and relative intensities in (0, 1]', () => {
    for (const l of Object.values(LAMPS)) {
      for (const ln of l.lines) {
        expect(ln.nm).toBeGreaterThan(380);
        expect(ln.nm).toBeLessThan(760);
        expect(ln.rel).toBeGreaterThan(0);
        expect(ln.rel).toBeLessThanOrEqual(1);
      }
    }
  });
});
