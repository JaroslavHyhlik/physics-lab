/**
 * E.3 Binding energy per nucleon, from measured atomic masses (AME2020).
 *
 * Binding energy: the energy needed to separate a nucleus into its protons and neutrons,
 *   BE = (Z m_p + N m_n − m_nucleus) c².
 * With atomic masses the electron masses cancel if hydrogen atoms are used: BE = (Z M(¹H) + N m_n − M_atom) c²
 * (ignoring the tiny electron binding energies). AME gives mass excesses Δ = (M − A u)c², so
 *   BE = Z Δ(¹H) + N Δ(n) − Δ(Z, N).
 * Reaction energies: Q = (Σ Δ before − Σ Δ after) when the number of nucleons and of protons is the same.
 *
 * Liquid-drop (semi-empirical, Weizsäcker) formula for comparison, beyond the syllabus:
 *   BE = a_v A − a_s A^(2/3) − a_c Z(Z−1)/A^(1/3) − a_a (A − 2Z)²/A ± δ,
 * coefficients from a common textbook fit (Krane, Introductory Nuclear Physics).
 */
import { Z as AZ, N as AN, BEA, MEX } from '../data/ame2020';
import { u_MeV } from '../core/constants';

export const DELTA_N = 8071.31806; // keV, neutron mass excess (AME2020)
export const DELTA_H = 7288.971064; // keV, ¹H atomic mass excess (AME2020)

export interface Nuclide {
  Z: number;
  N: number;
  A: number;
  bea: number; // MeV per nucleon (AME table)
  mex: number; // keV
}

export const NUCLIDES: Nuclide[] = AZ.map((z, i) => ({ Z: z, N: AN[i], A: z + AN[i], bea: BEA[i] / 1000, mex: MEX[i] }));

const index = new Map<number, Nuclide>();
for (const n of NUCLIDES) index.set(n.Z * 1000 + n.N, n);
export const find = (Z: number, N: number) => index.get(Z * 1000 + N);

/** binding energy [MeV] from mass excesses */
export function bindingEnergy(n: Nuclide): number {
  return (n.Z * DELTA_H + n.N * DELTA_N - n.mex) / 1000;
}
/** atomic mass [u] */
export const atomicMass = (n: Nuclide) => n.A + n.mex / 1000 / u_MeV;
/** mass defect [u] with atomic masses: Z M(¹H) + N m_n − M */
export const massDefect = (n: Nuclide) => (n.Z * DELTA_H + n.N * DELTA_N - n.mex) / 1000 / u_MeV;

/** Q value [MeV] of a reaction given as lists of [Z, N] before and after (neutron = [0, 1], ¹H = [1, 0]) */
export function qValue(before: [number, number][], after: [number, number][]): number {
  const d = ([z, n]: [number, number]) => (z === 0 && n === 1 ? DELTA_N : z === 1 && n === 0 ? DELTA_H : (find(z, n)?.mex ?? NaN));
  return (before.reduce((s, x) => s + d(x), 0) - after.reduce((s, x) => s + d(x), 0)) / 1000;
}

/** liquid-drop binding energy [MeV] (beyond syllabus) */
export function liquidDrop(Z: number, A: number): number {
  const N = A - Z;
  const av = 15.5;
  const as = 16.8;
  const ac = 0.72;
  const aa = 23;
  const ap = 34;
  let d = 0;
  if (Z % 2 === 0 && N % 2 === 0) d = ap * A ** -0.75;
  else if (Z % 2 === 1 && N % 2 === 1) d = -ap * A ** -0.75;
  return av * A - as * A ** (2 / 3) - (ac * Z * (Z - 1)) / A ** (1 / 3) - (aa * (A - 2 * Z) ** 2) / A + d;
}

/** proton number of the most tightly bound isobar for mass number A (liquid drop) */
export function valleyZ(A: number): number {
  let best = 1;
  let bb = -Infinity;
  for (let Z = 1; Z < A; Z++) {
    const b = liquidDrop(Z, A);
    if (b > bb) {
      bb = b;
      best = Z;
    }
  }
  return best;
}

export const SYMBOLS = ['n', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe', 'Cs', 'Ba', 'La', 'Ce', 'Pr', 'Nd', 'Pm', 'Sm', 'Eu', 'Gd', 'Tb', 'Dy', 'Ho', 'Er', 'Tm', 'Yb', 'Lu', 'Hf', 'Ta', 'W', 'Re', 'Os', 'Ir', 'Pt', 'Au', 'Hg', 'Tl', 'Pb', 'Bi', 'Po', 'At', 'Rn', 'Fr', 'Ra', 'Ac', 'Th', 'Pa', 'U', 'Np', 'Pu', 'Am', 'Cm', 'Bk', 'Cf', 'Es', 'Fm', 'Md', 'No', 'Lr', 'Rf', 'Db', 'Sg', 'Bh', 'Hs', 'Mt', 'Ds', 'Rg', 'Cn', 'Nh', 'Fl', 'Mc', 'Lv', 'Ts', 'Og'];
export const symbol = (Z: number) => SYMBOLS[Z] ?? `Z${Z}`;
