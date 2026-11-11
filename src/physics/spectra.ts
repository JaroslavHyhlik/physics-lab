/**
 * Atomic line spectra.
 * Strong visible lines (wavelengths in air, nm) from the NIST Atomic Spectra Database
 * (strong-lines tables); relative intensities are rounded/approximate.
 * Hydrogen: Rydberg formula 1/λ = R_H (1/n₁² − 1/n₂²) gives vacuum wavelengths; converted
 * to air with Edlén's (1966) dispersion formula for standard air.
 * Photon energy E = hf = hc/λ.
 */
import { h, c, e } from '../core/constants';

export interface Line {
  nm: number;
  rel: number; // relative intensity 0–1 (approximate)
}

export const LAMPS: Record<string, { name: string; lines: Line[] }> = {
  H: {
    name: 'Hydrogen',
    lines: [
      { nm: 656.28, rel: 1 },
      { nm: 486.13, rel: 0.5 },
      { nm: 434.05, rel: 0.25 },
      { nm: 410.17, rel: 0.15 },
      { nm: 397.01, rel: 0.08 },
    ],
  },
  He: {
    name: 'Helium',
    lines: [
      { nm: 706.52, rel: 0.35 },
      { nm: 667.82, rel: 0.5 },
      { nm: 587.56, rel: 1 },
      { nm: 501.57, rel: 0.4 },
      { nm: 492.19, rel: 0.2 },
      { nm: 471.31, rel: 0.15 },
      { nm: 447.15, rel: 0.5 },
      { nm: 402.62, rel: 0.1 },
    ],
  },
  Hg: {
    name: 'Mercury',
    lines: [
      { nm: 404.66, rel: 0.6 },
      { nm: 407.78, rel: 0.2 },
      { nm: 435.83, rel: 1 },
      { nm: 491.6, rel: 0.05 },
      { nm: 546.07, rel: 1 },
      { nm: 576.96, rel: 0.4 },
      { nm: 579.07, rel: 0.4 },
    ],
  },
  Na: {
    name: 'Sodium',
    lines: [
      { nm: 588.995, rel: 1 },
      { nm: 589.592, rel: 0.5 },
      { nm: 568.82, rel: 0.05 },
      { nm: 615.42, rel: 0.04 },
      { nm: 498.28, rel: 0.03 },
    ],
  },
  Ne: {
    name: 'Neon',
    lines: [
      { nm: 540.06, rel: 0.2 },
      { nm: 585.25, rel: 0.8 },
      { nm: 588.19, rel: 0.4 },
      { nm: 594.48, rel: 0.5 },
      { nm: 603.0, rel: 0.2 },
      { nm: 607.43, rel: 0.35 },
      { nm: 609.62, rel: 0.4 },
      { nm: 614.31, rel: 0.6 },
      { nm: 616.36, rel: 0.25 },
      { nm: 621.73, rel: 0.25 },
      { nm: 626.65, rel: 0.35 },
      { nm: 633.44, rel: 0.45 },
      { nm: 638.3, rel: 0.45 },
      { nm: 640.22, rel: 1 },
      { nm: 650.65, rel: 0.6 },
      { nm: 659.9, rel: 0.4 },
      { nm: 692.95, rel: 0.3 },
      { nm: 703.24, rel: 0.4 },
    ],
  },
};

/** Rydberg constant for hydrogen (reduced mass), m⁻¹ (CODATA-based value, beyond the booklet) */
export const R_H = 1.0967758e7;

/** vacuum wavelength [m] of the hydrogen transition n₂ → n₁ */
export const rydbergLambda = (n1: number, n2: number) => 1 / (R_H * (1 / (n1 * n1) - 1 / (n2 * n2)));

/** refractive index of standard air (Edlén 1966), λ in vacuum [m] */
export function airIndex(lambdaVac: number): number {
  const s2 = (1 / (lambdaVac * 1e6)) ** 2;
  return 1 + 1e-8 * (8342.13 + 2406030 / (130 - s2) + 15997 / (38.9 - s2));
}

export const photonEnergyEV = (lambda: number) => (h * c) / lambda / e;
