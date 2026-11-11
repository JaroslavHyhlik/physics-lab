/**
 * E.3 Random radioactive decay.
 *
 * Each nucleus has the same constant probability per unit time λ of decaying, independent of its
 * age and of the other nuclei. Its lifetime is therefore exponentially distributed and is drawn
 * exactly once at the start: t = −ln(1 − U)/λ with U uniform in [0, 1) (seeded RNG). The number
 * left at time t is simply the count of lifetimes longer than t, so the result does not depend on
 * the time step or the frame rate at all.
 *
 * Dice model (SL analogue): every throw each die "decays" if it shows a six (p = 1/6), so the number
 * of throws it survives is geometric: P(still there after n throws) = (5/6)ⁿ.
 *
 * Expected values: N = N₀e^(−λt), A = λN, T½ = ln 2/λ.
 */
import type { Rng } from '../core/rng';

export interface Isotope {
  name: string;
  /** half-life in its display unit */
  half: number;
  unit: string;
  /** seconds per display unit */
  sec: number;
}

/** Half-lives from NUBASE2020 (Kondev et al., Chinese Phys. C 45, 030001, 2021), rounded. */
export const ISOTOPES: Record<string, Isotope> = {
  'Rn-220': { name: 'radon-220', half: 55.6, unit: 's', sec: 1 },
  'Ba-137m': { name: 'barium-137m', half: 2.55, unit: 'min', sec: 60 },
  'I-131': { name: 'iodine-131', half: 8.02, unit: 'd', sec: 86400 },
  'Co-60': { name: 'cobalt-60', half: 5.27, unit: 'y', sec: 3.156e7 },
  'C-14': { name: 'carbon-14', half: 5700, unit: 'y', sec: 3.156e7 },
};

export const DIE_P = 1 / 6;

export const decayConstant = (halfLife: number) => Math.LN2 / halfLife;
export const halfLifeOf = (lambda: number) => Math.LN2 / lambda;
export const expectedN = (N0: number, lambda: number, t: number) => N0 * Math.exp(-lambda * t);
/** for dice: survivors after n whole throws */
export const expectedDice = (N0: number, n: number, p = DIE_P) => N0 * (1 - p) ** Math.floor(n);
/** equivalent decay constant of the dice per throw, and their "half-life" in throws (≈ 3.8) */
export const diceLambda = (p = DIE_P) => -Math.log(1 - p);

/** exact random lifetimes of N nuclei with decay constant λ */
export function lifetimes(rng: Rng, N: number, lambda: number, out = new Float64Array(N)): Float64Array {
  for (let i = 0; i < N; i++) out[i] = -Math.log(1 - rng.next()) / lambda;
  return out;
}

/** throw on which each of N dice first shows a six (1, 2, 3, …) */
export function diceLifetimes(rng: Rng, N: number, p = DIE_P, out = new Float64Array(N)): Float64Array {
  for (let i = 0; i < N; i++) {
    let n = 1;
    while (rng.next() >= p) n++;
    out[i] = n;
  }
  return out;
}

/** number with lifetime longer than t (still undecayed at time t) */
export function remaining(times: Float64Array, t: number, N = times.length): number {
  let n = 0;
  for (let i = 0; i < N; i++) if (times[i] > t) n++;
  return n;
}
