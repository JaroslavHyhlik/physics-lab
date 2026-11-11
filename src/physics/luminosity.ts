/**
 * E.5 Luminosity and apparent brightness.
 *
 * A star of radius R and surface temperature T radiates as a black body: L = σ A T⁴ = 4πR²σT⁴.
 * At distance d this power is spread over a sphere of area 4πd², so the apparent brightness
 * (power received per square metre) is b = L/(4πd²): the inverse square law.
 * If L is known (a "standard candle"), measuring b gives the distance d = √(L/(4πb)).
 */
import { sigma, AU, parsec } from '../core/constants';

export const R_SUN = 6.96e8; // m (IAU nominal 6.957e8)
export const T_SUN = 5772; // K (IAU nominal effective temperature)

export const luminosity = (R: number, T: number) => 4 * Math.PI * R * R * sigma * T ** 4;
export const brightness = (L: number, d: number) => L / (4 * Math.PI * d * d);
export const distanceFrom = (L: number, b: number) => Math.sqrt(L / (4 * Math.PI * b));
export const L_SUN = luminosity(R_SUN, T_SUN);

/** Example stars: radius [R☉], temperature [K], distance [pc]; rounded literature values */
export const STAR_DATA: Record<string, { R: number; T: number; dPc: number }> = {
  Sun: { R: 1, T: 5772, dPc: AU / parsec },
  'Proxima Centauri': { R: 0.154, T: 3042, dPc: 1.302 },
  'Sirius A': { R: 1.71, T: 9940, dPc: 2.64 },
  Vega: { R: 2.36, T: 9600, dPc: 7.68 },
  Betelgeuse: { R: 760, T: 3600, dPc: 168 },
};
