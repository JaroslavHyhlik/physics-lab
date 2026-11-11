/** Colour of monochromatic light with its true relative brightness (dim at the ends of the spectrum). */
import { spectrumToLinearRGB, gammaEncode } from '../physics/diffraction';

let maxLin = 0;
function ensureMax(): number {
  if (maxLin === 0) for (let l = 380; l <= 780; l += 2) maxLin = Math.max(maxLin, ...spectrumToLinearRGB([l], [1]));
  return maxLin;
}

/** sRGB 0–255 of light of wavelength λ [nm] scaled by intensity I (1 = bright) */
export function spectralRGB(lnm: number, I = 1, boost = 1.6): [number, number, number] {
  const m = ensureMax();
  const [r, g, b] = spectrumToLinearRGB([lnm], [1]);
  return [r, g, b].map((v) => 255 * gammaEncode(Math.min(1, (boost * I * v) / m))) as [number, number, number];
}

export const rgbStr = ([r, g, b]: [number, number, number]) => `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
