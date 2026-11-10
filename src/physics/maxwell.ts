/**
 * Maxwell–Boltzmann speed distribution of an ideal gas in 3D:
 *   f(v) = 4π (m/2πk_BT)^{3/2} v² exp(−mv²/2k_BT)
 * most probable v_p = √(2kT/m), mean v̄ = √(8kT/πm), root-mean-square v_rms = √(3kT/m).
 */
import { k_B } from '../core/constants';

export function maxwell(v: number, T: number, m: number): number {
  const a = m / (2 * k_B * T);
  return 4 * Math.PI * Math.pow(a / Math.PI, 1.5) * v * v * Math.exp(-a * v * v);
}
export const vMostProbable = (T: number, m: number) => Math.sqrt((2 * k_B * T) / m);
export const vMean = (T: number, m: number) => Math.sqrt((8 * k_B * T) / (Math.PI * m));
export const vRms = (T: number, m: number) => Math.sqrt((3 * k_B * T) / m);

/** cumulative distribution F(v) = erf(x) − (2/√π) x e^{−x²}, x = v/v_p */
export function maxwellCdf(v: number, T: number, m: number): number {
  const x = v / vMostProbable(T, m);
  return erf(x) - (2 / Math.sqrt(Math.PI)) * x * Math.exp(-x * x);
}

/** error function (Abramowitz & Stegun 7.1.26, |error| < 1.5 × 10⁻⁷) */
export function erf(x: number): number {
  const s = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax);
  return s * y;
}
