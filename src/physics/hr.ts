/**
 * E.5 Hertzsprung–Russell diagram.
 *
 * Temperature from the B−V colour index (Ballesteros 2012, black-body based):
 *   T = 4600 K · (1/(0.92(B−V) + 1.7) + 1/(0.92(B−V) + 0.62)).
 * The catalogue gives the visual luminosity L_V (from the absolute V magnitude). The total
 * (bolometric) luminosity is estimated with a black-body correction: a black body at T emits a
 * fraction ∝ B_λ(550 nm, T)/(σT⁴) of its power near the V band, so
 *   L = L_V · g(T)/g(T☉),   g(T) = σT⁴ / B_λ(550 nm, T).
 * Lines of constant radius follow from L = 4πR²σT⁴: L/L☉ = (R/R☉)² (T/T☉)⁴.
 * Main-sequence mass–luminosity relation (approximate): L/L☉ = (M/M☉)^3.5.
 */
import { h, c, k_B } from '../core/constants';

export const T_SUN = 5772;

export const tempFromBV = (bv: number) => 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));

/** Planck spectral radiance shape at 550 nm (constant factors cancel in the ratio) */
const b550 = (T: number) => 1 / Math.expm1((h * c) / (550e-9 * k_B * T));
const g = (T: number) => T ** 4 / b550(T);
/** bolometric luminosity from visual luminosity (black-body correction, = 1 for the Sun) */
export const bolometric = (Lv: number, T: number) => (Lv * g(T)) / g(T_SUN);
/** luminosity [L☉] of a star of radius R [R☉] and temperature T */
export const lumFromRT = (R: number, T: number) => R * R * (T / T_SUN) ** 4;
/** radius [R☉] from L [L☉] and T */
export const radiusFrom = (L: number, T: number) => Math.sqrt(L) * (T_SUN / T) ** 2;
/** main sequence: L ∝ M^3.5 */
export const msLuminosity = (M: number) => M ** 3.5;
/** main sequence radius, rough fit R ∝ M^0.8 (for placing a model star; labelled approximate) */
export const msRadius = (M: number) => M ** 0.8;
export const msTemperature = (M: number) => T_SUN * (msLuminosity(M) / msRadius(M) ** 2) ** 0.25;
