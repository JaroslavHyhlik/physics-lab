import { describe, expect, it } from 'vitest';
import {
  ALPHA,
  MeV,
  Q_HE3,
  Q_PD,
  Q_PP,
  Q_TOTAL,
  barrier,
  classicalTemperature,
  erfc,
  gamowEnergy,
  gamowPeak,
  log10FractionAbove,
  mbEnergy,
  meanKE,
  tunnelling,
} from '../../src/physics/fusion';
import { k_B } from '../../src/core/constants';

describe('E.5 fusion: pp chain and Coulomb barrier', () => {
  it('pp chain releases 26.7 MeV (4 ¹H → ⁴He), with steps 1.44, 5.49 and 12.86 MeV', () => {
    expect(Q_PP).toBeCloseTo(1.44, 2);
    expect(Q_PD).toBeCloseTo(5.49, 2);
    expect(Q_HE3).toBeCloseTo(12.86, 2);
    expect(Q_TOTAL).toBeCloseTo(26.7, 1);
  });

  it('the Coulomb barrier (≈ 0.6 MeV) is hundreds of times the mean thermal energy in the Sun’s core', () => {
    const Eb = barrier() / MeV;
    expect(Eb).toBeGreaterThan(0.5);
    expect(Eb).toBeLessThan(0.7);
    const ratio = barrier() / meanKE(1.57e7);
    expect(ratio).toBeGreaterThan(200);
    // classically you would need billions of kelvin
    expect(classicalTemperature()).toBeGreaterThan(4e9);
  });

  it('fine-structure constant ≈ 1/137, Gamow energy for p + p ≈ 0.49 MeV, Gamow peak ≈ 6 keV in the Sun', () => {
    // booklet constants have 3 significant figures, so 1/α ≈ 137.5 instead of 137.04
    expect(Math.abs(1 / ALPHA / 137.036 - 1)).toBeLessThan(0.01);
    expect(gamowEnergy() / MeV).toBeCloseTo(0.49, 1);
    const E0 = gamowPeak(1.57e7) / (1e3 * 1.6e-19);
    expect(E0).toBeGreaterThan(5);
    expect(E0).toBeLessThan(7);
    // E₀ is where exp(−E/kT) × tunnelling is largest
    const T = 1.57e7;
    const f = (E: number) => -E / (k_B * T) - Math.sqrt(gamowEnergy() / E);
    const E = gamowPeak(T);
    expect(f(E)).toBeGreaterThan(f(E * 1.05));
    expect(f(E)).toBeGreaterThan(f(E * 0.95));
    expect(tunnelling(E)).toBeLessThan(1e-3);
  });

  it('Maxwell–Boltzmann: the energy distribution is normalised and the tail fraction is consistent', () => {
    const T = 1e7;
    let s = 0;
    const dE = (k_B * T) / 200;
    for (let E = dE / 2; E < 40 * k_B * T; E += dE) s += mbEnergy(E, T) * dE;
    expect(s).toBeCloseTo(1, 4);
    expect(erfc(0)).toBeCloseTo(1, 6);
    expect(erfc(1)).toBeCloseTo(0.157299, 6);
    // the two branches of the tail formula agree at the switch-over
    const kT = k_B * T;
    expect(log10FractionAbove(29.999 * kT, T)).toBeCloseTo(log10FractionAbove(30.001 * kT, T), 2);
    expect(log10FractionAbove(barrier(), 1.57e7)).toBeLessThan(-150);
  });
});
