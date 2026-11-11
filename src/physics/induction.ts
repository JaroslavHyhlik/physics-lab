/**
 * Electromagnetic induction.
 *  Magnet and coil: the magnet is modelled as a short solenoid (its equivalent surface current);
 *  the flux through a coaxial circular turn of radius R from a turn of radius a carrying I at
 *  axial distance d is Φ = M I, with the exact mutual inductance (Maxwell)
 *     M = μ₀ √(Ra) [(2/k − k) K(k) − (2/k) E(k)],  k² = 4Ra / ((R + a)² + d²).
 *  emf = −N dΦ/dt = −N (dΦ/dx) v (Faraday; the minus sign is Lenz's law).
 *  AC generator: Φ = BA cos ωt per turn, ε = NBAω sin ωt, ε_rms = ε₀/√2.
 *  Rod on rails: ε = BvL, I = ε/R, braking force B I L:
 *     m dv/dt = F − B²L²v/R → v(t) = v_t + (v₀ − v_t) e^{−t/τ}, v_t = FR/(B²L²), τ = mR/(B²L²).
 */
import { mu_0 } from '../core/constants';
import { ellipticKE } from '../core/special';

export function mutualInductanceLoops(R: number, a: number, d: number): number {
  const k2 = (4 * R * a) / ((R + a) ** 2 + d * d);
  const k = Math.sqrt(Math.min(k2, 1 - 1e-15));
  const [K, E] = ellipticKE(k);
  return mu_0 * Math.sqrt(R * a) * ((2 / k - k) * K - (2 / k) * E);
}

export interface MagnetModel {
  a: number; // radius of the magnet [m]
  length: number; // length [m]
  loops: number; // number of equivalent current loops
  I: number; // current per loop [A]
}

/** flux through ONE turn of radius R centred at x = 0 from a magnet whose centre is at xm */
export function fluxFromMagnet(mag: MagnetModel, R: number, xm: number): number {
  let phi = 0;
  for (let i = 0; i < mag.loops; i++) {
    const x = xm - mag.length / 2 + (mag.length * (i + 0.5)) / mag.loops;
    phi += mutualInductanceLoops(R, mag.a, x) * mag.I;
  }
  return phi;
}

/** induced emf in N turns when the magnet (centre xm) moves with velocity v along the axis */
export function emfMagnetCoil(mag: MagnetModel, R: number, N: number, xm: number, v: number): number {
  const h = 1e-5;
  const dPhidx = (fluxFromMagnet(mag, R, xm + h) - fluxFromMagnet(mag, R, xm - h)) / (2 * h);
  return -N * dPhidx * v;
}

export const generatorEmf = (N: number, B: number, A: number, w: number, t: number) => N * B * A * w * Math.sin(w * t);

export function rodOnRails(m: number, R: number, B: number, L: number, F: number, v0: number, t: number) {
  const k = (B * B * L * L) / R;
  const vt = F / k;
  const tau = m / k;
  const v = vt + (v0 - vt) * Math.exp(-t / tau);
  const x = vt * t + (v0 - vt) * tau * (1 - Math.exp(-t / tau));
  const emf = B * L * v;
  return { v, x, vt, tau, emf, I: emf / R, Fmag: (B * B * L * L * v) / R };
}
