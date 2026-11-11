/**
 * Bohr model of hydrogen (booklet constants).
 *   angular momentum quantised: mvr = nh/2π
 *   radius r_n = n² a₀ with a₀ = ε₀h²/(π m_e e²) ≈ 5.3 × 10⁻¹¹ m
 *   energy E_n = −13.6 eV / n²
 *   transition photon: hf = |E_upper − E_lower|, λ = hc/ΔE
 */
import { h, c, e, m_e, epsilon_0 } from '../core/constants';

export const A0 = (epsilon_0 * h * h) / (Math.PI * m_e * e * e);
export const energyEV = (n: number) => -13.6 / (n * n);
export const radius = (n: number) => n * n * A0;
/** orbital speed from mv²/r = ke²/r² with r = n²a₀ */
export const speed = (n: number) => (e * e) / (2 * epsilon_0 * h * n);

export function transition(nUpper: number, nLower: number) {
  const dE = (energyEV(nUpper) - energyEV(nLower)) * e; // J (positive)
  const lambda = (h * c) / dE;
  const series = nLower === 1 ? 'Lyman (ultraviolet)' : nLower === 2 ? 'Balmer (visible/UV)' : nLower === 3 ? 'Paschen (infrared)' : 'infrared';
  return { dEeV: dE / e, lambda, f: dE / h, series };
}
