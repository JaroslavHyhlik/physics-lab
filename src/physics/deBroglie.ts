/**
 * E.2 (HL) Matter waves.
 *
 * An electron accelerated from rest through a potential difference V has E_k = eV, momentum
 * p = √(2 m_e eV) and de Broglie wavelength λ = h/p (non-relativistic; at 5 kV the relativistic
 * correction to λ is only 0.24 %, noted in the sim).
 *
 * Graphite diffraction tube: the beam passes through thin polycrystalline graphite. Planes of
 * spacing d reflect strongly where 2d sin θ = λ (Bragg, first order); the beam is turned through 2θ,
 * so on a flat screen at distance L each spacing gives a ring of radius r = L tan 2θ.
 *
 * Double slit: far-field (Fraunhofer) intensity of two slits of width a and separation d,
 *   I(y) ∝ cos²(π d y/(λL)) · sinc²(π a y/(λL)),
 * and each electron lands at a random y drawn from I (rejection sampling with a seeded RNG).
 * With one slit closed only the single-slit envelope remains.
 */
import { h, e, m_e, c } from '../core/constants';
import type { Rng } from '../core/rng';

/** graphite lattice plane spacings [m] that give the two bright rings in school tubes */
export const GRAPHITE_D = [0.213e-9, 0.123e-9];

/** momentum of an electron accelerated through V [kg m s⁻¹] */
export const momentum = (V: number) => Math.sqrt(2 * m_e * e * V);
/** de Broglie wavelength λ = h/p [m] */
export const wavelength = (V: number) => h / momentum(V);
/** de Broglie wavelength with the relativistic momentum (for comparison) [m] */
export function wavelengthRelativistic(V: number): number {
  const K = e * V;
  const pc = Math.sqrt(K * K + 2 * K * m_e * c * c);
  return (h * c) / pc;
}
/** de Broglie wavelength of any body of mass m moving at speed v [m] */
export const wavelengthOf = (m: number, v: number) => h / (m * v);

/** Bragg angle θ [rad] for first-order reflection from spacing d, or NaN if λ > 2d */
export function braggAngle(d: number, lambda: number): number {
  const s = lambda / (2 * d);
  return s <= 1 ? Math.asin(s) : NaN;
}
/** ring radius on a flat screen at distance L [m]; NaN if the beam is turned through 90° or more */
export function ringRadius(d: number, lambda: number, L: number): number {
  const th = braggAngle(d, lambda);
  return 2 * th < Math.PI / 2 ? L * Math.tan(2 * th) : NaN;
}
/** plane spacing worked out from a measured ring radius (inverse of ringRadius) [m] */
export function spacingFromRing(r: number, lambda: number, L: number): number {
  const th = Math.atan(r / L) / 2;
  return lambda / (2 * Math.sin(th));
}

const sinc = (x: number) => (Math.abs(x) < 1e-9 ? 1 : Math.sin(x) / x);

/** relative intensity (peak 1) at height y on a screen at L behind slits of width a, separation d */
export function slitIntensity(y: number, lambda: number, d: number, a: number, L: number, bothOpen = true): number {
  const s = y / Math.hypot(y, L); // sin θ
  const env = sinc((Math.PI * a * s) / lambda) ** 2;
  return bothOpen ? env * Math.cos((Math.PI * d * s) / lambda) ** 2 : env;
}

/** fringe spacing λL/d (small angles) [m] */
export const fringeSpacing = (lambda: number, d: number, L: number) => (lambda * L) / d;

/** where the next electron lands: random y in [−Y, Y] distributed as slitIntensity */
export function sampleHit(rng: Rng, lambda: number, d: number, a: number, L: number, Y: number, bothOpen = true): number {
  for (let k = 0; k < 100000; k++) {
    const y = rng.uniform(-Y, Y);
    if (rng.next() < slitIntensity(y, lambda, d, a, L, bothOpen)) return y;
  }
  return 0;
}
