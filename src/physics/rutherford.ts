/**
 * Rutherford scattering of α particles (charge Z₁e) by a heavy nucleus (Z₂e), fixed in place.
 * Coulomb repulsion F = kZ₁Z₂e²/r² gives hyperbolic paths:
 *   deflection: tan(θ/2) = kZ₁Z₂e² / (m v² b) = kZ₁Z₂e² / (2E_k b)   (b = impact parameter)
 *   head-on distance of closest approach: d = kZ₁Z₂e² / E_k
 * For a beam spread uniformly over an area, the number scattered per unit solid angle is
 * proportional to 1/sin⁴(θ/2). Nuclear radius (HL): R = R₀A^{1/3}.
 * Trajectories are integrated with RK4 using a step proportional to r/v (accurate near the nucleus).
 */
import { k_e, e, R_0 } from '../core/constants';

export const MEV = 1.6e-13; // J
export const M_ALPHA = 6.64e-27; // kg

export function deflection(b: number, Ek: number, Z1: number, Z2: number): number {
  return 2 * Math.atan((k_e * Z1 * Z2 * e * e) / (2 * Ek * Math.abs(b)));
}
export const closestApproach = (Ek: number, Z1: number, Z2: number) => (k_e * Z1 * Z2 * e * e) / Ek;
export const nuclearRadius = (A: number) => R_0 * Math.cbrt(A);

/** impact parameter that gives deflection θ */
export const impactFor = (theta: number, Ek: number, Z1: number, Z2: number) => (k_e * Z1 * Z2 * e * e) / (2 * Ek * Math.tan(theta / 2));

/**
 * Path of a particle coming from x = −x0 with impact parameter b (y offset), until it is
 * again at distance > x0. Returns points [x, y, …] and the final velocity direction.
 */
export function trajectory(b: number, Ek: number, Z1: number, Z2: number, m: number, x0: number, maxPts = 4000): { pts: number[]; angle: number; rmin: number } {
  const vInf = Math.sqrt((2 * Ek) / m);
  const K = (k_e * Z1 * Z2 * e * e) / m;
  // start at a finite distance with the same total energy and angular momentum as a particle
  // coming from infinity with speed vInf and impact parameter b
  const vStart = Math.sqrt(Math.max(1e-30, vInf * vInf - (2 * K) / x0));
  const v0 = vStart;
  let x = -Math.sqrt(Math.max(0, x0 * x0 - b * b));
  let y = (b * vInf) / vStart;
  let vx = vStart;
  let vy = 0;
  const pts = [x, y];
  let rmin = Infinity;
  const acc = (px: number, py: number): [number, number] => {
    const r2 = px * px + py * py;
    const r3 = r2 * Math.sqrt(r2);
    return [(K * px) / r3, (K * py) / r3];
  };
  for (let i = 0; i < 200000; i++) {
    const r = Math.hypot(x, y);
    rmin = Math.min(rmin, r);
    if (i > 10 && r > x0 * 1.05) break;
    const h = (0.002 * r) / v0;
    const [a1x, a1y] = acc(x, y);
    const k1 = [vx, vy, a1x, a1y];
    const [a2x, a2y] = acc(x + 0.5 * h * k1[0], y + 0.5 * h * k1[1]);
    const k2 = [vx + 0.5 * h * k1[2], vy + 0.5 * h * k1[3], a2x, a2y];
    const [a3x, a3y] = acc(x + 0.5 * h * k2[0], y + 0.5 * h * k2[1]);
    const k3 = [vx + 0.5 * h * k2[2], vy + 0.5 * h * k2[3], a3x, a3y];
    const [a4x, a4y] = acc(x + h * k3[0], y + h * k3[1]);
    const k4 = [vx + h * k3[2], vy + h * k3[3], a4x, a4y];
    x += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]);
    y += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
    vx += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]);
    vy += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
    if (i % 4 === 0 && pts.length < 2 * maxPts) pts.push(x, y);
  }
  pts.push(x, y);
  return { pts, angle: Math.atan2(Math.abs(vy), vx), rmin };
}
