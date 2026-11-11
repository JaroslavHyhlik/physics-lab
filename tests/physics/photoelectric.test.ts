import { describe, expect, it } from 'vitest';
import {
  METALS,
  PhotoTube,
  kMax,
  photocurrent,
  photonEnergy,
  saturationCurrent,
  stoppingVoltage,
  thresholdFrequency,
  thresholdWavelength,
} from '../../src/physics/photoelectric';
import { linearFit } from '../../src/physics/dc';
import { Rng } from '../../src/core/rng';
import { h, c, e, m_e } from '../../src/core/constants';

describe('E.2 (HL) photoelectric effect', () => {
  it('E_k,max = hf − Φ, zero below the threshold frequency f₀ = Φ/h', () => {
    const phi = METALS.Sodium;
    const lambda = 400e-9;
    expect(kMax(lambda, phi)).toBeCloseTo((h * c) / lambda - phi * e, 30);
    // 400 nm photon ≈ 3.1 eV; booklet hc = 1.24 × 10⁻⁶ eV m is given to 3 s.f., so agree within 0.5 %
    expect(Math.abs(photonEnergy(lambda) / e / (1.24e-6 / 400e-9) - 1)).toBeLessThan(5e-3);
    const f0 = thresholdFrequency(phi);
    expect(f0).toBeCloseTo((phi * e) / h, 0);
    expect(kMax((c / f0) * 1.001, phi)).toBe(0); // just below f₀: nothing
    expect(kMax((c / f0) * 0.999, phi)).toBeGreaterThan(0);
    // zinc needs ultraviolet: λ₀ = hc/Φ ≈ 289 nm
    expect(thresholdWavelength(METALS.Zinc) * 1e9).toBeCloseTo(289, 0);
  });

  it('brighter light gives more current but the same stopping voltage', () => {
    const lambda = 300e-9;
    const phi = METALS.Calcium;
    expect(saturationCurrent(20e-6, lambda, phi) / saturationCurrent(10e-6, lambda, phi)).toBeCloseTo(2, 12);
    expect(stoppingVoltage(lambda, phi)).toBe(stoppingVoltage(lambda, phi)); // no P dependence
    expect(saturationCurrent(1, 700e-9, phi)).toBe(0); // red light on calcium: none at any power
  });

  it('the current falls from I_sat at V = 0 to zero at V = −V_s and stays saturated for V > 0', () => {
    const lambda = 250e-9;
    const phi = METALS.Copper;
    const P = 50e-6;
    const Is = saturationCurrent(P, lambda, phi);
    const Vs = stoppingVoltage(lambda, phi);
    expect(photocurrent(0, P, lambda, phi)).toBe(Is);
    expect(photocurrent(3, P, lambda, phi)).toBe(Is);
    expect(photocurrent(-Vs / 2, P, lambda, phi) / Is).toBeCloseTo(0.5, 12);
    expect(photocurrent(-Vs, P, lambda, phi)).toBeCloseTo(0, 20);
    expect(photocurrent(-Vs - 1, P, lambda, phi)).toBe(0);
  });

  it('gradient of E_k,max against f is h for every metal; the intercept is −Φ', () => {
    for (const phi of Object.values(METALS)) {
      const fs = [1.6e15, 1.8e15, 2e15];
      const ks = fs.map((f) => kMax(c / f, phi));
      const fit = linearFit(fs, ks);
      expect(fit.slope / h).toBeCloseTo(1, 10);
      expect(-fit.intercept / e).toBeCloseTo(phi, 10);
    }
  });

  it('electrons in the tube: energy ½mv² − eVx/d is conserved and the arrival fraction matches the current model (4σ)', () => {
    const tube = new PhotoTube(0.04, 4000);
    const V = -0.8;
    const K = kMax(220e-9, METALS.Zinc); // ≈ 1.34 eV
    // energy check on one electron
    const i = tube.emit(0.9 * K);
    const E0 = 0.5 * m_e * tube.v[i] ** 2;
    for (let n = 0; n < 50; n++) tube.step(1e-10, V);
    const En = 0.5 * m_e * tube.v[i] ** 2 - (e * V * tube.x[i]) / tube.d;
    expect(Math.abs(En - E0) / E0).toBeLessThan(1e-9);
    // Monte Carlo
    tube.clear();
    const rng = new Rng(7);
    const N = 4000;
    for (let n = 0; n < N; n++) tube.emit(K * rng.next());
    for (let n = 0; n < 20000 && tube.count() > 0; n++) tube.step(1e-10, V);
    expect(tube.count()).toBe(0);
    const p = photocurrent(V, 1, 220e-9, METALS.Zinc) / saturationCurrent(1, 220e-9, METALS.Zinc);
    const sigma = Math.sqrt((p * (1 - p)) / N);
    expect(Math.abs(tube.arrived / N - p)).toBeLessThan(4 * sigma);
    expect(tube.arrived + tube.returned).toBe(N);
  });
});
