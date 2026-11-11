/**
 * E.3 (extra) Penetration of α, β and γ radiation, measured with a Geiger–Müller tube.
 *
 * Count rate = activity × particles per decay × detector efficiency × (fraction of all directions
 * that hit the window) × (fraction that gets through the absorber and the air), then the GM dead
 * time, plus background. Counts in a time interval are Poisson-distributed (seeded RNG).
 *
 * Geometry: a point source on the axis of a circular window of radius a at distance d sees the
 * fraction ½(1 − d/√(d² + a²)) of all directions; far away this tends to a²/(4d²), the inverse
 * square law.
 *
 * α (Am-241, 5.49 MeV): range in air from Geiger's rule R = 0.318 E^1.5 cm (E in MeV), about 4 cm;
 *   a sheet of paper stops them.
 * β (Sr-90 + its daughter Y-90, end-point energies 0.546 and 2.28 MeV, one of each per decay):
 *   approximately exponential absorption with μ/ρ = 17 E_max^−1.14 cm² g⁻¹ up to the maximum range
 *   R = 0.412 E^(1.265 − 0.0954 ln E) g cm⁻² (Katz & Penfold 1952), nothing beyond it.
 * γ (Co-60, two photons of 1.17 and 1.33 MeV per decay): narrow-beam exponential attenuation
 *   e^(−μx) with mass attenuation coefficients at 1.25 MeV from NIST XCOM.
 */
import type { Rng } from '../core/rng';

export type Source = 'alpha' | 'beta' | 'gamma';
export type Absorber = 'none' | 'paper' | 'al' | 'pb';

/** densities [g cm⁻³] */
export const RHO: Record<Exclude<Absorber, 'none'>, number> = { paper: 0.8, al: 2.7, pb: 11.35 };
export const RHO_AIR = 0.0012;
export const PAPER_MM = 0.1;
/** typical school sealed source: 185 kBq (5 µCi) */
export const ACTIVITY = 185e3;
/** GM window radius [cm] */
export const WINDOW_R = 0.7;
/** detector efficiency for a particle that reaches the window */
export const EFFICIENCY: Record<Source, number> = { alpha: 0.9, beta: 0.9, gamma: 0.01 };
/** particles of this kind per decay */
export const PER_DECAY: Record<Source, number> = { alpha: 1, beta: 2, gamma: 2 };
/** γ mass attenuation coefficients at 1.25 MeV [cm² g⁻¹] (NIST XCOM, rounded) */
export const GAMMA_MU_RHO = { paper: 0.063, al: 0.055, pb: 0.059, air: 0.057 };
export const ALPHA_E = 5.49; // MeV
export const BETA_EMAX = [0.546, 2.28]; // MeV
/** GM dead time [s] (non-paralysable) */
export const DEAD_TIME = 1e-4;
/** typical background count rate [s⁻¹] */
export const BACKGROUND = 0.4;

export const solidFraction = (d: number, a = WINDOW_R) => 0.5 * (1 - d / Math.hypot(d, a));
export const alphaRangeAir = (E = ALPHA_E) => 0.318 * E ** 1.5; // cm
export const betaMuRho = (Emax: number) => 17 * Emax ** -1.14; // cm² g⁻¹
export const betaRange = (Emax: number) => 0.412 * Emax ** (1.265 - 0.0954 * Math.log(Emax)); // g cm⁻²

/** areal density of the absorber [g cm⁻²] for a thickness in mm */
export function arealDensity(absorber: Absorber, xmm: number): number {
  if (absorber === 'none') return 0;
  const t = absorber === 'paper' ? PAPER_MM : xmm;
  return RHO[absorber] * t * 0.1;
}

/** fraction of the particles heading for the window that get through absorber and air */
export function transmission(source: Source, absorber: Absorber, xmm: number, dcm: number): number {
  if (source === 'alpha') {
    if (absorber !== 'none' && (absorber === 'paper' || xmm > 0)) return 0;
    const R = alphaRangeAir();
    return Math.min(1, Math.max(0, (R + 0.15 - dcm) / 0.3)); // ± 1.5 mm range straggling
  }
  const rx = arealDensity(absorber, xmm);
  if (source === 'beta') {
    const total = rx + RHO_AIR * dcm;
    let T = 0;
    for (const E of BETA_EMAX) if (total < betaRange(E)) T += Math.exp(-betaMuRho(E) * total);
    return T / BETA_EMAX.length;
  }
  const mu = absorber === 'none' ? 0 : GAMMA_MU_RHO[absorber];
  return Math.exp(-mu * rx - GAMMA_MU_RHO.air * RHO_AIR * dcm);
}

/** true rate of particles counted (before dead time), no background [s⁻¹] */
export function trueRate(source: Source, absorber: Absorber, xmm: number, dcm: number): number {
  return ACTIVITY * PER_DECAY[source] * EFFICIENCY[source] * solidFraction(dcm) * transmission(source, absorber, xmm, dcm);
}

/** rate the counter records: dead-time loss, then background added */
export function countRate(source: Source, absorber: Absorber, xmm: number, dcm: number, background = true): number {
  const R = trueRate(source, absorber, xmm, dcm);
  return R / (1 + R * DEAD_TIME) + (background ? BACKGROUND : 0);
}

/** Poisson random number with mean m (Knuth for small m, normal approximation for large m) */
export function poisson(rng: Rng, m: number): number {
  if (m <= 0) return 0;
  if (m < 30) {
    const L = Math.exp(-m);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= rng.next();
    } while (p > L);
    return k - 1;
  }
  return Math.max(0, Math.round(m + Math.sqrt(m) * rng.gaussian()));
}
