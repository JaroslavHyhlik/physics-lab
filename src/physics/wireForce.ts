/**
 * Forces on currents in magnetic fields.
 *   straight conductor: F = I L × B, magnitude BIL sin θ (θ between the wire and B)
 *   two long parallel wires a distance r apart: F/L = μ₀I₁I₂/(2πr), attractive for currents in
 *   the same direction, repulsive for opposite currents (Newton's third law: equal and opposite).
 */
import { mu_0 } from '../core/constants';

export type Vec3 = [number, number, number];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** force [N] on a straight wire of length L along unit vector dir carrying current I in field B */
export function wireForce(I: number, L: number, dir: Vec3, B: Vec3): Vec3 {
  const f = cross(dir, B);
  return [I * L * f[0], I * L * f[1], I * L * f[2]];
}

/** force per unit length on wire 2 due to wire 1 (wires along z, wire 2 at +r on the x axis): x component */
export function parallelForcePerLength(I1: number, I2: number, r: number): number {
  // B of wire 1 at wire 2 is along +y for I1 out of the page; F = I2 ẑ × B ŷ = −I2 B x̂
  const B1 = (mu_0 * I1) / (2 * Math.PI * r);
  return -I2 * B1;
}
