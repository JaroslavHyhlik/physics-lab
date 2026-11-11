/**
 * Gravitational field and potential of point masses (superposition).
 *   g = GM/r² towards each mass;  V_g = −Σ GMᵢ/rᵢ;  g = −ΔV_g/Δr
 * Two masses: the field is zero at the neutral point on the line between them, where
 * GM₁/r₁² = GM₂/r₂², i.e. r₁/r₂ = √(M₁/M₂).
 */
import { G } from '../core/constants';

export interface Mass {
  x: number;
  y: number;
  M: number;
}

export function gField(ms: Mass[], x: number, y: number, out: [number, number] = [0, 0]): [number, number] {
  let gx = 0;
  let gy = 0;
  for (const m of ms) {
    const dx = m.x - x;
    const dy = m.y - y;
    const r2 = dx * dx + dy * dy;
    const r = Math.sqrt(r2);
    const k = (G * m.M) / (r2 * r);
    gx += k * dx;
    gy += k * dy;
  }
  out[0] = gx;
  out[1] = gy;
  return out;
}

export function gPotential(ms: Mass[], x: number, y: number): number {
  let v = 0;
  for (const m of ms) v -= (G * m.M) / Math.hypot(x - m.x, y - m.y);
  return v;
}

/** distance from mass 1 to the neutral point on the line to mass 2 (separation d) */
export const neutralPoint = (M1: number, M2: number, d: number) => d / (1 + Math.sqrt(M2 / M1));
