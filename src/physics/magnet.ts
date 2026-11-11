/**
 * Magnetic fields of currents, shown in a plane (x along the axis of loops, y across).
 *  - Long straight wire perpendicular to the plane at (x, y): B = μ₀I/(2πr), circles
 *    (anticlockwise for current out of the page).
 *  - Circular loop of radius a, axis along x, centre (x₀, y₀): exact field from complete
 *    elliptic integrals (no small-loop approximation):
 *      α² = a² + ρ² + z² − 2aρ, β² = a² + ρ² + z² + 2aρ, k² = 1 − α²/β², C = μ₀I/π
 *      B_axial = C/(2α²β) [(a² − ρ² − z²) E(k) + α² K(k)]
 *      B_ρ     = C z/(2α²βρ) [(a² + ρ² + z²) E(k) − α² K(k)]
 *  - Solenoid / bar magnet: many loops along the axis (a bar magnet's field is that of its
 *    equivalent surface current, i.e. a short solenoid).
 */
import { mu_0 } from '../core/constants';
import { ellipticKE } from '../core/special';

export type MagSource =
  | { kind: 'wire'; x: number; y: number; I: number }
  | { kind: 'loop'; x: number; y: number; a: number; I: number };

export function loopField(a: number, I: number, z: number, rho: number): [number, number] {
  const r2 = rho * rho + z * z;
  const alpha2 = a * a + r2 - 2 * a * rho;
  const beta2 = a * a + r2 + 2 * a * rho;
  if (alpha2 < 1e-24) return [NaN, NaN]; // on the wire itself
  const beta = Math.sqrt(beta2);
  const k = Math.sqrt(Math.max(0, 1 - alpha2 / beta2));
  const [K, E] = ellipticKE(Math.min(k, 1 - 1e-16));
  const C = (mu_0 * I) / Math.PI;
  const Bz = (C / (2 * alpha2 * beta)) * ((a * a - r2) * E + alpha2 * K);
  const Brho = rho < 1e-12 ? 0 : ((C * z) / (2 * alpha2 * beta * rho)) * ((a * a + r2) * E - alpha2 * K);
  return [Bz, Brho];
}

export function magField(srcs: MagSource[], x: number, y: number, out: [number, number] = [0, 0]): [number, number] {
  let bx = 0;
  let by = 0;
  for (const s of srcs) {
    if (s.kind === 'wire') {
      const dx = x - s.x;
      const dy = y - s.y;
      const r2 = dx * dx + dy * dy;
      const k = (mu_0 * s.I) / (2 * Math.PI * r2);
      // current out of the page (I > 0): field anticlockwise
      bx += -k * dy;
      by += k * dx;
    } else {
      const z = x - s.x;
      const rho = Math.abs(y - s.y);
      const [Bz, Brho] = loopField(s.a, s.I, z, rho);
      bx += Bz;
      by += Brho * Math.sign(y - s.y);
    }
  }
  out[0] = bx;
  out[1] = by;
  return out;
}

/** N loops of radius a spread evenly over length L centred at (x, y) */
export function solenoid(x: number, y: number, a: number, L: number, N: number, I: number): MagSource[] {
  return Array.from({ length: N }, (_, i) => ({ kind: 'loop' as const, x: x - L / 2 + (L * (i + 0.5)) / N, y, a, I }));
}
