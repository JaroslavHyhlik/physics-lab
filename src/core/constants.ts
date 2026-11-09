/**
 * Physical constants — values exactly as in the IB Physics data booklet
 * (first assessment 2025, v1.2), so simulation results match hand calculations.
 * See docs/ib-reference.md. All values in SI units.
 */
export const g = 9.8; // acceleration of free fall at Earth's surface [m s^-2]
export const G = 6.67e-11; // gravitational constant [N m^2 kg^-2]
export const N_A = 6.02e23; // Avogadro constant [mol^-1]
export const R = 8.31; // gas constant [J K^-1 mol^-1]
export const k_B = 1.38e-23; // Boltzmann constant [J K^-1]
export const sigma = 5.67e-8; // Stefan–Boltzmann constant [W m^-2 K^-4]
export const k_e = 8.99e9; // Coulomb constant [N m^2 C^-2]
export const epsilon_0 = 8.85e-12; // permittivity of free space [C^2 N^-1 m^-2]
export const mu_0 = 4 * Math.PI * 1e-7; // permeability of free space [T m A^-1]
export const c = 3.0e8; // speed of light in vacuum [m s^-1]
export const h = 6.63e-34; // Planck constant [J s]
export const e = 1.6e-19; // elementary charge [C]
export const m_e = 9.11e-31; // electron rest mass [kg]
export const m_p = 1.673e-27; // proton rest mass [kg]
export const m_n = 1.675e-27; // neutron rest mass [kg]
export const u = 1.661e-27; // unified atomic mass unit [kg]
export const u_MeV = 931.5; // unified atomic mass unit [MeV c^-2]
export const S_solar = 1.36e3; // solar constant [W m^-2]
export const R_0 = 1.2e-15; // Fermi radius [m]
export const wienConstant = 2.9e-3; // λ_max T [m K]

// Unit conversions (booklet)
export const lightYear = 9.46e15; // [m]
export const parsec = 3.26 * lightYear; // [m]
export const AU = 1.5e11; // [m]
export const kWh = 3.6e6; // [J]
export const eV = e; // [J]

/** Surface gravitational field strengths for presets [m s^-2] (approximate, NASA fact sheets). */
export const surfaceGravity = {
  Moon: 1.62,
  Mars: 3.71,
  Earth: g,
  Jupiter: 24.79,
} as const;
