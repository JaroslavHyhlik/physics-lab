/**
 * Ray optics at a flat boundary.
 *   Snell: n₁ sin θ₁ = n₂ sin θ₂;  critical angle sin θ_c = n₂/n₁ (only if n₁ > n₂)
 *   Fresnel (beyond syllabus): fraction of light reflected for unpolarised light,
 *   R = (R_s + R_p)/2, T = 1 − R; at normal incidence R = ((n₁ − n₂)/(n₁ + n₂))².
 *   Optical fibre (core n₁, cladding n₂, outside n₀): acceptance angle sin θ_a = √(n₁² − n₂²)/n₀.
 */
export const MEDIA: Record<string, { name: string; n: number }> = {
  air: { name: 'Air', n: 1.0 },
  water: { name: 'Water', n: 1.33 },
  glass: { name: 'Glass', n: 1.5 },
  diamond: { name: 'Diamond', n: 2.42 },
};

/** refraction angle [rad], or null for total internal reflection */
export function refract(n1: number, n2: number, theta1: number): number | null {
  const s = (n1 / n2) * Math.sin(theta1);
  return Math.abs(s) > 1 ? null : Math.asin(s);
}

export function criticalAngle(n1: number, n2: number): number | null {
  return n1 > n2 ? Math.asin(n2 / n1) : null;
}

export function fresnelR(n1: number, n2: number, theta1: number): number {
  const t2 = refract(n1, n2, theta1);
  if (t2 === null) return 1;
  const c1 = Math.cos(theta1);
  const c2 = Math.cos(t2);
  const rs = (n1 * c1 - n2 * c2) / (n1 * c1 + n2 * c2);
  const rp = (n1 * c2 - n2 * c1) / (n1 * c2 + n2 * c1);
  return 0.5 * (rs * rs + rp * rp);
}

export function acceptanceAngle(n0: number, n1: number, n2: number): number {
  const s = Math.sqrt(Math.max(0, n1 * n1 - n2 * n2)) / n0;
  return s >= 1 ? Math.PI / 2 : Math.asin(s);
}
