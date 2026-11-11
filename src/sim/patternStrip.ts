/**
 * Draws the pattern seen on a screen as a horizontal colour strip.
 * intensityAt(u, lambda) gives the relative intensity at screen coordinate u ∈ [umin, umax]
 * for wavelength lambda [m]. Monochromatic: the colour of λ scaled by I. White light: the
 * spectrum 400–700 nm is summed with the eye's colour-matching functions.
 */
import { spectrumToLinearRGB, gammaEncode } from '../physics/diffraction';
import { wavelengthRGB } from '../physics/blackbody';

export function drawPatternStrip(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  w: number,
  h: number,
  umin: number,
  umax: number,
  intensityAt: (u: number, lambda: number) => number,
  lambda: number,
  white: boolean,
  /** samples averaged across each pixel column (for very narrow maxima) */
  sub = 1,
): void {
  const avg = (u0: number, du: number, l: number) => {
    let s = 0;
    for (let k = 0; k < sub; k++) s += intensityAt(u0 + (du * (k + 0.5)) / sub, l);
    return s / sub;
  };
  const cols = Math.max(1, Math.floor(w));
  const img = ctx.createImageData(cols, 1);
  if (!white) {
    const [r, g, b] = wavelengthRGB(lambda * 1e9);
    // undo gamma to scale in linear light, then re-encode
    const lin = [r, g, b].map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    for (let i = 0; i < cols; i++) {
      const I = avg(umin + ((umax - umin) * i) / cols, (umax - umin) / cols, lambda);
      img.data[4 * i] = 255 * gammaEncode(lin[0] * I);
      img.data[4 * i + 1] = 255 * gammaEncode(lin[1] * I);
      img.data[4 * i + 2] = 255 * gammaEncode(lin[2] * I);
      img.data[4 * i + 3] = 255;
    }
  } else {
    const ls: number[] = [];
    for (let l = 400; l <= 700; l += 10) ls.push(l);
    const rgb: [number, number, number][] = [];
    let max = 1e-12;
    const w8: number[] = new Array(ls.length);
    for (let i = 0; i < cols; i++) {
      const u = umin + ((umax - umin) * i) / cols;
      for (let k = 0; k < ls.length; k++) w8[k] = avg(u, (umax - umin) / cols, ls[k] * 1e-9);
      const c = spectrumToLinearRGB(ls, w8);
      rgb.push(c);
      max = Math.max(max, c[0], c[1], c[2]);
    }
    for (let i = 0; i < cols; i++) {
      img.data[4 * i] = 255 * gammaEncode(rgb[i][0] / max);
      img.data[4 * i + 1] = 255 * gammaEncode(rgb[i][1] / max);
      img.data[4 * i + 2] = 255 * gammaEncode(rgb[i][2] / max);
      img.data[4 * i + 3] = 255;
    }
  }
  // stretch the single row over the strip height (device pixels handled by drawImage scaling)
  const tmp = document.createElement('canvas');
  tmp.width = cols;
  tmp.height = 1;
  tmp.getContext('2d')!.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(tmp, x0, y0, w, h);
  ctx.imageSmoothingEnabled = true;
}
