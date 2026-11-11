/**
 * E.2 (HL) Compton scattering.
 *
 * A photon of wavelength λ scatters off a free electron at rest through angle θ. Conservation of
 * energy and momentum (with the relativistic electron) gives exactly
 *   λ' − λ = h/(m_e c) · (1 − cos θ).
 * The electron recoils with momentum p_e = p − p' (vectors) and kinetic energy hc/λ − hc/λ'.
 * Closed-form, no time stepping.
 */
import { h, c, m_e } from '../core/constants';

/** Compton wavelength h/(m_e c) [m] ≈ 2.43 pm */
export const COMPTON_WAVELENGTH = h / (m_e * c);

export interface ComptonResult {
  lambda2: number; // scattered wavelength [m]
  dLambda: number; // shift [m]
  E1: number; // incoming photon energy [J]
  E2: number; // scattered photon energy [J]
  K: number; // electron kinetic energy [J]
  pe: number; // electron momentum magnitude [kg m s⁻¹]
  phi: number; // electron recoil angle below the incoming direction [rad]
  v: number; // electron speed (relativistic) [m s⁻¹]
}

export function scatter(lambda: number, theta: number): ComptonResult {
  const dLambda = COMPTON_WAVELENGTH * (1 - Math.cos(theta));
  const lambda2 = lambda + dLambda;
  const p1 = h / lambda;
  const p2 = h / lambda2;
  const px = p1 - p2 * Math.cos(theta);
  const py = -p2 * Math.sin(theta);
  const E1 = p1 * c;
  const E2 = p2 * c;
  const K = E1 - E2;
  const gamma = 1 + K / (m_e * c * c);
  return {
    lambda2,
    dLambda,
    E1,
    E2,
    K,
    pe: Math.hypot(px, py),
    phi: Math.atan2(-py, px),
    v: c * Math.sqrt(1 - 1 / (gamma * gamma)),
  };
}
