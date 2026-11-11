/**
 * Fraunhofer (far-field) diffraction by N identical slits of width b, spacing d:
 *   I(θ) = I₀ [sin β / β]² [sin(Nα) / (N sin α)]²,  β = π b sinθ / λ,  α = π d sinθ / λ
 * N = 1: single slit (first minimum b sinθ = λ, i.e. θ ≈ λ/b); N = 2: Young's double slit
 * (fringes s = λD/d for small angles); large N: grating (sharp maxima at d sinθ = nλ).
 * Normalised so that I(0) = 1.
 */
import { cie } from './blackbody';

export function slitIntensity(theta: number, lambda: number, b: number, d: number, N: number): number {
  const s = Math.sin(theta);
  const beta = (Math.PI * b * s) / lambda;
  const env = Math.abs(beta) < 1e-9 ? 1 : (Math.sin(beta) / beta) ** 2;
  if (N <= 1) return env;
  const a = (Math.PI * d * s) / lambda;
  const den = N * Math.sin(a);
  let inter: number;
  if (Math.abs(Math.sin(a)) < 1e-9) inter = 1;
  else inter = (Math.sin(N * a) / den) ** 2;
  return env * inter;
}

/** linear sRGB (not normalised) of light with spectrum given by weights at wavelengths [nm] */
export function spectrumToLinearRGB(lnm: number[], w: number[]): [number, number, number] {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let i = 0; i < lnm.length; i++) {
    const [x, y, z] = cie(lnm[i]);
    X += w[i] * x;
    Y += w[i] * y;
    Z += w[i] * z;
  }
  return [
    Math.max(0, 3.2406 * X - 1.5372 * Y - 0.4986 * Z),
    Math.max(0, -0.9689 * X + 1.8758 * Y + 0.0415 * Z),
    Math.max(0, 0.0557 * X - 0.204 * Y + 1.057 * Z),
  ];
}

export const gammaEncode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
