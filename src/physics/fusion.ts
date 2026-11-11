/**
 * E.5 (extra) Fusion in stars: the proton–proton chain and the Coulomb barrier.
 *
 * Coulomb barrier: two protons must come within about r₀ = 2R (R = R₀A^(1/3), A = 1) before the
 * strong force can hold them, where the electric potential energy is ke²/r₀ ≈ 0.6 MeV. The mean
 * kinetic energy of a particle in the Sun's core is only (3/2)kT ≈ 2 keV, so classically almost no
 * proton could get over the barrier. Quantum tunnelling (beyond the syllabus) lets a few through:
 * the probability ≈ exp(−√(E_G/E)) with the Gamow energy E_G = 2 m_r c² (π α Z₁Z₂)². Combined with
 * the Maxwell–Boltzmann tail exp(−E/kT) this gives the Gamow peak at E₀ = (E_G (kT)²/4)^(1/3).
 *
 * pp-I chain energies from atomic masses (AME2020): Q = (mass before − mass after) c².
 */
import { k_e, e, k_B, m_p, u_MeV, c, h, R_0 } from '../core/constants';

/** atomic masses [u], AME2020 (Wang et al., Chinese Phys. C 45, 030003, 2021), rounded to 8 decimals */
export const MASS = { H1: 1.00782503, H2: 2.01410178, He3: 3.01602932, He4: 4.00260325 };

export const MeV = 1e6 * e;

/** Q values of the pp-I chain [MeV]; positron annihilation is included by using atomic masses */
export const Q_PP = (2 * MASS.H1 - MASS.H2) * u_MeV; // p + p → ²H + e⁺ + ν
export const Q_PD = (MASS.H2 + MASS.H1 - MASS.He3) * u_MeV; // ²H + p → ³He + γ
export const Q_HE3 = (2 * MASS.He3 - MASS.He4 - 2 * MASS.H1) * u_MeV; // ³He + ³He → ⁴He + 2p
/** whole chain: 4 ¹H → ⁴He */
export const Q_TOTAL = 2 * Q_PP + 2 * Q_PD + Q_HE3;
/** average energy carried away by the two neutrinos in pp-I [MeV] (2 × 0.265) */
export const NEUTRINO_LOSS = 0.53;

/** distance at which two protons touch [m] */
export const R_TOUCH = 2 * R_0;
/** height of the Coulomb barrier between two nuclei of charges Z₁, Z₂ [J] */
export const barrier = (Z1 = 1, Z2 = 1, r = R_TOUCH) => (k_e * Z1 * Z2 * e * e) / r;
/** mean kinetic energy of a particle at temperature T [J] */
export const meanKE = (T: number) => 1.5 * k_B * T;
/** temperature at which the mean kinetic energy equals the barrier (classical estimate) [K] */
export const classicalTemperature = (Eb = barrier()) => Eb / (1.5 * k_B);
/** distance of closest approach for head-on protons with total kinetic energy E (centre-of-mass) [m] */
export const closestApproach = (E: number, Z1 = 1, Z2 = 1) => (k_e * Z1 * Z2 * e * e) / E;

/** fine-structure constant from booklet constants */
export const ALPHA = (k_e * e * e * 2 * Math.PI) / (h * c);
/** Gamow energy for two particles of reduced mass m_r [J] */
export const gamowEnergy = (Z1 = 1, Z2 = 1, mr = m_p / 2) => 2 * mr * c * c * (Math.PI * ALPHA * Z1 * Z2) ** 2;
/** Gamow peak energy E₀ [J] */
export const gamowPeak = (T: number, EG = gamowEnergy()) => Math.cbrt((EG * (k_B * T) ** 2) / 4);
/** tunnelling probability (Gamow factor) at energy E */
export const tunnelling = (E: number, EG = gamowEnergy()) => Math.exp(-Math.sqrt(EG / E));

/** log₁₀ of the fraction of Maxwell–Boltzmann particles with kinetic energy above E (works far into the tail) */
export function log10FractionAbove(E: number, T: number): number {
  const x = E / (k_B * T);
  if (x < 30) {
    const f = 2 * Math.sqrt(x / Math.PI) * Math.exp(-x) + erfc(Math.sqrt(x));
    return Math.log10(f);
  }
  // asymptotic: 2√(x/π) e^(−x) (1 + 1/(2x) …)
  return Math.log10(2 * Math.sqrt(x / Math.PI) * (1 + 1 / (2 * x))) - x / Math.LN10;
}

/** complementary error function (Numerical Recipes erfcc, |error| < 1.2 × 10⁻⁷) */
export function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

/** Maxwell–Boltzmann energy distribution f(E) dE (normalised) */
export const mbEnergy = (E: number, T: number) => (2 / Math.sqrt(Math.PI)) * Math.sqrt(E) * (k_B * T) ** -1.5 * Math.exp(-E / (k_B * T));
