/**
 * Black-body radiation.
 *   Planck: spectral exitance M_λ = 2πhc² / (λ⁵ (e^{hc/λk_BT} − 1))   [W m⁻² per m of wavelength]
 *   Wien:   λ_max T = 2.9 × 10⁻³ m K;  Stefan–Boltzmann: M = σT⁴
 * Uses the booklet values of h, c and k_B. With these rounded constants the exact area under
 * the Planck curve, 2π⁵k⁴T⁴/(15c²h³), differs from the booklet σT⁴ by about 0.5 %.
 *
 * Colour: the spectrum is weighted with the CIE 1931 colour-matching functions (multi-lobe
 * Gaussian fit by Wyman, Sloan & Shirley, JCGT 2013) and converted to sRGB.
 */
import { h, c, k_B, sigma } from '../core/constants';

/** spectral exitance [W m⁻³] at wavelength λ [m] and temperature T [K] */
export function planck(lambda: number, T: number): number {
  const x = (h * c) / (lambda * k_B * T);
  if (x > 700) return 0;
  return (2 * Math.PI * h * c * c) / (lambda ** 5 * Math.expm1(x));
}

/** total exitance from the exact integral of the Planck law with the booklet constants */
export function planckTotal(T: number): number {
  return ((2 * Math.PI ** 5 * k_B ** 4) / (15 * c * c * h ** 3)) * T ** 4;
}

export const stefanBoltzmann = (T: number) => sigma * T ** 4;

/** peak wavelength of the Planck curve found numerically [m] (golden-section search) */
export function peakWavelength(T: number): number {
  let a = 0.05 * (2.9e-3 / T);
  let b = 5 * (2.9e-3 / T);
  const r = (Math.sqrt(5) - 1) / 2;
  for (let i = 0; i < 200; i++) {
    const x1 = b - r * (b - a);
    const x2 = a + r * (b - a);
    if (planck(x1, T) > planck(x2, T)) b = x2;
    else a = x1;
  }
  return (a + b) / 2;
}

const lobe = (l: number, mu: number, s1: number, s2: number) => {
  const t = (l - mu) / (l < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
/** CIE 1931 colour-matching functions (λ in nm), Wyman et al. 2013 fit */
export function cie(lnm: number): [number, number, number] {
  return [
    1.056 * lobe(lnm, 599.8, 37.9, 31.0) + 0.362 * lobe(lnm, 442.0, 16.0, 26.7) - 0.065 * lobe(lnm, 501.1, 20.4, 26.2),
    0.821 * lobe(lnm, 568.8, 46.9, 40.5) + 0.286 * lobe(lnm, 530.9, 16.3, 31.1),
    1.217 * lobe(lnm, 437.0, 11.8, 36.0) + 0.681 * lobe(lnm, 459.0, 26.0, 13.8),
  ];
}

const gammaEncode = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

/** XYZ → sRGB components 0..1, scaled so the largest is 1 (brightness removed) */
export function xyzToRgb(X: number, Y: number, Z: number): [number, number, number] {
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  r = Math.max(0, r);
  g = Math.max(0, g);
  b = Math.max(0, b);
  const m = Math.max(r, g, b) || 1;
  return [gammaEncode(r / m), gammaEncode(g / m), gammaEncode(b / m)];
}

/** approximate colour of a black body at temperature T, as sRGB 0..1 */
export function blackbodyRGB(T: number): [number, number, number] {
  let X = 0;
  let Y = 0;
  let Z = 0;
  for (let l = 380; l <= 780; l += 5) {
    const p = planck(l * 1e-9, T);
    const [x, y, z] = cie(l);
    X += p * x;
    Y += p * y;
    Z += p * z;
  }
  return xyzToRgb(X, Y, Z);
}

/** colour of monochromatic light of wavelength λ [nm], sRGB 0..1 (out-of-gamut clipped) */
export function wavelengthRGB(lnm: number): [number, number, number] {
  const [x, y, z] = cie(lnm);
  return xyzToRgb(x, y, z);
}
